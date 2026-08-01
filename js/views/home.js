import { DATA_PATHS } from '../config.js';

const DECK_EMOJIS = ['📖', '📗', '📘', '📙', '📕'];

function getDeckEmoji(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    return DECK_EMOJIS[Math.abs(hash) % DECK_EMOJIS.length];
}

function getDeckTag(tags) {
    if (!tags || !tags.length) return '';
    const parts = tags[0].split('::');
    return parts[parts.length - 1];
}

function getShortSummary(deck) {
    if (deck.summary && deck.summary !== '测试') return deck.summary;
    if (deck.detail && deck.detail !== '测试') {
        const text = deck.detail.replace(/\*\*/g, '').replace(/`[^`]+`/g, '').replace(/\n/g, ' ').trim();
        return text.length > 60 ? text.slice(0, 60) + '…' : text;
    }
    return '';
}

// ── SVG Icons ──

const arrowRightSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

const bookSVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`;

const eyeSVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

const sparklesSVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>`;

// ── Render ──

export async function renderHome() {
    const app = document.getElementById('app');
    if (!app) return;

    // 先渲染静态结构
    app.innerHTML = `
    <div class="home-page">
        <!-- Hero -->
        <section class="home-hero">
            <div class="hero-content">
                <div class="home-logo">kikkua<span class="accent">.</span></div>
                <h1 class="home-title">精选知识卡片，高效备考利器</h1>
                <p class="home-subtitle">
                    <span>先预览后购买</span>
                    <span class="dot"></span>
                    <span>专业模板</span>
                    <span class="dot"></span>
                    <span>系统梳理</span>
                </p>
                <div class="home-cta-group">
                    <a href="/decks" class="home-cta" data-link>
                        浏览牌组 ${arrowRightSVG}
                    </a>
                    <a href="/about" class="home-cta-outline" data-link>
                        了解更多
                    </a>
                </div>
            </div>
        </section>

        <!-- Stats -->
        <section class="home-stats" id="home-stats">
            <div class="stat-item">
                <div class="stat-number" id="stat-decks">—</div>
                <div class="stat-label">精选牌组</div>
            </div>
            <div class="stat-item">
                <div class="stat-number" id="stat-cards">—</div>
                <div class="stat-label">知识卡片</div>
            </div>
            <div class="stat-item">
                <div class="stat-number" id="stat-templates">2</div>
                <div class="stat-label">专业模板</div>
            </div>
        </section>

        <!-- Deck Showcase -->
        <section class="home-section deck-showcase">
            <div class="section-header">
                <h2 class="section-title">精选牌组</h2>
                <p class="section-desc">严格依据考纲编排，覆盖中医考研核心知识点</p>
            </div>
            <div class="deck-grid" id="deck-grid">
                <!-- 动态填充 -->
            </div>
        </section>

        <!-- Features -->
        <section class="home-section features-section">
            <div class="section-header">
                <h2 class="section-title">为什么选择 kikkua</h2>
            </div>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">${bookSVG}</div>
                    <div>
                        <div class="feature-label">精选内容</div>
                        <div class="feature-desc">严格依据最新考纲编排，系统梳理核心考点，覆盖考试所需全部知识。</div>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">${eyeSVG}</div>
                    <div>
                        <div class="feature-label">先看后买</div>
                        <div class="feature-desc">每组牌提供约 15% 内容免费预览，实际体验模板和内容质量后，再决定购买。</div>
                    </div>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">${sparklesSVG}</div>
                    <div>
                        <div class="feature-label">专业模板</div>
                        <div class="feature-desc">kikkua Pro 模板排版精美、字段完整，带来沉浸式的学习与复习体验。</div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Quote -->
        <section class="home-quote">
            <blockquote>学习之要，在于重复。温故知新，积微成著。</blockquote>
        </section>

        <!-- Footer -->
        <footer class="home-footer">
            <a href="/about" data-link>关于 kikkua</a>
            <a href="/tools" data-link>学习工具</a>
            <a href="/hanzi" data-link>汉字练字</a>
            <a href="https://github.com/kikkua26/kikkua26.github.io" target="_blank" rel="noopener">GitHub</a>
        </footer>
    </div>`;

    // 加载牌组数据
    try {
        const resp = await fetch(DATA_PATHS.index + '?v=' + Date.now());
        if (!resp.ok) return;
        const decks = await resp.json();
        if (!decks || !decks.length) return;

        // If user navigated away while fetching, bail out
        if (location.pathname !== '/' && location.pathname !== '') return;

        // 更新统计数字
        const statDecks = document.getElementById('stat-decks');
        const statCards = document.getElementById('stat-cards');
        if (statDecks) statDecks.textContent = decks.length + '+';
        if (statCards) {
            const total = decks.reduce((sum, d) => sum + (d.totalCards || 0), 0);
            statCards.textContent = (total >= 1000 ? (total / 1000).toFixed(1).replace(/\.0$/, '') + 'k+' : total + '+');
        }

        // 渲染牌组卡片
        const grid = document.getElementById('deck-grid');
        if (grid) {
            grid.innerHTML = decks.map((deck, i) => {
                const emoji = getDeckEmoji(deck.name);
                const tag = getDeckTag(deck.tags);
                const summary = getShortSummary(deck);
                const delay = i * 0.08;
                return `
                <a href="/deck/${encodeURIComponent(deck.name)}" class="deck-card-home" data-link style="animation-delay: ${delay}s">
                    <div class="deck-card-head">
                        <div class="deck-card-emoji">${emoji}</div>
                        <div class="deck-card-info">
                            <div class="deck-card-name">${deck.name}</div>
                            <div class="deck-card-count">${deck.totalCards} 张卡片</div>
                        </div>
                    </div>
                    ${summary ? `<div class="deck-card-summary">${summary}</div>` : ''}
                    <div class="deck-card-footer">
                        ${tag ? `<span class="deck-card-tag">${tag}</span>` : '<span></span>'}
                        <span class="deck-card-link">查看详情 ${arrowRightSVG}</span>
                    </div>
                </a>`;
            }).join('');
        }
    } catch (e) {
        console.error('Failed to load deck data:', e);
    }
}
