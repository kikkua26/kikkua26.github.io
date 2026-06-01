// kikkua · 标签编辑器 — 插件入口

import { registerPlugin, apiRequest, esc } from '../shared/sdk.js';

const $ = s => document.querySelector(s);

// State
let tagTree = [];

// ═══════════════════════════════════════
// GitHub API via parent proxy
// ═══════════════════════════════════════

async function readTags() {
    const resp = await apiRequest('data/tags.json');
    if (!resp.ok) {
        if (resp.status === 404) return [];
        throw new Error(resp.error || `HTTP ${resp.status}`);
    }
    return JSON.parse(atob(resp.data.content));
}

async function writeTags() {
    const content = btoa(JSON.stringify(tagTree, null, 2));
    // Need current SHA for update
    const readResp = await apiRequest('data/tags.json');
    const sha = readResp.ok ? readResp.data.sha : null;
    const body = { message: 'Update tags', content };
    if (sha) body.sha = sha;
    const resp = await apiRequest('data/tags.json', { method: 'PUT', body });
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
}

// ═══════════════════════════════════════
// UI Utilities
// ═══════════════════════════════════════

function toast(msg, type) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || '') + ' show';
    setTimeout(() => el.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════
// Tag Tree Operations
// ═══════════════════════════════════════

function findTagNode(nodes, path) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].path === path) return { parent: nodes, idx: i, node: nodes[i] };
        if (nodes[i].children) { const f = findTagNode(nodes[i].children, path); if (f) return f; }
    }
    return null;
}

function walkTagNodes(nodes, depth) {
    if (!nodes || !nodes.length) return '<div class="empty-msg">暂无标签，点击上方按钮添加</div>';
    return '<div style="margin-left:' + (depth > 0 ? '24' : 0) + 'px">' + nodes.map(n =>
        `<div class="tag-row" data-tag-path="${esc(n.path)}">
            <span class="tag-name" style="font-weight:${depth === 0 ? '600' : '400'};">${esc(n.path.split('::').pop())}</span>
            <input class="tag-desc-input" placeholder="描述" value="${esc(n.desc || '')}" data-tag-desc="${esc(n.path)}">
            <div class="tag-menu-wrap">
                <button class="btn btn-secondary btn-xs tag-menu-btn">···</button>
                <div class="tag-menu">
                    <span class="tag-menu-item" data-tag-rename="${esc(n.path)}">✏️ 重命名</span>
                    <span class="tag-menu-item" data-tag-addsub="${esc(n.path)}">+ 子标签</span>
                    <span class="tag-menu-item danger" data-tag-del="${esc(n.path)}">✕ 删除</span>
                </div>
            </div>
        </div>` + (n.children ? walkTagNodes(n.children, depth + 1) : '')
    ).join('') + '</div>';
}

function renderTagTree() {
    const el = $('#tagTreeContainer');
    if (!el) return;
    el.innerHTML = '<div class="tag-tree-panel">' + walkTagNodes(tagTree, 0) + '</div>';
}

// ═══════════════════════════════════════
// Tag Actions
// ═══════════════════════════════════════

function renameTagDesc(path, val) {
    const f = findTagNode(tagTree, path);
    if (f) f.node.desc = val;
}

function renameTag(path) {
    const f = findTagNode(tagTree, path);
    if (!f) return;
    const oldName = f.node.path.split('::').pop();
    const newName = prompt('新名称：', oldName);
    if (!newName || newName === oldName) return;
    const parentPath = path.includes('::') ? path.split('::').slice(0, -1).join('::') : '';
    const newPath = parentPath ? parentPath + '::' + newName : newName;
    // Update path and all children
    function updatePaths(node, oldBase, newBase) {
        node.path = node.path.replace(oldBase, newBase);
        if (node.children) node.children.forEach(c => updatePaths(c, oldBase, newBase));
    }
    updatePaths(f.node, f.node.path, newPath);
    renderTagTree();
}

function addRootTag() {
    const name = prompt('根标签名称：');
    if (!name) return;
    tagTree.push({ path: name, desc: '', children: [] });
    renderTagTree();
}

function addSubTag(path) {
    const f = findTagNode(tagTree, path);
    if (!f) return;
    const name = prompt('子标签名称：');
    if (!name) return;
    f.node.children.push({ path: f.node.path + '::' + name, desc: '', children: [] });
    renderTagTree();
}

function delTagNode(path) {
    const f = findTagNode(tagTree, path);
    if (!f) return;
    if (!confirm('删除 "' + f.node.path.split('::').pop() + '" 及其子标签？')) return;
    f.parent.splice(f.idx, 1);
    renderTagTree();
}

// ═══════════════════════════════════════
// Actions
// ═══════════════════════════════════════

async function saveTags() {
    const btn = $('[data-action="save-tags"]');
    try {
        if (btn) { btn.textContent = '⏳ 保存中…'; btn.disabled = true; }
        await writeTags();
        toast('✅ 标签已保存');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
    finally { if (btn) { btn.textContent = '💾 保存标签'; btn.disabled = false; } }
}

// ═══════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════

function setupEvents() {
    // Click delegation
    document.addEventListener('click', e => {
        const action = e.target.closest('[data-action]');
        if (action) {
            const act = action.dataset.action;
            if (act === 'add-root-tag') addRootTag();
            else if (act === 'save-tags') saveTags();
            return;
        }

        const tagRename = e.target.closest('[data-tag-rename]');
        if (tagRename) { renameTag(tagRename.dataset.tagRename); return; }

        const tagAddsub = e.target.closest('[data-tag-addsub]');
        if (tagAddsub) { addSubTag(tagAddsub.dataset.tagAddsub); return; }

        const tagDel = e.target.closest('[data-tag-del]');
        if (tagDel) { delTagNode(tagDel.dataset.tagDel); return; }
    });

    // Tag description change
    document.addEventListener('change', e => {
        const tagDesc = e.target.closest('[data-tag-desc]');
        if (tagDesc) { renameTagDesc(tagDesc.dataset.tagDesc, tagDesc.value); }
    });

    // Tag menu hover
    document.addEventListener('mouseover', e => {
        const wrap = e.target.closest('.tag-menu-wrap');
        if (wrap) {
            const menu = wrap.querySelector('.tag-menu');
            if (menu) menu.style.display = 'flex';
        }
    });
    document.addEventListener('mouseout', e => {
        const wrap = e.target.closest('.tag-menu-wrap');
        if (wrap) {
            const menu = wrap.querySelector('.tag-menu');
            if (menu) menu.style.display = 'none';
        }
    });
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════

async function init() {
    registerPlugin({
        id: 'tag-editor',
        name: '标签编辑器',
        icon: '🏷',
        desc: '管理标签树结构，支持重命名、添加子标签、删除',
        version: '1.0',
    });

    setupEvents();

    try {
        toast('加载中…');
        tagTree = await readTags();
        renderTagTree();
        toast('加载完成');
    } catch (e) {
        toast('加载失败: ' + e.message, 'error');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
