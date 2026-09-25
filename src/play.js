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

const game = resolve();
recent.writeLast(game.id);
runtime.run(game);
