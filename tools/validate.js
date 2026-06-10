/* ストーリーグラフ検証+全パスシミュレーション
   使い方: node tools/validate.js */
const fs = require('fs');
const path = require('path');
const base = path.join(__dirname, '..');

eval(fs.readFileSync(path.join(base, 'js/art.js'), 'utf8') + ';globalThis.Art=Art;');
eval(fs.readFileSync(path.join(base, 'js/scenarios.js'), 'utf8') + ';globalThis.STORY=STORY;');

let errs = [];
const artKeys = ['title','office_small','crunch','pitch','hiring','kpi','mvv','media','one_on_one',
  'seriesA','allhands','hardthings','rooftop','end_ipo','end_acq','end_steady','end_restart','end_gameover'];

for (const [id, sc] of Object.entries(STORY.scenes)) {
  if (sc.pick) {
    sc.pick.forEach(p => { if (!STORY.scenes[p]) errs.push(`${id}: pick→${p} 不在`); });
    continue;
  }
  if (!sc.art || !artKeys.includes(sc.art)) errs.push(`${id}: art不正 ${sc.art}`);
  if (!sc.lines || !sc.lines.length) errs.push(`${id}: lines空`);
  if (!sc.day) errs.push(`${id}: day未設定`);
  (sc.lines || []).forEach((l, i) => { if (!l.chat && typeof l.t !== 'string') errs.push(`${id} line${i}: t不正`); });
  (sc.choices || []).forEach((c, i) => {
    const nx = typeof c.next === 'function' ? null : c.next;
    if (nx && nx !== 'ENDING' && !STORY.scenes[nx]) errs.push(`${id} choice${i}: next→${nx} 不在`);
    if (id !== 'finale' && !c.review) errs.push(`${id} choice${i}: review欠落`);
    if (c.review && !['good', 'trade', 'risk'].includes(c.review.v)) errs.push(`${id} choice${i}: verdict不正`);
  });
}
artKeys.forEach(k => {
  const svg = Art.get(k);
  if (!svg.trim().startsWith('<svg') || !svg.trim().endsWith('</svg>')) errs.push(`art ${k} 不正なSVG`);
  if (svg.includes('undefined') || svg.includes('NaN')) errs.push(`art ${k} にundefined/NaN`);
});
console.log(errs.length ? '!! ' + errs.join('\n!! ') : `GRAPH/ART OK (${Object.keys(STORY.scenes).length} scenes)`);
if (errs.length) process.exit(1);

// 全選択肢パスのシミュレーション(資金バーン込み)
function clamp(v) { return Math.max(0, Math.min(100, v)); }
let results = {};
function sim(id, st, depth) {
  if (depth > 60) { results.LOOP = (results.LOOP || 0) + 1; return; }
  if (id === 'ENDING') {
    const s = st.stats;
    const score = Math.round(s.cash * 0.15 + s.biz * 0.3 + s.morale * 0.2 + s.culture * 0.35);
    const ctx = { ...s, score, flags: st.flags };
    const key = ['ipo', 'acq', 'steady', 'restart'].find(k => STORY.endings[k].cond(ctx));
    results[key] = (results[key] || 0) + 1;
    return;
  }
  const sc = STORY.scenes[id];
  if (sc.pick) { sc.pick.forEach(p => sim(p, structuredClone(st), depth + 1)); return; }
  if (id !== STORY.start) {
    st.stats.cash = clamp(st.stats.cash - (3 + Math.floor(st.members / 12)));
    if (st.stats.cash <= 0) { results['GO:cash'] = (results['GO:cash'] || 0) + 1; return; }
  }
  sc.lines.forEach(l => { if (l.if) l.if({ flags: st.flags, stats: st.stats }); });
  for (const c of sc.choices) {
    const st2 = structuredClone(st);
    if (c.flags) Object.assign(st2.flags, c.flags);
    for (const k of ['cash', 'biz', 'morale', 'culture', 'skill']) if (c.fx[k]) st2.stats[k] = clamp(st2.stats[k] + c.fx[k]);
    if (c.fx.members) st2.members = Math.max(1, st2.members + c.fx.members);
    if (st2.stats.cash <= 0) { results['GO:cash'] = (results['GO:cash'] || 0) + 1; continue; }
    if (st2.stats.morale <= 0) { results['GO:morale'] = (results['GO:morale'] || 0) + 1; continue; }
    sim(typeof c.next === 'function' ? c.next({ flags: st2.flags, stats: st2.stats }) : c.next, st2, depth + 1);
  }
}
sim(STORY.start, { stats: { cash: 50, biz: 30, morale: 60, culture: 40, skill: 10 }, members: 5, flags: {} }, 0);
const total = Object.values(results).reduce((a, b) => a + b, 0);
console.log('総パス数:', total);
for (const [k, v] of Object.entries(results)) console.log(' ', k, v, `(${(v / total * 100).toFixed(1)}%)`);
