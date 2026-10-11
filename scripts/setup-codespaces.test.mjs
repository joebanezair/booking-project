import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtureDocker = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const file = process.env.FAKE_DOCKER_STATE;
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const args = process.argv.slice(2);
const command = args[0];
if (command === "inspect") {
  const name = args.at(-1);
  if (!state[name]) process.exit(1);
  if (args.includes("{{json .Config.Env}}")) process.stdout.write(JSON.stringify(state[name].env) + "\n");
  else if (args.includes("{{.State.Running}}")) process.stdout.write(String(state[name].running) + "\n");
} else if (command === "run") {
  const name = args[args.indexOf("--name") + 1];
  if (state[name]) process.exit(1);
  const env = [];
  for (let i=0; i<args.length; i++) if (args[i] === "-e") env.push(args[i+1]);
  state[name] = { running: true, env };
  fs.writeFileSync(file, JSON.stringify(state));
  process.stdout.write("fake-container-id\n");
} else if (command === "start") {
  for (const name of args.slice(1)) {
    if (!state[name]) process.exit(1);
    state[name].running = true;
  }
  fs.writeFileSync(file, JSON.stringify(state));
} else {
  process.stderr.write("unsupported fake Docker command: " + command);
  process.exit(1);
}
`;

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "bookflow-setup-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "server"));
  mkdirSync(join(dir, "bin"));
  copyFileSync(join(repo, "scripts/setup-codespaces.mjs"), join(dir, "scripts/setup-codespaces.mjs"));
  copyFileSync(join(repo, "server/.env.example"), join(dir, "server/.env.example"));
  writeFileSync(join(dir, "bin/docker"), fixtureDocker);
  chmodSync(join(dir, "bin/docker"), 0o755);
  const env = { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH, FAKE_DOCKER_STATE: join(dir, "state.json") };
  const run = (...args) => spawnSync(process.execPath, [join(dir, "scripts/setup-codespaces.mjs"), ...args], {
    cwd: dir, env, encoding: "utf8"
  });
  return { dir, run, path: join(dir, "server/.env"), state: join(dir, "state.json") };
}

function setting(raw, key) {
  const found = raw.match(new RegExp("^" + key + "=(.*)$", "m"));
  return found?.[1] || "";
}

test("fresh setup creates isolated media database and secure untracked env", t => {
  const f = fixture(t);
  const run = f.run();
  assert.equal(run.status, 0, run.stderr);
  const config = readFileSync(f.path, "utf8");
  assert.equal(setting(config, "MONGO_URI"), "mongodb://127.0.0.1:27017/booking_app");
  assert.equal(setting(config, "ADMIN_EMAILS"), "");
  assert.match(setting(config, "JWT_SECRET"), /^[a-f0-9]{64}$/);
  assert.match(setting(config, "ADMIN_REGISTRATION_KEY"), /^[a-f0-9]{64}$/);
  assert.notEqual(setting(config, "JWT_SECRET"), setting(config, "ADMIN_REGISTRATION_KEY"));
  assert.match(setting(config, "MEDIA_SIGNING_SECRET"), /^[a-f0-9]{64}$/);
  assert.match(setting(config, "MEDIA_MONGO_URI"), /^mongodb:\/\/bookflowmedia:[a-f0-9]+@127\.0\.0\.1:27018\/bookflow_media\?authSource=admin$/);
  const state = JSON.parse(readFileSync(f.state, "utf8"));
  assert.deepEqual(Object.keys(state).sort(), ["booking-media-mongodb", "booking-mongodb"]);
  assert.equal(run.stdout.includes(setting(config, "JWT_SECRET")), false);
  assert.equal(run.stdout.includes(setting(config, "MEDIA_MONGO_URI")), false);
});

test("repeat setup reuses existing data, credentials and containers", t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const before = readFileSync(f.path, "utf8");
  const dbBefore = readFileSync(f.state, "utf8");
  const run = f.run();
  assert.equal(run.status, 0, run.stderr);
  assert.equal(readFileSync(f.path, "utf8"), before);
  assert.equal(readFileSync(f.state, "utf8"), dbBefore);
  const check = f.run("--check");
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /booking-mongodb: RUNNING/);
  assert.match(check.stdout, /booking-media-mongodb: RUNNING/);
  assert.equal(check.stdout.includes(setting(before, "MEDIA_MONGO_URI")), false);
});

test("without-media preserves existing custom JWT and leaves GridFS disabled", t => {
  const f = fixture(t);
  const custom = "x".repeat(40);
  writeFileSync(f.path, "MONGO_URI=mongodb://127.0.0.1:27017/booking_app\nJWT_SECRET=" + custom + "\nADMIN_EMAILS=owner@example.com\n");
  const run = f.run("--without-media");
  assert.equal(run.status, 0, run.stderr);
  const config = readFileSync(f.path, "utf8");
  assert.equal(setting(config, "JWT_SECRET"), custom);
  assert.equal(setting(config, "ADMIN_EMAILS"), "");
  assert.equal(setting(config, "MEDIA_MONGO_URI"), "");
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(f.state, "utf8"))), ["booking-mongodb"]);
});
