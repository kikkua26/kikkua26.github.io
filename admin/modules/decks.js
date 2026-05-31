// kikkua · admin — 牌组管理 + CSV 操作

import { readRepo, writeRepo } from './api.js';
import { toast, confirmModal, inputModal } from './ui.js';
import { tplNames } from './templates.js';

const $ = s => document.querySelector(s);
const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export let decks = [], dataSha = '', currentDeckIdx = -1;
export let csvMeta = {};

export async function loadDecks() {
    const r = await readRepo('data/index.json');
    dataSha = r.sha; decks = JSON.parse(r.text);
    renderDeckList();
}

export function renderDeckList() {
    const el = $('#deckListPanel');
    if (!el) return;
    if (!decks.length) { el.innerHTML = '<div class="deck-edit-panel empty"><span>暂无牌组</span></div>'; return; }
    el.innerHTML = decks.map((d, i) => `
        <div class="deck-list-item${i===currentDeckIdx?' active':''}" data-idx="${i}">
            <div class="name">${esc(d.name)}</div>
            <div class="meta"><span>📄 ${d.totalCards||0}</span><span class="badge">${esc(d.template||'?')}</span></div>
            ${d.summary ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.summary)}</div>` : ''}
        </div>
    `).join('');
}

export function showDeckList() {
    if (window.innerWidth <= 767) {
        document.getElementById('deckListView').classList.add('mob-show');
        document.getElementById('deckDetailView').classList.remove('mob-show');
    }
    renderDeckList();
    const ep = document.getElementById('deckEditPanel');
    if (ep) { ep.className = 'deck-edit-panel empty'; ep.innerHTML = '<span>选择一个牌组开始编辑</span>'; }
    currentDeckIdx = -1;
}

export async function selectDeck(i) {
    currentDeckIdx = i; renderDeckList();
    if (window.innerWidth <= 767) {
        document.getElementById('deckListView').classList.remove('mob-show');
        document.getElementById('deckDetailView').classList.add('mob-show');
    }
    const d = decks[i];

    let csvFields = [], csvCount = 0;
    async function loadCsvText(name) {
        if (csvMeta[name]) return csvMeta[name].text;
        try { const r = await readRepo('data/' + name + '/data.csv'); csvMeta[name] = { sha: r.sha, text: r.text }; return r.text; }
        catch { const r = await fetch('/data/' + encodeURIComponent(name) + '/data.csv'); csvMeta[name] = { sha: '', text: await r.text() }; return csvMeta[name].text; }
    }
    try {
        const raw = await loadCsvText(d.name);
        const text = raw.replace(/^﻿/, '').trim();
        const rows = parseCsvFull(text);
        if (rows.length > 0) { csvFields = rows[0].map(f => f.trim()); csvCount = rows.length - 1; }
    } catch (e) { console.warn('CSV load:', e.message); }

    if (csvCount > 0 && d.totalCards !== csvCount) { d.totalCards = csvCount; renderDeckList(); }

    const chapterOpts = csvFields.length > 0
        ? csvFields.map(f => `<option value="${esc(f)}"${f===d.chapterField?' selected':''}>${esc(f)}</option>`).join('')
        : `<option value="${esc(d.chapterField||'章节')}">${esc(d.chapterField||'章节')}</option>`;
    const tplOpts = tplNames.map(n => `<option value="${esc(n)}"${n===d.template?' selected':''}>${esc(n)}</option>`).join('');

    $('#deckEditPanel').className = 'deck-edit-panel';
    $('#deckEditPanel').innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="font-size:16px;font-weight:600;">${esc(d.name)}</h3>
        </div>
        <div class="field-row">
            <div class="field"><label>名称</label><input value="${esc(d.name)}" data-deck-field="name"></div>
            <div class="field"><label>模板</label><select data-deck-field="template">${tplOpts}</select></div>
        </div>
        <div class="field-row">
            <div class="field"><label>卡片数</label><span style="display:block;padding:7px 10px;background:var(--bg);border-radius:6px;font-size:14px;color:var(--text3);">${csvCount > 0 ? csvCount + ' 条（自动）' : d.totalCards || '暂无数据'}</span></div>
            <div class="field"><label>章节字段</label><select data-deck-field="chapterField">${chapterOpts}</select></div>
        </div>
        <div class="field"><label>标签</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;" data-deck-tags>${(d.tags||[]).map(t => '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;font-size:12px;">' + esc(t) + '<span style="cursor:pointer;color:var(--text3);margin-left:2px;" data-remove-tag="' + esc(t) + '">×</span></span>').join('')}
                <span style="display:inline-flex;align-items:center;padding:2px 8px;border:1px dashed var(--border);border-radius:4px;font-size:12px;cursor:pointer;color:var(--accent);" data-add-tag>+ 添加</span>
            </div>
        </div>
        <div class="field"><label>简述</label><input value="${esc(d.summary||'')}" data-deck-field="summary" placeholder="卡片列表中显示的简短介绍"></div>
        <div class="field"><label>购买链接</label><input value="${esc(d.purchaseUrl||'')}" data-deck-field="purchaseUrl"></div>
        <div class="field"><label>介绍 (Markdown)</label><textarea rows="3" data-deck-field="detail">${esc(d.detail||'')}</textarea></div>
        <div style="border-top:1px solid var(--border);padding-top:14px;margin-top:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:13px;font-weight:600;color:var(--text2);">📊 数据文件</span>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary btn-xs" data-csv-action="preview" data-deck="${esc(d.name)}">查看</button>
                    <button class="btn btn-secondary btn-xs" data-csv-action="download" data-deck="${esc(d.name)}">下载</button>
                    <button class="btn btn-secondary btn-xs" data-csv-action="upload" data-deck="${esc(d.name)}">上传</button>
                </div>
            </div>
            <div style="font-size:12px;color:var(--text3);">${csvCount > 0 ? csvCount + ' 条记录' : '暂无数据'}</div>
        </div>
        <div class="edit-actions">
            <button class="btn btn-primary btn-sm" data-action="save-decks">💾 保存</button>
            <button class="btn btn-danger btn-sm" data-action="del-deck">删除</button>
        </div>
    `;

    // Bind deck field inputs
    $('#deckEditPanel').querySelectorAll('[data-deck-field]').forEach(el => {
        const field = el.dataset.deckField;
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, () => { decks[i][field] = el.value; if (field === 'name') renderDeckList(); });
    });
}

