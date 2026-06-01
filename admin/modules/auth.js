// kikkua · admin — 认证（connect, disconnect, token 管理）

import { gh, setToken, getToken } from './api.js';
import { setStatus, toast } from './ui.js';

const $ = s => document.querySelector(s);

// Loading steps tracking
const steps = { decks: false, templates: false, tags: false, pages: false, media: false, dashboard: false };

function updateStep(step, done) {
    steps[step] = done;
    const el = $(`#step${step.charAt(0).toUpperCase() + step.slice(1)}`);
    if (el) {
        el.textContent = done ? '✅ ' + el.textContent.slice(2) : el.textContent;
        if (done) el.classList.add('done');
    }
    // Update progress bar
    const total = Object.keys(steps).length;
    const completed = Object.values(steps).filter(Boolean).length;
    const progress = $('#loadingProgress');
    if (progress) progress.style.width = (completed / total * 100) + '%';
    const text = $('#loadingText');
    if (text) text.textContent = `加载中… (${completed}/${total})`;
    return completed === total;
}

export async function connect() {
    const token = $('#connectTokenInput')?.value?.trim();
    if (!token) {
        const status = $('#connectStatus');
        if (status) { status.textContent = '⚠️ 请输入 Token'; status.className = 'connect-status error'; }
        return;
    }

    setToken(token);
    sessionStorage.setItem('admin_token', token);

    const status = $('#connectStatus');
    const submitBtn = $('#connectSubmitBtn');
    const loading = $('#connectLoading');

    if (status) { status.textContent = '⏳ 验证中…'; status.className = 'connect-status'; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '连接中…'; }

    try {
        const user = await gh('/user');
        if (status) { status.textContent = `✅ ${user.login}，加载数据中…`; status.className = 'connect-status success'; }

        // Show loading progress
        if (loading) loading.classList.remove('hidden');

        // Load data and pre-load all plugins
        const { loadDecks } = await import('./decks.js');
        await loadDecks();
        updateStep('decks', true);
        await new Promise(r => setTimeout(r, 150));

        // Pre-load templates plugin
        const { loadPlugin } = await import('./plugin-host.js');
        loadPlugin('template-editor', '/tools/template-editor/index.html?v=3', 'templateEditorPluginContainer');
        updateStep('templates', true);
        await new Promise(r => setTimeout(r, 150));

        // Pre-load tags plugin
        loadPlugin('tag-editor', '/tools/tag-editor/index.html?v=3', 'tagEditorPluginContainer');
        updateStep('tags', true);
        await new Promise(r => setTimeout(r, 150));

        // Pre-load pages plugin
        loadPlugin('page-editor', '/tools/page-editor/index.html?v=3', 'pageEditorPluginContainer');
        updateStep('pages', true);
        await new Promise(r => setTimeout(r, 150));

        // Pre-load media plugin
        loadPlugin('media-browser', '/tools/media-browser/index.html?v=3', 'mediaBrowserPluginContainer');
        updateStep('media', true);
        await new Promise(r => setTimeout(r, 150));

        // Update dashboard
        const { updateDashboard } = await import('./dashboard.js');
        await updateDashboard();
        updateStep('dashboard', true);

        // All done - hide modal and show main content
        await new Promise(r => setTimeout(r, 500));

        const overlay = $('#connectOverlay');
        const main = $('#mainContent');
        if (overlay) overlay.classList.add('hidden');
        if (main) main.classList.remove('hidden');

        // Update sidebar status
        const statusBadge = $('#statusBadge');
        if (statusBadge) statusBadge.textContent = `✅ ${user.login}`;

        const footerStats = $('#footerStats');
        if (footerStats) footerStats.textContent = `📋 加载完成`;

    } catch (e) {
        const msg = e.name === 'AbortError' ? '连接超时' : e.message;
        if (status) { status.textContent = '❌ ' + msg; status.className = 'connect-status error'; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '重试'; }
        if (loading) loading.classList.add('hidden');
    }
}

export function disconnect() {
    sessionStorage.removeItem('admin_token');
    setToken('');

    // Show connection modal again
    const overlay = $('#connectOverlay');
    const main = $('#mainContent');
    if (overlay) overlay.classList.remove('hidden');
    if (main) main.classList.add('hidden');

    // Reset form
    const input = $('#connectTokenInput');
    const submitBtn = $('#connectSubmitBtn');
    const status = $('#connectStatus');
    const loading = $('#connectLoading');

    if (input) input.value = '';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '连接'; }
    if (status) { status.textContent = '请输入 Token 连接'; status.className = 'connect-status'; }
    if (loading) loading.classList.add('hidden');

    // Reset steps
    Object.keys(steps).forEach(k => steps[k] = false);
    ['decks', 'templates', 'tags', 'pages', 'media', 'dashboard'].forEach(k => {
        const el = $(`#step${k.charAt(0).toUpperCase() + k.slice(1)}`);
        if (el) { el.textContent = '⏳ ' + k; el.classList.remove('done'); }
    });
    const progress = $('#loadingProgress');
    if (progress) progress.style.width = '0%';
}

export function autoConnect() {
    const saved = sessionStorage.getItem('admin_token');
    if (saved) {
        const input = $('#connectTokenInput');
        if (input) input.value = saved;
        connect();
    }
}
