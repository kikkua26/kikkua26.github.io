// kikkua · Tree data structure helpers
// Pure data functions, no DOM dependencies

import { DEFAULTS } from './config.js';

export function findNodeByPath(nodes, path) {
    for (const n of nodes) {
        if (n.path === path) return n;
        if (n.children.length) { const f = findNodeByPath(n.children, path); if (f) return f; }
    }
    return null;
}

export function findNodeByIndex(nodes, index) {
    for (const n of nodes) {
        if (n.indices && n.indices.includes(index)) return n;
        if (n.children.length) { const f = findNodeByIndex(n.children, index); if (f) return f; }
    }
    return null;
}

export function findFirstLeaf(nodes) {
    for (const n of nodes) {
        if (n.indices && n.indices.length) return n;
        if (n.children.length) { const f = findFirstLeaf(n.children); if (f) return f; }
    }
    return null;
}

export function expandToPath(nodes, path) {
    const parts = path.split('::');
    for (let i = 1; i < parts.length; i++) {
        const p = findNodeByPath(nodes, parts.slice(0, i).join('::'));
        if (p) p.collapsed = false;
    }
}

export function buildDirectory(records, chapterField) {
    const field = chapterField || DEFAULTS.chapterField;
    const group = new Map();
    records.forEach((r, i) => {
        const ch = r[field] || '';
        if (!group.has(ch)) group.set(ch, []);
        group.get(ch).push(i);
    });

    function inject(nodes, parts, indices, parentPath = '') {
        const [head, ...rest] = parts;
        const fullPath = parentPath ? parentPath + '::' + head : head;
        let node = nodes.find(n => n.name === head);
        if (!node) {
            node = { name: head, path: fullPath, children: [], collapsed: true };
            nodes.push(node);
        }
        if (rest.length === 0) node.indices = indices;
        else inject(node.children, rest, indices, fullPath);
    }

    const tree = [];
    for (const [path, indices] of group) {
        const parts = path.split('::').map(s => s.trim()).filter(Boolean);
        if (parts.length) inject(tree, parts, indices);
    }

    (function tally(nodes) {
        for (const n of nodes) {
            if (n.children.length) { tally(n.children); n.totalCount = n.children.reduce((s, c) => s + (c.totalCount || (c.indices ? c.indices.length : 0)), 0); }
            else n.totalCount = n.indices ? n.indices.length : 0;
        }
    })(tree);

    return tree;
}
