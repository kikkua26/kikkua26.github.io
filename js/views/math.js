// kikkua · 数字乐园 — 幼小衔接数学启蒙（认数字 / 点数 / 比大小 / 10 以内加减）
// 玩法：五张入口卡 → 每轮 8 题（闯关 10 题）→ 星星进度 → 完成撒花
// 交互：大按键点选、点物品手口一致点数、答对自动下一题、答错温柔重试、音效 + 语音
// 视觉复用站点设计系统，私有类统一 mt- 前缀。

import { ICONS } from '../icons.js';

const ROUND_SIZE = 8;
const QUEST_SIZE = 10;
const ITEM_POOL = ['🍎', '🍓', '🍊', '⭐', '🎈', '🐟', '🍬', '🌸', '🐣', '🍇'];
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const IC = {
    soundOn: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>`,
    soundOff: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>`,
    star: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>`,
    speak: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`,
    replay: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>`,
};

// ══════════════════════════════════════════
//  状态
// ══════════════════════════════════════════

const S = {
    mode: 'home',      // home | learn | count | compare | calc | quest
    sound: true,
    voice: true,
    touched: false,    // 有过用户手势（iOS 朗读需要）
    q: null,           // 当前题目
    index: 0,          // 已答对题数
    firstTry: 0,       // 一次就答对的题数
    total: ROUND_SIZE,
    tries: 0,
    locked: false,
    timer: null,
    learnN: 3,
    counted: 0,        // 当前题点过的物品数
    used: new Set(),   // 本轮已出过的题（去重）
};

let root = null;
let speechVoice = null;
let audioCtx = null;
let keyBound = false;
let numBuffer = '';
let numBufferTimer = null;

// ══════════════════════════════════════════
//  工具
// ══════════════════════════════════════════

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cn = (n) => CN_NUM[n] !== undefined ? CN_NUM[n] : String(n);

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// 数字 → emoji 物品数组
function items(n, emoji) {
    return Array.from({ length: n }, () => emoji);
}

// ══════════════════════════════════════════
//  音效（Web Audio 合成，零外部文件）
// ══════════════════════════════════════════

function ctx() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { audioCtx = new AC(); } catch { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
}

function tone(freq, delay, dur, gain = 0.1, type = 'sine') {
    const ac = ctx();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
}

const sfx = {
    tap() { if (S.sound) tone(760, 0, 0.07, 0.05, 'triangle'); },
    right() {
        if (!S.sound) return;
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.085, 0.22, 0.09));
    },
    wrong() {
        if (!S.sound) return;
        tone(311, 0, 0.16, 0.07, 'triangle');
        tone(247, 0.13, 0.2, 0.06, 'triangle');
    },
    star() {
        if (!S.sound) return;
        tone(1046.5, 0, 0.1, 0.06);
        tone(1568, 0.08, 0.14, 0.05);
    },
    win() {
        if (!S.sound) return;
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.11, 0.3, 0.08));
    },
};

// ══════════════════════════════════════════
//  语音
// ══════════════════════════════════════════

function pickVoice() {
    if (speechVoice) return speechVoice;
    if (!('speechSynthesis' in window)) return null;
    const zh = window.speechSynthesis.getVoices().filter((v) => /^zh/i.test(v.lang || ''));
    if (!zh.length) return null;
    const prefer = ['xiaoxiao', 'xiaoyi', 'huihui', 'yaoyao', 'tingting', 'female'];
    zh.sort((a, b) => {
        const score = (v) => {
            const n = (v.name || '').toLowerCase();
            let s = 0;
            prefer.forEach((k, i) => { if (n.includes(k)) s = Math.max(s, 100 - i * 5); });
            if (/zh[-_]?cn/i.test(v.lang)) s += 20;
            return s;
        };
        return score(b) - score(a);
    });
    speechVoice = zh[0];
    return speechVoice;
}

function say(text, { force = false } = {}) {
    if (!('speechSynthesis' in window)) return;
    if (!S.voice && !force) return;
    if (!S.touched && !force) return;      // 未发生用户交互时，移动端会被静音
    const v = pickVoice();
    if (!v) return;
    try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = v.lang || 'zh-CN';
        u.voice = v;
        u.rate = 0.86;
        u.pitch = 1.06;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    } catch { /* 静默降级 */ }
}

// 题目朗读脚本
function questionSpeech(q) {
    if (q.type === 'count') return '数一数，有几个？';
    if (q.type === 'compare') return '哪边多？';
    if (q.type === 'add') return `${q.a} 加 ${q.b} 等于几？`;
    if (q.type === 'sub') return `${q.a} 减 ${q.b} 等于几？`;
    if (q.type === 'make10') return `${q.a} 再加几，就是 10？`;
    return '';
}

// ══════════════════════════════════════════
//  出题
// ══════════════════════════════════════════

function qCount() {
    const n = rand(2, 10);
    return { type: 'count', n, emoji: pick(ITEM_POOL), answer: n };
}

function qCompare() {
    let left = rand(1, 10);
    let right = rand(1, 10);
    // 避免过多相同，但保留 1/6 的相等题
    for (let i = 0; i < 20 && left === right && Math.random() > 0.17; i++) right = rand(1, 10);
    const answer = left > right ? '>' : left < right ? '<' : '=';
    return { type: 'compare', left, right, answer };
}

function qAdd() {
    const a = rand(1, 8);
    const b = rand(1, 10 - a);
    return { type: 'add', a, b, answer: a + b };
}

function qSub() {
    const a = rand(3, 10);
    const b = rand(1, a - 1);
    return { type: 'sub', a, b, answer: a - b };
}

function qMake10() {
    const a = rand(2, 9);
    return { type: 'make10', a, b: 10 - a, answer: 10 - a };
}

function buildQuestion(mode, used) {
    const make = mode === 'count' ? qCount
        : mode === 'compare' ? qCompare
        : mode === 'calc' ? () => pick([qAdd, qAdd, qSub, qSub, qMake10])()
        : () => pick([qCount, qCompare, qAdd, qSub, qMake10])();

    let q = make();
    for (let i = 0; i < 24; i++) {
        const key = JSON.stringify(q);
        if (!used.has(key)) { used.add(key); return q; }
        q = make();
    }
    return q;
}

// ══════════════════════════════════════════
//  渲染：首页
// ══════════════════════════════════════════

const MODES = [
    { id: 'learn', tone: 'mint', icon: '🔢', name: '认数字', desc: '1 到 10，点一点听读音', go: '去看看' },
    { id: 'count', tone: 'sky', icon: '🍎', name: '数一数', desc: '数数有几个，点物品帮你数', go: '开始数' },
    { id: 'compare', tone: 'grape', icon: '⚖️', name: '比一比', desc: '哪边多？学 > < =', go: '比一比' },
    { id: 'calc', tone: 'sun', icon: '➕', name: '算一算', desc: '10 以内加减，看得见', go: '算一算' },
    { id: 'quest', tone: 'rose', icon: '🏆', name: '闯关', desc: '混合 10 题，拿满星星', go: '去闯关' },
];

function homeHTML() {
    return `
<section class="mt-hero">
    <h1 class="mt-hero-title">数字乐园</h1>
    <p class="mt-hero-sub">数一数、比一比、算一算，10 以内加减在这里学会</p>
</section>

<div class="mt-modes">
    ${MODES.map((m) => `
    <button class="mt-mode" type="button" data-mode="${m.id}" data-tone="${m.tone}">
        <span class="mt-mode-icon" aria-hidden="true">${m.icon}</span>
        <span class="mt-mode-body">
            <span class="mt-mode-name">${m.name}</span>
            <span class="mt-mode-desc">${m.desc}</span>
        </span>
        <span class="mt-mode-go">${m.go}<span aria-hidden="true">→</span></span>
    </button>`).join('')}
</div>

<footer class="mt-foot">
    <p>一轮 8 题，答对亮一颗星；答错没关系，可以再试。</p>
</footer>`;
}

// ══════════════════════════════════════════
//  渲染：认数字
// ══════════════════════════════════════════

function learnHTML() {
    const n = S.learnN;
    const emoji = '⭐';
    return `
<div class="mt-learn">
    <div class="mt-learn-card">
        <button class="mt-learn-num" type="button" data-action="say-num" aria-label="读一读 ${n}">${n}</button>
        <div class="mt-learn-cn">${cn(n)}</div>
        <div class="mt-learn-items">${items(n, emoji).map(() => `<span class="mt-learn-item">${emoji}</span>`).join('')}</div>
        <button class="mt-learn-say" type="button" data-action="say-num">${IC.speak}<span>读一读</span></button>
    </div>
    <div class="mt-learn-picker" role="group" aria-label="选择数字">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map((v) => `
        <button class="mt-learn-key${v === n ? ' is-on' : ''}" type="button" data-learn="${v}" aria-pressed="${v === n}">${v}</button>`).join('')}
    </div>
    <p class="mt-learn-tip">点数字听一听，再看看有几个 ⭐</p>
