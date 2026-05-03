const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const ICONS = {
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
    cards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    click: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>`,
    scroll: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`
};

/* ── 会话缓存（sessionStorage 包装） ── */
const sessionCache = {
    get(key) {
        try {
            const raw = sessionStorage.getItem('k_ck_' + key);
            if (!raw) return null;
            const { data, expires } = JSON.parse(raw);
            if (expires && Date.now() > expires) {
                sessionStorage.removeItem('k_ck_' + key);
                return null;
            }
            return data;
        } catch { return null; }
    },
    set(key, value, ttlMs = 0) {
        try {
            sessionStorage.setItem('k_ck_' + key, JSON.stringify({
                data: value,
                expires: ttlMs ? Date.now() + ttlMs : 0
            }));
        } catch {}
    }
};

/* ── 持久化存储（localStorage） ── */
class Storage {
    constructor() {
        this.prefix = 'kikkua_';
    }

    get(key) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch (e) {
            console.warn('Storage error:', e);
        }
    }

    getDeckProgress(deckName) {
        return this.get(`progress_${deckName}`) || {
            lastIndex: 0,
            lastStudy: null
        };
    }

    saveDeckProgress(deckName, progress) {
        progress.lastStudy = Date.now();
        this.set(`progress_${deckName}`, progress);
    }
}

/* ── 数据加载器 ── */
class DataLoader {
    async loadDeck(deckName, { template: templateName = '', chapterField = '章节' } = {}) {
        const cached = sessionCache.get('deck_' + deckName);
        if (cached) return cached;

        const basePath = `/data/${encodeURIComponent(deckName)}`;

        try {
            const csvResp = await fetch(`${basePath}/data.csv`).catch(() => null);

            let template = { front: '', back: '' };
            if (templateName) {
                template = await this.loadTemplate(templateName);
            }

            let records = [];
            let csvFields = [];
            if (csvResp?.ok) {
                const csvText = await csvResp.text();
                const parsed = this.parseCSV(csvText);
                csvFields = parsed.fields;
                records = parsed.records;
            }

            const result = { template, records, fields: csvFields, chapterField };
            sessionCache.set('deck_' + deckName, result);
            return result;
        } catch (e) {
            console.error('Failed to load deck:', e);
            return { template: { front: '', back: '' }, records: [], fields: [], chapterField: '章节' };
        }
    }

    async loadTemplate(templateName) {
        const cached = sessionCache.get('tpl_' + templateName);
        if (cached) return cached;

        const basePath = `/templates/${encodeURIComponent(templateName)}`;

        try {
            const [frontResp, backResp, cssResp] = await Promise.all([
                fetch(`${basePath}/正面模板.html`).catch(() => null),
                fetch(`${basePath}/背面模板.html`).catch(() => null),
                fetch(`${basePath}/样式.css`).catch(() => null)
            ]);

            const css = cssResp?.ok ? await cssResp.text() : '';
            const front = frontResp?.ok ? await frontResp.text() : '{{Front}}';
            const back = backResp?.ok ? await backResp.text() : '{{FrontSide}}\n\n<hr>\n\n{{Back}}';

            const result = {
                front: wrapWithCSS(front, css),
                back: wrapWithCSS(back, css)
            };
            sessionCache.set('tpl_' + templateName, result);
            return result;
        } catch {
            return {
                front: wrapWithCSS('{{Front}}', ''),
                back: wrapWithCSS('{{FrontSide}}\n\n<hr>\n\n{{Back}}', '')
            };
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length === 0) return { fields: [], records: [] };

        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                } else if (ch === ',' && !inQuotes) {
                    result.push(current); current = '';
                } else { current += ch; }
            }
            result.push(current);
            return result;
        };

        const header = parseLine(lines[0]).map(f => f.trim());
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = parseLine(line);
            const record = {};
            header.forEach((field, idx) => {
                record[field] = values[idx] !== undefined ? values[idx] : '';
            });
            records.push(record);
        }
        return { fields: header, records };
    }

    async discoverDecks() {
        try {
            const response = await fetch('/data/index.json');
            if (!response.ok) return [];
            const entries = await response.json();
            const decks = [];
            for (const entry of entries) {
                const progress = storage.getDeckProgress(entry.name);
                decks.push({
                    name: entry.name,
                    lastStudy: progress.lastStudy,
                    totalCards: entry.totalCards || 0,
                    tags: entry.tags || [],
                    detail: entry.detail || '',
                    template: entry.template || '',
                    chapterField: entry.chapterField || '章节',
                    purchaseUrl: entry.purchaseUrl || ''
                });
            }
            return decks;
        } catch {
            return [];
        }
    }
}

