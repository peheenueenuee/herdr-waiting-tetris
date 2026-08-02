#!/usr/bin/env node
"use strict";

// エージェントの待ち時間に遊ぶテトリス。
// 監視対象ペインが working を抜けたら自分で終了する（= ポップアップが閉じる）。

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const STATE_DIR =
  process.env.HERDR_PLUGIN_STATE_DIR ||
  path.join(process.env.HOME || ".", ".local/state/herdr-tetris");
fs.mkdirSync(STATE_DIR, { recursive: true });
const SCORE_FILE = path.join(STATE_DIR, "highscore.json");
const LOCK_FILE = path.join(STATE_DIR, "tetris.lock");

const W = 10;
const H = 20;

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const COLOR = {
  I: "\x1b[38;5;51m",
  J: "\x1b[38;5;33m",
  L: "\x1b[38;5;208m",
  O: "\x1b[38;5;226m",
  S: "\x1b[38;5;46m",
  T: "\x1b[38;5;213m",
  Z: "\x1b[38;5;196m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;238m";
const GHOST = "\x1b[38;5;240m";

const SCORE_TABLE = [0, 100, 300, 500, 800];

// ---------------------------------------------------------------- game state

let board, cur, next, bag, score, lines, level, best, over, paused, dead;
let gravityTimer = null;
let agentDone = false;

function loadBest() {
  try {
    return JSON.parse(fs.readFileSync(SCORE_FILE, "utf8")).best || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  if (score <= best) return;
  best = score;
  try {
    fs.writeFileSync(SCORE_FILE, JSON.stringify({ best }));
  } catch {
    /* 状態ディレクトリが書けなくてもゲームは続行する */
  }
}

function refillBag() {
  const keys = Object.keys(SHAPES);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  bag = keys;
}

function takeFromBag() {
  if (!bag || bag.length === 0) refillBag();
  return bag.pop();
}

function makePiece(key) {
  const cells = SHAPES[key].map((row) => row.slice());
  return { key, cells, x: Math.floor((W - cells[0].length) / 2), y: 0 };
}

function rotate(cells) {
  return cells[0].map((_, i) => cells.map((row) => row[i]).reverse());
}

function collides(piece, cells = piece.cells, px = piece.x, py = piece.y) {
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (!cells[y][x]) continue;
      const bx = px + x;
      const by = py + y;
      if (bx < 0 || bx >= W || by >= H) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

function reset() {
  board = Array.from({ length: H }, () => Array(W).fill(null));
  bag = null;
  score = 0;
  lines = 0;
  level = 1;
  over = false;
  paused = false;
  cur = makePiece(takeFromBag());
  next = takeFromBag();
  scheduleGravity();
}

function gravityMs() {
  return Math.max(60, 800 - (level - 1) * 65);
}

function scheduleGravity() {
  if (gravityTimer) clearTimeout(gravityTimer);
  gravityTimer = setTimeout(onGravity, gravityMs());
}

function onGravity() {
  if (!over && !paused && !agentDone) {
    if (!move(0, 1)) lockPiece();
  }
  scheduleGravity();
}

function move(dx, dy) {
  if (collides(cur, cur.cells, cur.x + dx, cur.y + dy)) return false;
  cur.x += dx;
  cur.y += dy;
  render();
  return true;
}

function tryRotate(dir) {
  let cells = cur.cells;
  const turns = dir > 0 ? 1 : 3;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  // 壁際でも回れるように左右へ少しずらして試す
  for (const dx of [0, -1, 1, -2, 2]) {
    if (!collides(cur, cells, cur.x + dx, cur.y)) {
      cur.cells = cells;
      cur.x += dx;
      render();
      return;
    }
  }
}

function ghostY() {
  let y = cur.y;
  while (!collides(cur, cur.cells, cur.x, y + 1)) y++;
  return y;
}

function hardDrop() {
  const target = ghostY();
  score += (target - cur.y) * 2;
  cur.y = target;
  lockPiece();
}

function lockPiece() {
  for (let y = 0; y < cur.cells.length; y++) {
    for (let x = 0; x < cur.cells[y].length; x++) {
      if (!cur.cells[y][x]) continue;
      const by = cur.y + y;
      const bx = cur.x + x;
      if (by < 0) {
        gameOver();
        return;
      }
      board[by][bx] = cur.key;
    }
  }

  let cleared = 0;
  for (let y = H - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(W).fill(null));
      cleared++;
      y++;
    }
  }
  if (cleared) {
    score += SCORE_TABLE[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
  }

  cur = makePiece(next);
  next = takeFromBag();
  if (collides(cur)) {
    gameOver();
    return;
  }
  render();
}

function gameOver() {
  over = true;
  saveBest();
  render();
}

// ------------------------------------------------------------------ render

function pad(s, n) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function previewRows() {
  const cells = SHAPES[next];
  const rows = [];
  for (let y = 0; y < 2; y++) {
    let line = "";
    for (let x = 0; x < 4; x++) {
      const filled = cells[y] && cells[y][x];
      line += filled ? COLOR[next] + "██" + RESET : "  ";
    }
    rows.push(line);
  }
  return rows;
}

function buildPanel() {
  const [n1, n2] = previewRows();
  return [
    "",
    "  SCORE",
    "  " + pad(String(score), 10),
    "",
    "  LINES  " + pad(String(lines), 5),
    "  LEVEL  " + pad(String(level), 5),
    "  BEST   " + pad(String(Math.max(best, score)), 5),
    "",
    "  NEXT",
    "  " + n1,
    "  " + n2,
    "",
    "  " + DIM + "← →" + RESET + " move",
    "  " + DIM + "↑ x" + RESET + " rotate",
    "  " + DIM + "z" + RESET + "   rot ccw",
    "  " + DIM + "↓" + RESET + "   soft",
    "  " + DIM + "spc" + RESET + " drop",
    "  " + DIM + "p" + RESET + "   pause",
    "  " + DIM + "q" + RESET + "   quit",
    "",
  ];
}

function render() {
  const grid = board.map((row) => row.slice());

  if (!over) {
    const gy = ghostY();
    for (let y = 0; y < cur.cells.length; y++) {
      for (let x = 0; x < cur.cells[y].length; x++) {
        if (!cur.cells[y][x]) continue;
        const by = gy + y;
        const bx = cur.x + x;
        if (by >= 0 && by < H && !grid[by][bx]) grid[by][bx] = "ghost";
      }
    }
    for (let y = 0; y < cur.cells.length; y++) {
      for (let x = 0; x < cur.cells[y].length; x++) {
        if (!cur.cells[y][x]) continue;
        const by = cur.y + y;
        const bx = cur.x + x;
        if (by >= 0 && by < H) grid[by][bx] = cur.key;
      }
    }
  }

  const panel = buildPanel();
  const out = ["\x1b[H"];
  out.push("┌" + "─".repeat(W * 2) + "┐\n");

  for (let y = 0; y < H; y++) {
    let row = "│";
    for (let x = 0; x < W; x++) {
      const cell = grid[y][x];
      if (!cell) row += DIM + " ·" + RESET;
      else if (cell === "ghost") row += GHOST + "▒▒" + RESET;
      else row += COLOR[cell] + "██" + RESET;
    }
    row += "│" + (panel[y] || "");
    out.push(row + "\x1b[K\n");
  }
  out.push("└" + "─".repeat(W * 2) + "┘\x1b[K\n");

  let status = "";
  if (agentDone) status = "\x1b[42;30m agent done — closing… \x1b[0m";
  else if (over) status = "\x1b[41;97m GAME OVER \x1b[0m  r: retry  q: quit";
  else if (paused) status = "\x1b[43;30m PAUSED \x1b[0m  p: resume";
  out.push(status + "\x1b[K");

  process.stdout.write(out.join(""));
}

// ------------------------------------------------------------------- input

function onKey(str) {
  if (agentDone) return;

  if (str === "\x03" || str === "q") return quit(0);

  if (over) {
    if (str === "r") reset();
    return;
  }

  if (str === "p") {
    paused = !paused;
    render();
    return;
  }
  if (paused) return;

  switch (str) {
    case "\x1b[D":
    case "a":
      move(-1, 0);
      break;
    case "\x1b[C":
    case "d":
      move(1, 0);
      break;
    case "\x1b[B":
    case "s":
      if (move(0, 1)) score += 1;
      else lockPiece();
      break;
    case "\x1b[A":
    case "x":
    case "k":
      tryRotate(1);
      break;
    case "z":
    case "j":
      tryRotate(-1);
      break;
    case " ":
      hardDrop();
      break;
  }
}

// --------------------------------------------------- agent status watching

// 起動元のペインを購読し、working を抜けたら自分で店じまいする。
function watchAgent() {
  const socketPath = process.env.HERDR_SOCKET_PATH;
  const paneId = process.env.TETRIS_WATCH_PANE;
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
        id: "tetris_sub",
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
      if (status && status !== "working") finish();
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

function finish() {
  if (agentDone) return;
  agentDone = true;
  saveBest();
  render();
  setTimeout(() => quit(0), 2000);
}

// -------------------------------------------------------------------- boot

let cleanedUp = false;

function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  saveBest(); // 途中で q しても記録は残す
  if (gravityTimer) clearTimeout(gravityTimer);
  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  } catch {}
  process.stdout.write("\x1b[?25h\x1b[?1049l");
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
    if (lock.pid === process.pid) fs.unlinkSync(LOCK_FILE);
  } catch {}
}

function quit(code) {
  cleanup();
  process.exit(code);
}

function main() {
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, ts: Date.now() }));
  } catch {}

  best = loadBest();
  process.stdout.write("\x1b[?1049h\x1b[?25l\x1b[2J");

  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", onKey);

  process.on("exit", cleanup);
  process.on("SIGINT", () => quit(0));
  process.on("SIGTERM", () => quit(0));

  reset();
  render();
  watchAgent();
}

main();
