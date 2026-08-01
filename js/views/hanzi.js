// kikkua · 汉字小书房 — 儿童汉字书写学习视图
// 交互主线：认字 → 看笔顺 → 临写 → 完成 → 组词练习
// 视觉完全复用站点设计系统（CSS 变量 / header / btn / card），
// 页面私有类统一 hz- 前缀，不影响其他视图。

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

// ── 线性 SVG 图标（与站点 lucide 风格一致） ──
const icon = (path, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const IC = {
  search: icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 18),
  speak: icon('<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>', 16),
  play: icon('<polygon points="6 3 20 12 6 21 6 3"/>', 15),
  prev: icon('<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>', 15),
  next: icon('<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>', 15),
  replay: icon('<path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/>', 15),
  chevL: icon('<path d="m15 18-6-6 6-6"/>', 16),
  chevR: icon('<path d="m9 18 6-6-6-6"/>', 16),
  arrowR: icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', 15),
  checkCircle: icon('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>', 34),
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
let writers = [];          // 单字 writer: [demo, hint, practice]
let wordWriters = [];      // 组词 writer: [hint, practice]
let charsData = [];
let libs = [];             // 字库注册表
let lib = null;            // 当前字库
let libChars = [];         // 当前字库的字列表
let byChar = new Map();
let strokeCache = new Map();
let current = null;        // {c, p, w}
let strokeData = null;
let totalStrokes = 0;
let step = 'read';         // read | strokes | write | done
let demoIdx = -1;
let animBusy = false;
let expected = 0;          // 当前临写已写对笔画数
let word = null;
let wordChars = [];
let wordIdx = 0;
let wordDone = false;
let searchTimer = null;
let resizeTimer = null;
let lastWriterWidth = 0;
let demoToken = 0;         // 当前笔画演示循环令牌

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
  [...writers, ...wordWriters].forEach((w) => { try { w.cancelQuiz && w.cancelQuiz(); } catch { /* ignore */ } });
  writers = [];
  wordWriters = [];
  if (root) {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
  }
  window.removeEventListener('resize', onResize);
  root = null;
}

// ── 语音朗读 ──
// 依次尝试：有道网络语音 → 百度网络语音 → 系统 TTS；全失败才提示。
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
          // 语音列表可能还在异步加载，稍等再试
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
        // 兜底：1.2 秒内未真正开始朗读则判定失败
        timer = setTimeout(() => { if (!started) finish('fail'); }, 1200);
      } catch {
        if (!attempted) { attempted = true; finish('fail'); }
      }
    };
    if (window.speechSynthesis.getVoices().length) {
      trySpeak();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', trySpeak, { once: true });
      trySpeak();
    }
  });
}

