// kikkua · 题库编辑器 — 统一事件绑定

import { CACHE_KEY } from './constants.js';
import { setOptCols, addRow, addRows, delRow, renumber, ensureEmptyRows, getRowData, getTbody } from './table.js';
import { applyTypeLock, applyAnswerHighlight, applyFormTypeLock, validateFormAnswer } from './type-system.js';
import { openPreviewModal, closePreviewModal, savePreviewModal, clearEditor, wrapCloze, syncPreview } from './rich-editor.js';
import { openForm, closeForm, saveForm, navForm, getEditingTr, refreshFormIfOpen } from './form.js';
import { clearSelection } from './selection.js';
import { hideCtx, showBtnCtx } from './context-menu.js';
import { exportStandardCSV, exportKikkuaCSV, exportXLSX, downloadTemplate } from './export-csv.js';
import { handleFileImport, doTextImport } from './import.js';
import { openAIModal, closeAIModal, toggleAIConfig, selectAIType, selectAIMode, selectAnalysisStyle, copyPrompt, generateAI } from './ai.js';
import { openApkgModal, closeApkgModal, parseApkg, exportApkg } from './apkg.js';
import { saveToCache } from './cache.js';

// Make functions available globally for inline onclick handlers in HTML
// (preview modal toolbar buttons use onclick attributes)
window.showPreview = openPreviewModal;
window.closePreviewModal = closePreviewModal;
window.savePreviewModal = savePreviewModal;
window.clearEditor = clearEditor;
window.wrapCloze = wrapCloze;

export function bindAllEvents() {
    const tbody = getTbody();

    // ── Column resize ──
    document.addEventListener('mousedown', e => {
        if (!e.target.classList.contains('resizer')) return;
        const th = e.target.parentElement;
        const colIdx = Array.from(th.parentElement.children).indexOf(th);
        const colEl = document.querySelectorAll('colgroup col')[colIdx];
        if (!colEl) return;
        const startX = e.pageX;
        const startW = colEl.offsetWidth;
        e.target.classList.add('active');
        const onMove = ev => { colEl.style.width = Math.max(30, startW + ev.pageX - startX) + 'px'; };
        const onUp = () => { e.target.classList.remove('active'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    // ── Toolbar ──
    document.getElementById('optCount').addEventListener('change', function() {
        setOptCols(this.value);
        refreshFormIfOpen();
    });
    document.getElementById('btnAddRow').addEventListener('click', () => addRow());
    document.getElementById('btnAddRow').addEventListener('contextmenu', e => {
        showBtnCtx(e, [{ label: '批量添加', cb: 'addRows' }]);
    });
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('btnImport').addEventListener('contextmenu', e => {
        showBtnCtx(e, [{ label: '下载模板', cb: 'downloadTemplate' }]);
    });
    document.getElementById('btnExport').addEventListener('click', () => document.getElementById('exportModal').classList.add('show'));
    document.getElementById('btnAI').addEventListener('click', openAIModal);
    document.getElementById('btnApkg').addEventListener('click', openApkgModal);
    document.getElementById('btnClear').addEventListener('click', () => {
        if (confirm('确定清空全部数据？')) { tbody.innerHTML = ''; renumber(); localStorage.removeItem(CACHE_KEY); ensureEmptyRows(); }
    });

    // ── File import ──
    document.getElementById('fileInput').addEventListener('change', handleFileImport);

    // ── Export modal ──
    document.getElementById('btnCancelExport').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
    document.getElementById('btnDoExport').addEventListener('click', () => {
        const fmt = document.querySelector('input[name="exportFmt"]:checked').value;
        document.getElementById('exportModal').classList.remove('show');
        if (fmt === 'kikkua') exportKikkuaCSV();
        else if (fmt === 'xlsx') exportXLSX();
        else exportStandardCSV();
    });

    // ── Text import modal ──
    document.getElementById('btnCancelTextImport').addEventListener('click', () => document.getElementById('textImportModal').classList.remove('show'));
    document.getElementById('btnDoTextImport').addEventListener('click', doTextImport);

    // ── Row form modal ──
    document.getElementById('btnCancelForm').addEventListener('click', closeForm);
    document.getElementById('btnCancelForm2').addEventListener('click', closeForm);
    document.getElementById('btnSaveForm').addEventListener('click', saveForm);
    document.getElementById('formGrid').addEventListener('change', e => {
        if (e.target.matches('[data-field="type"]')) applyFormTypeLock();
    });
    document.getElementById('formGrid').addEventListener('input', e => {
        if (e.target.matches('[data-field="answer"]')) validateFormAnswer();
    });
    document.getElementById('formPrev').addEventListener('click', () => navForm(-1));
    document.getElementById('formNext').addEventListener('click', () => navForm(1));
    document.getElementById('rowFormModal').addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); closeForm(); }
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); saveForm(); }
    });

    // ── AI modal ──
    document.getElementById('btnCancelAI').addEventListener('click', closeAIModal);
    document.getElementById('btnCopyPrompt').addEventListener('click', copyPrompt);
    document.getElementById('btnGenerateAI').addEventListener('click', generateAI);
    document.getElementById('aiConfigToggle').addEventListener('click', toggleAIConfig);
    document.getElementById('aiTypeChips').addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (chip) selectAIType(chip);
    });
    document.getElementById('aiModeChips').addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (chip) selectAIMode(chip);
    });
    document.getElementById('aiAnalysisChips').addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (chip) selectAnalysisStyle(chip);
    });

    // ── APKG modal ──
    document.getElementById('btnCancelApkg').addEventListener('click', closeApkgModal);
    document.getElementById('btnDoApkg').addEventListener('click', exportApkg);
    document.getElementById('apkgFileInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) parseApkg(file);
    });

    // ── Modal mask click-to-close ──
    document.getElementById('aiModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAIModal(); });
    document.getElementById('apkgModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeApkgModal(); });
    document.getElementById('previewModal').addEventListener('click', e => { if (e.target === e.currentTarget) closePreviewModal(); });

    // ── Preview editor live sync ──
    document.getElementById('previewEditor').addEventListener('input', syncPreview);

    // ── Table action clicks (delete button) ──
    tbody.addEventListener('click', e => {
        const actionsTd = e.target.closest('td.actions');
        if (actionsTd) delRow(actionsTd);
    });

    // ── Button context menu: route callbacks ──
    document.getElementById('btnCtxMenu').addEventListener('click', e => {
        const item = e.target.closest('.ctx-item');
        if (!item) return;
        hideCtx();
        const cb = item.dataset.cb;
        if (cb === 'addRows') addRows();
        else if (cb === 'downloadTemplate') downloadTemplate();
    });

    // ── Auto-save on input ──
    let _ensureTimer;
    tbody.addEventListener('input', e => {
        saveToCache();
        if (e.target.matches('[data-field="answer"]')) applyAnswerHighlight(e.target.closest('tr'));
        clearTimeout(_ensureTimer);
        _ensureTimer = setTimeout(ensureEmptyRows, 300);
    });

    // ── Type change ──
    tbody.addEventListener('change', e => {
        if (e.target.matches('[data-field="type"]')) {
            applyTypeLock(e.target.closest('tr'));
            saveToCache();
        }
    });
}
