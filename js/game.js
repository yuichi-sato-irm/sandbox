/* ============================================================
   game.js ─ ゲームエンジン
   ============================================================ */

(() => {
  const $ = id => document.getElementById(id);

  const el = {
    titleScreen: $('title-screen'),
    gameScreen: $('game-screen'),
    endingScreen: $('ending-screen'),
    titleArt: $('title-art'),
    art: $('art'),
    fxLayer: $('fx-layer'),
    toast: $('toast'),
    hudChapter: $('hud-chapter'),
    hudRole: $('hud-role'),
    hudMembers: $('hud-members'),
    speaker: $('speaker'),
    text: $('text'),
    nextHint: $('next-hint'),
    choices: $('choices'),
    textbox: $('textbox'),
    endingArt: $('ending-art'),
    endingTitle: $('ending-title'),
    endingText: $('ending-text'),
    endingSummary: $('ending-summary'),
  };

  const STAT_KEYS = ['cash', 'biz', 'morale', 'culture', 'skill'];
  const STAT_LABEL = { cash: '資金', biz: '事業', morale: '士気', culture: '文化', skill: '成長' };
  const STAT_COLOR = { cash: '#f5c542', biz: '#4ea8f5', morale: '#f56b6b', culture: '#9b6bf5', skill: '#4ecd7b' };

  let state = null;
  let typing = null; // { timer, full } タイプライター進行中の情報

  // ---------- 状態 ----------

  function newState() {
    return {
      stats: { cash: 50, biz: 30, morale: 60, culture: 40, skill: 10 },
      members: 5,
      roleIdx: 0,
      sceneId: null,
      lineIdx: 0,
      phase: 'lines', // 'lines' | 'choices' | 'result'
      resultLines: [],
      nextId: null,
      over: false,
    };
  }

  function clamp(v) { return Math.max(0, Math.min(100, v)); }

  function roleFor(skill) {
    let idx = 0;
    STORY.roles.forEach((r, i) => { if (skill >= r.min) idx = i; });
    return idx;
  }

  // ---------- HUD ----------

  function renderHud() {
    const s = state.stats;
    STAT_KEYS.forEach(k => {
      $(`bar-${k}`).style.width = s[k] + '%';
      $(`num-${k}`).textContent = s[k];
      const wrap = document.querySelector(`.stat[data-stat="${k}"]`);
      wrap.classList.toggle('danger', (k === 'cash' || k === 'morale') && s[k] <= 15);
    });
    el.hudRole.textContent = '役職:' + STORY.roles[state.roleIdx].name;
    el.hudMembers.textContent = '社員数:' + state.members + '人';
  }

  function popFx(text, color, slot) {
    const div = document.createElement('div');
    div.className = 'fx-pop';
    div.textContent = text;
    div.style.color = color;
    div.style.left = (8 + slot * 16) + '%';
    div.style.bottom = '18%';
    el.fxLayer.appendChild(div);
    setTimeout(() => div.remove(), 1700);
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.toast.classList.add('hidden'), 2600);
  }

  // ---------- 効果の適用 ----------

  function applyFx(fx) {
    if (!fx) return;
    let slot = 0;
    STAT_KEYS.forEach(k => {
      const d = fx[k];
      if (!d) return;
      state.stats[k] = clamp(state.stats[k] + d);
      popFx(`${STAT_LABEL[k]} ${d > 0 ? '+' : ''}${d}`, d > 0 ? STAT_COLOR[k] : '#ff9d9d', slot++);
    });
    if (fx.members) {
      state.members = Math.max(1, state.members + fx.members);
      popFx(`社員 ${fx.members > 0 ? '+' : ''}${fx.members}人`, fx.members > 0 ? '#9fe8e2' : '#ff9d9d', slot++);
    }
    const newRole = roleFor(state.stats.skill);
    if (newRole > state.roleIdx) {
      state.roleIdx = newRole;
      setTimeout(() => showToast(`🎉 昇進! ${STORY.roles[newRole].name} になった`), 700);
    }
    renderHud();
  }

  /** 章の開始ごとに発生する資金バーン(社員が多いほど重い) */
  function applyBurn() {
    const burn = 3 + Math.floor(state.members / 12);
    state.stats.cash = clamp(state.stats.cash - burn);
    popFx(`月次バーン 資金 -${burn}`, '#ffce7a', 4);
    renderHud();
  }

  function checkGameOver() {
    if (state.stats.cash <= 0) { gameOver('cash'); return true; }
    if (state.stats.morale <= 0) { gameOver('morale'); return true; }
    return false;
  }

  // ---------- テキスト表示 ----------

  function showLine(line) {
    el.speaker.textContent = line.sp || '';
    el.nextHint.classList.add('hidden');
    if (typing) { clearInterval(typing.timer); typing = null; }
    el.text.textContent = '';
    const full = line.t;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.text.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(timer);
        typing = null;
        el.nextHint.classList.remove('hidden');
      }
    }, 22);
    typing = { timer, full };
  }

  function finishTyping() {
    if (!typing) return false;
    clearInterval(typing.timer);
    el.text.textContent = typing.full;
    typing = null;
    el.nextHint.classList.remove('hidden');
    return true;
  }

  // ---------- シーン進行 ----------

  function resolveSceneId(id) {
    let scene = STORY.scenes[id];
    while (scene && scene.pick) {
      id = scene.pick[Math.floor(Math.random() * scene.pick.length)];
      scene = STORY.scenes[id];
    }
    return id;
  }

  function loadScene(id, { burn = true } = {}) {
    if (id === 'ENDING') { ending(); return; }
    id = resolveSceneId(id);
    const scene = STORY.scenes[id];
    state.sceneId = id;
    state.lineIdx = 0;
    state.phase = 'lines';
    el.hudChapter.textContent = scene.chapter;
    el.art.innerHTML = Art.get(scene.art);
    el.choices.classList.add('hidden');
    el.choices.innerHTML = '';
    if (burn) {
      applyBurn();
      if (checkGameOver()) return;
    }
    showLine(scene.lines[0]);
  }

  function currentScene() { return STORY.scenes[state.sceneId]; }

  function advance() {
    if (state.over) return;
    if (finishTyping()) return; // タイプ中なら全文表示だけ

    if (state.phase === 'lines') {
      const scene = currentScene();
      state.lineIdx++;
      if (state.lineIdx < scene.lines.length) {
        showLine(scene.lines[state.lineIdx]);
      } else if (scene.choices && scene.choices.length) {
        showChoices(scene.choices);
      }
    } else if (state.phase === 'result') {
      state.lineIdx++;
      if (state.lineIdx < state.resultLines.length) {
        showLine(state.resultLines[state.lineIdx]);
      } else {
        loadScene(state.nextId);
      }
    }
  }

  function showChoices(choices) {
    state.phase = 'choices';
    el.nextHint.classList.add('hidden');
    el.choices.innerHTML = '';
    choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `${escapeHtml(c.label)}<span class="choice-sub">${escapeHtml(c.sub || '')}</span>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        choose(c);
      });
      el.choices.appendChild(btn);
    });
    el.choices.classList.remove('hidden');
  }

  function choose(choice) {
    el.choices.classList.add('hidden');
    el.choices.innerHTML = '';
    applyFx(choice.fx);
    if (checkGameOver()) return;

    if (choice.result && choice.result.length) {
      state.phase = 'result';
      state.resultLines = choice.result;
      state.nextId = choice.next;
      state.lineIdx = 0;
      showLine(state.resultLines[0]);
    } else {
      loadScene(choice.next);
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // ---------- エンディング ----------

  function summaryHtml() {
    const s = state.stats;
    return `
      <span>最終役職 <b>${STORY.roles[state.roleIdx].name}</b></span>
      <span>社員数 <b>${state.members}人</b></span>
      <span>資金 <b>${s.cash}</b></span>
      <span>事業 <b>${s.biz}</b></span>
      <span>士気 <b>${s.morale}</b></span>
      <span>文化 <b>${s.culture}</b></span>
      <span>成長 <b>${s.skill}</b></span>`;
  }

  function showEndingScreen(art, title, text) {
    state.over = true;
    el.gameScreen.classList.add('hidden');
    el.endingScreen.classList.remove('hidden');
    el.endingArt.innerHTML = Art.get(art);
    el.endingTitle.textContent = title;
    el.endingText.textContent = text;
    el.endingSummary.innerHTML = summaryHtml();
  }

  function ending() {
    const s = state.stats;
    const score = Math.round(s.cash * 0.15 + s.biz * 0.3 + s.morale * 0.2 + s.culture * 0.35);
    const ctx = { ...s, score };
    const order = ['ipo', 'acq', 'steady', 'restart'];
    const key = order.find(k => STORY.endings[k].cond(ctx)) || 'restart';
    const e = STORY.endings[key];
    showEndingScreen(e.art, e.title, `${e.text}\n\n総合スコア:${score}`);
  }

  function gameOver(kind) {
    const g = STORY.gameovers[kind];
    showEndingScreen(g.art, g.title, g.text);
  }

  // ---------- 起動 ----------

  function startGame() {
    state = newState();
    el.titleScreen.classList.add('hidden');
    el.endingScreen.classList.add('hidden');
    el.gameScreen.classList.remove('hidden');
    renderHud();
    loadScene(STORY.start, { burn: false });
  }

  el.titleArt.innerHTML = Art.get('title');
  $('btn-start').addEventListener('click', startGame);
  $('btn-replay').addEventListener('click', startGame);
  el.textbox.addEventListener('click', advance);
  el.art.addEventListener('click', advance);
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !el.gameScreen.classList.contains('hidden')) {
      e.preventDefault();
      advance();
    }
  });
})();
