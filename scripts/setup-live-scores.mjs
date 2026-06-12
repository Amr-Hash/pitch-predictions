#!/usr/bin/env node
/**
 * One-time live score production setup:
 * 1. Generate CRON_SECRET (or reuse CRON_SECRET env)
 * 2. Store in GitHub Actions secrets
 * 3. Upsert env vars on Vercel alhabeed-api (needs VERCEL_TOKEN)
 * 4. Trigger Deploy workflow and map WC 2026 fixtures on production
 *
 * Usage:
 *   node scripts/setup-live-scores.mjs
 *   API_FOOTBALL_KEY=<key> VERCEL_TOKEN=<token> node scripts/setup-live-scores.mjs
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const VERCEL_TEAM_ID = "team_4Xmlf7t3YpurUX6c1nZH0ra0";
const VERCEL_PROJECT_ID = "prj_FRxuskySw6XocyTyrftLpgZw2baf";
const API_URL = "https://alhabeed-api.vercel.app";

const ENV_VARS = [
  { key: "LIVE_SCORE_SYNC_START", value: "2026-06-11" },
  { key: "LIVE_SCORE_SYNC_END", value: "2026-07-19" },
];

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", shell: true, ...options });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed:\n${(result.stderr || result.stdout || "").trim()}`
    );
  }
  return (result.stdout || "").trim();
}

async function vercelFetch(path, { method = "GET", body } = {}) {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    return null;
  }
  const url = `https://api.vercel.com${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`Vercel API ${method} ${path} failed (${response.status}): ${text}`);
  }
  return data;
}

async function upsertVercelEnv(key, value) {
  const existing = await vercelFetch(
    `/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`
  );
  const found = (existing?.envs || []).find((item) => item.key === key);
  const payload = {
    key,
    value,
    type: "encrypted",
    target: ["production", "preview", "development"],
  };
  if (found?.id) {
    await vercelFetch(
      `/v9/projects/${VERCEL_PROJECT_ID}/env/${found.id}?teamId=${VERCEL_TEAM_ID}`,
      { method: "PATCH", body: payload }
    );
    console.log(`Updated Vercel env: ${key}`);
  } else {
    await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`, {
      method: "POST",
      body: payload,
    });
    console.log(`Created Vercel env: ${key}`);
  }
}

async function callProduction(path, cronSecret, { method = "GET" } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data };
}

async function main() {
  const cronSecret = process.env.CRON_SECRET?.trim() || randomBytes(32).toString("hex");
  console.log("Setting GitHub secret CRON_SECRET...");
  run("gh", ["secret", "set", "CRON_SECRET", "--repo", "Amr-Hash/alhabeed"], {
    input: cronSecret,
  });
  console.log("GitHub secret CRON_SECRET updated.");

  if (process.env.VERCEL_TOKEN?.trim()) {
    console.log("Syncing live score env vars to Vercel alhabeed-api...");
    await upsertVercelEnv("CRON_SECRET", cronSecret);
    for (const item of ENV_VARS) {
      await upsertVercelEnv(item.key, item.value);
    }
    const apiFootballKey = process.env.API_FOOTBALL_KEY?.trim();
    if (apiFootballKey) {
      await upsertVercelEnv("API_FOOTBALL_KEY", apiFootballKey);
      console.log("Set API_FOOTBALL_KEY on Vercel.");
    } else {
      console.warn("API_FOOTBALL_KEY not provided — mapping will fail until you set it on Vercel.");
    }
    console.log("Vercel env updated. Redeploy backend so runtime picks up new env.");
    run("gh", ["workflow", "run", "Setup Live Scores", "--repo", "Amr-Hash/alhabeed"]);
    console.log("Triggered Setup Live Scores workflow (deploy + map).");
    return;
  } else {
    console.log("\nAdd these on Vercel → alhabeed-api → Environment Variables, then redeploy:");
    console.log(`  CRON_SECRET=${cronSecret}`);
    for (const item of ENV_VARS) {
      console.log(`  ${item.key}=${item.value}`);
    }
    console.log("\nAlso ensure API_FOOTBALL_KEY is set on Vercel.");
    console.log("Then run: gh workflow run Deploy --repo Amr-Hash/alhabeed");
    console.log("Or re-run: API_FOOTBALL_KEY=<key> VERCEL_TOKEN=<token> node scripts/setup-live-scores.mjs");
    return;
  }

  console.log("\nSetup triggered on GitHub Actions. Watch: Actions → Setup Live Scores");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
