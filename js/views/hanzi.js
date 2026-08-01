// kikkua · 汉字小书房 — 儿童汉字书写学习视图
// 结构：字库导航页（/hanzi）+ 字库学习页（/hanzi/<字库id>）
// 学习页：侧边栏（搜索 + 字表）+ 单字「播放 / 练习」两种动作
// 视觉完全复用站点设计系统，私有类统一 hz- 前缀。

import { ICONS } from '../icons.js';
import { navigate } from '../navigation.js';

const DATA_URL = '/data/hanzi/chars.json';
const LIBRARIES_URL = '/data/hanzi/libraries.json';
const STROKE_DIR = '/data/hanzi/strokes/';
const CDN_STROKE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';
const LIB_URL = '/js/lib/hanzi-writer.min.js';
const STATE_KEY = 'kikkua_hz_state';
const MAX_RESULTS = 24;
const DEFAULT_CHAR = '一';

const OK_MSGS = ['真棒！', '太厉害了！', '好样的！', '写得好！', '继续加油！'];
const ERR_MSGS = ['没关系，再试试！', '别着急～', '加油！', '再试一次！'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const hexCode = (ch) => ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

// 拼音 → 小写无音调（ü 归一为 v），用于搜索
const stripTone = (p) =>
  String(p || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[üǖǘǚǜ]/g, 'v')
    .toLowerCase();

// ── 线性 SVG 图标（lucide 风格） ──
const icon = (path, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const IC = {
  search: icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 18),
  speak: icon('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>', 16),
  play: icon('<polygon points="6 3 20 12 6 21 6 3"/>', 15),
  pen: icon('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', 15),
  chevL: icon('<path d="m15 18-6-6 6-6"/>', 16),
  chevR: icon('<path d="m9 18 6-6-6-6"/>', 16),
  arrowR: icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 15),
  checkCircle: icon('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', 34),
  menu: icon('<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>', 20),
  book: icon('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>', 20),
  lock: icon('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 14),
};

// ── 解锁机制：高频/常用字加密，任一组密码全部解锁 ──
const LOCKED_LIBS = new Set(['gaopin', 'quanbu']);
const PASSWORD_HASHES = [
  '573036530bb7190c445ff5fd346291fc120faad7f4c6ed0eaba56bf24fb45bfc',
  '2ad064da7a944b77c27d682efc65178f913240a9c730cb7e98819f496140e255',
  '597200cbe52f2d7ee2422f109b14e3ff769c272a5af07d5aeceae0969dffa467',
  '0d257d813c194a4bc78540d7153eea8e9c2092b90974bc6b414c6f5316369bb4',
  '1e2d5eccd6ca244c579795523a2bfc3e38b9c952acca155dbb58c218c0f12585',
  'aa5e982d885f8bc6793a48239185374d8086f8ab5d3aeef60332350404dbb9a0',
  '44e94d705753a6bd8a5b36ce6d5928a5d8e19a42d4f18c0d5cb9344ed3031eec',
  '65bb684d574b4d21d8d795cdef52b8419b881ccef0b0b673cac6a1ffc14bd59c',
  'e7ed9eaa47deb14251da2744578fd54053bb635720ac08c681c9ecb0596519a0',
  '58265d78ccd862fe794a23c1e6c60b5081d85f834be6a39a8da98395a39193e3',
  'f3c907f05b2ad7cdac9d8aa762b733d5dd2d7b1056a82b685546f2c1605f4e24',
  '1278573c5116ebaa17115aacd35c94860147ff1f9b13c32d3e16db82b608d572',
  '4a71d07bf59dae8a0ab51af15d814fb95709521f2d40892a364361593b56bf05',
  'e0027fc267517592e6ce1b0f0fd5eb03621e275a90f027f505e22d976f3031d0',
  'ebde3ff2b6ad81f5320f3ea6bcb20ee6eb668cff72a85dcdad29b408d38229f6',
  '3c2d354ae03bea2be81dea4a32bf052be58caf7a3a6c951a83a50bfb8d26dea7',
  '9693ac802f007434a478bfbbd37d1218da1fa2c3e3652b038435dc63e1c5d0b1',
  '8f05188f65f44132074b3925836c0120913286b93f8c4a70941e8e8b1641f62c',
  '283f0efec2d2e361c3c0ad9ae33b88a51910cf221cfe186ad98fe8fb8becb6cf',
  '568cf281aebbeb253f1cdb9831a44bae37de1ad5d6c1c8f5b049e89ad4276236',
];

function isUnlocked() {
  try { return localStorage.getItem('kikkua_hz_unlocked') === '1'; } catch { return false; }
}
function setUnlocked() {
  try { localStorage.setItem('kikkua_hz_unlocked', '1'); } catch { /* ignore */ }
}
async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function checkPassword(pw) {
  try {
    const h = await hashPassword(pw);
    return PASSWORD_HASHES.includes(h);
  } catch {
    return false;
  }
}

function showLockDialog(onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'hz-lock-overlay';
  overlay.innerHTML = `
    <div class="hz-lock-dialog" role="dialog" aria-modal="true">
      <div class="hz-lock-icon">${IC.lock}</div>
      <h3 class="hz-lock-title">需要解锁密码</h3>
      <p class="hz-lock-desc">「高频常用字 500」「常用字 3500」已加密，输入密码后全部解锁</p>
      <input type="password" class="hz-lock-input" id="hzLockInput" placeholder="输入密码" autocomplete="off">
      <div class="hz-lock-error" id="hzLockError" hidden>密码错误，再试试</div>
      <div class="hz-lock-actions">
        <button class="btn btn-secondary" id="hzLockCancel">取消</button>
        <button class="btn btn-primary" id="hzLockOk">解锁</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  const input = overlay.querySelector('#hzLockInput');
  const error = overlay.querySelector('#hzLockError');
  input.focus();
  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 250);
  };
  const ok = async () => {
    if (await checkPassword(input.value)) {
      setUnlocked();
      close();
      if (onSuccess) onSuccess();
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  };
  overlay.querySelector('#hzLockOk').addEventListener('click', ok);
  overlay.querySelector('#hzLockCancel').addEventListener('click', close);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ok();
    if (e.key === 'Escape') close();
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// ── HanziWriter 懒加载 ──
let libPromise = null;
function loadLib() {
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB_URL;
    s.async = true;
    s.onload = () => resolve(window.HanziWriter);
    s.onerror = () => { libPromise = null; reject(new Error('书写引擎加载失败')); };
    document.head.appendChild(s);
  });
  return libPromise;
}

// ── 运行时状态 ──
let root = null;
let timers = new Set();
let writers = [];          // [练习层 A, 演示层 B]
let charsData = [];
let libs = [];
let lib = null;
let libChars = [];
let byChar = new Map();
let strokeCache = new Map();
let current = null;
let strokeData = null;
let totalStrokes = 0;
let mode = 'idle';         // idle | play | practice | done
let expected = 0;
let demoToken = 0;
let searchTimer = null;
let resizeTimer = null;
let lastWriterWidth = 0;
let cbChars = [];   // 抄写本：字帖字符
let cbIdx = 0;      // 抄写本：当前书写位置
let cbDone = new Set(); // 抄写本：真正写完的格子索引
let cbBlocked = new Set(); // 抄写本：无法书写（锁定/无笔画）的格子索引
let cbOriginal = '';    // 抄写本：原文（含标点，显示在字帖上方）
let qimengSet = new Set(); // 抄写本：未解锁时可书写的启蒙字集合
let charsLoaded = false;  // 字库数据会话内缓存
let libsLoaded = false;   // 字库注册表会话内缓存

const later = (fn, ms) => {
  const id = setTimeout(fn, ms);
  timers.add(id);
  return id;
};
const live = () => root && root.isConnected;
const $id = (id) => (live() ? root.querySelector('#' + id) : null);

function dispose() {
  stopStrokeDemo();
  if (searchTimer) clearTimeout(searchTimer);
  if (resizeTimer) clearTimeout(resizeTimer);
  timers.forEach(clearTimeout);
  timers.clear();
  writers.forEach((w) => { try { w.cancelQuiz && w.cancelQuiz(); } catch { /* ignore */ } });
  writers = [];
  if (root) {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
  }
  window.removeEventListener('resize', onResize);
  root = null;
}

// ── 轻量反馈（右上角） ──
function floatMsg(text, ok) {
  const box = $id('hzFeedback');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'hz-float' + (ok ? ' ok' : ' err');
  el.textContent = text;
  box.appendChild(el);
  later(() => el.remove(), 1700);
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'hz-toast';
  el.textContent = text;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  later(() => { el.classList.remove('show'); later(() => el.remove(), 350); }, 2400);
}

// ── 音效（Web Audio 本地合成，零网络依赖，国内访问无忧） ──
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    } catch { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(ctx, freq, start, dur, type, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'triangle';
  osc.frequency.value = freq;
  const v = vol || 0.14;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(v, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function sfxSuccess() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99].forEach((f, i) => tone(ctx, f, t + i * 0.08, 0.2, 'triangle', 0.15));
}

function sfxError() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  tone(ctx, 196, t, 0.15, 'square', 0.06);
  tone(ctx, 155.56, t + 0.13, 0.22, 'square', 0.06);
}

function sfxFanfare() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, f, t + i * 0.09, 0.2, 'triangle', 0.15));
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(ctx, f, t + 0.42, 0.5, 'triangle', 0.07));
}

// ── 庆祝特效（整字写完后五彩纸屑） ──
function celebrate(boxId) {
  const box = $id(boxId);
  const rect = box ? box.getBoundingClientRect() : null;
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 3;
  const colors = ['#f59e0b', '#0d9488', '#e74c3c', '#3b82f6', '#a855f7', '#10b981'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('span');
    p.className = 'hz-confetti';
    const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 110;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 45;
    const rot = 180 + Math.random() * 300;
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.width = 7 + Math.random() * 6 + 'px';
    p.style.height = 11 + Math.random() * 7 + 'px';
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    p.style.background = colors[i % colors.length];
    p.style.transition = 'transform 1.05s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.05s ease-out';
    document.body.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg) scale(0.45)`;
      p.style.opacity = '0';
    }));
    later(() => p.remove(), 1250);
  }
}