async function speak(text) {
  // 手机浏览器系统语音一般可靠且零延迟，优先 TTS；
  // 桌面内嵌浏览器常见无声 TTS，优先网络语音。
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

// ── 轻量反馈 ──
function floatMsg(anchor, text, ok) {
  if (!anchor || !anchor.isConnected) return;
  const el = document.createElement('div');
  el.className = 'hz-float' + (ok ? ' ok' : ' err');
  el.textContent = text;
  anchor.appendChild(el);
  later(() => el.remove(), 1300);
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

// ── 渲染 ──
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
        <p class="hz-hero-sub">选一个字库，开始认字、学笔顺、写一写</p>
      </section>

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
    const data = await Promise.all([loadLib(), loadLibraries(), loadChars()]);
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
      </div>
    </header>

    <div class="hz-wrap">
      <section class="hz-card hz-search-card">
        <div class="hz-search">
          <span class="hz-search-icon">${IC.search}</span>
          <input id="hzSearch" type="search" placeholder="在字库里找字，输入汉字或拼音"
                 maxlength="20" autocomplete="off" spellcheck="false" aria-label="搜索汉字或拼音">
        </div>
        <div class="hz-results" id="hzResults" hidden></div>
      </section>

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
        <div class="hz-words" id="hzWords"></div>
      </section>

      <section class="hz-card hz-study-card">
        <div class="hz-steps" id="hzSteps" aria-label="学习进度">
          <span class="hz-step" data-step="read"><span class="hz-step-num">1</span>认字</span>
          <span class="hz-step" data-step="strokes"><span class="hz-step-num">2</span>笔顺</span>
          <span class="hz-step" data-step="write"><span class="hz-step-num">3</span>临写</span>
          <span class="hz-step" data-step="done"><span class="hz-step-num">4</span>完成</span>
        </div>

        <div class="hz-step-body">
          <div class="hz-pane" data-pane="read">
            <div class="hz-read-char" id="hzReadChar">?</div>
            <p class="hz-read-meta" id="hzReadMeta"></p>
            <p class="hz-read-words" id="hzReadWords"></p>
            <div class="hz-pane-actions">
              <button class="btn btn-primary" data-action="to-strokes">看笔顺 ${IC.arrowR}</button>
              <button class="btn btn-secondary" data-action="speak">${IC.speak} 读一读</button>
            </div>
          </div>

          <div class="hz-pane" data-pane="strokes" hidden>
            <div class="hz-writer-center">
              <div class="hz-writer-box" id="hzDemoBox">
                <div id="hzDemoWriter"></div>
                <div class="hz-loading" id="hzDemoLoading">加载中…</div>
              </div>
            </div>
            <div class="hz-demo-controls">
              <button class="btn btn-secondary" data-action="play">${IC.play} 播放全部</button>
              <button class="btn btn-secondary" data-action="prev-stroke">${IC.prev} 上一笔</button>
              <button class="btn btn-secondary" data-action="next-stroke">下一笔 ${IC.next}</button>
              <button class="btn btn-secondary" data-action="replay">${IC.replay} 重播</button>
            </div>
            <p class="hz-counter" id="hzCounter">—</p>
            <div class="hz-pane-actions">
              <button class="btn btn-primary" data-action="to-write">开始临写 ${IC.arrowR}</button>
            </div>
          </div>

          <div class="hz-pane" data-pane="write" hidden>
            <div class="hz-writer-center">
              <div class="hz-writer-box hz-write-box" id="hzPracticeBox">
                <div id="hzPracticeWriter"></div>
                <div class="hz-write-layer" id="hzPracticeDemo"></div>
                <div class="hz-loading" id="hzPracticeLoading">加载中…</div>
              </div>
            </div>
            <div class="hz-dots" id="hzDots"></div>
            <p class="hz-progress-text" id="hzProgressText">准备好了吗？</p>
            <div class="hz-pane-actions">
              <button class="btn btn-secondary" data-action="restart-write">重新开始</button>
            </div>
          </div>

          <div class="hz-pane hz-done-pane" data-pane="done" hidden>
            <div class="hz-done-icon">${IC.checkCircle}</div>
            <h3 class="hz-done-title" id="hzDoneTitle"></h3>
            <p class="hz-done-desc" id="hzDoneDesc"></p>
            <div class="hz-pane-actions">
              <button class="btn btn-primary" data-action="next-char">下一个字 ${IC.arrowR}</button>
              <button class="btn btn-secondary" data-action="to-words">去组词</button>
            </div>
          </div>
        </div>
      </section>

      <section class="hz-card hz-words-card">
        <h2 class="hz-card-title">组词练习</h2>
        <p class="hz-card-desc" id="hzWordsDesc">选一个词语，把每个字都写出来</p>
        <div class="hz-word-list" id="hzWordList"></div>
        <div class="hz-word-practice" id="hzWordPractice" hidden>
          <div class="hz-word-chips" id="hzWordChips"></div>
          <div class="hz-writer-center">
            <div class="hz-writer-box hz-write-box" id="hzWordBox">
              <div id="hzWordWriter"></div>
              <div class="hz-write-layer" id="hzWordDemo"></div>
              <div class="hz-loading" id="hzWordLoading">加载中…</div>
            </div>
          </div>
          <div class="hz-dots" id="hzWordDots"></div>
          <p class="hz-progress-text" id="hzWordProgressText"></p>
          <div class="hz-word-done" id="hzWordDone" hidden>
            <div class="hz-done-icon">${IC.checkCircle}</div>
            <h3 class="hz-done-title" id="hzWordDoneTitle"></h3>
          </div>
          <div class="hz-pane-actions" id="hzWordActions">
            <button class="btn btn-secondary" data-action="word-restart">重新开始</button>
            <button class="btn btn-secondary" data-action="word-exit">换一个词</button>
          </div>
        </div>
      </section>

      <footer class="hz-foot" id="hzFoot">字库加载中…</footer>
    </div>
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
    const saved = safeStateGet();
    const startChar =
      saved && saved.l === lib.id && saved.c && libChars.includes(saved.c) ? saved.c : (lib.start || libChars[0] || DEFAULT_CHAR);
    selectChar(startChar);
    if (saved && ['read', 'strokes', 'write', 'done'].includes(saved.step) && saved.step !== 'read') {
      goStep(saved.step);
    }
    refreshFootCount();
  } catch (e) {
    console.error('汉字数据加载失败:', e);
    const el = $id('hzDemoLoading');
    if (el) el.textContent = '数据加载失败，请刷新重试';
  }
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
  safeStateSet({ c, step: 'read', l: lib ? lib.id : '' });
  word = null;
  wordChars = [];
  wordIdx = 0;
  wordDone = false;
  resetWordPractice();
  renderCurrent();
  renderWordList();
  goStep('read');
  loadCharWriters();
}

