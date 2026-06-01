// kikkua · admin — 统一事件绑定

import { switchSection, openSidebar, closeSidebar } from './ui.js';
import { loadPlugin, sendToPlugin } from './plugin-host.js';

const $ = s => document.querySelector(s);

export function bindAllEvents() {
    // ── Sidebar ──
    $('#menuBtn')?.addEventListener('click', openSidebar);
    $('#sidebarOverlay')?.addEventListener('click', closeSidebar);

    // ── Nav ──
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', () => switchSection(n.dataset.section));
    });

    // Register section loaders
    const TV = '?v=3'; // cache buster for plugin iframes
    switchSection._handlers = {
        decks: () => { loadPlugin('deck-manager', '/tools/deck-manager/index.html' + TV, 'deckManagerPluginContainer'); },
        templates: () => { loadPlugin('template-editor', '/tools/template-editor/index.html' + TV, 'templateEditorPluginContainer'); },
        tags: () => { loadPlugin('tag-editor', '/tools/tag-editor/index.html' + TV, 'tagEditorPluginContainer'); },
        pages: () => { loadPlugin('page-editor', '/tools/page-editor/index.html' + TV, 'pageEditorPluginContainer'); },
        media: () => { loadPlugin('media-browser', '/tools/media-browser/index.html' + TV, 'mediaBrowserPluginContainer'); },
    };

    // ── Event delegation for dynamic content ──
    document.addEventListener('click', e => {
        const target = e.target;

        // Dashboard actions
        if (target.closest('[data-dashboard-action]')) {
            const act = target.closest('[data-dashboard-action]').dataset.dashboardAction;
            switchSection(act);
            return;
        }
    });
}
