// kikkua · admin — 页面管理 + Markdown 预览

import { readRepo, writeRepo } from './api.js';
import { toast, confirmModal, inputModal } from './ui.js';

const $ = s => document.querySelector(s);
const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export let pages = [], pagesSha = '', currentPageIdx = -1;

export async function loadPages() {
    try {
        const r = await readRepo('data/pages.json');
        pagesSha = r.sha;
        const data = JSON.parse(r.text);
        pages = data.pages || [];
    } catch (e) {
        pagesSha = null;
        pages = [];
    }
    renderPageList();
}

export function renderPageList() {
    const el = $('#pageListPanel');
    if (!el) return;
    if (!pages.length) { el.innerHTML = '<div class="pages-edit-panel empty"><span>暂无页面</span></div>'; return; }
    el.innerHTML = pages.map((p, i) => `
        <div class="pages-list-item${i===currentPageIdx?' active':''}" data-page-idx="${i}">
            <div class="name">${esc(p.icon||'📄')} ${esc(p.title)}</div>
            <div class="meta"><span>${esc(p.group||'')}</span><span>ID: ${esc(p.id)}</span></div>
        </div>
    `).join('');
}

export function showPageList() {
    if (window.innerWidth <= 767) {
        document.getElementById('pageListView').classList.add('mob-show');
        document.getElementById('pageDetailView').classList.remove('mob-show');
    }
    renderPageList();
    const ep = document.getElementById('pageEditPanel');
    if (ep) { ep.className = 'pages-edit-panel empty'; ep.innerHTML = '<span>选择一个页面开始编辑</span>'; }
    currentPageIdx = -1;
}

