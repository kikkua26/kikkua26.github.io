import { $ } from '../utils.js';

export function renderHome() {
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
