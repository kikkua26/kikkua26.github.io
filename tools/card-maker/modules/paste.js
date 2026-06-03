// kikkua · 制卡工具 — 快速粘贴解析

import { state, rootEl } from './constants.js';
import { addSubfield } from './form.js';

// Forward references
let _renderAll = () => {};
let _updatePreview = () => {};
export function setPasteRenderAll(fn) { _renderAll = fn; }
export function setPasteUpdatePreview(fn) { _updatePreview = fn; }

export function showQuickPaste() {
    const modal = rootEl.querySelector('#cmPasteModal');
    const input = rootEl.querySelector('#cmPasteInput');
    if (modal && input) { modal.classList.remove('hidden'); modal.style.display = 'flex'; input.value = ''; input.focus(); }
}

export function hideQuickPaste() { const m = rootEl.querySelector('#cmPasteModal'); if (m) { m.style.display = 'none'; m.classList.add('hidden'); } }


export function applyQuickPaste() {
    const input = rootEl.querySelector('#cmPasteInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { import('./utils.js').then(m => m.toast('请粘贴内容', 'error')); return; }

    let data;
    try { data = JSON.parse(text); if (typeof data === 'object' && !Array.isArray(data)) { parseDataObject(data); hideQuickPaste(); return; } } catch {}

    const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
    let chapter = '', mainField = '';
    const knowledge = [], extended = [];
    let mode = 'top';

    for (const line of lines) {
        if (/^知识解析[：:]?\s*$/.test(line)) { mode = 'knowledge'; continue; }
        if (/^拓展解析[：:]?\s*$/.test(line) || /^知识拓展[：:]?\s*$/.test(line)) { mode = 'extended'; continue; }
        const m = line.match(/^(.+?)[：:]\s*(.*)$/);
        if (m) {
            const key = m[1].trim(), val = m[2].trim();
            if (!val) continue;
            if (/^(主字段|知识名称|Front|标题)$/.test(key)) { mainField = val; }
            else if (/^(章节|Chapter|分类)$/.test(key)) { chapter = val; }
            else if (mode === 'extended') { extended.push({ name: key, content: val }); }
            else { knowledge.push({ name: key, content: val }); }
            continue;
        }
        if (line.includes('::') && !chapter && mode === 'top') { chapter = line; continue; }
        if (mode === 'top' && !mainField && !line.includes('：') && !line.includes(':')) { mainField = line; continue; }
        if (line) knowledge.push({ name: '', content: line });
    }
    fillFormFromParsed({ chapter, mainField, knowledge, extended });
    hideQuickPaste();
    import('./utils.js').then(m => m.toast(`已填入${mainField ? '：' + mainField : ''} | ${knowledge.filter(f=>f.name||f.content).length + extended.filter(f=>f.name||f.content).length}条字段`, 'success'));
}

export function parseDataObject(obj) {
    const chapter = obj['章节'] || obj['chapter'] || obj['Chapter'] || '';
    const mainField = obj['主字段'] || obj['Front'] || obj['mainField'] || obj['知识名称'] || '';
    const knowledge = [];
    const extended = [];
    if (obj['知识解析']) {
        if (typeof obj['知识解析'] === 'string') parseSubfieldString(obj['知识解析']).forEach(f => knowledge.push(f));
        else if (typeof obj['知识解析'] === 'object') Object.entries(obj['知识解析']).forEach(([k, v]) => knowledge.push({ name: k, content: String(v) }));
    }
    if (obj['拓展解析'] || obj['知识拓展']) {
        const val = obj['拓展解析'] || obj['知识拓展'];
        if (typeof val === 'string') parseSubfieldString(val).forEach(f => extended.push(f));
        else if (typeof val === 'object') Object.entries(val).forEach(([k, v]) => extended.push({ name: k, content: String(v) }));
    }
    fillFormFromParsed({ chapter, mainField, knowledge, extended });
}

export function parseSubfieldString(raw) {
    if (!raw) return [];
    return raw.split(/<br>###|\n###|\n(?=[^：:\n]+[：:])/).map(s => {
        const m = s.trim().match(/^(.+?)[：:]\s*(.*)$/);
        return m ? { name: m[1].trim(), content: m[2].trim() } : { name: '', content: s.trim() };
    }).filter(f => f.name || f.content);
}

function fillFormFromParsed(data) {
    const chEl = rootEl.querySelector('#cmInputChapter');
    const mfEl = rootEl.querySelector('#cmInputMain');
    if (chEl) chEl.value = data.chapter || '';
    if (mfEl) mfEl.value = data.mainField || '';

    const kf = rootEl.querySelector('#cmKnowledgeFields');
    kf.innerHTML = '';
    (data.knowledge.length ? data.knowledge : [{ name: '', content: '' }]).forEach(f => addSubfield('knowledge', false, f.name, f.content));

    const ef = rootEl.querySelector('#cmExtendedFields');
    ef.innerHTML = '';
    (data.extended.length ? data.extended : [{ name: '', content: '' }]).forEach(f => addSubfield('extended', false, f.name, f.content));

    if (data.mainField || data.chapter) {
        state.currentNoteId = null;
        rootEl.querySelector('#cmBtnDelete').style.display = 'none';
    }
    _renderAll();
    setTimeout(_updatePreview, 60);
}
