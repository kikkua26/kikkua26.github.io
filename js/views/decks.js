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
                    <div class="header-inner" style="justify-content: flex-start;">
                        <a href="/" class="back-btn" title="${SITE.brand}">${ICONS.back}</a>
                        <h1 class="header-title" style="margin-left: 4px;">${UI.decks.title}</h1>
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
                            return `<span class="deck-tag">${label}</span>`;
                        }).join('');
                        return `
                        <div class="deck-card" data-deck="${deck.name}">
                            <div class="deck-card-inner">
                                <div class="deck-icon">📜</div>
                                <div class="deck-card-content">
                                    <h3 class="deck-title">${deck.name}</h3>
                                    <div class="deck-meta">
                                        <span class="deck-badge">${deck.totalCards}${UI.decks.cardUnit}</span>
                                        <span class="deck-meta-item">${ICONS.calendar} ${lastStudyText}</span>
                                    </div>
                                    ${tagsHtml ? `<div class="deck-tags">${tagsHtml}</div>` : ''}
                                    <div class="deck-actions">
                                        <a href="/${ROUTES.deckDetail}${encodeURIComponent(deck.name)}" class="deck-btn deck-btn-secondary">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                            ${UI.decks.preview}
                                        </a>
                                        ${deck.purchaseUrl ? `<a href="${deck.purchaseUrl}" target="_blank" rel="noopener" class="deck-btn deck-btn-primary">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                                            ${UI.decks.purchase}
                                        </a>` : ''}
                                    </div>
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
