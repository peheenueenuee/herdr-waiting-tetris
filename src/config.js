"use strict";

// config.json の読み取り。無い・壊れているときは既定値で動く。
//
//   {
//     "auto_open": true,      // working になったら自動で開くか
//     "game": "tetris"        // 開くゲーム。名指し / "random" / ["tetris","2048"] のいずれか
//   }

const fs = require("node:fs");
const { CONFIG_FILE } = require("./paths.js");

const DEFAULTS = {
  auto_open: true,
  game: "tetris",
};

function read() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { ...DEFAULTS };
  }
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  return { ...DEFAULTS, ...raw };
}

module.exports = { read, DEFAULTS, CONFIG_FILE };
