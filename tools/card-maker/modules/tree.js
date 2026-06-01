// kikkua · 制卡工具 — 章节树数据结构

import { state } from './constants.js';
import { nbMeta } from './data.js';

export function getChOrder() { return nbMeta()._order; }

export function getSortedChildKeys(node, parentPath) {
    const chOrder = getChOrder();
    const key = parentPath || '';
    if (!chOrder[key]) chOrder[key] = [];
    const order = chOrder[key];
    const keys = [...Object.keys(node.children)];
    for (const k of keys) {
        if (!order.includes(k)) order.push(k);
    }
    keys.sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return ia - ib;
    });
    return keys;
}

export function buildChapterTree(notes) {
    const root = { children: {}, notes: [], fullPath: '' };
    for (const n of notes) {
        const cp = (n.chapter || '').trim();
        if (!cp) { root.notes.push(n); continue; }
        const parts = cp.split('::').map(p => p.trim()).filter(Boolean);
        if (!parts.length) { root.notes.push(n); continue; }
        let cur = root; let acc = '';
        for (const p of parts) {
            acc = acc ? acc + '::' + p : p;
            if (!cur.children[p]) cur.children[p] = { children: {}, notes: [], fullPath: acc, name: p, isEmpty: true };
            cur = cur.children[p];
        }
        cur.notes.push(n);
        cur.isEmpty = false;
    }
    const emptyChapters = nbMeta()._chapters;
    for (const ecp of emptyChapters) {
        const parts = ecp.split('::').map(p => p.trim()).filter(Boolean);
        if (!parts.length) continue;
        let cur = root; let acc = '';
        for (const p of parts) {
            acc = acc ? acc + '::' + p : p;
            if (!cur.children[p]) cur.children[p] = { children: {}, notes: [], fullPath: acc, name: p, isEmpty: true };
            cur = cur.children[p];
        }
    }
    return root;
}

export function sortTree(node, parentPath) {
    const keys = getSortedChildKeys(node, parentPath);
    const sorted = {};
    for (const k of keys) sorted[k] = sortTree(node.children[k], node.children[k].fullPath);
    node.children = sorted;
    return node;
}

export function countTreeNotes(node) {
    let c = node.notes.length;
    for (const k of Object.keys(node.children)) c += countTreeNotes(node.children[k]);
    return c;
}