// ── 数据加载 ──
async function loadChars() {
  if (charsLoaded) return;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('字库加载失败');
  const data = await res.json();
  charsData = data.chars || [];
  byChar = new Map(charsData.map((e) => [e.c, e]));
  charsLoaded = true;
}

async function loadLibraries() {
  if (libsLoaded) return;
  const res = await fetch(LIBRARIES_URL);
  if (!res.ok) throw new Error('字库注册表加载失败');
  const data = await res.json();
  libs = data.libraries || [];
  libsLoaded = true;
}

async function loadStroke(ch) {
  if (strokeCache.has(ch)) return strokeCache.get(ch);
  const tryFetch = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const text = await res.text();
      if (!text.trim().startsWith('{')) return null; // CDN 可能返回错误页
      return JSON.parse(text);
    } catch {
      return null;
    }
  };
  const d =
    (await tryFetch(`${STROKE_DIR}${hexCode(ch)}.json`)) ||
    (await tryFetch(`${CDN_STROKE}${encodeURIComponent(ch)}.json`));
  if (d) strokeCache.set(ch, d);
  return d;
}

async function ensureStroke(ch) {
  const d = await loadStroke(ch);
  if (!d) return false;
  strokeData = d;
  totalStrokes = (d.strokes ? d.strokes.length : 0) || 0;
  return true;
}

