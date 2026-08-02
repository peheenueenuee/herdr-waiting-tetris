#!/usr/bin/env node
"use strict";

// pane.agent_status_changed フック。
// working に入った瞬間だけテトリスのポップアップを開く。
// 閉じるのは tetris.js 側（自分で状態を購読して終了する）。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PLUGIN_ID = process.env.HERDR_PLUGIN_ID || "nanka.tetris";
const STATE_DIR =
  process.env.HERDR_PLUGIN_STATE_DIR ||
  path.join(process.env.HOME || ".", ".local/state/herdr-tetris");
const LOCK_FILE = path.join(STATE_DIR, "tetris.lock");
const CONFIG_FILE = path.join(
  process.env.HERDR_PLUGIN_CONFIG_DIR || STATE_DIR,
  "config.json",
);

// ポップアップ起動からゲームがロックを書き込むまでの猶予。
// この間に来た working イベントは二重起動とみなして捨てる。
const SPAWN_GRACE_MS = 8000;

function log(msg) {
  process.stderr.write(`[tetris] ${msg}\n`);
}

// イベント JSON の入れ子の形が確定していないので、キーをどこにあっても拾う。
function find(node, key, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (typeof node[key] === "string") return node[key];
  for (const value of Object.values(node)) {
    const found = find(value, key, depth + 1);
    if (found) return found;
  }
  return null;
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function alreadyRunning() {
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
  } catch {
    return false;
  }

  if (lock.pid) {
    try {
      process.kill(lock.pid, 0); // 生存確認のみ
      return true;
    } catch {
      return false; // プロセスは死んでいる → 残骸
    }
  }

  // まだ pid が書かれていない = 起動中。猶予内なら起動済み扱い。
  return Date.now() - (lock.ts || 0) < SPAWN_GRACE_MS;
}

function main() {
  const raw = process.env.HERDR_PLUGIN_EVENT_JSON;
  if (!raw) return;

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    log(`could not parse event json: ${raw.slice(0, 200)}`);
    return;
  }

  const status = find(event, "agent_status");
  if (status !== "working") return;

  const config = readConfig();
  if (config.auto_open === false) return;

  const paneId = find(event, "pane_id") || process.env.HERDR_PANE_ID;
  if (!paneId) {
    log("working detected but no pane_id in event; skipping");
    return;
  }

  if (alreadyRunning()) return;

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: null, ts: Date.now() }));

  const herdr = process.env.HERDR_BIN_PATH || "herdr";
  // popup / overlay のペインは常にアクティブペインを対象に開く。
  // ここで --workspace や --target-pane を渡すと invalid_params で弾かれる。
  const args = [
    "plugin", "pane", "open",
    "--plugin", PLUGIN_ID,
    "--entrypoint", "tetris",
    // ゲームに「どのペインを見張るか」を渡す
    "--env", `TETRIS_WATCH_PANE=${paneId}`,
    "--focus",
  ];

  log(`working on ${paneId} → opening tetris`);

  // pane open はデーモンへの RPC ですぐ返る。同期実行して失敗を取りこぼさない。
  // detached + stdio:"ignore" で投げっぱなしにすると、エラーが出ても
  // plugin log には「成功」としか残らず原因が追えなくなる。
  const res = spawnSync(herdr, args, { encoding: "utf8", timeout: 10000 });

  if (res.error || res.status !== 0) {
    const detail = res.error
      ? res.error.message
      : `exit ${res.status}: ${(res.stderr || res.stdout || "").trim()}`;
    log(`failed to open pane: ${detail}`);
    // 開けなかったのにロックが残ると、次の working も抑止されてしまう。
    try {
      fs.unlinkSync(LOCK_FILE);
    } catch {
      /* 消せなくても猶予時間で失効する */
    }
  }
}

main();
