"use strict";

// 2048。完全なターン制なので、ポップアップが急に閉じても損した気分になりにくい。
// 盤 4x4、セル幅 6 で枠込み 29 桁。

const ui = require("./ui.js");

const N = 4;
const CELL_W = 6;
const CELL_H = 3;

// 値ごとの色。大きいほど暖色に寄せる。
const TILE_COLOR = {
  2: ui.fg(252), 4: ui.fg(230), 8: ui.fg(215), 16: ui.fg(209),
  32: ui.fg(203), 64: ui.fg(196), 128: ui.fg(226), 256: ui.fg(220),
  512: ui.fg(214), 1024: ui.fg(51), 2048: ui.fg(46),
};

function colorFor(v) {
  return TILE_COLOR[v] || ui.fg(45);
}

function create(api) {
  let grid, score, over, won;

  function emptyCells() {
    const out = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) if (!grid[y][x]) out.push({ x, y });
    }
    return out;
  }

  function spawn() {
    const free = emptyCells();
    if (!free.length) return;
    const { x, y } = free[Math.floor(Math.random() * free.length)];
    grid[y][x] = Math.random() < 0.9 ? 2 : 4;
  }

  // 1 列ぶんを先頭方向へ詰めて合成する。戻り値は新しい列と得点。
  function collapse(line) {
    const vals = line.filter(Boolean);
    const out = [];
    let gained = 0;
    for (let i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        const merged = vals[i] * 2;
        out.push(merged);
        gained += merged;
        if (merged === 2048) won = true;
        i++; // 合成済みの片割れは飛ばす（1 手で二重合成しない）
      } else {
        out.push(vals[i]);
      }
    }
    while (out.length < N) out.push(0);
    return { line: out, gained };
  }

  // dir: "left" | "right" | "up" | "down"
  function slide(dir) {
    const before = JSON.stringify(grid);
    let gained = 0;

    for (let i = 0; i < N; i++) {
      let line;
      if (dir === "left" || dir === "right") line = grid[i].slice();
      else line = grid.map((row) => row[i]);

      const reversed = dir === "right" || dir === "down";
      if (reversed) line.reverse();
      const res = collapse(line);
      gained += res.gained;
      let next = res.line;
      if (reversed) next = next.reverse();

      if (dir === "left" || dir === "right") grid[i] = next;
      else for (let y = 0; y < N; y++) grid[y][i] = next[y];
    }

    if (JSON.stringify(grid) === before) return false; // 動かない手は消費しない
    score += gained;
    spawn();
    if (!hasMove()) over = true;
    return true;
  }

  function hasMove() {
    if (emptyCells().length) return true;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const v = grid[y][x];
        if (x + 1 < N && grid[y][x + 1] === v) return true;
        if (y + 1 < N && grid[y + 1][x] === v) return true;
      }
    }
    return false;
  }

  function reset() {
    grid = Array.from({ length: N }, () => Array(N).fill(0));
    score = 0;
    over = false;
    won = false;
    spawn();
    spawn();
  }

  function cellLines(v) {
    const rows = [];
    for (let r = 0; r < CELL_H; r++) {
      if (r !== Math.floor(CELL_H / 2) || !v) {
        rows.push(" ".repeat(CELL_W));
        continue;
      }
      const text = String(v);
      const left = Math.floor((CELL_W - text.length) / 2);
      rows.push(
        " ".repeat(left) + colorFor(v) + text + ui.RESET +
        " ".repeat(CELL_W - text.length - left),
      );
    }
    return rows;
  }

  reset();

  return {
    lines() {
      const bar = "─".repeat(CELL_W);
      const width = N * CELL_W + N + 1;
      const out = [
        ui.header("2048", `BEST ${ui.bestText(Math.max(api.best || 0, score))}`, width),
        "┌" + Array(N).fill(bar).join("┬") + "┐",
      ];

      for (let y = 0; y < N; y++) {
        const cells = grid[y].map((v) => cellLines(v));
        for (let r = 0; r < CELL_H; r++) {
          out.push("│" + cells.map((c) => c[r]).join("│") + "│");
        }
        out.push(
          y === N - 1
            ? "└" + Array(N).fill(bar).join("┴") + "┘"
            : "├" + Array(N).fill(bar).join("┼") + "┤",
        );
      }

      out.push(ui.LABEL + " SCORE " + ui.RESET + String(score));
      out.push(" " + ui.keyHint([["←↑↓→", "slide"], ["r", "retry"], ["q", "quit"]]));
      return out;
    },

    status() {
      if (over) return ui.STATUS.over("r: retry  q: quit");
      if (won) return ui.STATUS.clear("2048 到達！ そのまま続行できる");
      return "";
    },

    onKey(key) {
      if (key === "r") {
        reset();
        api.render();
        return;
      }
      if (over) return;

      let moved = false;
      switch (key) {
        case "\x1b[D": case "a": moved = slide("left"); break;
        case "\x1b[C": case "d": moved = slide("right"); break;
        case "\x1b[A": case "w": moved = slide("up"); break;
        case "\x1b[B": case "s": moved = slide("down"); break;
      }
      if (moved) api.render();
    },

    bestCandidate() {
      return score;
    },
  };
}

module.exports = { id: "2048", title: "2048", create };
