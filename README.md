# Agent Wait Tetris

herdr のエージェントペインが `working` になったら、小さいポップアップでテトリスが始まる。
エージェントが `idle` / `blocked` に戻ったら自分で閉じる。エージェント待ちの暇つぶし用プラグイン。

```
agent → working
   ↓ 自動
┌── Tetris ─────┐
│  ▓▓           │
│  ▓▓  ░        │
│      ░░░      │
└───────────────┘
   ↓ agent → idle/blocked
自動クローズ（スコア保存）
```

## 動作要件

| 要件 | 内容 |
| --- | --- |
| herdr | 0.7.0 以上（`min_herdr_version`） |
| Node.js | 18 以上。外部パッケージへの依存なし、ビルド不要 |
| OS | macOS / Linux（Windows は未検証） |
| エージェント統合 | `agent_status` を報告できる状態であること（例: `herdr integration install claude`） |

`agent_status` が取れているかは以下で確認できる。`agent` と `agent_status` が入っていれば OK。

```bash
herdr pane list
```

## herdr への導入

### A. このリポジトリをローカルから入れる（開発・自分用）

```bash
git clone <このリポジトリ> ~/src/herdr-tetris
herdr plugin link ~/src/herdr-tetris
```

`plugin link` は `[[build]]` を実行しないが、このプラグインはビルド不要なのでそのまま動く。
ソースを編集すればそのまま反映される（リンク先を直接読む）。

### B. GitHub から入れる

```bash
herdr plugin install <owner>/<repo>
```

信頼できるリビジョンに固定して入れるのが安全。

```bash
herdr plugin install <owner>/<repo> --ref v0.1.0
```

`plugin install` は実行されるコマンドのプレビューを出すので、目を通してから承認する。
（`--yes` は中身を確認済みのときだけ）

### 導入できたか確認する

```bash
herdr plugin list
# - nanka.tetris (Agent Wait Tetris) enabled [local:/path/to/repo]

herdr plugin action list --plugin nanka.tetris
# open  Open Tetris

herdr plugin action invoke nanka.tetris.open   # 手動でポップアップを出してみる
```

うまく出ないときはフックとコマンドのログを見る。このプラグインは `[tetris] ...` を stderr に出す。

```bash
herdr plugin log list --plugin nanka.tetris
```

### キーバインドを張る（任意）

herdr の設定ファイルに追記する。

```toml
[[keys.command]]
key = "prefix+t"
type = "plugin_action"
command = "nanka.tetris.open"
description = "tetris"
```

### 止める・外す

```bash
herdr plugin disable nanka.tetris    # 有効なまま無効化
herdr plugin enable  nanka.tetris    # 戻す
herdr plugin unlink  nanka.tetris    # link したものを外す
herdr plugin uninstall nanka.tetris  # install したものを消す
```

自動オープンだけ止めたい場合は後述の `config.json` を使う。

### マーケットプレイスに載せる場合

GitHub リポジトリに `herdr-plugin` トピックを付けるだけでよい。約30分ごとのリフレッシュで
https://herdr.dev/plugins/ に自動でインデックスされる（審査はない）。
リポジトリのルートに `herdr-plugin.toml` があることが条件。

## しくみ

| 役割 | 実装 |
| --- | --- |
| 開く | `[[events]]` フックで `pane.agent_status_changed` を購読し、`working` のときだけ `herdr plugin pane open` を呼ぶ (`src/on-status.js`) |
| 遊ぶ | `[[panes]]` の `placement = "popup"` で開く Node 製 TUI (`src/tetris.js`) |
| 閉じる | ゲーム自身が socket API で対象ペインを購読し、`working` を抜けたら終了する。プロセスが終わればペインも閉じる |

閉じる側をゲームに持たせているので、フック側がテトリスのペイン ID を追跡・保存する必要がない。
監視対象のペインは `pane open --env TETRIS_WATCH_PANE=<pane_id>` でゲームに渡している。

実際に飛んでくるイベントはこの形（`agent_status` は `data` の下）。

```json
{"event":"pane.agent_status_changed",
 "data":{"agent":"claude","agent_status":"idle","pane_id":"w1:p1","workspace_id":"w1"}}
```

なお `events.subscribe` で `pane.agent_status_changed` を購読するときは `pane_id` が必須。
省略すると `invalid_request` になる。また `placement = "popup"` は CLI の `--placement` では
指定できないため、マニフェスト側で宣言している。

## 操作

| キー | 動作 |
| --- | --- |
| `←` `→` / `a` `d` | 左右移動 |
| `↑` / `x` / `k` | 右回転 |
| `z` / `j` | 左回転 |
| `↓` / `s` | ソフトドロップ |
| `space` | ハードドロップ |
| `p` | ポーズ |
| `q` | 終了（スコアは保存される） |
| `r` | ゲームオーバー後にリトライ |

ゴーストピース、7-bag ランダマイザ、レベルによる落下速度上昇、ハイスコア保存あり。

## 設定

設定ファイルの場所は以下で確認できる。

```bash
herdr plugin config-dir nanka.tetris
```

そこに `config.json` を置く。

```json
{ "auto_open": false }
```

| キー | 既定 | 意味 |
| --- | --- | --- |
| `auto_open` | `true` | `working` で自動的にポップアップを開くか。`false` にすると手動起動のみ |

## 保存先

| 場所 | 内容 |
| --- | --- |
| `HERDR_PLUGIN_STATE_DIR/highscore.json` | ハイスコア |
| `HERDR_PLUGIN_STATE_DIR/tetris.lock` | 二重起動防止（pid 入り。プロセス終了時に削除） |
| `HERDR_PLUGIN_CONFIG_DIR/config.json` | ユーザー設定 |

## 既知の注意点

- `--focus` で開くので、`working` になった瞬間にフォーカスを奪う。プロンプト投入直後を想定した挙動。気になる場合は `src/on-status.js` の `--focus` を `--no-focus` に変える。
- ポップアップは 40x24 を要求する。ターミナルがこれより小さいと表示が崩れる。
- 短時間で終わる作業でも一瞬ポップアップが出る。「n 秒以上 `working` が続いたら開く」という遅延は未実装。
