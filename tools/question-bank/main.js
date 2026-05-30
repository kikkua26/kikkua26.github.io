// kikkua · 题库编辑器 — 入口
// 表格化题库管理，支持 CSV/Excel 导入导出、AI 生成、APKG 牌组导出

import { registerPlugin } from '../shared/sdk.js';
import { bindAllEvents } from './modules/events.js';

registerPlugin({ id: 'question-bank', name: '题库编辑器', icon: '📋', desc: '表格化题库管理，支持CSV/Excel导入导出、AI生成题目', version: '2.0.0' });
import { setOptCols, addRow, renumber, ensureEmptyRows, onRenumber } from './modules/table.js';
import { initSelection } from './modules/selection.js';
import { initContextMenu } from './modules/context-menu.js';
import { loadFromCache, saveToCache } from './modules/cache.js';

// Hook: renumber also saves cache
onRenumber(saveToCache);

// Initialize
setOptCols(document.getElementById('optCount').value);
bindAllEvents();
initSelection();
initContextMenu();

if (!loadFromCache()) {
    for (let i = 0; i < 20; i++) addRow();
}
ensureEmptyRows();
renumber();
