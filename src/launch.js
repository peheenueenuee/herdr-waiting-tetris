"use strict";

// herdr にポップアップを開かせる部分。フック（on-status.js）と
// 手動アクション（open.js）の両方から使う。

const { spawnSync } = require("node:child_process");
const lock = require("./lock.js");

const PLUGIN_ID = process.env.HERDR_PLUGIN_ID || "nanka.waitgames";
const ENTRYPOINT = "game";

/**
 * @param {string|null} paneId  監視するペイン（working を抜けたらゲームが自分で閉じる）
 * @param {string} gameId       開くゲームの id
 * @param {(msg: string) => void} log
 * @returns {boolean} 開けたら true
 */
function openPane({ paneId, gameId, log }) {
  if (lock.alreadyRunning()) return false;
  lock.reserve();

  const herdr = process.env.HERDR_BIN_PATH || "herdr";
  // popup / overlay のペインは常にアクティブペインを対象に開く。
  // ここで --workspace や --target-pane を渡すと invalid_params で弾かれる。
  const args = [
    "plugin", "pane", "open",
    "--plugin", PLUGIN_ID,
    "--entrypoint", ENTRYPOINT,
    "--env", `WAITGAME_NAME=${gameId}`,
  ];
  // ゲームに「どのペインを見張るか」を渡す
  if (paneId) args.push("--env", `WAITGAME_WATCH_PANE=${paneId}`);
  args.push("--focus");

  // pane open はデーモンへの RPC ですぐ返る。同期実行して失敗を取りこぼさない。
  // detached + stdio:"ignore" で投げっぱなしにすると、エラーが出ても
  // plugin log には「成功」としか残らず原因が追えなくなる。
  const res = spawnSync(herdr, args, { encoding: "utf8", timeout: 10000 });

  if (res.error || res.status !== 0) {
    const detail = res.error
      ? res.error.message
      : `exit ${res.status}: ${(res.stderr || res.stdout || "").trim()}`;
    log(`failed to open pane: ${detail}`);
    // 開けなかったのにロックが残ると、次の working も抑止されてしまう。
    lock.release();
    return false;
  }
  return true;
}

module.exports = { openPane, PLUGIN_ID, ENTRYPOINT };
