// kikkua · 儿童导航 — 精选儿童学习站点导航
// 结构：顶栏（返回 / 随便逛逛 / 收藏）+ Hero（标题 + 搜索）+ 分类胶囊 + 分组卡片
// 视觉复用站点设计系统，私有类统一 kd- 前缀；三端适配见 kids.css。

import { DATA_PATHS } from '../config.js';
import { ICONS } from '../icons.js';
import { navigate } from '../navigation.js';

const FAV_KEY = 'kikkua_kids_fav';
const SEARCH_DELAY = 260;

const IC = {
    heart: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.2A3.9 3.9 0 0 1 12 7.9a3.9 3.9 0 0 1 7 2.9C19 15.4 12 20 12 20z"/></svg>`,
    dice: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
};

const state = { q: '', cat: 'all' };

let root = null;
let data = null;
let favs = new Set();
let searchTimer = null;

// ══════════════════════════════════════════
//  工具
// ══════════════════════════════════════════

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function hostOf(site) {
    if (site.local || site.url.startsWith('/')) return 'kikkua.online';
    try {
        return new URL(site.url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function urlSelector(url) {
    return `[data-url="${String(url).replace(/["\\]/g, '\\$&')}"]`;
}

function loadFavs() {
    try {
        const raw = localStorage.getItem(FAV_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(arr) ? arr.filter((u) => typeof u === 'string') : []);
    } catch {
        return new Set();
    }
}

function saveFavs() {
    try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
    } catch {
        /* 无痕模式写入会失败，忽略 */
    }
}

function toast(msg) {
    if (!root) return;
    let el = root.querySelector('.kd-toast');
    if (!el) {
        el = document.createElement('div');
        el.className = 'kd-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        root.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-on'), 2000);
}

// ══════════════════════════════════════════
//  过滤
// ══════════════════════════════════════════

function matchQuery(site, q) {
    if (!q) return true;
    const hay = `${site.name} ${site.desc || ''} ${(site.tags || []).join(' ')} ${hostOf(site)}`.toLowerCase();
    return hay.includes(q);
}

function visibleSites() {
    if (!data) return [];
    const q = state.q.trim().toLowerCase();
    return data.sites.filter((s) => {
        if (!matchQuery(s, q)) return false;
        if (state.cat === '__fav') return favs.has(s.url);
        return state.cat === 'all' || s.cat === state.cat;
    });
}

// ══════════════════════════════════════════
//  渲染
// ══════════════════════════════════════════

function cardHTML(site, tone) {
    const on = favs.has(site.url);
    const note = site.note ? `<em class="kd-note">${esc(site.note)}</em>` : '';
    const linkAttrs = site.local ? 'data-link' : 'target="_blank" rel="noopener noreferrer"';
    const hint = site.local ? '' : '（在新窗口打开）';
    const favLabel = `${on ? '取消收藏' : '收藏'} ${site.name}`;
    return `
<div class="kd-card" data-tone="${esc(tone)}" data-url="${esc(site.url)}">
    <a class="kd-card-link" href="${esc(site.url)}" ${linkAttrs} aria-label="${esc(site.name)}${hint}">
        <span class="kd-card-icon" aria-hidden="true">${esc(site.icon || '🔗')}</span>
        <span class="kd-card-body">
            <span class="kd-card-name">${esc(site.name)}${note}</span>
            <span class="kd-card-desc">${esc(site.desc || '')}</span>
            <span class="kd-card-host">${esc(hostOf(site))}</span>
        </span>
    </a>
    <button class="kd-fav${on ? ' is-on' : ''}" type="button" data-url="${esc(site.url)}"
        data-name="${esc(site.name)}" aria-pressed="${on}" aria-label="${esc(favLabel)}">${IC.heart}</button>
</div>`;
}

function emptyHTML(title, hint, action) {
    const emoji = state.q.trim() ? '🤔' : state.cat === '__fav' ? '💛' : '🗂️';
    return `
<div class="kd-empty">
    <div class="kd-empty-emoji" aria-hidden="true">${emoji}</div>
    <div class="kd-empty-title">${esc(title)}</div>
    <div class="kd-empty-hint">${esc(hint)}</div>
    ${action || ''}
</div>`;
}

function sectionHTML(cat, sites) {
    return `
<section class="kd-sec" data-cat="${esc(cat.id)}">
    <div class="kd-sec-head">
        <span class="kd-sec-icon" aria-hidden="true">${esc(cat.icon)}</span>
        <h2 class="kd-sec-title">${esc(cat.name)}</h2>
        <span class="kd-sec-count">${sites.length}</span>
    </div>
    <div class="kd-grid">${sites.map((s) => cardHTML(s, cat.tone)).join('')}</div>
</section>`;
}

function paint() {
    const body = root && root.querySelector('#kdBody');
    if (!body || !data) return;

    const q = state.q.trim();
    const list = visibleSites();
    let html = '';

    if (!list.length) {
        if (state.cat === '__fav' && !q) {
            html = emptyHTML(
                '还没有收藏',
                '点卡片右上角的小心心，常用的网站就会放在这里',
                `<button class="kd-empty-btn" type="button" data-action="all">看看全部网站</button>`
            );
        } else if (q) {
            html = emptyHTML(
                state.cat === '__fav' ? `收藏里没有「${q}」` : `没有找到「${q}」`,
                '换个词试试，或者看看全部网站',
                `<button class="kd-empty-btn" type="button" data-action="reset">看看全部</button>`
            );
        } else {
            html = emptyHTML(
                '这个分类暂时没有内容',
                '先看看别的分类吧',
                `<button class="kd-empty-btn" type="button" data-action="reset">看看全部</button>`
            );
        }
    } else if (state.cat === '__fav') {
        html = sectionHTML({ id: '__fav', name: '我的收藏', icon: '❤️', tone: 'rose' }, list);
    } else {
        html = data.categories
            .map((cat) => {
                const sites = list.filter((s) => s.cat === cat.id);
                return sites.length ? sectionHTML(cat, sites) : '';
            })
            .join('');
    }

    body.innerHTML = html;
    syncChips();
    syncSub(list.length);
}

function syncChips() {
    if (!root) return;
    root.querySelectorAll('.kd-chip').forEach((btn) => {
        const on = btn.dataset.cat === state.cat;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    const favBtn = root.querySelector('[data-action="fav-filter"]');
    if (favBtn) {
        const on = state.cat === '__fav';
        favBtn.classList.toggle('is-active', on);
        favBtn.setAttribute('aria-pressed', String(on));
    }
}

function syncSub(shown) {
    const sub = root && root.querySelector('#kdSub');
    if (!sub || !data) return;
    const q = state.q.trim();
    if (q) {
        sub.textContent = `找到 ${shown} 个和「${q}」有关的网站`;
    } else if (state.cat === '__fav') {
        sub.textContent = shown ? `收藏了 ${shown} 个网站，随身带着走` : '收藏夹还是空的';
    } else if (state.cat === 'all') {
        sub.textContent = `${data.sites.length} 个好网站 · 挑过的，点开就能用`;
    } else {
        const cat = data.categories.find((c) => c.id === state.cat);
        sub.textContent = `${cat ? cat.name : '这个分类'}里有 ${shown} 个网站`;
    }
}

function syncFavCount() {
    const n = root && root.querySelector('.kd-hbtn-count');
    if (!n) return;
    n.textContent = String(favs.size);
    n.hidden = favs.size === 0;
}

function buildChips() {
    const chips = root && root.querySelector('#kdChips');
    if (!chips || !data) return;
    const items = [{ id: 'all', name: '全部', icon: '✨' }].concat(
        data.categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))
    );
    chips.innerHTML = items
        .map(
            (c) => `<button class="kd-chip${c.id === 'all' ? ' is-active' : ''}" type="button"
                data-cat="${esc(c.id)}" aria-pressed="${c.id === 'all'}">
                <span aria-hidden="true">${esc(c.icon)}</span>${esc(c.name)}
            </button>`
        )
        .join('');
}

// ══════════════════════════════════════════
//  交互
// ══════════════════════════════════════════

function setCat(cat) {
    state.cat = cat;
    paint();
    root.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleFav(url) {
    const on = !favs.has(url);
    if (on) favs.add(url);
    else favs.delete(url);
    saveFavs();
    syncFavCount();

    const btn = root.querySelector(`.kd-fav${urlSelector(url)}`);
    if (btn) {
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', `${on ? '取消收藏' : '收藏'} ${btn.dataset.name || ''}`.trim());
    }
    toast(on ? '收好了 ❤️' : '已取消收藏');

    // 在「我的收藏」里取消收藏，卡片要立刻收走
    if (state.cat === '__fav') paint();
}

function lucky() {
    const list = visibleSites();
    if (!list.length) {
        toast('换个分类再试试');
        return;
    }
    const picked = list[Math.floor(Math.random() * list.length)];

    const el = root.querySelector(`.kd-card${urlSelector(picked.url)}`);
    if (el) {
        el.classList.add('is-lucky');
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => el.classList.remove('is-lucky'), 1600);
    }

    if (picked.local) {
        navigate(picked.url);
        return;
    }
    const win = window.open(picked.url, '_blank', 'noopener');
    toast(win ? `带你去：${picked.name}` : '浏览器拦住了新窗口，点卡片也能打开');
}

function clearSearch() {
    const input = root.querySelector('#kdSearch');
    if (input) input.value = '';
    const clearBtn = root.querySelector('.kd-search-clear');
    if (clearBtn) clearBtn.hidden = true;
    state.q = '';
}

function onClick(e) {
    const favBtn = e.target.closest('.kd-fav');
    if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleFav(favBtn.dataset.url);
        return;
    }

    const chip = e.target.closest('.kd-chip');
    if (chip) {
        setCat(chip.dataset.cat);
        return;
    }

    const action = e.target.closest('[data-action]');
    if (!action) return;

    switch (action.dataset.action) {
        case 'clear':
            clearSearch();
            paint();
            break;
        case 'reset':
            clearSearch();
            state.cat = 'all';
            paint();
            break;
        case 'all':
            setCat('all');
            break;
        case 'lucky':
            lucky();
            break;
        case 'fav-filter':
            setCat(state.cat === '__fav' ? 'all' : '__fav');
            break;
        case 'reload':
            load();
            break;
        case 'top':
            root.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        default:
            break;
    }
}

