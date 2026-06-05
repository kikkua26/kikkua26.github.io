// kikkua · admin — 统一事件绑定

import { switchSection, openSidebar, closeSidebar } from './ui.js';
import { loadPlugin, getLoadedPlugins } from './plugin-host.js';

const $ = s => document.querySelector(s);

// ═══════════════════════════════════════
// Global Sync
// ═══════════════════════════════════════

function getPluginIframes() {
    return document.querySelectorAll('iframe.plugin-frame');
}

function hasAnyDraft() {
    for (const iframe of getPluginIframes()) {
        try { if (iframe.contentWindow?.__pluginHasDraft?.()) return true; } catch {}
    }
    return false;
}

function updateGlobalSyncBadge() {
    const badge = $('#globalSyncBadge');
    if (!badge) return;
    if (hasAnyDraft()) {
        badge.textContent = '● 有未同步更改';
        badge.className = 'sync-status unsaved';
    } else {
        badge.textContent = '✓ 已同步';
        badge.className = 'sync-status synced';
    }
}

async function globalSync() {
    const btn = $('#globalSyncBtn');
    try {
        if (btn) { btn.textContent = '⏳ 同步中…'; btn.disabled = true; }
        const iframes = getPluginIframes();
        let synced = 0;
        for (const iframe of iframes) {
            try {
                const win = iframe.contentWindow;
                if (win?.__pluginHasDraft?.() && win?.__pluginSync) {
                    await win.__pluginSync();
                    synced++;
                }
            } catch (e) { console.warn('Plugin sync failed:', e); }
        }
        updateGlobalSyncBadge();
        alert(synced > 0 ? `✅ 已同步 ${synced} 个模块到 GitHub` : '没有需要同步的更改');
    } catch (e) { alert('❌ 同步失败: ' + e.message); }
    finally { if (btn) { btn.textContent = '🔄 同步到 GitHub'; btn.disabled = false; } }
}

async function globalPull() {
    const hasDraft = hasAnyDraft();
    if (hasDraft && !confirm('丢弃所有本地更改，从 GitHub 重新拉取？')) return;
    const iframes = getPluginIframes();
    for (const iframe of iframes) {
        try { await iframe.contentWindow?.__pluginPullRemote?.(); } catch {}
    }
    updateGlobalSyncBadge();
    alert('✅ 已从 GitHub 拉取最新数据');
}

// Periodic check for draft status
setInterval(updateGlobalSyncBadge, 3000);

// ═══════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════

export function bindAllEvents() {
    // ── Sidebar ──
    $('#menuBtn')?.addEventListener('click', openSidebar);
    $('#sidebarOverlay')?.addEventListener('click', closeSidebar);

    // ── Nav ──
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', () => switchSection(n.dataset.section));
    });

    // Register section loaders
    const TV = '?v=3';
    switchSection._handlers = {
        decks: () => { loadPlugin('deck-manager', '/tools/deck-manager/index.html' + TV, 'deckManagerPluginContainer'); },
        templates: () => { loadPlugin('template-editor', '/tools/template-editor/index.html' + TV, 'templateEditorPluginContainer'); },
        tags: () => { loadPlugin('tag-editor', '/tools/tag-editor/index.html' + TV, 'tagEditorPluginContainer'); },
        pages: () => { loadPlugin('page-editor', '/tools/page-editor/index.html' + TV, 'pageEditorPluginContainer'); },
        media: () => { loadPlugin('media-browser', '/tools/media-browser/index.html' + TV, 'mediaBrowserPluginContainer'); },
    };

    // ── Global sync ──
    $('#globalSyncBtn')?.addEventListener('click', globalSync);
    $('#globalPullBtn')?.addEventListener('click', globalPull);

    // ── Event delegation for dynamic content ──
    document.addEventListener('click', e => {
        const target = e.target;
        if (target.closest('[data-dashboard-action]')) {
            const act = target.closest('[data-dashboard-action]').dataset.dashboardAction;
            switchSection(act);
            return;
        }
    });
}
