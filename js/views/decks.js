import { $, $$, esc, formatTimeAgo } from '../utils.js';
import { ICONS } from '../storage.js';
import { dataLoader } from '../data-loader.js';
import { setPageMeta } from '../seo.js';
import { navigate } from '../navigation.js';
import { UI, ROUTES, SITE } from '../config.js';

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
            const label = i === 0 ? UI.decks.allLabel : parts[i - 1];
            cum.push(`<span class="tag-crumb${prev === filterPath ? ' current' : ''}" data-path="${prev}">${label}</span>`);
        }
        crumbHtml = `<div class="tag-crumbs">${cum.join('<span class="tag-crumb-sep">›</span>')}</div>`;
    }

    const pills = filterPath
        ? childTags.map(t => ({ label: t, path: filterPath + '::' + t, active: false }))
        : [{ label: UI.decks.allLabel, path: '', active: true }, ...rootTags.map(t => ({ label: t, path: t, active: false }))];

    const pillsHtml = pills.map(p =>
        `<span class="tag-pill${p.active ? ' active' : ''}" data-path="${p.path}">${p.label}</span>`
    ).join('');

    app.innerHTML = `
        <div class="page" id="decks-page">
            <div class="container">
                <header class="header">
                    <div class="header-inner">
                        <div class="header-left">
                            <a href="/" class="back-btn" title="${SITE.brand}">${ICONS.back}</a>
                            <h1 class="header-title" style="margin-left: 4px;">${UI.decks.title}</h1>
                        </div>
                        <div></div>
                        <div class="header-right">
                            <a href="/pro" class="header-about-link" style="margin-right:4px;">Pro</a>
                            <a href="/about" class="header-about-link">关于</a>
                        </div>
                    </div>
                </header>
                <div class="tag-bar">
                    ${crumbHtml}
                    <div class="tag-pills-wrap">${pillsHtml}</div>
                    ${filtered.length > 0 ? `<div class="tag-result">${filtered.length}${UI.decks.deckUnit}</div>` : ''}
                </div>
                <div class="deck-grid" id="deck-list">
                    ${filtered.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">📚</div>
                        <h3 class="empty-title">${UI.decks.noResults}</h3>
                        <p class="empty-desc">${UI.decks.noResultsHint}</p>
                    </div>` :
                    filtered.map(deck => {
                        const lastStudyText = deck.lastStudy ? formatTimeAgo(deck.lastStudy) : UI.decks.notStudied;
                        const tagsHtml = (deck.tags || []).map(t => {
                            const { label } = getRootAndLeaf(t);
                            return `<span class="tag">${label}</span>`;
                        }).join('');
                        const themes = ['blue', 'purple', 'green', 'orange', 'pink'];
                        const theme = themes[deck.name.length % themes.length];
                        const deckIcons = ['📜', '🐍', '🎨', '📚', '📐'];
                        const icon = deckIcons[deck.name.length % deckIcons.length];
                        return `
                        <div class="deck-card theme-${theme}" data-deck="${deck.name}">
                            <div class="card-header">
                                <div class="card-icon">${icon}</div>
                                <div class="card-info">
                                    <h3 class="card-title">${deck.name}</h3>
                                    <span class="card-count">${deck.totalCards}${UI.decks.cardUnit}</span>
                                </div>
                            </div>
                            <div class="card-content">
                                <p class="card-summary">${deck.summary ? esc(deck.summary) : ''}</p>
                                <div class="card-tags">${tagsHtml}</div>
                            </div>
                            <div class="card-footer">
                                <span class="card-meta">${ICONS.calendar} ${lastStudyText}</span>
                                <div class="deck-actions">
                                    <a href="/${ROUTES.deckDetail}${encodeURIComponent(deck.name)}" class="preview-btn">${UI.decks.preview}</a>
                                    ${deck.purchaseUrl ? `<a href="${deck.purchaseUrl}" target="_blank" rel="noopener" class="deck-btn deck-btn-primary">${UI.decks.purchase}</a>` : ''}
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    $$('.tag-pill').forEach(p => {
        p.addEventListener('click', () => {
            const path = p.dataset.path;
            navigate(path ? `/${ROUTES.decks}?tag=${encodeURIComponent(path)}` : `/${ROUTES.decks}`);
        });
    });
    $$('.tag-crumb:not(.current)').forEach(c => {
        c.addEventListener('click', () => {
            const path = c.dataset.path;
            navigate(path ? `/${ROUTES.decks}?tag=${encodeURIComponent(path)}` : `/${ROUTES.decks}`);
        });
    });
    $$('.deck-card[data-deck]').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.deck-actions')) return;
            navigate(`/${ROUTES.deckDetail}${encodeURIComponent(card.dataset.deck)}`);
        });
    });

    setPageMeta(UI.decks.title, UI.decks.desc);
}
