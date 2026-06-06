// kikkua · 页面编辑器 — 插件入口

import { registerPlugin, apiRequest, esc, b64decode, b64encode } from '../shared/sdk.js';

const $ = s => document.querySelector(s);

// State
let pages = [], pagesSha = '', currentPageIdx = -1;
const LS_KEY = 'kikkua_pages_draft';

function saveLocal() { localStorage.setItem(LS_KEY, JSON.stringify(pages)); }
function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function slugify(text) {
    return text.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w一-鿿-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'page';
}

function today() { return new Date().toISOString().slice(0, 10); }

function getGroups() {
    const groups = new Map();
    pages.forEach((p, i) => {
        const g = p.group || '未分组';
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(i);
    });
    // Sort within each group by order
    for (const [, indices] of groups) {
        indices.sort((a, b) => (pages[a].order || 0) - (pages[b].order || 0));
    }
    return groups;
}

function getGroupNames() {
    return [...new Set(pages.map(p => p.group || '未分组'))];
}

// ═══════════════════════════════════════
// Sync (for admin global sync)
// ═══════════════════════════════════════

async function syncToGitHub() {
    for (const p of pages) {
        if (p.file && p.content) {
            const readResp = await apiRequest('data/pages/' + p.file);
            const fileSha = readResp.ok ? readResp.data.sha : undefined;
            await apiRequest('data/pages/' + p.file, {
                method: 'PUT',
                body: { message: `Update ${p.file}`, content: b64encode(p.content), sha: fileSha },
            });
        }
    }
    const metaPages = pages.map(({ content, ...rest }) => rest);
    const jsonContent = b64encode(JSON.stringify({ pages: metaPages }, null, 2));
    const resp = await apiRequest('data/pages.json', {
        method: 'PUT',
        body: { message: 'Update pages', content: jsonContent, sha: pagesSha },
    });
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    pagesSha = resp.data.content.sha;
    localStorage.removeItem(LS_KEY);
}

window.__pluginSync = syncToGitHub;
window.__pluginHasDraft = () => !!localStorage.getItem(LS_KEY);
window.__pluginPullRemote = async () => {
    localStorage.removeItem(LS_KEY);
    await readPages();
    renderPageList();
};

// ═══════════════════════════════════════
// GitHub API
// ═══════════════════════════════════════

async function readPages() {
    const resp = await apiRequest('data/pages.json');
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    const data = resp.data;
    pagesSha = data.sha;
    pages = JSON.parse(b64decode(data.content)).pages || [];
    for (const p of pages) {
        if (p.file && !p.content) {
            try {
                const r = await apiRequest('data/pages/' + p.file);
                if (r.ok) p.content = b64decode(r.data.content);
            } catch {}
        }
    }
}

// ═══════════════════════════════════════
// UI Utilities
// ═══════════════════════════════════════

function toast(msg, type) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || '') + ' show';
    setTimeout(() => el.classList.remove('show'), 2500);
}

function confirmDialog(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal">
            <p>${esc(msg)}</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div>
        </div>`;
        overlay.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'ok') { overlay.remove(); resolve(true); }
            else if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(false); }
        });
        document.body.appendChild(overlay);
    });
}

function inputDialog(title, label, defaultVal) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal">
            <h3>${esc(title)}</h3>
            <div class="field"><label>${esc(label)}</label><input value="${esc(defaultVal || '')}"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div>
        </div>`;
        const input = overlay.querySelector('input');
        overlay.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'ok') { overlay.remove(); resolve(input.value.trim()); }
            else if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(null); }
        });
        document.body.appendChild(overlay);
        input.focus(); input.select();
    });
}

// ═══════════════════════════════════════
// Markdown Preview
// ═══════════════════════════════════════

