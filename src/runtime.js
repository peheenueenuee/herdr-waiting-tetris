#!/usr/bin/env node
"use strict";

// 待ち時間ゲームの共通土台。
//
// ゲーム本体（src/games/*.js）は「盤面の行を組み立てる」ことと「キーを受け取る」ことだけに
// 集中する。端末の出入り・ハイスコアの永続化・エージェント状態の購読による自動クローズは
// すべてここが持つ。ゲームを増やすときに毎回書き直さずに済むのが狙い。

const fs = require("node:fs");
const net = require("node:net");

const {
  STATE_DIR,
  SCORE_FILE,
  LOCK_FILE,
  LEGACY_SCORE_FILES,
} = require("./paths.js");

// ---------------------------------------------------------------- highscore

function loadScores() {
  try {
    const data = JSON.parse(fs.readFileSync(SCORE_FILE, "utf8"));
    if (data && typeof data === "object") return data;
  } catch {
    /* まだ無い */
  }
  for (const file of LEGACY_SCORE_FILES) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (typeof data.best === "number") return { tetris: data.best };
    } catch {
      /* 無ければ次 */
    }
  }
  return {};
}

function saveScores(scores) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(SCORE_FILE, JSON.stringify(scores));
  } catch {
    /* 状態ディレクトリが書けなくてもゲームは続行する */
  }
}

// ------------------------------------------------------------------- input

// stdin は複数のキーがまとめて届くことがある。矢印キーのエスケープ列を
// 壊さないように切り分けて、ゲーム側は 1 キーずつ受け取れるようにする。
function tokenize(chunk) {
  const keys = [];
  let i = 0;
  while (i < chunk.length) {
    if (chunk[i] !== "\x1b") {
      keys.push(chunk[i]);
      i += 1;
      continue;
    }
    const rest = chunk.slice(i);
    const csi = /^\x1b\[[0-9;]*[A-Za-z~]/.exec(rest);
    if (csi) {
      keys.push(csi[0]);
      i += csi[0].length;
      continue;
    }
    // アプリケーションカーソルモードの \x1bOA 系は \x1b[A 系に寄せておく
    const ss3 = /^\x1bO([A-Za-z])/.exec(rest);
    if (ss3) {
      keys.push("\x1b[" + ss3[1]);
      i += ss3[0].length;
      continue;
    }
    keys.push("\x1b");
    i += 1;
  }
  return keys;
}

// --------------------------------------------------------------------- run

/**
 * ゲームモジュールを受け取って遊べる状態にする。
 *
 * ゲームモジュールが持つもの:
 *   id, title            … 識別子と表示名
 *   lowerIsBetter        … ハイスコアの良し悪しの向き（タイム系は true）
 *   create(api) -> inst  … api = { best, render(), quit() }
 *
 * inst が持つもの:
 *   lines()              … 画面の各行（ANSI 込み、必須）
 *   status()             … 最下段の 1 行（任意）
 *   onKey(key)           … キー入力（必須）
 *   bestCandidate()      … 今の記録候補。終了時に runtime が保存する（任意）
 *   stop()               … タイマーなどの後片付け（任意）
 */
function run(game) {
  const scores = loadScores();
  const storedBest = typeof scores[game.id] === "number" ? scores[game.id] : null;

  let agentDone = false;
  let cleanedUp = false;
  let inst = null;

  function render() {
    if (!inst) return;
    const out = ["\x1b[H"];
    for (const line of inst.lines()) out.push(line + "\x1b[K\n");
    let status = inst.status ? inst.status() || "" : "";
    if (agentDone) status = "\x1b[42;30m agent done — closing… \x1b[0m";
    out.push(status + "\x1b[K\x1b[J");
    process.stdout.write(out.join(""));
  }

  function recordBest() {
    if (!inst || !inst.bestCandidate) return;
    const value = inst.bestCandidate();
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const current = typeof scores[game.id] === "number" ? scores[game.id] : null;
    const better =
      current === null ||
      (game.lowerIsBetter ? value < current : value > current);
    if (!better) return;
    scores[game.id] = value;
    saveScores(scores);
  }

  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    recordBest(); // 途中で q しても記録は残す
    if (inst && inst.stop) {
      try {
        inst.stop();
      } catch {
        /* 後片付けの失敗で終了を止めない */
      }
    }
    try {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    } catch {
      /* TTY でなければ何もしなくていい */
    }
    process.stdout.write("\x1b[?25h\x1b[?1049l");
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      if (lock.pid === process.pid) fs.unlinkSync(LOCK_FILE);
    } catch {
      /* 他人のロックなら触らない */
    }
  }

  function quit(code) {
    cleanup();
    process.exit(code);
  }

  // エージェントが working を抜けたら店じまい
  function finish() {
    if (agentDone) return;
    agentDone = true;
    recordBest();
    if (inst && inst.stop) {
      try {
        inst.stop();
      } catch {
        /* 同上 */
      }
    }
    render();
    setTimeout(() => quit(0), 2000);
  }

  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, ts: Date.now() }));
  } catch {
    /* ロックが書けなくても遊べる（二重起動の抑止が効かなくなるだけ） */
  }

  process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J");
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.on("exit", cleanup);
  process.on("SIGINT", () => quit(0));
  process.on("SIGTERM", () => quit(0));

  inst = game.create({ best: storedBest, render, quit: () => quit(0) });

  process.stdin.on("data", (chunk) => {
    if (agentDone) return;
    for (const key of tokenize(chunk)) {
      if (key === "\x03" || key === "q") return quit(0);
      inst.onKey(key);
    }
  });

  watchAgent(finish);
  render();
}

// --------------------------------------------------- agent status watching

// 起動元のペインを購読し、working を抜けたら onDone を呼ぶ。
function watchAgent(onDone) {
  const socketPath = process.env.HERDR_SOCKET_PATH;
  const paneId = process.env.WAITGAME_WATCH_PANE || process.env.TETRIS_WATCH_PANE;
  if (!socketPath || !paneId) return;

  let sock;
  try {
    sock = net.connect(socketPath);
  } catch {
    return;
  }
  sock.on("error", () => {});

  sock.on("connect", () => {
    sock.write(
      JSON.stringify({
        id: "waitgame_sub",
        method: "events.subscribe",
        params: {
          subscriptions: [{ type: "pane.agent_status_changed", pane_id: paneId }],
        },
      }) + "\n",
    );
  });

  let buf = "";
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const status = findStatus(msg);
      if (status && status !== "working") onDone();
    }
  });
}

// イベントの入れ子の形が確定していないので、agent_status をどこにあっても拾う。
function findStatus(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (typeof node.agent_status === "string") return node.agent_status;
  for (const value of Object.values(node)) {
    const found = findStatus(value, depth + 1);
    if (found) return found;
  }
  return null;
}

module.exports = { run, tokenize, loadScores };
