import { $, esc } from '../utils.js';
import { ICONS } from '../storage.js';
import { dataLoader } from '../data-loader.js';
import { mdToHtml } from '../md.js';
import { setPageMeta } from '../seo.js';
import { getDecks } from './decks.js';

export async function renderDeckDetail(deckName) {
    const app = $('#app');
    const allDecks = getDecks();
    const decks = allDecks.length ? allDecks : await dataLoader.discoverDecks();
    const deck = decks.find(d => d.name === deckName);

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
                        <a href="/decks" class="back-btn" title="返回">${ICONS.back}</a>
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
