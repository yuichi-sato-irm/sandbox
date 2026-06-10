/* ============================================================
   art.js ─ アドベンチャーゲーム風のシーンイラスト(SVG)生成
   各シーンは 800x450 の viewBox を持つ SVG 文字列を返す。
   ============================================================ */

const Art = (() => {

  // ---------- 共通パーツ ----------

  const SKINS  = ['#f6c9a0', '#ecb98c', '#ffd9b3', '#d9a578'];
  const HAIRS  = ['#3a2e2a', '#1f1a17', '#5b4632', '#7a5c3e', '#2e3445', '#8c4a3c'];
  const SHIRTS = ['#4a7fd9', '#4ecdc4', '#e9806e', '#9b6bf5', '#f5c542', '#6dbf63', '#e76fa3', '#7f8db8'];
  const PANTS  = ['#37415c', '#4a4a55', '#5c5046', '#2e3445'];

  // 疑似乱数(シードつき・描画を毎回同じにするため)
  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  }

  /**
   * 立ち姿の人物。足元が (x, y)。身長約 130 * s。
   * mood: 'happy' | 'sad' | 'neutral' | 'angry'
   */
  function person({ x = 0, y = 0, s = 1, skin = SKINS[0], hair = HAIRS[0],
                    shirt = SHIRTS[0], pants = PANTS[0],
                    mood = 'happy', wave = false, longHair = false }) {
    const mouth = {
      happy:   `<path d="M-5,-107 Q0,-102 5,-107" stroke="#5a3b2e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      sad:     `<path d="M-5,-104 Q0,-109 5,-104" stroke="#5a3b2e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      neutral: `<path d="M-4,-105 L4,-105" stroke="#5a3b2e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      angry:   `<path d="M-4,-104 L4,-106" stroke="#5a3b2e" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    }[mood] || '';
    const brows = mood === 'angry'
      ? `<path d="M-9,-122 L-3,-119 M9,-122 L3,-119" stroke="#5a3b2e" stroke-width="2" stroke-linecap="round"/>`
      : mood === 'sad'
      ? `<path d="M-9,-119 L-3,-121 M9,-119 L3,-121" stroke="#5a3b2e" stroke-width="2" stroke-linecap="round"/>`
      : '';
    const rightArm = wave
      ? `<g class="anim-wave">
           <rect x="17" y="-132" width="9" height="40" rx="4.5" fill="${shirt}" transform="rotate(30 21.5 -92)"/>
           <circle cx="41" cy="-127" r="5" fill="${skin}"/>
         </g>`
      : `<rect x="17" y="-96" width="9" height="40" rx="4.5" fill="${shirt}"/>
         <circle cx="21.5" cy="-56" r="5" fill="${skin}"/>`;
    const sideHair = longHair
      ? `<rect x="-21" y="-122" width="9" height="30" rx="4.5" fill="${hair}"/>
         <rect x="12" y="-122" width="9" height="30" rx="4.5" fill="${hair}"/>`
      : '';
    const bobDelay = (-Math.random() * 2.6).toFixed(2);
    const blinkDelay = (-Math.random() * 4).toFixed(2);
    return `
    <g transform="translate(${x},${y}) scale(${s})">
      <ellipse cx="0" cy="2" rx="26" ry="6" fill="rgba(0,0,0,.18)"/>
      <rect x="-14" y="-46" width="11" height="46" rx="5" fill="${pants}"/>
      <rect x="3"   y="-46" width="11" height="46" rx="5" fill="${pants}"/>
      <g class="anim-bob" style="animation-delay:${bobDelay}s">
        <rect x="-19" y="-100" width="38" height="58" rx="14" fill="${shirt}"/>
        <rect x="-26" y="-96" width="9" height="40" rx="4.5" fill="${shirt}"/>
        <circle cx="-21.5" cy="-56" r="5" fill="${skin}"/>
        ${rightArm}
        ${sideHair}
        <circle cx="0" cy="-114" r="17" fill="${skin}"/>
        <path d="M-17,-114 a17,17 0 0 1 34,0 z" fill="${hair}"/>
        <g class="anim-blink" style="animation-delay:${blinkDelay}s">
          <circle cx="-6" cy="-112" r="2" fill="#3b2b22"/>
          <circle cx="6"  cy="-112" r="2" fill="#3b2b22"/>
        </g>
        ${brows}${mouth}
      </g>
    </g>`;
  }

  /** 机の前に座る人物(机より奥に描き、手前に机を描くこと)。机上面の高さ deskY を渡す */
  function sittingPerson(opt) {
    // 立ち絵を少し沈めて座っているように見せる
    return person(Object.assign({}, opt, { y: opt.y + 34 }));
  }

  /** 机(上面 y、幅 w、中心 x) */
  function desk(x, y, w, color = '#8a6d4f', front = '#6e563d') {
    return `
      <rect x="${x - w / 2}" y="${y}" width="${w}" height="12" rx="5" fill="${color}"/>
      <rect x="${x - w / 2 + 8}" y="${y + 12}" width="${w - 16}" height="52" fill="${front}"/>`;
  }

  /** ノートPC(中心 x、置き面 y) */
  function laptop(x, y, lid = '#dfe6f5', glow = '#bcd6ff') {
    return `
      <rect x="${x - 17}" y="${y - 24}" width="34" height="23" rx="2.5" fill="#3c4664"/>
      <rect class="anim-glow" style="animation-delay:${(-Math.random() * 3).toFixed(2)}s"
        x="${x - 14}" y="${y - 21}" width="28" height="17" fill="${glow}"/>
      <path d="M${x - 21},${y - 1} L${x + 21},${y - 1} L${x + 25},${y + 5} L${x - 25},${y + 5} Z" fill="${lid}"/>`;
  }

  /** 窓+都会の景色。sky: 'day' | 'evening' | 'night' | 'dawn' | 'rain' */
  function windowView(x, y, w, h, sky = 'day') {
    const skies = {
      day:     ['#9fd8ff', '#d9f0ff'],
      evening: ['#ff9d6e', '#ffd9a0'],
      night:   ['#1b2350', '#324178'],
      dawn:    ['#ffb6c1', '#ffe8c2'],
      rain:    ['#5b6478', '#8b95ab'],
    };
    const [c1, c2] = skies[sky] || skies.day;
    const gid = `sky_${sky}_${x}`;
    const r = rng(x * 7 + w);
    let buildings = '';
    let bx = x + 8;
    while (bx < x + w - 24) {
      const bw = 18 + r() * 26;
      const bh = h * (0.3 + r() * 0.45);
      const dark = sky === 'night' || sky === 'rain';
      buildings += `<rect x="${bx}" y="${y + h - bh - 6}" width="${bw}" height="${bh}" rx="2"
        fill="${dark ? '#222a4d' : '#7fa8cc'}" opacity=".85"/>`;
      if (dark) {
        for (let i = 0; i < 4; i++) {
          buildings += `<rect x="${bx + 3 + r() * (bw - 8)}" y="${y + h - bh + r() * (bh - 14)}"
            width="4" height="5" fill="#ffd97a" opacity="${0.5 + r() * 0.5}"/>`;
        }
      }
      bx += bw + 7;
    }
    const celestial = sky === 'night'
      ? `<circle cx="${x + w - 46}" cy="${y + 34}" r="15" fill="#fff7d6"/>
         <circle cx="${x + w - 52}" cy="${y + 30}" r="13" fill="${c1}"/>`
      : sky === 'rain' ? ''
      : `<circle cx="${x + w - 46}" cy="${y + 36}" r="16" fill="${sky === 'evening' || sky === 'dawn' ? '#ff7e5f' : '#ffe28a'}"/>`;
    let rain = '';
    if (sky === 'rain') {
      const rr = rng(99);
      for (let i = 0; i < 26; i++) {
        rain += `<line class="anim-rain" style="animation-delay:${(-rr() * 0.7).toFixed(2)}s"
          x1="${x + 6 + rr() * (w - 12)}" y1="${y + 6 + rr() * (h - 30)}"
          x2="${x + 2 + rr() * (w - 12)}" y2="${y + 22 + rr() * (h - 30)}"
          stroke="#cfe2ff" stroke-width="1.6" opacity=".55"/>`;
      }
    }
    return `
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient></defs>
      <rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="10" fill="#39415f"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#${gid})"/>
      ${celestial}${buildings}${rain}
      <rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="#39415f"/>`;
  }

  /** ホワイトボード */
  function whiteboard(x, y, w, h, content = '') {
    return `
      <rect x="${x - 7}" y="${y - 7}" width="${w + 14}" height="${h + 14}" rx="8" fill="#aab3cf"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#fcfdff"/>
      <rect x="${x + w / 2 - 30}" y="${y + h + 7}" width="60" height="7" rx="3" fill="#8b94b3"/>
      <rect x="${x + w / 2 - 4}" y="${y + h + 14}" width="8" height="26" fill="#8b94b3"/>
      ${content}`;
  }

  /** 観葉植物 */
  function plant(x, y, s = 1) {
    return `<g transform="translate(${x},${y}) scale(${s})">
      <path d="M-14,0 L14,0 L10,26 L-10,26 Z" fill="#b8643f"/>
      <path d="M0,-2 C-20,-16 -16,-44 -4,-50 C-2,-30 -2,-16 0,-2 Z" fill="#4f9e58"/>
      <path d="M0,-2 C20,-16 16,-44 4,-50 C2,-30 2,-16 0,-2 Z" fill="#63b56b"/>
      <path d="M-1,-4 C-3,-26 2,-44 1,-58 C8,-44 6,-20 1,-4 Z" fill="#3d8a48"/>
    </g>`;
  }

  /** 紙吹雪 */
  function confetti(seed, n = 60) {
    const r = rng(seed);
    const colors = ['#f5c542', '#4ecdc4', '#e9806e', '#9b6bf5', '#6dbf63', '#ff8fb3'];
    let out = '';
    for (let i = 0; i < n; i++) {
      const cx = r() * 800, cy = r() * 420, rot = r() * 360;
      out += `<g class="anim-fall" style="animation-duration:${(3.5 + r() * 4).toFixed(2)}s;animation-delay:${(-r() * 7).toFixed(2)}s">
        <rect x="${cx}" y="${cy}" width="${5 + r() * 6}" height="${3 + r() * 4}"
        fill="${colors[(i % colors.length)]}" transform="rotate(${rot} ${cx} ${cy})" opacity=".9"/></g>`;
    }
    return out;
  }

  /** 床と壁(オフィス共通の背景) */
  function room(wall = '#e8e2d6', floor = '#cdb89a', floorH = 110) {
    return `
      <rect x="0" y="0" width="800" height="450" fill="${wall}"/>
      <rect x="0" y="${450 - floorH}" width="800" height="${floorH}" fill="${floor}"/>
      <line x1="0" y1="${450 - floorH}" x2="800" y2="${450 - floorH}" stroke="rgba(0,0,0,.12)" stroke-width="3"/>`;
  }

  function svgWrap(inner) {
    return `<svg viewBox="0 0 800 450" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  }

  /** 群衆(座席なし・立ち見) */
  function crowd(seed, n, baseY, minX, maxX, sMin = 0.55, sMax = 0.8, mood = 'happy') {
    const r = rng(seed);
    let out = '';
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({
        x: minX + r() * (maxX - minX),
        y: baseY - r() * 40,
        s: sMin + r() * (sMax - sMin),
        skin: SKINS[(r() * SKINS.length) | 0],
        hair: HAIRS[(r() * HAIRS.length) | 0],
        shirt: SHIRTS[(r() * SHIRTS.length) | 0],
        pants: PANTS[(r() * PANTS.length) | 0],
        mood,
        wave: r() > 0.7,
        longHair: r() > 0.6,
      });
    }
    list.sort((a, b) => a.y - b.y); // 奥から手前へ
    list.forEach(p => { out += person(p); });
    return out;
  }

  // ---------- 各シーン ----------

  const scenes = {

    /** タイトル:夜明けの街とロケット */
    title() {
      const r = rng(42);
      let stars = '';
      for (let i = 0; i < 40; i++) {
        stars += `<circle class="anim-twinkle" style="animation-delay:${(-r() * 3).toFixed(2)}s"
          cx="${r() * 800}" cy="${r() * 220}" r="${0.8 + r() * 1.6}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`;
      }
      let buildings = '';
      let bx = -10;
      while (bx < 820) {
        const bw = 40 + r() * 70, bh = 80 + r() * 150;
        buildings += `<rect x="${bx}" y="${450 - bh}" width="${bw}" height="${bh}" fill="#1b2240"/>`;
        for (let i = 0; i < 8; i++) {
          buildings += `<rect x="${bx + 5 + r() * (bw - 14)}" y="${450 - bh + 8 + r() * (bh - 24)}" width="7" height="9" fill="#ffd97a" opacity="${0.35 + r() * 0.65}"/>`;
        }
        bx += bw + 14;
      }
      return svgWrap(`
        <defs><linearGradient id="tSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#141a3d"/><stop offset=".6" stop-color="#3c2f63"/><stop offset="1" stop-color="#c2547a"/>
        </linearGradient></defs>
        <rect width="800" height="450" fill="url(#tSky)"/>
        ${stars}
        <circle cx="640" cy="300" r="46" fill="#ffd9a0" opacity=".9"/>
        ${buildings}
        <g class="anim-float">
        <g transform="translate(400,250) rotate(-18)">
          <path d="M0,-90 C26,-56 26,10 16,46 L-16,46 C-26,10 -26,-56 0,-90 Z" fill="#eef2ff"/>
          <path d="M0,-90 C10,-70 14,-40 14,-10 L-14,-10 C-14,-40 -10,-70 0,-90 Z" fill="#d6ddf5"/>
          <circle cx="0" cy="-22" r="13" fill="#4ecdc4"/>
          <circle cx="0" cy="-22" r="8" fill="#bff3ef"/>
          <path d="M-16,18 C-36,28 -38,50 -38,58 L-16,46 Z" fill="#e9806e"/>
          <path d="M16,18 C36,28 38,50 38,58 L16,46 Z" fill="#e9806e"/>
          <g class="anim-flicker">
            <path d="M-10,48 C-6,72 6,72 10,48 Z" fill="#ffb13d"/>
            <path d="M-5,50 C-2,84 2,84 5,50 Z" fill="#ff7043"/>
          </g>
        </g>
        </g>
      `);
    },

    /** 第1章:小さなオフィスへの入社初日 */
    office_small() {
      return svgWrap(`
        ${room('#efe9dc', '#d4bf9f')}
        ${windowView(60, 50, 300, 170, 'day')}
        <rect x="430" y="60" width="150" height="44" rx="8" fill="#4ecdc4"/>
        <text x="505" y="89" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">NOVA WORKS</text>
        ${plant(740, 412, 1.2)}
        ${sittingPerson({ x: 250, y: 330, s: .92, shirt: '#7f8db8', hair: '#5b4632', mood: 'happy' })}
        ${sittingPerson({ x: 480, y: 330, s: .92, shirt: '#6dbf63', hair: '#1f1a17', longHair: true, mood: 'happy' })}
        ${desk(360, 330, 380)}
        ${laptop(250, 330)}
        ${laptop(480, 330)}
        ${person({ x: 640, y: 430, s: 1.06, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, wave: true, mood: 'happy' })}
        ${person({ x: 95, y: 442, s: 1.1, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy' })}
      `);
    },

    /** 第2章:深夜の開発・障害対応 */
    crunch() {
      return svgWrap(`
        ${room('#2b3046', '#3a4060')}
        ${windowView(470, 50, 280, 160, 'night')}
        <circle cx="180" cy="60" r="26" fill="#ffe9b0" opacity=".25"/>
        <circle cx="180" cy="60" r="13" fill="#ffe9b0"/>
        <rect x="178" y="0" width="4" height="48" fill="#555d80"/>
        ${sittingPerson({ x: 200, y: 340, s: .98, shirt: '#4a7fd9', hair: '#2e3445', mood: 'neutral' })}
        ${sittingPerson({ x: 420, y: 340, s: .98, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'sad' })}
        ${desk(320, 340, 420, '#5d6585', '#4a5170')}
        ${laptop(200, 340, '#aeb9d6', '#ff8a8a')}
        ${laptop(420, 340, '#aeb9d6', '#9fd8ff')}
        <text class="anim-alert" x="105" y="295" font-size="17" fill="#ff8a8a" text-anchor="middle" font-family="monospace" font-weight="bold">ERROR!</text>
        <g transform="translate(620,365)">
          <path d="M-20,0 L20,0 L16,40 L-16,40 Z" fill="#caa56e"/>
          <path d="M-20,0 L20,0 L18,12 L-18,12 Z" fill="#b8915a"/>
          <text x="0" y="-8" font-size="13" fill="#cfd6f2" text-anchor="middle" font-family="sans-serif">出前の箱</text>
        </g>
        ${plant(740, 430, 1)}
      `);
    },

    /** 第3章:投資家へのピッチ */
    pitch() {
      return svgWrap(`
        ${room('#e3e8f2', '#b9c2d8')}
        <rect x="80" y="44" width="330" height="200" rx="8" fill="#1d2440"/>
        <rect x="92" y="56" width="306" height="176" fill="#f6f9ff"/>
        <polyline points="120,200 180,170 240,180 300,120 370,84" fill="none" stroke="#4ea8f5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M348,84 L376,78 L368,106 Z" fill="#4ea8f5"/>
        <text x="245" y="78" font-size="17" font-weight="bold" fill="#1d2440" text-anchor="middle" font-family="sans-serif">GROWTH PLAN</text>
        ${person({ x: 480, y: 430, s: 1.05, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy', wave: true })}
        ${person({ x: 360, y: 438, s: 1.0, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy' })}
        ${sittingPerson({ x: 620, y: 348, s: .95, shirt: '#5c5046', hair: '#7a5c3e', mood: 'neutral' })}
        ${sittingPerson({ x: 730, y: 348, s: .95, shirt: '#2e3445', hair: '#1f1a17', mood: 'neutral' })}
        ${desk(675, 348, 230, '#9d9d9d', '#808080')}
        <rect x="600" y="320" width="44" height="28" rx="3" fill="#fff" stroke="#aab" stroke-width="2"/>
        ${plant(60, 430, 1.1)}
      `);
    },

    /** 第4章:採用・仲間が増える */
    hiring() {
      return svgWrap(`
        ${room('#efe9dc', '#d4bf9f')}
        ${windowView(500, 46, 250, 150, 'day')}
        <rect x="70" y="56" width="240" height="60" rx="10" fill="#ffb13d"/>
        <text x="190" y="94" font-size="26" font-weight="bold" fill="#5a3b00" text-anchor="middle" font-family="sans-serif">WELCOME!</text>
        <path d="M70,116 l30,0 0,14 -30,0z M310,116 l-30,0 0,14 30,0z" fill="#e8932c"/>
        ${crowd(7, 6, 400, 80, 420, .6, .85, 'happy')}
        ${person({ x: 560, y: 438, s: 1.05, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy', wave: true })}
        ${person({ x: 680, y: 432, s: 1.0, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy', wave: true })}
        ${plant(40, 430, 1)}
      `);
    },

    /** 第5章:KPI設計(ホワイトボードとツリー) */
    kpi() {
      const tree = `
        <rect x="225" y="70" width="110" height="30" rx="6" fill="#4ea8f5"/>
        <text x="280" y="91" font-size="15" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">North Star</text>
        <line x1="280" y1="100" x2="200" y2="130" stroke="#9aa" stroke-width="2.5"/>
        <line x1="280" y1="100" x2="360" y2="130" stroke="#9aa" stroke-width="2.5"/>
        <rect x="150" y="130" width="100" height="26" rx="6" fill="#4ecdc4"/>
        <text x="200" y="148" font-size="13" fill="#fff" text-anchor="middle" font-family="sans-serif">継続率</text>
        <rect x="310" y="130" width="100" height="26" rx="6" fill="#4ecdc4"/>
        <text x="360" y="148" font-size="13" fill="#fff" text-anchor="middle" font-family="sans-serif">新規獲得</text>
        <line x1="200" y1="156" x2="160" y2="184" stroke="#9aa" stroke-width="2"/>
        <line x1="200" y1="156" x2="240" y2="184" stroke="#9aa" stroke-width="2"/>
        <line x1="360" y1="156" x2="400" y2="184" stroke="#9aa" stroke-width="2"/>
        <rect x="120" y="184" width="80" height="22" rx="5" fill="#ffd27a"/>
        <rect x="210" y="184" width="80" height="22" rx="5" fill="#ffd27a"/>
        <rect x="362" y="184" width="80" height="22" rx="5" fill="#ffd27a"/>
        <polyline points="470,200 510,170 540,180 575,140" fill="none" stroke="#e9806e" stroke-width="4" stroke-linecap="round"/>
        <text x="522" y="125" font-size="14" fill="#e9806e" text-anchor="middle" font-family="sans-serif" font-weight="bold">KPI</text>`;
      return svgWrap(`
        ${room('#eef2f7', '#c2cadd')}
        ${whiteboard(105, 46, 510, 190, tree)}
        ${person({ x: 680, y: 420, s: 1.05, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy', wave: true })}
        ${person({ x: 130, y: 432, s: .95, shirt: '#9b6bf5', hair: '#5b4632', mood: 'neutral' })}
        ${person({ x: 250, y: 442, s: 1.0, shirt: '#6dbf63', hair: '#1f1a17', longHair: true, mood: 'happy' })}
        ${person({ x: 420, y: 438, s: .98, shirt: '#f5c542', hair: '#7a5c3e', mood: 'neutral' })}
        ${plant(760, 430, 1)}
      `);
    },

    /** 第6章:MVV策定ワークショップ */
    mvv() {
      const board = `
        <text x="360" y="92" font-size="26" font-weight="900" fill="#9b6bf5" text-anchor="middle" font-family="sans-serif">MISSION</text>
        <text x="360" y="130" font-size="26" font-weight="900" fill="#4ea8f5" text-anchor="middle" font-family="sans-serif">VISION</text>
        <text x="360" y="168" font-size="26" font-weight="900" fill="#4ecdc4" text-anchor="middle" font-family="sans-serif">VALUE</text>
        <rect x="480" y="74" width="56" height="32" rx="4" fill="#fff3a8" transform="rotate(-6 508 90)"/>
        <rect x="540" y="110" width="56" height="32" rx="4" fill="#ffd1e0" transform="rotate(5 568 126)"/>
        <rect x="478" y="148" width="56" height="32" rx="4" fill="#c9f0d8" transform="rotate(-4 506 164)"/>
        <rect x="160" y="80" width="56" height="32" rx="4" fill="#cfe2ff" transform="rotate(7 188 96)"/>
        <rect x="150" y="138" width="56" height="32" rx="4" fill="#ffe2c2" transform="rotate(-7 178 154)"/>`;
      return svgWrap(`
        ${room('#f4ecdf', '#d8c4a4')}
        ${whiteboard(120, 50, 480, 170, board)}
        ${plant(60, 426, 1.1)}
        ${sittingPerson({ x: 250, y: 360, s: .9, shirt: '#6dbf63', hair: '#1f1a17', longHair: true, mood: 'happy' })}
        ${sittingPerson({ x: 370, y: 360, s: .9, shirt: '#f5c542', hair: '#7a5c3e', mood: 'happy' })}
        ${sittingPerson({ x: 490, y: 360, s: .9, shirt: '#9b6bf5', hair: '#2e3445', mood: 'happy' })}
        ${desk(370, 360, 330, '#a98e68', '#8a7050')}
        ${person({ x: 690, y: 426, s: 1.05, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy', wave: true })}
      `);
    },

    /** 突発イベント:メディア取材 */
    media() {
      return svgWrap(`
        ${room('#efe9dc', '#d4bf9f')}
        ${windowView(60, 50, 260, 160, 'day')}
        ${person({ x: 300, y: 436, s: 1.05, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy' })}
        ${person({ x: 430, y: 440, s: 1.02, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy' })}
        <g transform="translate(620,300)">
          <rect x="-30" y="-26" width="64" height="46" rx="8" fill="#33384f"/>
          <circle cx="-30" cy="-3" r="20" fill="#22263a"/>
          <circle cx="-30" cy="-3" r="12" fill="#5fa8ff"/>
          <rect x="14" y="-42" width="14" height="16" fill="#33384f"/>
        </g>
        ${person({ x: 660, y: 442, s: 1.0, shirt: '#5c5046', hair: '#1f1a17', mood: 'neutral' })}
        <rect x="380" y="80" width="180" height="48" rx="10" fill="#fff" stroke="#ccc" stroke-width="2"/>
        <text x="470" y="111" font-size="20" font-weight="bold" fill="#e9466e" text-anchor="middle" font-family="sans-serif">取材中 ● REC</text>
        ${plant(80, 430, 1)}
      `);
    },

    /** 第7章:1on1・評価制度 */
    one_on_one() {
      return svgWrap(`
        ${room('#e9eef7', '#bfc9de')}
        ${windowView(480, 50, 270, 160, 'evening')}
        <rect x="80" y="70" width="280" height="150" rx="10" fill="#fcfdff" stroke="#aab3cf" stroke-width="5"/>
        <text x="220" y="115" font-size="20" font-weight="bold" fill="#39415f" text-anchor="middle" font-family="sans-serif">評価制度 v1.0</text>
        <rect x="110" y="135" width="90" height="14" rx="7" fill="#4ecd7b"/>
        <rect x="110" y="160" width="150" height="14" rx="7" fill="#4ea8f5"/>
        <rect x="110" y="185" width="120" height="14" rx="7" fill="#f5c542"/>
        <text x="280" y="148" font-size="12" fill="#39415f" font-family="sans-serif">Grade</text>
        <text x="280" y="173" font-size="12" fill="#39415f" font-family="sans-serif">OKR</text>
        <text x="250" y="198" font-size="12" fill="#39415f" font-family="sans-serif">360°</text>
        ${sittingPerson({ x: 320, y: 372, s: .95, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy' })}
        ${sittingPerson({ x: 480, y: 372, s: .95, shirt: '#6dbf63', hair: '#5b4632', longHair: true, mood: 'sad' })}
        ${desk(400, 372, 240, '#a98e68', '#8a7050')}
        ${laptop(360, 372)}
        ${plant(740, 430, 1.1)}
      `);
    },

    /** 第8章:シリーズA・大きな契約 */
    seriesA() {
      return svgWrap(`
        ${room('#e3e8f2', '#b9c2d8')}
        ${windowView(280, 40, 440, 170, 'day')}
        ${person({ x: 320, y: 438, s: 1.08, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy' })}
        ${person({ x: 470, y: 438, s: 1.08, shirt: '#2e3445', hair: '#7a5c3e', mood: 'happy' })}
        <rect x="358" y="330" width="76" height="12" rx="6" fill="#f6c9a0"/>
        <g transform="translate(150,290)">
          <rect x="-44" y="-30" width="88" height="60" rx="8" fill="#f5c542"/>
          <rect x="-44" y="-30" width="88" height="60" rx="8" fill="none" stroke="#caa028" stroke-width="4"/>
          <text x="0" y="9" font-size="26" font-weight="900" fill="#7a5800" text-anchor="middle" font-family="sans-serif">¥</text>
        </g>
        <text x="150" y="350" font-size="17" font-weight="bold" fill="#39415f" text-anchor="middle" font-family="sans-serif">Series A</text>
        ${confetti(11, 30)}
        ${plant(740, 430, 1.1)}
      `);
    },

    /** 第9章:全社オールハンズ・カルチャー浸透 */
    allhands() {
      return svgWrap(`
        ${room('#2e3450', '#454c70', 130)}
        <rect x="170" y="40" width="460" height="120" rx="10" fill="#1d2440"/>
        <text x="400" y="92" font-size="30" font-weight="900" fill="#ffd27a" text-anchor="middle" font-family="sans-serif">ALL HANDS</text>
        <text x="400" y="130" font-size="17" fill="#9fe8e2" text-anchor="middle" font-family="sans-serif">Mission / Vision / Value</text>
        <rect x="330" y="208" width="140" height="14" rx="7" fill="#555d80"/>
        ${person({ x: 400, y: 300, s: .9, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy', wave: true })}
        ${crowd(23, 14, 430, 60, 740, .55, .8, 'happy')}
      `);
    },

    /** 第10章:ハードシングス・組織崩壊の危機 */
    hardthings() {
      return svgWrap(`
        ${room('#3a3648', '#4d475c')}
        ${windowView(480, 44, 270, 170, 'rain')}
        <g transform="translate(120,392)">
          <path d="M-26,0 L26,0 L22,34 L-22,34 Z" fill="#b08d5f"/>
          <path d="M-26,0 L0,-12 L26,0 Z" fill="#9c7b50"/>
          <text x="0" y="54" font-size="12" fill="#cfd6f2" text-anchor="middle" font-family="sans-serif">段ボール</text>
        </g>
        <g transform="translate(195,400)">
          <path d="M-22,0 L22,0 L18,28 L-18,28 Z" fill="#b08d5f"/>
        </g>
        ${person({ x: 300, y: 438, s: 1.0, shirt: '#7f8db8', hair: '#5b4632', mood: 'sad' })}
        ${person({ x: 390, y: 444, s: 1.0, shirt: '#5c5046', hair: '#1f1a17', longHair: true, mood: 'sad' })}
        ${person({ x: 600, y: 440, s: 1.05, shirt: '#4a7fd9', hair: '#2e3445', mood: 'angry' })}
        ${person({ x: 700, y: 436, s: 1.02, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'angry' })}
        <path d="M636,330 L666,330" stroke="#ffb13d" stroke-width="4" stroke-linecap="round"/>
        <text x="651" y="318" font-size="22" fill="#ffb13d" text-anchor="middle" font-weight="900">!</text>
        <rect x="60" y="60" width="300" height="56" rx="10" fill="#2a2535"/>
        <text x="210" y="96" font-size="20" font-weight="bold" fill="#ff8a8a" text-anchor="middle" font-family="sans-serif">退職者が止まらない…</text>
      `);
    },

    /** 第10章分岐:夜の屋上 */
    rooftop() {
      const r = rng(77);
      let stars = '';
      for (let i = 0; i < 34; i++) {
        stars += `<circle class="anim-twinkle" style="animation-delay:${(-r() * 3).toFixed(2)}s"
          cx="${r() * 800}" cy="${r() * 200}" r="${0.7 + r() * 1.5}" fill="#fff" opacity="${0.35 + r() * 0.6}"/>`;
      }
      let skyline = '';
      let bx = -10;
      while (bx < 820) {
        const bw = 36 + r() * 64, bh = 50 + r() * 110;
        skyline += `<rect x="${bx}" y="${290 - bh}" width="${bw}" height="${bh}" fill="#161d3a"/>`;
        for (let i = 0; i < 6; i++) {
          skyline += `<rect x="${bx + 4 + r() * (bw - 12)}" y="${290 - bh + 6 + r() * (bh - 18)}" width="6" height="7" fill="#ffd97a" opacity="${0.3 + r() * 0.6}"/>`;
        }
        bx += bw + 12;
      }
      let fence = '';
      for (let fx = 20; fx < 800; fx += 34) {
        fence += `<rect x="${fx}" y="268" width="5" height="74" fill="#3d4666"/>`;
      }
      return svgWrap(`
        <defs><linearGradient id="roofSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0c1130"/><stop offset="1" stop-color="#27306b"/>
        </linearGradient></defs>
        <rect width="800" height="450" fill="url(#roofSky)"/>
        ${stars}
        <circle cx="660" cy="86" r="30" fill="#fff7d6"/>
        <circle cx="648" cy="78" r="26" fill="#0c1130" opacity=".92"/>
        ${skyline}
        <rect x="0" y="290" width="800" height="160" fill="#2a3152"/>
        <rect x="0" y="284" width="800" height="10" fill="#39415f"/>
        ${fence}
        <rect x="16" y="268" width="772" height="6" rx="3" fill="#4a5378"/>
        <rect x="16" y="304" width="772" height="5" rx="2.5" fill="#444d72"/>
        <g transform="translate(700,400)">
          <rect x="-26" y="-92" width="52" height="92" rx="6" fill="#1d2440"/>
          <rect class="anim-glow" x="-19" y="-84" width="38" height="56" rx="4" fill="#7fe3ff" opacity=".85"/>
          <rect x="-19" y="-22" width="38" height="12" rx="3" fill="#39415f"/>
        </g>
        ${person({ x: 300, y: 432, s: 1.04, shirt: '#4a7fd9', hair: '#2e3445', mood: 'neutral' })}
        ${person({ x: 420, y: 432, s: 1.04, shirt: '#37415c', hair: '#1f1a17', mood: 'sad' })}
      `);
    },

    /** エンディング:IPO */
    end_ipo() {
      return svgWrap(`
        ${room('#fdf6e8', '#e8d9b8', 120)}
        <rect x="250" y="44" width="300" height="80" rx="12" fill="#1d2440"/>
        <text x="400" y="86" font-size="28" font-weight="900" fill="#ffd27a" text-anchor="middle" font-family="sans-serif">上場セレモニー</text>
        <text x="400" y="112" font-size="15" fill="#9fe8e2" text-anchor="middle" font-family="sans-serif">NOVA WORKS, Inc.</text>
        <g transform="translate(400,210)">
          <path d="M-34,-26 C-34,-52 34,-52 34,-26 C34,-6 18,6 6,10 L6,22 L-6,22 L-6,10 C-18,6 -34,-6 -34,-26 Z" fill="#f5c542" stroke="#caa028" stroke-width="3"/>
          <circle cx="0" cy="30" r="6" fill="#caa028"/>
          <line x1="0" y1="22" x2="0" y2="28" stroke="#caa028" stroke-width="3"/>
        </g>
        ${crowd(31, 12, 430, 60, 740, .6, .85, 'happy')}
        ${confetti(5, 80)}
      `);
    },

    /** エンディング:M&A・事業売却 */
    end_acq() {
      return svgWrap(`
        ${room('#e3e8f2', '#b9c2d8')}
        ${windowView(60, 46, 280, 160, 'day')}
        <rect x="420" y="56" width="150" height="50" rx="10" fill="#4ecdc4"/>
        <text x="495" y="88" font-size="19" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">NOVA</text>
        <text x="600" y="92" font-size="30" font-weight="900" fill="#39415f" text-anchor="middle" font-family="sans-serif">×</text>
        <rect x="630" y="56" width="130" height="50" rx="10" fill="#4a7fd9"/>
        <text x="695" y="88" font-size="19" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">BIG Co.</text>
        ${person({ x: 340, y: 438, s: 1.08, shirt: '#4ecdc4', hair: '#2e3445', mood: 'happy' })}
        ${person({ x: 480, y: 438, s: 1.08, shirt: '#4a7fd9', hair: '#1f1a17', mood: 'happy' })}
        <rect x="376" y="330" width="70" height="12" rx="6" fill="#f6c9a0"/>
        ${confetti(17, 40)}
        ${plant(740, 430, 1.1)}
      `);
    },

    /** エンディング:堅実な成長(夕暮れのオフィス) */
    end_steady() {
      return svgWrap(`
        ${room('#f4e3cf', '#dabd92')}
        ${windowView(250, 44, 480, 180, 'evening')}
        ${sittingPerson({ x: 200, y: 360, s: .95, shirt: '#6dbf63', hair: '#1f1a17', longHair: true, mood: 'happy' })}
        ${sittingPerson({ x: 360, y: 360, s: .95, shirt: '#f5c542', hair: '#7a5c3e', mood: 'happy' })}
        ${desk(280, 360, 300, '#a98e68', '#8a7050')}
        ${laptop(200, 360)}
        ${laptop(360, 360)}
        ${person({ x: 580, y: 436, s: 1.05, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy', wave: true })}
        ${person({ x: 690, y: 440, s: 1.0, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy' })}
        ${plant(80, 428, 1.1)}
      `);
    },

    /** エンディング:再出発(夜明け) */
    end_restart() {
      return svgWrap(`
        ${room('#efe6e0', '#d4bca4')}
        ${windowView(220, 44, 420, 180, 'dawn')}
        ${person({ x: 380, y: 438, s: 1.1, shirt: '#4a7fd9', hair: '#2e3445', mood: 'happy' })}
        ${person({ x: 500, y: 442, s: 1.02, shirt: '#e9806e', hair: '#3a2e2a', longHair: true, mood: 'happy' })}
        <g transform="translate(150,392)">
          <path d="M-26,0 L26,0 L22,34 L-22,34 Z" fill="#b08d5f"/>
        </g>
        ${plant(700, 428, 1.1)}
      `);
    },

    /** ゲームオーバー:倒産・組織崩壊 */
    end_gameover() {
      return svgWrap(`
        ${room('#2a2734', '#3a3545')}
        ${windowView(480, 44, 270, 170, 'night')}
        <rect x="80" y="70" width="300" height="64" rx="10" fill="#1d1a26" stroke="#4d475c" stroke-width="3"/>
        <text x="230" y="110" font-size="22" font-weight="bold" fill="#8a93b5" text-anchor="middle" font-family="sans-serif">CLOSED</text>
        <g transform="translate(150,392)">
          <path d="M-26,0 L26,0 L22,34 L-22,34 Z" fill="#8a7050"/>
        </g>
        <g transform="translate(230,400)">
          <path d="M-22,0 L22,0 L18,28 L-18,28 Z" fill="#8a7050"/>
        </g>
        ${person({ x: 420, y: 440, s: 1.05, shirt: '#5c5046', hair: '#2e3445', mood: 'sad' })}
        ${plant(700, 430, 1)}
      `);
    },
  };

  return {
    get(key) {
      const fn = scenes[key];
      return fn ? fn() : scenes.office_small();
    },
  };
})();
