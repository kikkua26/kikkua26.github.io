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
};

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

// ── 语音朗读 ──
const TTS_AUDIO_SOURCES = [
  (t) => 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(t) + '&type=zh_CN',
  (t) => 'https://fanyi.baidu.com/gettts?lan=zh&text=' + encodeURIComponent(t) + '&spd=3&source=web',
];

function playAudio(url) {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      audio.src = url;
      const timer = setTimeout(() => resolve(false), 2500);
      audio
        .play()
        .then(() => { clearTimeout(timer); resolve(true); })
        .catch(() => { clearTimeout(timer); resolve(false); });
    } catch {
      resolve(false);
    }
  });
}

async function speakAudioFallback(text) {
  for (const makeUrl of TTS_AUDIO_SOURCES) {
    const ok = await playAudio(makeUrl(text));
    if (ok) return true;
  }
  return false;
}

function speakTTS(text) {
  if (!('speechSynthesis' in window) || !text) return Promise.resolve('noVoice');
  return new Promise((resolve) => {
    let started = false;
    let timer = null;
    let attempted = false;
    let tries = 0;
    const finish = (status) => {
      if (timer) clearTimeout(timer);
      resolve(status);
    };
    const trySpeak = () => {
      if (attempted) return;
      try {
        const voices = window.speechSynthesis.getVoices();
        const zh = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('zh'));
        if (!zh && tries < 10) {
          tries += 1;
          setTimeout(trySpeak, 200);
          return;
        }
        attempted = true;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 0.8;
        if (zh) u.voice = zh;
        u.onstart = () => { started = true; finish('ok'); };
        u.onerror = () => { if (!started) finish('fail'); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        timer = setTimeout(() => { if (!started) finish('fail'); }, 1200);
      } catch {
        if (!attempted) { attempted = true; finish('fail'); }
      }
    };
    if (window.speechSynthesis.getVoices().length) trySpeak();
    else {
      window.speechSynthesis.addEventListener('voiceschanged', trySpeak, { once: true });
      trySpeak();
    }
  });
}

