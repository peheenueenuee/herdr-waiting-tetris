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

function resolve() {
  const candidates = [
    process.argv[2],
    process.env.WAITGAME_NAME,
    config.read().game,
  ];
  for (const name of candidates) {
    if (!name) continue;
    const game = games.get(name);
    if (game) return game;
    process.stderr.write(
      `[waitgames] unknown game "${name}" (${games.ids().join(", ")})\n`,
    );
  }
  return games.get(games.DEFAULT_ID);
}

runtime.run(resolve());
