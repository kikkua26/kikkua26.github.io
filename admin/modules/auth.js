// kikkua · admin — 认证（connect, disconnect, token 管理）

import { gh, setToken, getToken } from './api.js';
import { setStatus, toast } from './ui.js';
import { loadDecks } from './decks.js';
import { loadTemplates } from './templates.js';
import { loadTags } from './tags.js';
import { loadPages } from './pages.js';

const $ = s => document.querySelector(s);

export async function connect() {
    const token = $('#tokenInput').value.trim();
    if (!token) { setStatus('⚠️ 请输入 Token', 'err'); return; }
    setToken(token);
    sessionStorage.setItem('admin_token', token);
    setStatus('⏳ 连接中…');
    try {
        const user = await gh('/user');
        await loadDecks();
        await loadTemplates();
        await loadTags();
        await loadPages();
        setStatus(`✅ ${user.login}`, 'ok');
        $('#connectBtn').textContent = '已连';
        $('#connectBtn').disabled = true;
        $('#disconnectBtn').style.display = 'inline-flex';
        $('#tokenInput').disabled = true;
        // Update dashboard (lazy import to avoid circular)
        const { updateDashboard } = await import('./dashboard.js');
        updateDashboard();
        const { decks } = await import('./decks.js');
        const { tplNames } = await import('./templates.js');
        $('#footerStats').textContent = `📋 ${decks.length} 牌组 · 🎨 ${tplNames.length} 模板`;
    } catch (e) {
        const msg = e.name === 'AbortError' ? '连接超时（已离线模式，可本地制卡）' : e.message;
        setStatus('⚠ ' + msg, 'err');
        $('#connectBtn').textContent = '重试';
    }
}

export function disconnect() {
    sessionStorage.removeItem('admin_token');
    setToken('');
    // Reset module state
    import('./decks.js').then(m => { m.decks.length = 0; m.dataSha = ''; m.currentDeckIdx = -1; m.csvMeta = {}; });
    import('./templates.js').then(m => { m.tplNames.length = 0; });
    $('#tokenInput').value = ''; $('#tokenInput').disabled = false;
    $('#connectBtn').textContent = '连接'; $('#connectBtn').disabled = false;
    $('#disconnectBtn').style.display = 'none';
    setStatus('⚪ 已断开');
    $('#footerStats').textContent = '';
    import('./dashboard.js').then(m => m.updateDashboard());
}

export function autoConnect() {
    const saved = sessionStorage.getItem('admin_token');
    if (saved) { $('#tokenInput').value = saved; connect(); }
}