function renderCurrent() {
  $id('hzCharBig').textContent = current.c;
  $id('hzPinyin').textContent = current.p || '拼音待补充';
  const readChar = $id('hzReadChar');
  const readMeta = $id('hzReadMeta');
  const readWords = $id('hzReadWords');
  if (readChar) readChar.textContent = current.c;
  if (readMeta) readMeta.textContent = current.p ? `${current.p} · 笔顺演示` : '拼音待补充';
  if (readWords) {
    readWords.textContent = (current.w || []).length ? '组词：' + current.w.join('、') : '这个字还没有组词';
  }
  const words = (current.w || []).filter((w) => w.length >= 2);
  $id('hzWords').innerHTML = words.length
    ? words.map((w) => `<button class="hz-word-tag" data-action="word" data-word="${w}">${w}</button>`).join('')
    : `<span class="hz-word-empty">这个字还没有组词，换个字试试</span>`;
}

function renderWordList() {
  const list = $id('hzWordList');
  if (!list) return;
  const words = (current.w || []).filter((w) => w.length >= 2);
  $id('hzWordsDesc').textContent = words.length ? '选一个词语，把每个字都写出来' : '这个字还没有组词，换个字试试';
  list.innerHTML = words.length
    ? words.map((w) => `<button class="btn btn-secondary hz-word-btn" data-action="word" data-word="${w}">${w}</button>`).join('')
    : '';
}

// ── 步骤流 ──
function goStep(s) {
  if (!live()) return;
  step = s;
  safeStateSet({ c: current.c, step: s, l: lib ? lib.id : '' });
  root.querySelectorAll('.hz-step').forEach((el) => {
    const i = ['read', 'strokes', 'write', 'done'].indexOf(el.dataset.step);
    const j = ['read', 'strokes', 'write', 'done'].indexOf(s);
    el.classList.toggle('active', el.dataset.step === s);
    el.classList.toggle('done', i < j);
  });
  root.querySelectorAll('.hz-pane').forEach((el) => {
    el.hidden = el.dataset.pane !== s;
  });
  if (s === 'strokes') resetDemo();
  if (s === 'write') startWrite();
  if (s === 'done') renderDone();
}

function refreshFootCount() {
  const el = $id('hzFoot');
  if (el && lib) el.textContent = `「${lib.name}」· 共 ${libChars.length} 字 · 笔画数据来自 Hanzi Writer`;
}

