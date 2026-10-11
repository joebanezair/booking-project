#!/usr/bin/env node
/**
 * Safe local Codespaces bootstrap. Uses only Node.js built-ins.
 * - Does not overwrite custom secrets or delete Docker data/containers.
 * - Configures existing MongoDB on 27017 plus optional GridFS MongoDB on 27018.
 * - Keeps all passwords/connection strings out of logs and Git.
 *
 * From the repository root:
 *   node scripts/setup-codespaces.mjs
 *   node scripts/setup-codespaces.mjs --check
 *   node scripts/setup-codespaces.mjs --without-media
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = resolve(root, "server/.env");
const templateFile = resolve(root, "server/.env.example");
const checkOnly = process.argv.includes("--check");
const withoutMedia = process.argv.includes("--without-media");
const secret = () => randomBytes(32).toString("hex");
const safeText = value => String(value || "").replace(/\r\n/g, "\n");
const placeholder = v => !v || /^(?:replace_with|replace-|your_|your-|changeme|example_)/i.test(v);

function envValue(content, key) {
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=(.*)$/);
    if (match?.[1] !== key) continue;
    const v = match[2].trim();
    return v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))
      ? v.slice(1, -1) : v;
  }
  return "";
}

function setValue(content, key, value) {
  const lines = safeText(content).split("\n");
  let matched = false;
  const out = lines.filter(line => {
    const active = line.match(/^([A-Z][A-Z0-9_]*)\s*=/);
    if (active?.[1] !== key) return true;
    if (matched) return false; // Avoid conflicting duplicate active assignments.
    matched = true;
    return true;
  }).map(line => {
    if (line.match(/^([A-Z][A-Z0-9_]*)\s*=/)?.[1] === key) return key + "=" + value;
    return line;
  });
  if (!matched) out.push(key + "=" + value);
  return out.join("\n").replace(/\n*$/, "\n");
}

function docker(args, optional = false) {
  try {
    return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (optional && error.status === 1) return null;
    const reason = String(error.stderr || error.message || "Docker command failed").trim();
    throw new Error("Docker: " + reason);
  }
}

function container(name) {
  const raw = docker(["inspect", "--format", "{{json .Config.Env}}", name], true);
  if (!raw) return null;
  const vars = Object.fromEntries(JSON.parse(raw).map(entry => {
    const idx = entry.indexOf("=");
    return [entry.slice(0, idx), entry.slice(idx + 1)];
  }));
  const running = docker(["inspect", "--format", "{{.State.Running}}", name]) === "true";
  return { vars, running };
}

function ensureContainer(name, args) {
  const existing = container(name);
  if (existing) {
    if (!existing.running) docker(["start", name]);
    console.log("  ✓ " + name + (existing.running ? " already running" : " started"));
    return existing;
  }
  docker(["run", "-d", "--name", name, ...args]);
  console.log("  ✓ " + name + " created (persistent volume)");
  return container(name);
}

function warn(message) { console.warn("  ! " + message); }

async function check() {
  const content = existsSync(envFile) ? safeText(readFileSync(envFile, "utf8")) : "";
  console.log("\nBookFlow configuration check (secrets hidden)");
  for (const key of ["MONGO_URI", "MEDIA_MONGO_URI", "JWT_SECRET", "ADMIN_REGISTRATION_KEY", "MEDIA_SIGNING_SECRET", "RABBITMQ_URL", "DISTRIBUTED_RATE_LIMIT"]) {
    const v = envValue(content, key);
    console.log("  " + key + ": " + (placeholder(v) ? (v ? "PLACEHOLDER" : "NOT SET") : "SET"));
  }
  for (const name of ["booking-mongodb", "booking-media-mongodb"]) {
    try {
      const status = container(name);
      console.log("  " + name + ": " + (!status ? "NOT FOUND" : status.running ? "RUNNING" : "STOPPED"));
    } catch (error) { warn(error.message); }
  }
  for (const route of ["/api/health", "/api/ready", "/api/media/capabilities"]) {
    try {
      const r = await fetch("http://127.0.0.1:5000" + route, { signal: AbortSignal.timeout(2500) });
      const data = await r.json();
      console.log("  " + route + ": HTTP " + r.status + " " + JSON.stringify(data));
    } catch {
      console.log("  " + route + ": UNAVAILABLE (start backend: cd server && npm run dev)");
    }
  }
}

async function setup() {
  if (!existsSync(templateFile)) throw new Error("Run from a checkout that contains server/.env.example.");
  let content = safeText(readFileSync(existsSync(envFile) ? envFile : templateFile, "utf8"));
  const changes = [];

  function update(key, next) {
    const previous = envValue(content, key);
    if (previous === next) return;
    content = setValue(content, key, next);
    changes.push(key);
  }

  if (placeholder(envValue(content, "MONGO_URI")))
    update("MONGO_URI", "mongodb://127.0.0.1:27017/booking_app");
  if (placeholder(envValue(content, "JWT_SECRET")) || envValue(content, "JWT_SECRET").length < 32)
    update("JWT_SECRET", secret());
  if (placeholder(envValue(content, "ADMIN_REGISTRATION_KEY")) || envValue(content, "ADMIN_REGISTRATION_KEY").length < 32)
    update("ADMIN_REGISTRATION_KEY", secret());
  if (envValue(content, "ADMIN_EMAILS") === "owner@example.com")
    update("ADMIN_EMAILS", "");
  if (!envValue(content, "NODE_ENV")) update("NODE_ENV", "development");
  if (!envValue(content, "PORT")) update("PORT", "5000");
  if (!envValue(content, "CLIENT_URL")) update("CLIENT_URL", "http://localhost:5173");

  // Do not configure a second database for an existing remote/custom URI.
  const currentMedia = envValue(content, "MEDIA_MONGO_URI");
  const customMedia = currentMedia && !placeholder(currentMedia) && !currentMedia.includes("127.0.0.1:27018") && !currentMedia.includes("localhost:27018");
  console.log("BookFlow Codespaces setup");
  console.log("Checking MongoDB containers (no existing data will be deleted)...");
  ensureContainer("booking-mongodb", [
    "-p", "127.0.0.1:27017:27017",
    "-v", "booking-mongodb-data:/data/db", "mongo:7"
  ]);

  if (!withoutMedia && !customMedia) {
    const existing = container("booking-media-mongodb");
    const username = existing?.vars.MONGO_INITDB_ROOT_USERNAME || "bookflowmedia";
    const password = existing?.vars.MONGO_INITDB_ROOT_PASSWORD || randomBytes(24).toString("hex");
    if (existing && !existing.vars.MONGO_INITDB_ROOT_PASSWORD && !currentMedia)
      throw new Error("Media container exists without recoverable initialization credentials. Set MEDIA_MONGO_URI manually; no data was deleted.");
    ensureContainer("booking-media-mongodb", [
      "-p", "127.0.0.1:27018:27017",
      "-v", "booking-media-mongodb-data:/data/db",
      "-e", "MONGO_INITDB_ROOT_USERNAME=" + username,
      "-e", "MONGO_INITDB_ROOT_PASSWORD=" + password, "mongo:8"
    ]);
    if (placeholder(currentMedia)) {
      update("MEDIA_MONGO_URI", "mongodb://" + encodeURIComponent(username) + ":" + encodeURIComponent(password) + "@127.0.0.1:27018/bookflow_media?authSource=admin");
    } else {
      warn("Existing MEDIA_MONGO_URI preserved. Ensure it matches the media container credentials.");
    }
    if (placeholder(envValue(content, "MEDIA_SIGNING_SECRET")) || envValue(content, "MEDIA_SIGNING_SECRET").length < 32)
      update("MEDIA_SIGNING_SECRET", secret());
  } else if (customMedia) {
    warn("Custom/external media connection preserved; local media container not modified.");
  } else {
    console.log("  - Skipped media MongoDB (--without-media)");
  }

  // Never overwrite a non-placeholder secret or any unrelated configuration.
  writeFileSync(envFile, content, { mode: 0o600 });
  chmodSync(envFile, 0o600);
  console.log("  ✓ server/.env saved locally, permissions 600 (Git-ignored)");
  if (changes.length) console.log("  Updated fields: " + changes.join(", "));
  else console.log("  Existing values preserved; no environment changes needed.");
  if (envValue(content, "RABBITMQ_URL")) warn("RabbitMQ requires a running broker AND chat worker. This script does not deploy those services.");
  console.log("\nNext steps:");
  console.log("  Terminal 2: cd server && npm ci && npm run dev");
  console.log("  Terminal 3: cd client && npm ci && npm run dev -- --host 0.0.0.0");
  console.log("  Verify: node scripts/setup-codespaces.mjs --check");
  console.log("  Keep ports 27017 and 27018 private; back up your Docker volumes.");
}

try {
  if (checkOnly) await check();
  else await setup();
} catch (error) {
  console.error("Setup error: " + error.message);
  process.exitCode = 1;
}
