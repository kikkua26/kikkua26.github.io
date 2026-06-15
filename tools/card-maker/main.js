// kikkua · 制卡工具 — 插件入口

import { registerPlugin, onParentMessage } from '../shared/sdk.js';
import { state, setRoot } from './modules/constants.js';
import { loadData, activeNotes, loadDraft } from './modules/data.js';
import { buildChapterTree } from './modules/tree.js';
import { renderAll } from './modules/render.js';
import { clearForm, setRenderAll, setUpdatePreview, setUpdateNavPos, getFormData } from './modules/form.js';
import { updatePreview } from './modules/preview.js';
import { setupEvents, updateNavPos } from './modules/events.js';
import { setPasteRenderAll, setPasteUpdatePreview } from './modules/paste.js';

// Wire forward references to avoid circular imports
setRenderAll(renderAll);
setUpdatePreview(updatePreview);
setUpdateNavPos(updateNavPos);
setPasteRenderAll(renderAll);
setPasteUpdatePreview(updatePreview);

// Inject drag-and-drop CSS
const dragCSS = document.createElement('style');
dragCSS.textContent = `.cm-subfield{transition:box-shadow .2s,opacity .2s;}.cm-subfield.cm-dragging{opacity:.4;box-shadow:0 4px 12px rgba(0,0,0,.15);}.cm-subfield.cm-drag-over{border:2px dashed var(--accent,#0d9488);}`;
document.head.appendChild(dragCSS);

// Initialize
function initCardMaker() {
    const root = document.getElementById('cardMakerRoot');
    if (!root) return;
    setRoot(root);

    loadData();
    state.expandedChapters.clear();
    // Expand all chapters that have notes
    for (const nb of Object.values(state.notebooks)) {
        for (const note of (nb.notes || [])) {
            if (note.chapter) {
                const parts = note.chapter.split('::');
                let acc = '';
                for (const p of parts) { acc = acc ? acc + '::' + p : p; state.expandedChapters.add(acc); }
            }
        }
        // Also expand manually added chapters
        for (const ch of (nb._chapters || [])) {
            const parts = ch.split('::');
            let acc = '';
            for (const p of parts) { acc = acc ? acc + '::' + p : p; state.expandedChapters.add(acc); }
        }
    }
    renderAll();

    const draft = loadDraft();
    if (draft && draft.mainField) {
        const chEl = root.querySelector('#cmInputChapter');
        const mEl = root.querySelector('#cmInputMain');
        if (chEl) chEl.value = draft.chapter || '';
        if (mEl) mEl.value = draft.mainField || '';
    }

    setupEvents();
    state.initialized = true;
}

// Register as plugin
registerPlugin({
    id: 'card-maker',
    name: '卡片制作器',
    icon: '📇',
    desc: '制卡工具，支持 CSV 导入导出、AI 解析、拖拽排序',
    version: '2.3',
});

// Init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCardMaker);
} else {
    initCardMaker();
}