function renderDone() {
  $id('hzDoneTitle').textContent = `「${current.c}」写好了！`;
  $id('hzDoneDesc').textContent = `${totalStrokes} 个笔画全部完成，真棒！`;
}

// ── 笔画 writer 生命周期 ──
function writerSize(sel) {
  // 按页面可用宽度确定性计算，避免在容器内容尚未渲染时量出 0
  const wrap = root.querySelector('.hz-wrap');
  const avail = wrap ? wrap.clientWidth : 720;
  if (sel === 'hzPracticeBox' || sel === 'hzWordBox') {
    // 减掉卡片内边距 + 提示字列(104) + 间距
    return Math.max(190, Math.min(320, avail - 152));
  }
  return Math.max(170, Math.min(320, avail - 56));
}

async function loadCharWriters() {
  const c = current.c;
  const dl = $id('hzDemoLoading');
  const pl = $id('hzPracticeLoading');
  if (dl) dl.hidden = false;
  if (pl) pl.hidden = false;
  const ok = await ensureStroke(c);
  if (!live() || c !== current.c) return;
  if (!ok) {
    if (dl) { dl.hidden = false; dl.textContent = '这个字还没收录笔画数据，换个字试试'; }
    return;
  }
  const meta = $id('hzReadMeta');
  if (meta && current.p) meta.textContent = `${current.p} · ${totalStrokes} 画`;
  buildCharWriters();
  refreshFootCount();
  if (step === 'write') startWrite();
  else if (step === 'done') renderDone();
  else updateDemoUI();
}

function buildCharWriters() {
  [...writers, ...wordWriters].forEach((w) => { try { w.cancelQuiz && w.cancelQuiz(); } catch { /* ignore */ } });
  writers = [];
  wordWriters = [];
  const lib = window.HanziWriter;
  stopStrokeDemo();
  clearEl('hzDemoWriter');
  clearEl('hzPracticeWriter');
  clearEl('hzPracticeDemo');
  const base = {
    charData: strokeData,
    strokeColor: '#3f3a33',
    radicalColor: '#b45309',
    outlineColor: '#e4dccf',
    showOutline: true,
    showCharacter: false,
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 280,
  };
  const demoSize = writerSize('hzDemoBox');
  writers.push(lib.create($id('hzDemoWriter'), current.c, { ...base, width: demoSize, height: demoSize }));
  const writeSize = writerSize('hzPracticeBox');
  writers.push(lib.create($id('hzPracticeWriter'), current.c, {
    ...base, width: writeSize, height: writeSize,
    strokeColor: '#0d9488', drawingColor: '#0d9488', drawingWidth: 50, outlineColor: 'rgba(228, 220, 207, 0.4)', strokeAnimationSpeed: 0.9,
  }));
  // 叠加演示层：只显示当前待写笔画（金色），不响应输入
  writers.push(lib.create($id('hzPracticeDemo'), current.c, {
    charData: strokeData,
    width: writeSize,
    height: writeSize,
    strokeColor: '#f59e0b',
    radicalColor: '#f59e0b',
    showOutline: false,
    showCharacter: false,
    strokeAnimationSpeed: 0.8,
    delayBetweenStrokes: 150,
  }));
  const dl = $id('hzDemoLoading');
  const pl = $id('hzPracticeLoading');
  if (dl) dl.hidden = true;
  if (pl) pl.hidden = true;
  lastWriterWidth = writerSize('hzDemoBox');
}

// ── 步骤② 笔顺演示 ──
function resetDemo() {
  if (!writers.length || !live()) return;
  try { writers[0].hideCharacter({ duration: 0 }); } catch { /* ignore */ }
  demoIdx = -1;
  animBusy = false;
  updateDemoUI();
}

