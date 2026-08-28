#!/bin/sh
# node を探して実行するラッパー。
#
# herdr server は launchd 管理（brew services）で起動するため、プラグインの
# コマンドには PATH=/usr/bin:/bin:/usr/sbin:/sbin しか渡ってこない。
# Homebrew の node は /opt/homebrew/bin にあるので、素の ["node", ...] だと
# "No such file or directory (os error 2)" で spawn に失敗する。
# 実測した環境変数は ../docs/herdr-plugin-broken-2026-08-27.md を参照。
#
# 使い方: bin/with-node.sh <script.js> [args...]

set -e

script="$1"
if [ -z "$script" ]; then
  echo "[tetris] with-node.sh: no script given" >&2
  exit 2
fi
shift

find_node() {
  # 1. 明示指定（デバッグ用の逃げ道）
  if [ -n "$TETRIS_NODE" ] && [ -x "$TETRIS_NODE" ]; then
    echo "$TETRIS_NODE"
    return
  fi

  # 2. PATH 上にあればそれ（herdr の外から普通に起動した場合はここで決まる）
  found=$(command -v node 2>/dev/null || true)
  if [ -n "$found" ]; then
    echo "$found"
    return
  fi

  # 3. よくある場所を直接見る（launchd 経由の痩せた PATH 対策）
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.local/bin/node" \
    "$HOME/.volta/bin/node"
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done

  # 4. 最後の手段: ログインシェルに聞く（nvm などで版が切り替わる環境向け）
  if [ -n "$SHELL" ] && [ -x "$SHELL" ]; then
    found=$("$SHELL" -lc 'command -v node' 2>/dev/null || true)
    if [ -n "$found" ] && [ -x "$found" ]; then
      echo "$found"
      return
    fi
  fi
}

node_bin=$(find_node)

if [ -z "$node_bin" ]; then
  echo "[tetris] node が見つからない (PATH=$PATH)。TETRIS_NODE で明示指定できる" >&2
  exit 127
fi

# 子プロセスからも node を引けるようにしておく
PATH="$(dirname "$node_bin"):$PATH"
export PATH

exec "$node_bin" "$script" "$@"
