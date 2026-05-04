import { $, $$, esc } from '../utils.js';
import { ICONS, storage } from '../storage.js';
import { dataLoader } from '../data-loader.js';
import { replaceFields, renderCard } from '../card.js';
import { setPageMeta } from '../seo.js';
import { getDecks } from './decks.js';
import { UI, ROUTES, DEFAULTS } from '../config.js';

/* ── Tree helpers ── */

function findNodeByPath(nodes, path) {
    for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children.length) { const f = findNodeByPath(n.children, path); if (f) return f; }
    }
    return null;
}

function findNodeByIndex(nodes, index) {
    for (const n of nodes) {
        if (n.indices && n.indices.includes(index)) return n;
        if (n.children.length) { const f = findNodeByIndex(n.children, index); if (f) return f; }
    }
    return null;
}

function findFirstLeaf(nodes) {
    for (const n of nodes) {
        if (n.indices && n.indices.length) return n;
        if (n.children.length) { const f = findFirstLeaf(n.children); if (f) return f; }
    }
    return null;
}

function expandToPath(nodes, path) {
    const parts = path.split('::');
    for (let i = 1; i < parts.length; i++) {
        const p = findNodeByPath(nodes, parts.slice(0, i).join('::'));
        if (p) p.collapsed = false;
    }
}

/* ── Build directory tree from records ── */

function buildDirectory(state) {
    const chapterField = state.chapterField || DEFAULTS.chapterField;
    const group = new Map();
    state.records.forEach((r, i) => {
        const ch = r[chapterField] || '';
        if (!group.has(ch)) group.set(ch, []);
        group.get(ch).push(i);
    });

    function inject(nodes, parts, indices) {
        const [head, ...rest] = parts;
        let node = nodes.find(n => n.name === head);
        if (!node) {
            node = { name: head, path: parts.join('::'), children: [], collapsed: true };
            nodes.push(node);
        }
        if (rest.length === 0) node.indices = indices;
        else inject(node.children, rest, indices);
    }

    const tree = [];
    for (const [path, indices] of group) {
        const parts = path.split('::').map(s => s.trim()).filter(Boolean);
        if (parts.length) inject(tree, parts, indices);
    }

    (function tally(nodes) {
        for (const n of nodes) {
            if (n.children.length) { tally(n.children); n.totalCount = n.children.reduce((s, c) => s + (c.totalCount || c.indices.length), 0); }
            else n.totalCount = n.indices ? n.indices.length : 0;
        }
    })(tree);

    state.directory = tree;
}

/* ── Render directory tree ── */

function renderDirectory(state) {
    const el = $('#dirContent');
    if (!el) return;
    const active = state.currentPath;
    el.innerHTML = (function walk(nodes, depth) {
        let html = '';
        for (const n of nodes) {
            const isFolder = n.children.length > 0;
            html += `<div class="dir-item${n.path === active ? ' active' : ''}" data-path="${n.path}" style="--level: ${depth}">
                <div class="dir-row"><span class="dir-icon">${isFolder ? (n.collapsed ? '📁' : '📂') : '📄'}</span><span class="dir-name">${n.name}</span></div>
                <div class="dir-right">${isFolder ? `<span class="dir-collapse">${n.collapsed ? '▶' : '▼'}</span>` : ''}<span class="dir-count">${n.totalCount}</span></div>
            </div>`;
            if (isFolder && !n.collapsed) html += walk(n.children, depth + 1);
        }
        return html;
    })(state.directory, 0);
}

/* ── Handlers ── */

function initDirectoryHandlers(state) {
    $('#menuBtn').addEventListener('click', () => openSidebar());
    $('#sidebarClose').addEventListener('click', () => closeSidebar());
    $('#sidebarOverlay').addEventListener('click', () => closeSidebar());

    $('#dirContent').addEventListener('click', (e) => {
        const item = e.target.closest('.dir-item');
        if (!item) return;
        const node = findNodeByPath(state.directory, item.dataset.path);
        if (!node) return;
        if (node.children.length) {
            node.collapsed = !node.collapsed;
            renderDirectory(state);
            return;
        }
        if (!node.indices || !node.indices.length) return;
        state.currentPath = node.path;
        state.currentIndex = node.indices[0];
        state.isShowingFront = true;
        saveProgress(state);
        buildCardHTML(state);
        renderCard(state);
        updateProgress(state, true);
        renderDirectory(state);
        closeSidebar();
    });
}

