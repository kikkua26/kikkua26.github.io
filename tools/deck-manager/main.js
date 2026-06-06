// kikkua · 牌组管理器 — 插件入口

import { registerPlugin, apiRequest, esc, b64decode, b64encode } from '../shared/sdk.js';

const $ = s => document.querySelector(s);

// State
let decks = [], dataSha = '', currentDeckIdx = -1;
let tplNames = [];
let tagTree = [];
let csvMeta = {};

// Collect all unique tags from all decks + tagTree
function getAllTags() {
    const set = new Set();
    decks.forEach(d => (d.tags || []).forEach(t => set.add(t)));
    function walkTree(nodes) { nodes.forEach(n => { set.add(n.path); if (n.children) walkTree(n.children); }); }
    walkTree(tagTree);
    return [...set].sort();
}
const LS_KEY = 'kikkua_decks_draft';

function saveLocal() { localStorage.setItem(LS_KEY, JSON.stringify(decks)); }
function loadLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }

async function syncToGitHub() {
    const json = JSON.stringify(decks, null, 2);
    dataSha = await writeJson('data/index.json', json, dataSha, 'Update decks from admin');
    localStorage.removeItem(LS_KEY);
}

window.__pluginSync = syncToGitHub;
window.__pluginHasDraft = () => !!localStorage.getItem(LS_KEY);
window.__pluginPullRemote = async () => {
    localStorage.removeItem(LS_KEY);
    const r = await readJson('data/index.json');
    dataSha = r.sha;
    decks = JSON.parse(r.text);
    renderDeckList();
};

// ═══════════════════════════════════════
// GitHub API via parent proxy
// ═══════════════════════════════════════

async function readJson(path) {
    const resp = await apiRequest(path);
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    return { text: b64decode(resp.data.content), sha: resp.data.sha };
}

async function writeJson(path, content, sha, msg) {
    const body = { message: msg || 'Update ' + path, content: b64encode(content) };
    if (sha) body.sha = sha;
    const resp = await apiRequest(path, { method: 'PUT', body });
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    return resp.data.content.sha;
}

async function listDir(path) {
    const resp = await apiRequest(path);
    if (!resp.ok) {
        if (resp.status === 404) return [];
        throw new Error(resp.error || `HTTP ${resp.status}`);
    }
    return resp.data || [];
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

function tagSelectorDialog(selectedTags) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000';

        function walk(nodes) {
            let h = '';
            for (const n of nodes) {
                const ck = selectedTags.includes(n.path);
                h += '<div style="padding:2px 0;padding-left:20px;">' +
                    '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;">' +
                    '<input type="checkbox" ' + (ck ? 'checked ' : '') + ' data-tag-toggle="' + esc(n.path) + '">' +
                    '<span>' + esc(n.path.split('::').pop()) + '</span>' +
                    (n.desc ? '<span style="font-size:11px;color:var(--text3);"> (' + esc(n.desc) + ')</span>' : '') +
                    '</label>' + (n.children ? walk(n.children) : '') + '</div>';
            }
            return h;
        }

        const treeHtml = tagTree.length ? walk(tagTree) : '<div style="padding:20px;text-align:center;color:var(--text3);">暂未注册标签</div>';

        overlay.innerHTML = `<div class="modal" style="max-width:500px;max-height:80vh;display:flex;flex-direction:column;">
            <h3>选择标签</h3>
            <div style="max-height:400px;overflow-y:auto;margin:12px 0;">${treeHtml}</div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:12px;" data-preview>已选：${selectedTags.join('、') || '无'}</div>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div>
        </div>`;

        const preview = overlay.querySelector('[data-preview]');
        overlay.addEventListener('change', e => {
            const toggle = e.target.closest('[data-tag-toggle]');
            if (toggle) {
                const path = toggle.dataset.tagToggle;
                if (toggle.checked) { if (!selectedTags.includes(path)) selectedTags.push(path); }
                else { selectedTags = selectedTags.filter(t => t !== path && !t.startsWith(path + '::')); }
                preview.textContent = '已选：' + (selectedTags.join('、') || '无');
            }
        });

        overlay.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'ok') { overlay.remove(); resolve(selectedTags); }
            else if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(null); }
        });
        document.body.appendChild(overlay);
    });
}

// ═══════════════════════════════════════
// CSV Parsing
// ═══════════════════════════════════════

