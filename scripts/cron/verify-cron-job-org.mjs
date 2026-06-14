#!/usr/bin/env node
/**
 * Verify cron-job.org jobs are returning HTTP 200 from the Vercel API.
 * Reads secrets from scripts/cron/cron-job-org.env
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const API = "https://api.cron-job.org";
const API_URL = (process.env.ALHABEED_API_URL || "https://alhabeed-api.vercel.app").replace(
  /\/$/,
  ""
);

const EXPECTED_JOBS = [
  { title: "Alhabeed Live Scores", path: "/api/cron/sync-live-scores" },
  { title: "Alhabeed Match Reminders", path: "/api/cron/send-match-reminders" },
  { title: "Alhabeed Background Jobs", path: "/api/cron/process-jobs?limit=50" },
];

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    }
  } catch {
    // optional
  }
}

loadEnvFile(join(SCRIPT_DIR, "cron-job-org.env"));

const apiKey = process.env.CRON_JOB_ORG_API_KEY?.trim();
if (!apiKey) {
  console.error("Missing CRON_JOB_ORG_API_KEY in scripts/cron/cron-job-org.env");
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  const { jobs = [] } = await api("/jobs");
  let ok = true;

  for (const expected of EXPECTED_JOBS) {
    const expectedUrl = `${API_URL}${expected.path}`;
    const match = jobs.find(
      (job) => job.title === expected.title || job.url === expectedUrl
    );
    if (!match) {
      console.log(`\n${expected.title}`);
      console.log(`  MISSING — run: node scripts/cron/setup-cron-job-org.mjs`);
      ok = false;
      continue;
    }

    const { jobDetails } = await api(`/jobs/${match.jobId}`);
    const { history = [] } = await api(`/jobs/${match.jobId}/history`);
    const latest = history[0];
    console.log(`\n${jobDetails.title} (${match.jobId})`);
    console.log(`  URL: ${jobDetails.url}`);
    console.log(`  Enabled: ${jobDetails.enabled}`);
    if (latest) {
      console.log(
        `  Latest run: HTTP ${latest.httpStatus} (${latest.statusText}) at ${new Date(latest.date * 1000).toISOString()}`
      );
      if (latest.httpStatus !== 200) ok = false;
    } else {
      console.log("  Latest run: none yet (wait for next schedule or Run now in console)");
    }
  }

  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