const storage = new Storage();
const dataLoader = new DataLoader();

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFields(template, data) {
    let result = template;
    const fieldsInTemplate = extractFieldsFromTemplate(template);

    const filledData = { ...data };
    fieldsInTemplate.forEach(field => {
        if (filledData[field] === undefined) {
            filledData[field] = '';
        }
    });

    for (const [key, value] of Object.entries(filledData)) {
        const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

function extractFieldsFromTemplate(template) {
    const regex = /\{\{([^#\/\{}^]+?)\}\}/g;
    const matches = [...template.matchAll(regex)];
    return [...new Set(matches.map(m => m[1].trim()))];
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    const months = Math.floor(days / 30);
    return `${months} 个月前`;
}

function renderHome() {
    const app = $('#app');
    app.innerHTML = `
        <div class="page home-page">
            <div class="home-logo">kikkua<span class="accent">·</span></div>
            <div class="home-tagline">间隔重复 · 高效记忆</div>
            <div class="home-desc">
                <p>kikkua 是一款基于间隔重复（Spaced Repetition）原理的卡片学习工具。将知识拆解为一张张卡片，通过科学的复习节奏，让记忆效率大幅提升。</p>
                <p>支持自定义牌组与 Anki 模板，适用于语言学习、医学备考、编程知识整理等各类场景。</p>
            </div>
            <a href="/decks" class="home-cta">
                浏览牌组
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <footer class="footer">
                <p class="footer-quote">学习之要，在于重复。温故知新，积微成著。</p>
            </footer>
        </div>
    `;
}

let _gDecks = [];

/* ── Tag helpers ── */

function getRootAndLeaf(tagPath) {
    // Split "A::B::C" into root "A" and display "C"
    const parts = tagPath.split('::');
    return { root: parts[0], label: parts[parts.length - 1], depth: parts.length };
}

function buildSiblingTags(decks, filterPath) {
    // Get child tags one level below filterPath
    const prefix = filterPath ? filterPath + '::' : '';
    const map = new Map();
    for (const d of decks) {
        for (const t of d.tags) {
            if (!t.startsWith(prefix)) continue;
            const seg = t.slice(prefix.length).split('::')[0];
            if (seg) map.set(seg, true);
        }
    }
    return [...map.keys()].sort((a, b) => a.localeCompare(b, 'zh'));
}

function tagMatch(deckTags, filterPath) {
    if (!filterPath) return true;
    return deckTags.some(t => t === filterPath || t.startsWith(filterPath + '::'));
}

async function renderDeckList(filterPath) {
    const app = $('#app');
    const decks = _gDecks.length ? _gDecks : await dataLoader.discoverDecks();
    _gDecks = decks;
    filterPath = filterPath || '';

    const filtered = decks.filter(d => tagMatch(d.tags, filterPath));
    const rootTags = buildSiblingTags(decks, '');
    const childTags = buildSiblingTags(decks, filterPath);
    const hasChildren = childTags.length > 0;

    // Breadcrumb
    let crumbHtml = '';
    if (filterPath) {
        const parts = filterPath.split('::');
        let cum = [];
        for (let i = 0; i <= parts.length; i++) {
            const prev = parts.slice(0, i).join('::');
            const label = i === 0 ? '全部' : parts[i - 1];
            cum.push(`<span class="tag-crumb${prev === filterPath ? ' current' : ''}" data-path="${prev}">${label}</span>`);
        }
        crumbHtml = `<div class="tag-crumbs">${cum.join('<span class="tag-crumb-sep">›</span>')}</div>`;
    }

    // Pills row
    const pills = filterPath
        ? childTags.map(t => ({ label: t, path: filterPath + '::' + t, active: false }))
        : [{ label: '全部', path: '', active: true }, ...rootTags.map(t => ({ label: t, path: t, active: false }))];

    const pillsHtml = pills.map(p =>
        `<span class="tag-pill${p.active ? ' active' : ''}" data-path="${p.path}">${p.label}</span>`
    ).join('');

    app.innerHTML = `
        <div class="page" id="decks-page">
            <div class="container">
                <header class="header">
                    <div class="header-inner" style="justify-content: flex-start;">
                        <a href="/" class="back-btn" title="首页">${ICONS.back}</a>
                        <h1 class="header-title" style="margin-left: 4px;">牌组列表</h1>
                    </div>
                </header>

                <div class="tag-bar">
                    ${crumbHtml}
                    <div class="tag-pills-wrap">${pillsHtml}</div>
                    ${filtered.length > 0 ? `<div class="tag-result">${filtered.length} 个牌组</div>` : ''}
                </div>

                <div class="deck-grid" id="deck-list">
                    ${filtered.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">📚</div>
                        <h3 class="empty-title">没有匹配的牌组</h3>
                        <p class="empty-desc">换一个标签试试</p>
                    </div>` :
                    filtered.map(deck => {
                        const lastStudyText = deck.lastStudy ? formatTimeAgo(deck.lastStudy) : '尚未学习';
                        // Show each deck's tags as leaf labels
                        const tagsHtml = (deck.tags || []).map(t => {
                            const { label } = getRootAndLeaf(t);
                            return `<span class="deck-tag">${label}</span>`;
                        }).join('');
                        return `
                        <div class="deck-card" data-deck="${deck.name}">
                            <div class="deck-card-header">
                                <div class="deck-icon">📜</div>
                                <span class="deck-badge">${deck.totalCards} 张卡片</span>
                            </div>
                            <h3 class="deck-title">${deck.name}</h3>
                            <div class="deck-meta">
                                <span class="deck-meta-item">
                                    ${ICONS.calendar}
                                    ${lastStudyText}
                                </span>
                            </div>
                            ${tagsHtml ? `<div class="deck-tags">${tagsHtml}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Pill clicks
    $$('.tag-pill').forEach(p => {
        p.addEventListener('click', () => {
            const path = p.dataset.path;
            navigate(path ? `/decks?tag=${encodeURIComponent(path)}` : '/decks');
        });
    });

    // Breadcrumb clicks
    $$('.tag-crumb:not(.current)').forEach(c => {
        c.addEventListener('click', () => {
            const path = c.dataset.path;
            navigate(path ? `/decks?tag=${encodeURIComponent(path)}` : '/decks');
        });
    });

    // Deck card clicks
    $$('.deck-card[data-deck]').forEach(card => {
        card.addEventListener('click', () => {
            navigate(`/deck/${encodeURIComponent(card.dataset.deck)}`);
        });
    });
}

function mdToHtml(text) {
    if (!text) return '';
    const inline = (s) => s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const blocks = text.split(/\n{2,}/);
    return blocks.map(b => {
        b = b.trim();
        if (!b) return '';
        if (/^#{1,3}\s/.test(b)) {
            const level = b.match(/^#{1,3}/)[0].length;
            return `<h${level}>${inline(b.slice(level + 1))}</h${level}>`;
        }
        if (/^> /.test(b)) {
            return `<blockquote>${inline(b.replace(/\n> /g, '\n').slice(2))}</blockquote>`;
        }
        if (/^[-*]\s/.test(b)) {
            const items = b.split(/\n(?=[-*]\s)/).map(i => `<li>${inline(i.slice(2))}</li>`).join('');
            return `<ul>${items}</ul>`;
        }
        if (/^\d+\.\s/.test(b)) {
            const items = b.split(/\n(?=\d+\.\s)/).map(i => `<li>${inline(i.replace(/^\d+\.\s/, ''))}</li>`).join('');
            return `<ol>${items}</ol>`;
        }
        if (/^```/.test(b)) {
            const code = b.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
            return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        }
        return `<p>${inline(b.replace(/\n/g, '<br>'))}</p>`;
    }).join('');
}

async function renderDeckDetail(deckName) {
    const app = $('#app');
    if (!_gDecks.length) {
        _gDecks = await dataLoader.discoverDecks();
    }
    const deck = _gDecks.find(d => d.name === deckName);

    if (deck) {
        setPageMeta(deck.name, deck.detail ? deck.detail.replace(/[#*\n`\[\]]/g, '').slice(0, 150) : '');
    }

    if (!deck) {
        app.innerHTML = `<div class="page"><div class="container"><div class="empty-state"><h3 class="empty-title">牌组不存在</h3><a href="/decks" class="btn btn-secondary mt-3">返回列表</a></div></div></div>`;
        return;
    }

    const tags = deck.tags || [];

    app.innerHTML = `
        <div class="page detail-page">
            <div class="container">
                <header class="header" style="border:none;">
                    <div class="header-inner" style="justify-content: flex-start;">
                        <a href="/decks" class="back-btn" title="返回">
                            ${ICONS.back}
                        </a>
                        <h1 class="header-title" style="margin-left: 4px;">${deck.name}</h1>
                    </div>
                </header>

                <div class="detail-header">
                    <h2 class="detail-title">${deck.name}</h2>
                    <div class="detail-count">${deck.totalCards} 张卡片</div>
                    ${tags.length ? `<div class="detail-tags">${tags.map(t => `<span class="detail-tag">${t.replace(/::/g, ' › ')}</span>`).join('')}</div>` : ''}
                </div>

                ${deck.detail ? `<div class="detail-body">${mdToHtml(deck.detail)}</div>` : ''}

                <div class="detail-actions">
                    <a href="/study/${encodeURIComponent(deck.name)}" class="btn-primary">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                        开始学习
                    </a>
                    ${deck.purchaseUrl ? `
                    <div class="detail-sep">或者</div>
                    <a href="${deck.purchaseUrl}" target="_blank" rel="noopener" class="purchase-link">购买完整牌组 →</a>` : ''}
                </div>
            </div>
        </div>
    `;
}

async function renderStudy(deckName) {
    const app = $('#app');

    app.innerHTML = `
        <div class="page study-page" id="study-page">
            <header class="header">
                <div class="header-row">
                    <div class="header-offset"></div>
                    <div class="header-inner">
                        <div class="header-left">
                            <button class="menu-btn" id="menuBtn">☰</button>
                            <a href="/deck/${encodeURIComponent(deckName)}" class="back-btn" title="返回">
                                ${ICONS.back}
                            </a>
                        </div>
                        <h1 class="header-title">${deckName}</h1>
                        <div class="header-right">
                            <span class="progress-text" id="progress-text">加载中...</span>
                        </div>
                    </div>
                </div>
            </header>

            <div class="study-body">
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar-header">
                        <span class="sidebar-title">目录</span>
                        <button class="sidebar-close" id="sidebarClose">×</button>
                    </div>
                    <div class="sidebar-content" id="dirContent"></div>
                    <div class="sidebar-purchase" id="sidebarPurchase"></div>
                </aside>
                <div class="sidebar-overlay" id="sidebarOverlay"></div>

                <main class="study-main">
                    <iframe id="card-frame" class="card-frame"></iframe>

                    <div class="action-bar">
                        <button class="action-btn action-btn-nav" id="prevBtn">
                            上一张
                        </button>
                        <button class="action-btn action-btn-toggle" id="toggleBtn">
                            翻转
                        </button>
                        <button class="action-btn action-btn-nav" id="nextBtn">
                            下一张
                        </button>
                    </div>
                </main>
            </div>
        </div>
    `;

    const deckInfo = _gDecks.find(d => d.name === deckName) || {};

    const studyState = {
        deckName,
        deckInfo,
        records: [],
        currentIndex: 0,
        isShowingFront: true,
        progress: storage.getDeckProgress(deckName),
        frontHTML: '',
        backHTML: '',
        config: {},
        directory: [],
        currentPath: null
    };

    await loadStudyData(studyState);
    // If no records, showComplete was called and DOM is gone
    if (!studyState.records || !studyState.records.length) return;
    if (studyState.deckInfo.purchaseUrl) {
        const el = $('#sidebarPurchase');
        if (el) {
            el.innerHTML = `<a href="${studyState.deckInfo.purchaseUrl}" target="_blank" rel="noopener" class="purchase-link">购买完整牌组 →</a>`;
        }
    }
    initDirectoryHandlers(studyState);
    initStudyHandlers(studyState);
}

async function loadStudyData(state) {
    const { template, records, fields, chapterField } = await dataLoader.loadDeck(state.deckName, {
        template: state.deckInfo?.template,
        chapterField: state.deckInfo?.chapterField
    });

    state.template = template;
    state.records = records;
    state.fields = fields;
    state.chapterField = chapterField;

    if (records.length === 0) {
        showComplete(state);
        return;
    }

    state.directory = [];
    buildDirectory(state);
    state.currentPath = state.progress.lastChapter || null;

    // Validate saved path still exists; fallback to first leaf
    if (state.currentPath && !findNodeByPath(state.directory, state.currentPath)) {
        state.currentPath = null;
    }
    if (!state.currentPath) {
        const first = findFirstLeaf(state.directory);
        state.currentPath = first ? first.path : null;
    }

    if (state.currentPath) {
        const node = findNodeByPath(state.directory, state.currentPath);
        state.currentIndex = node && node.indices ? node.indices[0] : 0;
    } else {
        state.currentIndex = 0;
    }

    renderDirectory(state);

    buildCardHTML(state);
    renderCard(state);
    updateProgress(state, true);
    expandToPath(state.directory, state.currentPath);
    renderDirectory(state);
}

function buildDirectory(state) {
    const chapterField = state.chapterField || '章节';

    // Group records by chapter
    const group = new Map();
    state.records.forEach((r, i) => {
        const ch = r[chapterField] || '';
        if (!group.has(ch)) group.set(ch, []);
        group.get(ch).push(i);
    });

    // Build tree from "A::B::C" paths
    function inject(nodes, parts, indices) {
        const [head, ...rest] = parts;
        let node = nodes.find(n => n.name === head);
        if (!node) {
            node = { name: head, path: parts.join('::'), children: [], collapsed: true };
            nodes.push(node);
        }
        if (rest.length === 0) {
            node.indices = indices;
        } else {
            inject(node.children, rest, indices);
        }
    }

    const tree = [];
    for (const [path, indices] of group) {
        const parts = path.split('::').map(s => s.trim()).filter(Boolean);
        if (parts.length) inject(tree, parts, indices);
    }

    // Count totals (post-order)
    (function tally(nodes) {
        for (const n of nodes) {
            if (n.children.length) {
                tally(n.children);
                n.totalCount = n.children.reduce((s, c) => s + (c.totalCount || c.indices.length), 0);
            } else {
                n.totalCount = n.indices ? n.indices.length : 0;
            }
        }
    })(tree);

    state.directory = tree;
}

function renderDirectory(state) {
    const el = $('#dirContent');
    if (!el) return;
    const active = state.currentPath;
    el.innerHTML = (function walk(nodes, depth) {
        let html = '';
        for (const n of nodes) {
            const isFolder = n.children.length > 0;
            html += `
                <div class="dir-item${n.path === active ? ' active' : ''}" data-path="${n.path}" style="--level: ${depth}">
                    <div class="dir-row">
                        <span class="dir-icon">${isFolder ? (n.collapsed ? '📁' : '📂') : '📄'}</span>
                        <span class="dir-name">${n.name}</span>
                    </div>
                    <div class="dir-right">
                        ${isFolder ? `<span class="dir-collapse">${n.collapsed ? '▶' : '▼'}</span>` : ''}
                        <span class="dir-count">${n.totalCount}</span>
                    </div>
                </div>`;
            if (isFolder && !n.collapsed) html += walk(n.children, depth + 1);
        }
        return html;
    })(state.directory, 0);
}

function findNodeByPath(nodes, path) {
    for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children.length) {
            const found = findNodeByPath(n.children, path);
            if (found) return found;
        }
    }
    return null;
}

function findNodeByIndex(nodes, index) {
    for (const n of nodes) {
        if (n.indices && n.indices.includes(index)) return n;
        if (n.children.length) {
            const found = findNodeByIndex(n.children, index);
            if (found) return found;
        }
    }
    return null;
}

function findFirstLeaf(nodes) {
    for (const n of nodes) {
        if (n.indices && n.indices.length) return n;
        if (n.children.length) {
            const found = findFirstLeaf(n.children);
            if (found) return found;
        }
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

function initDirectoryHandlers(state) {
    const menuBtn = $('#menuBtn');
    const sidebarClose = $('#sidebarClose');
    const sidebarOverlay = $('#sidebarOverlay');

    menuBtn.addEventListener('click', () => openSidebar());
    sidebarClose.addEventListener('click', () => closeSidebar());
    sidebarOverlay.addEventListener('click', () => closeSidebar());

    $('#dirContent').addEventListener('click', (e) => {
        const item = e.target.closest('.dir-item');
        if (!item) return;
        const node = findNodeByPath(state.directory, item.dataset.path);
        if (!node) return;

        // Folder: toggle expand/collapse, no navigation, sidebar stays open
        if (node.children.length) {
            node.collapsed = !node.collapsed;
            renderDirectory(state);
            return;
        }

        // Leaf: navigate to its cards
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
    const index = state.currentIndex;
    const record = state.records[index];
    const data = { ...record };

    const frontContent = replaceFields(state.template.front, data);
    const backContent = replaceFields(state.template.back, data);

    state.frontHTML = frontContent;
    state.backHTML = backContent;
}

function wrapWithCSS(html, css) {
    if (html.includes('<html') || html.includes('<!DOCTYPE')) {
        if (css) {
            const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            if (styleMatch) {
                return html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>${css}</style>`);
            }
            const headMatch = html.match(/<\/head>/i);
            if (headMatch) {
                return html.replace(/<\/head>/i, `<style>${css}</style></head>`);
            }
        }
        return html;
    }

    let bodyContent = html;
    let allScripts = '';

    const templateRegex = /<template[^>]*>([\s\S]*?)<\/template>/gi;
    bodyContent = bodyContent.replace(templateRegex, (full, inner) => inner);

    const scriptRegex = /<script(?:[^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        const scriptContent = match[1].trim();
        if (scriptContent && !scriptContent.startsWith('<!--')) {
            allScripts += `\n<script>${scriptContent}</script>\n`;
        }
    }

    bodyContent = bodyContent.replace(/<script(?:[^>]*)>[\s\S]*?<\/script>/gi, '');

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>${css}</style>
</head>
<body>
${bodyContent}
${allScripts}
</body>
</html>`;
}

function renderCard(state) {
    const frame = $('#card-frame');
    if (!frame) return;

    const html = state.isShowingFront ? state.frontHTML : state.backHTML;
    frame.srcdoc = html;
}

function updateProgress(state, skipHighlight = false) {
    const current = state.currentIndex + 1;
    const total = state.records.length;
    $('#progress-text').textContent = `${current} / ${total}`;

    $('#prevBtn').disabled = state.currentIndex === 0;
    $('#nextBtn').disabled = state.currentIndex === total - 1;
    
    // 自动高亮当前卡片对应的章节
    if (!skipHighlight) {
        highlightCurrentChapter(state);
    }
}

function highlightCurrentChapter(state) {
    if (!state.directory) return;
    const node = findNodeByIndex(state.directory, state.currentIndex);
    if (!node) return;
    state.currentPath = node.path;
    expandToPath(state.directory, node.path);
    renderDirectory(state);
}

function initStudyHandlers(state) {
    const frame = $('#card-frame');
    const toggleBtn = $('#toggleBtn');
    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');

    toggleBtn.addEventListener('click', () => {
        state.isShowingFront = !state.isShowingFront;
        renderCard(state);
    });

    prevBtn.addEventListener('click', () => {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            state.isShowingFront = true;
            saveProgress(state);
            buildCardHTML(state);
            renderCard(state);
            updateProgress(state);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (state.currentIndex < state.records.length - 1) {
            state.currentIndex++;
            state.isShowingFront = true;
            saveProgress(state);
            buildCardHTML(state);
            renderCard(state);
            updateProgress(state);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            state.isShowingFront = !state.isShowingFront;
            renderCard(state);
        } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
            prevBtn.click();
        } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
            nextBtn.click();
        }
    });
}

function saveProgress(state) {
    state.progress.lastIndex = state.currentIndex;
    state.progress.lastChapter = state.currentPath || '';
    storage.saveDeckProgress(state.deckName, state.progress);
}

function showComplete(state) {
    const app = $('#app');

    app.innerHTML = `
        <div class="page">
            <header class="header">
                <div class="header-inner">
                    <div class="header-left">
                        <a href="/" class="back-btn">
                            ${ICONS.back}
                            <span>返回</span>
                        </a>
                    </div>
                    <h1 class="header-title">${state.deckName}</h1>
                    <div class="header-right"></div>
                </div>
            </header>

            <div class="container">
                <div class="complete-page">
                    <div class="complete-icon">
                        ${ICONS.check}
                    </div>
                    <h2 class="complete-title">暂无卡片</h2>
                    <p class="complete-subtitle">这个牌组还没有任何卡片</p>

                    <div class="complete-actions">
                        <a href="/" class="btn btn-secondary">
                            返回首页
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function setPageMeta(title, desc) {
    const base = 'kikkua · ';
    document.title = base + title;
    const setMeta = (prop, name, val) => {
        let el = document.querySelector(`meta[${prop}="${name}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute(prop, name); document.head.appendChild(el); }
        el.setAttribute('content', val);
    };
    if (desc) {
        setMeta('name', 'description', desc);
        setMeta('property', 'og:description', desc);
        setMeta('name', 'twitter:description', desc);
    }
    setMeta('property', 'og:title', document.title);
    setMeta('name', 'twitter:title', document.title);
    setMeta('property', 'og:url', location.href);
}

// Inject JSON-LD structured data once on startup
(function injectLd() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'kikkua',
        url: 'https://kikkua26.github.io/',
        description: '基于间隔重复的在线卡片学习工具',
        inLanguage: 'zh-CN',
        potentialAction: {
            '@type': 'SearchAction',
            target: 'https://kikkua26.github.io/decks?tag={search_term_string}',
            'query-input': 'required name=search_term_string'
        }
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
})();

/* ── History API routing ── */

function navigate(url) {
    history.pushState(null, '', url);
    handleRoute();
}

document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.host !== location.host) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href === '//' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    e.preventDefault();
    navigate(href);
});

async function handleRoute() {
    let path = location.pathname;
    if (path.startsWith('/')) path = path.slice(1);

    // Parse query params
    const qIdx = path.indexOf('?');
    let query = '';
    if (qIdx >= 0) {
        query = path.slice(qIdx + 1);
        path = path.slice(0, qIdx);
    }
    // Remove trailing slash
    if (path.endsWith('/')) path = path.slice(0, -1);

    if (!path) {
        setPageMeta('知识卡片', '基于间隔重复的在线卡片学习工具，支持自定义牌组与 Anki 模板。');
        renderHome();
    } else if (path === 'decks') {
        const tag = query.startsWith('tag=') ? decodeURIComponent(query.slice(4)) : '';
        setPageMeta('牌组列表', '浏览所有可用的学习牌组，按标签筛选。');
        await renderDeckList(tag);
    } else if (path.startsWith('deck/')) {
        const name = decodeURIComponent(path.slice(5));
        setPageMeta(name, '');
        await renderDeckDetail(name);
    } else if (path.startsWith('study/')) {
        const name = decodeURIComponent(path.slice(6));
        setPageMeta(name + ' · 学习', '');
        renderStudy(name);
    } else {
        navigate('/');
    }
}

window.addEventListener('popstate', handleRoute);
window.addEventListener('load', handleRoute);