// ── 字库导航页 ──
export async function renderHanzi() {
  dispose();
  root = document.createElement('div');
  root.className = 'page hz-page';
  root.innerHTML = `
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <span class="header-title">汉字小书房</span>
        </div>
      </div>
    </header>

    <div class="hz-wrap">
      <section class="hz-hero">
        <h1 class="hz-hero-title">汉字小书房</h1>
        <p class="hz-hero-sub">选一个字库，或打开抄写本，开始练字</p>
      </section>

      <a class="hz-lib-card hz-copybook-entry" href="/hanzi/copybook" data-link>
        <div class="hz-lib-card-head">
          <span class="hz-lib-name">${IC.book} 抄写本</span>
          <span class="hz-lib-count">字帖</span>
        </div>
        <div class="hz-lib-subtitle">把想写的字组成一句话</div>
        <p class="hz-lib-desc">搜索或输入汉字组成句子，生成一张田字格字帖，像练字本一样逐字临写。</p>
        <span class="hz-lib-link">打开抄写本 ${IC.arrowR}</span>
      </a>

      <section class="hz-lib-grid" id="hzLibGrid">
        <div class="hz-lib-loading">字库加载中…</div>
      </section>

      <footer class="hz-foot">汉字小书房 · 笔画数据来自 Hanzi Writer</footer>
    </div>
  `;

  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(root);

  try {
    await Promise.all([loadLib(), loadLibraries(), loadChars()]);
    if (!live()) return;
    const grid = $id('hzLibGrid');
    const unlocked = isUnlocked();
    grid.innerHTML = libs
      .map((l) => {
        const needUnlock = LOCKED_LIBS.has(l.id) && !unlocked;
        const badge = LOCKED_LIBS.has(l.id)
          ? needUnlock
            ? `<span class="hz-lib-lock-badge">${IC.lock} 已加密</span>`
            : `<span class="hz-lib-lock-badge hz-lib-unlocked">✓ 已解锁</span>`
          : '';
        return `
          <a class="hz-lib-card${needUnlock ? ' hz-lib-locked' : ''}" href="/hanzi/${l.id}" data-link${needUnlock ? ' data-locked="1"' : ''}>
            <div class="hz-lib-card-head">
              <span class="hz-lib-name">${l.name}${badge}</span>
              <span class="hz-lib-count">${l.count} 字</span>
            </div>
            <div class="hz-lib-subtitle">${l.subtitle}</div>
            <p class="hz-lib-desc">${l.desc}</p>
            <span class="hz-lib-link">开始学习 ${IC.arrowR}</span>
          </a>`;
      })
      .join('');
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.hz-lib-card[data-locked]');
      if (!card) return;
      e.preventDefault();
      e.stopPropagation();
      const href = card.getAttribute('href');
      showLockDialog(() => navigate(href));
    });
  } catch (e) {
    console.error('字库加载失败:', e);
    const grid = $id('hzLibGrid');
    if (grid) grid.innerHTML = '<div class="hz-lib-loading">字库加载失败，请刷新重试</div>';
  }
}