</div>`;
}

// ══════════════════════════════════════════
//  渲染：题目
// ══════════════════════════════════════════

function itemsHTML(list) {
    return list.map((emoji, i) => `<button class="mt-item" type="button" data-item="${i}" aria-label="${emoji}">
            <span class="mt-item-emoji" aria-hidden="true">${emoji}</span>
            <span class="mt-item-tag" aria-hidden="true"></span>
        </button>`).join('');
}

// 算式行：{k:'num'} 数字 / {k:'op'} 运算符 / {k:'slot'} 待填答案
function eqHTML(parts) {
    return `<div class="mt-eq">${parts.map((p) => {
        if (p.k === 'op') return `<span class="mt-eq-op" aria-hidden="true">${p.v}</span>`;
        if (p.k === 'slot') return `<span class="mt-slot" data-slot>?</span>`;
        return `<span class="mt-eq-num">${p.v}</span>`;
    }).join('')}</div>`;
}

function questionHTML(q) {
    if (q.type === 'count') {
        return `
<div class="mt-q-head">
    <span class="mt-q-title">数一数，有几个？</span>
</div>
<div class="mt-board" data-kind="count">
    <div class="mt-items mt-items--grid" data-group="all">${itemsHTML(items(q.n, q.emoji))}</div>
</div>
<div class="mt-counter" data-counter aria-live="polite">点一下物品，帮你数</div>`;
    }

    if (q.type === 'compare') {
        return `
