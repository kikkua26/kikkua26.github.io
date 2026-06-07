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
    let text = input.value.trim();
    if (!text) { import('./utils.js').then(m => m.toast('请粘贴内容', 'error')); return; }

    // Clean AI artifacts like [reference:X] and markdown code blocks
    text = text.replace(/\[reference:\d+\]/g, '');
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    let data;
    try {
        data = JSON.parse(text);
        // Accept object or array (take first item)
        if (Array.isArray(data) && data.length > 0) {
            data = data[0];
        }
        if (typeof data === 'object' && data !== null) {
            parseDataObject(data);
            hideQuickPaste();
            import('./utils.js').then(m => m.toast('已解析并填入', 'success'));
            return;
        }
        import('./utils.js').then(m => m.toast('JSON 格式错误：应为对象 {}', 'error'));
    } catch {
        import('./utils.js').then(m => m.toast('JSON 格式错误，请检查', 'error'));
    }
}

export function parseDataObject(obj) {
    const chapter = obj['章节'] || obj['chapter'] || obj['Chapter'] || '';
    const mainField = obj['主字段'] || obj['Front'] || obj['mainField'] || obj['知识名称'] || '';
    const knowledge = [];
    const extended = [];
    if (obj['知识解析']) {
        if (typeof obj['知识解析'] === 'string') parseSubfieldString(obj['知识解析']).forEach(f => knowledge.push(f));
        else if (typeof obj['知识解析'] === 'object') Object.entries(obj['知识解析']).forEach(([k, v]) => knowledge.push({ name: k, content: String(v).replace(/【【/g, '[[').replace(/】】/g, ']]') }));
    }
    if (obj['拓展解析'] || obj['知识拓展']) {
        const val = obj['拓展解析'] || obj['知识拓展'];
        if (typeof val === 'string') parseSubfieldString(val).forEach(f => extended.push(f));
        else if (typeof val === 'object') Object.entries(val).forEach(([k, v]) => extended.push({ name: k, content: String(v).replace(/【【/g, '[[').replace(/】】/g, ']]') }));
    }
    fillFormFromParsed({ chapter, mainField, knowledge, extended });
}

export function parseSubfieldString(raw) {
    if (!raw) return [];
    return raw.split(/<br>###|\n###|\n(?=[^：:\n]+[：:])/).map(s => {
        const m = s.trim().match(/^(.+?)[：:]\s*(.*)$/);
        if (m) return { name: m[1].trim(), content: m[2].trim().replace(/【【/g, '[[').replace(/】】/g, ']]') };
        return { name: '', content: s.trim().replace(/【【/g, '[[').replace(/】】/g, ']]') };
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
