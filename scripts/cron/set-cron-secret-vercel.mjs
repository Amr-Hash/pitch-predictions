#!/usr/bin/env node
/**
 * Ensure CRON_SECRET exists on the alhabeed-api Vercel project (production).
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET> to the cron endpoints.
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/cron/set-cron-secret-vercel.mjs
 *   ENSURE_CRON_SECRET=1 node scripts/cron/set-cron-secret-vercel.mjs  # skip if already set
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const TEAM_ID = "team_4Xmlf7t3YpurUX6c1nZH0ra0";
const PROJECT_ID = "prj_FRxuskySw6XocyTyrftLpgZw2baf";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

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

function generateSecret() {
  return randomBytes(32).toString("base64url");
}

function resolveCronSecret() {
  if (process.env.CRON_SECRET?.trim()) {
    return process.env.CRON_SECRET.trim();
  }
  try {
    const envText = readFileSync(join(SCRIPT_DIR, "cron.env"), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^\s*CRON_SECRET=(.+)\s*$/);
      if (match && match[1].trim()) return match[1].trim();
    }
  } catch {
    // fall through
  }
  return generateSecret();
}

function hasProductionTarget(target) {
  return Array.isArray(target) ? target.includes("production") : target === "production";
}

const token = resolveToken();
const base = `https://api.vercel.com/v9/projects/${PROJECT_ID}`;

async function vercelFetch(path, init = {}) {
  const res = await fetch(`${base}${path}?teamId=${TEAM_ID}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const existing = await vercelFetch("/env");
const existingCron = (existing.envs || []).find(
  (row) => row.key === "CRON_SECRET" && hasProductionTarget(row.target)
);

if (existingCron && process.env.ENSURE_CRON_SECRET === "1") {
  console.log("CRON_SECRET already configured on production; leaving unchanged.");
  process.exit(0);
}

if (existingCron && !process.env.CRON_SECRET && !process.env.FORCE_CRON_SECRET) {
  console.log("CRON_SECRET already exists on production. Set FORCE_CRON_SECRET=1 to replace.");
  process.exit(0);
}

const cronSecret = resolveCronSecret();

if (existingCron) {
  await vercelFetch(`/env/${existingCron.id}`, { method: "DELETE" });
  console.log("Removed old CRON_SECRET");
}

await vercelFetch("/env", {
  method: "POST",
  body: JSON.stringify({
    key: "CRON_SECRET",
    value: cronSecret,
    type: "encrypted",
    target: ["production"],
  }),
});

console.log("Set CRON_SECRET on production. Redeploy the API for cron jobs to authenticate.");