// ── 字库学习页 ──
export async function renderHanziStudy(libId) {
  dispose();
  root = document.createElement('div');
  root.className = 'page hz-page';
  root.innerHTML = `
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <a href="/hanzi" class="back-btn" data-link aria-label="返回字库列表">${ICONS.back}</a>
          <span class="header-title" id="hzLibTitle">汉字小书房</span>
        </div>
        <div class="header-right">
          <button class="hz-menu-btn" id="hzMenuBtn" data-action="menu-open" aria-label="打开字库列表">${IC.menu}</button>
        </div>
      </div>
    </header>

    <div class="hz-study-layout">
      <aside class="hz-sidebar" id="hzSidebar">
        <div class="hz-sidebar-head">
          <span class="hz-sidebar-title" id="hzSidebarTitle">字库</span>
          <span class="hz-sidebar-count" id="hzSidebarCount"></span>
          <button class="hz-sidebar-close" id="hzSidebarClose" data-action="sidebar-close" aria-label="关闭">×</button>
        </div>
        <div class="hz-sidebar-search">
          <div class="hz-search">
            <span class="hz-search-icon">${IC.search}</span>
            <input id="hzSearch" type="search" placeholder="在字库里找字，输入汉字或拼音"
                   maxlength="20" autocomplete="off" spellcheck="false" aria-label="搜索汉字或拼音">
          </div>
          <div class="hz-results" id="hzResults" hidden></div>
        </div>
        <div class="hz-sidebar-list" id="hzCharList"></div>
      </aside>
      <div class="hz-sidebar-overlay" id="hzSidebarOverlay" data-action="sidebar-close"></div>

      <main class="hz-main">
        <div class="hz-wrap">
          <section class="hz-card hz-current-card">
            <div class="hz-card-head">
              <div class="hz-char-unit">
                <div class="hz-pinyin" id="hzPinyin">—</div>
                <div class="hz-char-cell" id="hzCharBig">?</div>
              </div>
              <div class="hz-words-unit">
                <div class="hz-words-list" id="hzCurrentWords"></div>
              </div>
            </div>
            <div class="hz-writer-center">
              <div class="hz-writer-box hz-write-box" id="hzPracticeBox">
                <div id="hzPracticeWriter"></div>
                <div class="hz-write-layer" id="hzPracticeDemo"></div>
                <div class="hz-loading" id="hzPracticeLoading">加载中…</div>
              </div>
            </div>
            <p class="hz-start-hint" id="hzStartHint">点一下写字板开始练习</p>
            <div class="hz-nav-row">
              <button class="hz-mini-btn" data-action="prev" title="上一个字">${IC.chevL}<span>上一个</span></button>
              <button class="hz-mini-btn" data-action="next" title="下一个字"><span>下一个</span>${IC.chevR}</button>
            </div>
          </section>

        </div>
      </main>
    </div>

    <div class="hz-feedback" id="hzFeedback" aria-live="polite"></div>
  `;

  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(root);

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  window.addEventListener('resize', onResize);
  const unlockAudio = () => ensureAudioCtx();
  root.addEventListener('pointerdown', unlockAudio, { once: true });
  root.addEventListener('touchstart', unlockAudio, { once: true });
  root.addEventListener('mousedown', unlockAudio, { once: true });

  try {
    await Promise.all([loadLib(), loadLibraries(), loadChars()]);
    if (!live()) return;
    lib = libs.find((l) => l.id === libId) || null;
    if (!lib) {
      navigate('/hanzi');
      return;
    }
    if (LOCKED_LIBS.has(lib.id) && !isUnlocked()) {
      navigate('/hanzi');
      return;
    }
    libChars = lib.all ? charsData.map((e) => e.c) : lib.chars.filter((c) => byChar.has(c));
    const titleEl = $id('hzLibTitle');
    if (titleEl) titleEl.textContent = lib.name;
    const searchInput = $id('hzSearch');
    if (searchInput) searchInput.placeholder = `在「${lib.name}」里找字，输入汉字或拼音`;
    const sideTitle = $id('hzSidebarTitle');
    const sideCount = $id('hzSidebarCount');
    if (sideTitle) sideTitle.textContent = lib.name;
    if (sideCount) sideCount.textContent = `${libChars.length} 字`;
    renderCharList();
    const saved = safeStateGet();
    const startChar =
      saved && saved.l === lib.id && saved.c && libChars.includes(saved.c) ? saved.c : (lib.start || libChars[0] || DEFAULT_CHAR);
    selectChar(startChar);
  } catch (e) {
    console.error('汉字数据加载失败:', e);
    const el = $id('hzPracticeLoading');
    if (el) el.textContent = '数据加载失败，请刷新重试';
  }
}

