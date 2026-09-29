"use strict";

// ゲーム間で見た目を揃えるための小道具。
// ここにあるのは色と枠だけで、ゲームのルールは持たない。

const RESET = "\x1b[0m";
const DIM = "\x1b[38;5;238m";
const LABEL = "\x1b[38;5;245m";
const ACCENT = "\x1b[38;5;213m";

function fg(n) {
  return `\x1b[38;5;${n}m`;
}

function bg(n) {
  return `\x1b[48;5;${n}m`;
}

// 表示上の桁数。ANSI は数えず、全角文字は 2 桁として数える。
// `s.length` で測ると日本語やステータス表示を含む行を過小評価して、
// 「テストは通るのに実機で折り返す」ということが起きる。
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const WIDE =
  /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function visibleWidth(s) {
  let n = 0;
  for (const ch of String(s).replace(ANSI, "")) n += WIDE.test(ch) ? 2 : 1;
  return n;
}

function pad(s, n) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function padLeft(s, n) {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function top(width) {
  return "┌" + "─".repeat(width) + "┐";
}

function bottom(width) {
  return "└" + "─".repeat(width) + "┘";
}

// ハイスコアは未記録のことがある。その場合は "-" を出す。
function bestText(best) {
  return best === null || best === undefined ? "-" : String(best);
}

// 1 行ヘッダ（タイトル + 任意の右寄せ情報）
function header(title, right, width) {
  const left = ACCENT + title + RESET;
  const space = Math.max(1, width - title.length - right.length);
  return left + " ".repeat(space) + LABEL + right + RESET;
}

function keyHint(pairs) {
  return pairs
    .map(([key, label]) => `${DIM}${key}${RESET} ${LABEL}${label}${RESET}`)
    .join("  ");
}

const STATUS = {
  over: (extra) => `\x1b[41;97m GAME OVER \x1b[0m  ${extra}`,
  clear: (extra) => `\x1b[42;30m CLEAR! \x1b[0m  ${extra}`,
  paused: "\x1b[43;30m PAUSED \x1b[0m  p: resume",
};

module.exports = {
  RESET, DIM, LABEL, ACCENT,
  fg, bg, pad, padLeft, top, bottom, bestText, header, keyHint, STATUS,
  visibleWidth,
};