let scrollTick = false;

function onScroll() {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
        scrollTick = false;
        const btn = root && root.querySelector('.kd-top');
        if (btn) btn.classList.toggle('is-on', root.scrollTop > 560);
    });
}

function onInput(e) {
    if (e.target.id !== 'kdSearch') return;
    const val = e.target.value;
    const clearBtn = root.querySelector('.kd-search-clear');
    if (clearBtn) clearBtn.hidden = !val;

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        state.q = val;
        paint();
    }, SEARCH_DELAY);
}

// ══════════════════════════════════════════
//  数据
// ══════════════════════════════════════════

async function load() {
    const body = root.querySelector('#kdBody');
    if (body) body.innerHTML = `<div class="kd-loading">正在把好网站搬过来…</div>`;

    try {
        const res = await fetch(DATA_PATHS.kidsSites + '?v=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json || !Array.isArray(json.sites) || !json.sites.length) throw new Error('empty data');
        data = json;

        buildChips();
        syncFavCount();
        paint();
    } catch (err) {
        console.error('儿童导航数据加载失败:', err);
        data = null;
        if (body) {
            body.innerHTML = emptyHTML(
                '网站清单没加载出来',
                '网络可能抖了一下，点下面重试',
                `<button class="kd-empty-btn" type="button" data-action="reload">重新加载</button>`
            );
            const sub = root.querySelector('#kdSub');
            if (sub) sub.textContent = '暂时没能连上数据服务';
        }
    }
}

// ══════════════════════════════════════════
//  入口
// ══════════════════════════════════════════

export async function renderKids() {
    const app = document.getElementById('app');
    if (!app) return;

    state.q = '';
    state.cat = 'all';
    data = null;
    favs = loadFavs();

    root = document.createElement('div');
    root.className = 'page kd-page';
    root.innerHTML = `
<header class="header kd-header">
    <div class="header-inner kd-header-inner">
        <div class="header-left">
            <a href="/" class="back-btn" data-link aria-label="返回首页">${ICONS.back}</a>
            <span class="header-title">儿童导航</span>
        </div>
        <div class="header-right">
            <button class="kd-hbtn" type="button" data-action="lucky" aria-label="随机推荐一个网站">
                ${IC.dice}<i>随便逛逛</i>
            </button>
            <button class="kd-hbtn" type="button" data-action="fav-filter" aria-pressed="false" aria-label="只看我的收藏">
                ${IC.heart}<i>我的收藏</i><b class="kd-hbtn-count" hidden>0</b>
            </button>
        </div>
    </div>
</header>

<main class="kd-main">
    <section class="kd-hero">
        <h1 class="kd-hero-title">今天想玩点什么呢？</h1>
        <p class="kd-hero-sub" id="kdSub">正在加载好网站…</p>
        <div class="kd-search">
            <span class="kd-search-icon" aria-hidden="true">${IC.search}</span>
            <label class="kd-sr" for="kdSearch">搜索网站</label>
            <input class="kd-search-input" id="kdSearch" type="search" autocomplete="off"
                enterkeyhint="search" placeholder="搜一搜：汉字 / 恐龙 / 数学">
            <button class="kd-search-clear" type="button" data-action="clear" hidden aria-label="清空搜索">${IC.close}</button>
        </div>
        <nav class="kd-chips" id="kdChips" aria-label="按分类筛选"></nav>
    </section>

    <div class="kd-body" id="kdBody"></div>

    <footer class="kd-foot">
        <p>点卡片会打开对应网站，本站不存放别人的内容。</p>
        <p>遇到打不开或不想给孩子看的，让家长从清单里删掉就好。</p>
    </footer>

    <button class="kd-top" type="button" data-action="top" aria-label="回到顶部">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
    </button>
</main>`;

    app.replaceChildren(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('scroll', onScroll, { passive: true });

    await load();
}