// ── 抄写本 ──
export async function renderCopybook() {
  dispose();
  cbChars = [];
  cbIdx = 0;
  root = document.createElement('div');
  root.className = 'page hz-page';
  root.innerHTML = `
    <header class="header">
      <div class="header-inner">
        <div class="header-left">
          <a href="/hanzi" class="back-btn" data-link aria-label="返回字库列表">${ICONS.back}</a>
          <span class="header-title">抄写本</span>
        </div>
      </div>
    </header>

    <div class="hz-wrap">
      <section class="hz-card" id="cbComposeCard">
        <h2 class="hz-card-title">写一句话</h2>
        <p class="hz-card-desc">直接输入一句话，生成一张字帖</p>
        <textarea id="cbText" class="hz-cb-text" rows="3" maxlength="80"
                  placeholder="也可以直接在这里输入一句话，如：好好学习 天天向上"></textarea>
        <div class="hz-pane-actions">
          <button class="btn btn-primary" data-action="cb-generate">生成字帖 ${IC.arrowR}</button>
          <button class="btn btn-secondary" data-action="cb-clear">清空</button>
        </div>
      </section>

      <section class="hz-card" id="cbSheetCard" hidden>
        <div class="hz-cb-sheet-head">
          <span class="hz-cb-sheet-title">你的字帖</span>
          <span class="hz-cb-sheet-count" id="cbSheetCount"></span>
        </div>
        <div class="hz-cb-original" id="cbOriginal"></div>
        <div class="hz-cb-note" id="cbNote" hidden></div>
        <div class="hz-cb-sheet" id="cbSheet"></div>
        <div class="hz-cb-current">
          <div class="hz-cb-char" id="cbCharBig">?</div>
          <div class="hz-cb-pinyin" id="cbPinyin"></div>
        </div>
        <div class="hz-writer-center">
          <div class="hz-writer-box hz-write-box" id="cbBox">
            <div id="cbWriter"></div>
            <div class="hz-write-layer" id="cbDemo"></div>
            <div class="hz-loading" id="cbLoading">加载中…</div>
          </div>
        </div>
        <div class="hz-pane-actions">
          <button class="btn btn-secondary" data-action="cb-restart">重新开始</button>
          <button class="btn btn-secondary" data-action="cb-edit">换一句</button>
        </div>
      </section>
    </div>

    <div class="hz-feedback" id="hzFeedback" aria-live="polite"></div>
  `;

  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(root);

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  const unlockAudio = () => ensureAudioCtx();
  root.addEventListener('pointerdown', unlockAudio, { once: true });
  root.addEventListener('touchstart', unlockAudio, { once: true });
  root.addEventListener('mousedown', unlockAudio, { once: true });

  try {
    await Promise.all([loadLib(), loadLibraries(), loadChars()]);
    qimengSet = new Set((libs.find((l) => l.id === 'qimeng')?.chars) || []);
  } catch (e) {
    console.error('数据加载失败:', e);
    const el = $id('cbLoading');
    if (el) el.textContent = '数据加载失败，请刷新重试';
  }
}

// 抄写本：标点不进字帖
const CB_PUNCT = new Set('，。！？、；：“”‘’（）《》〈〉【】「」『』…—～·,.;:!?\'"()[]{}<>-_/\\|@#$%^&*+=~`');

function cbGenerate() {
  const input = $id('cbText');
  if (!input) return;
  const text = (input.value || '').replace(/\s+/g, '');
  if (!text) {
    toast('先输入一句话吧');
    return;
  }
  const chars = [...text].slice(0, 60);
  // 标点剔除，字库外的字收集起来提示
  cbChars = chars.filter((c) => !CB_PUNCT.has(c));
  cbDone = new Set();
  cbBlocked = new Set();
  cbOriginal = (input.value || '').replace(/\s+/g, ' ').trim();
  const unlocked = isUnlocked();
  const uniqueChars = [...new Set(chars.filter((c) => !CB_PUNCT.has(c)))];
  const missing = uniqueChars.filter((c) => !byChar.has(c));
  const lockedChars = uniqueChars.filter((c) => byChar.has(c) && !unlocked && !qimengSet.has(c));
  const note = $id('cbNote');
  if (note) {
    const parts = [];
    if (lockedChars.length) {
      parts.push(`以下字需要解锁后才能书写：${lockedChars.join('、')}`);
    }
    if (missing.length) {
      parts.push(`以下字符不在字库中，练习时会尝试联网获取笔画，获取不到将自动跳过：${missing.join('、')}`);
    }
    if (parts.length) {
      note.hidden = false;
      note.textContent = parts.join('\n');
    } else {
      note.hidden = true;
      note.textContent = '';
    }
  }
  if (!cbChars.length) {
    toast('去掉标点后没有可写的字了');
    return;
  }
  cbIdx = 0;
  const compose = $id('cbComposeCard');
  const sheet = $id('cbSheetCard');
  if (compose) compose.hidden = true;
  if (sheet) sheet.hidden = false;
  cbStartNext();
}

function renderSheet() {
  const sheet = $id('cbSheet');
  if (!sheet) return;
  const origEl = $id('cbOriginal');
  if (origEl) origEl.textContent = cbOriginal;
  sheet.innerHTML = cbChars
    .map((ch, i) => {
      const cls = cbDone.has(i) ? 'done' : i === cbIdx ? 'current' : cbBlocked.has(i) ? 'blocked' : '';
      return `<button class="hz-cb-cell ${cls}" data-action="cb-cell" data-index="${i}">${ch}</button>`;
    })
    .join('');
  const count = $id('cbSheetCount');
  if (count) count.textContent = `共 ${cbChars.length} 字`;
  const ch = cbChars[Math.min(cbIdx, cbChars.length - 1)];
  const entry = byChar.get(ch);
  const big = $id('cbCharBig');
  const pinyin = $id('cbPinyin');
  if (big) big.textContent = ch;
  if (pinyin) pinyin.textContent = entry ? entry.p : '';
}