export function selectPage(i) {
    currentPageIdx = i; renderPageList();
    if (window.innerWidth <= 767) {
        document.getElementById('pageListView').classList.remove('mob-show');
        document.getElementById('pageDetailView').classList.add('mob-show');
    }
    const p = pages[i];
    $('#pageEditPanel').className = 'pages-edit-panel';
    $('#pageEditPanel').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:16px;font-weight:600;">${esc(p.title)}</h3>
        </div>
        <div class="field-row">
            <div class="field"><label>页面 ID</label><input value="${esc(p.id)}" data-page-field="id" placeholder="about"></div>
            <div class="field"><label>标题</label><input value="${esc(p.title)}" data-page-field="title"></div>
        </div>
        <div class="field-row">
            <div class="field"><label>分组</label><input value="${esc(p.group||'')}" data-page-field="group" placeholder="入门指南"></div>
            <div class="field"><label>排序</label><input type="number" value="${p.order||0}" data-page-field="order" style="width:80px;"></div>
        </div>
        <div class="field-row">
            <div class="field"><label>图标 (Emoji)</label><input value="${esc(p.icon||'')}" data-page-field="icon" placeholder="📖"></div>
            <div class="field"><label>标签 (逗号分隔)</label><input value="${esc((p.tags||[]).join(', '))}" data-page-field="tags"></div>
        </div>
        <div class="field"><label>内容 (Markdown)</label>
            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <button class="btn btn-secondary btn-xs" data-action="import-md">📥 导入 .md</button>
                <button class="btn btn-secondary btn-xs" data-action="preview-md">👁 预览</button>
            </div>
            <textarea rows="12" id="pageContentInput" data-page-field="content">${esc(p.content||'')}</textarea></div>
        <div class="field"><label>更新日期</label><input value="${esc(p.updatedAt||'')}" data-page-field="updatedAt" placeholder="2026-05-24"></div>
        <div class="edit-actions">
            <button class="btn btn-primary btn-sm" data-action="save-pages">💾 保存</button>
            <button class="btn btn-danger btn-sm" data-action="del-page">删除</button>
        </div>
    `;

    // Bind page field inputs
    $('#pageEditPanel').querySelectorAll('[data-page-field]').forEach(el => {
        const field = el.dataset.pageField;
        const evt = (el.tagName === 'SELECT' || field === 'id' || field === 'title') ? 'input' : 'input';
        el.addEventListener(evt, () => {
            if (field === 'tags') pages[i].tags = el.value.split(',').map(s=>s.trim()).filter(Boolean);
            else if (field === 'order') pages[i].order = parseInt(el.value)||0;
            else pages[i][field] = el.value;
            if (field === 'id' || field === 'title') renderPageList();
        });
    });
}

export function updPage(i, k, v) { pages[i][k] = v; }

export async function savePages() {
    const btn = $('#savePagesBtn');
    try {
        btn.textContent = '⏳ 保存中…'; btn.disabled = true;
        const data = JSON.stringify({ pages }, null, 2);
        await writeRepo('data/pages.json', data, pagesSha, 'Update pages from admin');
        const r = await readRepo('data/pages.json');
        pagesSha = r.sha;
        toast('✅ 页面已保存到 GitHub');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
    finally { btn.textContent = '💾 保存页面'; btn.disabled = false; }
}

export async function savePagesSilent() {
    try {
        const data = JSON.stringify({ pages }, null, 2);
        await writeRepo('data/pages.json', data, pagesSha, 'Auto-update media refs');
        const r = await readRepo('data/pages.json');
        pagesSha = r.sha;
    } catch (e) { console.warn('Auto-update pages failed:', e); }
}

export async function delPage(i) {
    const ok = await confirmModal('删除', `确认删除"${pages[i].title}"？`);
    if (!ok) return;
    pages.splice(i, 1); currentPageIdx = -1;
    await savePages();
    renderPageList();
    $('#pageEditPanel').className = 'pages-edit-panel empty';
    $('#pageEditPanel').innerHTML = '<span>选择一个页面开始编辑</span>';
}

export async function addPage() {
    const name = await inputModal('新建页面', '页面 ID', 'about');
    if (!name) return;
    if (pages.find(p => p.id === name)) { toast('页面 ID 已存在', 'error'); return; }
    const today = new Date().toISOString().slice(0, 10);
    pages.push({ id: name, title: name, group: '', icon: '📄', order: pages.length + 1, tags: [], content: '## ' + name + '\n\n在这里输入内容…', updatedAt: today });
    renderPageList(); selectPage(pages.length - 1);
    toast('已添加，点击保存提交');
}

export function importMdFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt,.html';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        const localImgs = [];
        let m;
        while ((m = imgRegex.exec(text)) !== null) {
            const src = m[2];
            if (!/^(https?:|\/\/)/.test(src)) localImgs.push({ full: m[0], alt: m[1], src });
        }
        if (localImgs.length > 0) {
            await confirmModal('检测到本地图片',
                `发现 ${localImgs.length} 个本地图片引用（如 ${localImgs[0].src}）。\n\n导入后请手动上传图片到媒体库，或点击取消仅导入文本。`);
        }
        let content = text;
        content = content.replace(/!\[([^\]]*)\]\(\.\/?(images|img|assets|media)\/([^)]+)\)/g, '![$1](/data/media/$3)');
        const ta = document.getElementById('pageContentInput');
        if (ta) { ta.value = content; updPage(currentPageIdx, 'content', content); }
        toast(`已导入: ${file.name}${localImgs.length ? ' (请检查图片路径)' : ''}`);
    };
    input.click();
}

export function previewMd() {
    const ta = document.getElementById('pageContentInput');
    if (!ta) return;
    const text = ta.value || '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    const html = _mdPreview(text);
    overlay.innerHTML = `<div style="background:var(--surface);border-radius:12px;padding:32px;max-width:720px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.15);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="font-weight:600;">预览</span>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('div').parentElement.remove()">关闭</button>
        </div>
        <div style="font-size:15px;line-height:1.85;color:var(--text);">${html}</div>
    </div>`;
    document.body.appendChild(overlay);
}

function _mdPreview(text) {
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
