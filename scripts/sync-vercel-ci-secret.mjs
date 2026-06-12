#!/usr/bin/env node
/**
 * Sync a Vercel access token into GitHub Actions (VERCEL_TOKEN).
 *
 * Usage (from repo root):
 *   node scripts/sync-vercel-ci-secret.mjs
 *   VERCEL_TOKEN=<classic-token> node scripts/sync-vercel-ci-secret.mjs
 *
 * Classic tokens: https://vercel.com/account/tokens
 * OAuth CLI sessions cannot mint new tokens; use a dashboard classic token if needed.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function authFileCandidates() {
  const home = homedir();
  const paths = [join(home, ".vercel", "auth.json")];
  if (process.env.APPDATA) {
    paths.push(join(process.env.APPDATA, "com.vercel.cli", "auth.json"));
  }
  if (process.env.LOCALAPPDATA) {
    paths.push(join(process.env.LOCALAPPDATA, "com.vercel.cli", "auth.json"));
  }
  return paths;
}

function resolveToken() {
  if (process.env.VERCEL_TOKEN?.trim()) {
    return process.env.VERCEL_TOKEN.trim();
  }

  const authPath = authFileCandidates().find((path) => existsSync(path));
  if (!authPath) {
    console.error(
      "No VERCEL_TOKEN in environment and no ~/.vercel/auth.json found.\n" +
        "Create a classic token at https://vercel.com/account/tokens then run:\n" +
        "  VERCEL_TOKEN=<token> node scripts/sync-vercel-ci-secret.mjs"
    );
    process.exit(1);
  }

  const auth = JSON.parse(readFileSync(authPath, "utf8"));
  const token = auth.token?.trim();
  if (!token) {
    console.error("~/.vercel/auth.json has no token field.");
    process.exit(1);
  }
  return token;
}

function verifyToken(token) {
  const result = spawnSync(
    "npx",
    ["vercel@latest", "whoami", "--token", token, "--scope", "amr-hashem"],
    { encoding: "utf8", shell: true }
  );
  if (result.status !== 0) {
    console.error(
      "The Vercel token is not valid for CLI deploys.\n" +
        "Create a new classic token at https://vercel.com/account/tokens and run:\n" +
        "  VERCEL_TOKEN=<token> node scripts/sync-vercel-ci-secret.mjs"
    );
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(1);
  }
  const username = (result.stdout || "").trim().split("\n").pop()?.trim();
  console.log(`Verified Vercel token for: ${username || "unknown user"}`);
}

function setGitHubSecret(token) {
  const result = spawnSync("gh", ["secret", "set", "VERCEL_TOKEN"], {
    input: token,
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.error("Failed to set GitHub secret VERCEL_TOKEN. Is `gh` authenticated?");
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(1);
  }
  console.log("Updated GitHub Actions secret: VERCEL_TOKEN");
}

const token = resolveToken();
verifyToken(token);
setGitHubSecret(token);
