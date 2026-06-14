#!/usr/bin/env node
/**
 * Register Alhabeed cron jobs on cron-job.org (calls Vercel API endpoints).
 *
 * Usage:
 *   CRON_JOB_ORG_API_KEY=... CRON_SECRET=... node scripts/cron/setup-cron-job-org.mjs
 *
 * Reads optional secrets from scripts/cron/cron-job-org.env and scripts/cron/cron.env
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

const JOBS = [
  {
    title: "Alhabeed Live Scores",
    path: "/api/cron/sync-live-scores",
    schedule: {
      timezone: "UTC",
      expiresAt: 0,
      hours: [-1],
      mdays: [-1],
      minutes: [0, 15, 30, 45],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    title: "Alhabeed Match Reminders",
    path: "/api/cron/send-match-reminders",
    schedule: {
      timezone: "UTC",
      expiresAt: 0,
      hours: [-1],
      mdays: [-1],
      minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
      months: [-1],
      wdays: [-1],
    },
  },
  {
    title: "Alhabeed Background Jobs",
    path: "/api/cron/process-jobs?limit=50",
    schedule: {
      timezone: "UTC",
      expiresAt: 0,
      hours: [-1],
      mdays: [-1],
      minutes: [-1],
      months: [-1],
      wdays: [-1],
    },
  },
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
    // optional file
  }
}

loadEnvFile(join(SCRIPT_DIR, "cron.env"));
loadEnvFile(join(SCRIPT_DIR, "cron-job-org.env"));

const apiKey = process.env.CRON_JOB_ORG_API_KEY?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();

if (!apiKey) {
  console.error("Set CRON_JOB_ORG_API_KEY (env or scripts/cron/cron-job-org.env).");
  process.exit(1);
}
if (!cronSecret) {
  console.error(
    "Set CRON_SECRET (env or scripts/cron/cron.env). Run set-cron-secret-vercel.mjs first."
  );
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function jobPayload(definition) {
  return {
    url: `${API_URL}${definition.path}`,
    enabled: true,
    title: definition.title,
    saveResponses: false,
    requestMethod: 0,
    requestTimeout: 120,
    schedule: definition.schedule,
    extendedData: {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    },
  };
}

async function upsertJob(definition, existing) {
  const match = existing.find(
    (job) => job.title === definition.title || job.url === `${API_URL}${definition.path}`
  );
  const job = jobPayload(definition);
  if (match) {
    console.log(`Updating ${definition.title} (jobId ${match.jobId})...`);
    await api(`/jobs/${match.jobId}`, {
      method: "PATCH",
      body: JSON.stringify({ job }),
    });
    return match.jobId;
  }
  console.log(`Creating ${definition.title}...`);
  const created = await api("/jobs", { method: "PUT", body: JSON.stringify({ job }) });
  return created.jobId;
}

async function main() {
  const { jobs = [] } = await api("/jobs");
  const ids = [];
  for (const definition of JOBS) {
    ids.push(await upsertJob(definition, jobs));
  }
  console.log("cron-job.org jobs ready:");
  for (const id of ids) {
    console.log(`  https://console.cron-job.org/jobs/${id}`);
  }
  console.log(`Ensure CRON_SECRET on Vercel matches scripts/cron/cron.env, then redeploy the API.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