async function speak(text) {
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  if (isMobile) {
    const status = await speakTTS(text);
    if (status === 'ok') return;
    const okAudio = await speakAudioFallback(text);
    if (!okAudio) toast('当前环境不支持朗读，请更换浏览器试试');
  } else {
    const okAudio = await speakAudioFallback(text);
    if (okAudio) return;
    const status = await speakTTS(text);
    if (status !== 'ok') toast('当前环境不支持朗读，请更换浏览器试试');
  }
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

// ── 数据加载 ──
async function loadChars() {
  const res = await fetch(DATA_URL + '?v=' + Date.now());
  if (!res.ok) throw new Error('字库加载失败');
  const data = await res.json();
  charsData = data.chars || [];
  byChar = new Map(charsData.map((e) => [e.c, e]));
}

async function loadLibraries() {
  const res = await fetch(LIBRARIES_URL + '?v=' + Date.now());
  if (!res.ok) throw new Error('字库注册表加载失败');
  const data = await res.json();
  libs = data.libraries || [];
}

async function loadStroke(ch) {
  if (strokeCache.has(ch)) return strokeCache.get(ch);
  const tryFetch = async (url) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
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
    grid.innerHTML = libs
      .map(
        (l) => `
          <a class="hz-lib-card" href="/hanzi/${l.id}" data-link>
            <div class="hz-lib-card-head">
              <span class="hz-lib-name">${l.name}</span>
              <span class="hz-lib-count">${l.count} 字</span>
            </div>
            <div class="hz-lib-subtitle">${l.subtitle}</div>
            <p class="hz-lib-desc">${l.desc}</p>
            <span class="hz-lib-link">开始学习 ${IC.arrowR}</span>
          </a>`
      )
      .join('');
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
            <div class="hz-current-main">
              <div class="hz-char-big" id="hzCharBig">?</div>
              <div class="hz-current-side">
                <div class="hz-pinyin" id="hzPinyin">—</div>
                <div class="hz-current-actions">
                  <button class="hz-mini-btn" data-action="speak" title="读一读">${IC.speak}<span>读一读</span></button>
                  <button class="hz-mini-btn" data-action="prev" title="上一个字">${IC.chevL}</button>
                  <button class="hz-mini-btn" data-action="next" title="下一个字">${IC.chevR}</button>
                </div>
              </div>
            </div>
          </section>

          <section class="hz-card hz-study-card">
            <div class="hz-writer-center">
              <div class="hz-writer-box hz-write-box" id="hzPracticeBox">
                <div id="hzPracticeWriter"></div>
                <div class="hz-write-layer" id="hzPracticeDemo"></div>
                <div class="hz-loading" id="hzPracticeLoading">加载中…</div>
              </div>
            </div>
            <div class="hz-demo-controls">
              <button class="btn btn-primary" data-action="practice">${IC.pen} 练习</button>
            </div>
          </section>

          <footer class="hz-foot" id="hzFoot">字库加载中…</footer>
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

  try {
    await Promise.all([loadLib(), loadLibraries(), loadChars()]);
    if (!live()) return;
    lib = libs.find((l) => l.id === libId) || null;
    if (!lib) {
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
    refreshFootCount();
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
        <p class="hz-card-desc">搜索汉字点一下加入句子，或直接输入文字</p>
        <div class="hz-search">
          <span class="hz-search-icon">${IC.search}</span>
          <input id="cbSearch" type="search" placeholder="搜索汉字或拼音，点一下加入句子"
                 maxlength="20" autocomplete="off" spellcheck="false" aria-label="搜索汉字或拼音">
        </div>
        <div class="hz-results" id="cbResults" hidden></div>
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
        <div class="hz-cb-sheet" id="cbSheet"></div>
        <div class="hz-cb-current">
          <div class="hz-cb-char" id="cbCharBig">?</div>
          <div class="hz-cb-pinyin" id="cbPinyin"></div>
          <button class="hz-mini-btn" data-action="cb-speak">${IC.speak} 读一读</button>
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

  try {
    await Promise.all([loadLib(), loadChars()]);
  } catch (e) {
    console.error('数据加载失败:', e);
    const el = $id('cbLoading');
    if (el) el.textContent = '数据加载失败，请刷新重试';
  }
}

// 抄写本：搜索（全字库），点击加入句子
function cbSearch(raw) {
  const q = (raw || '').trim();
  const box = $id('cbResults');
  if (!box) return;
  if (!q) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  const qTone = stripTone(q);
  const qLen = [...q].length;
  const matches = [];
  for (const e of charsData) {
    let score = 0;
    if (e.c === q) score = 100;
    else if (qLen === 1 && stripTone(e.p) === qTone) score = 80;
    else if (qLen <= 6 && stripTone(e.p).startsWith(qTone)) score = 60;
    else {
      const w = (e.w || []).find((wi) => wi.includes(q) || q.includes(wi));
      if (w) score = 40;
    }
    if (score) matches.push(e);
  }
  matches.sort((a, b) => b.c.localeCompare(a.c, 'zh'));
  const shown = matches.slice(0, MAX_RESULTS);
  box.innerHTML = shown.length
    ? `<div class="hz-results-head">找到 ${shown.length} 个字，点击加入句子</div>` +
      shown
        .map(
          (e) => `
            <button class="hz-result" data-action="cb-result" data-char="${e.c}">
              <span class="hz-result-char">${e.c}</span>
              <span class="hz-result-meta">
                <span class="hz-result-pinyin">${e.p}</span>
                <span class="hz-result-words">${(e.w || []).slice(0, 2).join('、')}</span>
              </span>
            </button>`
        )
        .join('')
    : `<div class="hz-results-empty">没有找到，试试别的字或拼音吧</div>`;
  box.hidden = false;
}

function cbAppendChar(c) {
  const input = $id('cbText');
  if (!input) return;
  input.value = (input.value + c).slice(0, 80);
  const box = $id('cbResults');
  if (box) { box.hidden = true; box.innerHTML = ''; }
  const search = $id('cbSearch');
  if (search) search.value = '';
}

function cbGenerate() {
  const input = $id('cbText');
  if (!input) return;
  const text = (input.value || '').replace(/\s+/g, '');
  if (!text) {
    toast('先输入或搜索几个字吧');
    return;
  }
  cbChars = [...text].slice(0, 60);
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
  sheet.innerHTML = cbChars
    .map((ch, i) => {
      const cls = i < cbIdx ? 'done' : i === cbIdx ? 'current' : '';
      return `<span class="hz-cb-cell ${cls}">${i < cbIdx ? '✓' : ch}</span>`;
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
  const loading = $id('cbLoading');
  if (loading) loading.hidden = false;
  const ok = await ensureStroke(ch);
  if (!live()) return;
  if (!ok) {
    // 标点或无笔画数据的字：直接跳过
    floatMsg(`「${ch}」没有笔画，跳过`, false);
    cbIdx += 1;
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
      floatMsg(pick(OK_MSGS), true);
      if (expected < totalStrokes) later(() => startStrokeDemo(expected), 450);
    },
    onMistake: () => floatMsg(pick(ERR_MSGS), false),
    onComplete: () => {
      if (!live()) return;
      stopStrokeDemo();
      floatMsg('这个字写好了！', true);
      later(() => { cbIdx += 1; cbStartNext(); }, 600);
    },
  });
}

function cbFinish() {
  renderSheet();
  floatMsg('整篇写完了！', true);
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

function refreshFootCount() {
  const el = $id('hzFoot');
  if (el && lib) el.textContent = `「${lib.name}」· 共 ${libChars.length} 字 · 笔画数据来自 Hanzi Writer`;
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
}

// ── 侧边栏字表 ──
function renderCharList() {
  const list = $id('hzCharList');
  if (!list) return;
  list.innerHTML = libChars
    .map((c) => {
      const e = byChar.get(c);
      return `
        <button class="hz-char-item" data-action="list-char" data-char="${c}">
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
      floatMsg(pick(OK_MSGS), true);
      if (expected < totalStrokes) later(() => startStrokeDemo(expected), 450);
    },
    onMistake: () => floatMsg(pick(ERR_MSGS), false),
    onComplete: () => {
      if (!live()) return;
      expected = totalStrokes;
      stopStrokeDemo();
      floatMsg('全部完成！', true);
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
  if (!btn || !live()) return;
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
    case 'speak': speak(current.c); break;
    case 'practice': setMode('practice'); break;
    case 'cb-result': cbAppendChar(btn.dataset.char); break;
    case 'cb-generate': cbGenerate(); break;
    case 'cb-clear': {
      const input = $id('cbText');
      if (input) input.value = '';
      break;
    }
    case 'cb-speak': speak(cbChars[Math.min(cbIdx, cbChars.length - 1)]); break;
    case 'cb-restart': cbIdx = 0; cbStartNext(); break;
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
  if (e.target.id === 'cbSearch') {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = later(() => cbSearch(e.target.value), 220);
    return;
  }
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
