import { $, esc } from '../utils.js';
import { ICONS } from '../storage.js';
import { mdToHtml } from '../md.js';
import { setPageMeta } from '../seo.js';
import { navigate } from '../navigation.js';
import { UI, SITE, DATA_PATHS, ROUTES } from '../config.js';

let observer = null;

export async function renderAbout() {
    const app = $('#app');
    const params = new URLSearchParams(location.search);
    const pageId = params.get('id') || 'about';

    app.innerHTML = `
        <div class="page docs-page">
            <header class="header" style="border:none;">
                <div class="header-inner">
                    <div class="header-left">
                        <a href="/" class="back-btn" title="${UI.about.back}">${ICONS.back}</a>
                        <h1 class="header-title" style="margin-left:4px;">${UI.about.title}</h1>
                    </div>
                    <div class="header-right">
                        <button class="docs-menu-btn" id="docsMenuBtn" aria-label="目录">☰</button>
                    </div>
                </div>
            </header>
            <div class="docs-layout">
                <aside class="docs-sidebar-left" id="docsSidebarLeft">
                    <div class="docs-sidebar-loading">${UI.about.loading}</div>
                </aside>
                <main class="docs-main">
                    <div class="docs-content-loading">${UI.about.loading}</div>
                </main>
                <aside class="docs-sidebar-right" id="docsSidebarRight"></aside>
            </div>
        </div>`;

    setPageMeta(UI.about.title, '');

    // Fetch pages data
    let pagesData;
    try {
        const resp = await fetch(DATA_PATHS.pages + '?v=' + Date.now());
        if (!resp.ok) throw new Error('Not found');
        pagesData = await resp.json();
    } catch {
        renderFallback();
        return;
    }

    const pages = pagesData.pages || [];
    const page = pages.find(p => p.id === pageId);

    if (!page) {
        renderFallback();
        return;
    }

    renderFull(page, pages);

    const backBtn = app.querySelector('.back-btn');
    if (backBtn) backBtn.addEventListener('click', e => {
        e.preventDefault();
        navigate('/');
    });
}

function renderFallback() {
    const main = document.querySelector('.docs-main');
    const left = document.getElementById('docsSidebarLeft');
    const right = document.getElementById('docsSidebarRight');
    if (left) left.innerHTML = '<div style="padding:20px;color:var(--ink-muted);font-size:13px;">暂无页面</div>';
    if (right) right.innerHTML = '';
    if (!main) return;
    main.innerHTML = `
        <div class="empty-state" style="padding:60px 0;">
            <div class="empty-icon">📄</div>
            <h3 class="empty-title">${UI.about.notFound}</h3>
            <p class="empty-desc">关于页面内容尚未配置</p>
        </div>`;
}

function renderFull(page, pages) {
    const content = page.content || '';
    const html = mdToHtml(content);

    // Build grouped nav
    const groups = new Map();
    const sorted = [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
    sorted.forEach(p => {
        const g = p.group || '';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(p);
    });

    // Render left sidebar
    const leftEl = document.getElementById('docsSidebarLeft');
    if (leftEl) {
        leftEl.innerHTML = buildLeftNav(groups, page.id);
        leftEl.querySelectorAll('.doc-nav-item').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const href = item.getAttribute('href');
                if (href && href.startsWith('/about')) {
                    navigate(href);
                }
            });
        });
        // Group toggle
        leftEl.querySelectorAll('.doc-nav-group-title').forEach(title => {
            title.addEventListener('click', () => {
                const items = title.nextElementSibling;
                if (items) {
                    items.classList.toggle('collapsed');
                    title.classList.toggle('collapsed');
                }
            });
        });
    }

    // Render main content
    const main = document.querySelector('.docs-main');
    if (main) {
        const wordCount = (content || '').replace(/[#*`\[\]>\-\s]/g, '').length;
        const readMin = Math.max(1, Math.ceil(wordCount / 300));
        const tagStr = (page.tags || []).map(t => `<span class="docs-tag">${esc(t)}</span>`).join('');

        const pageIdx = sorted.findIndex(p => p.id === page.id);
        const prevPage = pageIdx > 0 ? sorted[pageIdx - 1] : null;
        const nextPage = pageIdx < sorted.length - 1 ? sorted[pageIdx + 1] : null;

        main.innerHTML = `
            <div class="docs-breadcrumb">
                <a href="/">${UI.about.breadcrumbHome}</a>
                <span class="docs-breadcrumb-sep">›</span>
                <span>${esc(page.title)}</span>
            </div>
            <div class="docs-meta">
                <span>${UI.about.updatedAt} ${esc(page.updatedAt || '')}</span>
                <span class="docs-meta-dot">·</span>
                <span>${readMin} ${UI.about.minuteRead}</span>
                ${tagStr ? `<span class="docs-meta-dot">·</span><span class="docs-meta-tags">${tagStr}</span>` : ''}
            </div>
            <h1 class="docs-title">${esc(page.title)}</h1>
            <div class="docs-body" id="docsBody">${html}</div>
            ${(prevPage || nextPage) ? `
            <nav class="docs-pager">
                ${prevPage ? `<a href="/about?id=${prevPage.id}" class="docs-pager-prev" data-page="${prevPage.id}"><span class="docs-pager-label">${UI.about.prevPage}</span><span class="docs-pager-title">${esc(prevPage.title)}</span></a>` : '<span></span>'}
                ${nextPage ? `<a href="/about?id=${nextPage.id}" class="docs-pager-next" data-page="${nextPage.id}"><span class="docs-pager-label">${UI.about.nextPage}</span><span class="docs-pager-title">${esc(nextPage.title)}</span></a>` : '<span></span>'}
            </nav>` : ''}
        `;

        // Wire pager links
        main.querySelectorAll('.docs-pager a').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                const pid = a.dataset.page;
                if (pid) navigate('/about?id=' + pid);
            });
        });
    }

    // Render right TOC
    renderTOC();

    // Scroll spy
    setupScrollSpy();

    // Mobile menu
    setupMobileMenu();
}

