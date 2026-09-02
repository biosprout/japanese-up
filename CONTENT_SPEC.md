# JAPANESE UP! 教材データ仕様（CONTENT_SPEC）

このファイルを読めば、アプリ本体（index.html）を読まなくても教材を追加できる。
教材データの source of truth は `data/` 配下の JSON だけ。index.html には問題も語彙も持たない。

JAPANESE UP! の教材は2種類ある。

- **本体4択（quiz）**: 漢字・語彙・文法・古典の4択問題。起動時に必須データとして読み込む（読めなければ再読み込み画面）
- **語彙（vocab）**: 「読みを書く」「意味カード」用の語彙。本体とは別に非同期で読み込む（読めなくても4択は動く）

## 1. ファイル一覧

| ファイル | 種類 | 役割 |
|---|---|---|
| `data/index.json` | manifest | quiz と vocab の両方を `kind` で区別して列挙する単一 manifest |
| `data/quiz-kanji.json` | quiz | 漢字（読み・書き）の4択 |
| `data/quiz-goi.json` | quiz | 語彙（熟語・慣用句）の4択 |
| `data/quiz-bunpo.json` | quiz | 文法（品詞・敬語）の4択 |
| `data/quiz-koten.json` | quiz | 古文・漢文の4択 |
| `data/kanji.json` | vocab | 漢字の読み（読みを書く） |
| `data/yoji.json` | vocab | 四字熟語（読みを書く、意味カード） |
| `data/kotowaza.json` | vocab | ことわざ・慣用句（意味カード） |
| `data/kobun.json` | vocab | 古文単語（意味カード） |
| `scripts/validate-content.mjs` | | データ検証（Node.js、追加パッケージ不要） |
| `scripts/format-content.mjs` | | データ整形（同上） |
| `sw.js` | | Service Worker。オフライン用にデータをキャッシュする |


## source of truth

**教材の唯一の source of truth は `data/*.json` である。** 4択も語彙も JSON を直接編集し、`format-content.mjs` → `validate-content.mjs` を通して commit する。

`data/vocab-list.js` は、語彙 JSON を最初に生成したときの元原稿で、今後の source of truth ではない。git では追跡せず（.gitignore 対象）、内容は JSON 生成時点で止まっている。語彙を直すときは `data/kanji.json` 等を直接編集し、vocab-list.js は更新しない（JSON と元原稿を別々に更新する運用はしない）。参考資料として残す場合も、JSON と食い違っていて当然のものとして扱う。

## 2. manifest（data/index.json）の schema

```json
{
  "version": 2,
  "contentVersion": "snapshot-3cd9915",
  "levels": ["easy","std","hard"],
  "sets": [
    {"id":"quiz-kanji","field":"kanji","name":"漢字（読み・書き）","file":"quiz-kanji.json","kind":"quiz","count":76},
    {"id":"quiz-goi","field":"goi","name":"語彙（熟語・慣用句）","file":"quiz-goi.json","kind":"quiz","count":70},
    {"id":"quiz-bunpo","field":"bunpo","name":"文法（品詞・敬語）","file":"quiz-bunpo.json","kind":"quiz","count":68},
    {"id":"quiz-koten","field":"koten","name":"古文・漢文","file":"quiz-koten.json","kind":"quiz","count":66},
    {"id":"kanji","name":"漢字の読み","file":"kanji.json","kind":"vocab","count":140},
    {"id":"yoji","name":"四字熟語","file":"yoji.json","kind":"vocab","count":50},
    {"id":"kotowaza","name":"ことわざ・慣用句","file":"kotowaza.json","kind":"vocab","count":55},
    {"id":"kobun","name":"古文単語","file":"kobun.json","kind":"vocab","count":50}
  ],
  "quizTotal": 280,
  "vocabTotal": 295,
  "total": 575
}
```

