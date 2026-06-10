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
    stage: $('stage'),
    art: $('art'),
    fxLayer: $('fx-layer'),
    toast: $('toast'),
    hudChapter: $('hud-chapter'),
    hudDay: $('hud-day'),
    hudRole: $('hud-role'),
    hudMembers: $('hud-members'),
    speaker: $('speaker'),
    text: $('text'),
    chatLine: $('chat-line'),
    nextHint: $('next-hint'),
    choices: $('choices'),
    textbox: $('textbox'),
    endingArt: $('ending-art'),
    endingTitle: $('ending-title'),
    endingText: $('ending-text'),
    endingSummary: $('ending-summary'),
    endingNotes: $('ending-notes'),
    btnMute: $('btn-mute'),
  };

  const STAT_KEYS = ['cash', 'biz', 'morale', 'culture', 'skill'];
  const STAT_LABEL = { cash: '資金', biz: '事業', morale: '士気', culture: '文化', skill: '成長' };
  const STAT_COLOR = { cash: '#f5c542', biz: '#4ea8f5', morale: '#f56b6b', culture: '#9b6bf5', skill: '#4ecd7b' };
  const VERDICT = {
    good:  { mark: '◎', label: '定石',         cls: 'v-good' },
    trade: { mark: '○', label: 'トレードオフ', cls: 'v-trade' },
    risk:  { mark: '△', label: '劇薬',         cls: 'v-risk' },
  };

  let state = null;
  let typing = null; // { timer, full } タイプライター進行中の情報

  // ---------- サウンド(WebAudioで合成・外部ファイル不要) ----------

  const Sound = {
    ctx: null,
    muted: localStorage.getItem('ss_muted') === '1',
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 音なしで続行 */ }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, { type = 'sine', gain = 0.08, when = 0, slide = 0 } = {}) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    },
    tick()    { this.tone(640 + Math.random() * 120, 0.03, { type: 'square', gain: 0.012 }); },
    advance() { this.tone(520, 0.06, { type: 'triangle', gain: 0.05 }); },
    select()  { this.tone(660, 0.09, { gain: 0.07 }); this.tone(990, 0.12, { when: 0.07, gain: 0.06 }); },
    good()    { [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, { when: i * 0.07, gain: 0.06 })); },
    bad()     { this.tone(220, 0.3, { type: 'sawtooth', gain: 0.05, slide: -80 }); },
    promote() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { when: i * 0.11, gain: 0.07 })); },
    alarm()   { [0, 0.25].forEach(w => this.tone(880, 0.18, { type: 'square', gain: 0.03, when: w })); },
    ending()  { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.6, { when: i * 0.05, gain: 0.05 })); },
    toggle() {
      this.muted = !this.muted;
      localStorage.setItem('ss_muted', this.muted ? '1' : '0');
      updateMuteBtn();
    },
  };

  function updateMuteBtn() {
    if (el.btnMute) el.btnMute.textContent = Sound.muted ? '🔇' : '🔊';
  }

  // ---------- 状態 ----------

  function newState() {
    return {
      stats: { cash: 50, biz: 30, morale: 60, culture: 40, skill: 10 },
      members: 5,
      roleIdx: 0,
      flags: {},
      log: [], // {ch, label, review}
      sceneId: null,
      lineIdx: 0,
      lines: [],
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
    let slot = 0, plus = 0, minus = 0;
    STAT_KEYS.forEach(k => {
      const d = fx[k];
      if (!d) return;
      state.stats[k] = clamp(state.stats[k] + d);
      d > 0 ? plus++ : minus++;
      popFx(`${STAT_LABEL[k]} ${d > 0 ? '+' : ''}${d}`, d > 0 ? STAT_COLOR[k] : '#ff9d9d', slot++);
    });
    if (fx.members) {
      state.members = Math.max(1, state.members + fx.members);
      popFx(`社員 ${fx.members > 0 ? '+' : ''}${fx.members}人`, fx.members > 0 ? '#9fe8e2' : '#ff9d9d', slot++);
    }
    if (plus || minus) (plus >= minus ? Sound.good() : Sound.bad());
    const newRole = roleFor(state.stats.skill);
    if (newRole > state.roleIdx) {
      state.roleIdx = newRole;
      setTimeout(() => {
        showToast(`🎉 昇進! ${STORY.roles[newRole].name} になった`);
        Sound.promote();
      }, 800);
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
    el.nextHint.classList.add('hidden');
    if (typing) { clearInterval(typing.timer); typing = null; }

    if (line.chat) {
      // Slack風チャット演出
      el.speaker.textContent = '';
      el.text.textContent = '';
      el.chatLine.classList.remove('hidden');
      el.chatLine.innerHTML = `
        <span class="chat-ch">${escapeHtml(line.chat.ch)}</span>
        <span class="chat-user">${escapeHtml(line.chat.user)}</span>
        <span class="chat-text">${escapeHtml(line.chat.text)}</span>`;
      Sound.tone(880, 0.07, { gain: 0.05 }); Sound.tone(1175, 0.1, { when: 0.06, gain: 0.04 });
      el.nextHint.classList.remove('hidden');
      return;
    }

    el.chatLine.classList.add('hidden');
    el.speaker.textContent = line.sp || '';
    el.text.textContent = '';
    const full = line.t;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.text.textContent = full.slice(0, i);
      if (i % 3 === 0) Sound.tick();
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

  function resolveNext(next) {
    return typeof next === 'function' ? next(state) : next;
  }

  function setSceneFx(fx) {
    el.stage.classList.remove('fx-storm');
    if (fx === 'storm') el.stage.classList.add('fx-storm');
    if (fx === 'shake' || fx === 'storm') {
      el.stage.classList.remove('fx-shake');
      void el.stage.offsetWidth; // アニメ再発火のためのreflow
      el.stage.classList.add('fx-shake');
    }
    if (fx === 'alarm') Sound.alarm();
  }

  function loadScene(id, { burn = true } = {}) {
    if (id === 'ENDING') { ending(); return; }
    id = resolveSceneId(id);
    const scene = STORY.scenes[id];
    state.sceneId = id;
    state.lineIdx = 0;
    state.phase = 'lines';
    state.lines = scene.lines.filter(l => !l.if || l.if(state));
    el.hudChapter.textContent = scene.chapter;
    el.hudDay.textContent = scene.day ? `入社${scene.day}日目` : '';
    el.art.innerHTML = Art.get(scene.art);
    el.art.classList.remove('scene-enter');
    void el.art.offsetWidth;
    el.art.classList.add('scene-enter');
    setSceneFx(scene.sceneFx);
    el.choices.classList.add('hidden');
    el.choices.innerHTML = '';
    if (burn) {
      applyBurn();
      if (checkGameOver()) return;
    }
    showLine(state.lines[0]);
  }

  function currentScene() { return STORY.scenes[state.sceneId]; }

  function advance() {
    if (state.over) return;
    Sound.ensure();
    if (finishTyping()) return; // タイプ中なら全文表示だけ

    if (state.phase === 'lines') {
      state.lineIdx++;
      if (state.lineIdx < state.lines.length) {
        Sound.advance();
        showLine(state.lines[state.lineIdx]);
      } else {
        const scene = currentScene();
        if (scene.choices && scene.choices.length) showChoices(scene.choices);
      }
    } else if (state.phase === 'result') {
      state.lineIdx++;
      if (state.lineIdx < state.resultLines.length) {
        Sound.advance();
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
    choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.style.animationDelay = (i * 0.1) + 's';
      btn.innerHTML = escapeHtml(c.label);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        choose(c);
      });
      el.choices.appendChild(btn);
    });
    el.choices.classList.remove('hidden');
  }

  function choose(choice) {
    Sound.ensure();
    Sound.select();
    el.choices.classList.add('hidden');
    el.choices.innerHTML = '';

    if (choice.flags) Object.assign(state.flags, choice.flags);
    if (choice.review) {
      state.log.push({ ch: currentScene().chapter, label: choice.label, review: choice.review });
    }
    applyFx(choice.fx);
    if (checkGameOver()) return;

    const nextId = resolveNext(choice.next);
    const resultLines = (choice.result || []).filter(l => !l.if || l.if(state));
    if (resultLines.length) {
      state.phase = 'result';
      state.resultLines = resultLines;
      state.nextId = nextId;
      state.lineIdx = 0;
      showLine(state.resultLines[0]);
    } else {
      loadScene(nextId);
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

  function notesHtml(extraLesson) {
    let items = state.log.map(entry => {
      const v = VERDICT[entry.review.v] || VERDICT.trade;
      return `
        <div class="note">
          <div class="note-head">
            <span class="note-ch">${escapeHtml(entry.ch)}</span>
            <span class="note-verdict ${v.cls}">${v.mark} ${v.label}</span>
          </div>
          <div class="note-choice">▶ ${escapeHtml(entry.label)}</div>
          <div class="note-title">${escapeHtml(entry.review.title)}</div>
          <div class="note-text">${escapeHtml(entry.review.text)}</div>
        </div>`;
    }).join('');
    if (extraLesson) {
      items += `
        <div class="note note-final">
          <div class="note-head"><span class="note-verdict v-risk">✦ 最大の教訓</span></div>
          <div class="note-text">${escapeHtml(extraLesson)}</div>
        </div>`;
    }
    if (!items) return '';
    return `<h3 class="notes-title">📓 経営の振り返りノート ─ あなたの選択と、その意味</h3>${items}`;
  }

  function showEndingScreen(art, title, text, extraLesson) {
    state.over = true;
    el.gameScreen.classList.add('hidden');
    el.endingScreen.classList.remove('hidden');
    el.endingArt.innerHTML = Art.get(art);
    el.endingTitle.textContent = title;
    el.endingText.textContent = text;
    el.endingSummary.innerHTML = summaryHtml();
    el.endingNotes.innerHTML = notesHtml(extraLesson);
    el.endingScreen.scrollTop = 0;
    Sound.ending();
  }

  function ending() {
    const s = state.stats;
    const score = Math.round(s.cash * 0.15 + s.biz * 0.3 + s.morale * 0.2 + s.culture * 0.35);
    const ctx = { ...s, score, flags: state.flags };
    const order = ['ipo', 'acq', 'steady', 'restart'];
    const key = order.find(k => STORY.endings[k].cond(ctx)) || 'restart';
    const e = STORY.endings[key];
    showEndingScreen(e.art, e.title, `${e.text}\n\n総合スコア:${score}`);
  }

  function gameOver(kind) {
    const g = STORY.gameovers[kind];
    showEndingScreen(g.art, g.title, g.text, g.lesson);
  }

  // ---------- 起動 ----------

  function startGame() {
    Sound.ensure();
    state = newState();
    el.titleScreen.classList.add('hidden');
    el.endingScreen.classList.add('hidden');
    el.gameScreen.classList.remove('hidden');
    renderHud();
    loadScene(STORY.start, { burn: false });
  }

  el.titleArt.innerHTML = Art.get('title');
  updateMuteBtn();
  $('btn-start').addEventListener('click', startGame);
  $('btn-replay').addEventListener('click', startGame);
  el.btnMute.addEventListener('click', e => { e.stopPropagation(); Sound.toggle(); });
  el.textbox.addEventListener('click', advance);
  el.art.addEventListener('click', advance);
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !el.gameScreen.classList.contains('hidden')) {
      e.preventDefault();
      advance();
    }
  });
})();
