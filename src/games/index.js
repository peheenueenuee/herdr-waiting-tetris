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

// ゲーム名の代わりに書けるランダム指定
const RANDOM_WORDS = new Set(["random", "any", "shuffle", "*"]);

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

// 候補から 1 つ引く。直前に遊んだものは（他に選択肢があれば）避ける。
// 5 つしかないので、避けないと「ランダムなのに同じのばかり出る」感じになる。
function pickFrom(list, exclude) {
  const pool = list.length > 1 ? list.filter((g) => g.id !== exclude) : list;
  const from = pool.length ? pool : list;
  return from[Math.floor(Math.random() * from.length)];
}

/**
 * config の "game" の値をゲームに解決する。受け付ける形は 3 つ。
 *
 *   "snake"                   … 名指し
 *   "random"                  … 全部からランダム
 *   ["tetris", "2048"]        … その中からランダム
 *
 * @returns {{ game: object|null, warning: string|null }}
 *   game が null なら呼び出し側が既定にフォールバックする。
 */
function resolve(value, options = {}) {
  const exclude = options.exclude || null;

  if (value === undefined || value === null || value === "") {
    return { game: null, warning: null };
  }

  if (Array.isArray(value)) {
    const known = [];
    const unknown = [];
    for (const entry of value) {
      const game = get(entry);
      if (game) known.push(game);
      else unknown.push(String(entry));
    }
    const warning = unknown.length
      ? `unknown game in list: ${unknown.join(", ")} (${ids().join(", ")})`
      : null;
    if (!known.length) {
      return { game: null, warning: warning || "game list is empty" };
    }
    return { game: pickFrom(known, exclude), warning };
  }

  const key = String(value).trim().toLowerCase();
  if (RANDOM_WORDS.has(key)) {
    return { game: pickFrom(GAMES, exclude), warning: null };
  }

  const game = get(key);
  return {
    game,
    warning: game ? null : `unknown game "${value}" (${ids().join(", ")})`,
  };
}

module.exports = { GAMES, DEFAULT_ID, ids, get, resolve };
