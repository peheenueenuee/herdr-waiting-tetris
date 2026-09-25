# Agent Wait Games

herdr のエージェントペインが `working` になったら、小さいポップアップでゲームが始まる。
エージェントが `idle` / `blocked` に戻ったら自分で閉じる。エージェント待ちの暇つぶし用プラグイン。

```
agent → working
   ↓ 自動
┌── Wait Game ──┐
│  ▓▓           │
│  ▓▓  ░        │
│      ░░░      │
└───────────────┘
   ↓ agent → idle/blocked
自動クローズ（スコア保存）
```

遊べるのは 5 つ。どれを開くかは `config.json` で決める（既定は Tetris、ランダムも可）。

| id | ゲーム | 種類 | ひとこと |
| --- | --- | --- | --- |
| `tetris` | Tetris | リアルタイム | ゴーストピース・7-bag・レベルによる落下速度上昇 |
| `snake` | Snake | リアルタイム | 餌を食うほど速くなる。壁と自分に当たると終わり |
| `2048` | 2048 | ターン制 | 途中で閉じても損した気分になりにくい |
| `minesweeper` | Minesweeper | ターン制 | 16x12 / 地雷 30。最初の 1 手は必ず安全。記録はクリアタイム |
| `breakout` | Breakout | リアルタイム | 左右だけで遊べる。全消しで次のレベルへ |

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
git clone <このリポジトリ> ~/src/herdr-waiting-games
herdr plugin link ~/src/herdr-waiting-games
```

`plugin link` は `[[build]]` を実行しないが、このプラグインはビルド不要なのでそのまま動く。
ソースを編集すればそのまま反映される（リンク先を直接読む）。

### B. GitHub から入れる

```bash
herdr plugin install <owner>/<repo>
```

信頼できるリビジョンに固定して入れるのが安全。

```bash
herdr plugin install <owner>/<repo> --ref v0.2.0
```

`plugin install` は実行されるコマンドのプレビューを出すので、目を通してから承認する。
（`--yes` は中身を確認済みのときだけ）

### 導入できたか確認する

```bash
herdr plugin list
# - nanka.waitgames (Agent Wait Games) enabled [local:/path/to/repo]

herdr plugin action list --plugin nanka.waitgames
# open              Open Wait Game
# open-random       Play Random Game
# open-tetris       Play Tetris
# open-snake        Play Snake
# open-2048         Play 2048
# open-minesweeper  Play Minesweeper
# open-breakout     Play Breakout

herdr plugin action invoke nanka.waitgames.open         # config.json のゲーム
herdr plugin action invoke nanka.waitgames.open-snake   # ゲームを名指し
herdr plugin action invoke nanka.waitgames.open-random  # ランダム
```

うまく出ないときはフックとコマンドのログを見る。このプラグインは `[waitgames] ...` を stderr に出す。

```bash
herdr plugin log list --plugin nanka.waitgames
```

### キーバインドを張る（任意）

herdr の設定ファイルに追記する。

```toml
[[keys.command]]
key = "prefix+g"
type = "plugin_action"
command = "nanka.waitgames.open"
description = "wait game"

