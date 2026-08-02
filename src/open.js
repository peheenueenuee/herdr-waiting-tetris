#!/usr/bin/env node
"use strict";

// 手動でテトリスを開くアクション。
// working 中でなくても遊べる。監視対象は今フォーカスしているペイン。

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PLUGIN_ID = process.env.HERDR_PLUGIN_ID || "nanka.tetris";
const STATE_DIR =
  process.env.HERDR_PLUGIN_STATE_DIR ||
  path.join(process.env.HOME || ".", ".local/state/herdr-tetris");
const LOCK_FILE = path.join(STATE_DIR, "tetris.lock");

function alreadyRunning() {
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
  } catch {
    return false;
  }
  if (!lock.pid) return Date.now() - (lock.ts || 0) < 8000;
  try {
    process.kill(lock.pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (alreadyRunning()) {
  process.stderr.write("[tetris] already running\n");
  process.exit(0);
}

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: null, ts: Date.now() }));

const herdr = process.env.HERDR_BIN_PATH || "herdr";
const args = [
  "plugin", "pane", "open",
  "--plugin", PLUGIN_ID,
  "--entrypoint", "tetris",
  "--focus",
];

// 手動で開いた場合も、見ているペインのエージェントが終わったら閉じてほしい
if (process.env.HERDR_PANE_ID) {
  args.push("--env", `TETRIS_WATCH_PANE=${process.env.HERDR_PANE_ID}`);
}
if (process.env.HERDR_WORKSPACE_ID) {
  args.push("--workspace", process.env.HERDR_WORKSPACE_ID);
}

const child = spawn(herdr, args, { stdio: "inherit", detached: true });
child.on("error", (err) => {
  process.stderr.write(`[tetris] failed to open pane: ${err.message}\n`);
  process.exit(1);
});
child.unref();