function openSidebar() {
    $('#sidebar').classList.add('open');
    $('#sidebarOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('show');
    document.body.style.overflow = '';
}

function buildCardHTML(state) {
    const record = state.records[state.currentIndex];
    state.frontHTML = replaceFields(state.template.front, record);
    state.backHTML = replaceFields(state.template.back, record);
}

function updateProgress(state, skipHighlight = false) {
    $('#progress-text').textContent = `${state.currentIndex + 1} / ${state.records.length}`;
    $('#prevBtn').disabled = state.currentIndex === 0;
    $('#nextBtn').disabled = state.currentIndex === state.records.length - 1;
    if (!skipHighlight) highlightCurrentChapter(state);
}

function highlightCurrentChapter(state) {
    if (!state.directory) return;
    const node = findNodeByIndex(state.directory, state.currentIndex);
    if (!node) return;
    state.currentPath = node.path;
    expandToPath(state.directory, node.path);
    renderDirectory(state);
}

function saveProgress(state) {
    state.progress.lastIndex = state.currentIndex;
    state.progress.lastChapter = state.currentPath || '';
    storage.saveDeckProgress(state.deckName, state.progress);
}

/* ── Study page render ── */

async function loadStudyData(state) {
    const { template, records, fields, chapterField } = await dataLoader.loadDeck(state.deckName, {
        template: state.deckInfo?.template,
        chapterField: state.deckInfo?.chapterField
    });
    state.template = template;
    state.records = records;
    state.fields = fields;
    state.chapterField = chapterField;

    if (!records.length) { showComplete(state); return; }

    state.directory = [];
    buildDirectory(state);
    state.currentPath = state.progress.lastChapter || null;
    if (state.currentPath && !findNodeByPath(state.directory, state.currentPath)) state.currentPath = null;
    if (!state.currentPath) { const f = findFirstLeaf(state.directory); state.currentPath = f ? f.path : null; }
    state.currentIndex = state.currentPath ? (findNodeByPath(state.directory, state.currentPath)?.indices?.[0] || 0) : 0;

    renderDirectory(state);
    buildCardHTML(state);
    renderCard(state);
    updateProgress(state, true);
    expandToPath(state.directory, state.currentPath);
    renderDirectory(state);
}

function showComplete(state) {
    $('#app').innerHTML = `
        <div class="page">
            <header class="header">
                <div class="header-inner">
                    <div class="header-left"><a href="/${ROUTES.deckDetail}${encodeURIComponent(state.deckName)}" class="back-btn">${ICONS.back}</a></div>
                    <h1 class="header-title">${state.deckName}</h1>
                </div>
            </header>
            <div class="container">
                <div class="complete-page">
                    <div class="complete-icon">${ICONS.check}</div>
                    <h2 class="complete-title">${UI.study.empty}</h2>
                    <p class="complete-subtitle">${UI.study.emptyHint}</p>
                    <div class="complete-actions"><a href="/${ROUTES.deckDetail}${encodeURIComponent(state.deckName)}" class="btn btn-secondary">${UI.study.back}</a></div>
                </div>
            </div>
        </div>`;
}

export async function renderStudy(deckName) {
    const app = $('#app');
    const allDecks = getDecks();
    const deckInfo = allDecks.find(d => d.name === deckName) || {};

    app.innerHTML = `
        <div class="page study-page" id="study-page">
            <header class="header">
                <div class="header-row">
                    <div class="header-offset"></div>
                    <div class="header-inner">
                        <div class="header-left">
                            <button class="menu-btn" id="menuBtn">☰</button>
                            <a href="/${ROUTES.deckDetail}${encodeURIComponent(deckName)}" class="back-btn">${ICONS.back}</a>
                        </div>
                        <h1 class="header-title">${deckName}</h1>
                        <div class="header-right"><span class="progress-text" id="progress-text">${UI.study.loading}</span></div>
                    </div>
                </div>
            </header>
            <div class="study-body">
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar-header"><span class="sidebar-title">${UI.study.sidebarTitle}</span><button class="sidebar-close" id="sidebarClose">×</button></div>
                    <div class="sidebar-content" id="dirContent"></div>
                    <div class="sidebar-purchase" id="sidebarPurchase"></div>
                </aside>
                <div class="sidebar-overlay" id="sidebarOverlay"></div>
                <main class="study-main">
                    <iframe id="card-frame" class="card-frame"></iframe>
                    <div class="action-bar">
                        <button class="action-btn action-btn-nav" id="prevBtn">${UI.study.prev}</button>
                        <button class="action-btn action-btn-toggle" id="toggleBtn">${UI.study.flip}</button>
                        <button class="action-btn action-btn-nav" id="nextBtn">${UI.study.next}</button>
                    </div>
                </main>
            </div>
        </div>`;

    const studyState = {
        deckName, deckInfo, records: [], currentIndex: 0, isShowingFront: true,
        progress: storage.getDeckProgress(deckName), frontHTML: '', backHTML: '', config: {}, directory: [], currentPath: null
    };

    await loadStudyData(studyState);
    if (!studyState.records || !studyState.records.length) return;

    if (studyState.deckInfo.purchaseUrl) {
        const el = $('#sidebarPurchase');
        if (el) el.innerHTML = `<a href="${studyState.deckInfo.purchaseUrl}" target="_blank" rel="noopener" class="purchase-link">${UI.study.purchase}</a>`;
    }

    initDirectoryHandlers(studyState);
    initStudyHandlers(studyState);
    setPageMeta(deckName + UI.study.titleSuffix, '');
}

function initStudyHandlers(state) {
    $('#toggleBtn').addEventListener('click', () => { state.isShowingFront = !state.isShowingFront; renderCard(state); });
    $('#prevBtn').addEventListener('click', () => {
        if (state.currentIndex > 0) { state.currentIndex--; state.isShowingFront = true; saveProgress(state); buildCardHTML(state); renderCard(state); updateProgress(state); }
    });
    $('#nextBtn').addEventListener('click', () => {
        if (state.currentIndex < state.records.length - 1) { state.currentIndex++; state.isShowingFront = true; saveProgress(state); buildCardHTML(state); renderCard(state); updateProgress(state); }
    });
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); state.isShowingFront = !state.isShowingFront; renderCard(state); }
        else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') $('#prevBtn').click();
        else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') $('#nextBtn').click();
    });
}
