// kikkua · 模板编辑器 — 插件入口

import { registerPlugin, apiRequest, esc, b64decode, b64encode } from '../shared/sdk.js';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// State
let tplNames = [], currentTpl = '', currentTplFile = '';
let tplFiles = {};

// ═══════════════════════════════════════
// GitHub API via parent proxy
// ═══════════════════════════════════════

async function listTemplates() {
    const resp = await apiRequest('templates');
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    // API returns array of items
    return (resp.data || []).filter(i => i.type === 'dir').map(i => i.name);
}

async function readFile(path) {
    const resp = await apiRequest(path);
    if (!resp.ok) {
        if (resp.status === 404) return { text: '', sha: null };
        throw new Error(resp.error || `HTTP ${resp.status}`);
    }
    return { text: b64decode(resp.data.content), sha: resp.data.sha };
}

async function writeFile(path, content, sha, msg) {
    const body = { message: msg || 'Update ' + path, content: b64encode(content) };
    if (sha) body.sha = sha;
    const resp = await apiRequest(path, { method: 'PUT', body });
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    return resp.data.content.sha;
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
// Rendering
// ═══════════════════════════════════════

function renderTplGrid() {
    const el = $('#tplGrid');
    if (!el) return;
    el.innerHTML = tplNames.map(n => `
        <div class="tpl-card${n === currentTpl ? ' selected' : ''}" data-tpl="${esc(n)}">
            <div class="icon">📁</div><div class="name">${esc(n)}</div>
            <div class="meta">模板包</div>
        </div>
    `).join('') + '<div class="tpl-card add" data-action="create-tpl"><div class="big">+</div><span>新建</span></div>';
}

async function selectTpl(name) {
    currentTpl = name;
    renderTplGrid();
    const editor = $('#tplEditor');
    if (editor) editor.style.display = 'block';
    const title = $('#tplEditorTitle');
    if (title) title.textContent = name;

    const files = ['正面模板.html', '背面模板.html', '样式.css'];
    const tabs = $('#tplFileTabs');
    if (tabs) {
        tabs.innerHTML = files.map((f, i) =>
            `<span class="file-tab${i === 0 ? ' active' : ''}" data-tpl-file="${esc(name)}" data-tpl-filename="${esc(f)}">${f}</span>`
        ).join('');
    }
    await switchTplFile(name, files[0], tabs?.firstChild);
}

async function switchTplFile(tpl, file, tab) {
    currentTplFile = `templates/${tpl}/${file}`;
    $$('.file-tab').forEach(t => t.classList.remove('active'));
    if (tab) tab.classList.add('active');
    const content = $('#tplEditorContent');
    if (content) content.value = '加载中…';
    try {
        const r = await readFile(currentTplFile);
        tplFiles[currentTplFile] = { sha: r.sha };
        if (content) content.value = r.text || '/* 新文件 */\n';
    } catch (e) {
        if (content) content.value = `/* 加载失败: ${e.message} */`;
    }
}

async function saveTplFile() {
    const content = $('#tplEditorContent')?.value;
    if (content === undefined) return;
    const info = tplFiles[currentTplFile] || { sha: null };
    try {
        const newSha = await writeFile(currentTplFile, content, info.sha, 'Update ' + currentTplFile);
        tplFiles[currentTplFile] = { sha: newSha };
        toast('已保存');
    } catch (e) { toast(e.message, 'error'); }
}

async function createTpl() {
    const name = await inputDialog('新建模板', '模板名称', 'my-template');
    if (!name) return;
    if (tplNames.includes(name)) { toast('已存在', 'error'); return; }
    try {
        await writeFile(`templates/${name}/正面模板.html`, '{{Front}}', null, 'Create');
        await writeFile(`templates/${name}/背面模板.html`, '{{FrontSide}}\n\n<hr>\n\n{{Back}}', null, 'Create');
        await writeFile(`templates/${name}/样式.css`, '.card { font-family: arial; font-size: 20px; }', null, 'Create');
        tplNames.push(name);
        renderTplGrid();
        selectTpl(name);
        toast(`"${name}" 已创建`);
    } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════

function setupEvents() {
    document.addEventListener('click', e => {
        // Template card click
        const tplCard = e.target.closest('.tpl-card[data-tpl]');
        if (tplCard) { selectTpl(tplCard.dataset.tpl); return; }

        // Create template
        const tplCreate = e.target.closest('[data-action="create-tpl"]');
        if (tplCreate) { createTpl(); return; }

        // File tab click
        const tplTab = e.target.closest('.file-tab[data-tpl-file]');
        if (tplTab) { switchTplFile(tplTab.dataset.tplFile, tplTab.dataset.tplFilename, tplTab); return; }

        // Save button
        const action = e.target.closest('[data-action]');
        if (action) {
            if (action.dataset.action === 'save-tpl') saveTplFile();
        }
    });
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════

async function init() {
    registerPlugin({
        id: 'template-editor',
        name: '模板编辑器',
        icon: '🎨',
        desc: '管理 Anki 卡片模板，编辑正面/背面模板和样式',
        version: '1.0',
    });

    setupEvents();

    try {
        toast('加载中…');
        tplNames = await listTemplates();
        renderTplGrid();
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
