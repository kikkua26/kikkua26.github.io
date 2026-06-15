// kikkua · 制卡工具 — 表单管理

import { state, rootEl, $ } from './constants.js';
import { clearDraft, parseSubfields, serializeSubfields, flushData } from './data.js';
import { esc } from './utils.js';

// Forward references — set by main.js to avoid circular imports
let _renderAll = () => {};
let _updatePreview = () => {};
let _updateNavPos = () => {};
export function setRenderAll(fn) { _renderAll = fn; }
export function setUpdatePreview(fn) { _updatePreview = fn; }
export function setUpdateNavPos(fn) { _updateNavPos = fn; }

// Auto-save with debounce
let autoSaveTimer = null;
export function autoSaveForm() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (!state.currentNoteId) return;
        const nb = state.notebooks[state.activeNotebook];
        if (!nb) return;
        const notes = nb.notes || [];
        const note = notes.find(n => n.id === state.currentNoteId);
        if (!note) return;

        const fd = getFormData();
        note.chapter = fd.chapter;
        note.mainField = fd.mainField;
        note.level = fd.level;
        note.knowledgeAnalysis = fd.knowledgeAnalysis;
        note.extendedAnalysis = fd.extendedAnalysis;
        flushData();
    }, 1000); // Auto-save after 1 second of inactivity
}

export function clearForm(keepChapter) {
    state.currentNoteId = null;
    state.batchMode = false;
    state.batchSet.clear();
    const ch = $('#cmInputChapter'); if (ch && !keepChapter) ch.value = '';
    const mf = $('#cmInputMain'); if (mf) mf.value = '';
    // Reset level to default (2)
    rootEl.querySelectorAll('input[name="cmLevel"]').forEach(r => r.checked = r.value === '2');
    const kf = $('#cmKnowledgeFields'); if (kf) kf.innerHTML = '';
    const ef = $('#cmExtendedFields'); if (ef) ef.innerHTML = '';
    const del = $('#cmBtnDelete'); if (del) del.style.display = 'none';
    const bat = $('#cmBtnBatch'); if (bat) bat.style.display = 'none';
    const sch = $('#cmSearch'); if (sch) sch.value = '';
    state.searchQuery = '';
    addSubfield('knowledge', true);
    addSubfield('extended', true);
    clearDraft();
    _renderAll();
    _updateNavPos();
    setTimeout(_updatePreview, 30);
}

export function loadForm(note) {
    state.currentNoteId = note.id;
    const chEl = rootEl.querySelector('#cmInputChapter');
    const mfEl = rootEl.querySelector('#cmInputMain');
    if (chEl) chEl.value = note.chapter || '';
    if (mfEl) mfEl.value = note.mainField || '';

    // Set level radio
    const level = note.level || '2';
    rootEl.querySelectorAll('input[name="cmLevel"]').forEach(r => r.checked = r.value === level);

    const kf = rootEl.querySelector('#cmKnowledgeFields');
    kf.innerHTML = '';
    const kFields = parseSubfields(note.knowledgeAnalysis);
    (kFields.length ? kFields : [{ name: '', content: '' }]).forEach(f => addSubfield('knowledge', false, f.name, f.content));

    const ef = rootEl.querySelector('#cmExtendedFields');
    ef.innerHTML = '';
    const eFields = parseSubfields(note.extendedAnalysis);
    (eFields.length ? eFields : [{ name: '', content: '' }]).forEach(f => addSubfield('extended', false, f.name, f.content));

    rootEl.querySelector('#cmBtnDelete').style.display = 'inline-flex';
    clearDraft();
    _renderAll();
    _updateNavPos();
    setTimeout(_updatePreview, 30);
}

export function getFormData() {
    const levelEl = rootEl.querySelector('input[name="cmLevel"]:checked');
    return {
        chapter: rootEl.querySelector('#cmInputChapter').value.trim(),
        mainField: rootEl.querySelector('#cmInputMain').value.trim(),
        level: levelEl ? levelEl.value : '2',
        knowledgeAnalysis: serializeSubfields(collectSubfields('knowledge')),
        extendedAnalysis: serializeSubfields(collectSubfields('extended')),
    };
}

export function collectSubfields(type) {
    const c = rootEl.querySelector(type === 'knowledge' ? '#cmKnowledgeFields' : '#cmExtendedFields');
    const fields = [];
    c.querySelectorAll('.cm-subfield').forEach(el => {
        const n = el.querySelector('.cm-sf-name')?.value?.trim() || '';
        const ct = el.querySelector('.cm-sf-content')?.value?.trim() || '';
        if (n || ct) fields.push({ name: n, content: ct });
    });
    return fields;
}

export function addSubfield(type, isInit, name, content) {
    const c = rootEl.querySelector(type === 'knowledge' ? '#cmKnowledgeFields' : '#cmExtendedFields');
    const div = document.createElement('div');
    div.className = 'cm-subfield';
    div.draggable = true;
    div.dataset.type = type;
    div.innerHTML = `<span class="cm-sf-drag" title="拖动排序">⋮⋮</span>
        <div class="cm-sf-inputs">
            <input class="cm-sf-name" placeholder="字段名称" value="${esc(name || '')}">
            <textarea class="cm-sf-content" placeholder="字段内容..." rows="2">${esc(content || '')}</textarea>
        </div>
        <button class="cm-sf-cloze" data-action="wrap-cloze" title="挖空 [[]]">[[]]</button>
        <button class="cm-sf-remove" data-action="remove-subfield" title="移除">✕</button>`;
    c.appendChild(div);
    if (!isInit && !name && !content) setTimeout(() => div.querySelector('.cm-sf-name')?.focus(), 100);
}

export function wrapCloze(textarea) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = `[[${selected || '...'}]]`;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.selectionStart = start + 2;
    textarea.selectionEnd = start + 2 + (selected || '...').length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export function removeSubfield(btn) {
    const c = btn.closest('.cm-subfield')?.parentElement;
    if (!c) return;
    if (c.querySelectorAll('.cm-subfield').length <= 1) {
        const sf = c.querySelector('.cm-subfield');
        sf.querySelector('.cm-sf-name').value = '';
        sf.querySelector('.cm-sf-content').value = '';
        import('./utils.js').then(m => m.toast('至少保留一个字段（已清空）'));
        return;
    }
    btn.closest('.cm-subfield').remove();
}