async function cbStartNext() {
  if (!live()) return;
  if (cbIdx >= cbChars.length) {
    cbFinish();
    return;
  }
  renderSheet();
  const ch = cbChars[cbIdx];
  // 未解锁时只能书写启蒙部分的字
  if (!isUnlocked() && byChar.has(ch) && !qimengSet.has(ch)) {
    floatMsg(`「${ch}」需要解锁后才能书写`, false);
    cbBlocked.add(cbIdx);
    cbIdx += 1;
    while (cbIdx < cbChars.length && cbBlocked.has(cbIdx)) cbIdx += 1;
    cbStartNext();
    return;
  }
  const loading = $id('cbLoading');
  if (loading) loading.hidden = false;
  const ok = await ensureStroke(ch);
  if (!live()) return;
  if (!ok) {
    // 无笔画数据的字：直接跳过
    floatMsg(`「${ch}」没有笔画，跳过`, false);
    cbBlocked.add(cbIdx);
    cbIdx += 1;
    while (cbIdx < cbChars.length && cbBlocked.has(cbIdx)) cbIdx += 1;
    cbStartNext();
    return;
  }
  buildCopybookWriters();
  startCbQuiz();
}

function buildCopybookWriters() {
  writers.forEach((w) => { try { w.cancelQuiz && w.cancelQuiz(); } catch { /* ignore */ } });
  writers = [];
  const lib = window.HanziWriter;
  const size = writerSize('cbBox');
  const ch = cbChars[cbIdx];
  clearEl('cbWriter');
  clearEl('cbDemo');
  writers.push(
    lib.create($id('cbWriter'), ch, {
      charData: strokeData,
      width: size,
      height: size,
      strokeColor: '#0d9488',
      radicalColor: '#b45309',
      outlineColor: 'rgba(228, 220, 207, 0.4)',
      showOutline: true,
      showCharacter: false,
      drawingColor: '#0d9488',
      drawingWidth: 50,
      strokeAnimationSpeed: 0.9,
    })
  );
  writers.push(
    lib.create($id('cbDemo'), ch, {
      charData: strokeData,
      width: size,
      height: size,
      strokeColor: '#f59e0b',
      radicalColor: '#f59e0b',
      showOutline: false,
      showCharacter: false,
      strokeAnimationSpeed: 0.8,
      delayBetweenStrokes: 250,
    })
  );
  const loading = $id('cbLoading');
  if (loading) loading.hidden = true;
}

function startCbQuiz() {
  if (!writers.length || !live()) return;
  stopStrokeDemo();
  const pracW = writers[0];
  const demoW = writers[1];
  expected = 0;
  try { pracW.cancelQuiz(); } catch { /* ignore */ }
  pracW.hideCharacter({ duration: 0 });
  pracW.showOutline();
  try { demoW.hideCharacter({ duration: 0 }); } catch { /* ignore */ }
  later(() => startStrokeDemo(0), 400);
  pracW.quiz({
    showOutline: true,
    showHintAfterMisses: 3,
    acceptMistakes: false,
    highlightOnComplete: true,
    markStrokeCorrectAfterMisses: 8,
    onCorrectStroke: (data) => {
      if (!live()) return;
      expected = data.strokeNum + 1;
      if (expected < totalStrokes) later(() => startStrokeDemo(expected), 450);
    },
    onMistake: () => { floatMsg(pick(ERR_MSGS), false); sfxError(); },
    onComplete: () => {
      if (!live()) return;
      stopStrokeDemo();
      celebrate('cbBox');
      floatMsg('这个字写好了！', true);
      sfxSuccess();
      later(() => {
        cbDone.add(cbIdx);
        // 跳到下一个未写完的字；全部写完则结束
        let next = cbIdx + 1;
        while (next < cbChars.length && (cbDone.has(next) || cbBlocked.has(next))) next += 1;
        if (next >= cbChars.length) {
          const undone = cbChars.findIndex((_, i) => !cbDone.has(i) && !cbBlocked.has(i));
          next = undone >= 0 ? undone : -1;
        }
        if (next < 0) {
          cbFinish();
        } else {
          cbIdx = next;
          cbStartNext();
        }
      }, 600);
    },
  });
}

function cbFinish() {
  renderSheet();
  celebrate('cbBox');
  floatMsg('整篇写完了！', true);
  sfxFanfare();
}

function safeStateGet() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function safeStateSet(obj) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(obj)); } catch { /* ignore */ }
}

// ── 选字 ──
function selectChar(c) {
  current = byChar.get(c) || { c, p: '', w: [] };
  stopStrokeDemo();
  safeStateSet({ c, l: lib ? lib.id : '' });
  renderCurrent();
  updateCharList();
  closeSidebar();
  setMode('idle');
  loadCharWriters();
}

function renderCurrent() {
  $id('hzCharBig').textContent = current.c;
  $id('hzPinyin').textContent = current.p || '拼音待补充';
  const wordsEl = $id('hzCurrentWords');
  if (wordsEl) {
    const words = (current.w || []).filter((w) => w.length >= 2).slice(0, 3);
    wordsEl.innerHTML = words.length
      ? words.map((w) => `<span>${w}</span>`).join('')
      : '<span class="hz-words-empty">还没有组词</span>';
  }
}