<div class="mt-q-head">
    <span class="mt-q-title">哪边多？点中间合适的符号</span>
</div>
<div class="mt-board" data-kind="compare">
    <div class="mt-compare-grid">
        <div class="mt-compare-cell">
            <div class="mt-items mt-items--small" data-group="left">${itemsHTML(items(q.left, '🍎'))}</div>
            <div class="mt-compare-num">${q.left}</div>
        </div>
        <div class="mt-compare-mid"><span class="mt-slot mt-slot--mid" data-slot>?</span></div>
        <div class="mt-compare-cell">
            <div class="mt-items mt-items--small" data-group="right">${itemsHTML(items(q.right, '🍊'))}</div>
            <div class="mt-compare-num">${q.right}</div>
        </div>
    </div>
</div>
<div class="mt-counter" data-counter aria-live="polite">可以点物品数一数</div>`;
    }

    if (q.type === 'add') {
        // 两组用不同水果区分；第二组另起一行，避免混在同一行里数不清
        return `
<div class="mt-q-head">
    <span class="mt-q-title">算一算，一共几个？</span>
</div>
<div class="mt-board" data-kind="add">
    <div class="mt-figgrid">
        ${itemsHTML(items(q.a, '🍎'))}
        <div class="mt-figrow">${itemsHTML(items(q.b, '🍊'))}</div>
    </div>
    ${eqHTML([{ k: 'num', v: q.a }, { k: 'op', v: '+' }, { k: 'num', v: q.b }, { k: 'op', v: '=' }, { k: 'slot' }])}
</div>
<div class="mt-counter" data-counter aria-live="polite">红苹果 ${q.a} 个，橙子 ${q.b} 个，合起来几个？</div>`;
    }

    if (q.type === 'sub') {
        const a = items(q.a, '🍎');
        const kept = q.a - q.b;
        return `
<div class="mt-q-head">
    <span class="mt-q-title">算一算，还剩几个？</span>
</div>
<div class="mt-board" data-kind="sub">
    <div class="mt-figgrid">
        ${a.map((emoji, i) => `
        <button class="mt-item${i >= kept ? ' is-ghost' : ''}" type="button" data-item="${i}" aria-label="${emoji}">
            <span class="mt-item-emoji" aria-hidden="true">${emoji}</span>
            <span class="mt-item-tag" aria-hidden="true">${i >= kept ? '✕' : ''}</span>
        </button>`).join('')}
    </div>
    ${eqHTML([{ k: 'num', v: q.a }, { k: 'op', v: '−' }, { k: 'num', v: q.b }, { k: 'op', v: '=' }, { k: 'slot' }])}
