// kikkua · 制卡工具 — 数据持久化

import { STORAGE_KEY, DRAFT_KEY, state } from './constants.js';
import { genId, toast } from './utils.js';

export function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            state.notebooks = JSON.parse(raw);
        } else {
            const oldRaw = localStorage.getItem('kikkua_cardmaker_data_v1');
            if (oldRaw) {
                try {
                    const old = JSON.parse(oldRaw);
                    state.notebooks = {};
                    for (const k of Object.keys(old)) {
                        const val = old[k];
                        state.notebooks[k] = {
                            notes: Array.isArray(val) ? val : (Array.isArray(val?.notes) ? val.notes : []),
                            _chapters: Array.isArray(val?._chapters) ? val._chapters : [],
                            _order: (val?._order && typeof val._order === 'object' && !Array.isArray(val._order)) ? val._order : {},
                        };
                    }
                    state.activeNotebook = Object.keys(state.notebooks)[0] || '默认笔记本';
                } catch { state.notebooks = createDefaultData(); state.activeNotebook = '默认笔记本'; }
            } else {
                state.notebooks = createDefaultData();
                state.activeNotebook = '默认笔记本';
            }
        }
        for (const k of Object.keys(state.notebooks)) {
            const nb = state.notebooks[k];
            if (!nb || Array.isArray(nb)) {
                state.notebooks[k] = { notes: Array.isArray(nb) ? nb : [], _chapters: [], _order: {} };
            }
            if (!Array.isArray(state.notebooks[k].notes)) state.notebooks[k].notes = [];
            if (!Array.isArray(state.notebooks[k]._chapters)) state.notebooks[k]._chapters = [];
            if (!state.notebooks[k]._order || Array.isArray(state.notebooks[k]._order) || typeof state.notebooks[k]._order !== 'object') {
                state.notebooks[k]._order = {};
            }
        }
        if (!state.notebooks[state.activeNotebook]) {
            state.activeNotebook = Object.keys(state.notebooks)[0] || '默认笔记本';
        }
        if (!state.notebooks['默认笔记本']) {
            state.notebooks['默认笔记本'] = { notes: [], _chapters: [], _order: {} };
        }
    } catch {
        state.notebooks = createDefaultData();
        state.activeNotebook = '默认笔记本';
    }
    flushData();
}

export function createDefaultData() {
    return {
        '默认笔记本': {
            notes: [
                { id: genId(), mainField: '变量与数据类型', chapter: '编程::Python::基础',
                  knowledgeAnalysis: '定义::变量是存储数据的容器，Python支持动态类型<br>###常见类型::int、float、str、bool、list、tuple、dict、set',
                  extendedAnalysis: '类型推断::Python在运行时自动推断变量类型<br>###内存管理::变量通过引用计数进行内存管理' },
                { id: genId(), mainField: '控制流程', chapter: '编程::Python::基础',
                  knowledgeAnalysis: '条件语句::if-elif-else结构<br>###循环::for循环和while循环',
                  extendedAnalysis: '列表推导式::提供简洁的循环写法 [x for x in range(10)]' },
            ],
            _chapters: [],
            _order: {},
        },
    };
}

export function nbMeta() {
    const nb = state.notebooks[state.activeNotebook];
    if (!nb._chapters) nb._chapters = [];
    if (!nb._order) nb._order = {};
    return nb;
}

export function flushData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notebooks)); }
    catch { toast('存储空间不足，请导出数据！', 'error'); }
}

export function activeNotes() { return state.notebooks[state.activeNotebook]?.notes || []; }

export function saveDraft(formData) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); } catch {}
}
export function loadDraft() {
    try { const r = sessionStorage.getItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
}
export function clearDraft() { sessionStorage.removeItem(DRAFT_KEY); }

export function parseSubfields(raw) {
    if (!raw || !raw.trim()) return [];
    return raw.split('<br>###').map(p => {
        const idx = p.trim().indexOf('::');
        if (idx >= 0) return { name: p.substring(0, idx).trim(), content: p.substring(idx + 2).trim() };
        return { name: '', content: p.trim() };
    }).filter(f => f.name || f.content);
}

export function serializeSubfields(fields) {
    if (!fields || !fields.length) return '';
    return fields.map(f => (f.name || '') + '::' + (f.content || '')).join('<br>###');
}