// ── 侧边栏字表 ──
function renderCharList() {
  const list = $id('hzCharList');
  if (!list) return;
  list.innerHTML = libChars
    .map((c, i) => {
      const e = byChar.get(c);
      return `
        <button class="hz-char-item" data-action="list-char" data-char="${c}">
          <span class="hz-char-num">${i + 1}</span>
          <span class="hz-char-item-c">${c}</span>
          <span class="hz-char-item-p">${e ? e.p : ''}</span>
        </button>`;
    })
    .join('');
}

function updateCharList() {
  const list = $id('hzCharList');
  if (!list || !current) return;
  list.querySelectorAll('.hz-char-item.active').forEach((el) => el.classList.remove('active'));
  const item = list.querySelector(`[data-char="${current.c}"]`);
  if (item) {
    item.classList.add('active');
    const target = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
    list.scrollTop = Math.max(0, target);
  }
}

function openSidebar() {
  const sidebar = $id('hzSidebar');
  const overlay = $id('hzSidebarOverlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('show');
}

function closeSidebar() {
  const sidebar = $id('hzSidebar');
  const overlay = $id('hzSidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

// ── writer 生命周期 ──
function writerSize(sel) {
  const wrap = root.querySelector('.hz-wrap');
  const avail = wrap ? wrap.clientWidth : 720;
  if (sel === 'hzPracticeBox') {
    return Math.max(190, Math.min(320, avail - 56));
  }
  return Math.max(170, Math.min(320, avail - 56));
}

async function loadCharWriters() {
  const c = current.c;
  const pl = $id('hzPracticeLoading');
  if (pl) pl.hidden = false;
  const ok = await ensureStroke(c);
  if (!live() || c !== current.c) return;
  if (!ok) {
    if (pl) { pl.hidden = false; pl.textContent = '这个字还没收录笔画数据，换个字试试'; }
    return;
  }
  buildWriters();
}

function buildWriters() {
  writers.forEach((w) => { try { w.cancelQuiz && w.cancelQuiz(); } catch { /* ignore */ } });
  writers = [];
  const lib = window.HanziWriter;
  const size = writerSize('hzPracticeBox');
  clearEl('hzPracticeWriter');
  clearEl('hzPracticeDemo');
  // 练习层 A：浅色描边 + 已写笔画（青绿），接收输入
  writers.push(
    lib.create($id('hzPracticeWriter'), current.c, {
      charData: strokeData,
      width: size,
      height: size,
      strokeColor: '#0d9488',
      radicalColor: '#b45309',
      outlineColor: 'rgba(228, 220, 207, 0.4)',
      showOutline: true,
      showCharacter: false,
      drawingColor: '#0d9488',
      drawingWidth: 50,
      strokeAnimationSpeed: 0.9,
    })
  );
  // 演示层 B：金色演示（播放整字 / 练习时演示下一笔），不响应输入
  writers.push(
    lib.create($id('hzPracticeDemo'), current.c, {
      charData: strokeData,
      width: size,
      height: size,
      strokeColor: '#f59e0b',
      radicalColor: '#f59e0b',
      showOutline: false,
      showCharacter: false,
      strokeAnimationSpeed: 0.8,
      delayBetweenStrokes: 250,
    })
  );
  const pl = $id('hzPracticeLoading');
  if (pl) pl.hidden = true;
  lastWriterWidth = writerSize('hzPracticeBox');
  setMode(mode === 'practice' ? 'practice' : 'idle');
}

function clearEl(id) {
  const el = $id(id);
  if (el) el.innerHTML = '';
}

// ── 模式切换 ──
function setMode(m) {
  mode = m;
  const hint = $id('hzStartHint');
  if (hint) hint.hidden = m === 'practice';
  if (m === 'practice') startPractice();
  else if (m === 'idle') startFullCharLoop();
}

// ── 整字循环演示（进入字后自动播放） ──
function startFullCharLoop() {
  if (!writers.length || !live()) return;
  const demoW = writers[1];
  demoToken += 1;
  const token = demoToken;
  try {
    demoW.hideCharacter({ duration: 0 });
    demoW.animateCharacter({
      onComplete: () => {
        if (!live() || token !== demoToken) return;
        later(() => {
          if (token !== demoToken) return;
          startFullCharLoop();
        }, 1200);
      },
    });
  } catch { /* 演示异常时静默跳过 */ }
}

// ── 练习（逐笔书写） ──
function startPractice() {
  if (!writers.length || !live()) return;
  stopStrokeDemo();
  const pracW = writers[0];
  const demoW = writers[1];
  expected = 0;
  try { pracW.cancelQuiz(); } catch { /* ignore */ }
  pracW.hideCharacter({ duration: 0 });
  pracW.showOutline();
  try { demoW.hideCharacter({ duration: 0 }); } catch { /* ignore */ }
  later(() => startStrokeDemo(0), 400);
  pracW.quiz({
    showOutline: true,
    showHintAfterMisses: 3,
    acceptMistakes: false,
    highlightOnComplete: true,
    markStrokeCorrectAfterMisses: 8,
    onCorrectStroke: (data) => {
      if (!live()) return;
      expected = data.strokeNum + 1;
      if (expected < totalStrokes) later(() => startStrokeDemo(expected), 450);
    },
    onMistake: () => { floatMsg(pick(ERR_MSGS), false); sfxError(); },
    onComplete: () => {
      if (!live()) return;
      expected = totalStrokes;
      stopStrokeDemo();
      celebrate('hzPracticeBox');
      floatMsg('太棒了！', true);
      sfxFanfare();
    },
  });
}

// ── 当前笔画循环演示 ──
function stopStrokeDemo() {
  demoToken += 1;
}

function startStrokeDemo(n) {
  if (!live()) return;
  const demoW = writers[1];
  if (!demoW || n < 0 || n >= totalStrokes) return;
  demoToken += 1;
  const token = demoToken;
  try {
    demoW.hideCharacter({ duration: 0 });
    demoW.animateStroke(n, {
      onComplete: () => {
        if (!live() || token !== demoToken) return;
        later(() => {
          if (token !== demoToken) return;
          startStrokeDemo(n);
        }, 1100);
      },
    });
  } catch { /* 演示层异常时静默跳过 */ }
}

// ── 搜索 ──
function doSearch(raw) {
  const q = (raw || '').trim();
  const box = $id('hzResults');
  if (!box) return;
  if (!q) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const qTone = stripTone(q);
  const qLen = [...q].length;
  const matches = [];
  for (const c of libChars) {
    const e = byChar.get(c);
    if (!e) continue;
    let score = 0;
    let matchedWord = '';
    if (e.c === q) score = 100;
    else if (qLen === 1 && stripTone(e.p) === qTone) score = 80;
    else if (qLen <= 6 && stripTone(e.p).startsWith(qTone)) score = 60;
    else {
      const w = (e.w || []).find((wi) => wi.includes(q) || q.includes(wi));
      if (w) { score = 40; matchedWord = w; }
    }
    if (score) matches.push({ e, score, matchedWord });
  }
  matches.sort((a, b) => b.score - a.score || a.e.c.localeCompare(b.e.c, 'zh'));
  const shown = matches.slice(0, MAX_RESULTS);
  box.innerHTML = shown.length
    ? `<div class="hz-results-head">找到 ${shown.length} 个字</div>` +
      shown
        .map(
          (m) => `
            <button class="hz-result" data-action="result" data-char="${m.e.c}">
              <span class="hz-result-char">${m.e.c}</span>
              <span class="hz-result-meta">
                <span class="hz-result-pinyin">${m.e.p}</span>
                <span class="hz-result-words">${m.matchedWord || (m.e.w || []).slice(0, 2).join('、')}</span>
              </span>
            </button>`
        )
        .join('')
    : `<div class="hz-results-empty">没有找到，试试别的字或拼音吧</div>`;
  box.hidden = false;
}

function hideResults() {
  const box = $id('hzResults');
  if (!box) return;
  box.hidden = true;
  box.innerHTML = '';
}

// ── 上一个 / 下一个 ──
function stepChar(delta) {
  const idx = libChars.indexOf(current.c);
  if (idx < 0) return;
  const next = (idx + delta + libChars.length) % libChars.length;
  selectChar(libChars[next]);
}

// ── 事件 ──
function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!live()) return;
  if (!btn) {
    // 点一下书写区直接进入书写
    if (mode !== 'practice' && e.target.closest('#hzPracticeBox')) {
      setMode('practice');
    }
    return;
  }
  const action = btn.dataset.action;
  switch (action) {
    case 'menu-open': openSidebar(); break;
    case 'sidebar-close': closeSidebar(); break;
    case 'list-char':
      selectChar(btn.dataset.char);
      hideResults();
      break;
    case 'result':
      selectChar(btn.dataset.char);
      hideResults();
      break;
    case 'prev': stepChar(-1); break;
    case 'next': stepChar(1); break;
    case 'cb-cell': {
      cbIdx = Number(btn.dataset.index) || 0;
      cbStartNext();
      break;
    }
    case 'cb-generate': cbGenerate(); break;
    case 'cb-clear': {
      const input = $id('cbText');
      if (input) input.value = '';
      break;
    }
    case 'cb-restart': cbIdx = 0; cbDone = new Set(); cbBlocked = new Set(); cbStartNext(); break;
    case 'cb-edit': {
      stopStrokeDemo();
      const compose = $id('cbComposeCard');
      const sheet = $id('cbSheetCard');
      if (compose) compose.hidden = false;
      if (sheet) sheet.hidden = true;
      break;
    }
  }
}

function onInput(e) {
  if (e.target.id !== 'hzSearch') return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = later(() => doSearch(e.target.value), 220);
}

function onResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = later(() => {
    if (!live()) return;
    const w = writerSize('hzPracticeBox');
    if (Math.abs(w - lastWriterWidth) < 24) return;
    lastWriterWidth = w;
    const prevMode = mode;
    try {
      buildWriters();
      if (prevMode === 'practice') {
        startPractice();
        toast('屏幕变化，练习重新开始啦');
      } else {
        setMode('idle');
      }
    } catch { /* ignore */ }
  }, 250);
}
