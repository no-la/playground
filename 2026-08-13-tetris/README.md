# BLOCKS

GitHub Pagesでそのまま遊べる、依存関係なしのGuideline-style落ち物パズルです。

## Rules

- 10×20 visible matrix + 20 hidden rows
- SRS rotation and wall kicks
- 7-bag randomizer, five-piece next queue, hold and ghost
- 500 ms move-reset lock delay (15 reset limit)
- Three-corner T-Spin / Mini detection including fifth-kick promotion
- Combo, Back-to-Back and Perfect Clear scoring

## Run

ルートのGitHub Pagesを開き、一覧から `BLOCKS` を選択します。ローカルではES modulesを使うためHTTPサーバー経由で開いてください。

```sh
python3 -m http.server
```

テストはNode.js 18以降で実行できます。

```sh
node 2026-08-13-tetris/test.mjs
```
