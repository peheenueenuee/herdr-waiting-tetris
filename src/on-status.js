#!/usr/bin/env node
"use strict";

// pane.agent_status_changed フック。
// working に入った瞬間だけゲームのポップアップを開く。
// 閉じるのはゲーム側（runtime.js が自分で状態を購読して終了する）。

const config = require("./config.js");
const games = require("./games/index.js");
const { openPane } = require("./launch.js");

function log(msg) {
  process.stderr.write(`[waitgames] ${msg}\n`);
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

  const cfg = config.read();
  if (cfg.auto_open === false) return;

  const game = games.get(cfg.game) || games.get(games.DEFAULT_ID);
  if (!games.get(cfg.game)) {
    log(`unknown game "${cfg.game}" in config; falling back to ${game.id}`);
  }

  const paneId = find(event, "pane_id") || process.env.HERDR_PANE_ID;
  if (!paneId) {
    log("working detected but no pane_id in event; skipping");
    return;
  }

  if (openPane({ paneId, gameId: game.id, log })) {
    log(`working on ${paneId} → opening ${game.id}`);
  }
}

main();
