"use strict";

// テトリス。盤 10x20 + 右サイドパネルで 40 桁に収まる。

const ui = require("./ui.js");

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
  I: ui.fg(51), J: ui.fg(33), L: ui.fg(208), O: ui.fg(226),
  S: ui.fg(46), T: ui.fg(213), Z: ui.fg(196),
};
const GHOST = ui.fg(240);
const SCORE_TABLE = [0, 100, 300, 500, 800];

function create(api) {
  let board, cur, next, bag, score, lines, level, over, paused;
  let gravityTimer = null;

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

  function gravityMs() {
    return Math.max(60, 800 - (level - 1) * 65);
  }

  function scheduleGravity() {
    if (gravityTimer) clearTimeout(gravityTimer);
    gravityTimer = setTimeout(onGravity, gravityMs());
  }

  function onGravity() {
    if (!over && !paused) {
      if (!move(0, 1)) lockPiece();
    }
    scheduleGravity();
  }

  function move(dx, dy) {
    if (collides(cur, cur.cells, cur.x + dx, cur.y + dy)) return false;
    cur.x += dx;
    cur.y += dy;
    api.render();
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
        api.render();
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
          over = true;
          api.render();
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
      over = true;
      api.render();
      return;
    }
    api.render();
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

  function previewRows() {
    const cells = SHAPES[next];
    const rows = [];
    for (let y = 0; y < 2; y++) {
      let line = "";
      for (let x = 0; x < 4; x++) {
        const filled = cells[y] && cells[y][x];
        line += filled ? COLOR[next] + "██" + ui.RESET : "  ";
      }
      rows.push(line);
    }
    return rows;
  }

  function panel() {
    const [n1, n2] = previewRows();
    const bestNow = Math.max(api.best || 0, score);
    return [
      "",
      "  " + ui.LABEL + "SCORE" + ui.RESET,
      "  " + ui.pad(String(score), 10),
      "",
      "  " + ui.LABEL + "LINES" + ui.RESET + "  " + ui.pad(String(lines), 5),
      "  " + ui.LABEL + "LEVEL" + ui.RESET + "  " + ui.pad(String(level), 5),
      "  " + ui.LABEL + "BEST" + ui.RESET + "   " + ui.pad(String(bestNow), 5),
      "",
      "  " + ui.LABEL + "NEXT" + ui.RESET,
      "  " + n1,
      "  " + n2,
      "",
      "  " + ui.DIM + "← →" + ui.RESET + " move",
      "  " + ui.DIM + "↑ x" + ui.RESET + " rotate",
      "  " + ui.DIM + "z" + ui.RESET + "   rot ccw",
      "  " + ui.DIM + "↓" + ui.RESET + "   soft",
      "  " + ui.DIM + "spc" + ui.RESET + " drop",
      "  " + ui.DIM + "p" + ui.RESET + "   pause",
      "  " + ui.DIM + "q" + ui.RESET + "   quit",
      "",
    ];
  }

  reset();

  return {
    lines() {
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

      const side = panel();
      const out = [ui.top(W * 2)];
      for (let y = 0; y < H; y++) {
        let row = "│";
        for (let x = 0; x < W; x++) {
          const cell = grid[y][x];
          if (!cell) row += ui.DIM + " ·" + ui.RESET;
          else if (cell === "ghost") row += GHOST + "▒▒" + ui.RESET;
          else row += COLOR[cell] + "██" + ui.RESET;
        }
        out.push(row + "│" + (side[y] || ""));
      }
      out.push(ui.bottom(W * 2));
      return out;
    },

    status() {
      if (over) return ui.STATUS.over("r: retry  q: quit");
      if (paused) return ui.STATUS.paused;
      return "";
    },

    onKey(key) {
      if (over) {
        if (key === "r") reset();
        return;
      }
      if (key === "p") {
        paused = !paused;
        api.render();
        return;
      }
      if (paused) return;

      switch (key) {
        case "\x1b[D": case "a": move(-1, 0); break;
        case "\x1b[C": case "d": move(1, 0); break;
        case "\x1b[B": case "s":
          if (move(0, 1)) score += 1;
          else lockPiece();
          break;
        case "\x1b[A": case "x": case "k": tryRotate(1); break;
        case "z": case "j": tryRotate(-1); break;
        case " ": hardDrop(); break;
      }
    },

    bestCandidate() {
      return score;
    },

    stop() {
      if (gravityTimer) clearTimeout(gravityTimer);
      gravityTimer = null;
    },
  };
}

module.exports = { id: "tetris", title: "Tetris", create };
