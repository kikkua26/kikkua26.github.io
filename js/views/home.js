import { $ } from '../utils.js';
import { navigate } from '../navigation.js';
import { SITE, UI } from '../config.js';

const FEATURE_ICONS = {
    book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
};

export function renderHome() {
    const app = $('#app');
    app.innerHTML = `
        <div class="page home-page">
            <header class="header" style="border:none;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;position:relative;">
                <div class="header-inner">
                    <div class="header-left">
                        <span class="header-brand">${SITE.brand}<span class="accent">·</span></span>
                    </div>
                    <h1 class="header-title"></h1>
                    <div class="header-right">
                        <a href="/about" class="header-about-link">关于</a>
                    </div>
                </div>
            </header>
            <div class="home-hero">
                <div class="home-logo">${SITE.brand}<span class="accent">·</span></div>
                <div class="home-tagline">${SITE.tagline}</div>

                <p class="home-desc">${SITE.description}</p>

                <div class="home-features">
                    ${UI.home.features.map(f => `
                    <div class="home-feature">
                        <div class="feature-icon">${FEATURE_ICONS[f.icon]}</div>
                        <div class="feature-text">
                            <span class="feature-label">${f.label}</span>
                            <span class="feature-desc">${f.desc}</span>
                        </div>
                    </div>`).join('')}
                </div>

                <a href="/decks" class="home-cta">
                    ${UI.home.cta}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
            </div>

            <footer class="footer">
                <p class="footer-quote">${SITE.footerQuote}</p>
            </footer>
        </div>
    `;

    app.querySelector('.home-cta').addEventListener('click', e => {
        e.preventDefault();
        navigate('/decks');
    });
}
