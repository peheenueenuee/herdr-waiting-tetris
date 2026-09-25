"use strict";

// 遊べるゲームの一覧。ここに足せば config.json の "game" で選べるようになる。

const GAMES = [
  require("./tetris.js"),
  require("./snake.js"),
  require("./g2048.js"),
  require("./minesweeper.js"),
  require("./breakout.js"),
];

// 打ち間違えやすい別名を吸収する
const ALIASES = {
  t: "tetris",
  s: "snake",
  "2048game": "2048",
  twentyfortyeight: "2048",
  mines: "minesweeper",
  minesweep: "minesweeper",
  ms: "minesweeper",
  b: "breakout",
  blocks: "breakout",
  arkanoid: "breakout",
};

const DEFAULT_ID = "tetris";

function ids() {
  return GAMES.map((g) => g.id);
}

function get(name) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  const id = ALIASES[key] || key;
  return GAMES.find((g) => g.id === id) || null;
}

module.exports = { GAMES, DEFAULT_ID, ids, get };
