// kikkua · 题库编辑器 — 类型系统：锁定、验证、高亮

import { OPT_LETTERS, VALID_TYPES, TYPE_LOCK_MAP } from './constants.js';
import { esc } from './utils.js';

// 当前隐藏的选项列数（由 table.js 的 setOptCols 同步）
let _hiddenOptCols = 0;

export function setHiddenOptCols(n) { _hiddenOptCols = n; }
export function getHiddenOptCols() { return _hiddenOptCols; }

export function buildTypeSelect(val) {
    let html = '<select data-field="type">';
    html += '<option value="">—</option>';
    VALID_TYPES.forEach(t => { html += `<option value="${t}"${val===t?' selected':''}>${t}</option>`; });
    if (val && !VALID_TYPES.includes(val)) html += `<option value="${esc(val)}" selected>${esc(val)}</option>`;
    html += '</select>';
    return html;
}

export function getLockedFields(type) {
    return TYPE_LOCK_MAP[type] || [];
}

export function applyTypeLock(tr) {
    const typeEl = tr.querySelector('[data-field="type"]');
    const type = typeEl ? typeEl.value : '';
    const locks = getLockedFields(type);
    tr.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'type') return;
        const locked = locks.includes(field);
        el.disabled = locked;
        const td = el.closest('td');
        td.classList.toggle('locked', locked);
        if (locked) el.value = '';
        const btn = td.querySelector('.preview-btn');
        if (btn) btn.style.display = locked ? 'none' : '';
    });
    // Warning badge for non-standard types
    const td = typeEl.closest('td');
    let warn = td.querySelector('.type-warn');
    if (type && !VALID_TYPES.includes(type)) {
        if (!warn) { warn = document.createElement('span'); warn.className = 'type-warn'; warn.textContent = '!'; td.appendChild(warn); }
    } else if (warn) { warn.remove(); }
    applyAnswerHighlight(tr);
}

export function applyAnswerHighlight(tr) {
    const answerEl = tr.querySelector('[data-field="answer"]');
    if (!answerEl) return;
    const letters = (answerEl.value || '').toUpperCase().replace(/[^A-G]/g, '');
    OPT_LETTERS.forEach(o => {
        const optTd = tr.querySelector(`[data-col="opt${o}"]`);
        if (optTd) optTd.classList.toggle('answer-hit', letters.includes(o));
    });
    validateAnswer(tr);
}

export function validateAnswer(tr) {
    const typeEl = tr.querySelector('[data-field="type"]');
    const answerEl = tr.querySelector('[data-field="answer"]');
    if (!answerEl) return;
    const type = typeEl ? typeEl.value : '';
    const val = (answerEl.value || '').trim();
    const td = answerEl.closest('td');
    let hint = td.querySelector('.ans-hint');

    if (hint) hint.remove();
    td.removeAttribute('data-valid');

    if (!type || !val || getLockedFields(type).includes('answer')) return;

    const msg = validateAnswerForType(type, val);
    if (msg) {
        td.setAttribute('data-valid', 'no');
        hint = document.createElement('span');
        hint.className = 'ans-hint';
        hint.textContent = msg;
        td.appendChild(hint);
    } else {
        td.setAttribute('data-valid', 'ok');
    }
}

// Unified answer validation (used by both table and form)
export function validateAnswerForType(type, val) {
    if (!type || !val) return '';
    const maxOpt = 7 - _hiddenOptCols;
    const maxLetter = OPT_LETTERS[maxOpt - 1];
    const letters = val.toUpperCase().split('').filter(c => c >= 'A' && c <= maxLetter);
    const validLetters = letters.join('') === val.toUpperCase() && letters.length > 0;

    if (type === '单选题') {
        if (val.length !== 1 || !validLetters) return `需 1 个字母 (A-${maxLetter})`;
    } else if (type === '多选题') {
        if (!validLetters || letters.length < 2) return `需 2+ 个字母 (A-${maxLetter})`;
    } else if (type === '判断题') {
        if (!['正确', '错误'].includes(val)) return '需填「正确」或「错误」';
    }
    return '';
}

export function applyFormTypeLock() {
    const grid = document.getElementById('formGrid');
    const typeEl = grid.querySelector('[data-field="type"]');
    const type = typeEl ? typeEl.value : '';
    const locks = getLockedFields(type);
    grid.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'type') return;
        const row = el.closest('.form-row');
        const locked = locks.includes(field);
        if (locked) { row.style.display = 'none'; }
        else { row.style.display = ''; el.disabled = false; }
    });
    validateFormAnswer();
}

export function validateFormAnswer() {
    const grid = document.getElementById('formGrid');
    const typeEl = grid.querySelector('[data-field="type"]');
    const answerEl = grid.querySelector('[data-field="answer"]');
    if (!answerEl) return;
    const type = typeEl ? typeEl.value : '';
    const val = (answerEl.value || '').trim();
    const row = answerEl.closest('.form-row');
    let hint = row.querySelector('.ans-hint');
    if (hint) hint.remove();
    row.removeAttribute('data-valid');
    if (!type || !val || getLockedFields(type).includes('answer')) return;

    const msg = validateAnswerForType(type, val);
    if (msg) {
        row.setAttribute('data-valid', 'no');
        hint = document.createElement('div');
        hint.className = 'ans-hint';
        hint.textContent = msg;
        row.appendChild(hint);
    } else {
        row.setAttribute('data-valid', 'ok');
    }
}