</div>
<div class="mt-counter" data-counter aria-live="polite">划掉的 ${q.b} 个拿走了，还剩几个？</div>`;
    }

    // make10：凑十 —— 一排 10 个格子，前面已有 a 个，后面空着
    return `
<div class="mt-q-head">
    <span class="mt-q-title">再添几个，正好是 10？</span>
</div>
<div class="mt-board" data-kind="make10">
    <div class="mt-figgrid">
        ${itemsHTML(items(q.a, '🍬'))}
        ${Array.from({ length: q.b }, () => '<span class="mt-hole" aria-hidden="true"></span>').join('')}
    </div>
    ${eqHTML([{ k: 'num', v: q.a }, { k: 'op', v: '+' }, { k: 'slot' }, { k: 'op', v: '=' }, { k: 'num', v: 10 }])}
</div>
<div class="mt-counter" data-counter aria-live="polite">还差几个空位？</div>`;
}

function answersHTML(q) {
    if (q.type === 'compare') {
        const opts = [
            { v: '>', label: '大于' },
            { v: '=', label: '等于' },
            { v: '<', label: '小于' },
        ];
        return `<div class="mt-signs">${opts.map((o) => `
            <button class="mt-sign" type="button" data-sign="${o.v}" aria-label="${o.label}">
                <span class="mt-sign-glyph">${o.v}</span>
                <span class="mt-sign-label">${o.label}</span>
            </button>`).join('')}</div>`;
    }
    const nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    return `<div class="mt-pad">${nums.map((n) => `
        <button class="mt-key" type="button" data-num="${n}">${n}</button>`).join('')}</div>`;
}

function starsHTML(filled) {
    return Array.from({ length: S.total }, (_, i) =>
        `<span class="mt-star${i < filled ? ' is-on' : ''}">${IC.star}</span>`).join('');
}

// ══════════════════════════════════════════
//  渲染：完成
// ══════════════════════════════════════════

function doneHTML() {
    const total = S.total;
    const perfect = S.firstTry === total;
    const words = perfect
        ? pick(['太厉害了，一次都没错！', '全部一次答对，真棒！', '好厉害，满分星星！'])
        : S.firstTry >= total * 0.6
            ? '很棒，大部分一次就答对了！'
            : '这一轮完成啦，再练一次会更快！';
    return `
<div class="mt-done-card">
    <div class="mt-done-emoji" aria-hidden="true">${perfect ? '🏆' : '🎉'}</div>
    <h2 class="mt-done-title">${words}</h2>
    <p class="mt-done-sub">一轮 ${total} 题 · 一次答对 ${S.firstTry} 题</p>
    <div class="mt-done-stars">${Array.from({ length: total }, () => `<span class="mt-done-star">${IC.star}</span>`).join('')}</div>
    <div class="mt-done-actions">
        <button class="mt-btn mt-btn--primary" type="button" data-action="again">再玩一次</button>
        <button class="mt-btn" type="button" data-action="home">换一种玩法</button>
    </div>
</div>
<div class="mt-confetti" aria-hidden="true">
    ${Array.from({ length: 26 }, () => {
        const e = pick(['⭐', '🌟', '🎈', '✨', '🍎', '🍬']);
        const left = rand(2, 96);
        const delay = (Math.random() * 1.2).toFixed(2);
        const dur = (1.8 + Math.random() * 1.4).toFixed(2);
        return `<span style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s">${e}</span>`;
    }).join('')}
