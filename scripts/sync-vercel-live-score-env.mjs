#!/usr/bin/env node
/**
 * Upsert live score env vars on Vercel alhabeed-api using VERCEL_TOKEN + CRON_SECRET.
 * Intended for GitHub Actions (secrets available) or local use:
 *   VERCEL_TOKEN=... CRON_SECRET=... node scripts/sync-vercel-live-score-env.mjs
 */
const VERCEL_TEAM_ID = "team_4Xmlf7t3YpurUX6c1nZH0ra0";
const VERCEL_PROJECT_ID = "prj_FRxuskySw6XocyTyrftLpgZw2baf";

const ENV_VARS = [
  { key: "LIVE_SCORE_SYNC_START", value: "2026-06-11" },
  { key: "LIVE_SCORE_SYNC_END", value: "2026-07-19" },
];

async function vercelFetch(path, { method = "GET", body } = {}) {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    throw new Error("VERCEL_TOKEN is not set.");
  }
  const response = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Vercel API ${method} ${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function upsertEnv(key, value) {
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

async function main() {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    throw new Error("CRON_SECRET is not set.");
  }

  const existing = await vercelFetch(
    `/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`
  );
  const keys = new Set((existing?.envs || []).map((item) => item.key));

  await upsertEnv("CRON_SECRET", cronSecret);
  for (const item of ENV_VARS) {
    await upsertEnv(item.key, item.value);
  }

  const apiFootballKey = process.env.API_FOOTBALL_KEY?.trim();
  if (apiFootballKey) {
    await upsertEnv("API_FOOTBALL_KEY", apiFootballKey);
  } else if (!keys.has("API_FOOTBALL_KEY")) {
    console.warn(
      "WARNING: API_FOOTBALL_KEY is not set on Vercel alhabeed-api. " +
        "Fixture mapping and live sync will fail until you add it."
    );
  }

  console.log("Live score env vars synced to Vercel alhabeed-api.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
