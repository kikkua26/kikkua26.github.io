// kikkua · 题库编辑器 — 单元格选择、填充手柄、粘贴

import { OPT_LETTERS, FILL_COLS, PASTE_COL_ORDER } from './constants.js';
import { addRow, getHiddenOptCols } from './table.js';

let activeTd = null;
let selection = [];
let filling = false, fillCol = null, fillStartRow = -1;

function getTdFromInput(el) { return el ? el.closest('td[data-col]') : null; }
function getColName(td) { return td ? td.dataset.col : null; }
function getRowIndex(td) { return td ? td.parentElement.rowIndex : -1; }
function getInputValue(td) { const i = td.querySelector('input, textarea, select'); return i ? i.value : ''; }
function setInputValue(td, v) {
    const i = td.querySelector('input, textarea, select');
    if (i) { i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }
}

export function clearSelection() {
    selection.forEach(t => t.classList.remove('selected', 'fill-range', 'active-cell', 'fill-col'));
    selection = []; activeTd = null;
}

export function getActiveTd() { return activeTd; }

function setActiveCell(td) {
    clearSelection();
    if (!td) return;
    activeTd = td; td.classList.add('active-cell'); selection = [td];
    if (FILL_COLS.includes(td.dataset.col)) td.classList.add('fill-col');
}

export function initSelection() {
    // Track active cell on focus
    document.addEventListener('focusin', e => {
        const td = getTdFromInput(e.target);
        if (td && td.dataset.col !== 'idx' && td.dataset.col !== 'actions') setActiveCell(td);
    });

    // Clear selection on outside click
    document.addEventListener('mousedown', e => {
        if (!e.target.closest('table') && !e.target.closest('.modal-mask')) clearSelection();
    });

    // Shift+click range selection
    document.addEventListener('click', e => {
        const td = e.target.closest('td[data-col]');
        if (!td || td.dataset.col === 'idx' || td.dataset.col === 'actions') return;
        if (e.shiftKey && activeTd && getColName(td) === getColName(activeTd)) {
            clearSelection();
            const col = getColName(td);
            const lo = Math.min(getRowIndex(activeTd), getRowIndex(td));
            const hi = Math.max(getRowIndex(activeTd), getRowIndex(td));
            document.querySelectorAll('td[data-col="'+col+'"]').forEach(c => {
                const ri = c.parentElement.rowIndex;
                if (ri >= lo && ri <= hi) { c.classList.add('selected'); selection.push(c); }
            });
            activeTd.classList.add('active-cell');
        }
    });

    // Ctrl+D: fill down
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            if (selection.length < 2) return;
            const sorted = [...selection].sort((a, b) => getRowIndex(a) - getRowIndex(b));
            const sv = getInputValue(sorted[0]);
            for (let i = 1; i < sorted.length; i++) setInputValue(sorted[i], sv);
        }
    });

    // Fill handle drag
    document.addEventListener('mousedown', e => {
        if (filling) return;
        const td = e.target.closest('td[data-col]');
        if (!td || !FILL_COLS.includes(td.dataset.col)) return;
        const r = td.getBoundingClientRect();
        if (e.clientX < r.right - 14 || e.clientY < r.bottom - 14) return;
        e.preventDefault();
        filling = true;
        fillCol = td.dataset.col;
        fillStartRow = getRowIndex(td);
    });

    document.addEventListener('mousemove', e => {
        if (!filling) return;
        const td = e.target.closest('td[data-col="' + fillCol + '"]');
        document.querySelectorAll('td[data-col="' + fillCol + '"].fill-range').forEach(c => c.classList.remove('fill-range'));
        if (!td) return;
        const endRow = getRowIndex(td);
        const lo = Math.min(fillStartRow, endRow);
        const hi = Math.max(fillStartRow, endRow);
        document.querySelectorAll('td[data-col="' + fillCol + '"]').forEach(c => {
            const ri = c.parentElement.rowIndex;
            if (ri >= lo && ri <= hi) c.classList.add('fill-range');
        });
    });

    document.addEventListener('mouseup', () => {
        if (!filling) return;
        filling = false;
        const targets = document.querySelectorAll('td[data-col="' + fillCol + '"].fill-range');
        const sv = getInputValue(activeTd);
        targets.forEach(c => { if (c !== activeTd) setInputValue(c, sv); });
        targets.forEach(c => c.classList.remove('fill-range'));
    });

    // Paste handler (Excel-like multi-cell paste)
    document.getElementById('tbody').addEventListener('paste', handlePaste);
}

function getVisibleCols() {
    const visible = 7 - getHiddenOptCols();
    return PASTE_COL_ORDER.filter(c => {
        if (!c.startsWith('opt')) return true;
        return OPT_LETTERS.indexOf(c.replace('opt', '')) < visible;
    });
}

function handlePaste(e) {
    const input = e.target;
    if (!input || !input.matches('input[data-field]')) return;

    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;

    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cells = rows.map(r => r.split('\t'));

    e.preventDefault();

    const tr = input.closest('tr');
    const startTd = input.closest('td');
    const visibleCols = getVisibleCols();
    const startColIdx = visibleCols.indexOf(startTd.dataset.col);
    if (startColIdx < 0) return;

    let currentTr = tr;
    for (let r = 0; r < cells.length; r++) {
        if (!currentTr) {
            currentTr = addRow();
        }
        const inputs = {};
        currentTr.querySelectorAll('input[data-field]').forEach(el => { inputs[el.dataset.field] = el; });

        for (let c = 0; c < cells[r].length; c++) {
            const colIdx = startColIdx + c;
            if (colIdx >= visibleCols.length) break;
            const field = visibleCols[colIdx];
            if (inputs[field]) {
                inputs[field].value = cells[r][c];
                inputs[field].dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        currentTr = currentTr.nextElementSibling;
    }
}
