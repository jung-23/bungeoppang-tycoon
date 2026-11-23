/* ===== 붕어빵 타이쿤 : game.js ===== */
(() => {
  'use strict';

  /* ---------- 데이터 ---------- */
  const INK = '#3a2418';

  const { FILLINGS, DAYS, BEST_KEY } = BP;   // data.js (로비와 공용). 1~4일차에 속재료가 하나씩 해금
  const F = Object.fromEntries(FILLINGS.map(f => [f.id, f]));

  // 굽는 시간(초) 기준
  const BAKE = { raw: 4, good: 9.5, crispy: 12.5, max: 14 };   // 뒤집은 뒤 경과 시간: 덜익음 <4 · 알맞음 <9.5 · 바삭 <12.5 · 그 이상 탐
  const LEVELS = {
    raw:    { name: '덜 익음', color: '#f6e3ae' },
    good:   { name: '알맞음',  color: '#e9a63a' },
    crispy: { name: '바삭',    color: '#c9741f' },
    burnt:  { name: '탐',      color: '#43261a' },
  };
  const levelOf = t => (t < BAKE.raw ? 'raw' : t < BAKE.good ? 'good' : t < BAKE.crispy ? 'crispy' : 'burnt');

  // 손님이 원하는 굽기 정도별 점수
  const BAKE_SCORE = {
    normal: { raw: 0.3, good: 1,   crispy: 0.8, burnt: 0.1 },
    crispy: { raw: 0.2, good: 0.6, crispy: 1,   burnt: 0.3 },
  };

  const MOLD_COUNT = 4;
  // 틀 제작 단계별 애니메이션 시간(초) — 여기만 바꾸면 CSS 애니메이션(--t-*)과 상태 전환이 함께 바뀜
  const ANIM = { pour: 0.5, fill: 0.5, close: 0.3, flip: 0.41, open: 0.15 };
  Object.entries(ANIM).forEach(([k, v]) => document.documentElement.style.setProperty('--t-' + k, v + 's'));
  const TIMING_START = 2.5;      // 덮은 뒤 이 시간(초)이 지나면 뒤집기 타이밍 게이지 등장
  const ZONE_W = 0.24;           // 게이지에서 '맞춰야 하는 구역' 너비(비율)
  const timingCycle = () => Math.max(0.9, 1.5 - (S.day - 1) * 0.1);   // 바가 왕복하는 시간(초), 일차가 높을수록 빠름
  const newMold = () => ({ state: 'empty', filling: null, t: 0, a: 0, flipped: false, zone: null, tm: 0, lock: 0, pre: 0 });
  const lvlOf = m => levelOf(m.t);   // 굽기 정도는 '뒤집은 뒤' 경과 시간(t)로 판정
  const BAG_MAX = 8;

  const SKINS = ['#ffe0c2', '#f7cfa5', '#eebd91', '#fbd5b5'];
  const CUSTOMER_TYPES = [
    { hair: 'short', hairColor: '#2b2b3a', shirt: '#4a74c9', scarf: '#f2f2f2' },
    { hair: 'perm',  hairColor: '#d4d4dc', shirt: '#b0558a', scarf: '#ffd25e' },
    { hair: 'short', hairColor: '#3a2a20', shirt: '#4a4f5a', scarf: '#c0392b' },
    { hair: 'bun',   hairColor: '#6b3d2a', shirt: '#e2574c', scarf: '#5cbf6a' },
    { hair: 'cap',   hairColor: '#7a8a52', shirt: '#6d5a3c', scarf: '#8e9aa8' },
  ];

  /* ---------- 유틸 ---------- */
  const $ = id => document.getElementById(id);
  const rand = (a, b) => Math.random() * (b - a) + a;
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const won = n => n.toLocaleString('ko-KR');

  const groupItems = items => {
    const m = new Map();
    items.forEach(id => m.set(id, (m.get(id) || 0) + 1));
    return [...m.entries()];
  };
  const summary = items => groupItems(items).map(([id, n]) => `${F[id].name} ${n}개`).join(', ');

  /* ---------- 효과음 (파일 없이 Web Audio로 합성) ---------- */
  const SFX = (() => {
    let ctx = null, master = null, noiseBuf = null, sizzleGain = null, muted = false;
    muted = BP.load('bp_muted', '0') === '1';

    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // 굽는 중 지글지글 (계속 돌다가 볼륨만 조절)
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      sizzleGain = ctx.createGain(); sizzleGain.gain.value = 0;
      src.connect(hp); hp.connect(sizzleGain); sizzleGain.connect(master); src.start();
    }
    const tone = (type, f0, f1, dur, vol = 0.3, delay = 0) => {
      if (!ctx || muted) return;
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    };
    const noise = (dur, f0, f1, vol, type, delay = 0) => {
      if (!ctx || muted) return;
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; f.type = type;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    };
    return {
      init,
      isMuted: () => muted,
      toggle() {
        muted = !muted;
        if (master) master.gain.value = muted ? 0 : 0.5;
        BP.save('bp_muted', muted ? 1 : 0);
        return muted;
      },
      pour()   { noise(0.5, 600, 200, 0.4, 'lowpass'); tone('sine', 320, 120, 0.25, 0.1); },
      fill()   { noise(0.5, 1400, 500, 0.2, 'bandpass'); tone('sine', 500, 760, 0.15, 0.12, 0.42); },
      lid()    { tone('triangle', 260, 80, 0.28, 0.45); noise(0.12, 3500, 800, 0.3, 'highpass'); },
      flip()   { tone('sine', 880, null, 0.3, 0.25); tone('sine', 1320, null, 0.45, 0.2, 0.08); },
      miss()   { tone('sawtooth', 170, 90, 0.22, 0.18); },
      open()   { noise(0.15, 400, 2600, 0.22, 'bandpass'); tone('triangle', 200, 340, 0.1, 0.12); },
      bag()    { tone('sine', 520, 900, 0.12, 0.3); },
      trash()  { noise(0.28, 1600, 300, 0.2, 'lowpass'); },
      arrive() { tone('sine', 660, null, 0.35, 0.22); tone('sine', 880, null, 0.5, 0.22, 0.18); },
      coin()   { tone('square', 1200, null, 0.08, 0.1); tone('square', 1700, null, 0.28, 0.1, 0.09); },
      happy()  { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, null, 0.25, 0.2, 0.1 + i * 0.09)); },
      angry()  { tone('sawtooth', 230, 110, 0.45, 0.2); },
      sizzle(on) { if (ctx) sizzleGain.gain.setTargetAtTime(on && !muted ? 0.035 : 0, ctx.currentTime, 0.15); },
    };
  })();

  /* ---------- 상태 ---------- */
  const S = {
    day: 1, phase: 'story', token: 0, last: 0,
    tool: null, molds: [], bag: [], slots: [], spawned: 0, done: 0,
    stats: { rev: 0, served: 0, lost: 0, happy: 0 },
  };

  const later = (fn, ms) => {
    const t = S.token;
    setTimeout(() => { if (t === S.token) fn(); }, ms);
  };
  const curDay = () => DAYS[S.day - 1];   // 오늘(현재 일차) 설정
  const playing = () => S.phase === 'play';

  /* ---------- SVG 그리기 ---------- */
  function fishInner(fill, filling, empty) {
    const stroke = empty ? '#15151a' : INK;
    const details = empty ? '' : `
      <path d="M72 17 Q66 36 72 55 M84 22 Q79 36 84 50" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".4"/>
      <path d="M40 20 Q34 36 40 52" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>
      <circle cx="26" cy="30" r="4" fill="${INK}"/>`;
    const dot = filling
      ? `<circle cx="58" cy="44" r="7" fill="${filling.color}" stroke="${INK}" stroke-width="2.5"/>` : '';
    return `<path d="M94 36 L118 12 Q112 36 118 60 Z" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
      <ellipse cx="54" cy="36" rx="44" ry="26" fill="${fill}" stroke="${stroke}" stroke-width="4"/>${details}${dot}`;
  }
  function fishSVG(fill, filling, empty) {
    return `<svg viewBox="0 0 124 72" class="fish" aria-hidden="true">${fishInner(fill, filling, empty)}</svg>`;
  }

  /* ----- 붕어빵 틀 : 위판 + 아래판 (1 반죽 → 2 속재료 → 3 덮기 → 4 뒤집기 → 5 열고 꺼내기) ----- */
  const BODY = `<path d="M94 36 L118 12 Q112 36 118 60 Z"/><ellipse cx="54" cy="36" rx="44" ry="26"/>`;
  const PH = 66, TOP_Y = 2, BOT_Y = 80;                 // 판 높이 / 위판 y / 아래판 y
  const cav = y => `translate(10.5 ${y + 4}) scale(.8)`;   // 판 안의 붕어빵 모양 위치
  const CX = 53.7, CY = BOT_Y + 32.8;                      // 아래판 붕어빵 중심
  const STK = 'stroke="#15151a" stroke-width="4" stroke-linejoin="round"';
  const cavityEmpty = y => `<g transform="${cav(y)}" fill="#2a2a32" ${STK}>${BODY}</g>`;
  const cavityOutline = y => `<g transform="${cav(y)}" fill="none" ${STK}>${BODY}</g>`;
  const frontFace = y => `<rect x="4" y="${y}" width="112" height="${PH}" rx="9" fill="#52525e" ${STK}/>`;
  const backFace = y => `<rect x="4" y="${y}" width="112" height="${PH}" rx="9" fill="#74747f" ${STK}/>
      <rect x="46" y="${y - 9}" width="28" height="13" rx="5" fill="#9a9aa8" stroke="#15151a" stroke-width="3.5"/>
      <circle cx="17" cy="${y + 13}" r="3" fill="#2c2c33"/><circle cx="103" cy="${y + 13}" r="3" fill="#2c2c33"/>
      <circle cx="17" cy="${y + PH - 13}" r="3" fill="#2c2c33"/><circle cx="103" cy="${y + PH - 13}" r="3" fill="#2c2c33"/>`;
  const hinge = `<rect x="34" y="66" width="9" height="16" rx="2" fill="#9a9aa8" stroke="#15151a" stroke-width="3"/>
      <rect x="77" y="66" width="9" height="16" rx="2" fill="#9a9aa8" stroke="#15151a" stroke-width="3"/>`;
  // 위판이 접혀 내려오거나 다시 열리는 애니메이션(앞면 ↔ 뒷면 교체)
  const topPlate = mode => {
    const front = `<g class="face-front">${frontFace(TOP_Y)}${cavityEmpty(TOP_Y)}</g>`;
    const back = `<g class="face-back">${backFace(TOP_Y)}</g>`;
    return mode === 'closing' ? `<g class="plate-top fold">${front}${back}</g>`
         : mode === 'opening' ? `<g class="plate-top unfold">${front}${back}</g>`
         : `<g>${frontFace(TOP_Y)}${cavityEmpty(TOP_Y)}</g>`;
  };

  function moldSVG(m, i) {
    const BATTER = '#fff1c4';
    const fc = m.filling ? F[m.filling].color : '#fff';
    const defs = `<defs>
      <clipPath id="fc${i}"><path transform="${cav(BOT_Y)}" d="M94 36 L118 12 Q112 36 118 60 Z"/><ellipse transform="${cav(BOT_Y)}" cx="54" cy="36" rx="44" ry="26"/></clipPath>
      <clipPath id="in${i}"><ellipse cx="55.3" cy="${CY}" rx="24" ry="12"/></clipPath></defs>`;
    const batter = `<g transform="${cav(BOT_Y)}" fill="${BATTER}" ${STK}>${BODY}</g>`;
    const patch = `<ellipse cx="55.3" cy="${CY}" rx="24" ry="12" fill="${fc}" stroke="${INK}" stroke-width="2.5"/>`;
    let body = '';
    switch (m.state) {
      case 'empty':
        body = frontFace(TOP_Y) + cavityEmpty(TOP_Y) + frontFace(BOT_Y) + cavityEmpty(BOT_Y) + hinge; break;
      case 'pouring':   // 반죽이 흘러내려 가운데서부터 원 모양으로 퍼짐
        body = frontFace(TOP_Y) + cavityEmpty(TOP_Y) + frontFace(BOT_Y) + cavityEmpty(BOT_Y)
          + `<g clip-path="url(#fc${i})"><circle class="pour-circle" cx="${CX}" cy="${CY}" r="56" fill="${BATTER}"/></g>`
          + cavityOutline(BOT_Y) + hinge
          + `<rect class="stream" x="${CX - 3.5}" y="0" width="7" height="${CY - 8}" rx="3.5" fill="${BATTER}" stroke="${INK}" stroke-width="1.5"/>`;
        break;
      case 'batter':
        body = frontFace(TOP_Y) + cavityEmpty(TOP_Y) + frontFace(BOT_Y) + batter + hinge; break;
      case 'filling':   // 속재료가 게이지처럼 왼쪽부터 차오름
        body = frontFace(TOP_Y) + cavityEmpty(TOP_Y) + frontFace(BOT_Y) + batter
          + `<g clip-path="url(#in${i})"><rect class="fill-bar" x="30" y="${CY - 14}" width="52" height="28" fill="${fc}"/></g>`
          + `<ellipse cx="55.3" cy="${CY}" rx="24" ry="12" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4" opacity=".9"/>`
          + hinge
          + `<rect class="stream" x="${CX - 3.5}" y="0" width="7" height="${CY - 10}" rx="3.5" fill="${fc}" stroke="${INK}" stroke-width="1.5"/>`;
        break;
      case 'filled':
        body = frontFace(TOP_Y) + cavityEmpty(TOP_Y) + frontFace(BOT_Y) + batter + patch + hinge; break;
      case 'closing':   // 위판이 아래판 위로 접혀 덮임
        body = frontFace(BOT_Y) + batter + patch + hinge + topPlate('closing'); break;
      case 'baking':    // 덮인 상태(뚜껑 손잡이가 보임) — 뒤집기도 이 상태
        body = backFace(BOT_Y); break;
      case 'opening':
      case 'open': {    // 열린 틀 : 아래판에 구워진 붕어빵
        const lvl = lvlOf(m);
        body = frontFace(BOT_Y) + cavityEmpty(BOT_Y)
          + `<g transform="${cav(BOT_Y)}">${fishInner(LEVELS[lvl].color, F[m.filling])}</g>` + hinge
          + topPlate(m.state === 'opening' ? 'opening' : 'static');
        break;
      }
    }
    return `<svg viewBox="0 0 120 148" class="fish" aria-hidden="true">${defs}${body}</svg>`;
  }

  function customerSVG(c, mood) {
    const sk = `stroke="${INK}" stroke-width="4" stroke-linejoin="round"`;
    let hair = '';
    if (c.hair === 'short') {
      hair = `<path d="M54 100 Q50 44 100 44 Q150 44 146 100 Q134 72 100 72 Q66 72 54 100Z" fill="${c.hairColor}" ${sk}/>`;
    } else if (c.hair === 'bun') {
      hair = `<circle cx="100" cy="36" r="17" fill="${c.hairColor}" ${sk}/>
        <path d="M54 100 Q50 44 100 44 Q150 44 146 100 Q134 72 100 72 Q66 72 54 100Z" fill="${c.hairColor}" ${sk}/>`;
    } else if (c.hair === 'perm') {
      const dots = [[62, 76, 20], [84, 58, 22], [114, 56, 22], [138, 76, 20], [100, 68, 24]];
      hair = dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.hairColor}" ${sk}/>`).join('')
        + dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 2}" fill="${c.hairColor}"/>`).join('');
    } else {
      hair = `<path d="M54 92 Q54 40 100 40 Q146 40 146 92Z" fill="${c.hairColor}" ${sk}/>
        <path d="M96 86 H162 Q170 86 170 94 H96Z" fill="${c.hairColor}" ${sk}/>`;
    }

    let eyes, mouth, cheeks = '';
    if (mood === 'happy') {
      eyes = `<path d="M74 102 Q82 92 90 102 M110 102 Q118 92 126 102" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
      mouth = `<path d="M84 120 Q100 142 116 120Z" fill="#d9534f" ${sk}/>`;
      cheeks = `<circle cx="72" cy="116" r="7" fill="#ff8a8a" opacity=".55"/><circle cx="128" cy="116" r="7" fill="#ff8a8a" opacity=".55"/>`;
    } else if (mood === 'angry') {
      eyes = `<circle cx="84" cy="102" r="5" fill="${INK}"/><circle cx="116" cy="102" r="5" fill="${INK}"/>
        <path d="M70 88 L94 97 M130 88 L106 97" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
      mouth = `<path d="M86 134 Q100 118 114 134" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
      cheeks = `<circle cx="72" cy="116" r="7" fill="#ff5a4a" opacity=".45"/><circle cx="128" cy="116" r="7" fill="#ff5a4a" opacity=".45"/>`;
    } else {
      eyes = `<circle cx="84" cy="102" r="5" fill="${INK}"/><circle cx="116" cy="102" r="5" fill="${INK}"/>`;
      mouth = `<path d="M88 128 L112 128" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    }

    return `<svg viewBox="0 0 200 250" aria-hidden="true">
      <path d="M26 250 Q26 168 100 166 Q174 168 174 250Z" fill="${c.shirt}" ${sk}/>
      <circle cx="100" cy="100" r="46" fill="${c.skin}" ${sk}/>
      ${hair}
      <rect x="66" y="142" width="68" height="30" rx="14" fill="${c.scarf}" ${sk}/>
      ${cheeks}${eyes}${mouth}
    </svg>`;
  }

  /* ---------- 손님 생성 (해금된 재료만 주문) ---------- */
  function makeCustomer() {
    const cfg = curDay();
    const avail = FILLINGS.slice(0, S.day).map(f => f.id);
    const r = Math.random();

    let kind = 'normal';
    if (S.day >= 2 && r < 0.18) kind = 'crispy';
    else if (r < 0.40) kind = 'rush';
    else if (S.day >= 2 && r < 0.52) kind = 'bulk';

    const n = kind === 'bulk' ? randInt(4, 6) : kind === 'normal' ? randInt(1, 3) : randInt(1, 2);
    const items = [];
    for (let i = 0; i < n; i++) items.push(pick(avail));
    items.sort();

    const want = kind === 'crispy' ? 'crispy' : 'normal';
    const ramp = cfg.endless ? Math.min(18, Math.floor(S.spawned / 4) * 2) : 0;   // 무한 모드: 손님이 쌓일수록 인내심이 줄어듦(최대 18초)
    let patienceMax = cfg.patience - ramp + items.length * 8;
    if (kind === 'rush') patienceMax *= 0.7;
    if (kind === 'bulk') patienceMax *= 1.15;

    const s = summary(items);
    const lines = {
      normal: [`붕어빵 ${s} 주세요~`, `${s} 부탁드려요!`, `추운데 ${s} 주세요~`, `${s}, 따뜻한 걸로요!`],
      crispy: [`${s} 주세요! 저는 바삭한 게 좋아요~`, `${s}, 겉바속촉 아니고 그냥 바삭하게!`],
      rush:   [`${s}! 버스 와요, 빨리요!`, `나 지금 급해! ${s} 빨리 주세요!`],
      bulk:   [`회사 사람들 줄 거예요. ${s} 주세요!`, `온 가족 먹게 ${s} 포장해 주세요~`],
    };

    return {
      ...pick(CUSTOMER_TYPES), skin: pick(SKINS), mood: 'happy',
      line: pick(lines[kind]),
      order: { items, want, kind },
      patienceMax, patience: patienceMax,
    };
  }

  /* ---------- 채점 ---------- */
  function evaluate(order, bag) {
    const pool = bag.map(b => ({ ...b, used: false }));
    let price = 0, sum = 0, matched = 0;
    order.items.forEach(id => {
      let best = null, bs = -1;
      pool.forEach(b => {
        if (!b.used && b.filling === id) {
          const s = BAKE_SCORE[order.want][b.level];
          if (s > bs) { bs = s; best = b; }
        }
      });
      if (best) { best.used = true; matched++; price += F[id].price * bs; sum += bs; }
    });
    return { matched, price, accuracy: sum / order.items.length };
  }

  // 인내심 비율 → 기분 (천천히 나빠지도록 여유 있게)
  const moodOf = p => (p > 0.45 ? 'happy' : p > 0.2 ? 'neutral' : 'angry');

  /* ---------- 렌더링 ---------- */
  // 손님 자리(슬롯) : 1~4일차는 1자리, 5일차는 2자리
  const slotEls = [];
  const slotN = () => curDay().slots || 1;
  function buildSlots(n) {
    const body = $('sceneBody');
    body.className = 'scene-body ' + (n > 1 ? 'two' : 'one');
    document.querySelector('.stall').classList.toggle('flank', n > 1);   // 2명이면 가로 화면에서 손님-작업대-손님 배치
    body.innerHTML = '';
    slotEls.length = 0;
    for (let i = 0; i < n; i++) {
      const root = document.createElement('div');
      root.className = 'slot'; root.dataset.s = i;
      root.innerHTML = `<div class="customer-zone"><div class="bubble" hidden></div><div class="customer"></div>
        <div class="patience" title="손님 인내심"><i></i></div></div><aside class="ticket"></aside>`;
      body.appendChild(root);
      slotEls.push({
        root, zone: root.querySelector('.customer-zone'), bubble: root.querySelector('.bubble'),
        cust: root.querySelector('.customer'), pat: root.querySelector('.patience i'), ticket: root.querySelector('.ticket'),
      });
    }
  }
  const slotAt = x => {
    const r = $('scene').getBoundingClientRect(), n = slotEls.length;
    return Math.min(n - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * n)));
  };

  function updateHud() {
    const cfg = curDay();
    $('hudDay').textContent = `Day ${S.day}`;
    $('hudMoney').textContent = won(S.stats.rev);
    const best = getBest();
    if (cfg.record) {
      $('hudGoalWrap').innerHTML = `/ 최고 기록 <span id="hudGoal">${best ? won(best) : '-'}</span>${best ? '원' : ''}`;
      $('goalFill').style.width = best ? Math.min(100, (S.stats.rev / best) * 100) + '%' : '0%';
    } else {
      $('hudGoalWrap').innerHTML = `/ 목표 <span id="hudGoal">${won(cfg.goal)}</span>원`;
      $('goalFill').style.width = Math.min(100, (S.stats.rev / cfg.goal) * 100) + '%';
    }
    $('hudGuests').textContent = cfg.endless ? `${S.done}명 ❤️${S.lives}` : `${S.done}/${cfg.customers}`;
  }

  // 해금 안 된 재료는 빈칸, 오늘 새로 열린 재료는 NEW 표시
  function renderTools() {
    let html = `<button type="button" class="tool${S.tool === 'batter' ? ' on' : ''}" data-tool="batter">
      <span class="t-ico">🥣</span><span>반죽</span></button>`;
    FILLINGS.forEach((f, i) => {
      if (i >= S.day) {
        html += `<div class="tool blank" aria-hidden="true"><span class="t-ico">·</span><span>·</span></div>`;
      } else {
        const fresh = i === S.day - 1;
        html += `<button type="button" class="tool${S.tool === f.id ? ' on' : ''}${fresh ? ' fresh' : ''}" data-tool="${f.id}">
          ${fresh ? '<span class="new">NEW</span>' : ''}<span class="t-ico">${f.icon}</span><span>${f.name}</span></button>`;
      }
    });
    $('tools').innerHTML = html;
  }

  function renderTicket(i) {
    const c = S.slots[i] && S.slots[i].c;
    const box = slotEls[i].ticket;
    if (!c) {
      box.innerHTML = S.spawned >= curDay().customers ? '' : '<div class="ticket-empty">손님을 기다리는 중…</div>';
      return;
    }
    const li = groupItems(c.order.items).map(([id, n]) =>
      `<li><span class="dot" style="--c:${F[id].color}"></span>${F[id].name} ×${n}</li>`).join('');
    const tags = [];
    if (c.order.kind === 'crispy') tags.push('🔥 바삭하게');
    if (c.order.kind === 'rush') tags.push('⏱ 급해요!');
    if (c.order.kind === 'bulk') tags.push('📦 많이 포장');
    box.innerHTML = `<h3>📝 주문서</h3><ul>${li}</ul>` +
      (tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '');
  }

  function renderCustomer(i) {
    const c = S.slots[i].c;
    slotEls[i].cust.innerHTML = c ? customerSVG(c, c.mood) : '';
  }

  // react=true : 주문 대사가 아니라 손님의 반응 대사. (2명일 땐 주문 대사는 생략하고 주문서만 보여줌)
  function setBubble(i, text, react) {
    const b = slotEls[i].bubble;
    if (text && !react && slotEls.length > 1) text = '';
    b.hidden = !text;
    b.textContent = text || '';
    if (text) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
  }

  // 붕어빵 봉투 : 글자 없이, 담긴 붕어빵이 보이고 개수 뱃지만 표시
  function renderBag() {
    const bag = $('bag');
    bag.classList.toggle('has', S.bag.length > 0);
    $('bagItems').innerHTML = S.bag.map((b, i) =>
      `<span class="bi" style="--r:${(i % 3 - 1) * 9}deg">${fishSVG(LEVELS[b.level].color, F[b.filling])}</span>`).join('');
    const cnt = $('bagCount');
    cnt.textContent = S.bag.length;
    cnt.hidden = S.bag.length === 0;
  }

  // 틀
  const moldEls = [];
  function buildMolds() {
    const wrap = $('molds');
    wrap.innerHTML = '';
    moldEls.length = 0;
    for (let i = 0; i < MOLD_COUNT; i++) {
      const b = document.createElement('div');
      b.className = 'mold'; b.dataset.i = i;
      b.innerHTML = `<div class="fish-wrap"></div><div class="label"></div>
        <div class="gslot"><div class="gauge"><i></i></div><div class="timing"><i class="zone"></i><i class="cursor"></i></div></div>`;
      wrap.appendChild(b);
      moldEls.push({
        root: b, fish: b.querySelector('.fish-wrap'), label: b.querySelector('.label'),
        gauge: b.querySelector('.gauge'), mark: b.querySelector('.gauge i'), key: null,
        timing: b.querySelector('.timing'), zone: b.querySelector('.zone'), cursor: b.querySelector('.cursor'),
      });
    }
  }

  const moldPhase = m => (m.state !== 'baking' ? ''
    : m.flipped ? (m.t < BAKE.raw ? 'cook' : 'openit') : m.pre < TIMING_START ? 'wait' : 'now');

  function updateMold(i) {
    const m = S.molds[i], el = moldEls[i];
    const gaugeOn = m.state === 'opening' || m.state === 'open' || (m.state === 'baking' && m.flipped);
    const lvl = gaugeOn ? lvlOf(m) : '';
    const ph = moldPhase(m);
    const key = [m.state, m.filling, lvl, ph].join(':');
    if (el.key !== key) {
      el.key = key;
      const drag = el.root.classList.contains('dragging') ? ' dragging' : '';
      const name = m.filling ? F[m.filling].name : '';
      const label = {
        empty: '빈 틀', pouring: '반죽 붓는 중', batter: '반죽 완료', filling: '속재료 채우는 중',
        filled: '탭해서 덮기!', closing: '덮는 중', opening: '여는 중',
        open: `${name}·${LEVELS[lvl || 'raw'].name}`,
        baking: { wait: `${name}·굽는 중`, cook: `${name}·굽는 중`, now: '초록 구역에서 탭!', openit: '탭해서 열기!' }[ph],
      }[m.state];
      el.fish.innerHTML = moldSVG(m, i);
      el.label.textContent = label;
      el.root.className = 'mold ' + m.state + (ph ? ' ph-' + ph : '') + (lvl === 'burnt' ? ' burnt' : '') + drag;
      const timing = ph === 'now' && m.zone;
      el.timing.style.display = timing ? 'block' : 'none';
      if (timing) { el.zone.style.left = m.zone.a * 100 + '%'; el.zone.style.width = ZONE_W * 100 + '%'; }
      el.gauge.style.visibility = gaugeOn ? 'visible' : 'hidden';
    }
    if (gaugeOn) el.mark.style.left = (Math.min(m.t, BAKE.max) / BAKE.max) * 100 + '%';
  }

  function playFlip(i) {
    const w = moldEls[i].fish;
    w.classList.remove('flip'); void w.offsetWidth; w.classList.add('flip');
    setTimeout(() => w.classList.remove('flip'), ANIM.flip * 1000 + 60);
  }

  function updatePatience() {
    slotEls.forEach((el, i) => {
      const c = S.slots[i] && S.slots[i].c;
      if (!c) { el.pat.style.width = '0%'; return; }
      const p = Math.max(0, c.patience / c.patienceMax);
      el.pat.style.width = p * 100 + '%';
      el.pat.className = p > 0.45 ? '' : p > 0.2 ? 'mid' : 'low';
    });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
  }

  function floatText(i, text) {
    const d = document.createElement('div');
    d.className = 'float'; d.textContent = text;
    slotEls[i].zone.appendChild(d);
    setTimeout(() => d.remove(), 1600);
  }

  /* ---------- 최고 기록 ---------- */
  const getBest = () => +BP.load(BEST_KEY, 0) || 0;
  const setBest = v => BP.save(BEST_KEY, v);

  /* ---------- 오버레이 : 로비 / 일차 선택 / 결과 ---------- */
  const ov = $('overlay');
  const showOverlay = html => { ov.innerHTML = `<div class="ov-box">${html}</div>`; ov.classList.add('show'); };
  const hideOverlay = () => ov.classList.remove('show');

  const LOBBY = 'index.html';   // 로비(메인) 페이지

  function endDay() {
    S.phase = 'result';
    const cfg = curDay();
    const st = S.stats;
    const story = cfg.story;
    let head, body, btn;
    if (cfg.record) {
      const prev = getBest();
      const isNew = st.rev > prev;
      if (isNew) setBest(st.rev);
      head = `<div class="big">${isNew ? '🏆' : '🌙'}</div>
        <h2 class="${isNew ? 'ok' : 'bad'}">${isNew ? '최고 기록 경신!' : '기회를 모두 잃었어요…'}</h2>`;
      body = `<div class="stat"><span>오늘 매출</span><b>${won(st.rev)}원</b></div>
        <div class="stat"><span>최고 기록</span><b>${won(Math.max(prev, st.rev))}원</b></div>`;
      btn = `<button class="btn" type="button" data-act="retry">기록 다시 도전!</button>`;
    } else {
      const ok = st.rev >= cfg.goal;
      head = `<div class="big">${ok ? '🎉' : '😢'}</div>
        <h2 class="${ok ? 'ok' : 'bad'}">${ok ? '목표 달성!' : '목표 미달…'}</h2>`;
      body = `<div class="stat"><span>오늘 매출</span><b>${won(st.rev)}원</b></div>
        <div class="stat"><span>목표 매출</span><b>${won(cfg.goal)}원</b></div>`;
      btn = ok ? `<button class="btn" type="button" data-act="next">다음 날로 →</button>`
               : `<button class="btn" type="button" data-act="retry">다시 도전!</button>`;
    }
    const showOutro = cfg.record || st.rev >= cfg.goal;
    showOverlay(`
      ${head}
      ${showOutro ? `<p class="story">${story.outro}</p>` : ''}
      ${body}
      <div class="stat"><span>판매 성공</span><b>${st.served}명</b></div>
      <div class="stat"><span>만족한 손님</span><b>${st.happy}명</b></div>
      <div class="stat"><span>놓친 손님</span><b>${st.lost}명</b></div>
      ${btn}
      <button class="btn ghostbtn" type="button" data-act="select">로비로</button>`);
  }

  // 하루 시작 전 스토리 화면
  function showStory(day) {
    S.phase = 'story';
    try { history.replaceState(null, '', '?day=' + day); } catch (e) { /* 무시 */ }
    const s = DAYS[day - 1].story;
    S.day = day; resetDay();   // 뒤 화면도 해당 일차로 맞춤
    showOverlay(`
      <div class="big">${s.icon}</div>
      <h2>Day ${day} · ${s.title}</h2>
      <p class="story">${s.intro}</p>
      <button class="btn" type="button" data-act="go" data-day="${day}">영업 시작</button>`);
  }

  /* ---------- 게임 흐름 ---------- */
  function resetDay() {
    S.token++;
    S.molds = Array.from({ length: MOLD_COUNT }, newMold);
    S.bag = []; S.tool = null; S.done = 0; S.spawned = 0; S.lives = curDay().lives || 0;
    S.slots = Array.from({ length: slotN() }, () => ({ c: null, busy: false }));
    buildSlots(slotN());
    S.stats = { rev: 0, served: 0, lost: 0, happy: 0 };
    moldEls.forEach(e => { e.key = null; e.root.classList.remove('dragging'); });
    renderTools(); renderBag(); updateHud();
    S.slots.forEach((_, i) => renderTicket(i));
    updatePatience();
    S.molds.forEach((_, i) => updateMold(i));
  }

  function startDay(day) {
    S.day = day;
    hideOverlay();
    resetDay();
    S.phase = 'play';
    S.last = performance.now();
    toast(`Day ${day} 시작!`);
    S.slots.forEach((_, i) => later(() => spawn(i), 800 + i * 2200));   // 2자리면 두 번째 손님은 조금 늦게 도착
  }

  function spawn(i) {
    if (S.spawned >= curDay().customers) return;
    const sl = S.slots[i];
    if (!sl || sl.c) return;
    const c = makeCustomer();
    S.spawned++;
    sl.c = c; sl.busy = false;
    renderCustomer(i); renderTicket(i); setBubble(i, c.line); updatePatience();
    slotEls[i].cust.className = 'customer enter';
    SFX.arrive();
  }

  // 손님 한 명 처리 마무리 (i = 자리 번호)
  function settle(i, { mood, line, gain }) {
    const sl = S.slots[i], c = sl.c;
    sl.busy = true;
    c.mood = mood; renderCustomer(i); setBubble(i, line, true);
    if (mood === 'happy') SFX.happy(); else if (mood === 'angry') SFX.angry();
    if (gain > 0) { S.stats.rev += gain; floatText(i, '+' + won(gain) + '원'); SFX.coin(); }
    const endless = curDay().endless;
    let dead = false;
    if (endless && mood === 'angry') {            // 무한 모드: 손님이 화나면 기회 1번 깎임
      S.lives = Math.max(0, S.lives - 1);
      setTimeout(() => floatText(i, '💔 기회 -1'), gain > 0 ? 350 : 0);
      if (S.lives <= 0) { dead = true; S.phase = 'ending'; }   // 더 이상 시간·손님 진행 없음
    }
    updateHud();
    later(() => { slotEls[i].cust.className = 'customer leave'; setBubble(i, ''); }, 1700);
    later(() => {
      sl.c = null; sl.busy = false;
      slotEls[i].cust.innerHTML = ''; slotEls[i].cust.className = 'customer';
      S.done++; updateHud();
      renderTicket(i); updatePatience();
      if (dead || S.done >= curDay().customers) endDay();
      else later(() => spawn(i), 500);
    }, 2300);
  }

  // 봉투를 손님에게 전달
  function serve(i) {
    const sl = S.slots[i];
    if (S.phase !== 'play' || !sl || !sl.c || sl.busy) { toast('지금은 손님이 없어요'); return; }
    const c = sl.c;
    const p = Math.max(0, c.patience / c.patienceMax);
    const ev = evaluate(c.order, S.bag);
    S.bag = [];
    renderBag();

    if (ev.matched === 0) {
      S.stats.lost++;
      settle(i, { mood: 'angry', line: pick(['어… 제가 시킨 게 아닌데요?', '이게 아닌데… 안 살래요!']), gain: 0 });
      return;
    }

    const mult = p > 0.4 ? 1 : p > 0.15 ? 0.75 : 0.5;
    const tip = p > 0.4 && ev.accuracy >= 0.85 ? 500 : 0;
    const gain = Math.round((ev.price * mult) / 100) * 100 + tip;

    let mood, line;
    const need = curDay().endless ? 0.999 : 0.35;   // 무한 모드는 100% 일치해야 함 (굽기까지 딱 맞아야 함)
    if (ev.accuracy < need) { mood = 'angry'; line = pick(['이건 좀… 주문이랑 너무 다른데요?', '왜 이렇게 만들었어요…']); }
    else if (p <= 0.2) { mood = 'angry'; line = '너무 오래 기다렸어요… 깎아주세요!'; }
    else if (ev.accuracy >= 0.85 && p > 0.45) { mood = 'happy'; line = pick(['와~ 딱 이거예요! 사장님 최고!', '맛있겠다! 팁 드릴게요~']); }
    else { mood = 'neutral'; line = pick(['음, 그럭저럭 괜찮네요.', '네~ 잘 먹을게요.']); }

    S.stats.served++;
    if (mood === 'happy') S.stats.happy++;
    settle(i, { mood, line, gain });
  }

  // 틀 탭 : 반죽 붓기 → 속재료 → 판 덮기 (구워진 뒤엔 탭=뒤집기, 드래그=꺼내기)
  function onMold(i) {
    const m = S.molds[i];
    if (m.state === 'empty') {
      if (S.tool === 'batter') { m.state = 'pouring'; m.a = 0; SFX.pour(); }
      else toast('먼저 🥣 반죽을 고르세요!');
    } else if (m.state === 'batter') {
      const idx = FILLINGS.findIndex(f => f.id === S.tool);
      if (idx >= 0 && idx < S.day) { m.state = 'filling'; m.filling = S.tool; m.a = 0; SFX.fill(); }
      else toast('속재료를 먼저 고르세요!');
    } else if (m.state === 'filled') {
      m.state = 'closing'; m.a = 0; setTimeout(SFX.lid, ANIM.close * 630);
    }
    updateMold(i);
  }

  // 타이밍 게임 : 움직이는 바가 초록 구역 안에 있을 때 탭하면 뒤집힘
  const timingPos = (m, now) => {
    const ph = (((now - m.tm) / 1000) / timingCycle()) % 1;
    return ph < 0.5 ? ph * 2 : 2 - ph * 2;
  };
  function timingTap(i) {
    const m = S.molds[i], el = moldEls[i], now = performance.now();
    if (m.pre < TIMING_START || !m.zone) { toast('아직 일러요! 곧 타이밍 게이지가 나와요'); return; }
    if (now < m.lock) return;
    const p = timingPos(m, now);
    if (p >= m.zone.a && p <= m.zone.a + ZONE_W) {
      m.flipped = true; m.flipAt = now; m.t = 0;   // 뒤집은 순간부터 익힘 게이지 시작
      toast('👍 딱 맞았어요!'); SFX.flip();
      playFlip(i); updateMold(i);
    } else {
      m.lock = now + 500;                      // 빗나가면 잠깐 못 누름
      toast('빗나갔어요! 다시!'); SFX.miss();
      el.timing.classList.add('miss');
      setTimeout(() => el.timing.classList.remove('miss'), 350);
    }
  }

  // 구워지는 틀을 탭 : 열기 (열린 뒤엔 드래그로 꺼냄)
  function tapBaking(i) {
    const m = S.molds[i];
    if (m.state === 'open') { toast('끌어서 봉투에 담아요 🛍'); return; }
    if (m.state !== 'baking') return;
    if (!m.flipped) return;   // 뒤집기는 타이밍 게이지(timingTap)로 처리
    if (performance.now() - (m.flipAt || 0) < ANIM.flip * 1000) return;   // 뒤집는 중
    if (lvlOf(m) === 'raw') { toast('아직 덜 익었어요! 조금 더 기다려요 🔥'); return; }   // 덜 익은 상태에선 열 수 없음
    m.state = 'opening'; m.a = 0; SFX.open();
    updateMold(i);
  }

  /* ---------- 드래그 앤 드롭 (붕어빵 → 봉투, 봉투 → 손님) ---------- */
  let drag = null;   // { kind: 'bread'|'bag', idx, pid, x0, y0, moved, ghost, src }

  function beginPress(kind, idx, e, src) {
    drag = { kind, idx, pid: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, src };
  }

  function makeGhost() {
    const d = drag;
    const g = document.createElement('div');
    if (d.kind === 'bread') {
      const m = S.molds[d.idx];
      g.className = 'ghost';
      g.innerHTML = fishSVG(LEVELS[lvlOf(m)].color, F[m.filling]);
    } else {
      g.className = 'ghost bag-ghost';
      const clone = $('bag').cloneNode(true);
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      g.appendChild(clone);
    }
    document.body.appendChild(g);
    d.ghost = g;
    d.src.classList.add('dragging');
  }

  function dropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.closest('#trash')) return 'trash';
    if (el.closest('#bag')) return 'bag';
    if (el.closest('#scene')) return 'customer';
    return null;
  }

  function highlight(target, x) {
    const toCust = target === 'customer' && drag.kind === 'bag';
    $('bag').classList.toggle('over', target === 'bag' && drag.kind === 'bread');
    $('trash').classList.toggle('over', target === 'trash');
    $('scene').classList.toggle('over', toCust && slotEls.length === 1);
    const hit = toCust && slotEls.length > 1 ? slotAt(x) : -1;
    slotEls.forEach((el, k) => el.root.classList.toggle('over', k === hit));
  }

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    if (d.ghost) d.ghost.remove();
    d.src.classList.remove('dragging');
    $('bag').classList.remove('over'); $('trash').classList.remove('over'); $('scene').classList.remove('over');
    slotEls.forEach(el => el.root.classList.remove('over'));
    if (cancelled) return;

    if (!d.moved) {
      if (d.kind === 'bread') tapBaking(d.idx);
      return;
    }
    const t = dropTarget(e.clientX, e.clientY);

    if (d.kind === 'bread') {
      const m = S.molds[d.idx];
      if (!m || m.state !== 'open') return;
      if (t === 'bag') {
        if (S.bag.length >= BAG_MAX) { toast('봉투가 가득 찼어요!'); return; }
        S.bag.push({ filling: m.filling, level: lvlOf(m) });
        S.molds[d.idx] = newMold();
        SFX.bag(); renderBag(); updateMold(d.idx);
      } else if (t === 'trash') {
        SFX.trash(); S.molds[d.idx] = newMold();
        updateMold(d.idx);
      }
    } else {
      if (t === 'customer') serve(slotAt(e.clientX));
      else if (t === 'trash') { SFX.trash(); S.bag = []; renderBag(); }
    }
  }

  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
      if (drag.kind === 'bread') {
        const m = S.molds[drag.idx];
        if (m.state !== 'open') {
          if (m.state === 'baking') toast(!m.flipped ? '먼저 탭해서 뒤집어요! ↻' : lvlOf(m) === 'raw' ? '아직 덜 익었어요!' : '먼저 탭해서 열어요!');
          drag = null; return;
        }
      }
      drag.moved = true;
      makeGhost();
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    highlight(dropTarget(e.clientX, e.clientY), e.clientX);
  });
  window.addEventListener('pointerup', e => endDrag(e, false));
  window.addEventListener('pointercancel', e => endDrag(e, true));

  /* ---------- 시간 흐름 ---------- */
  function tick() {
    const now = performance.now();
    const dt = Math.min((now - S.last) / 1000, 0.5);
    S.last = now;
    if (!playing()) { SFX.sizzle(false); return; }

    S.molds.forEach((m, i) => {
      if (m.state === 'baking' && !m.flipped) {
        m.pre = Math.min(m.pre + dt, 99);                       // 덮은 뒤 경과 시간 (게이지는 아직 없음)
        if (!m.zone && m.pre >= TIMING_START) {
          m.zone = { a: 0.12 + Math.random() * (0.76 - ZONE_W) };   // 맞춰야 할 구역 위치(무작위)
          m.tm = performance.now(); m.lock = 0;
        }
      } else if (m.state === 'baking' || m.state === 'opening' || m.state === 'open') {
        m.t = Math.min(m.t + dt, 40);                           // 뒤집은 뒤부터 익힘 게이지 진행
      }
      if (m.state === 'pouring' || m.state === 'filling' || m.state === 'closing' || m.state === 'opening') {
        m.a += dt;
        if (m.state === 'pouring' && m.a >= ANIM.pour) m.state = 'batter';
        else if (m.state === 'filling' && m.a >= ANIM.fill) m.state = 'filled';
        else if (m.state === 'closing' && m.a >= ANIM.close) { m.state = 'baking'; m.t = 0; m.pre = 0; m.flipped = false; m.zone = null; }
        else if (m.state === 'opening' && m.a >= ANIM.open) m.state = 'open';
      }
      updateMold(i);
    });

    SFX.sizzle(S.molds.some(m => m.state === 'baking' || m.state === 'open'));

    S.slots.forEach((sl, i) => {
      const c = sl.c;
      if (!c || sl.busy) return;
      c.patience -= dt;
      const p = c.patience / c.patienceMax;
      if (p <= 0) {
        S.stats.lost++;
        settle(i, { mood: 'angry', line: '너무 늦네요! 그냥 갈래요!', gain: 0 });
      } else {
        const m = moodOf(p);
        if (m !== c.mood) { c.mood = m; renderCustomer(i); }
      }
    });
    updatePatience();
  }

  /* ---------- 이벤트 ---------- */
  $('tools').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (!b || !playing()) return;
    S.tool = S.tool === b.dataset.tool ? null : b.dataset.tool;
    renderTools();
  });

  $('molds').addEventListener('pointerdown', e => {
    const el = e.target.closest('.mold');
    if (!el || !playing() || drag) return;
    const i = +el.dataset.i;
    const mm = S.molds[i];
    if (mm.state === 'baking' && !mm.flipped) timingTap(i);             // 타이밍 게임은 누르는 즉시 판정
    else if (mm.state === 'baking' || mm.state === 'open') beginPress('bread', i, e, el);
    else onMold(i);
  });

  $('bag').addEventListener('pointerdown', e => {
    if (!playing() || drag || !S.bag.length) return;
    beginPress('bag', 0, e, $('bag'));
  });

  $('btnHome').addEventListener('click', () => { location.href = LOBBY; });

  // 소리 : 첫 터치/클릭 때 오디오를 켜고(브라우저 정책), 🔊 버튼으로 켜기/끄기
  const btnSound = $('btnSound');
  const syncSound = () => { btnSound.textContent = SFX.isMuted() ? '🔇' : '🔊'; };
  window.addEventListener('pointerdown', () => SFX.init());
  btnSound.addEventListener('click', () => { SFX.init(); SFX.toggle(); syncSound(); });
  syncSound();

  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'select': location.href = LOBBY; break;
      case 'next': showStory(S.day + 1); break;
      case 'go': startDay(+b.dataset.day); break;
      case 'retry': startDay(S.day); break;
    }
  });

  /* ---------- 시작 ---------- */
  // 타이밍 바 : 매 프레임 부드럽게 왕복
  (function frame() {
    const now = performance.now();
    S.molds.forEach((m, i) => {
      const el = moldEls[i];
      if (m.state === 'baking' && !m.flipped && m.zone && el.timing.style.display === 'block') {
        el.cursor.style.left = timingPos(m, now) * 100 + '%';
      }
    });
    requestAnimationFrame(frame);
  })();

  buildMolds();
  resetDay();
  setInterval(tick, 100);
  // 로비에서 넘어온 일차(?day=N)의 스토리부터 시작. 값이 없으면 로비로 되돌림
  const startDayNo = +new URLSearchParams(location.search).get('day');
  if (startDayNo >= 1 && startDayNo <= DAYS.length) showStory(startDayNo);
  else location.replace(LOBBY);
})();
