// kikkua · 题库编辑器 — 富文本预览/编辑模态框

import { sanitizeHtml } from './utils.js';
import { FIELD_LABELS } from './constants.js';

let previewTarget = null;

export function openPreviewModal(btn) {
    const td = btn.closest('td');
    const input = td.querySelector('[data-field]');
    if (!input) return;
    previewTarget = input;
    document.getElementById('previewTitle').textContent = FIELD_LABELS[input.dataset.field] || '编辑';
    const editor = document.getElementById('previewEditor');
    editor.innerHTML = input.value || '';
    document.getElementById('previewCode').textContent = input.value || '';
    document.getElementById('previewModal').classList.add('show');
    editor.focus();
}

export function closePreviewModal() {
    document.getElementById('previewModal').classList.remove('show');
    previewTarget = null;
}

export function savePreviewModal() {
    if (previewTarget) {
        const filtered = sanitizeHtml(document.getElementById('previewEditor').innerHTML);
        previewTarget.value = filtered;
        previewTarget.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closePreviewModal();
}

export function clearEditor() {
    const editor = document.getElementById('previewEditor');
    editor.innerHTML = '';
    editor.focus();
    syncPreview();
}

export function wrapCloze() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const editor = document.getElementById('previewEditor');
    if (!editor.contains(range.commonAncestorContainer)) return;
    const text = sel.toString();
    if (text) {
        range.deleteContents();
        range.insertNode(document.createTextNode('[[' + text + ']]'));
    } else {
        range.insertNode(document.createTextNode('[[]]'));
        range.setStart(range.endContainer, range.endOffset - 2);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

export function syncPreview() {
    const editor = document.getElementById('previewEditor');
    const filtered = sanitizeHtml(editor.innerHTML);
    document.getElementById('previewCode').textContent = filtered;
}
