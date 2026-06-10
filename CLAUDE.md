# STARTUP STORY ─ プロジェクトガイド(Claude Code セッション引き継ぎ用)

ブラウザで動くスタートアップ経営アドベンチャーゲーム。`index.html` を開くだけで動作する
(ビルド・サーバー・外部依存なし。イラストはSVGを動的生成、効果音はWebAudio合成)。

このドキュメントは開発セッションの引き継ぎ用。**変更を加えたら必ず後述の検証を実行すること。**

## ファイル構成

```
index.html        エントリポイント(タイトル/ゲーム/エンディングの3画面)
css/style.css     デザインシステム(後述)+SVGアニメーション定義
js/art.js         シーンイラスト(SVG文字列)生成。人物/机/窓などのパーツ関数+シーン関数
js/scenarios.js   ストーリーデータ・用語辞典・エンディング定義(データのみ、ロジックなし)
js/game.js        ゲームエンジン(進行・状態・演出・効果音・シェア)
tools/validate.js ストーリーグラフ検証+全パスシミュレーション(node tools/validate.js)
tools/bundle.js   単一HTMLファイル化(node tools/bundle.js → dist/startup-story.html)
tools/playtest.js Playwrightによる自動通しプレイ(node tools/playtest.js [選択肢index] [mobile])
```

## ゲーム仕様の要点

- **パラメータ**: cash(資金)/biz(事業)/morale(士気)/culture(文化)/skill(成長)、各0-100。
  members(社員数)は別管理。初期値: cash50 biz30 morale60 culture40 skill10 members5
- **月次バーン**: 章(シーン)開始ごとに `cash -= 3 + floor(members/12)`(ch1のみ免除)
- **ゲームオーバー**: cash≦0(資金ショート)または morale≦0(組織崩壊)
- **役職昇進**: skill閾値で メンバー→リーダー→マネージャー→事業部長→執行役員→取締役COO
- **分岐**: 選択肢の `flags` が state.flags に蓄積され、`if: st => st.flags.xxx` で行を出し分け。
  ハリボテ選択→ch2x(炎上)、第10章は hard_talk/hard_cut/hard_sell で専用後日譚3種
- **ランダムイベント**: `ev_slot1`(poach/media/office)、`ev_slot2`(outage/rival/bigdeal)。
  `{ pick: [...] }` 形式のシーンをエンジンがランダム解決
- **エンディング判定**: score = cash*0.15 + biz*0.3 + morale*0.2 + culture*0.35。
  ipo(score≥68 & biz≥60 & culture≥55 & !hard_sell)→ acq(hard_sell&score≥45 か score≥57&biz≥55)
  → steady(score≥38)→ restart の順で判定。
  現在の全パス分布: ipo 5.2% / acq 49.8% / steady 37.3% / restart 0.5% / GO:cash 7.2%
- **振り返りノート**: 全選択肢に `review: {v:'good'|'trade'|'risk', title, text}`(◎定石/○トレードオフ/△劇薬)。
  エンディングで一覧表示。**Xシェアボタンを押すまでぼかしロック**(投稿完了は検証しない)
- **用語辞典**: `STORY.glossary`(約45語)。本文/チャット/ノート中の用語が自動でタップ可能になる。
  再クリックで閉じる。ポップアップ表示中のクリックは「閉じる」として消費され話は進まない