</div>`;
}

// ══════════════════════════════════════════
//  画面切换
// ══════════════════════════════════════════

function $(sel) {
    return root && root.querySelector(sel);
}

function showHome() {
    S.mode = 'home';
    clearTimeout(S.timer);
    const title = $('#mtTitle');
    if (title) title.textContent = '儿童数学';
    const home = $('#mtHome');
    const play = $('#mtPlay');
    const done = $('#mtDone');
    if (home) {
        home.hidden = false;
        home.innerHTML = homeHTML();
    }
    if (play) play.hidden = true;
    if (done) done.hidden = true;
    root.scrollTo({ top: 0, behavior: 'smooth' });
}

function startMode(mode) {
    S.touched = true;
    S.mode = mode;
    S.index = 0;
    S.firstTry = 0;
    S.tries = 0;
    S.q = null;
    S.counted = 0;
    S.used = new Set();
    S.total = mode === 'quest' ? QUEST_SIZE : ROUND_SIZE;
    clearTimeout(S.timer);

    const home = $('#mtHome');
    const play = $('#mtPlay');
    const done = $('#mtDone');
    if (home) home.hidden = true;
    if (done) done.hidden = true;
    if (!play) return;
    play.hidden = false;

    const title = $('#mtTitle');
    if (title) title.textContent = mode === 'learn' ? '认数字' : (MODES.find((m) => m.id === mode) || {}).name || '儿童数学';

    if (mode === 'learn') {
        $('#mtStars').innerHTML = '<span class="mt-bar-tip">1 到 10，随便点</span>';
        $('#mtExit').hidden = false;
        $('#mtQuestion').innerHTML = learnHTML();
        $('#mtAnswers').innerHTML = '';
        $('#mtHint').textContent = '';
        say('这是 ' + S.learnN, { force: false });
        return;
    }

    $('#mtStars').innerHTML = starsHTML(0);
    $('#mtExit').hidden = false;
    nextQuestion();
    root.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextQuestion() {
    clearTimeout(S.timer);
    S.tries = 0;
    S.locked = false;
    S.counted = 0;

    if (S.index >= S.total) {
        finish();
        return;
    }

    S.q = buildQuestion(S.mode, S.used);
    const qEl = $('#mtQuestion');
    const aEl = $('#mtAnswers');
    const hint = $('#mtHint');
    if (!qEl || !aEl) return;
    qEl.innerHTML = questionHTML(S.q);
    aEl.innerHTML = answersHTML(S.q);
    if (hint) hint.textContent = '';
    $('#mtStars').innerHTML = starsHTML(S.index);

    // 入场动画：物品逐个弹出
    const its = qEl.querySelectorAll('.mt-item');
    its.forEach((el, i) => {
        el.style.animationDelay = Math.min(i * 32, 420) + 'ms';
        el.classList.add('is-in');
    });

    say(questionSpeech(S.q));
}

function finish() {
    clearTimeout(S.timer);
    const play = $('#mtPlay');
    const done = $('#mtDone');
    if (play) play.hidden = true;
    if (done) {
        done.hidden = false;
        done.innerHTML = doneHTML();
    }
    sfx.win();
    say(S.firstTry === S.total ? '太厉害了，全部一次答对！' : '这一轮完成啦，你真棒！');
    root.scrollTo({ top: 0, behavior: 'smooth' });
}

// ══════════════════════════════════════════
//  答题
// ══════════════════════════════════════════

function setHint(text) {
    const el = $('#mtHint');
    if (el) el.textContent = text || '';
}

function bumpStar() {
    const stars = root.querySelectorAll('.mt-star');
    const el = stars[S.index - 1];
    if (el) {
        el.classList.add('is-on', 'is-pop');
        setTimeout(() => el.classList.remove('is-pop'), 700);
    }
}

function onRight(btn) {
    S.locked = true;
    S.index += 1;
    if (S.tries === 0) S.firstTry += 1;
    if (btn) btn.classList.add('is-right');
    root.querySelectorAll('button').forEach((b) => {
        if (b !== btn && (b.classList.contains('mt-key') || b.classList.contains('mt-sign'))) b.classList.add('is-dim');
    });
    sfx.right();
    setTimeout(() => sfx.star(), 260);
    bumpStar();

    const slot = $('[data-slot]');
    if (slot) {
        slot.textContent = S.q.answer;
        slot.classList.add('is-filled');
    }

    const counter = $('[data-counter]');
    if (counter && S.q.type === 'count') counter.textContent = `一共 ${S.q.n} 个`;

    const praise = pick(['对啦！', '真棒！', '好厉害！', '答对了！']);
    setHint(praise);
    say(praise);

    if (navigator.vibrate) { try { navigator.vibrate(14); } catch { /* ignore */ } }

    S.timer = setTimeout(() => {
        nextQuestion();
    }, 1150);
}

function onWrong(btn) {
    S.tries += 1;
    sfx.wrong();
    if (btn) {
        btn.classList.add('is-wrong');
        setTimeout(() => btn.classList.remove('is-wrong'), 520);
    }
    if (S.tries >= 2) {
        setHint(hintText());
        highlightAnswer();
    } else {
        setHint(pick(['再数一数？', '差一点点，再试试', '不着急，慢慢来']));
    }
    say(S.tries >= 2 ? hintText() : '再试试');
}

function hintText() {
    const q = S.q;
    if (!q) return '';
    if (q.type === 'count') return `一共 ${q.n} 个哦`;
    if (q.type === 'compare') return q.answer === '=' ? '两边一样多，用 =' : `大数在${q.answer === '>' ? '左' : '右'}边，开口朝大的`;
    if (q.type === 'make10') return `还差 ${q.answer} 个`;
    return `答案是 ${q.answer}`;
}

function highlightAnswer() {
    const q = S.q;
    if (!q) return;
    const sel = q.type === 'compare' ? `[data-sign="${q.answer}"]` : `[data-num="${q.answer}"]`;
    const btn = root.querySelector(sel);
    if (btn) btn.classList.add('is-hint');
}

function answer(value) {
    if (S.locked || !S.q) return;
    S.touched = true;
    const attr = S.q.type === 'compare' ? 'sign' : 'num';
    const btn = root.querySelector(`[data-${attr}="${value}"]`);
    if (String(value) === String(S.q.answer)) onRight(btn);
    else onWrong(btn);
}

// 点物品：手口一致点数
function tapItem(el) {
    if (S.locked || !el) return;
    S.touched = true;
    if (el.classList.contains('is-counted') || el.classList.contains('is-ghost')) return;
    el.classList.add('is-counted');
    S.counted += 1;
    const tag = el.querySelector('.mt-item-tag');
    if (tag) tag.textContent = String(S.counted);
    sfx.tap();
    say(cn(S.counted));

    const counter = $('[data-counter]');
    if (counter) counter.textContent = `数到 ${S.counted} 了`;

    if (S.q && S.q.type === 'count' && S.counted === S.q.n) {
        setTimeout(() => {
            const c = $('[data-counter]');
            if (c) c.textContent = `${S.q.n} 个，选出这个数字吧`;
        }, 380);
    }
}

// 认数字：切换数字
function setLearnNum(n) {
    S.learnN = n;
    S.touched = true;
    const qEl = $('#mtQuestion');
    if (qEl) qEl.innerHTML = learnHTML();
    sfx.tap();
    say(n === 10 ? '十，十个' : `这是${cn(n)}，${cn(n)}个`);
}

// ══════════════════════════════════════════
//  事件
// ══════════════════════════════════════════

function toggleSound() {
    S.sound = !S.sound;
    const btn = root.querySelector('[data-action="sound"]');
    if (btn) {
        btn.classList.toggle('is-off', !S.sound);
        btn.setAttribute('aria-pressed', String(S.sound));
        btn.innerHTML = (S.sound ? IC.soundOn : IC.soundOff) + '<i>音效</i>';
    }
    if (S.sound) sfx.tap();
    toast(S.sound ? '音效已开' : '音效已关');
}

function toggleVoice() {
    S.voice = !S.voice;
    const btn = root.querySelector('[data-action="voice"]');
    if (btn) {
        btn.classList.toggle('is-off', !S.voice);
        btn.setAttribute('aria-pressed', String(S.voice));
        btn.innerHTML = IC.speak + '<i>朗读</i>';
    }
    if (S.voice) say('朗读打开了', { force: true });
    toast(S.voice ? '朗读已开' : '朗读已关');
}

function toast(msg) {
    if (!root) return;
    let el = root.querySelector('.mt-toast');
    if (!el) {
        el = document.createElement('div');
        el.className = 'mt-toast';
        el.setAttribute('role', 'status');
        root.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-on'), 1800);
}

function onClick(e) {
    S.touched = true;

    const mode = e.target.closest('[data-mode]');
    if (mode) {
        startMode(mode.dataset.mode);
        return;
    }

    const key = e.target.closest('.mt-key');
    if (key) {
        sfx.tap();
        answer(key.dataset.num);
        return;
    }

    const sign = e.target.closest('.mt-sign');
    if (sign) {
        sfx.tap();
        answer(sign.dataset.sign);
        return;
    }

    const item = e.target.closest('.mt-item');
    if (item && !item.classList.contains('is-ghost')) {
        tapItem(item);
        return;
    }

    const learn = e.target.closest('[data-learn]');
    if (learn) {
        setLearnNum(Number(learn.dataset.learn));
        return;
    }

    const act = e.target.closest('[data-action]');
    if (!act) return;

    switch (act.dataset.action) {
        case 'sound': toggleSound(); break;
        case 'voice': toggleVoice(); break;
        case 'home': showHome(); break;
        case 'again': startMode(S.mode); break;
        case 'exit': showHome(); break;
        case 'say-num':
            S.touched = true;
            sfx.tap();
            say(`这是${cn(S.learnN)}，${cn(S.learnN)}个`, { force: true });
            break;
        case 'replay':
            say(questionSpeech(S.q));
            replayAnim();
            break;
        default: break;
    }
}

function replayAnim() {
    const qEl = $('#mtQuestion');
    if (!qEl) return;
    qEl.querySelectorAll('.mt-item').forEach((el, i) => {
        el.style.animationDelay = Math.min(i * 32, 420) + 'ms';
        el.classList.remove('is-in');
        void el.offsetWidth;
        el.classList.add('is-in');
    });
}

function onKeydown(e) {
    if (!root || !root.isConnected) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (S.mode === 'home' || S.mode === 'learn' || !S.q) return;

    if (e.key === 'Escape') {
        showHome();
        return;
    }
    if (e.key === 'Enter') {
        say(questionSpeech(S.q));
        return;
    }

    // 比大小用符号作答，键盘只保留 Esc / Enter
    if (S.q.type === 'compare') return;

    if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        // 先按 1 再按 0 组合成 10（300ms 窗口），其余数字立即作答
        if (e.key === '1') {
            numBuffer = '1';
            clearTimeout(numBufferTimer);
            numBufferTimer = setTimeout(() => {
                numBuffer = '';
                answer(1);
            }, 300);
            return;
        }
        if (e.key === '0' && numBuffer === '1') {
            clearTimeout(numBufferTimer);
            numBuffer = '';
            answer(10);
            return;
        }
        numBuffer = '';
        answer(Number(e.key));
    }
}

// ══════════════════════════════════════════
//  入口
// ══════════════════════════════════════════

export function renderMath() {
    const app = document.getElementById('app');
    if (!app) return;

    S.mode = 'home';
    S.index = 0;
    S.q = null;
    S.locked = false;
    S.tries = 0;
    S.counted = 0;

    root = document.createElement('div');
    root.className = 'page mt-page';
    root.innerHTML = `
