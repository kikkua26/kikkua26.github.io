// kikkua · 数字乐园 — 幼小衔接数学启蒙
//
// 教学主线（按认知顺序，每种玩法解决一件具体的事）：
//   1 认数字   十格阵数感：5 个一组，一眼看出多与少，不做机械数数
//   2 分与合   整体与部分：亲手把苹果分进两个筐，发现 5 = 2 和 3（加减法的根）
//   3 凑十     十格阵填空：8 再加几个满 10，这是 20 以内进位加法的核心技巧
//   4 算一算   数轴跳跃：加法从大数接着数、减法往回数，看见"怎么算"而不是数总数
//   5 闯关     混合 10 题
//
// 交互：大按键、点格子/点苹果都能动手、答对自动切题、答错给策略提示、音效 + 中文语音
// 视觉：复用站点设计系统，私有类统一 mt- 前缀。

import { ICONS } from '../icons.js';

const ROUND_SIZE = 8;
const QUEST_SIZE = 10;
const FRAME_TOTAL = 10;

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

const IC = {
    soundOn: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>`,
    soundOff: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>`,
    star: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z"/></svg>`,
    speak: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>`,
    lightbulb: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z"/></svg>`,
    play: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>`,
};

// ══════════════════════════════════════════
//  状态
// ══════════════════════════════════════════

const S = {
    mode: 'home',
    sound: true,
    voice: true,
    touched: false,
    q: null,
    index: 0,
    firstTry: 0,
    total: ROUND_SIZE,
    tries: 0,
    locked: false,
    timer: null,
    learnN: 5,
    used: new Set(),
    // 凑十：孩子点亮的额外格子数
    filled: 0,
    hopping: false,
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
const cn = (n) => (CN_NUM[n] !== undefined ? CN_NUM[n] : String(n));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function $(sel) {
    return root && root.querySelector(sel);
}

// ══════════════════════════════════════════
//  音效
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
    drop() { if (S.sound) { tone(520, 0, 0.1, 0.06); tone(700, 0.05, 0.1, 0.05); } },
    hop() { if (S.sound) tone(620, 0, 0.09, 0.06, 'triangle'); },
    right() { if (S.sound) [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.085, 0.22, 0.09)); },
    wrong() { if (S.sound) { tone(311, 0, 0.16, 0.07, 'triangle'); tone(247, 0.13, 0.2, 0.06, 'triangle'); } },
    win() { if (S.sound) [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, i * 0.11, 0.3, 0.08)); },
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
    const score = (v) => {
        const n = (v.name || '').toLowerCase();
        let s = 0;
        prefer.forEach((k, i) => { if (n.includes(k)) s = Math.max(s, 100 - i * 5); });
        if (/zh[-_]?cn/i.test(v.lang)) s += 20;
        return s;
    };
    zh.sort((a, b) => score(b) - score(a));
    speechVoice = zh[0];
    return speechVoice;
}

function say(text, { force = false } = {}) {
    if (!('speechSynthesis' in window)) return;
    if (!S.voice && !force) return;
    if (!S.touched && !force) return;
    const v = pickVoice();
    if (!v) return;
    try {
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = v.lang || 'zh-CN';
        u.voice = v;
        u.rate = 0.86;
        u.pitch = 1.06;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    } catch { /* 静默降级 */ }
}

// ══════════════════════════════════════════
//  题目生成
// ══════════════════════════════════════════

function qSplit() {
    const n = rand(4, 10);
    const part = rand(1, n - 1);
    return { type: 'split', n, part, answer: n - part };
}

function qTenframe() {
    const a = rand(3, 9);
    return { type: 'tenframe', a, b: FRAME_TOTAL - a, answer: FRAME_TOTAL - a };
}

function qAdd() {
    // 结果不超过 10；加法用"接着数"策略，所以 b 取小一点更贴近幼小衔接
    const a = rand(2, 8);
    const b = rand(1, Math.min(4, 10 - a));
    return { type: 'add', a, b, answer: a + b };
}

function qSub() {
    const a = rand(5, 10);
    const b = rand(1, Math.min(4, a - 1));
    return { type: 'sub', a, b, answer: a - b };
}

function qCompare() {
    let a = rand(2, 10);
    let b = rand(2, 10);
    for (let i = 0; i < 12 && a === b; i++) b = rand(2, 10);
    return { type: 'compare', a, b, answer: a > b ? '>' : a < b ? '<' : '=' };
}

function buildQuestion(mode, used) {
    const make = mode === 'split' ? qSplit
        : mode === 'tenframe' ? qTenframe
        : mode === 'calc' ? () => pick([qAdd, qAdd, qSub, qSub, qTenframe, qSplit])()
        : () => pick([qSplit, qTenframe, qAdd, qSub, qCompare])();

    let q = make();
    for (let i = 0; i < 24; i++) {
        const key = JSON.stringify(q);
        if (!used.has(key)) { used.add(key); return q; }
        q = make();
    }
    return q;
}

// 每题朗读
function questionSpeech(q) {
    if (!q) return '';
    if (q.type === 'split') return `${q.n} 可以分成 ${q.part} 和几？`;
    if (q.type === 'tenframe') return `已经有 ${q.a} 个，再放几个就是 10 个？`;
    if (q.type === 'add') return `${q.a} 加 ${q.b} 等于几？`;
    if (q.type === 'sub') return `${q.a} 减 ${q.b} 等于几？`;
    if (q.type === 'compare') return '哪边多？';
    return '';
}

// 策略提示（答错两次后给出，教方法而不是报答案）
function strategyHint(q) {
    if (!q) return '';
    if (q.type === 'split') {
        return `把 ${q.part} 个苹果放进红筐，剩下的就是 ${q.answer} 个`;
    }
    if (q.type === 'tenframe') {
        return `十格阵还空着 ${q.answer} 格，填满就是 10`;
    }
    if (q.type === 'add') {
        const steps = [];
        for (let i = 1; i <= q.b; i++) steps.push(q.a + i);
        return `从 ${q.a} 往后数 ${q.b} 个：${steps.join('、')}`;
    }
    if (q.type === 'sub') {
        const steps = [];
        for (let i = 1; i <= q.b; i++) steps.push(q.a - i);
        return `从 ${q.a} 往回数 ${q.b} 个：${steps.join('、')}`;
    }
    if (q.type === 'compare') {
        return q.answer === '=' ? '两边一样多，用 =' : `开口对着多的那一边，是 ${q.answer}`;
    }
    return '';
}

// ══════════════════════════════════════════
//  渲染：首页
// ══════════════════════════════════════════

const MODES = [
    {
        id: 'learn', tone: 'mint', icon: '🔢', name: '认数字',
        desc: '十格阵看数量，5 个一组一眼认出', goal: '数感', go: '看一看',
    },
    {
        id: 'split', tone: 'sky', icon: '🍎', name: '分与合',
        desc: '5 分成 2 和几？亲手分苹果找出答案', goal: '加减法的基础', go: '分一分',
    },
    {
        id: 'tenframe', tone: 'grape', icon: '🧩', name: '凑十',
        desc: '再放几个正好满 10 格？这是进位加法的钥匙', goal: '凑十法', go: '凑一凑',
    },
    {
        id: 'calc', tone: 'sun', icon: '➕', name: '算一算',
        desc: '在数轴上接着数、往回数，看见怎么算', goal: '加减策略', go: '算一算',
    },
    {
        id: 'quest', tone: 'rose', icon: '🏆', name: '闯关',
        desc: '四种题型混合 10 题，都答对拿满星星', goal: '综合', go: '去闯关',
    },
];

function homeHTML() {
    return `
<section class="mt-hero">
    <h1 class="mt-hero-title">数字乐园</h1>
    <p class="mt-hero-sub">不靠数手指：先认出数量，再学会分与合，最后在数轴上算</p>
</section>

<div class="mt-modes">
    ${MODES.map((m) => `
    <button class="mt-mode" type="button" data-mode="${m.id}" data-tone="${m.tone}">
        <span class="mt-mode-icon" aria-hidden="true">${m.icon}</span>
        <span class="mt-mode-body">
            <span class="mt-mode-name">${m.name}<em class="mt-mode-goal">${m.goal}</em></span>
            <span class="mt-mode-desc">${m.desc}</span>
        </span>
        <span class="mt-mode-go">${m.go}<span aria-hidden="true">→</span></span>
    </button>`).join('')}
</div>

<footer class="mt-foot">
    <p>一轮 8 题 · 答对亮一颗星 · 答错会给方法提示，不扣星</p>
</footer>`;
}

// ══════════════════════════════════════════
//  组件：十格阵
// ══════════════════════════════════════════

// filled：已填格数；holes：允许点亮的空格（凑十模式）
function frameHTML(filled, { interactive = false, count = FRAME_TOTAL, holes = 0 } = {}) {
    let cells = '';
    for (let i = 0; i < count; i++) {
        const on = i < filled;
        const hole = !on && i < filled + holes;
        cells += `<span class="mt-cell${on ? ' is-on' : ''}${hole ? ' is-hole' : ''}" data-cell="${i}"${interactive && hole ? ' role="button" tabindex="0"' : ''}></span>`;
    }
    return `<div class="mt-frame" data-frame>${cells}</div>`;
}

// ══════════════════════════════════════════
//  组件：分苹果（池子 / 红筐 / 绿筐）
// ══════════════════════════════════════════

function applesHTML(count, zone, offset) {
    return Array.from({ length: count }, (_, i) => `
        <button class="mt-apple" type="button" data-apple="${zone}" data-idx="${offset + i}" aria-label="苹果">
            <span aria-hidden="true">🍎</span>
        </button>`).join('');
}

function splitHTML(q) {
    return `
<div class="mt-split">
    <div class="mt-basket mt-basket--left" data-zone="pool">
        <div class="mt-basket-items">${applesHTML(q.n, 'pool', 0)}</div>
        <div class="mt-basket-tag">还没分</div>
    </div>
    <div class="mt-split-arrow" aria-hidden="true">→</div>
    <div class="mt-basket mt-basket--right" data-zone="red">
        <div class="mt-basket-items"></div>
        <div class="mt-basket-tag mt-basket-tag--red">分出来 ${q.part} 个</div>
    </div>
</div>`;
}

// ══════════════════════════════════════════
//  组件：数轴
// ══════════════════════════════════════════

function lineHTML(from, to) {
    const p1 = (from / 10) * 100;
    const p2 = (to / 10) * 100;
    const left = Math.min(p1, p2);
    const width = Math.abs(p2 - p1);
    const ticks = Array.from({ length: 11 }, (_, i) =>
        `<span class="mt-tick${i === from ? ' is-start' : ''}${i === to ? ' is-end' : ''}"><b>${i}</b></span>`).join('');
    return `
<div class="mt-line" data-line>
    <div class="mt-line-inner">
        <span class="mt-arc" style="left:${left}%;width:${width}%" aria-hidden="true"></span>
        <div class="mt-line-track">
            ${ticks}
            <span class="mt-line-mark" data-mark style="left:${p1}%">${from}</span>
        </div>
    </div>
</div>`;
}

// ══════════════════════════════════════════
//  渲染：题目
// ══════════════════════════════════════════

function questionHTML(q) {
    if (q.type === 'split') {
        return `
<div class="mt-q-head">
    <span class="mt-q-title">${q.n} 可以分成 <b>${q.part}</b> 和几？</span>
</div>
<div class="mt-stage">
    ${splitHTML(q)}
    <div class="mt-stage-note">点左边苹果，把 ${q.part} 个分到右边</div>
</div>
<div class="mt-eq">
    <span class="mt-eq-num">${q.n}</span>
    <span class="mt-eq-op">=</span>
    <span class="mt-eq-num">${q.part}</span>
    <span class="mt-eq-op">+</span>
    <span class="mt-slot" data-slot>?</span>
</div>`;
    }

    if (q.type === 'tenframe') {
        return `
<div class="mt-q-head">
    <span class="mt-q-title">已经有 <b>${q.a}</b> 个，再放几个正好满 10？</span>
</div>
<div class="mt-stage">
    ${frameHTML(q.a + S.filled, { interactive: true, holes: q.b - S.filled })}
    <div class="mt-stage-note">点空格子把点放进去，填满看看</div>
</div>
<div class="mt-eq">
    <span class="mt-eq-num">${q.a}</span>
    <span class="mt-eq-op">+</span>
    <span class="mt-slot" data-slot>?</span>
    <span class="mt-eq-op">=</span>
    <span class="mt-eq-num">10</span>
</div>`;
    }

    if (q.type === 'add') {
        return `
<div class="mt-q-head">
    <span class="mt-q-title">算一算：从 ${q.a} 接着往后数</span>
</div>
<div class="mt-stage">
    ${lineHTML(q.a, q.a + q.b)}
    <button class="mt-show" type="button" data-action="show-how">${IC.play}<span>看怎么跳</span></button>
</div>
<div class="mt-eq">
    <span class="mt-eq-num">${q.a}</span>
    <span class="mt-eq-op">+</span>
    <span class="mt-eq-num">${q.b}</span>
    <span class="mt-eq-op">=</span>
    <span class="mt-slot" data-slot>?</span>
</div>`;
    }

    if (q.type === 'sub') {
        return `
<div class="mt-q-head">
    <span class="mt-q-title">算一算：从 ${q.a} 往回数</span>
</div>
<div class="mt-stage">
    ${lineHTML(q.a, q.a - q.b)}
    <button class="mt-show" type="button" data-action="show-how">${IC.play}<span>看怎么退</span></button>
</div>
<div class="mt-eq">
    <span class="mt-eq-num">${q.a}</span>
    <span class="mt-eq-op">−</span>
    <span class="mt-eq-num">${q.b}</span>
    <span class="mt-eq-op">=</span>
    <span class="mt-slot" data-slot>?</span>
</div>`;
    }

    // compare：两个十格阵比多少
    return `
<div class="mt-q-head">
    <span class="mt-q-title">哪边多？点中间合适的符号</span>
</div>
<div class="mt-stage">
    <div class="mt-compare">
        <div class="mt-compare-col">
            ${frameHTML(q.a)}
            <span class="mt-compare-num">${q.a}</span>
        </div>
        <span class="mt-slot mt-slot--mid" data-slot>?</span>
        <div class="mt-compare-col">
            ${frameHTML(q.b)}
            <span class="mt-compare-num">${q.b}</span>
        </div>
    </div>
</div>`;
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
//  渲染：认数字（自由探索）
// ══════════════════════════════════════════

function learnHTML() {
    const n = S.learnN;
    return `
<div class="mt-learn">
    <p class="mt-learn-head">十格阵：上排 5 个、下排 5 个，一眼看出有几个</p>
    <div class="mt-learn-main">
        ${frameHTML(n)}
        <div class="mt-learn-num-row">
            <span class="mt-learn-num">${n}</span>
            <span class="mt-learn-cn">${cn(n)}</span>
        </div>
        <button class="mt-show" type="button" data-action="say-num">${IC.speak}<span>读一读</span></button>
        <p class="mt-learn-tip">${n >= 6 ? `满了一排 5 个，再加 ${n - 5} 个，就是 ${n}` : `${n} 个还没排满第一排`}</p>
    </div>
    <div class="mt-learn-picker" role="group" aria-label="选择数字">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map((v) => `
        <button class="mt-learn-key${v === n ? ' is-on' : ''}" type="button" data-learn="${v}" aria-pressed="${v === n}">${v}</button>`).join('')}
    </div>