function playAll() {
  if (animBusy || !writers.length || !live()) return;
  const demoW = writers[0];
  animBusy = true;
  updateDemoUI();
  demoW.hideCharacter({ duration: 0 });
  demoW.animateCharacter({
    onComplete: () => {
      animBusy = false;
      demoIdx = totalStrokes - 1;
      updateDemoUI();
      if (live()) later(() => { if (live() && step === 'strokes') goStep('write'); }, 350);
    },
  });
}

function playStroke(delta) {
  if (animBusy || !writers.length || !live()) return;
  const n = demoIdx + delta;
  if (delta > 0 && n >= totalStrokes) return;
  if (delta < 0 && n < 0) return;
  animBusy = true;
  updateDemoUI();
  if (delta < 0) {
    writers[0].hideCharacter({ duration: 0 });
    replayRange(0, n);
  } else {
    writers[0].animateStroke(n, {
      onComplete: () => { animBusy = false; demoIdx = n; updateDemoUI(); },
    });
  }
}

function replayRange(i, to) {
  if (!live() || !writers.length) return;
  if (i > to) {
    animBusy = false;
    demoIdx = to;
    updateDemoUI();
    return;
  }
  writers[0].animateStroke(i, { onComplete: () => replayRange(i + 1, to) });
}

function replayDemo() {
  if (animBusy || !writers.length || !live()) return;
  animBusy = true;
  updateDemoUI();
  writers[0].hideCharacter({ duration: 0 });
  replayRange(0, demoIdx >= 0 ? demoIdx : 0);
}

function updateDemoUI() {
  if (!live()) return;
  const n = demoIdx < 0 ? 0 : demoIdx + 1;
  $id('hzCounter').textContent = totalStrokes ? `第 ${n} / ${totalStrokes} 笔` : '—';
  const pane = root.querySelector('[data-pane="strokes"]');
  const btn = (a) => pane.querySelector(`[data-action="${a}"]`);
  if (btn('play')) btn('play').disabled = animBusy;
  if (btn('prev-stroke')) btn('prev-stroke').disabled = demoIdx <= 0 || animBusy;
  if (btn('next-stroke')) btn('next-stroke').disabled = demoIdx >= totalStrokes - 1 || animBusy;
  if (btn('replay')) btn('replay').disabled = animBusy || demoIdx < 0;
}

// ── 步骤③ 临写 ──
function startWrite() {
  if (!writers.length || !live()) return;
  stopStrokeDemo();
  const pracW = writers[1];
  expected = 0;
  try { pracW.cancelQuiz(); } catch { /* ignore */ }
  pracW.hideCharacter({ duration: 0 });
  pracW.showOutline();
  updateWriteUI();
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
      updateWriteUI();
      floatMsg($id('hzPracticeBox'), pick(OK_MSGS), true);
      if (expected < totalStrokes) later(() => startStrokeDemo(expected), 450);
    },
    onMistake: () => floatMsg($id('hzPracticeBox'), pick(ERR_MSGS), false),
    onComplete: () => {
      if (!live()) return;
      expected = totalStrokes;
      updateWriteUI();
      stopStrokeDemo();
      later(() => goStep('done'), 450);
    },
  });
}

// ── 当前笔画循环演示（叠加层，未写完前持续播放） ──
function stopStrokeDemo() {
  demoToken += 1;
}

function startStrokeDemo(n) {
  if (!live()) return;
  const demoW = writers[2];
  if (!demoW || n < 0 || n >= totalStrokes) return;
  demoToken += 1; // 作废上一个演示循环
  const token = demoToken;
  try {
    demoW.hideCharacter({ duration: 0 });
    demoW.animateStroke(n, {
      onComplete: () => {
        if (!live() || token !== demoToken) return;
        later(() => {
          if (token !== demoToken) return; // 已被新演示取代则停止
          startStrokeDemo(n);
        }, 1100);
      },
    });
  } catch { /* 演示层异常时静默跳过 */ }
}

