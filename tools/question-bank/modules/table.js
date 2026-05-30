// kikkua · 题库编辑器 — 表格核心：行 CRUD、数据收集、列布局

import { OPT_LETTERS } from './constants.js';
import { esc } from './utils.js';
import { buildTypeSelect, applyTypeLock, applyAnswerHighlight, setHiddenOptCols } from './type-system.js';

const tbody = document.getElementById('tbody');
const statusEl = document.getElementById('statusText');
let _hiddenOptCols = 0;

export function getTbody() { return tbody; }

export function setOptCols(n) {
    const show = parseInt(n);
    _hiddenOptCols = 7 - show;
    setHiddenOptCols(_hiddenOptCols);
    OPT_LETTERS.forEach((_, i) => {
        document.querySelectorAll(`[data-col="opt${OPT_LETTERS[i]}"]`).forEach(el => { el.style.display = i < show ? '' : 'none'; });
    });
    buildColGroup(show);
}

export function buildColGroup(optCount) {
    const cg = document.getElementById('colgroup');
    const visibleOpts = optCount != null ? optCount : (7 - _hiddenOptCols);
    const flexCols = 8 + visibleOpts;
    const flexPct = (94.5 / flexCols).toFixed(3);
    let html = '<col style="width:3%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    for (let i = 0; i < visibleOpts; i++) html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:2.5%">';
    cg.innerHTML = html;
}

export function getHiddenOptCols() { return _hiddenOptCols; }

export function addRow(data, beforeTr) {
    const tr = document.createElement('tr');
    const d = data || {};
    tr.innerHTML = `<td class="idx" data-col="idx" title="双击编辑 · 右键菜单"></td>`;
    tr.innerHTML += `<td data-col="type">${buildTypeSelect(d.type||'')}</td>`;
    tr.innerHTML += `<td data-col="chapter"><input type="text" data-field="chapter" placeholder="章节" value="${esc(d.chapter||'')}"></td>`;
    tr.innerHTML += `<td data-col="question" class="has-preview"><input type="text" data-field="question" placeholder="题干" value="${esc(d.question||'')}"><button class="preview-btn" title="编辑">🔍</button></td>`;
    tr.innerHTML += `<td data-col="clozetext" class="has-preview"><input type="text" data-field="clozetext" placeholder="Cloze" value="${esc(d.clozetext||'')}"><button class="preview-btn" title="编辑">🔍</button></td>`;
    OPT_LETTERS.forEach((o, i) => {
        const visible = i < (7 - _hiddenOptCols);
        tr.innerHTML += `<td data-col="opt${o}" style="${visible?'':'display:none'}"><input type="text" data-field="opt${o}" placeholder="${o}" value="${esc(d['opt'+o]||'')}"></td>`;
    });
    tr.innerHTML += `<td data-col="answer"><input type="text" data-field="answer" maxlength="10" placeholder="A" value="${esc(d.answer||'')}"></td>`;
    tr.innerHTML += `<td data-col="answertext" class="has-preview"><input type="text" data-field="answertext" placeholder="答案文本" value="${esc(d.answertext||'')}"><button class="preview-btn" title="编辑">🔍</button></td>`;
    tr.innerHTML += `<td data-col="analysis" class="has-preview"><input type="text" data-field="analysis" placeholder="解析" value="${esc(d.analysis||'')}"><button class="preview-btn" title="编辑">🔍</button></td>`;
    tr.innerHTML += `<td data-col="reference" class="has-preview"><input type="text" data-field="reference" placeholder="参考" value="${esc(d.reference||'')}"><button class="preview-btn" title="编辑">🔍</button></td>`;
    tr.innerHTML += `<td data-col="actions" class="actions" title="删除">✕</td>`;
    if (beforeTr) tbody.insertBefore(tr, beforeTr); else tbody.appendChild(tr);
    applyTypeLock(tr);
    renumber();
    return tr;
}

export function addRows() {
    const n = parseInt(prompt('添加几行？', '10'));
    if (n > 0) { for (let i = 0; i < n; i++) addRow(); }
}

export function delRow(el) {
    const tr = el.closest('tr');
    if (tr) { tr.remove(); renumber(); }
}

let _onRenumber = null;
export function onRenumber(fn) { _onRenumber = fn; }

export function renumber() {
    Array.from(tbody.rows).forEach((tr, i) => { tr.querySelector('.idx').textContent = i + 1; });
    const filled = Array.from(tbody.rows).filter(tr => !isRowEmpty(tr)).length;
    statusEl.innerHTML = `共 <span class="count">${filled}</span> 行`;
    if (_onRenumber) _onRenumber();
}

export function collectData() {
    const rows = [];
    Array.from(tbody.rows).forEach(tr => {
        const obj = {};
        tr.querySelectorAll('[data-field]').forEach(el => { obj[el.dataset.field] = el.value; });
        rows.push(obj);
    });
    return rows;
}

export function isRowEmpty(tr) {
    return ![...tr.querySelectorAll('[data-field]')].some(el => el.value.trim());
}

export function ensureEmptyRows() {
    const rows = Array.from(tbody.rows);
    if (rows.length === 0 || !isRowEmpty(rows[rows.length - 1])) addRow();
}

export function getRowData(tr) {
    const obj = {};
    tr.querySelectorAll('[data-field]').forEach(el => { obj[el.dataset.field] = el.value; });
    return obj;
}

export function setRowData(tr, data) {
    tr.querySelectorAll('[data-field]').forEach(el => {
        if (data[el.dataset.field] !== undefined) { el.value = data[el.dataset.field]; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
}