| property | 必須 | 意味 |
|---|---|---|
| `version` | 必須 | manifest 形式の版。`2`（version 1 は語彙だけの旧形式） |
| `contentVersion` | 必須 | 教材の版 ID（文字列、空にしない）。batch 取込で `batch_id` に更新される。アプリの教材更新バーがこの値の変化を検出する |
| `levels` | 任意 | 難易度 ID の一覧（参考情報） |
| `sets[].kind` | 必須 | `quiz` または `vocab`。アプリはこれで読み分ける |
| `sets[].id` | 必須 | quiz は `quiz-<分野>`、vocab は `kanji` `yoji` `kotowaza` `kobun`。vocab の id は意味カード等の分類名（アプリ内の `c`）としても使われる |
| `sets[].field` | quiz のみ必須 | 分野 ID。`kanji` `goi` `bunpo` `koten` |
| `sets[].name` | 必須 | 表示名。vocab はアプリが語彙モードの見出しに使う。quiz は参考情報（アプリは index.html 内 `FIELDS` を使う） |
| `sets[].file` | 必須 | `data/` からの相対ファイル名 |
| `sets[].count` | 必須 | そのファイルの items 件数 |
| `quizTotal` | 必須 | quiz の count 合計 |
| `vocabTotal` | 必須 | vocab の count 合計 |
| `total` | 必須 | quizTotal + vocabTotal |

## 3. 本体4択（quiz-*.json）の schema

```json
{
  "version": 1,
  "items": [
    {"id":"k_e1","f":"kanji","lv":"easy","q":"「委ねる」の読みはどれか。","ch":["ゆだねる","おもねる","つらねる","かさねる"],"a":0,"ex":"ゆだねる。「委任」「委託」の委で、他人にまかせるという意味。"}
  ]
}
```

| property | 型 | 必須 | 意味 |
|---|---|---|---|
| `id` | string | 必須 | 問題 ID。quiz 全体で一意 |
| `f` | string | 必須 | 分野。ファイルの `field` と一致（`kanji` `goi` `bunpo` `koten`） |
| `lv` | string | 必須 | `easy`（基礎 中1〜中2）/ `std`（標準 中3）/ `hard`（入試） |
| `q` | string | 必須 | 問題文 |
| `ch` | string[4] | 必須 | 選択肢。ちょうど4件、重複なし。表示時にアプリがシャッフルする |
| `a` | integer | 必須 | 正答 index。**0 始まり**。0〜3 |
| `ex` | string | 必須 | 解説 |

これ以外の property は追加しない。

### quiz の ID 命名規則

`<分野1文字>_<種別1文字><通し番号>`。分野: `k`=kanji, `g`=goi, `b`=bunpo, `t`=koten。種別: `e`=easy, `s`=std, `h`=hard（難易度は `lv` が正）。既存の最大番号の次を使う。

## 4. 語彙（kanji / yoji / kotowaza / kobun）の schema

```json
{
  "id": "kanji",
  "name": "漢字の読み",
  "items": [
    {"i":"k1","w":"承る","r":"うけたまわる"},
    {"i":"k6","w":"免れる","r":"まぬかれる","alt":["まぬがれる"]},
    {"i":"k46","w":"謀る","r":"はかる","h":"例：悪事を謀る"}
  ]
}
```

ファイルの `id` と `name` は manifest の同じ set と一致させる。

| property | 型 | 意味 |
|---|---|---|
| `i` | string | 語 ID。vocab 全体で一意。学習記録のキー |
| `w` | string | 語（表記）。同じファイル内で重複させない |
| `r` | string | 読み。あると「読みを書く」に出題される |
| `m` | string | 意味。あると「意味カード」に出題される |
| `alt` | string[] | 別解の読み（`r` があるときだけ）。入力がこのどれかに一致しても正解 |
| `h` | string | 語義・用例のヒント。読みが分かれる語で、ねらう読みを一つに絞るために出す |

セットごとの必須 / 任意:

| セット | `i` の形 | 必須 | 任意 |
|---|---|---|---|
| kanji | `k` + 数字 | `i` `w` `r` | `alt` `h` |
| yoji | `y` + 数字 | `i` `w` `r` `m` | `alt` `h` |
| kotowaza | `p` + 数字 | `i` `w` `m` | なし |
| kobun | `g` + 数字 | `i` `w` `m` | なし |

読み判定はカタカナをひらがなに寄せ、空白を除いて比較する。同じ表記で読みが複数あるときの方針: 同じ語の読み揺れは `alt` で両方正解にし、読みで語義が変わる語は `h` でねらう読みを一つに絞る。

### 一度公開した ID を変えてはいけない理由

学習記録は localStorage に quiz は `stats[問題ID]`、語彙は `vstat[語ID]` として保存されている。ID を変えるとその問題・語の成績、苦手判定、復習間隔が未着手に戻る。内容を直すときは ID を保ったまま中身だけ変え、削除した ID を別の問題に再利用しない。