</div>`;
}

// ══════════════════════════════════════════
//  渲染：完成
// ══════════════════════════════════════════

function doneHTML() {
    const total = S.total;
    const perfect = S.firstTry === total;
    const words = perfect
        ? pick(['全对！一次都没错', '太厉害了，满分星星', '思路很稳，全对'])
        : S.firstTry >= total * 0.6
            ? '大部分一次就对了，不错'
            : '做完了，再来一轮会更熟';
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
        return `<span style="left:${rand(2, 96)}%;animation-delay:${(Math.random() * 1.2).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.4).toFixed(2)}s">${e}</span>`;
    }).join('')}
</div>`;
}

// ══════════════════════════════════════════
//  画面切换
// ══════════════════════════════════════════

function showHome() {
    S.mode = 'home';
    clearTimeout(S.timer);
    const title = $('#mtTitle');
    if (title) title.textContent = '儿童数学';
    const home = $('#mtHome');
    const play = $('#mtPlay');
    const done = $('#mtDone');
    if (home) { home.hidden = false; home.innerHTML = homeHTML(); }
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
    S.filled = 0;
    S.hopping = false;

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
    const stars = $('#mtStars');
    if (stars) stars.innerHTML = starsHTML(S.index);

    // 入场动画
    qEl.querySelectorAll('.mt-cell, .mt-apple, .mt-tick').forEach((el, i) => {
        el.style.animationDelay = Math.min(i * 26, 360) + 'ms';
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
    say(S.firstTry === S.total ? '全部一次答对，太厉害了' : '这一轮完成啦');
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
    root.querySelectorAll('.mt-key, .mt-sign, .mt-cell.is-hole, .mt-apple').forEach((b) => {
        if (b !== btn) b.classList.add('is-dim');
        b.classList.remove('is-hole');
    });

    sfx.right();
    bumpStar();

    const slot = $('[data-slot]');
    if (slot) {
        slot.textContent = S.q.answer;
        slot.classList.add('is-filled');
    }

    const praise = pick(['对啦', '真棒', '答对了', '就是这样']);
    setHint(S.q.type === 'split'
        ? `${S.q.n} 可以分成 ${S.q.part} 和 ${S.q.answer}`
        : praise);
    say(S.q.type === 'split'
        ? `${S.q.n} 可以分成 ${S.q.part} 和 ${S.q.answer}`
        : praise);

    if (navigator.vibrate) { try { navigator.vibrate(14); } catch { /* ignore */ } }

    S.timer = setTimeout(() => nextQuestion(), 1150);
}

function onWrong(btn) {
    S.tries += 1;
    sfx.wrong();
    if (btn) {
        btn.classList.add('is-wrong');
        setTimeout(() => btn.classList.remove('is-wrong'), 520);
    }
    if (S.tries >= 2) {
        setHint(strategyHint(S.q));
        highlightAnswer();
    } else {
        setHint(pick(['再想想，不着急', '差一点，试试看', '慢慢来']));
    }
    say(S.tries >= 2 ? strategyHint(S.q) : '再试试');
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

// ══════════════════════════════════════════
//  动手交互
// ══════════════════════════════════════════

// 分与合：苹果在「还没分」和「分出来」两个筐之间来回搬
// 直接搬 DOM 节点，不重建整块区域，孩子连点几个也不会闪
function moveApple(el) {
    if (S.locked || !S.q || S.q.type !== 'split' || !el) return;
    S.touched = true;
    const zone = el.dataset.apple;
    const target = $(zone === 'pool' ? '.mt-basket--right .mt-basket-items' : '.mt-basket--left .mt-basket-items');
    if (!target) return;

    el.dataset.apple = zone === 'pool' ? 'red' : 'pool';
    el.classList.remove('is-in');
    void el.offsetWidth;
    el.classList.add('is-in');
    target.appendChild(el);
    sfx.drop();

    const note = $('.mt-stage-note');
    if (note) {
        const moved = root.querySelectorAll('.mt-basket--right .mt-apple').length;
        const rest = root.querySelectorAll('.mt-basket--left .mt-apple').length;
        note.textContent = moved === S.q.part
            ? `分出 ${moved} 个了，左边还剩 ${rest} 个`
            : `分出来 ${moved} 个，再分 ${S.q.part - moved} 个`;
    }
}

// 凑十：点空格子放点，点已放的点取消
function toggleCell(cell) {
    if (S.locked || !S.q || S.q.type !== 'tenframe' || !cell) return;
    const idx = Number(cell.dataset.cell);
    const on = cell.classList.contains('is-on');
    const extra = idx >= S.q.a;      // 只允许操作题目自己那一批空格

    if (!on) {
        if (!cell.classList.contains('is-hole')) return;
        cell.classList.remove('is-hole');
        cell.classList.add('is-on', 'is-in');
        S.filled += 1;
        sfx.drop();
    } else if (extra) {
        cell.classList.remove('is-on');
        cell.classList.add('is-hole');
        S.filled = Math.max(0, S.filled - 1);
        sfx.tap();
    } else {
        return;
    }

    const note = $('.mt-stage-note');
    if (note) {
        const now = S.q.a + S.filled;
        note.textContent = now >= FRAME_TOTAL
            ? '满啦！一共 10 个'
            : `现在有 ${now} 个，还空着 ${FRAME_TOTAL - now} 格`;
    }
}

// 数轴跳跃演示
async function playHops() {
    if (S.hopping || S.locked || !S.q) return;
    const q = S.q;
    if (q.type !== 'add' && q.type !== 'sub') return;
    S.hopping = true;
    S.touched = true;

    const mark = $('[data-mark]');
    const dir = q.type === 'add' ? 1 : -1;
    const show = $('[data-action="show-how"]');
    if (show) show.classList.add('is-off');

    for (let i = 1; i <= q.b; i++) {
        const pos = q.a + dir * i;
        if (mark) {
            mark.style.left = (pos / 10 * 100) + '%';
            mark.textContent = String(pos);
            mark.classList.add('is-hop');
            setTimeout(() => mark.classList.remove('is-hop'), 260);
        }
        const tick = root.querySelectorAll('.mt-tick')[pos];
        if (tick) tick.classList.add('is-passed');
        sfx.hop();
        say(cn(pos));
        await sleep(430);
    }

    const eqOp = q.type === 'add' ? `从 ${q.a} 往后数 ${q.b} 个，就是 ${q.answer}` : `从 ${q.a} 往回数 ${q.b} 个，就是 ${q.answer}`;
    setHint(eqOp);
    S.hopping = false;
}

// ══════════════════════════════════════════
//  设置
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

// ══════════════════════════════════════════
//  事件
// ══════════════════════════════════════════

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

    const apple = e.target.closest('.mt-apple');
    if (apple) {
        moveApple(apple);
        return;
    }

    const cell = e.target.closest('.mt-cell');
    if (cell) {
        toggleCell(cell);
        return;
    }

    const learn = e.target.closest('[data-learn]');
    if (learn) {
        S.learnN = Number(learn.dataset.learn);
        const qEl = $('#mtQuestion');
        if (qEl) qEl.innerHTML = learnHTML();
        sfx.tap();
        say(`${cn(S.learnN)}，${cn(S.learnN)}个`);
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
        case 'show-how': playHops(); break;
        case 'say-num':
            sfx.tap();
            say(`${cn(S.learnN)}，${cn(S.learnN)}个`, { force: true });
            break;
        default: break;
    }
}

function onKeydown(e) {
    if (!root || !root.isConnected) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (S.mode === 'home' || S.mode === 'learn' || !S.q) return;

    if (e.key === 'Escape') { showHome(); return; }
    if (e.key === 'Enter') { say(questionSpeech(S.q)); return; }
    if (S.q.type === 'compare') return;

    if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (e.key === '1') {
            numBuffer = '1';
            clearTimeout(numBufferTimer);
            numBufferTimer = setTimeout(() => { numBuffer = ''; answer(1); }, 300);
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
    S.filled = 0;

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
            <button class="mt-exit" type="button" data-action="exit" id="mtExit">换玩法</button>
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
