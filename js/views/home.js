import { $ } from '../utils.js';
import { navigate } from '../navigation.js';

export function renderHome() {
    const app = $('#app');
    app.innerHTML = `
        <div class="page home-page">
            <div class="home-hero">
                <div class="home-logo">kikkua<span class="accent">·</span></div>
                <div class="home-tagline">精选牌组 · 预览选购</div>

                <p class="home-desc">
                    专业编者的 Anki 牌组集散地。每副牌组均可预览部分卡片内容，了解模板样式与知识编排，确认适合自己后再购买完整版本。
                </p>

                <div class="home-features">
                    <div class="home-feature">
                        <div class="feature-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                        </div>
                        <div class="feature-text">
                            <span class="feature-label">精选内容</span>
                            <span class="feature-desc">专业编者梳理的知识体系，直击考点</span>
                        </div>
                    </div>
                    <div class="home-feature">
                        <div class="feature-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                        </div>
                        <div class="feature-text">
                            <span class="feature-label">先看后买</span>
                            <span class="feature-desc">每副牌组提供约 15% 的卡片免费预览</span>
                        </div>
                    </div>
                    <div class="home-feature">
                        <div class="feature-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        </div>
                        <div class="feature-text">
                            <span class="feature-label">专业模板</span>
                            <span class="feature-desc">精心设计的 Anki 模板，兼具美感与效率</span>
                        </div>
                    </div>
                </div>

                <a href="/decks" class="home-cta">
                    浏览牌组
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
            </div>

            <footer class="footer">
                <p class="footer-quote">学习之要，在于重复。温故知新，积微成著。</p>
            </footer>
        </div>
    `;

    app.querySelector('.home-cta').addEventListener('click', e => {
        e.preventDefault();
        navigate('/decks');
    });
}
