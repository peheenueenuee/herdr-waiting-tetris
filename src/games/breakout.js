"use strict";

// ブロック崩し。唯一のリアルタイム操作系で、左右だけで遊べる。
// 盤 36x16（セル 1 文字）で枠込み 38 桁。

const ui = require("./ui.js");

const W = 36;
const H = 16;
const TICK_MS = 55;

const BRICK_W = 3;
const COLS = W / BRICK_W; // 12
const ROWS = 5;
const BRICK_TOP = 1; // 最上段は 1 行空けておく（跳ね返りの余地）

const PADDLE_W = 7;
const PADDLE_Y = H - 1;

const ROW_COLOR = [ui.fg(203), ui.fg(215), ui.fg(226), ui.fg(41), ui.fg(39)];
const BALL = ui.fg(231);
const PADDLE = ui.fg(45);

function create(api) {
  let bricks, paddleX, ball, vx, vy, score, lives, level, over, cleared, launched, paused;
  let timer = null;

  function fillBricks() {
    bricks = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
  }

  function bricksLeft() {
    return bricks.reduce((n, row) => n + row.filter(Boolean).length, 0);
  }

  function speed() {
    return 1 + (level - 1) * 0.12;
  }

  function resetBall() {
    launched = false;
    ball = { x: paddleX + PADDLE_W / 2, y: PADDLE_Y - 1 };
    vx = 0;
    vy = 0;
  }

  function launch() {
    if (launched) return;
    launched = true;
    vx = (Math.random() < 0.5 ? -1 : 1) * 0.75 * speed();
    vy = -0.42 * speed();
  }

  // ボールのいる位置にブロックがあれば壊す。壊したら true。
  function hitBrick(bx, by) {
    const col = Math.floor(bx / BRICK_W);
    const row = by - BRICK_TOP;
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if (!bricks[row][col]) return false;
    bricks[row][col] = false;
    score += (ROWS - row) * 10;
    return true;
  }

  function step() {
    if (!over && !cleared && !paused) {
      if (launched) advance();
      else ball.x = paddleX + PADDLE_W / 2;
      api.render();
    }
    timer = setTimeout(step, TICK_MS);
  }

  function advance() {
    // 横と縦を別々に進めて、それぞれの当たり判定で反射方向を決める。
    let nx = ball.x + vx;
    if (nx < 0) {
      nx = 0;
      vx = -vx;
    } else if (nx > W - 1) {
      nx = W - 1;
      vx = -vx;
    }
    if (hitBrick(Math.floor(nx), Math.floor(ball.y))) vx = -vx;
    else ball.x = nx;

    let ny = ball.y + vy;
    if (ny < 0) {
      ny = 0;
      vy = -vy;
    }
    if (hitBrick(Math.floor(ball.x), Math.floor(ny))) {
      vy = -vy;
    } else if (ny >= PADDLE_Y && vy > 0) {
      const hit = ball.x - paddleX;
      if (hit >= -0.5 && hit <= PADDLE_W - 0.5) {
        // 当たった位置で角度を変える。端で打つほど鋭く飛ぶ。
        const offset = (hit / (PADDLE_W - 1)) * 2 - 1;
        vx = Math.max(-1.2, Math.min(1.2, offset * 0.95)) * speed();
        vy = -Math.abs(vy);
        ball.y = PADDLE_Y - 1;
      } else {
        lives -= 1;
        if (lives <= 0) over = true;
        else resetBall();
        return;
      }
    } else {
      ball.y = ny;
    }

    if (bricksLeft() === 0) {
      cleared = true;
      vx = 0;
      vy = 0;
    }
  }

  function nextLevel() {
    level += 1;
    cleared = false;
    fillBricks();
    resetBall();
  }

  function reset() {
    paddleX = Math.floor((W - PADDLE_W) / 2);
    score = 0;
    lives = 3;
    level = 1;
    over = false;
    cleared = false;
    paused = false;
    fillBricks();
    resetBall();
  }

  reset();
  timer = setTimeout(step, TICK_MS);

  return {
    lines() {
      const grid = Array.from({ length: H }, () => Array(W).fill(null));

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!bricks[r][c]) continue;
          for (let i = 0; i < BRICK_W; i++) {
            // ブロック同士の境目を 1 文字空けて、塊に見えないようにする
            grid[BRICK_TOP + r][c * BRICK_W + i] =
              i === BRICK_W - 1 ? null : { ch: "█", color: ROW_COLOR[r] };
          }
        }
      }

      for (let i = 0; i < PADDLE_W; i++) {
        grid[PADDLE_Y][paddleX + i] = { ch: "█", color: PADDLE };
      }

      const by = Math.min(H - 1, Math.max(0, Math.floor(ball.y)));
      const bx = Math.min(W - 1, Math.max(0, Math.floor(ball.x)));
      grid[by][bx] = { ch: "O", color: BALL };

      const out = [
        ui.header("BREAKOUT", `BEST ${ui.bestText(Math.max(api.best || 0, score))}`, W + 2),
        ui.top(W),
      ];
      for (let y = 0; y < H; y++) {
        let row = "│";
        for (let x = 0; x < W; x++) {
          const cell = grid[y][x];
          row += cell ? cell.color + cell.ch + ui.RESET : " ";
        }
        out.push(row + "│");
      }
      out.push(ui.bottom(W));
      out.push(
        ui.LABEL + " SCORE " + ui.RESET + ui.pad(String(score), 8) +
        ui.LABEL + "LIVES " + ui.RESET + ui.pad(String(Math.max(0, lives)), 5) +
        ui.LABEL + "LV " + ui.RESET + String(level),
      );
      out.push(
        " " + ui.keyHint([["← →", "move"], ["spc", "launch"], ["p", "pause"], ["q", "quit"]]),
      );
      return out;
    },

    status() {
      if (over) return ui.STATUS.over("r: retry  q: quit");
      if (cleared) return ui.STATUS.clear("spc: 次のレベルへ");
      if (paused) return ui.STATUS.paused;
      if (!launched) return ui.LABEL + " spc でボールを出す" + ui.RESET;
      return "";
    },

    onKey(key) {
      if (over) {
        if (key === "r") {
          reset();
          api.render();
        }
        return;
      }
      if (key === "p") {
        paused = !paused;
        api.render();
        return;
      }
      if (paused) return;

      switch (key) {
        case "\x1b[D": case "a":
          paddleX = Math.max(0, paddleX - 2);
          break;
        case "\x1b[C": case "d":
          paddleX = Math.min(W - PADDLE_W, paddleX + 2);
          break;
        case " ":
          if (cleared) nextLevel();
          else launch();
          break;
        default:
          return;
      }
      api.render();
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

module.exports = { id: "breakout", title: "Breakout", create };
