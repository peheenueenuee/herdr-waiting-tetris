"use strict";

// マインスイーパ。盤 16x12 に地雷 30。セル 2 文字で枠込み 34 桁。
// 記録は「クリアまでの秒数」なので、ハイスコアの向きは lowerIsBetter。

const ui = require("./ui.js");

const W = 16;
const H = 12;
const MINES = 30;

const NUM_COLOR = {
  1: ui.fg(39), 2: ui.fg(41), 3: ui.fg(203), 4: ui.fg(63),
  5: ui.fg(131), 6: ui.fg(37), 7: ui.fg(252), 8: ui.fg(244),
};

function create(api) {
  let mine, open, flag, cx, cy, over, won, started, startedAt, elapsed;
  let ticker = null;

  function forEachNeighbor(x, y, fn) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        fn(nx, ny);
      }
    }
  }

  function countAround(x, y) {
    let n = 0;
    forEachNeighbor(x, y, (nx, ny) => {
      if (mine[ny][nx]) n++;
    });
    return n;
  }

  function layMines() {
    const cells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push({ x, y });
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (const c of cells.slice(0, MINES)) mine[c.y][c.x] = true;
  }

  // 最初に開けたマスが地雷だと理不尽なので、そこだけ空きへ逃がす。
  function relocateMine(x, y) {
    for (let ny = 0; ny < H; ny++) {
      for (let nx = 0; nx < W; nx++) {
        if (!mine[ny][nx] && !(nx === x && ny === y)) {
          mine[ny][nx] = true;
          mine[y][x] = false;
          return;
        }
      }
    }
  }

  function startClock() {
    started = true;
    startedAt = Date.now();
    ticker = setInterval(() => {
      if (over || won) return;
      const next = Math.floor((Date.now() - startedAt) / 1000);
      if (next !== elapsed) {
        elapsed = next;
        api.render();
      }
    }, 500);
  }

  function stopClock() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  function openCell(x, y) {
    if (open[y][x] || flag[y][x]) return;

    if (!started) {
      if (mine[y][x]) relocateMine(x, y);
      startClock();
    }

    if (mine[y][x]) {
      open[y][x] = true;
      over = true;
      stopClock();
      return;
    }

    // 0 のマスは繋がっているぶんまとめて開く（スタックで再帰を避ける）
    const stack = [{ x, y }];
    while (stack.length) {
      const c = stack.pop();
      if (open[c.y][c.x] || flag[c.y][c.x]) continue;
      open[c.y][c.x] = true;
      if (countAround(c.x, c.y) === 0) {
        forEachNeighbor(c.x, c.y, (nx, ny) => {
          if (!open[ny][nx] && !mine[ny][nx]) stack.push({ x: nx, y: ny });
        });
      }
    }

    checkWin();
  }

  function checkWin() {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mine[y][x] && !open[y][x]) return;
      }
    }
    won = true;
    elapsed = Math.floor((Date.now() - startedAt) / 1000);
    stopClock();
  }

  function flagsUsed() {
    let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (flag[y][x]) n++;
    return n;
  }

  function reset() {
    stopClock();
    mine = Array.from({ length: H }, () => Array(W).fill(false));
    open = Array.from({ length: H }, () => Array(W).fill(false));
    flag = Array.from({ length: H }, () => Array(W).fill(false));
    cx = Math.floor(W / 2);
    cy = Math.floor(H / 2);
    over = false;
    won = false;
    started = false;
    startedAt = 0;
    elapsed = 0;
    layMines();
  }

  function cellText(x, y) {
    if (flag[y][x]) return ui.fg(203) + " !" + ui.RESET;
    if (!open[y][x]) {
      // 負けたときだけ伏せてある地雷を見せる
      if (over && mine[y][x]) return ui.fg(196) + " *" + ui.RESET;
      return ui.fg(240) + "▒▒" + ui.RESET;
    }
    if (mine[y][x]) return "\x1b[41;97m *" + ui.RESET;
    const n = countAround(x, y);
    if (!n) return ui.DIM + "  " + ui.RESET;
    return (NUM_COLOR[n] || "") + " " + n + ui.RESET;
  }

  reset();

  return {
    lines() {
      const width = W * 2;
      const timeText = String(elapsed).padStart(3, "0");
      const out = [
        ui.header(
          "MINESWEEPER",
          `BEST ${api.best === null ? "-" : api.best + "s"}`,
          width + 2,
        ),
        ui.top(width),
      ];

      for (let y = 0; y < H; y++) {
        let row = "│";
        for (let x = 0; x < W; x++) {
          const text = cellText(x, y);
          // カーソルは反転表示。枠の中だけで完結するので桁がずれない。
          row += x === cx && y === cy ? "\x1b[7m" + text + ui.RESET : text;
        }
        out.push(row + "│");
      }
      out.push(ui.bottom(width));
      out.push(
        ui.LABEL + " MINES " + ui.RESET + ui.pad(String(MINES - flagsUsed()), 6) +
        ui.LABEL + "TIME " + ui.RESET + timeText,
      );
      out.push(
        " " + ui.keyHint([["←↑↓→", "move"], ["spc", "open"], ["f", "flag"], ["r", "new"]]),
      );
      return out;
    },

    status() {
      if (over) return ui.STATUS.over("r: retry  q: quit");
      if (won) return ui.STATUS.clear(`${elapsed}s でクリア  r: retry`);
      return "";
    },

    onKey(key) {
      if (key === "r") {
        reset();
        api.render();
        return;
      }
      if (over || won) return;

      switch (key) {
        case "\x1b[D": case "a": cx = Math.max(0, cx - 1); break;
        case "\x1b[C": case "d": cx = Math.min(W - 1, cx + 1); break;
        case "\x1b[A": case "w": cy = Math.max(0, cy - 1); break;
        case "\x1b[B": case "s": cy = Math.min(H - 1, cy + 1); break;
        case "f":
          if (!open[cy][cx]) flag[cy][cx] = !flag[cy][cx];
          break;
        case " ": case "\r": case "\n":
          openCell(cx, cy);
          break;
        default:
          return;
      }
      api.render();
    },

    bestCandidate() {
      return won ? elapsed : null;
    },

    stop() {
      stopClock();
    },
  };
}

module.exports = {
  id: "minesweeper",
  title: "Minesweeper",
  lowerIsBetter: true,
  create,
};
