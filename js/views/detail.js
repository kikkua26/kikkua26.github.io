import { $, esc } from '../utils.js';
import { ICONS } from '../icons.js';
import { dataLoader, preloadDeck } from '../data-loader.js';
import { mdToHtml } from '../md.js';
import { setPageMeta } from '../seo.js';
import { getDecks } from './decks.js';
import { navigate } from '../navigation.js';
import { UI, ROUTES } from '../config.js';

export async function renderDeckDetail(deckName) {
    const app = $('#app');
    const allDecks = getDecks();
    const decks = allDecks.length ? allDecks : await dataLoader.discoverDecks();
    const deck = decks.find(d => d.name === deckName);

    if (deck) {
        setPageMeta(deck.name, deck.detail ? deck.detail.replace(/[#*\n`\[\]]/g, '').slice(0, 150) : '');
    }

    if (!deck) {
        app.innerHTML = `<div class="page"><div class="container"><div class="empty-state"><h3 class="empty-title">${UI.detail.notFound}</h3><a href="/${ROUTES.decks}" class="btn btn-secondary mt-3">${UI.detail.backToList}</a></div></div></div>`;
        return;
    }

    const tags = deck.tags || [];

    app.innerHTML = `
        <div class="page detail-page">
            <div class="container">
                <header class="header" style="border:none;">
                    <div class="header-inner">
                        <div class="header-left">
                            <a href="/${ROUTES.decks}" class="back-btn" title="${UI.detail.back}">${ICONS.back}</a>
                            <h1 class="header-title" style="margin-left: 4px;">${deck.name}</h1>
                        </div>
                        <div class="header-right">
                            ${deck.purchaseUrl ? `<a href="${deck.purchaseUrl}" target="_blank" rel="noopener" class="header-purchase">${UI.detail.purchase}</a>` : ''}
                        </div>
                    </div>
                </header>
                <div class="detail-header">
                    <h2 class="detail-title">${deck.name}</h2>
                    <div class="detail-count">${deck.totalCards}${UI.detail.cardUnit}</div>
                    ${tags.length ? `<div class="detail-tags">${tags.map(t => `<span class="detail-tag">${t.replace(/::/g, ' › ')}</span>`).join('')}</div>` : ''}
                </div>
                ${deck.detail ? `<div class="detail-body">${mdToHtml(deck.detail)}</div>` : ''}
                <div class="detail-actions">
                    <button class="btn-primary" id="startStudyBtn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                        ${UI.detail.startStudy}
                    </button>
                    ${deck.purchaseUrl ? `
                    <div class="detail-sep">${UI.detail.or}</div>
                    <a href="${deck.purchaseUrl}" target="_blank" rel="noopener" class="purchase-link">${UI.detail.purchase}</a>` : ''}
                </div>
            </div>
        </div>
    `;

    // 进入详情页立即在后台预加载数据
    const preloadPromise = preloadDeck(deck.name, deck.template, deck.chapterField);

    const studyBtn = $('#startStudyBtn');
    studyBtn.addEventListener('click', async () => {
        studyBtn.disabled = true;
        studyBtn.innerHTML = `<span style="opacity:0.7;">⏳ 加载数据…</span>`;
        try {
            await preloadPromise;
            navigate(`/${ROUTES.study}${encodeURIComponent(deck.name)}`);
        } catch {
            studyBtn.disabled = false;
            studyBtn.innerHTML = `${UI.detail.startStudy}`;
        }
    });
}