function mdPreview(text) {
    if (!text) return '';
    const inline = (s) => s
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;">')
        .replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);">$1</a>')
        .replace(/(?<!["'>])(https?:\/\/[^\s<>"'，。；：、]+)/g, '<a href="$1" target="_blank" style="color:var(--accent);">$1</a>');
    return text.split(/\n{2,}/).map(b => {
        b = b.trim();
        if (!b) return '';
        if (/^#{1,3}\s/.test(b)) {
            const lv = b.match(/^#{1,3}/)[0].length;
            return `<h${lv} style="color:var(--text);margin:16px 0 8px;font-size:${[0,24,20,17][lv]}px;font-weight:600;">${inline(b.slice(lv+1))}</h${lv}>`;
        }
        if (/^[-*]{3,}\s*$/.test(b)) return '<hr style="border:none;height:1px;background:var(--border);margin:20px 0;">';
        if (/^> /.test(b)) return `<blockquote style="border-left:3px solid var(--accent);padding:8px 16px;margin:12px 0;background:var(--accent-bg);border-radius:0 6px 6px 0;">${inline(b.slice(2))}</blockquote>`;
        if (/^[-*]\s/.test(b)) return '<ul style="padding-left:20px;">' + b.split(/\n(?=[-*]\s)/).map(i => `<li style="margin-bottom:4px;">${inline(i.slice(2))}</li>`).join('') + '</ul>';
        if (/^\d+\.\s/.test(b)) return '<ol style="padding-left:20px;">' + b.split(/\n(?=\d+\.\s)/).map(i => `<li style="margin-bottom:4px;">${inline(i.replace(/^\d+\.\s/, ''))}</li>`).join('') + '</ol>';
        return `<p style="margin-bottom:10px;">${inline(b.replace(/\n/g, '<br>'))}</p>`;
    }).join('');
}

function showPreview(text) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '3000';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    const html = mdPreview(text);
    overlay.innerHTML = `<div class="modal" style="max-width:720px;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-weight:600;">预览</span>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
        </div>
        <div style="font-size:15px;line-height:1.85;color:var(--text);">${html}</div>
    </div>`;
    document.body.appendChild(overlay);
}

// ═══════════════════════════════════════
// Rendering — Page List (grouped)
// ═══════════════════════════════════════

function renderPageList() {
    const el = $('#pageListPanel');
    if (!el) return;
    if (!pages.length) { el.innerHTML = '<div class="edit-panel empty"><span>暂无页面</span></div>'; return; }

    const groups = getGroups();
    let html = '';
    for (const [groupName, indices] of groups) {
        html += `<div class="page-group">
            <div class="page-group-title" data-toggle-group="${esc(groupName)}">
                <span class="group-chevron">▼</span> ${esc(groupName)}
                <span class="group-count">${indices.length}</span>
            </div>
            <div class="page-group-items">`;
        for (const idx of indices) {
            const p = pages[idx];
            html += `<div class="list-item${idx === currentPageIdx ? ' active' : ''}" data-page-idx="${idx}">
                <div class="item-main">
                    <span class="item-icon">${esc(p.icon || '📄')}</span>
                    <span class="item-title">${esc(p.title)}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" data-move-up="${idx}" title="上移">↑</button>
                    <button class="btn-icon" data-move-down="${idx}" title="下移">↓</button>
                </div>
            </div>`;
        }
        html += `</div></div>`;
    }
    el.innerHTML = html;
}

// ═══════════════════════════════════════
// Rendering — Page Editor Form
// ═══════════════════════════════════════

function selectPage(i) {
    currentPageIdx = i;
    renderPageList();
    if (window.innerWidth <= 767) {
        $('#pageListView')?.classList.remove('mob-show');
        $('#pageDetailView')?.classList.add('mob-show');
    }
    const p = pages[i];
    const panel = $('#pageEditPanel');
    if (!panel) return;

    // Build group dropdown
    const allGroups = getGroupNames();
    const groupOpts = allGroups.map(g =>
        `<option value="${esc(g)}"${g === (p.group || '未分组') ? ' selected' : ''}>${esc(g)}</option>`
    ).join('') + '<option value="__new__">+ 新建分组</option>';

    panel.className = 'edit-panel';
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:16px;font-weight:600;">${esc(p.title)}</h3>
            <span class="page-date-badge">更新于 ${esc(p.updatedAt || '—')}</span>
        </div>

        <div class="field"><label>标题</label>
            <input value="${esc(p.title)}" data-page-field="title" placeholder="页面标题">
        </div>

        <div class="field"><label>页面 ID</label>
            <div class="id-display">
                <code class="id-value">${esc(p.id)}</code>
                <button class="btn btn-secondary btn-xs" data-action="edit-id">✏️</button>
            </div>
            <input type="hidden" value="${esc(p.id)}" data-page-field="id" id="pageIdInput">
        </div>

        <div class="field-row">
            <div class="field"><label>分组</label>
                <select data-page-field="group">${groupOpts}</select>
            </div>
            <div class="field"><label>图标</label>
                <input value="${esc(p.icon || '')}" data-page-field="icon" placeholder="📖" style="width:60px;">
            </div>
        </div>

        <div class="field"><label>标签（逗号分隔）</label>
            <input value="${esc((p.tags || []).join(', '))}" data-page-field="tags" placeholder="教程, 工具">
        </div>

        <div class="field"><label>内容 (Markdown)</label>
            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <button class="btn btn-secondary btn-xs" data-action="import-md">📥 导入 .md</button>
                <button class="btn btn-secondary btn-xs" data-action="preview-md">👁 预览</button>
            </div>
            <textarea rows="14" id="pageContentInput" data-page-field="content">${esc(p.content || '')}</textarea>
        </div>

        <div class="edit-actions">
            <button class="btn btn-primary btn-sm" data-action="save-page">💾 保存</button>
            <button class="btn btn-danger btn-sm" data-action="del-page">删除</button>
        </div>
    `;

    // Bind field inputs
    panel.querySelectorAll('[data-page-field]').forEach(el => {
        const field = el.dataset.pageField;
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => {
            if (field === 'tags') {
                pages[i].tags = el.value.split(',').map(s => s.trim()).filter(Boolean);
            } else if (field === 'group') {
                if (el.value === '__new__') {
                    const name = prompt('新分组名称：');
                    if (name) {
                        pages[i].group = name;
                        selectPage(i); // re-render to update dropdown
                    } else {
                        el.value = pages[i].group || '未分组';
                    }
                    return;
                }
                pages[i].group = el.value;
            } else if (field === 'title') {
                pages[i].title = el.value;
                // Auto-update ID if it matches old slug
                const oldSlug = slugify(pages[i]._prevTitle || '');
                if (pages[i].id === oldSlug || !pages[i]._prevTitle) {
                    pages[i].id = slugify(el.value);
                    pages[i].file = pages[i].id + '.md';
                    const idDisplay = panel.querySelector('.id-value');
                    if (idDisplay) idDisplay.textContent = pages[i].id;
                }
                pages[i]._prevTitle = el.value;
                renderPageList();
            } else if (field === 'id') {
                pages[i].id = el.value;
                pages[i].file = el.value + '.md';
            } else {
                pages[i][field] = el.value;
            }
            // Auto-update date
            pages[i].updatedAt = today();
            const dateBadge = panel.querySelector('.page-date-badge');
            if (dateBadge) dateBadge.textContent = '更新于 ' + today();
            saveLocal();
        });
    });
}

// ═══════════════════════════════════════
// Actions
// ═══════════════════════════════════════

function savePage() { saveLocal(); toast('💾 已保存'); }

async function delPage() {
    if (currentPageIdx < 0) return;
    const ok = await confirmDialog(`确认删除"${pages[currentPageIdx].title}"？`);
    if (!ok) return;
    pages.splice(currentPageIdx, 1);
    currentPageIdx = -1;
    saveLocal();
    toast('已删除');
    renderPageList();
    const panel = $('#pageEditPanel');
    if (panel) { panel.className = 'edit-panel empty'; panel.innerHTML = '<span>选择一个页面开始编辑</span>'; }
}

async function addPage() {
    const title = await inputDialog('新建页面', '页面标题', '');
    if (!title) return;
    const id = slugify(title);
    if (pages.find(p => p.id === id)) { toast('页面 ID "' + id + '" 已存在', 'error'); return; }
    const maxOrder = pages.reduce((max, p) => Math.max(max, p.order || 0), 0);
    pages.push({
        id, title, group: '', icon: '📄', order: maxOrder + 1,
        tags: [], file: id + '.md',
        content: '## ' + title + '\n\n在这里输入内容…',
        updatedAt: today()
    });
    saveLocal();
    renderPageList();
    selectPage(pages.length - 1);
    toast('已添加');
}

function movePage(idx, dir) {
    // Get pages in the same group, sorted by order
    const group = pages[idx].group || '未分组';
    const sameGroup = pages
        .map((p, i) => ({ ...p, _i: i }))
        .filter(p => (p.group || '未分组') === group)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const pos = sameGroup.findIndex(p => p._i === idx);
    const newPos = pos + dir;
    if (newPos < 0 || newPos >= sameGroup.length) return;

    // Swap order values
    const a = sameGroup[pos];
    const b = sameGroup[newPos];
    const tmpOrder = pages[a._i].order || 0;
    pages[a._i].order = pages[b._i].order || 0;
    pages[b._i].order = tmpOrder;
    pages[a._i].updatedAt = today();
    pages[b._i].updatedAt = today();

    saveLocal();
    renderPageList();
}

function showPageList() {
    if (window.innerWidth <= 767) {
        $('#pageListView')?.classList.add('mob-show');
        $('#pageDetailView')?.classList.remove('mob-show');
    }
    renderPageList();
    currentPageIdx = -1;
    const panel = $('#pageEditPanel');
    if (panel) { panel.className = 'edit-panel empty'; panel.innerHTML = '<span>选择一个页面开始编辑</span>'; }
}

function importMd() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.html';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        let content = await file.text();
        content = content.replace(/!\[([^\]]*)\]\(\.\/?(images|img|assets|media)\/([^)]+)\)/g, '![$1](/data/media/$3)');
        const ta = $('#pageContentInput');
        if (ta) { ta.value = content; pages[currentPageIdx].content = content; }
        pages[currentPageIdx].updatedAt = today();
        saveLocal();
        toast(`已导入: ${file.name}`);
    };
    input.click();
}

function previewMd() {
    const ta = $('#pageContentInput');
    if (!ta) return;
    showPreview(ta.value || '');
}

// ═══════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════

function setupEvents() {
    document.addEventListener('click', e => {
        // Page list item click
        const item = e.target.closest('[data-page-idx]');
        if (item && !e.target.closest('.item-actions')) {
            selectPage(parseInt(item.dataset.pageIdx));
            return;
        }

        // Group toggle
        const groupTitle = e.target.closest('[data-toggle-group]');
        if (groupTitle) {
            const items = groupTitle.nextElementSibling;
            const chevron = groupTitle.querySelector('.group-chevron');
            if (items) {
                items.classList.toggle('collapsed');
                if (chevron) chevron.textContent = items.classList.contains('collapsed') ? '▶' : '▼';
            }
            return;
        }

        // Move up/down
        const moveUp = e.target.closest('[data-move-up]');
        if (moveUp) { movePage(parseInt(moveUp.dataset.moveUp), -1); return; }
        const moveDown = e.target.closest('[data-move-down]');
        if (moveDown) { movePage(parseInt(moveDown.dataset.moveDown), 1); return; }

        // Actions
        const action = e.target.closest('[data-action]');
        if (!action) return;
        const act = action.dataset.action;
        if (act === 'add-page') addPage();
        else if (act === 'save-page') savePage();
        else if (act === 'del-page') delPage();
        else if (act === 'import-md') importMd();
        else if (act === 'preview-md') previewMd();
        else if (act === 'show-page-list') showPageList();
        else if (act === 'edit-id') {
            const idInput = document.getElementById('pageIdInput');
            const idDisplay = action.closest('.id-display');
            if (idInput && idDisplay) {
                idInput.type = 'text';
                idDisplay.style.display = 'none';
                idInput.style.display = 'block';
                idInput.focus();
                idInput.addEventListener('blur', () => {
                    idInput.type = 'hidden';
                    idDisplay.style.display = '';
                    const val = idInput.value.trim();
                    if (val && currentPageIdx >= 0) {
                        pages[currentPageIdx].id = val;
                        pages[currentPageIdx].file = val + '.md';
                        idDisplay.querySelector('.id-value').textContent = val;
                        saveLocal();
                    }
                }, { once: true });
            }
        }
    });
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════

async function init() {
    registerPlugin({ id: 'page-editor', name: '页面编辑器', icon: '📄', desc: '管理文档页面', version: '2.0' });
    setupEvents();
    try {
        toast('加载中…');
        try { await readPages(); } catch {}
        const local = loadLocal();
        if (local) pages = local;
        // Track previous title for auto-ID
        pages.forEach(p => { p._prevTitle = p.title; });
        renderPageList();
        toast('加载完成');
    } catch (e) { toast('加载失败: ' + e.message, 'error'); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