function updateWriteUI() {
  if (!live()) return;
  $id('hzProgressText').textContent =
    expected >= totalStrokes ? '全部完成！' : `第 ${expected + 1} / ${totalStrokes} 笔`;
  $id('hzDots').innerHTML = Array.from({ length: totalStrokes }, (_, i) => {
    const cls = i < expected ? 'done' : i === expected ? 'active' : '';
    return `<span class="hz-dot ${cls}">${i < expected ? '✓' : i + 1}</span>`;
  }).join('');
}

// ── 组词练习 ──
function resetWordPractice() {
  const p = $id('hzWordPractice');
  const d = $id('hzWordDone');
  const a = $id('hzWordActions');
  const chips = $id('hzWordChips');
  const dots = $id('hzWordDots');
  const progress = $id('hzWordProgressText');
  if (p) p.hidden = true;
  if (d) d.hidden = true;
  if (a) a.hidden = false;
  if (chips) chips.innerHTML = '';
  if (dots) dots.innerHTML = '';
  if (progress) progress.textContent = '';
  clearEl('hzWordWriter');
  clearEl('hzWordDemo');
}

function clearEl(id) {
  const el = $id(id);
  if (el) el.innerHTML = '';
}

function startWordPractice(w) {
  word = w;
  wordChars = [...w];
  wordIdx = 0;
  wordDone = false;
  resetWordPractice();
  startWordChar();
}

function startWordChar() {
  if (!live()) return;
  const c = wordChars[wordIdx];
  const loading = $id('hzWordLoading');
  if (loading) loading.hidden = false;
  ensureStroke(c).then((ok) => {
    if (!live()) return;
    if (!ok) {
      toast('这个字还没有笔画数据，换个词试试');
      return;
    }
    buildWordWriters();
    expected = 0;
    updateWordUI();
    later(() => startStrokeDemo(0), 400);
    startWordQuiz();
  });
}

function buildWordWriters() {
  [...wordWriters].forEach((w) => { try { w.cancelQuiz && w.cancelQuiz(); } catch { /* ignore */ } });
  wordWriters = [];
  const lib = window.HanziWriter;
  const c = wordChars[wordIdx];
  stopStrokeDemo();
  clearEl('hzWordWriter');
  clearEl('hzWordDemo');
  const base = {
    charData: strokeData,
    strokeColor: '#3f3a33',
    radicalColor: '#b45309',
    outlineColor: '#e4dccf',
    showOutline: true,
    showCharacter: false,
  };
  const writeSize = writerSize('hzWordBox');
  wordWriters.push(lib.create($id('hzWordWriter'), c, {
    ...base, width: writeSize, height: writeSize,
    strokeColor: '#0d9488', drawingColor: '#0d9488', drawingWidth: 50, outlineColor: 'rgba(228, 220, 207, 0.4)', strokeAnimationSpeed: 0.9,
  }));
  wordWriters.push(lib.create($id('hzWordDemo'), c, {
    charData: strokeData,
    width: writeSize,
    height: writeSize,
    strokeColor: '#f59e0b',
    radicalColor: '#f59e0b',
    showOutline: false,
    showCharacter: false,
    strokeAnimationSpeed: 0.8,
    delayBetweenStrokes: 150,
  }));
  const loading = $id('hzWordLoading');
  if (loading) loading.hidden = true;
}

function startWordQuiz() {
  if (!wordWriters.length || !live()) return;
  stopStrokeDemo();
  const pracW = wordWriters[0];
  try { pracW.cancelQuiz(); } catch { /* ignore */ }
  pracW.hideCharacter({ duration: 0 });
  pracW.showOutline();
  pracW.quiz({
    showOutline: true,
    showHintAfterMisses: 3,
    acceptMistakes: false,
    highlightOnComplete: true,
    markStrokeCorrectAfterMisses: 8,
    onCorrectStroke: (data) => {
      if (!live()) return;
      expected = data.strokeNum + 1;
      updateWordUI();
      floatMsg($id('hzWordBox'), pick(OK_MSGS), true);
      if (expected < totalStrokes) later(() => startWordDemo(expected), 450);
    },
    onMistake: () => floatMsg($id('hzWordBox'), pick(ERR_MSGS), false),
    onComplete: () => onWordCharDone(),
  });
}