export function upd(i, k, v) { decks[i][k] = v; }

export async function saveDecks(quiet) {
    const btn = $('#saveBtn');
    try {
        if (!quiet) { btn.textContent = '⏳ 保存中…'; btn.disabled = true; }
        const json = JSON.stringify(decks, null, 2);
        await writeRepo('data/index.json', json, dataSha, 'Update decks from admin');
        const r = await readRepo('data/index.json'); dataSha = r.sha;
        const { updateDashboard } = await import('./dashboard.js');
        updateDashboard();
        if (!quiet) toast('✅ 已保存到 GitHub');
    } catch (e) { if (!quiet) toast('❌ ' + e.message, 'error'); }
    finally { if (!quiet) { btn.textContent = '💾 保存'; btn.disabled = false; } }
}

export async function delDeck(i) {
    const ok = await confirmModal('删除', `确认删除"${decks[i].name}"？`);
    if (!ok) return;
    decks.splice(i, 1); currentDeckIdx = -1;
    await saveDecks();
    renderDeckList();
    $('#deckEditPanel').className = 'deck-edit-panel empty';
    $('#deckEditPanel').innerHTML = '<span>选择一个牌组开始编辑</span>';
}

export async function addDeck() {
    const name = await inputModal('新建牌组', '牌组名称', '新牌组');
    if (!name) return;
    if (decks.find(d => d.name === name)) { toast('已存在', 'error'); return; }
    decks.push({ name, totalCards: 0, tags: [], template: tplNames[0]||'', chapterField:'章节', detail:'', purchaseUrl:'', summary:'' });
    renderDeckList(); selectDeck(decks.length-1);
    toast('已添加，点击保存提交');
}

// ── CSV ──
export function parseCsvFull(text) {
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

export async function previewCsv(deck) {
    try {
        const r = await readRepo('data/' + deck + '/data.csv');
        csvMeta[deck] = { sha: r.sha, text: r.text };
        const text = r.text.replace(/^﻿/, '').trim();
        const rows = parseCsvFull(text);
        const sep = text.indexOf('\t') >= 0 && text.indexOf(',') < 0 ? '\t' : ',';
        $('#csvPreviewTitle').textContent = deck + '/data.csv';
        $('#csvPreviewInfo').textContent = `共 ${rows.length-1} 条记录 · ${sep === '\t' ? '制表符分隔' : '逗号分隔'}`;
        $('#csvTable').innerHTML = `<tr>${rows[0].map(h=>`<th>${esc(h)}</th>`).join('')}</tr>` +
            rows.slice(1, 101).map(r => `<tr>${r.map(c=>`<td>${esc(c.slice(0,80))}</td>`).join('')}</tr>`).join('');
        $('#csvPreviewOverlay').classList.add('show');
    } catch (e) { toast('加载失败: ' + e.message, 'error'); }
}

export async function downloadCsv(deck) {
    try {
        const r = csvMeta[deck] || await readRepo('data/' + deck + '/data.csv');
        csvMeta[deck] = { sha: r.sha, text: r.text };
        const blob = new Blob([r.text], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = deck + '_data.csv'; a.click();
    } catch (e) { toast('下载失败', 'error'); }
}

export async function uploadCsv(deck) {
    const input = $('#csvFileInput');
    input.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const text = await file.text();
        const ok = await confirmModal('上传 CSV', `确认上传 ${deck}/data.csv？`);
        if (!ok) { input.value = ''; return; }
        try {
            let sha = null;
            if (csvMeta[deck]) { sha = csvMeta[deck].sha; }
            else { try { const r = await readRepo('data/' + deck + '/data.csv'); sha = r.sha; csvMeta[deck] = { sha: r.sha, text: r.text }; } catch {} }
            const r = await writeRepo('data/' + deck + '/data.csv', text, sha, 'Update ' + deck);
            csvMeta[deck] = { sha: r.content.sha, text };
            if (currentDeckIdx >= 0 && decks[currentDeckIdx]?.name === deck) {
                const count = parseCsvFull(text).length - 1;
                decks[currentDeckIdx].totalCards = count > 0 ? count : 0;
                await saveDecks(true);
                renderDeckList();
                await selectDeck(currentDeckIdx);
            }
            toast('CSV 已上传');
        } catch (err) { toast(err.message, 'error'); }
        input.value = '';
    };
    input.click();
}
