// kikkua · 制卡工具 — 事件绑定

import { state, rootEl, $ } from './constants.js';
import { activeNotes, nbMeta, flushData, saveDraft, loadDraft, clearDraft } from './data.js';
import { genId } from './utils.js';
import { buildChapterTree } from './tree.js';
import { renderAll } from './render.js';
import { clearForm, loadForm, getFormData, addSubfield, removeSubfield, autoSaveForm, wrapCloze } from './form.js';
import { updatePreview } from './preview.js';
import { showQuickPaste, hideQuickPaste, applyQuickPaste } from './paste.js';
import { aiParse, copyPrompt, showSettings, hideSettings, saveSettings, testConnection, showBatchModal, hideBatchModal, copyBatchPrompt, batchAIParse, applyBatchImport } from './ai.js';
import { showApkgModal, hideApkgModal, handleApkgUpload, handleApkgExport } from './apkg.js';
import { importCSV, exportCSV } from './csv.js';
import { exportJSON, exportMarkdownZip } from './export-json-md.js';
import { toast } from './utils.js';

export function setupEvents() {
    // Click delegation
    rootEl.addEventListener('click', e => {
        const row = e.target.closest('[data-action]');
        if (!row) return;
        const action = row.dataset.action;

        if (action === 'chapter-click') {
            const path = row.dataset.path;
            rootEl.querySelector('#cmInputChapter').value = path;
            rootEl.querySelector('#cmInputMain').value = '';
            rootEl.querySelector('#cmKnowledgeFields').innerHTML = '';
            rootEl.querySelector('#cmExtendedFields').innerHTML = '';
            addSubfield('knowledge', true);
            addSubfield('extended', true);
            rootEl.querySelector('#cmBtnDelete').style.display = 'none';
            state.currentNoteId = null;
            state.batchMode = false; state.batchSet.clear();
            rootEl.querySelector('#cmBtnBatch').style.display = 'none';
            clearDraft();
            rootEl.querySelector('#cmInputMain').focus();
            renderAll();
            setTimeout(updatePreview, 30);
        } else if (action === 'note-click') {
            if (e.target.matches('input[type=checkbox]')) return;
            const notes = activeNotes();
            const note = notes.find(n => n.id === row.dataset.noteId);
            if (note) {
                loadForm(note);
                rootEl.querySelector('#cmContentScroll').scrollTop = 0;
                requestAnimationFrame(() => { requestAnimationFrame(() => updatePreview()); });
            }
        } else if (action === 'chapter-toggle') {
            const path = row.dataset.path;
            state.expandedChapters.has(path) ? state.expandedChapters.delete(path) : state.expandedChapters.add(path);
            renderAll();
        } else if (action === 'tag-click') {
            rootEl.querySelector('#cmInputChapter').value = row.dataset.path;
            rootEl.querySelector('#cmInputMain').focus();
            renderAll();
        } else if (action === 'remove-subfield') {
            removeSubfield(e.target);
        } else if (action === 'batch-check') {
            const nid = row.dataset.noteId;
            state.batchSet.has(nid) ? state.batchSet.delete(nid) : state.batchSet.add(nid);
        } else if (action === 'add-knowledge') {
            addSubfield('knowledge', false);
        } else if (action === 'add-extended') {
            addSubfield('extended', false);
        } else if (action === 'wrap-cloze') {
            const textarea = e.target.closest('.cm-subfield')?.querySelector('.cm-sf-content');
            wrapCloze(textarea);
        } else if (action === 'cm-quick-paste') {
            showQuickPaste();
        }
    });

    const on = (id, event, fn) => {
        const el = rootEl.querySelector(id);
        if (el) el.addEventListener(event, fn);
    };

    // Buttons
    on('#cmBtnSave', 'click', saveNote);
    on('#cmBtnClear', 'click', () => {
        if (state.currentNoteId && !confirm('正在编辑笔记，清空表单将放弃当前修改。确定清空吗？')) return;
        clearForm(false);
    });
    on('#cmBtnDelete', 'click', deleteNote);
    on('#cmBtnNew', 'click', () => { clearForm(false); rootEl.querySelector('#cmInputMain')?.focus(); });

    on('#cmBtnNewNb', 'click', () => {
        const name = prompt('新笔记本名称：', '笔记本_' + new Date().toLocaleDateString('zh-CN'));
        if (!name || !name.trim()) return;
        const tn = name.trim();
        if (state.notebooks[tn]) { toast('该笔记本已存在', 'error'); return; }
        state.notebooks[tn] = [];
        state.activeNotebook = tn;
        flushData();
        clearForm(false);
        renderAll();
    });

    on('#cmBtnExport', 'click', () => {
        const modal = rootEl.querySelector('#cmExportModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    });
    on('#cmBtnImport', 'click', () => rootEl.querySelector('#cmFileInput')?.click());
    on('#cmFileInput', 'change', function () {
        if (this.files[0]) { importCSV(this.files[0], renderAll); this.value = ''; }
    });

    on('#cmBtnBatch', 'click', deleteBatch);

    // Notebook selector
    on('#cmNotebook', 'change', function () {
        const name = this.value;
        if (name && state.notebooks[name]) {
            const fd = getFormData();
            if (fd.mainField || fd.chapter) saveDraft(fd);
            state.activeNotebook = name;
            state.currentNoteId = null;
            clearDraft();
            renderAll();
            const draft = loadDraft();
            if (draft && draft.mainField) {
                const chEl = rootEl.querySelector('#cmInputChapter');
                const mEl = rootEl.querySelector('#cmInputMain');
                if (chEl) chEl.value = draft.chapter || '';
                if (mEl) mEl.value = draft.mainField || '';
            } else {
                clearForm(false);
            }
            toast('已切换: ' + name, 'success');
        }
    });

    // Search
    on('#cmSearch', 'input', function () {
        state.searchQuery = this.value.trim();
        renderAll();
    });

    // Chapter input
    on('#cmInputChapter', 'input', () => { renderAll(); autoSaveForm(); });
    on('#cmInputChapter', 'blur', () => { renderAll(); });

    // Form change → auto-save
    const formEls = rootEl.querySelectorAll('#cmInputChapter, #cmInputMain');
    formEls.forEach(el => el.addEventListener('input', () => {
        autoSaveForm();
    }));

    // Level radio change → auto-save + preview
    rootEl.querySelectorAll('input[name="cmLevel"]').forEach(r => r.addEventListener('change', () => {
        autoSaveForm();
        setTimeout(updatePreview, 30);
    }));

    // Keyboard
    rootEl.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNote(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); clearForm(false); rootEl.querySelector('#cmInputMain')?.focus(); }
        if ((e.ctrlKey || e.metaKey) && e.key === '[') {
            const ta = e.target.closest('.cm-sf-content');
            if (ta) { e.preventDefault(); wrapCloze(ta); }
        }
    });

    // Auto-preview and auto-save on form input (debounced)
    let previewTimer;
    rootEl.addEventListener('input', e => {
        if (e.target.closest('#cmInputChapter, #cmInputMain, .cm-sf-name, .cm-sf-content')) {
            clearTimeout(previewTimer);
            previewTimer = setTimeout(updatePreview, 300);
            autoSaveForm();
        }
    });
    rootEl.addEventListener('blur', e => {
        if (e.target.closest('#cmInputChapter, #cmInputMain, .cm-sf-name, .cm-sf-content')) {
            clearTimeout(previewTimer);
            updatePreview();
        }
    }, true);

    // Quick paste modal
    on('#cmPasteCancel', 'click', hideQuickPaste);
    on('#cmPasteApply', 'click', applyQuickPaste);
    on('#cmAiParse', 'click', aiParse);
    on('#cmCopyPrompt', 'click', copyPrompt);
    rootEl.querySelector('#cmPasteModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) hideQuickPaste(); });
    rootEl.querySelector('#cmBatchDirModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) { const m = rootEl.querySelector('#cmBatchDirModal'); if (m) m.style.display = 'none'; } });

    // AI Settings modal
    on('#cmBtnSettings', 'click', showSettings);
    on('#cmSettingsClose', 'click', hideSettings);
    on('#cmSettingsCancel', 'click', hideSettings);
    on('#cmSettingsSave', 'click', saveSettings);
    on('#cmTestBtn', 'click', testConnection);
    on('#cmToggleKey', 'click', () => {
        const input = rootEl.querySelector('#cmSettingsKey');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
    rootEl.querySelector('#cmSettingsModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) hideSettings();
    });

    // AI Batch modal
    on('#cmBtnBatchImport', 'click', showBatchModal);
    on('#cmBatchCancel', 'click', hideBatchModal);
    on('#cmBatchCopyPrompt', 'click', copyBatchPrompt);
    on('#cmBatchAIParse', 'click', batchAIParse);
    on('#cmBatchApply', 'click', applyBatchImport);
    rootEl.querySelector('#cmBatchModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) hideBatchModal();
    });

    // APKG Export modal
    on('#cmBtnApkg', 'click', () => {
        showApkgModal();
        // Update notebook info
        const nbEl = rootEl.querySelector('#cmApkgNotebook');
        const countEl = rootEl.querySelector('#cmApkgNoteCount');
        if (nbEl) nbEl.textContent = state.activeNotebook;
        if (countEl) countEl.textContent = (state.notebooks[state.activeNotebook]?.notes || []).length;
    });
    on('#cmApkgClose', 'click', hideApkgModal);
    on('#cmApkgCancel', 'click', hideApkgModal);
    on('#cmApkgUpload', 'click', handleApkgUpload);
    on('#cmApkgExport', 'click', handleApkgExport);
    rootEl.querySelector('#cmApkgModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) hideApkgModal();
    });

    // Provider card selection
    rootEl.querySelector('#cmSettingsModal')?.addEventListener('click', e => {
        const card = e.target.closest('[data-provider]');
        if (card) {
            const modal = rootEl.querySelector('#cmSettingsModal');
            modal.querySelectorAll('[data-provider]').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            // Update model options
            const provider = card.dataset.provider;
            const config = { deepseek: { models: ['deepseek-v4-flash', 'deepseek-v4-pro'], defaultModel: 'deepseek-v4-flash' }, mimo: { models: ['mimo-v2.5-pro'], defaultModel: 'mimo-v2.5-pro' } };
            const modelSelect = modal.querySelector('#cmSettingsModel');
            if (modelSelect && config[provider]) {
                modelSelect.innerHTML = config[provider].models.map(m => `<option value="${m}">${m}</option>`).join('');
            }
            const keyInput = modal.querySelector('#cmSettingsKey');
            if (keyInput) keyInput.placeholder = provider === 'mimo' ? '小米 MiMo Key (tp-...)' : 'DeepSeek Key (sk-...)';
        }
    });

    // Drag-and-drop subfield reorder
    let dragSrc = null;
    rootEl.addEventListener('dragstart', e => {
        const sf = e.target.closest('.cm-subfield');
        if (!sf) return;
        dragSrc = sf;
        sf.classList.add('cm-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    });
    rootEl.addEventListener('dragover', e => {
        const sf = e.target.closest('.cm-subfield');
        if (!sf || !dragSrc || sf === dragSrc) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        sf.classList.add('cm-drag-over');
    });
    rootEl.addEventListener('dragleave', e => {
        const sf = e.target.closest('.cm-subfield');
        if (sf) sf.classList.remove('cm-drag-over');
    });
    rootEl.addEventListener('drop', e => {
        const sf = e.target.closest('.cm-subfield');
        if (sf) sf.classList.remove('cm-drag-over');
        if (!sf || !dragSrc || sf === dragSrc) return;
        e.preventDefault();
        const container = sf.parentElement;
        const siblings = [...container.querySelectorAll('.cm-subfield')];
        const srcIdx = siblings.indexOf(dragSrc);
        const dstIdx = siblings.indexOf(sf);
        if (srcIdx < dstIdx) container.insertBefore(dragSrc, sf.nextSibling);
        else container.insertBefore(dragSrc, sf);
        dragSrc.classList.remove('cm-dragging');
        dragSrc = null;
    });
    rootEl.addEventListener('dragend', e => {
        const sf = e.target.closest('.cm-subfield');
        if (sf) sf.classList.remove('cm-dragging');
        rootEl.querySelectorAll('.cm-drag-over').forEach(el => el.classList.remove('cm-drag-over'));
        dragSrc = null;
    });

    // Tree drag-and-drop (chapters and notes)
    let treeDragSrc = null;
    let treeDragType = null; // 'chapter' or 'note'

    rootEl.addEventListener('dragstart', e => {
        const chapter = e.target.closest('.cm-chapter[draggable]');
        const note = e.target.closest('.cm-note[draggable]');
        if (chapter) {
            treeDragSrc = chapter;
            treeDragType = 'chapter';
            chapter.classList.add('cm-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', chapter.dataset.path);
        } else if (note) {
            treeDragSrc = note;
            treeDragType = 'note';
            note.classList.add('cm-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', note.dataset.noteId);
        }
    });

    rootEl.addEventListener('dragover', e => {
        const chapter = e.target.closest('.cm-chapter[draggable]');
        const note = e.target.closest('.cm-note[draggable]');
        const target = chapter || note;
        if (!target || !treeDragSrc || target === treeDragSrc) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        target.classList.add('cm-drag-over');
    });

    rootEl.addEventListener('dragleave', e => {
        const chapter = e.target.closest('.cm-chapter[draggable]');
        const note = e.target.closest('.cm-note[draggable]');
        const target = chapter || note;
        if (target) target.classList.remove('cm-drag-over');
    });

    rootEl.addEventListener('drop', e => {
        const chapter = e.target.closest('.cm-chapter[draggable]');
        const note = e.target.closest('.cm-note[draggable]');
        const target = chapter || note;
        if (target) target.classList.remove('cm-drag-over');
        if (!target || !treeDragSrc || target === treeDragSrc) return;
        e.preventDefault();

        const nb = state.notebooks[state.activeNotebook];
        const notes = nb.notes || [];

        if (treeDragType === 'note' && note) {
            // Reorder notes within the same chapter or move to different chapter
            const srcId = treeDragSrc.dataset.noteId;
            const dstId = note.dataset.noteId;
            const srcIdx = notes.findIndex(n => n.id === srcId);
            const dstIdx = notes.findIndex(n => n.id === dstId);
            if (srcIdx >= 0 && dstIdx >= 0) {
                const [moved] = notes.splice(srcIdx, 1);
                notes.splice(dstIdx, 0, moved);
                flushData();
                renderAll();
            }
        } else if (treeDragType === 'chapter' && chapter) {
            // Reorder chapters and their notes
            const srcPath = treeDragSrc.dataset.path;
            const dstPath = chapter.dataset.path;
            if (!nb._order) nb._order = {};
            const srcParent = srcPath.includes('::') ? srcPath.split('::').slice(0, -1).join('::') : '';
            const dstParent = dstPath.includes('::') ? dstPath.split('::').slice(0, -1).join('::') : '';

            if (srcParent === dstParent) {
                // Update chapter order
                const key = srcParent || '';
                if (!nb._order[key]) nb._order[key] = [];
                const order = nb._order[key];
                const srcName = srcPath.split('::').pop();
                const dstName = dstPath.split('::').pop();
                const srcOrderIdx = order.indexOf(srcName);
                const dstOrderIdx = order.indexOf(dstName);

                if (srcOrderIdx >= 0 && dstOrderIdx >= 0) {
                    order.splice(srcOrderIdx, 1);
                    order.splice(dstOrderIdx, 0, srcName);

                    // Also reorder notes: move all notes under srcPath to dstPath position
                    // Find notes belonging to source chapter (including sub-chapters)
                    const srcNotes = notes.filter(n =>
                        n.chapter === srcPath || n.chapter?.startsWith(srcPath + '::')
                    );
                    // Find insertion point: notes under destination chapter
                    const dstFirstNoteIdx = notes.findIndex(n =>
                        n.chapter === dstPath || n.chapter?.startsWith(dstPath + '::')
                    );

                    if (srcNotes.length > 0 && dstFirstNoteIdx >= 0) {
                        // Remove source notes from array
                        const remaining = notes.filter(n =>
                            n.chapter !== srcPath && !n.chapter?.startsWith(srcPath + '::')
                        );
                        // Find where to insert (before or after destination based on drag direction)
                        const insertIdx = remaining.indexOf(notes[dstFirstNoteIdx]);
                        if (srcOrderIdx < dstOrderIdx) {
                            // Moving down: insert after destination notes
                            const dstLastNoteIdx = remaining.findLastIndex(n =>
                                n.chapter === dstPath || n.chapter?.startsWith(dstPath + '::')
                            );
                            remaining.splice(dstLastNoteIdx + 1, 0, ...srcNotes);
                        } else {
                            // Moving up: insert before destination notes
                            remaining.splice(insertIdx, 0, ...srcNotes);
                        }
                        nb.notes = remaining;
                    }

                    flushData();
                    renderAll();
                }
            }
        }
    });

    rootEl.addEventListener('dragend', e => {
        if (treeDragSrc) {
            treeDragSrc.classList.remove('cm-dragging');
            treeDragSrc = null;
            treeDragType = null;
        }
        rootEl.querySelectorAll('.cm-drag-over').forEach(el => el.classList.remove('cm-drag-over'));
    });

    // Context menu
    setupContextMenu();

    // Batch directory import
       on('#cmBtnAddRoot', 'click', () => {
        const modal = rootEl.querySelector('#cmBatchDirModal');
        const input = rootEl.querySelector('#cmBatchDirInput');
        if (modal && input) { modal.classList.remove('hidden'); modal.style.display = 'flex'; input.value = ''; input.focus(); }
    });

    on('#cmBatchDirCancel', 'click', () => { const m = rootEl.querySelector('#cmBatchDirModal'); if (m) { m.style.display = 'none'; m.classList.add('hidden'); } });
    on('#cmBatchDirApply', 'click', () => {
        const input = rootEl.querySelector('#cmBatchDirInput');
        if (!input || !input.value.trim()) return;
        const lines = input.value.split(/[\n\r]+/);
        const nb = state.notebooks[state.activeNotebook];
        if (!nb._chapters) nb._chapters = [];
        if (!nb._order) nb._order = {};
        if (!nb._order['']) nb._order[''] = [];
        const stack = [];
        let addedChapters = 0;
        let addedNotes = 0;
        let currentChapter = '';
        let currentNote = null;
        let currentSection = 'knowledge'; // 'knowledge' or 'extended'

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) { currentNote = null; currentSection = 'knowledge'; continue; }

            // Chapter line: # xxx
            const chapterMatch = line.match(/^(#{1,9})\s+(.+)/);
            if (chapterMatch) {
                currentNote = null;
                const depth = chapterMatch[1].length;
                const name = chapterMatch[2].trim();
                while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
                const parentPath = stack.length > 0 ? stack[stack.length - 1].path : '';
                const fullPath = parentPath ? parentPath + '::' + name : name;
                if (!nb._chapters.includes(fullPath)) { nb._chapters.push(fullPath); addedChapters++; }
                const orderKey = parentPath || '';
                if (!nb._order[orderKey]) nb._order[orderKey] = [];
                if (!nb._order[orderKey].includes(name)) nb._order[orderKey].push(name);
                stack.push({ depth, path: fullPath });
                currentChapter = fullPath;
                state.expandedChapters.add(fullPath);
                continue;
            }

            // Note line: - xxx
            const noteMatch = rawLine.match(/^[-*]\s+(.+)/);
            if (noteMatch) {
                const noteName = noteMatch[1].trim();
                if (!noteName) continue;
                currentNote = {
                    id: genId(),
                    mainField: noteName,
                    chapter: currentChapter,
                    knowledgeAnalysis: '',
                    extendedAnalysis: '',
                };
                if (!nb.notes) nb.notes = [];
                nb.notes.push(currentNote);
                addedNotes++;
                currentSection = 'knowledge';
                continue;
            }

            // Section markers
            if (currentNote) {
                if (/^知识解析[：:]?\s*$/.test(line)) { currentSection = 'knowledge'; continue; }
                if (/^拓展解析[：:]?\s*$/.test(line) || /^知识拓展[：:]?\s*$/.test(line)) { currentSection = 'extended'; continue; }

                // Field line: xxx：xxx or xxx:xxx
                const fieldMatch = line.match(/^(.+?)[：:]\s*(.*)$/);
                if (fieldMatch) {
                    const key = fieldMatch[1].trim();
                    const val = fieldMatch[2].trim();
                    if (!val) continue;
                    const entry = key + '::' + val;
                    if (currentSection === 'extended') {
                        currentNote.extendedAnalysis = currentNote.extendedAnalysis
                            ? currentNote.extendedAnalysis + '<br>###' + entry
                            : entry;
                    } else {
                        currentNote.knowledgeAnalysis = currentNote.knowledgeAnalysis
                            ? currentNote.knowledgeAnalysis + '<br>###' + entry
                            : entry;
                    }
                }
            }
        }
        flushData(); renderAll();
        const m = rootEl.querySelector('#cmBatchDirModal'); if (m) { m.style.display = 'none'; m.classList.add('hidden'); }
        const parts = [];
        if (addedChapters > 0) parts.push(`${addedChapters} 个目录`);
        if (addedNotes > 0) parts.push(`${addedNotes} 条笔记`);
        toast(`已导入 ${parts.join('、')}`, 'success');
    });

    // Export modal
    on('#cmExportCsv', 'click', () => {
        hideExportModal();
        exportCSV(renderAll);
    });
    on('#cmExportJson', 'click', () => {
        hideExportModal();
        exportJSON();
    });
    on('#cmExportMd', 'click', () => {
        hideExportModal();
        exportMarkdownZip();
    });
    on('#cmExportCancel', 'click', hideExportModal);
    rootEl.querySelector('#cmExportModal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) hideExportModal();
    });

    // Listen for quick-paste message from parent admin
    window.addEventListener('message', e => {
        if (e.data?.source === 'kikkua-admin' && e.data?.type === 'quick-paste') {
            showQuickPaste();
        }
    });

    // Batch toggle
    on('#cmBtnToggleBatch', 'click', () => {
        state.batchMode = !state.batchMode;
        state.batchSet.clear();
        const batchBtn = rootEl.querySelector('#cmBtnBatch');
        const toggleBtn = rootEl.querySelector('#cmBtnToggleBatch');
        if (batchBtn) batchBtn.style.display = state.batchMode ? 'inline-flex' : 'none';
        if (toggleBtn) toggleBtn.textContent = state.batchMode ? '☑ 取消批量' : '☑ 批量';
        renderAll();
    });
}

function saveNote() {
    const fd = getFormData();
    if (!fd.mainField && !fd.chapter) { toast('请至少填写知识名称或章节路径', 'error'); return; }
    const notes = activeNotes();
    if (state.currentNoteId) {
        const idx = notes.findIndex(n => n.id === state.currentNoteId);
        if (idx >= 0) {
            notes[idx] = { ...notes[idx], ...fd };
            toast('笔记已更新', 'success');
        } else {
            state.currentNoteId = null;
            notes.push({ id: genId(), ...fd });
        }
    } else {
        const nn = { id: genId(), ...fd };
        notes.push(nn);
        state.currentNoteId = nn.id;
        toast('笔记已保存', 'success');
    }
    flushData();
    clearDraft();
    rootEl.querySelector('#cmBtnDelete').style.display = 'inline-flex';
    renderAll();
    setTimeout(updatePreview, 30);
}

function deleteNote() {
    if (!state.currentNoteId) return;
    if (!confirm('确定要删除这条笔记吗？此操作不可恢复。')) return;
    const notes = activeNotes();
    const idx = notes.findIndex(n => n.id === state.currentNoteId);
    if (idx >= 0) { notes.splice(idx, 1); flushData(); toast('笔记已删除', 'success'); }
    clearForm(false);
}

function deleteBatch() {
    if (!state.batchSet.size) return;
    if (!confirm(`确定删除 ${state.batchSet.size} 条笔记吗？此操作不可恢复。`)) return;
    const notes = activeNotes();
    nbMeta().notes = notes.filter(n => !state.batchSet.has(n.id));
    flushData();
    state.batchSet.clear();
    state.batchMode = false;
    rootEl.querySelector('#cmBtnBatch').style.display = 'none';
    toast('已删除选中笔记', 'success');
    renderAll();
}

function hideExportModal() {
    const modal = rootEl.querySelector('#cmExportModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
}

function setupContextMenu() {
    const chapterMenu = rootEl.querySelector('#cmChapterMenu');
    let ctxChapterPath = '';

    function hideChapterMenu() { if (chapterMenu) { chapterMenu.style.display = 'none'; chapterMenu.classList.add('hidden'); } }
    document.addEventListener('click', e => {
        if (!e.target.closest('#cmChapterMenu')) hideChapterMenu();
    });

    rootEl.addEventListener('contextmenu', e => {
        const chapRow = e.target.closest('.cm-chapter');
        const noteRow = e.target.closest('.cm-note');
        const treeArea = e.target.closest('#cmTree');
        if (!chapterMenu || !treeArea) return;
        e.preventDefault();
        hideChapterMenu();

        const menuItems = [];
        if (noteRow) {
            const noteId = noteRow.dataset.noteId;
            menuItems.push({ label: '🗑 删除笔记', action: 'delNote', noteId });
            menuItems.push({ label: '⬆ 上移', action: 'noteUp', noteId });
            menuItems.push({ label: '⬇ 下移', action: 'noteDown', noteId });
            menuItems.push({ label: '📂 移动到...', action: 'noteMove', noteId });
        } else if (chapRow) {
            ctxChapterPath = chapRow.dataset.path;
            menuItems.push({ label: '📝 在此目录下新建笔记', action: 'addNote' });
            menuItems.push({ label: '📂 新建子目录', action: 'addSub' });
            menuItems.push({ label: '✏️ 重命名', action: 'rename' });
            menuItems.push({ label: '⬆ 上移', action: 'moveUp' });
            menuItems.push({ label: '⬇ 下移', action: 'moveDown' });
            menuItems.push({ label: '🗑 删除目录', action: 'delete', danger: true });
        } else {
            ctxChapterPath = '';
            menuItems.push({ label: '📂 新建根目录', action: 'addRoot' });
        }
        // Always show expand/collapse all
        menuItems.push({ divider: true });
        menuItems.push({ label: '🔽 全部展开', action: 'expandAll' });
        menuItems.push({ label: '🔼 全部收起', action: 'collapseAll' });

        chapterMenu.innerHTML = menuItems.map((m, i) => {
            if (m.divider) return '<div class="cm-ctx-divider"></div>';
            const noteIdAttr = m.noteId ? ` data-note-id="${m.noteId}"` : '';
            if (i > 0 && m.danger && !menuItems[i-1].danger) return `<div class="cm-ctx-divider"></div><div class="cm-ctx-item${m.danger?' cm-ctx-danger':''}" data-cm-action="${m.action}"${noteIdAttr}>${m.label}</div>`;
            return `<div class="cm-ctx-item${m.danger?' cm-ctx-danger':''}" data-cm-action="${m.action}"${noteIdAttr}>${m.label}</div>`;
        }).join('');

        chapterMenu.classList.remove('hidden');
        chapterMenu.style.display = 'block';
        chapterMenu.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
        chapterMenu.style.top = Math.min(e.clientY, window.innerHeight - 220) + 'px';
    });

    chapterMenu?.addEventListener('click', e => {
        const item = e.target.closest('.cm-ctx-item');
        if (!item) return;
        const action = item.dataset.cmAction;
        const nb = state.notebooks[state.activeNotebook];
        if (!nb._chapters) nb._chapters = [];
        if (!nb._order) nb._order = {};

        if (action === 'delNote') {
            const notes = activeNotes();
            const idx = notes.findIndex(n => n.id === item.dataset.noteId);
            if (idx >= 0 && confirm(`删除笔记 "${notes[idx].mainField || '(未命名)'}"？`)) {
                notes.splice(idx, 1); flushData(); renderAll();
                if (state.currentNoteId === item.dataset.noteId) clearForm(false);
            }
        } else if (action === 'noteUp' || action === 'noteDown') {
            const notes = activeNotes();
            const idx = notes.findIndex(n => n.id === item.dataset.noteId);
            if (idx < 0) { hideChapterMenu(); return; }
            const note = notes[idx];
            const sameChapter = notes.filter(n => n.chapter === note.chapter);
            const ci = sameChapter.indexOf(note);
            const newCi = action === 'noteUp' ? Math.max(0, ci - 1) : Math.min(sameChapter.length - 1, ci + 1);
            if (ci !== newCi) {
                const globalIdxA = notes.indexOf(sameChapter[ci]);
                const globalIdxB = notes.indexOf(sameChapter[newCi]);
                [notes[globalIdxA], notes[globalIdxB]] = [notes[globalIdxB], notes[globalIdxA]];
                flushData(); renderAll();
            }
        } else if (action === 'noteMove') {
            const newChapter = prompt('移动到章节（留空移到根目录）：', '');
            const notes = activeNotes();
            const note = notes.find(n => n.id === item.dataset.noteId);
            if (note) { note.chapter = (newChapter || '').trim(); flushData(); renderAll(); }
        } else if (action === 'addNote') {
            hideChapterMenu();
            rootEl.querySelector('#cmInputChapter').value = ctxChapterPath;
            rootEl.querySelector('#cmInputMain').value = '';
            rootEl.querySelector('#cmKnowledgeFields').innerHTML = '';
            rootEl.querySelector('#cmExtendedFields').innerHTML = '';
            addSubfield('knowledge', true); addSubfield('extended', true);
            rootEl.querySelector('#cmBtnDelete').style.display = 'none';
            state.currentNoteId = null; clearDraft();
            rootEl.querySelector('#cmInputMain').focus();
            renderAll(); setTimeout(updatePreview, 30);
        } else if (action === 'addRoot') {
            const name = prompt('根目录名称：', '');
            if (!name || !name.trim()) { hideChapterMenu(); return; }
            const p = name.trim();
            if (!nb._chapters.includes(p)) { nb._chapters.push(p); }
            if (!nb._order['']) nb._order[''] = [];
            if (!nb._order[''].includes(p)) nb._order[''].push(p);
            state.expandedChapters.add(p);
            flushData(); renderAll();
        } else if (action === 'addSub') {
            const name = prompt('子目录名称：', '');
            if (!name || !name.trim()) { hideChapterMenu(); return; }
            const p = ctxChapterPath + '::' + name.trim();
            if (!nb._chapters.includes(p)) { nb._chapters.push(p); }
            if (!nb._order[ctxChapterPath]) nb._order[ctxChapterPath] = [];
            if (!nb._order[ctxChapterPath].includes(name.trim())) nb._order[ctxChapterPath].push(name.trim());
            state.expandedChapters.add(p);
            state.expandedChapters.add(ctxChapterPath);
            flushData(); renderAll();
        } else if (action === 'rename') {
            const oldName = ctxChapterPath.split('::').pop();
            const parentPath = ctxChapterPath.split('::').slice(0, -1).join('::');
            const newPath = prompt('重命名路径（可修改任意部分，如 aa::bb::cc）：', ctxChapterPath);
            if (!newPath || newPath.trim() === ctxChapterPath) { hideChapterMenu(); return; }
            const trimmed = newPath.trim();
            nb._chapters = nb._chapters.map(c => c === ctxChapterPath ? trimmed : (c.startsWith(ctxChapterPath + '::') ? trimmed + c.slice(ctxChapterPath.length) : c));
            if (nb._order[parentPath]) {
                nb._order[parentPath] = nb._order[parentPath].filter(k => k !== oldName);
            }
            const newParentPath = trimmed.split('::').slice(0, -1).join('::');
            const newName = trimmed.split('::').pop();
            if (!nb._order[newParentPath]) nb._order[newParentPath] = [];
            if (!nb._order[newParentPath].includes(newName)) nb._order[newParentPath].push(newName);
            if (nb._order[ctxChapterPath]) { nb._order[trimmed] = nb._order[ctxChapterPath]; delete nb._order[ctxChapterPath]; }
            // auto-expand new parent path
            let acc = '';
            for (const p of trimmed.split('::')) { acc = acc ? acc + '::' + p : p; state.expandedChapters.add(acc); }
            const notes = activeNotes();
            for (const n of notes) {
                if (n.chapter === ctxChapterPath) n.chapter = trimmed;
                else if (n.chapter?.startsWith(ctxChapterPath + '::')) n.chapter = trimmed + n.chapter.slice(ctxChapterPath.length);
            }
            flushData(); renderAll();
        } else if (action === 'moveUp' || action === 'moveDown') {
            const oldName = ctxChapterPath.split('::').pop();
            const parentPath = ctxChapterPath.split('::').slice(0, -1).join('::');
            const key = parentPath || '';
            if (!nb._order[key]) nb._order[key] = [...Object.keys(buildChapterTree(activeNotes()).children)];
            const arr = nb._order[key];
            const idx = arr.indexOf(oldName);
            if (idx < 0) { arr.push(oldName); renderAll(); }
            const newIdx = action === 'moveUp' ? Math.max(0, idx - 1) : Math.min(arr.length - 1, idx + 1);
            if (newIdx !== idx) { arr.splice(idx, 1); arr.splice(newIdx, 0, oldName); }
            flushData(); renderAll();
        } else if (action === 'delete') {
            const notes = activeNotes();
            const notesUnder = notes.filter(n => n.chapter === ctxChapterPath || n.chapter?.startsWith(ctxChapterPath + '::'));
            const warn = notesUnder.length ? `（将同时删除该目录下的 ${notesUnder.length} 条笔记）` : '';
            if (!confirm(`删除目录 "${ctxChapterPath}" 及其子目录？${warn}`)) { hideChapterMenu(); return; }
            nb._chapters = nb._chapters.filter(c => c !== ctxChapterPath && !c.startsWith(ctxChapterPath + '::'));
            nbMeta().notes = notes.filter(n => n.chapter !== ctxChapterPath && !n.chapter?.startsWith(ctxChapterPath + '::'));
            flushData(); renderAll();
        } else if (action === 'expandAll') {
            state.expandedChapters.clear();
            for (const nb2 of Object.values(state.notebooks)) {
                for (const note of (nb2.notes || [])) {
                    if (note.chapter) {
                        const parts = note.chapter.split('::');
                        let acc = '';
                        for (const p of parts) { acc = acc ? acc + '::' + p : p; state.expandedChapters.add(acc); }
                    }
                }
                for (const ch of (nb2._chapters || [])) {
                    const parts = ch.split('::');
                    let acc = '';
                    for (const p of parts) { acc = acc ? acc + '::' + p : p; state.expandedChapters.add(acc); }
                }
            }
            renderAll();
        } else if (action === 'collapseAll') {
            state.expandedChapters.clear();
            renderAll();
        }
        hideChapterMenu();
    });
}