<header class="header mt-header">
    <div class="header-inner mt-header-inner">
        <div class="header-left">
            <a href="/kids" class="back-btn" data-link aria-label="返回儿童导航">${ICONS.back}</a>
            <span class="header-title" id="mtTitle">儿童数学</span>
        </div>
        <div class="header-right">
            <button class="mt-hbtn" type="button" data-action="sound" aria-pressed="true" aria-label="音效开关">${IC.soundOn}<i>音效</i></button>
            <button class="mt-hbtn" type="button" data-action="voice" aria-pressed="true" aria-label="朗读开关">${IC.speak}<i>朗读</i></button>
        </div>
    </div>
</header>

<main class="mt-main">
    <section class="mt-home" id="mtHome"></section>

    <section class="mt-play" id="mtPlay" hidden>
        <div class="mt-bar">
            <div class="mt-stars" id="mtStars" aria-label="进度星星"></div>
            <div class="mt-bar-right">
                <button class="mt-icon-btn" type="button" data-action="replay" aria-label="再听一遍">${IC.replay}</button>
                <button class="mt-exit" type="button" data-action="exit" id="mtExit">换玩法</button>
            </div>
        </div>
        <div class="mt-question" id="mtQuestion"></div>
        <div class="mt-answers" id="mtAnswers"></div>
        <div class="mt-hint" id="mtHint" aria-live="polite"></div>
    </section>

    <section class="mt-done" id="mtDone" hidden></section>
</main>`;

    app.replaceChildren(root);
    root.addEventListener('click', onClick);
    if (!keyBound) {
        document.addEventListener('keydown', onKeydown);
        keyBound = true;
    }

    showHome();
}
