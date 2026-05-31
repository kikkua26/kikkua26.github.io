// kikkua · 制卡工具 — 常量与状态

export const STORAGE_KEY = 'kikkua_cardmaker_data_v2';
export const DRAFT_KEY = 'kikkua_cardmaker_draft';
export const TEMPLATE_NAME = 'kikkua高级模板';

export const state = {
    notebooks: {},
    activeNotebook: '',
    currentNoteId: null,
    expandedChapters: new Set(),
    searchQuery: '',
    batchMode: false,
    batchSet: new Set(),
    initialized: false,
};

export let templateCache = null;
export function setTemplateCache(v) { templateCache = v; }

// DOM refs — set by initCardMaker
export let rootEl = null;
export let $ = () => null;
export function setRoot(el) { rootEl = el; $ = (sel) => el.querySelector(sel); }
