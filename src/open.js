#!/usr/bin/env node
"use strict";

// 手動でゲームを開くアクション。working 中でなくても遊べる。
// 監視対象は今フォーカスしているペイン。
//
//   src/open.js          … config.json の "game"
//   src/open.js snake    … ゲームを名指し（マニフェストのアクションから渡される）
//   src/open.js random   … 全部からランダム

const config = require("./config.js");
const games = require("./games/index.js");
const recent = require("./recent.js");
const { openPane } = require("./launch.js");

function log(msg) {
  process.stderr.write(`[waitgames] ${msg}\n`);
}

const requested = process.argv[2] || config.read().game;
const picked = games.resolve(requested, { exclude: recent.readLast() });
if (picked.warning) log(picked.warning);
if (!picked.game) process.exit(2);
const game = picked.game;

// 手動で開いた場合も、見ているペインのエージェントが終わったら閉じてほしい
const paneId = process.env.HERDR_PANE_ID || null;

if (!openPane({ paneId, gameId: game.id, log })) process.exit(1);
recent.writeLast(game.id);
