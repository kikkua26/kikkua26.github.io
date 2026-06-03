// kikkua · 制卡工具 — UI 渲染

import { state, rootEl } from './constants.js';
import { activeNotes } from './data.js';
import { buildChapterTree, sortTree, countTreeNotes } from './tree.js';
import { esc } from './utils.js';

export function renderAll() {
    const notes = activeNotes();
    let filtered = notes;
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = notes.filter(n => (n.mainField || '').toLowerCase().includes(q) || (n.chapter || '').toLowerCase().includes(q));
    }
    const tree = sortTree(buildChapterTree(filtered), '');

    const countEl = rootEl.querySelector('#cmNoteCount');
    if (countEl) countEl.textContent = filtered.length + '条笔记';

    const treeEl = rootEl.querySelector('#cmTree');
    if (!treeEl) return;
    const hasChapters = Object.keys(tree.children).length > 0;
    if (!notes.length && !hasChapters) {
        treeEl.innerHTML = '<div class="cm-empty"><div class="cm-empty-icon">📝</div><p>暂无笔记</p><p style="font-size:12px;">新建笔记或导入CSV开始使用</p></div>';
    } else {
        let html = '';
        for (let i = 0; i < tree.notes.length; i++) html += renderNoteNode(tree.notes[i], 0, (i + 1) + '.');
        const rootKeys = Object.keys(tree.children);
        for (let i = 0; i < rootKeys.length; i++) html += renderChapterNode(tree.children[rootKeys[i]], 0, '', (i + 1) + '.');
        treeEl.innerHTML = html;
    }

    renderChapterTags(notes);

    const sel = rootEl.querySelector('#cmNotebook');
    if (sel) {
        sel.innerHTML = Object.keys(state.notebooks).map(n => `<option value="${esc(n)}"${n === state.activeNotebook ? ' selected' : ''}>📓 ${esc(n)}</option>`).join('');
    }

    const status = rootEl.querySelector('#cmStatus');
    if (status) status.textContent = `📓 ${state.activeNotebook} · ${notes.length}条` + (state.currentNoteId ? ' · 编辑中' : '') + ' · v2.3';
}

export function renderChapterNode(node, depth, parentPath, numPrefix) {
    const hasKids = Object.keys(node.children).length > 0;
    const cnt = countTreeNotes(node);
    const expanded = state.expandedChapters.has(node.fullPath);
    const emptyClass = node.isEmpty && cnt === 0 ? ' cm-empty-chapter' : '';
    const sortedKeys = Object.keys(node.children);
    const myNum = numPrefix || '';
    const label = myNum ? myNum + ' ' + node.name : node.name;

    let h = `<div class="cm-chapter" data-path="${esc(node.fullPath)}" data-parent="${esc(parentPath || '')}" draggable="true">`;
    h += `<div class="cm-tree-row${emptyClass}" style="padding-left:${12 + depth * 16}px;" data-action="chapter-click" data-path="${esc(node.fullPath)}" oncontextmenu="return false;">`;
    h += `<span class="cm-toggle${hasKids ? (expanded ? ' expanded' : '') : ''}" data-action="chapter-toggle" data-path="${esc(node.fullPath)}">▶</span>`;
    h += `<span class="cm-icon">${node.isEmpty && cnt === 0 ? '📂' : '📁'}</span>`;
    h += `<span class="cm-label">${esc(label)}</span>`;
    if (cnt > 0) h += `<span class="cm-badge">${cnt}</span>`;
    h += `<span class="cm-empty-hint">${node.isEmpty && cnt === 0 ? '空' : ''}</span>`;
    h += `</div></div>`;
    h += `<div class="cm-children${expanded ? ' expanded' : ''}" data-children="${esc(node.fullPath)}">`;
    for (let i = 0; i < node.notes.length; i++) h += renderNoteNode(node.notes[i], depth + 1, numPrefix ? myNum : (i + 1) + '.');
    for (let i = 0; i < sortedKeys.length; i++) {
        const childNum = myNum ? myNum + (i + 1) + '.' : (i + 1) + '.';
        h += renderChapterNode(node.children[sortedKeys[i]], depth + 1, node.fullPath, childNum);
    }
    h += `</div>`;
    return h;
}

export function renderNoteNode(note, depth, numPrefix) {
    const active = state.currentNoteId === note.id ? ' active' : '';
    const checked = state.batchSet.has(note.id);
    const label = note.mainField || '(未命名)';
    const num = numPrefix ? numPrefix + ' ' : '';
    return `<div class="cm-note" data-note-id="${note.id}" data-chapter="${esc(note.chapter || '')}" draggable="true">
        <div class="cm-tree-row${active}" style="padding-left:${12 + depth * 16 + 20}px;" data-action="note-click" data-note-id="${note.id}" oncontextmenu="return false;">
            ${state.batchMode ? `<input type="checkbox" class="cm-check" data-action="batch-check" data-note-id="${note.id}" ${checked ? 'checked' : ''}>` : ''}
            <span class="cm-toggle" style="visibility:hidden;">▶</span>
            <span class="cm-icon">📄</span>
            <span class="cm-label">${esc(num + label)}</span>
        </div>
    </div>`;
}

export function renderChapterTags(notes) {
    const el = rootEl.querySelector('#cmChapterTags');
    if (!el) return;
    const set = new Set();
    for (const n of notes) {
        const cp = (n.chapter || '').trim();
        if (!cp) continue;
        set.add(cp);
        const parts = cp.split('::').filter(Boolean);
        let acc = '';
        for (const p of parts) { acc = acc ? acc + '::' + p : p; set.add(acc); }
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b, 'zh-CN')).slice(0, 15);
    const cur = (rootEl.querySelector('#cmInputChapter')?.value || '').trim();
    el.innerHTML = sorted.map(p => `<span class="cm-tag${p === cur ? ' active' : ''}" data-action="tag-click" data-path="${esc(p)}">${esc(p)}</span>`).join('')
        + (set.size > 15 ? `<span style="font-size:11px;color:var(--text3);">...共${set.size}个</span>` : '');
}
