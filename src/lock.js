"use strict";

// 二重起動の抑止。ゲームのプロセスが 1 つだけ立つようにする。
//
// ロックには pid を書く。ただしポップアップを開いてから実際にゲームが立ち上がるまで
// 少し間があるので、その間は pid = null の「予約」を置いて猶予時間で判定する。

const fs = require("node:fs");
const { STATE_DIR, LOCK_FILE } = require("./paths.js");

const SPAWN_GRACE_MS = 8000;

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

function reserve() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: null, ts: Date.now() }));
}

function release() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* 消せなくても猶予時間で失効する */
  }
}

module.exports = { alreadyRunning, reserve, release, SPAWN_GRACE_MS, LOCK_FILE };
