import { $, $$, esc, formatTimeAgo } from '../utils.js';
import { ICONS } from '../storage.js';
import { dataLoader } from '../data-loader.js';
import { setPageMeta } from '../seo.js';
import { navigate } from '../navigation.js';

let _gDecks = [];

export function getDecks() { return _gDecks; }

function getRootAndLeaf(tagPath) {
    const parts = tagPath.split('::');
    return { root: parts[0], label: parts[parts.length - 1], depth: parts.length };
}

function buildSiblingTags(decks, filterPath) {
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

export async function renderDeckList(filterPath) {
    const app = $('#app');
    const decks = _gDecks.length ? _gDecks : await dataLoader.discoverDecks();
    _gDecks = decks;
    filterPath = filterPath || '';

    const filtered = decks.filter(d => tagMatch(d.tags, filterPath));
    const rootTags = buildSiblingTags(decks, '');
    const childTags = buildSiblingTags(decks, filterPath);

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
                                <span class="deck-meta-item">${ICONS.calendar} ${lastStudyText}</span>
                            </div>
                            ${tagsHtml ? `<div class="deck-tags">${tagsHtml}</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    $$('.tag-pill').forEach(p => {
        p.addEventListener('click', () => {
            const path = p.dataset.path;
            navigate(path ? `/decks?tag=${encodeURIComponent(path)}` : '/decks');
        });
    });
    $$('.tag-crumb:not(.current)').forEach(c => {
        c.addEventListener('click', () => {
            const path = c.dataset.path;
            navigate(path ? `/decks?tag=${encodeURIComponent(path)}` : '/decks');
        });
    });
    $$('.deck-card[data-deck]').forEach(card => {
        card.addEventListener('click', () => {
            navigate(`/deck/${encodeURIComponent(card.dataset.deck)}`);
        });
    });

    setPageMeta('牌组列表', '浏览所有可用的学习牌组，按标签筛选。');
}
