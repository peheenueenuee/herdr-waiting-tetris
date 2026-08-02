#!/usr/bin/env node
"use strict";

// 手動でテトリスを開くアクション。
// working 中でなくても遊べる。監視対象は今フォーカスしているペイン。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
// popup / overlay のペインは常にアクティブペインを対象に開く。
// --workspace を渡すと invalid_params で弾かれる。
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

const res = spawnSync(herdr, args, { encoding: "utf8", timeout: 10000 });

if (res.error || res.status !== 0) {
  const detail = res.error
    ? res.error.message
    : `exit ${res.status}: ${(res.stderr || res.stdout || "").trim()}`;
  process.stderr.write(`[tetris] failed to open pane: ${detail}\n`);
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* 消せなくても猶予時間で失効する */
  }
  process.exit(1);
}