function buildLeftNav(groups, activeId) {
    let html = '<nav class="doc-nav">';
    groups.forEach((items, groupName) => {
        html += `<div class="doc-nav-group">`;
        if (groupName) {
            html += `<div class="doc-nav-group-title"><span class="doc-nav-group-icon">📁</span>${esc(groupName)}<svg class="doc-nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div>`;
        }
        html += `<div class="doc-nav-items">`;
        items.forEach(p => {
            const isActive = p.id === activeId;
            html += `<a href="/about?id=${p.id}" class="doc-nav-item${isActive ? ' active' : ''}" data-page="${p.id}"><span class="doc-nav-item-icon">${esc(p.icon || '📄')}</span>${esc(p.title)}</a>`;
        });
        html += `</div></div>`;
    });
    html += '</nav>';
    return html;
}

function renderTOC() {
    const tocEl = document.getElementById('docsSidebarRight');
    const bodyEl = document.getElementById('docsBody');
    if (!tocEl || !bodyEl) return;

    const headings = bodyEl.querySelectorAll('h1, h2, h3');
    if (headings.length < 2) {
        tocEl.innerHTML = '';
        return;
    }

    let tocHtml = `<div class="doc-toc"><div class="doc-toc-title">${UI.about.tocTitle}</div><ul class="doc-toc-list">`;
    headings.forEach((h, i) => {
        const id = 'h-' + i;
        h.id = id;
        const level = parseInt(h.tagName.charAt(1));
        const indent = level === 3 ? ' doc-toc-indent' : '';
        tocHtml += `<li class="doc-toc-item${indent}"><a href="#${id}" class="doc-toc-link">${esc(h.textContent)}</a></li>`;
    });
    tocHtml += '</ul></div>';
    tocEl.innerHTML = tocHtml;

    // TOC link click — smooth scroll
    tocEl.querySelectorAll('.doc-toc-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const target = document.getElementById(link.getAttribute('href').slice(1));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                target.style.scrollMarginTop = '72px';
            }
        });
    });
}

function setupScrollSpy() {
    if (observer) observer.disconnect();

    const headings = document.querySelectorAll('#docsBody h1, #docsBody h2, #docsBody h3');
    const links = document.querySelectorAll('.doc-toc-link');
    if (headings.length === 0 || links.length === 0) return;

    headings.forEach(h => { h.style.scrollMarginTop = '72px'; });

    observer = new IntersectionObserver(entries => {
        let activeId = null;
        entries.forEach(e => {
            if (e.isIntersecting) activeId = e.target.id;
        });
        if (activeId) {
            links.forEach(l => {
                l.classList.toggle('active', l.getAttribute('href') === '#' + activeId);
            });
        }
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    headings.forEach(h => observer.observe(h));
}

function setupMobileMenu() {
    const btn = document.getElementById('docsMenuBtn');
    const sidebar = document.getElementById('docsSidebarLeft');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar on clicking outside
    document.addEventListener('click', e => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            e.target !== btn &&
            !btn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}
