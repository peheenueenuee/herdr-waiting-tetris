"use strict";

// スネーク。1 手ごとにタイマーで進み、餌を食うほど速くなる。
// 盤 17x15、セルは 2 文字なので枠込み 36 桁。

const ui = require("./ui.js");

const W = 17;
const H = 15;
const START_MS = 140;
const MIN_MS = 60;

const BODY = ui.fg(41);
const HEAD = ui.fg(48);
const FOOD = ui.fg(203);

function create(api) {
  let snake, dir, pendingDir, food, score, over, paused, grow;
  let timer = null;

  function schedule() {
    if (timer) clearTimeout(timer);
    const ms = Math.max(MIN_MS, START_MS - Math.floor(score / 20) * 8);
    timer = setTimeout(step, ms);
  }

  function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    // 埋め尽くしたら置き場所が無い（= 完全クリア）
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function step() {
    if (!over && !paused) {
      dir = pendingDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      const hitWall = head.x < 0 || head.x >= W || head.y < 0 || head.y >= H;
      // 尻尾は今から退くので、伸びない限り衝突にはならない
      const body = grow > 0 ? snake : snake.slice(0, -1);
      const hitSelf = body.some((s) => sameCell(s, head));

      if (hitWall || hitSelf) {
        over = true;
        api.render();
        return;
      }

      snake.unshift(head);
      if (food && sameCell(head, food)) {
        score += 10;
        grow += 2;
        placeFood();
      }
      if (grow > 0) grow -= 1;
      else snake.pop();

      api.render();
    }
    schedule();
  }

  function turn(x, y) {
    // 反転（真後ろ）は受け付けない。連打で自分に刺さるのを防ぐ。
    if (dir.x === -x && dir.y === -y) return;
    pendingDir = { x, y };
  }

  function reset() {
    const cy = Math.floor(H / 2);
    snake = [
      { x: 4, y: cy },
      { x: 3, y: cy },
      { x: 2, y: cy },
    ];
    dir = { x: 1, y: 0 };
    pendingDir = dir;
    score = 0;
    grow = 0;
    over = false;
    paused = false;
    placeFood();
    schedule();
  }

  reset();

  return {
    lines() {
      const grid = Array.from({ length: H }, () => Array(W).fill(null));
      if (food) grid[food.y][food.x] = "food";
      snake.forEach((s, i) => {
        if (s.y >= 0 && s.y < H && s.x >= 0 && s.x < W) {
          grid[s.y][s.x] = i === 0 ? "head" : "body";
        }
      });

      const width = W * 2;
      const out = [
        ui.header("SNAKE", `BEST ${ui.bestText(Math.max(api.best || 0, score))}`, width + 2),
        ui.top(width),
      ];
      for (let y = 0; y < H; y++) {
        let row = "│";
        for (let x = 0; x < W; x++) {
          const cell = grid[y][x];
          if (cell === "head") row += HEAD + "██" + ui.RESET;
          else if (cell === "body") row += BODY + "██" + ui.RESET;
          else if (cell === "food") row += FOOD + "▓▓" + ui.RESET;
          else row += ui.DIM + " ·" + ui.RESET;
        }
        out.push(row + "│");
      }
      out.push(ui.bottom(width));
      out.push(
        ui.LABEL + " SCORE " + ui.RESET + ui.pad(String(score), 8) +
        ui.LABEL + "LEN " + ui.RESET + ui.pad(String(snake.length), 6),
      );
      out.push(
        " " + ui.keyHint([["←↑↓→", "move"], ["p", "pause"], ["q", "quit"]]),
      );
      return out;
    },

    status() {
      if (over) return ui.STATUS.over("r: retry  q: quit");
      if (!food) return ui.STATUS.clear("盤を埋めた  r: retry");
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
        case "\x1b[D": case "a": turn(-1, 0); break;
        case "\x1b[C": case "d": turn(1, 0); break;
        case "\x1b[A": case "w": turn(0, -1); break;
        case "\x1b[B": case "s": turn(0, 1); break;
      }
    },

    bestCandidate() {
      return score;
    },

    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

module.exports = { id: "snake", title: "Snake", create };
