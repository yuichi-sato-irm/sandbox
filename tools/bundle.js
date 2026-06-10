/* 配布用の単一HTMLファイルを生成する
   使い方: node tools/bundle.js → dist/startup-story.html
   注意: game.js に "$&" を含むコードがあるため、必ず関数置換を使うこと */
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');

const css = fs.readFileSync(path.join(base, 'css/style.css'), 'utf8');
const art = fs.readFileSync(path.join(base, 'js/art.js'), 'utf8');
const sce = fs.readFileSync(path.join(base, 'js/scenarios.js'), 'utf8');
const game = fs.readFileSync(path.join(base, 'js/game.js'), 'utf8');
let html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');

html = html.replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + css + '\n</style>');
html = html.replace(
  '<script src="js/art.js"></script>\n<script src="js/scenarios.js"></script>\n<script src="js/game.js"></script>',
  () => '<script>\n' + art + '\n' + sce + '\n' + game + '\n</script>'
);
if (html.includes('js/art.js')) { console.error('REPLACE FAILED: index.htmlのタグ構成を確認'); process.exit(1); }

fs.mkdirSync(path.join(base, 'dist'), { recursive: true });
const out = path.join(base, 'dist/startup-story.html');
fs.writeFileSync(out, html);
console.log('BUNDLE OK', (html.length / 1024).toFixed(1) + 'KB →', out);
