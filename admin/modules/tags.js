// kikkua · admin — 标签树管理 + 标签选择器
// 修复原 admin.html 中 renderTagTree 双重定义 bug

import { readRepo, writeRepo } from './api.js';
import { toast } from './ui.js';
import { decks, renderDeckList, selectDeck } from './decks.js';

const $ = s => document.querySelector(s);
const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export let tagTree = [];
let _tagSelIdx = -1;
let _tagSelTags = [];

export async function loadTags() {
    try { const r = await readRepo('data/tags.json'); tagTree = JSON.parse(r.text); }
    catch { tagTree = []; }
}

export async function saveTags() {
    try {
        const r = await readRepo('data/tags.json');
        await writeRepo('data/tags.json', JSON.stringify(tagTree, null, 2), r.sha, 'Update tags');
        toast('✅ 标签已保存');
    } catch (e) { toast('❌ ' + e.message, 'error'); }
}

function findTagNode(nodes, path) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].path === path) return { parent: nodes, idx: i, node: nodes[i] };
        if (nodes[i].children) { const f = findTagNode(nodes[i].children, path); if (f) return f; }
    }
    return null;
}

// Unified renderTagTree: editable=true for tag editor, editable=false for checkbox selector
export function renderTagTree(editable = true) {
    if (editable) {
        const el = document.querySelector('#tagTreeContainer');
        if (!el) return;
        el.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;">' +
            walkTagNodes(tagTree, 0) + '</div>';
    } else {
        // Checkbox tree for tag selector modal
        function walk(nodes) {
            let h = '';
            for (const n of nodes) {
                const ck = _tagSelTags.includes(n.path);
                h += '<div style="padding:2px 0;padding-left:20px;">' +
                    '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;">' +
                    '<input type="checkbox" ' + (ck ? 'checked ' : '') + ' data-tag-toggle="' + esc(n.path) + '">' +
                    '<span>' + esc(n.path.split('::').pop()) + '</span>' +
                    (n.desc ? '<span style="font-size:11px;color:var(--text3);"> (' + esc(n.desc) + ')</span>' : '') +
                    '</label>' + (n.children ? walk(n.children) : '') + '</div>';
            }
            return h;
        }
        const el = document.querySelector('#tagSelectorTree');
        if (!el) return;
        el.innerHTML = tagTree.length ? walk(tagTree) : '<div style="padding:20px;text-align:center;color:var(--text3);">暂未注册标签</div>';
        document.querySelector('#tagSelectorPreview').textContent = _tagSelTags.length ? '已选：' + _tagSelTags.join('、') : '尚未选择';
    }
}

function walkTagNodes(nodes, depth) {
    if (!nodes || !nodes.length) return '<div style="padding:20px;text-align:center;color:var(--text3);">暂无标签，点击上方按钮添加</div>';
    return '<div style="margin-left:' + (depth > 0 ? '24' : '0') + 'px">' + nodes.map((n, i) =>
        '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:4px;margin:2px 0;" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'">' +
        '<span style="flex:1;font-size:14px;font-weight:' + (depth === 0 ? '600' : '400') + ';">' + esc(n.path.split('::').pop()) + '</span>' +
        '<input style="width:80px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;font-size:11px;" placeholder="描述" value="' + esc(n.desc || '') + '" data-tag-desc="' + esc(n.path) + '">' +
        '<div style="position:relative;display:inline-block;" onmouseleave="this.querySelector(\'.tagMenu\').style.display=\'none\'">' +
        '<button class="btn btn-secondary btn-xs" onmouseover="this.nextElementSibling.style.display=\'flex\'">···</button>' +
        '<div class="tagMenu" style="display:none;position:absolute;right:0;top:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:10;flex-direction:column;white-space:nowrap;padding:4px;">' +
        '<span style="padding:4px 8px;font-size:12px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'" data-tag-rename="' + esc(n.path) + '">✏️ 重命名</span>' +
        '<span style="padding:4px 8px;font-size:12px;cursor:pointer;border-radius:4px;" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'" data-tag-addsub="' + esc(n.path) + '">+ 子标签</span>' +
        '<span style="padding:4px 8px;font-size:12px;cursor:pointer;border-radius:4px;color:var(--accent);" onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'" data-tag-del="' + esc(n.path) + '">✕ 删除</span>' +
        '</div></div>' +
        '</div>' + (n.children ? walkTagNodes(n.children, depth + 1) : '')
    ).join('') + '</div>';
}

export function renameTagDesc(path, val) {
    const f = findTagNode(tagTree, path);
    if (f) f.node.desc = val;
}

export function renameTag(path) {
    const f = findTagNode(tagTree, path);
    if (!f) return;
    const newName = prompt('新名称：', f.node.path.split('::').pop());
    if (!newName || newName === f.node.path.split('::').pop()) return;
    const parentPath = path.includes('::') ? path.split('::').slice(0, -1).join('::') : '';
    f.node.path = parentPath ? parentPath + '::' + newName : newName;
    renderTagTree();
}

export function addRootTag() {
    const name = prompt('根标签名称：');
    if (!name) return;
    tagTree.push({ path: name, desc: '', children: [] });
    renderTagTree();
}

export function addSubTag(path) {
    const f = findTagNode(tagTree, path);
    if (!f) return;
    const name = prompt('子标签名称：');
    if (!name) return;
    f.node.children.push({ path: f.node.path + '::' + name, desc: '', children: [] });
    renderTagTree();
}

export function delTagNode(path) {
    const f = findTagNode(tagTree, path);
    if (!f) return;
    if (!confirm('删除 "' + f.node.path.split('::').pop() + '" 及其子标签？')) return;
    f.parent.splice(f.idx, 1);
    renderTagTree();
}

export function openTagSelector(i) {
    _tagSelIdx = i;
    _tagSelTags = [...(decks[i]?.tags || [])];
    renderTagTree(false);
    document.querySelector('#tagSelectorOverlay').classList.add('show');
}

export function closeTagSelector() {
    document.querySelector('#tagSelectorOverlay').classList.remove('show');
}

export function confirmTagSelector() {
    const idx = _tagSelIdx;
    closeTagSelector();
    if (idx >= 0) {
        decks[idx].tags = _tagSelTags;
        renderDeckList();
        selectDeck(idx);
    }
}

export function tagToggle(path, checked) {
    if (checked) { if (!_tagSelTags.includes(path)) _tagSelTags.push(path); }
    else { _tagSelTags = _tagSelTags.filter(t => t !== path && !t.startsWith(path + '::')); }
    document.querySelector('#tagSelectorPreview').textContent = _tagSelTags.length ? '已选：' + _tagSelTags.join('、') : '尚未选择';
}

export async function removeDeckTag(i, path) {
    if (!decks[i] || !decks[i].tags) return;
    decks[i].tags = decks[i].tags.filter(t => t !== path);
    renderDeckList();
    await selectDeck(i);
}
