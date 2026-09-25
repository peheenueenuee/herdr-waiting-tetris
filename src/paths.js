"use strict";

// 状態ファイルの置き場所をここ 1 か所に集める。
// herdr が渡してくる HERDR_PLUGIN_STATE_DIR / HERDR_PLUGIN_CONFIG_DIR が本番の値で、
// フォールバックは herdr の外から直接動かしたとき用。

const path = require("node:path");

const HOME = process.env.HOME || ".";

const STATE_DIR =
  process.env.HERDR_PLUGIN_STATE_DIR ||
  path.join(HOME, ".local/state/herdr-waitgames");

const CONFIG_DIR = process.env.HERDR_PLUGIN_CONFIG_DIR || STATE_DIR;

module.exports = {
  STATE_DIR,
  CONFIG_DIR,
  CONFIG_FILE: path.join(CONFIG_DIR, "config.json"),
  SCORE_FILE: path.join(STATE_DIR, "highscores.json"),
  LOCK_FILE: path.join(STATE_DIR, "game.lock"),
  // nanka.tetris 時代のハイスコア（単一ゲーム、{"best":n} 形式）の置き場。
  // id を変えると状態ディレクトリも変わるので、見つかれば tetris の記録として引き継ぐ。
  LEGACY_SCORE_FILES: [
    path.join(STATE_DIR, "highscore.json"),
    path.join(HOME, ".local/state/herdr/plugins/nanka.tetris/highscore.json"),
  ],
};
