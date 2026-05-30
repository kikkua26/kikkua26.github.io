// kikkua · 题库编辑器 — 行编辑表单模态框

import { OPT_LETTERS, FORM_FIELDS } from './constants.js';
import { esc } from './utils.js';
import { buildTypeSelect, applyTypeLock, applyFormTypeLock, validateFormAnswer } from './type-system.js';
import { getTbody, getRowData, setRowData, getHiddenOptCols } from './table.js';

let editingTr = null;

export function getEditingTr() { return editingTr; }

export function openForm(tr) {
    editingTr = tr;
    const tbody = getTbody();
    const rows = Array.from(tbody.rows);
    const idx = rows.indexOf(tr);
    document.getElementById('formBadge').textContent = '#' + (idx + 1);
    document.getElementById('formPrev').disabled = idx <= 0;
    document.getElementById('formNext').disabled = idx >= rows.length - 1;

    const data = getRowData(tr);
    renderFormFields(data);

    document.getElementById('rowFormModal').classList.add('show');
    const first = document.getElementById('formGrid').querySelector('input, textarea');
    if (first) first.focus();
}

function renderFormFields(data) {
    const body = document.getElementById('formGrid');
    body.innerHTML = '';
    const hiddenOptCols = getHiddenOptCols();
    FORM_FIELDS.forEach(f => {
        const oi = OPT_LETTERS.indexOf(f.key.replace('opt',''));
        if (f.key.startsWith('opt') && oi >= (7 - hiddenOptCols)) return;
        const val = (data || {})[f.key] || '';
        let input;
        if (f.key === 'type') {
            input = buildTypeSelect(val);
        } else {
            const isTextarea = f.type === 'textarea';
            input = isTextarea
                ? `<textarea data-field="${f.key}" rows="1">${esc(val)}</textarea>`
                : `<input type="text" data-field="${f.key}" value="${esc(val)}">`;
        }
        body.innerHTML += `<div class="form-row"><span class="form-label">${f.label}</span>${input}</div>`;
    });
    applyFormTypeLock();
}

export function closeForm() {
    document.getElementById('rowFormModal').classList.remove('show');
    editingTr = null;
}

function collectVisibleFormData(grid) {
    const data = {};
    grid.querySelectorAll('[data-field]').forEach(el => {
        const row = el.closest('.form-row');
        if (row && row.style.display === 'none') return;
        data[el.dataset.field] = el.value;
    });
    return data;
}

export function navForm(dir) {
    if (!editingTr) return;
    const grid = document.getElementById('formGrid');
    setRowData(editingTr, collectVisibleFormData(grid));

    const tbody = getTbody();
    const rows = Array.from(tbody.rows);
    const idx = rows.indexOf(editingTr);
    const next = rows[idx + dir];
    if (next) openForm(next);
}

export function saveForm() {
    if (!editingTr) return;
    const grid = document.getElementById('formGrid');
    setRowData(editingTr, collectVisibleFormData(grid));
    applyTypeLock(editingTr);
    closeForm();
}

export function refreshFormIfOpen() {
    if (editingTr) renderFormFields(getRowData(editingTr));
}