- **バックログ**: テキスト欄右上▲(または↑キー)で過去ログ閲覧。クリック/↓で進み最新で復帰
- **シェア**: X intent(x.com/intent/post)。リンクはゲーム自身のURL(http配信時はlocation、
  file://時はリポジトリURL)+UTM。エンディング画面下部にスタクラ(startupclass.co.jp)への
  CTAあり(UTM: utm_source=startup_story&utm_medium=game&utm_campaign=ending_cta&utm_content=結末)
- **操作**: クリック/Enter/Space/↓=進む、↑=ログ、1〜4=選択肢、♪=ミュート(localStorage保存)

## シナリオデータ形式(js/scenarios.js)

```js
scene = {
  chapter: '第N章 タイトル',  // 変わった時だけ章タイトルカード演出が出る
  day: 300,                    // 入社N日目(HUDとカードに表示)
  art: 'kpi',                  // js/art.js のシーンキー
  sceneFx: 'shake'|'storm'|'alarm',  // 任意。画面シェイク/雷/警報音
  lines: [
    { sp: '話者', t: '本文' },            // sp空文字=地の文
    { sp, t, if: st => st.flags.hack },   // 条件付き行
    { chat: { ch: '#channel', user: 'name', text: '...' } },  // Slack風演出
  ],
  choices: [{
    label, fx: {cash,biz,morale,culture,skill,members},
    flags: {key:true}, review: {v,title,text},
    result: [lines], next: 'scene_id'|'ENDING',
  }],
}
```

## 登場人物(重要な経緯)

株式会社スタートアップクラス(startupclass.co.jp)の役員がモデル。**名字の1文字目を変えた
フィクション**にするのがユーザーの指示:
藤岡清高→**松岡清高**(CEO)/ 佐藤勇一→**斉藤勇一**(CTO)/ 寺本秀宝→**宮本秀宝**(CFO)/
根岸やすゆき→**山岸やすゆき**(CMO)。社名はフィクションの「NOVA WORKS」。

## デザインシステム(css/style.css)

- パレット: 墨色背景(--ink #0a0d15)/金(--gold #d3a558)/生成り文字(--paper #ece7db)/
  ティール(--teal、用語リンク用)。彩度を抑えるのが方針。**原色・絵文字多用はNG**
- 書体: 地の文・章題・結末=明朝(--font-serif)、UI=ゴシック(--font-ui)。システムフォントのみ
- レイアウト: PC=16:9の「シアター」にイラスト全面+下部グラデの台詞ボックス+上部半透明HUD。
  **640px以下はオーバーレイをやめ縦積み**(HUD→絵→選択肢→テキスト)。.veilは非表示になる
- 章タイトルカード: 表示中(約2.1秒)は本文を開始せず `state.busyUntil` でクリック無効。
  本文はカードのフェードアウト(1.75秒後)から開始。この順序を壊さないこと

## ユーザーの要望・方針(時系列)

1. ブラウザで動くスタートアップ経営ADV。アドベンチャーゲーム風イラスト
2. 登場人物はスタクラ役員の名字1文字変え
3. ストーリー重厚化・分岐・エンディングで選択へのフィードバック(学び)・イラストに動き・
   **選択肢のパラメータ変化ヒントは出さない**(答えがわかるから)
4. 「プロのゲーム会社が作ったような」デザイン。文字とボーダーの重なり禁止
5. 専門用語に初心者向け解説(タップ式)
6. **「あるある」と感じる実在感のあるエピソード重視**(メルカリの椅子、金曜デプロイ事故、
   スプシ_最新_v3_コピー(2)、バリューTシャツ、調達発表日のソワソワ等を既に注入済み)
7. Xシェア(押した時点でノート解放、検証不要)+スタクラ案内+UTM
8. スマホ縦対応/シェアリンクはゲーム自身のURL/用語ポップアップはトグル/▲で戻る
9. 章カード表示中に本文が進まないこと/HUDサブ情報は濃い色で

## 検証(変更したら必ず)

```bash
node --check js/*.js           # 構文
node tools/validate.js         # グラフ整合性+全パスシミュレーション(分布が大きく崩れていないか)
node tools/playtest.js 0       # 通しプレイ(全選択肢index 0)。NO JS ERRORS を確認
node tools/playtest.js 1
node tools/playtest.js 2
node tools/playtest.js 1 mobile  # スマホビューポート(390x844)
node tools/bundle.js           # 配布用単一ファイル dist/startup-story.html を生成
```

Playwright は `require('playwright')` できる環境が必要(グローバルインストールでも可。
playtest.js はグローバルパスへのフォールバックあり)。スクリーンショットは /tmp/pt_*.png に出る。

## ハマりどころ(再発防止)

- **transform-box を `svg *` 全体に当てない**。SVGのtransform属性の基準点が要素中心に変わり
  絵が崩れる(腕が分離する等)。アニメ用クラスだけに限定する(現状の実装が正)
- **String.replace の置換文字列に `$&` を含むコード**(game.jsの正規表現エスケープ)があるため、
  bundle.js は関数置換 `replace(x, () => y)` を使う。文字列置換に戻すと壊れる
- 用語クリックは document の **capture フェーズ**で拾って stopPropagation している。
  ステージクリック(進行)より先に処理させるため。イベント処理を足すときは順序に注意
- シーン遷移タイマー `sceneStartTimer` はリプレイ/遷移時に必ず clearTimeout(残ると古い行が出る)
- イラスト内に日本語ラベル文字を浮かせない(「段ボール」等は過去に削除済み)。
  SVG内テキストは枠からあふれないよう幅と文字数を確認

## 未対応・アイデア

- GitHub Pages等でのホスティング(シェアURLが正式になる。リポジトリをPagesで公開するだけ)
- セーブ機能(localStorage)/オートモード/既読スキップ
- エンディングのSNS用OGP画像
- 効果音のBGM化、シーンごとのアンビエント
