#!/usr/bin/env node
"use strict";

// ゲームのペイン本体。どのゲームを開くかを決めて runtime に渡すだけ。
//
// 決め方は上から順に:
//   1. 引数           （node src/play.js snake — 手動・テスト用）
//   2. WAITGAME_NAME  （フックが --env で渡してくる）
//   3. config.json の "game"
//   4. 既定の tetris

const runtime = require("./runtime.js");
const games = require("./games/index.js");
const config = require("./config.js");
const recent = require("./recent.js");

function resolve() {
  const candidates = [
    process.argv[2],
    process.env.WAITGAME_NAME,
    config.read().game,
  ];
  // フック経由なら WAITGAME_NAME に具体名が入っているのでここは素通りする。
  // "random" を解決するのは herdr の外から直接起動したとき。
  const exclude = recent.readLast();
  for (const name of candidates) {
    if (!name) continue;
    const picked = games.resolve(name, { exclude });
    if (picked.warning) process.stderr.write(`[waitgames] ${picked.warning}\n`);
    if (picked.game) return picked.game;
  }
  return games.get(games.DEFAULT_ID);
}

// 調査用の口: WAITGAME_PROBE=1 で起動すると、ゲームを始めずに
// ポップアップの実サイズ（PTY の桁数・行数）を state ディレクトリに書いて即終了する。
// マニフェストの width/height はポップアップの外枠で、中で使える大きさとは別物なので、
// 盤の大きさを決めるときはここで実測した値を根拠にする。
//
//   herdr plugin pane open --plugin nanka.waitgames --entrypoint game --env WAITGAME_PROBE=1
//   cat "$(herdr plugin state-dir nanka.waitgames)/display.json"
if (process.env.WAITGAME_PROBE) {
  const fs = require("node:fs");
  const path = require("node:path");
  const { STATE_DIR } = require("./paths.js");
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(STATE_DIR, "display.json"),
    JSON.stringify({
      columns: process.stdout.columns,
      rows: process.stdout.rows,
      isTTY: Boolean(process.stdout.isTTY),
      term: process.env.TERM || null,
      ts: Date.now(),
    }),
  );
  process.exit(0);
}

const game = resolve();
recent.writeLast(game.id);
runtime.run(game);
