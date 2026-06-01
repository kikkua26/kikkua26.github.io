// kikkua · admin — 统一事件绑定

import { connect, disconnect } from './auth.js';
import { switchSection, openSidebar, closeSidebar } from './ui.js';
import { loadPlugin, sendToPlugin } from './plugin-host.js';

const $ = s => document.querySelector(s);

export function bindAllEvents() {
    // ── Auth ──
    $('#connectBtn').addEventListener('click', connect);
    $('#disconnectBtn').addEventListener('click', disconnect);
    $('#tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });

    // ── Sidebar ──
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#sidebarOverlay').addEventListener('click', closeSidebar);

    // ── Nav ──
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', () => switchSection(n.dataset.section));
    });

    // Register section loaders
    switchSection._handlers = {
        decks: () => { loadPlugin('deck-manager', '/tools/deck-manager/index.html', 'deckManagerPluginContainer'); },
        templates: () => { loadPlugin('template-editor', '/tools/template-editor/index.html', 'templateEditorPluginContainer'); },
        tags: () => { loadPlugin('tag-editor', '/tools/tag-editor/index.html', 'tagEditorPluginContainer'); },
        pages: () => { loadPlugin('page-editor', '/tools/page-editor/index.html', 'pageEditorPluginContainer'); },
        media: () => { loadPlugin('media-browser', '/tools/media-browser/index.html', 'mediaBrowserPluginContainer'); },
        cardmaker: () => { loadPlugin('card-maker', '/tools/card-maker/index.html', 'cardmakerPluginContainer'); },
    };

    // ── Event delegation for dynamic content ──
    document.addEventListener('click', e => {
        const target = e.target;

        // Actions
        const action = target.closest('[data-action]');
        if (action) {
            const act = action.dataset.action;
            if (act === 'cm-quick-paste') { sendToPlugin('card-maker', 'quick-paste', {}); }
            return;
        }

        // Dashboard actions
        if (target.closest('[data-dashboard-action]')) {
            const act = target.closest('[data-dashboard-action]').dataset.dashboardAction;
            switchSection(act);
            return;
        }
    });
}