function parseCsvFull(text) {
    const sep = text.indexOf(String.fromCharCode(9)) >= 0 && text.indexOf(',') < 0 ? String.fromCharCode(9) : ',';
    const rows = []; let row = [''], fi = 0, q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && i + 1 < text.length && text[i + 1] === '"') { row[fi] += '"'; i++; }
            else if (c === '"') q = false;
            else row[fi] += c;
        } else {
            if (c === '"' && row[fi] === '') q = true;
            else if (c === String.fromCharCode(13)) continue;
            else if (c === String.fromCharCode(10)) { rows.push(row); row = ['']; fi = 0; }
            else if (c === sep) { row.push(''); fi++; }
            else row[fi] += c;
        }
    }
    if (row[fi] !== '' || fi > 0 || row.length > 1) rows.push(row);
    return rows;
}

// ═══════════════════════════════════════
// Rendering
// ═══════════════════════════════════════

function renderDeckList() {
    const el = $('#deckListPanel');
    if (!el) return;
    if (!decks.length) { el.innerHTML = '<div class="edit-panel empty"><span>暂无牌组</span></div>'; return; }
    el.innerHTML = decks.map((d, i) => `
        <div class="list-item${i === currentDeckIdx ? ' active' : ''}" data-idx="${i}">
            <div class="name">${esc(d.name)}</div>
            <div class="meta"><span>📄 ${d.totalCards || 0}</span><span class="badge">${esc(d.template || '?')}</span></div>
            ${d.summary ? `<div class="summary">${esc(d.summary)}</div>` : ''}
        </div>
    `).join('');
}

function showDeckList() {
    if (window.innerWidth <= 767) {
        $('#deckListView')?.classList.add('mob-show');
        $('#deckDetailView')?.classList.remove('mob-show');
    }
    renderDeckList();
    currentDeckIdx = -1;
    const panel = $('#deckEditPanel');
    if (panel) { panel.className = 'edit-panel empty'; panel.innerHTML = '<span>选择一个牌组开始编辑</span>'; }
}

