"use strict";

// 直前に開いたゲームを覚えておく。ランダム指定のときに同じものを連続で出さないため。
// 無くても動く（読めなければ「直前は無し」として扱う）。

const fs = require("node:fs");
const path = require("node:path");
const { STATE_DIR } = require("./paths.js");

const FILE = path.join(STATE_DIR, "recent.json");

function readLast() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return typeof data.last === "string" ? data.last : null;
  } catch {
    return null;
  }
}

function writeLast(id) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ last: id, ts: Date.now() }));
  } catch {
    /* 覚えられなくても遊べる（連続で同じものが出うるだけ） */
  }
}

module.exports = { readLast, writeLast, FILE };