[[keys.command]]
key = "prefix+r"
type = "plugin_action"
command = "nanka.waitgames.open-random"
description = "random game"
```

### 止める・外す

```bash
herdr plugin disable nanka.waitgames    # 有効なまま無効化
herdr plugin enable  nanka.waitgames    # 戻す
herdr plugin unlink  nanka.waitgames    # link したものを外す
herdr plugin uninstall nanka.waitgames  # install したものを消す
```

自動オープンだけ止めたい場合は後述の `config.json` を使う。

### マーケットプレイスに載せる場合

GitHub リポジトリに `herdr-plugin` トピックを付けるだけでよい。約30分ごとのリフレッシュで
https://herdr.dev/plugins/ に自動でインデックスされる（審査はない）。
リポジトリのルートに `herdr-plugin.toml` があることが条件。

## 設定

設定ファイルの場所は以下で確認できる。

```bash
herdr plugin config-dir nanka.waitgames
```

そこに `config.json` を置く。

```json
{
  "auto_open": true,
  "game": "snake"
}
```

| キー | 既定 | 意味 |
| --- | --- | --- |
| `auto_open` | `true` | `working` で自動的にポップアップを開くか。`false` にすると手動起動のみ |
| `game` | `"tetris"` | 開くゲーム。名指し / `"random"` / 配列 の 3 通り |

`game` の書き方は 3 通り。

```json
{ "game": "snake" }                    // いつも Snake
{ "game": "random" }                   // 毎回 5 つからランダム
{ "game": ["tetris", "2048"] }         // この 2 つからランダム
```

ランダムのときは**直前に開いたゲームを避ける**（5 つしかないので、避けないと同じものが
続いて「ランダムに見えない」ため）。直前に何を開いたかは状態ディレクトリの `recent.json` に持つ。

知らない名前を書いた場合は `tetris` に落ちて開く（開かない、ではない）。配列の中に知らない名前が
混じっている場合はそれだけ無視する。いずれも `herdr plugin log list` に `unknown game ...` が残る。

`game` を変えても、すでに開いているポップアップには影響しない。次に `working` になったときから。

## 操作

`q` で終了（スコアは保存される）、`Ctrl-C` も同じ。それ以外はゲームごと。

### Tetris

| キー | 動作 |
| --- | --- |
| `←` `→` / `a` `d` | 左右移動 |
| `↑` / `x` / `k` | 右回転 |
| `z` / `j` | 左回転 |
| `↓` / `s` | ソフトドロップ |
| `space` | ハードドロップ |
| `p` | ポーズ |
| `r` | ゲームオーバー後にリトライ |

### Snake

| キー | 動作 |
| --- | --- |
| `←` `↑` `↓` `→` / `wasd` | 進行方向を変える（真後ろへは曲がれない） |
| `p` | ポーズ |
| `r` | ゲームオーバー後にリトライ |

### 2048

| キー | 動作 |
| --- | --- |
| `←` `↑` `↓` `→` / `wasd` | スライド |
| `r` | やり直し（いつでも） |

### Minesweeper

| キー | 動作 |
| --- | --- |
| `←` `↑` `↓` `→` / `wasd` | カーソル移動 |
| `space` / `Enter` | 開く |
| `f` | 旗を立てる / 外す |
| `r` | 新しい盤 |

記録はスコアではなくクリアまでの秒数（小さいほうが良い記録）。

### Breakout

| キー | 動作 |
| --- | --- |
| `←` `→` / `a` `d` | パドル移動 |
| `space` | ボールを出す / 全消し後に次のレベルへ |
| `p` | ポーズ |
| `r` | ゲームオーバー後にリトライ |

## しくみ

| 役割 | 実装 |
| --- | --- |
| 開く | `[[events]]` フックで `pane.agent_status_changed` を購読し、`working` のときだけ `herdr plugin pane open` を呼ぶ (`src/on-status.js` → `src/launch.js`) |
| 遊ぶ | `[[panes]]` の `placement = "popup"` で開く Node 製 TUI (`src/play.js` → `src/runtime.js` → `src/games/*.js`) |
| 閉じる | ゲーム自身が socket API で対象ペインを購読し、`working` を抜けたら終了する。プロセスが終わればペインも閉じる |

閉じる側をゲームに持たせているので、フック側がポップアップのペイン ID を追跡・保存する必要がない。
監視対象のペインとゲーム名は `pane open --env` で渡している。

```
--env WAITGAME_WATCH_PANE=<pane_id>   どのペインを見張るか
--env WAITGAME_NAME=<game id>         何を遊ぶか
```

`[[panes]]` は 1 つだけで、ゲームごとにエントリポイントを分けてはいない。
ゲームを増やしてもマニフェストは（手動アクションを足す以外は）変わらない。

実際に飛んでくるイベントはこの形（`agent_status` は `data` の下）。

```json
{"event":"pane.agent_status_changed",
 "data":{"agent":"claude","agent_status":"idle","pane_id":"w1:p1","workspace_id":"w1"}}
```

なお `events.subscribe` で `pane.agent_status_changed` を購読するときは `pane_id` が必須。
省略すると `invalid_request` になる。また `placement = "popup"` は CLI の `--placement` では
指定できないため、マニフェスト側で宣言している。

`popup` / `overlay` のペインは**常にアクティブペインを対象に開く**。そのため
`pane open` に `--workspace` や `--target-pane` を渡してはいけない。渡すと次のエラーで弾かれ、
ペインは開かない。

```
{"error":{"code":"invalid_params","message":"overlay and popup plugin panes target the active pane"}}
```

## ゲームを増やす

`src/games/` に 1 ファイル足して `src/games/index.js` の配列に入れるだけ。
端末の出入り・ハイスコア・エージェント監視による自動クローズは `src/runtime.js` が持つので、
ゲーム側が書くのは「画面の行を返す」「キーを受け取る」の 2 つだけ。

```js
// src/games/pong.js
module.exports = {
  id: "pong",
  title: "Pong",
  lowerIsBetter: false,      // 記録がタイム系なら true
  create(api) {              // api = { best, render(), quit() }
    return {
      lines() { return ["..."]; },   // 画面の各行（ANSI 込み、必須）
      status() { return ""; },       // 最下段の 1 行（任意）
      onKey(key) {},                 // 1 キーぶん（必須）
      bestCandidate() { return 0; }, // 終了時に記録する値（任意、null なら記録しない）
      stop() {},                     // タイマーの後片付け（任意）
    };
  },
};
```

制約は「ポップアップの 40x24 に収まること」だけ。`q` と `Ctrl-C` は runtime が拾うので
ゲーム側で扱わなくてよい。矢印キーは `\x1b[A` 〜 `\x1b[D` に正規化されて届く。

## 保存先

| 場所 | 内容 |
| --- | --- |
| `HERDR_PLUGIN_STATE_DIR/highscores.json` | ゲームごとのハイスコア（`{"tetris":1200,"snake":80}`） |
| `HERDR_PLUGIN_STATE_DIR/game.lock` | 二重起動防止（pid 入り。プロセス終了時に削除） |
| `HERDR_PLUGIN_STATE_DIR/recent.json` | 直前に開いたゲーム（ランダム時の連続回避に使う） |
| `HERDR_PLUGIN_CONFIG_DIR/config.json` | ユーザー設定 |

`nanka.tetris`（単一ゲーム時代）の `highscore.json` があれば、初回に `tetris` の記録として
自動で引き継ぐ。

## 既知の注意点

- `--focus` で開くので、`working` になった瞬間にフォーカスを奪う。プロンプト投入直後を想定した挙動。気になる場合は `src/launch.js` の `--focus` を `--no-focus` に変える。
- ポップアップは 40x24 を要求する。ターミナルがこれより小さいと表示が崩れる。
- 短時間で終わる作業でも一瞬ポップアップが出る。「n 秒以上 `working` が続いたら開く」という遅延は未実装。
- `blocked`（承認待ちなど）でも閉じる。エージェントが `working` と `blocked` を往復すると、
  そのたびにポップアップが開いたり閉じたりする。承認プロンプトの多いセッションでは特に目立つ。
- ゲームは同時に 1 つしか開かない（ロックで抑止）。遊んでいる最中に別のペインが `working` に
  なっても、新しいポップアップは出ない。
