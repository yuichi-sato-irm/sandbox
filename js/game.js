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
    chapterCard: $('chapter-card'),
    ccDay: $('cc-day'),
    ccTitle: $('cc-title'),
    btnShare: $('btn-share'),
    btnShareLabel: $('btn-share-label'),
    shareHint: $('share-hint'),
    promoLink: $('promo-link'),
    btnBack: $('btn-back'),
    reviewBadge: $('review-badge'),
  };

  const STAT_KEYS = ['cash', 'biz', 'morale', 'culture', 'skill'];
  const STAT_LABEL = { cash: '資金', biz: '事業', morale: '士気', culture: '文化', skill: '成長' };
  const STAT_COLOR = { cash: '#d3a558', biz: '#7da7d4', morale: '#d48a85', culture: '#a995cf', skill: '#8cba93' };
  const COLOR_DOWN = '#d48a85';
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
    chapter() { this.tone(131, 0.9, { type: 'sine', gain: 0.05 }); this.tone(196, 0.9, { when: 0.05, gain: 0.04 }); },
    ending()  { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.6, { when: i * 0.05, gain: 0.05 })); },
    toggle() {
      this.muted = !this.muted;
      localStorage.setItem('ss_muted', this.muted ? '1' : '0');
      updateMuteBtn();
    },
  };

  function updateMuteBtn() {
    if (el.btnMute) el.btnMute.classList.toggle('muted', Sound.muted);
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
      lastChapter: null,
      busyUntil: 0,
      history: [],   // 表示済みメッセージのログ
      reviewIdx: null, // ログ閲覧中の位置(null=最新を表示中)
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
    div.style.top = (62 + slot * 30) + 'px';
    div.style.animationDelay = (slot * 0.09) + 's';
    el.fxLayer.appendChild(div);
    setTimeout(() => div.remove(), 2200 + slot * 90);
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
      popFx(`${STAT_LABEL[k]} ${d > 0 ? '+' : ''}${d}`, d > 0 ? STAT_COLOR[k] : COLOR_DOWN, slot++);
    });
    if (fx.members) {
      state.members = Math.max(1, state.members + fx.members);
      popFx(`社員 ${fx.members > 0 ? '+' : ''}${fx.members}人`, fx.members > 0 ? '#7ec4b8' : COLOR_DOWN, slot++);
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
    popFx(`月次バーン 資金 -${burn}`, '#b9925a', 5);
    renderHud();
  }

  function checkGameOver() {
    if (state.stats.cash <= 0) { gameOver('cash'); return true; }
    if (state.stats.morale <= 0) { gameOver('morale'); return true; }
    return false;
  }

  // ---------- テキスト表示 ----------

  /** メッセージを1件、即時表示する(ログ閲覧・復帰用) */
  function renderLineInstant(line) {
    el.nextHint.classList.add('hidden');
    if (typing) { clearInterval(typing.timer); typing = null; }
    if (line.chat) {
      el.speaker.textContent = '';
      el.text.textContent = '';
      el.chatLine.classList.remove('hidden');
      el.chatLine.innerHTML = `
        <span class="chat-ch">${escapeHtml(line.chat.ch)}</span>
        <span class="chat-user">${escapeHtml(line.chat.user)}</span>
        <span class="chat-text">${termify(line.chat.text)}</span>`;
    } else {
      el.chatLine.classList.add('hidden');
      el.speaker.textContent = line.sp || '';
      el.text.innerHTML = termify(line.t);
    }
  }

  /** ログを1つさかのぼる */
  function goBack() {
    if (state.over || !state.history.length) return;
    if (Date.now() < state.busyUntil) return; // 章タイトルカード表示中は無効
    Sound.ensure();
    hideTermPopover();
    if (typing) { finishTyping(); }
    let idx;
    if (state.reviewIdx === null) {
      // 閲覧モードに入る。選択肢表示中は「直前のメッセージ」から
      idx = state.phase === 'choices' ? state.history.length - 1 : state.history.length - 2;
      if (idx < 0) return;
      el.choices.classList.add('hidden'); // 中身は保持したまま隠す
      el.textbox.classList.add('reviewing');
      el.reviewBadge.classList.remove('hidden');
    } else {
      idx = Math.max(0, state.reviewIdx - 1);
    }
    state.reviewIdx = idx;
    renderLineInstant(state.history[idx]);
    Sound.tone(440, 0.05, { gain: 0.04 });
  }

  /** ログ閲覧中に1つ進む。最新まで来たら通常表示に復帰 */
  function stepForward() {
    const idx = state.reviewIdx + 1;
    if (idx <= state.history.length - 1) {
      state.reviewIdx = idx;
      renderLineInstant(state.history[idx]);
      Sound.tone(520, 0.05, { gain: 0.04 });
      if (idx === state.history.length - 1 && state.phase !== 'choices') restoreLive();
    } else {
      restoreLive();
    }
  }

  /** ログ閲覧を終え、最新の状態に戻す */
  function restoreLive() {
    state.reviewIdx = null;
    el.textbox.classList.remove('reviewing');
    el.reviewBadge.classList.add('hidden');
    const last = state.history[state.history.length - 1];
    if (last) renderLineInstant(last);
    if (state.phase === 'choices') {
      el.choices.classList.remove('hidden');
    } else {
      el.nextHint.classList.remove('hidden');
    }
  }

  function showLine(line) {
    state.history.push(line);
    if (state.history.length > 300) state.history.shift();
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
        <span class="chat-text">${termify(line.chat.text)}</span>`;
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
        el.text.innerHTML = termify(full); // 用語をタップ可能にする
        el.nextHint.classList.remove('hidden');
      }
    }, 22);
    typing = { timer, full };
  }

  function finishTyping() {
    if (!typing) return false;
    clearInterval(typing.timer);
    el.text.innerHTML = termify(typing.full);
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

  function showChapterCard(scene) {
    el.ccDay.textContent = scene.day ? `─ 入社${scene.day}日目 ─` : '';
    el.ccTitle.textContent = scene.chapter;
    el.chapterCard.classList.remove('hidden');
    // アニメーション再発火
    el.chapterCard.style.animation = 'none';
    void el.chapterCard.offsetWidth;
    el.chapterCard.style.animation = '';
    Sound.chapter();
    clearTimeout(showChapterCard._t);
    showChapterCard._t = setTimeout(() => el.chapterCard.classList.add('hidden'), 2150);
  }

  let sceneStartTimer = null;

  function loadScene(id, { burn = true } = {}) {
    if (id === 'ENDING') { ending(); return; }
    clearTimeout(sceneStartTimer);
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

    const begin = () => {
      if (burn) {
        applyBurn();
        if (checkGameOver()) return;
      }
      showLine(state.lines[0]);
    };

    if (scene.chapter !== state.lastChapter) {
      // 新しい章:タイトルカードを見せ切ってから本文を開始する
      state.lastChapter = scene.chapter;
      showChapterCard(scene);
      state.busyUntil = Date.now() + 2050; // カード表示中はクリック無効
      el.speaker.textContent = '';
      el.text.textContent = '';
      el.chatLine.classList.add('hidden');
      el.nextHint.classList.add('hidden');
      sceneStartTimer = setTimeout(begin, 1750); // カードのフェードアウトに合わせて開始
    } else {
      begin();
    }
  }

  function currentScene() { return STORY.scenes[state.sceneId]; }

  function advance() {
    if (state.over) return;
    if (state.reviewIdx !== null) { stepForward(); return; } // ログ閲覧中は閲覧を進める
    if (Date.now() < state.busyUntil) return; // 章タイトルカード表示中
    Sound.ensure();
    hideTermPopover();
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
      btn.style.animationDelay = (i * 0.09) + 's';
      btn.innerHTML = `<span class="c-num">${'一二三四'[i] || i + 1}</span><span>${escapeHtml(c.label)}</span>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        choose(c);
      });
      el.choices.appendChild(btn);
    });
    el.choices.classList.remove('hidden');
  }

  /** 数字キー(1〜4)で選択肢を選ぶ */
  function chooseByIndex(i) {
    if (state.phase !== 'choices') return;
    const btns = el.choices.querySelectorAll('.choice-btn');
    if (btns[i]) btns[i].click();
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

  // ---------- 用語解説(グロッサリー) ----------

  const termRegex = (() => {
    const terms = Object.keys(STORY.glossary)
      .sort((a, b) => b.length - a.length)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(${terms.join('|')})`, 'g');
  })();

  /** 本文中の専門用語を、タップで解説が出る要素に変換する */
  function termify(s) {
    return escapeHtml(s).replace(termRegex, m => `<span class="term" data-term="${m}">${m}</span>`);
  }

  const termPop = document.createElement('div');
  termPop.id = 'term-pop';
  termPop.className = 'hidden';
  document.body.appendChild(termPop);

  function showTermPopover(termEl) {
    const word = termEl.dataset.term;
    const def = STORY.glossary[word];
    if (!def) return;
    termPop.innerHTML = `
      <p class="tp-kicker">用語解説</p>
      <p class="tp-word">${escapeHtml(word)}</p>
      <p class="tp-def">${escapeHtml(def)}</p>`;
    termPop.classList.remove('hidden');
    const r = termEl.getBoundingClientRect();
    const pw = Math.min(330, window.innerWidth - 24);
    termPop.style.width = pw + 'px';
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
    termPop.style.left = left + 'px';
    const ph = termPop.offsetHeight;
    let top = r.top - ph - 10;
    if (top < 8) top = r.bottom + 10;
    termPop.style.top = top + 'px';
    Sound.tone(740, 0.06, { gain: 0.04 });
  }

  let termOpenFor = null;

  function hideTermPopover() {
    termPop.classList.add('hidden');
    termOpenFor = null;
  }

  // 用語クリックを最優先で拾う(物語の進行クリックより先に処理)。
  // ポップアップ表示中のクリックは「閉じる」操作として消費し、話を進めない。
  document.addEventListener('click', e => {
    const t = e.target.closest('.term');
    const popOpen = !termPop.classList.contains('hidden');
    if (t) {
      e.stopPropagation();
      Sound.ensure();
      if (popOpen && termOpenFor === t) {
        hideTermPopover();
      } else {
        showTermPopover(t);
        termOpenFor = t;
      }
    } else if (popOpen) {
      e.stopPropagation();
      hideTermPopover();
    }
  }, true);

  // ---------- エンディング ----------

  function summaryHtml() {
    const s = state.stats;
    const card = (label, value, unit) =>
      `<div class="sum-card"><span class="sum-label">${label}</span><span class="sum-value">${value}${unit ? `<small>${unit}</small>` : ''}</span></div>`;
    return [
      card('最終役職', STORY.roles[state.roleIdx].name),
      card('社員数', state.members, '人'),
      card('資金', s.cash),
      card('事業', s.biz),
      card('士気', s.morale),
      card('文化', s.culture),
      card('成長', s.skill),
    ].join('');
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
          <div class="note-choice">${escapeHtml(entry.label)}</div>
          <div class="note-title">${escapeHtml(entry.review.title)}</div>
          <div class="note-text">${termify(entry.review.text)}</div>
        </div>`;
    }).join('');
    if (extraLesson) {
      items += `
        <div class="note note-final">
          <div class="note-head"><span class="note-verdict v-risk">最大の教訓</span></div>
          <div class="note-text">${termify(extraLesson)}</div>
        </div>`;
    }
    if (!items) return '';
    return `
      <h3 class="notes-title">経営の振り返りノート</h3>
      <p class="notes-lede">あなたが下した決断と、その裏にある経営のセオリー</p>
      ${items}`;
  }

  function showEndingScreen(art, title, text, extraLesson, label = 'EPILOGUE', meta = {}) {
    state.over = true;
    el.gameScreen.classList.add('hidden');
    el.endingScreen.classList.remove('hidden');
    document.querySelector('.ending-label').textContent = label;
    el.endingArt.innerHTML = Art.get(art);
    el.endingTitle.textContent = title;
    el.endingText.textContent = text;
    el.endingSummary.innerHTML = summaryHtml();
    el.endingNotes.innerHTML = notesHtml(extraLesson);
    setupShare(title, meta);
    window.scrollTo(0, 0);
    Sound.ending();
  }

  // ---------- 結果シェアとノート解放 ----------

  const SITE_URL = 'https://startupclass.co.jp/';
  /** シェアに載せるこのゲーム自身のURL(Web配信時は現在地、ローカル実行時は配布元) */
  const GAME_URL = /^https?:$/.test(location.protocol)
    ? location.origin + location.pathname
    : 'https://github.com/yuichi-sato-irm/sandbox';

  function setupShare(title, meta) {
    // ノートをロックし、シェアUIを初期状態に戻す
    el.endingNotes.classList.add('notes-locked');
    el.btnShare.classList.remove('shared');
    el.btnShareLabel.textContent = '結果をシェアする';
    el.shareHint.classList.remove('unlocked');
    el.shareHint.textContent = 'シェアすると「経営の振り返りノート」── 全選択への詳細フィードバックが解放されます';

    // スタクラ案内リンク(UTM付き)
    const cta = new URLSearchParams({
      utm_source: 'startup_story',
      utm_medium: 'game',
      utm_campaign: 'ending_cta',
      utm_content: meta.key || 'unknown',
    });
    el.promoLink.href = `${SITE_URL}?${cta}`;

    // シェア本文(リンクはこのゲーム自身のURL+UTM)
    const share = new URLSearchParams({
      utm_source: 'x',
      utm_medium: 'social',
      utm_campaign: 'startup_story_share',
      utm_content: meta.key || 'unknown',
    });
    const lines = [
      '【STARTUP STORY】社員5人のスタートアップに入社して、私の結末は──',
      `『${title}』`,
      `最終役職:${STORY.roles[state.roleIdx].name} / 社員数:${state.members}人` +
        (meta.score != null ? ` / 総合スコア:${meta.score}` : ''),
      '#スタートアップで働く物語',
      `${GAME_URL}?${share}`,
    ];
    state.shareUrl = 'https://x.com/intent/post?text=' + encodeURIComponent(lines.join('\n'));
  }

  function onShare() {
    window.open(state.shareUrl, '_blank', 'noopener');
    // 実際に投稿されたかは検証しない(押した時点で解放)
    if (el.endingNotes.classList.contains('notes-locked')) {
      el.endingNotes.classList.remove('notes-locked');
      el.btnShare.classList.add('shared');
      el.btnShareLabel.textContent = 'シェアありがとうございます';
      el.shareHint.classList.add('unlocked');
      el.shareHint.textContent = '振り返りノートを解放しました。あなたの全選択へのフィードバックをどうぞ';
      Sound.good();
      setTimeout(() => el.endingNotes.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    }
  }

  function ending() {
    const s = state.stats;
    const score = Math.round(s.cash * 0.15 + s.biz * 0.3 + s.morale * 0.2 + s.culture * 0.35);
    const ctx = { ...s, score, flags: state.flags };
    const order = ['ipo', 'acq', 'steady', 'restart'];
    const key = order.find(k => STORY.endings[k].cond(ctx)) || 'restart';
    const e = STORY.endings[key];
    showEndingScreen(e.art, e.title, `${e.text}\n\n総合スコア:${score}`, null, 'EPILOGUE', { key, score });
  }

  function gameOver(kind) {
    const g = STORY.gameovers[kind];
    showEndingScreen(g.art, g.title, g.text, g.lesson, 'GAME OVER', { key: 'gameover_' + kind });
  }

  // ---------- 起動 ----------

  function startGame() {
    Sound.ensure();
    clearTimeout(sceneStartTimer);
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
  el.btnMute.addEventListener('click', e => { e.stopPropagation(); Sound.ensure(); Sound.toggle(); });
  el.btnShare.addEventListener('click', onShare);
  el.btnBack.addEventListener('click', e => { e.stopPropagation(); goBack(); });
  el.stage.addEventListener('click', advance);
  document.addEventListener('keydown', e => {
    if (el.gameScreen.classList.contains('hidden')) {
      if (e.key === 'Enter' && !el.titleScreen.classList.contains('hidden')) startGame();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      advance();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      goBack();
    } else if (/^[1-4]$/.test(e.key)) {
      chooseByIndex(Number(e.key) - 1);
    }
  });
})();
