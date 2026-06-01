// kikkua · 页面编辑器 — 插件入口

import { registerPlugin, apiRequest, esc } from '../shared/sdk.js';

const $ = s => document.querySelector(s);

// State
let pages = [], pagesSha = '', currentPageIdx = -1;

// ═══════════════════════════════════════
// GitHub API via parent proxy
// ═══════════════════════════════════════

async function readPages() {
    const resp = await apiRequest('data/pages.json');
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    const data = resp.data;
    // Decode base64 content
    const text = atob(data.content);
    pagesSha = data.sha;
    pages = JSON.parse(text).pages || [];
}

async function writePages() {
    const content = btoa(JSON.stringify({ pages }, null, 2));
    const resp = await apiRequest('data/pages.json', {
        method: 'PUT',
        body: { message: 'Update pages from admin', content, sha: pagesSha },
    });
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    pagesSha = resp.data.content.sha;
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
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);">$1</a>');
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
// Rendering
// ═══════════════════════════════════════

function renderPageList() {
    const el = $('#pageListPanel');
    if (!el) return;
    if (!pages.length) { el.innerHTML = '<div class="edit-panel empty"><span>暂无页面</span></div>'; return; }
    el.innerHTML = pages.map((p, i) => `
        <div class="list-item${i === currentPageIdx ? ' active' : ''}" data-page-idx="${i}">
            <div class="name">${esc(p.icon || '📄')} ${esc(p.title)}</div>
            <div class="meta"><span>${esc(p.group || '')}</span><span>ID: ${esc(p.id)}</span></div>
        </div>
    `).join('');
}

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
    panel.className = 'edit-panel';
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:16px;font-weight:600;">${esc(p.title)}</h3>
        </div>
        <div class="field-row">
            <div class="field"><label>页面 ID</label><input value="${esc(p.id)}" data-page-field="id" placeholder="about"></div>
            <div class="field"><label>标题</label><input value="${esc(p.title)}" data-page-field="title"></div>
        </div>
        <div class="field-row">
            <div class="field"><label>分组</label><input value="${esc(p.group || '')}" data-page-field="group" placeholder="入门指南"></div>
            <div class="field"><label>排序</label><input type="number" value="${p.order || 0}" data-page-field="order" style="width:80px;"></div>
        </div>
        <div class="field-row">
            <div class="field"><label>图标 (Emoji)</label><input value="${esc(p.icon || '')}" data-page-field="icon" placeholder="📖"></div>
            <div class="field"><label>标签 (逗号分隔)</label><input value="${esc((p.tags || []).join(', '))}" data-page-field="tags"></div>
        </div>
        <div class="field"><label>内容 (Markdown)</label>
            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <button class="btn btn-secondary btn-xs" data-action="import-md">📥 导入 .md</button>
                <button class="btn btn-secondary btn-xs" data-action="preview-md">👁 预览</button>
            </div>
            <textarea rows="12" id="pageContentInput" data-page-field="content">${esc(p.content || '')}</textarea>
        </div>
        <div class="field"><label>更新日期</label><input value="${esc(p.updatedAt || '')}" data-page-field="updatedAt" placeholder="2026-05-24"></div>
        <div class="edit-actions">
            <button class="btn btn-primary btn-sm" data-action="save-page">💾 保存</button>
            <button class="btn btn-danger btn-sm" data-action="del-page">删除</button>
        </div>
    `;

    // Bind field inputs
    panel.querySelectorAll('[data-page-field]').forEach(el => {
        const field = el.dataset.pageField;
        el.addEventListener('input', () => {
            if (field === 'tags') pages[i].tags = el.value.split(',').map(s => s.trim()).filter(Boolean);
            else if (field === 'order') pages[i].order = parseInt(el.value) || 0;
            else pages[i][field] = el.value;
            if (field === 'id' || field === 'title') renderPageList();
        });
    });
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

// ═══════════════════════════════════════
// Actions
// ═══════════════════════════════════════

async function savePage() {
    const btn = $('[data-action="save-page"]');
    try {
        if (btn) { btn.textContent = '⏳ 保存中…'; btn.disabled = true; }
        await writePages();
        toast('✅ 页面已保存到 GitHub');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
    finally { if (btn) { btn.textContent = '💾 保存'; btn.disabled = false; } }
}

async function delPage() {
    if (currentPageIdx < 0) return;
    const ok = await confirmDialog(`确认删除"${pages[currentPageIdx].title}"？`);
    if (!ok) return;
    pages.splice(currentPageIdx, 1);
    currentPageIdx = -1;
    try {
        await writePages();
        toast('已删除');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
    renderPageList();
    const panel = $('#pageEditPanel');
    if (panel) { panel.className = 'edit-panel empty'; panel.innerHTML = '<span>选择一个页面开始编辑</span>'; }
}

async function addPage() {
    const name = await inputDialog('新建页面', '页面 ID', 'about');
    if (!name) return;
    if (pages.find(p => p.id === name)) { toast('页面 ID 已存在', 'error'); return; }
    const today = new Date().toISOString().slice(0, 10);
    pages.push({ id: name, title: name, group: '', icon: '📄', order: pages.length + 1, tags: [], content: '## ' + name + '\n\n在这里输入内容…', updatedAt: today });
    renderPageList();
    selectPage(pages.length - 1);
    toast('已添加，点击保存提交');
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
    // List item click
    document.addEventListener('click', e => {
        const item = e.target.closest('[data-page-idx]');
        if (item) { selectPage(parseInt(item.dataset.pageIdx)); return; }

        const action = e.target.closest('[data-action]');
        if (!action) return;
        const act = action.dataset.action;
        if (act === 'add-page') addPage();
        else if (act === 'save-page') savePage();
        else if (act === 'del-page') delPage();
        else if (act === 'import-md') importMd();
        else if (act === 'preview-md') previewMd();
        else if (act === 'show-page-list') showPageList();
    });
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════

async function init() {
    registerPlugin({
        id: 'page-editor',
        name: '页面编辑器',
        icon: '📄',
        desc: '管理文档页面，支持 Markdown 编辑和预览',
        version: '1.0',
    });

    setupEvents();

    try {
        toast('加载中…');
        await readPages();
        renderPageList();
        toast('加载完成');
    } catch (e) {
        toast('加载失败: ' + e.message, 'error');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
