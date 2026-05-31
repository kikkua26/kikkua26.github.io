// kikkua · 制卡工具 — 入口
// 纯本地工具，数据存储在 localStorage，不与 GitHub 交互

import { state, setRoot } from './constants.js';
import { loadData, activeNotes, loadDraft } from './data.js';
import { buildChapterTree } from './tree.js';
import { renderAll } from './render.js';
import { clearForm, setRenderAll, setUpdatePreview, getFormData, saveDraft } from './form.js';
import { updatePreview } from './preview.js';
import { setupEvents } from './events.js';
import { setPasteRenderAll, setPasteUpdatePreview } from './paste.js';

// Inject critical drag-and-drop styles
(function injectStyles() {
    if (document.getElementById('cm-drag-styles')) return;
    const s = document.createElement('style');
    s.id = 'cm-drag-styles';
    s.textContent = `.cm-sf-drag{flex-shrink:0;cursor:grab;color:#c5cad3;font-size:12px;letter-spacing:2px;user-select:none;padding:2px 4px;align-self:stretch;display:flex;align-items:center}.cm-sf-drag:active{cursor:grabbing}.cm-subfield.cm-dragging{opacity:.4}.cm-subfield.cm-drag-over{border-color:var(--accent,#0d9488)!important;border-style:dashed!important}`;
    document.head.appendChild(s);
})();

// Wire forward references to break circular deps
setRenderAll(renderAll);
setUpdatePreview(updatePreview);
setPasteRenderAll(renderAll);
setPasteUpdatePreview(updatePreview);

export function initCardMaker(containerEl) {
    setRoot(containerEl);
    if (state.initialized) { renderAll(); return; }

    loadData();
    setupEvents();
    state.initialized = true;

    // Restore saved API key + model
    const savedKey = localStorage.getItem('kikkua_ds_key');
    if (savedKey) { const el = containerEl.querySelector('#cmDsKey'); if (el) el.value = savedKey; }
    const savedModel = localStorage.getItem('kikkua_ds_model');
    if (savedModel) { const el = containerEl.querySelector('#cmDsModel'); if (el) el.value = savedModel; }

    clearForm(false);

    // Expand ALL chapters recursively on first load
    const notes = activeNotes();
    if (notes.length && state.expandedChapters.size === 0) {
        const tree = buildChapterTree(notes);
        (function expandAll(node) {
            for (const k of Object.keys(node.children)) {
                const child = node.children[k];
                state.expandedChapters.add(child.fullPath);
                expandAll(child);
            }
        })(tree);
    }
    renderAll();
    setTimeout(updatePreview, 100);

    // Restore draft if any
    const draft = loadDraft();
    if (draft && draft.mainField) {
        containerEl.querySelector('#cmInputChapter').value = draft.chapter || '';
        containerEl.querySelector('#cmInputMain').value = draft.mainField || '';
    }
}

export function destroyCardMaker() {
    const fd = getFormData();
    saveDraft(fd);
}