function startWordDemo(n) {
  if (!live()) return;
  const demoW = wordWriters[1];
  if (!demoW || n < 0 || n >= totalStrokes) return;
  demoToken += 1; // 作废上一个演示循环
  const token = demoToken;
  try {
    demoW.hideCharacter({ duration: 0 });
    demoW.animateStroke(n, {
      onComplete: () => {
        if (!live() || token !== demoToken) return;
        later(() => {
          if (token !== demoToken) return; // 已被新演示取代则停止
          startWordDemo(n);
        }, 1100);
      },
    });
  } catch { /* 演示层异常时静默跳过 */ }
}

function updateWordUI() {
  if (!live()) return;
  $id('hzWordPractice').hidden = false;
  $id('hzWordChips').innerHTML = wordChars
    .map((ch, i) => {
      const cls = i < wordIdx ? 'done' : i === wordIdx ? 'active' : '';
      return `<span class="hz-word-chip ${cls}">${i < wordIdx ? '✓' : ch}</span>`;
    })
    .join('');
  $id('hzWordProgressText').textContent =
    expected >= totalStrokes ? '这个字完成！' : `「${wordChars[wordIdx]}」第 ${expected + 1} / ${totalStrokes} 笔`;
  $id('hzWordDots').innerHTML = Array.from({ length: totalStrokes }, (_, i) => {
    const cls = i < expected ? 'done' : i === expected ? 'active' : '';
    return `<span class="hz-dot ${cls}">${i < expected ? '✓' : i + 1}</span>`;
  }).join('');
}

function onWordCharDone() {
  if (!live()) return;
  stopStrokeDemo();
  wordIdx += 1;
  if (wordIdx >= wordChars.length) {
    wordDone = true;
    $id('hzWordDone').hidden = false;
    $id('hzWordActions').hidden = true;
    $id('hzWordDoneTitle').textContent = `「${word}」写完了！`;
    return;
  }
  updateWordUI();
  later(startWordChar, 450);
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
    case 'result':
      selectChar(btn.dataset.char);
      hideResults();
      break;
    case 'prev': stepChar(-1); break;
    case 'next': stepChar(1); break;
    case 'speak': {
      const doneEl = $id('hzWordDone');
      speak(word && doneEl && !doneEl.hidden ? word : current.c);
      break;
    }
    case 'to-strokes': goStep('strokes'); break;
    case 'to-write': goStep('write'); break;
    case 'to-words':
      root.querySelector('.hz-words-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    case 'next-char': stepChar(1); break;
    case 'play': playAll(); break;
    case 'prev-stroke': playStroke(-1); break;
    case 'next-stroke': playStroke(1); break;
    case 'replay': replayDemo(); break;
    case 'restart-write': startWrite(); break;
    case 'word': startWordPractice(btn.dataset.word); break;
    case 'word-restart': wordIdx = 0; wordDone = false; resetWordPractice(); startWordChar(); break;
    case 'word-exit': word = null; resetWordPractice(); break;
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
    const w = writerSize('hzDemoBox');
    if (Math.abs(w - lastWriterWidth) < 24) return;
    lastWriterWidth = w;
    const prevStep = step;
    const prevDemoIdx = demoIdx;
    try {
      if (word && wordChars.length) {
        startWordChar();
        toast('屏幕变化，练习重新开始啦');
      } else if (prevStep === 'write') {
        buildCharWriters();
        startWrite();
        toast('屏幕变化，练习重新开始啦');
      } else {
        buildCharWriters();
        if (prevStep === 'strokes' && prevDemoIdx >= 0) {
          animBusy = true;
          replayRange(0, Math.min(prevDemoIdx, totalStrokes - 1));
        }
      }
    } catch { /* ignore */ }
  }, 250);
}