## 5. 文字コードと JSON 形式

- UTF-8（BOM なし）、LF。日本語はそのまま書き、`\uXXXX` に escape しない
- 問題・語1件を1行にする（`node scripts/format-content.mjs` が整える）
- 制御文字を入れない

## 6. 追加する手順

### 4択問題を足す

1. 分野の `data/quiz-<分野>.json` の `items` 末尾に item を足す
2. `data/index.json` の該当 `count`、`quizTotal`、`total` を増やす
3. `node scripts/format-content.mjs` → `node scripts/validate-content.mjs` で `✓ OK`
4. ローカルサーバで確認（第8節）
5. 必要なら index.html の `APP_VER` を上げる。commit する。push は田中が行う

### 語彙を足す

1. 該当の `data/<set>.json` の `items` 末尾に足す（`i` は既存最大番号の次）
2. `data/index.json` の該当 `count`、`vocabTotal`、`total` を増やす
3. 以下は4択と同じ

## 7. validator と formatter

```
node scripts/validate-content.mjs
node scripts/format-content.mjs
node scripts/format-content.mjs --check
```

Node.js 18 以上、npm install 不要。validator は JSON / UTF-8 / manifest の参照 / count と total / 必須 property と型 / ID の空・重複・接頭辞 / 分野・難易度 / 空文字と制御文字 / 選択肢4件と重複 / 正答 index / 語彙の `r` `m` `alt` `h` の組み合わせ / 同一ファイル内の語の重複 / 未参照 JSON や `.DS_Store` を見る。

## 8. ローカルで動かす

```
cd japanese-up
python3 -m http.server 8000
# http://localhost:8000/
```

file:// では fetch が動かないので、必ずサーバ経由で開く。

## contentVersion と教材更新バー

`data/index.json` の `contentVersion` は教材の版 ID。アプリは起動時に読んだ値を覚えておき、window の focus / タブが visible に戻ったとき / visible 中は 30 分ごと（同一タブでは最低 60 秒間隔）に `data/index.json` を `cache: "no-store"` で読み直す。値が変わっていれば、学習を止めない小さなバー「🆕 新しい問題があります　[更新] [あとで]」を出す。

- 値は不透明な文字列。大小比較はせず、等しいかどうかだけを見る
- 初期値は `snapshot-<HEAD 短縮 hash>`。batch 取込時は importer がその batch の `batch_id` に更新する（WORD で talk.json だけを更新した場合も更新する）
- 手で教材を直したときも、必ず `contentVersion` を新しい値（例: `manual-YYYYMMDD-a`）に変える。変えないと開きっぱなしの端末に更新が伝わらない
- `更新` は reload、`あとで` は同じタブ・同じ version では再表示しない（別の version なら再表示する）。バーを出すだけでは Q や localStorage は変わらない
- network error・offline・non-OK・JSON error は静かに無視する
- `APP_VER` はコード・UI・学習ロジックの更新通知用。教材だけの更新では原則 `APP_VER` を変えず、`contentVersion` だけを更新する

## 9. Service Worker と教材更新の関係

- `sw.js` は index.html と `data/*.json` を network-first で取得する。オンラインなら常に最新 JSON が届き、オフライン時だけキャッシュを返す
- JSON を更新するだけなら `sw.js` の `CACHE` 名を変えなくてよい
- `data/` にファイルを増やしたら `sw.js` の `ASSETS` に追加し、`CACHE` の版数を上げる（precache に失敗すると新しい Service Worker は install されず、旧版が使われ続ける。ASSETS の path 間違いに注意）
- cache 名は `japaneseup-` で始まり（`CACHE_PREFIX`）、古い cache の掃除はこの prefix を持つものだけを対象にする。同じ origin にある他の BioSprout アプリの cache には触れない
- 404 や 500 などの error response は cache に保存しない。network が error を返したときは、正常な cache があればそちらを返す

## 10. してはいけない変更

- 公開済み `id` / `i` の変更・再利用
- `a` を 1 始まりにする、`ch` を4件以外にする
- quiz item への property 追加、語彙 item への未定義 property の追加
- quiz と vocab のファイル名・set id を衝突させる（quiz は `quiz-` 接頭辞を保つ）
- index.html に問題の fallback copy を戻す
- `vocab-list.js` を編集して語彙を直す（source of truth は JSON のみ）