async function selectDeck(i) {
    currentDeckIdx = i;
    renderDeckList();
    if (window.innerWidth <= 767) {
        $('#deckListView')?.classList.remove('mob-show');
        $('#deckDetailView')?.classList.add('mob-show');
    }
    const d = decks[i];

    let csvFields = [], csvCount = 0;
    async function loadCsvText(name) {
        if (csvMeta[name]) return csvMeta[name].text;
        try {
            const r = await readJson('data/' + name + '/data.csv');
            csvMeta[name] = { sha: r.sha, text: r.text };
            return r.text;
        } catch { return ''; }
    }
    try {
        const raw = await loadCsvText(d.name);
        const text = raw.replace(/^﻿/, '').trim();
        const rows = parseCsvFull(text);
        if (rows.length > 0) { csvFields = rows[0].map(f => f.trim()); csvCount = rows.length - 1; }
    } catch (e) { console.warn('CSV load:', e.message); }

    if (csvCount > 0 && d.totalCards !== csvCount) { d.totalCards = csvCount; renderDeckList(); }

    const chapterOpts = csvFields.length > 0
        ? csvFields.map(f => `<option value="${esc(f)}"${f === d.chapterField ? ' selected' : ''}>${esc(f)}</option>`).join('')
        : `<option value="${esc(d.chapterField || '章节')}">${esc(d.chapterField || '章节')}</option>`;
    const tplOpts = tplNames.map(n => `<option value="${esc(n)}"${n === d.template ? ' selected' : ''}>${esc(n)}</option>`).join('');

    const panel = $('#deckEditPanel');
    if (!panel) return;
    panel.className = 'edit-panel';
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:16px;font-weight:600;">${esc(d.name)}</h3>
        </div>
        <div class="field-row">
            <div class="field"><label>名称</label><input value="${esc(d.name)}" data-deck-field="name"></div>
            <div class="field"><label>模板</label><select data-deck-field="template">${tplOpts}</select></div>
        </div>
        <div class="field-row">
            <div class="field"><label>卡片数</label><span class="field-readonly">${csvCount > 0 ? csvCount + ' 条（自动）' : d.totalCards || '暂无数据'}</span></div>
            <div class="field"><label>章节字段</label><select data-deck-field="chapterField">${chapterOpts}</select></div>
        </div>
        <div class="field"><label>标签</label>
            <div class="tag-input-wrap" data-deck-tags>
                ${(d.tags || []).map(t => '<span class="tag-chip">' + esc(t) + '<span class="tag-remove" data-remove-tag="' + esc(t) + '">×</span></span>').join('')}
                <input class="tag-text-input" placeholder="输入标签，回车添加（支持 :: 分级）" data-tag-input>
                <div class="tag-suggestions" data-tag-suggestions></div>
            </div>
        </div>
        <div class="field"><label>简述</label><input value="${esc(d.summary || '')}" data-deck-field="summary" placeholder="卡片列表中显示的简短介绍"></div>
        <div class="field"><label>购买链接</label><input value="${esc(d.purchaseUrl || '')}" data-deck-field="purchaseUrl"></div>
        <div class="field"><label>介绍 (Markdown)</label><textarea rows="3" data-deck-field="detail">${esc(d.detail || '')}</textarea></div>
        <div class="csv-section">
            <div class="flex-between">
                <span class="csv-title">📊 数据文件</span>
                <div class="flex-row gap-sm">
                    <button class="btn btn-secondary btn-xs" data-csv-action="preview" data-deck="${esc(d.name)}">查看</button>
                    <button class="btn btn-secondary btn-xs" data-csv-action="download" data-deck="${esc(d.name)}">下载</button>
                    <button class="btn btn-secondary btn-xs" data-csv-action="upload" data-deck="${esc(d.name)}">上传</button>
                </div>
            </div>
            <div class="csv-info">${csvCount > 0 ? csvCount + ' 条记录' : '暂无数据'}</div>
        </div>
        <div class="edit-actions">
            <button class="btn btn-primary btn-sm" data-action="save-decks">💾 保存</button>
            <button class="btn btn-danger btn-sm" data-action="del-deck">删除</button>
        </div>
    `;

    // Bind field inputs
    panel.querySelectorAll('[data-deck-field]').forEach(el => {
        const field = el.dataset.deckField;
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => { decks[i][field] = el.value; if (field === 'name') renderDeckList(); saveLocal(); });
    });
}

// ═══════════════════════════════════════
// Actions
// ═══════════════════════════════════════

function saveDecks() { saveLocal(); toast('💾 已保存'); }

async function delDeck(i) {
    const ok = await confirmDialog(`确认删除"${decks[i].name}"？`);
    if (!ok) return;
    decks.splice(i, 1);
    currentDeckIdx = -1;
    saveLocal();
    toast('已删除');
    renderDeckList();
    const panel = $('#deckEditPanel');
    if (panel) { panel.className = 'edit-panel empty'; panel.innerHTML = '<span>选择一个牌组开始编辑</span>'; }
}

async function addDeck() {
    const name = await inputDialog('新建牌组', '牌组名称', '新牌组');
    if (!name) return;
    if (decks.find(d => d.name === name)) { toast('已存在', 'error'); return; }
    decks.push({ name, totalCards: 0, tags: [], template: tplNames[0] || '', chapterField: '章节', detail: '', purchaseUrl: '', summary: '' });
    renderDeckList();
    selectDeck(decks.length - 1);
    toast('已添加，点击保存提交');
}

// ── CSV ──
async function previewCsv(deck) {
    try {
        const r = await readJson('data/' + deck + '/data.csv');
        csvMeta[deck] = { sha: r.sha, text: r.text };
        const text = r.text.replace(/^﻿/, '').trim();
        const rows = parseCsvFull(text);
        const sep = text.indexOf('\t') >= 0 && text.indexOf(',') < 0 ? '\t' : ',';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = `<div class="modal modal-wide">
            <div class="flex-between mb-sm">
                <h3 class="modal-title-lg">${esc(deck)}/data.csv</h3>
                <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
            </div>
            <div class="csv-info">共 ${rows.length - 1} 条记录 · ${sep === '\t' ? '制表符分隔' : '逗号分隔'}</div>
            <div class="modal-scroll"><table class="csv-table"><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join('')}</tr>
                ${rows.slice(1, 101).map(r => `<tr>${r.map(c => `<td>${esc(c.slice(0, 80))}</td>`).join('')}</tr>`).join('')}</table></div>
        </div>`;
        document.body.appendChild(overlay);
    } catch (e) { toast('加载失败: ' + e.message, 'error'); }
}

async function downloadCsv(deck) {
    try {
        const r = csvMeta[deck] || await readJson('data/' + deck + '/data.csv');
        csvMeta[deck] = { sha: r.sha, text: r.text };
        const blob = new Blob([r.text], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = deck + '_data.csv';
        a.click();
    } catch (e) { toast('下载失败', 'error'); }
}

function uploadCsv(deck) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const ok = await confirmDialog(`确认上传 ${deck}/data.csv？`);
        if (!ok) return;
        try {
            let sha = null;
            if (csvMeta[deck]) { sha = csvMeta[deck].sha; }
            else { try { const r = await readJson('data/' + deck + '/data.csv'); sha = r.sha; csvMeta[deck] = { sha: r.sha, text: r.text }; } catch {} }
            const newSha = await writeJson('data/' + deck + '/data.csv', text, sha, 'Update ' + deck);
            csvMeta[deck] = { sha: newSha, text };
            if (currentDeckIdx >= 0 && decks[currentDeckIdx]?.name === deck) {
                const count = parseCsvFull(text).length - 1;
                decks[currentDeckIdx].totalCards = count > 0 ? count : 0;
                saveLocal();
                renderDeckList();
                await selectDeck(currentDeckIdx);
            }
            toast('CSV 已上传');
        } catch (err) { toast(err.message, 'error'); }
    };
    input.click();
}

// ═══════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════

function setupEvents() {
    document.addEventListener('click', e => {
        // Deck list items
        const deckItem = e.target.closest('.list-item[data-idx]');
        if (deckItem) { selectDeck(parseInt(deckItem.dataset.idx)); return; }

        // Actions
        const action = e.target.closest('[data-action]');
        if (action) {
            const act = action.dataset.action;
            if (act === 'add-deck') addDeck();
            else if (act === 'save-decks') saveDecks();
            else if (act === 'del-deck' && currentDeckIdx >= 0) delDeck(currentDeckIdx);
            else if (act === 'show-deck-list') showDeckList();
            return;
        }

        // CSV actions
        const csvAction = e.target.closest('[data-csv-action]');
        if (csvAction) {
            const act = csvAction.dataset.csvAction;
            const deck = csvAction.dataset.deck;
            if (act === 'preview') previewCsv(deck);
            else if (act === 'download') downloadCsv(deck);
            else if (act === 'upload') uploadCsv(deck);
            return;
        }

        // Tag chip remove
        const removeTag = e.target.closest('[data-remove-tag]');
        if (removeTag && currentDeckIdx >= 0) {
            decks[currentDeckIdx].tags = (decks[currentDeckIdx].tags || []).filter(t => t !== removeTag.dataset.removeTag);
            saveLocal();
            selectDeck(currentDeckIdx);
            return;
        }

        // Tag suggestion click
        const suggestion = e.target.closest('[data-pick-tag]');
        if (suggestion && currentDeckIdx >= 0) {
            const val = suggestion.dataset.pickTag;
            const tags = decks[currentDeckIdx].tags || [];
            if (!tags.includes(val)) { tags.push(val); decks[currentDeckIdx].tags = tags; saveLocal(); }
            selectDeck(currentDeckIdx);
            return;
        }
    });

    // Tag input keyboard
    document.addEventListener('keydown', e => {
        const input = e.target.closest('[data-tag-input]');
        if (!input || currentDeckIdx < 0) return;
        const val = input.value.trim();
        if ((e.key === 'Enter' || e.key === ',') && val) {
            e.preventDefault();
            const tags = decks[currentDeckIdx].tags || [];
            if (!tags.includes(val)) { tags.push(val); decks[currentDeckIdx].tags = tags; saveLocal(); }
            selectDeck(currentDeckIdx);
        } else if (e.key === 'Backspace' && !val && decks[currentDeckIdx].tags?.length) {
            decks[currentDeckIdx].tags.pop();
            saveLocal();
            selectDeck(currentDeckIdx);
        }
    });

    // Tag input — show suggestions
    document.addEventListener('input', e => {
        const input = e.target.closest('[data-tag-input]');
        if (!input || currentDeckIdx < 0) return;
        const val = input.value.trim().toLowerCase();
        const sugBox = input.parentElement.querySelector('[data-tag-suggestions]');
        if (!sugBox) return;
        if (!val) { sugBox.innerHTML = ''; return; }
        const existing = new Set(decks[currentDeckIdx].tags || []);
        const allTags = getAllTags();
        const matches = allTags.filter(t => t.toLowerCase().includes(val) && !existing.has(t)).slice(0, 8);
        sugBox.innerHTML = matches.map(t =>
            `<div class="tag-sug-item" data-pick-tag="${esc(t)}">${esc(t)}</div>`
        ).join('');
    });

    // Hide suggestions on blur
    document.addEventListener('focusout', e => {
        if (e.target.closest('[data-tag-input]')) {
            setTimeout(() => {
                const sugBox = e.target.closest('.tag-input-wrap')?.querySelector('[data-tag-suggestions]');
                if (sugBox) sugBox.innerHTML = '';
            }, 200);
        }
    });
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════

async function init() {
    registerPlugin({
        id: 'deck-manager',
        name: '牌组管理器',
        icon: '📋',
        desc: '管理牌组，支持 CSV 数据预览/下载/上传',
        version: '1.0',
    });

    setupEvents();

    try {
        toast('加载中…');
        // Load template names
        const items = await listDir('templates');
        tplNames = (items || []).filter(i => i.type === 'dir').map(i => i.name);
        // Load tag tree
        try {
            const tagResp = await apiRequest('data/tags.json');
            if (tagResp.ok) tagTree = JSON.parse(b64decode(tagResp.data.content));
        } catch {}
        // Load decks (GitHub for SHA, local draft for content)
        try {
            const r = await readJson('data/index.json');
            dataSha = r.sha;
            decks = JSON.parse(r.text);
        } catch {}
        const local = loadLocal();
        if (local) decks = local;
        renderDeckList();
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
