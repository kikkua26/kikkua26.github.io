// kikkua · 牌组管理器 — 插件入口

import { registerPlugin, apiRequest, esc } from '../shared/sdk.js';

const $ = s => document.querySelector(s);

// State
let decks = [], dataSha = '', currentDeckIdx = -1;
let tplNames = [];
let csvMeta = {};

// ═══════════════════════════════════════
// GitHub API via parent proxy
// ═══════════════════════════════════════

async function readJson(path) {
    const resp = await apiRequest(path);
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    return { text: atob(resp.data.content), sha: resp.data.sha };
}

async function writeJson(path, content, sha, msg) {
    const body = { message: msg || 'Update ' + path, content: btoa(content) };
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
            <div class="tag-list" data-deck-tags>${(d.tags || []).map(t => '<span class="tag-chip">' + esc(t) + '<span class="tag-remove" data-remove-tag="' + esc(t) + '">×</span></span>').join('')}
                <span class="tag-add" data-add-tag>+ 添加</span>
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
        el.addEventListener(evt, () => { decks[i][field] = el.value; if (field === 'name') renderDeckList(); });
    });
}

// ═══════════════════════════════════════
// Actions
// ═══════════════════════════════════════

async function saveDecks(quiet) {
    const btn = $('[data-action="save-decks"]');
    try {
        if (!quiet && btn) { btn.textContent = '⏳ 保存中…'; btn.disabled = true; }
        const json = JSON.stringify(decks, null, 2);
        dataSha = await writeJson('data/index.json', json, dataSha, 'Update decks from admin');
        if (!quiet) toast('✅ 已保存到 GitHub');
    } catch (e) { if (!quiet) toast('❌ ' + e.message, 'error'); }
    finally { if (!quiet && btn) { btn.textContent = '💾 保存'; btn.disabled = false; } }
}

async function delDeck(i) {
    const ok = await confirmDialog(`确认删除"${decks[i].name}"？`);
    if (!ok) return;
    decks.splice(i, 1);
    currentDeckIdx = -1;
    await saveDecks();
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
                await saveDecks(true);
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

        // Tag actions
        const removeTag = e.target.closest('[data-remove-tag]');
        if (removeTag && currentDeckIdx >= 0) {
            decks[currentDeckIdx].tags = (decks[currentDeckIdx].tags || []).filter(t => t !== removeTag.dataset.removeTag);
            selectDeck(currentDeckIdx);
            return;
        }
        const addTag = e.target.closest('[data-add-tag]');
        if (addTag && currentDeckIdx >= 0) {
            const tag = prompt('标签名称：');
            if (tag) {
                if (!decks[currentDeckIdx].tags) decks[currentDeckIdx].tags = [];
                decks[currentDeckIdx].tags.push(tag);
                selectDeck(currentDeckIdx);
            }
            return;
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
        // Load decks
        const r = await readJson('data/index.json');
        dataSha = r.sha;
        decks = JSON.parse(r.text);
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
