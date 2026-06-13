#!/usr/bin/env node
/**
 * Set football-data.org env vars on the alhabeed-api Vercel project (production).
 * Usage: FOOTBALL_DATA_API_TOKEN=... VERCEL_TOKEN=... node scripts/set-football-data-vercel.mjs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const TEAM_ID = "team_4Xmlf7t3YpurUX6c1nZH0ra0";
const PROJECT_ID = "prj_FRxuskySw6XocyTyrftLpgZw2baf";

function resolveToken() {
  if (process.env.VERCEL_TOKEN?.trim()) {
    return process.env.VERCEL_TOKEN.trim();
  }
  const candidates = [
    join(process.env.APPDATA || "", "xdg.data", "com.vercel.cli", "auth.json"),
    join(homedir(), ".vercel", "auth.json"),
  ];
  for (const path of candidates) {
    try {
      const auth = JSON.parse(readFileSync(path, "utf8"));
      if (auth.token?.trim()) return auth.token.trim();
    } catch {
      // try next path
    }
  }
  throw new Error(
    "No Vercel token found. Set VERCEL_TOKEN or run `vercel login` first."
  );
}

const apiToken = process.env.FOOTBALL_DATA_API_TOKEN?.trim();
if (!apiToken) {
  console.error("FOOTBALL_DATA_API_TOKEN is required.");
  process.exit(1);
}

const token = resolveToken();
const base = `https://api.vercel.com/v9/projects/${PROJECT_ID}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function vercelFetch(path, init = {}) {
  const res = await fetch(`${base}${path}?teamId=${TEAM_ID}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const desired = {
  FOOTBALL_DATA_API_TOKEN: apiToken,
  FOOTBALL_DATA_COMPETITION_CODE: "WC",
};

const existing = await vercelFetch("/env");
for (const env of existing.envs || []) {
  if (Object.prototype.hasOwnProperty.call(desired, env.key)) {
    await vercelFetch(`/env/${env.id}`, { method: "DELETE" });
    console.log(`Removed old ${env.key}`);
  }
}

for (const [key, value] of Object.entries(desired)) {
  await vercelFetch("/env", {
    method: "POST",
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production"],
    }),
  });
  console.log(`Set ${key} on production`);
}

console.log("Redeploying backend so env vars take effect...");
const deploy = spawnSync(
  "npx",
  ["--yes", "vercel@latest", "deploy", "--prod", "--yes", "--token", token],
  {
    cwd: join(process.cwd(), "backend"),
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      VERCEL_ORG_ID: TEAM_ID,
      VERCEL_PROJECT_ID: PROJECT_ID,
    },
  }
);
if (deploy.status !== 0) {
  console.error(deploy.stdout);
  console.error(deploy.stderr);
  process.exit(deploy.status || 1);
}

console.log(
  "Done. Set CRON_SECRET on Vercel and install scripts/cron/crontab.example on your cron host."
);
