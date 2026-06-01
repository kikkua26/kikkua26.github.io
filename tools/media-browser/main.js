// kikkua · 媒体浏览器 — 插件入口

import { registerPlugin, apiRequest, esc, notifyParent } from '../shared/sdk.js';

const $ = s => document.querySelector(s);

// State
let currentMediaPath = 'data/media';
let mediaItems = [];

// ═══════════════════════════════════════
// GitHub API via parent proxy
// ═══════════════════════════════════════

async function listRepo(path) {
    const resp = await apiRequest(path);
    if (!resp.ok) {
        if (resp.status === 404) return [];
        throw new Error(resp.error || `HTTP ${resp.status}`);
    }
    return resp.data || [];
}

async function readFile(path) {
    const resp = await apiRequest(path);
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    return { content: resp.data.content, sha: resp.data.sha };
}

async function writeFile(path, content, sha, msg) {
    const body = { message: msg || 'Update ' + path, content };
    if (sha) body.sha = sha;
    const resp = await apiRequest(path, { method: 'PUT', body });
    if (!resp.ok) throw new Error(resp.error || `HTTP ${resp.status}`);
    return resp.data.content.sha;
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

function confirmDialog(msg) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal">
            <p>${esc(msg)}</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div>
        </div>`;
        overlay.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'ok') { overlay.remove(); resolve(true); }
            else if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(false); }
        });
        document.body.appendChild(overlay);
    });
}

function inputDialog(title, label, defaultVal) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal">
            <h3>${esc(title)}</h3>
            <div class="field"><label>${esc(label)}</label><input value="${esc(defaultVal || '')}"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div>
        </div>`;
        const input = overlay.querySelector('input');
        overlay.addEventListener('click', e => {
            const action = e.target.dataset.action;
            if (action === 'ok') { overlay.remove(); resolve(input.value.trim()); }
            else if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(null); }
        });
        document.body.appendChild(overlay);
        input.focus(); input.select();
    });
}

// ═══════════════════════════════════════
// Rendering
// ═══════════════════════════════════════

function renderBreadcrumb() {
    const bc = $('#mediaBreadcrumb');
    if (!bc) return;
    const parts = currentMediaPath.split('/');
    let path = '';
    bc.innerHTML = parts.map((p, i) => {
        path += (i > 0 ? '/' : '') + p;
        const isLast = i === parts.length - 1;
        return isLast ? `<span style="font-weight:600;color:var(--text);font-size:13px;">${p}</span>`
            : `<a href="#" data-media-nav="${path}" style="color:var(--accent);font-size:13px;text-decoration:none;">${p}</a> / `;
    }).join('');
}

function isMediaFile(name) {
    return /\.(png|jpe?g|gif|svg|webp|bmp|ico|mp4|webm|mov|mp3|wav|ogg|pdf)$/i.test(name);
}

function renderMediaGrid() {
    const grid = $('#mediaGrid');
    if (!grid) return;
    const dirs = mediaItems.filter(i => i.type === 'dir');
    const files = mediaItems.filter(i => i.type === 'file' && isMediaFile(i.name));

    if (!dirs.length && !files.length) {
        grid.innerHTML = '<div class="empty-msg">此文件夹为空，上传文件或创建子文件夹</div>';
        return;
    }

    grid.innerHTML = dirs.map(d => `
        <div class="media-card media-folder" data-media-nav="${currentMediaPath + '/' + d.name}"
             data-media-ctx="${esc(d.name)}" data-media-isdir="1">
            <div class="media-icon">📁</div>
            <div class="media-name">${esc(d.name)}</div>
        </div>
    `).join('') + files.map(f => {
        const url = '/' + currentMediaPath + '/' + f.name;
        const isImg = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(f.name);
        const isVideo = /\.(mp4|webm|mov)$/i.test(f.name);
        const isAudio = /\.(mp3|wav|ogg)$/i.test(f.name);
        const icon = isVideo ? '🎬' : isAudio ? '🎵' : '🖼';
        return `<div class="media-card" data-media-ctx="${esc(f.name)}" data-media-isdir="0">
            ${isImg ? `<img src="${url}" class="media-preview">`
              : `<div class="media-preview media-icon-large">${icon}</div>`}
            <div class="media-name">${esc(f.name)}</div>
            <div class="media-hint">右键操作</div>
        </div>`;
    }).join('');
}

// ═══════════════════════════════════════
// Context Menu
// ═══════════════════════════════════════

function showMediaMenu(e, name, isDir) {
    e.preventDefault();
    const menu = $('#mediaCtxMenu');
    if (!menu) return;

    let html = `<div class="ctx-header">${esc(name)}</div><div class="ctx-divider"></div>`;
    if (!isDir) {
        html += `<div class="ctx-item" data-media-action="copy" data-name="${esc(name)}">📋 复制路径</div>`;
        html += `<div class="ctx-item" data-media-action="replace" data-name="${esc(name)}">🔄 替换文件</div>`;
    }
    html += `<div class="ctx-item" data-media-action="rename" data-name="${esc(name)}" data-isdir="${isDir ? 1 : 0}">✏️ 重命名</div>`;
    html += `<div class="ctx-divider"></div>`;
    html += `<div class="ctx-item danger" data-media-action="delete" data-name="${esc(name)}" data-isdir="${isDir ? 1 : 0}">🗑 删除</div>`;

    menu.innerHTML = html;
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
}

function closeMediaMenu() {
    const menu = $('#mediaCtxMenu');
    if (menu) menu.style.display = 'none';
}

// ═══════════════════════════════════════
// Actions
// ═══════════════════════════════════════

async function loadMedia() {
    const grid = $('#mediaGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-msg">加载中…</div>';
    renderBreadcrumb();
    try {
        const items = await listRepo(currentMediaPath);
        mediaItems = items.filter(i => i.type === 'dir' || i.type === 'file');
        renderMediaGrid();
    } catch (e) {
        grid.innerHTML = '<div class="empty-msg">暂无媒体文件</div>';
        mediaItems = [];
    }
}

function navigateMedia(path) {
    currentMediaPath = path;
    loadMedia();
}

async function createMediaFolder() {
    const name = await inputDialog('新建文件夹', '文件夹名称', '');
    if (!name) return;
    const folderPath = currentMediaPath + '/' + name;
    try {
        await writeFile(folderPath + '/.gitkeep', '', null, 'Create folder');
        toast('文件夹已创建');
        await loadMedia();
    } catch (e) { toast('创建失败: ' + e.message, 'error'); }
}

function copyMediaUrl(name) {
    const path = '/' + currentMediaPath + '/' + name;
    navigator.clipboard.writeText(path).then(() => toast('已复制: ' + path)).catch(() => { prompt('复制以下路径:', path); });
}

async function promptRenameMedia(name, isDir) {
    const newName = prompt('新名称：', name);
    if (newName && newName !== name) renameMediaItem(name, newName, isDir);
}

async function renameMediaItem(oldName, newName, isDir) {
    const oldRelPath = currentMediaPath + '/' + oldName;
    const newRelPath = currentMediaPath + '/' + newName;
    try {
        if (isDir) {
            const items = await listRepo(oldRelPath);
            for (const item of items) {
                const r = await readFile(oldRelPath + '/' + item.name);
                await writeFile(newRelPath + '/' + item.name, r.content, null, 'Rename folder: ' + oldName + ' -> ' + newName);
            }
        } else {
            const r = await readFile(oldRelPath);
            await writeFile(newRelPath, r.content, null, 'Rename: ' + oldName + ' -> ' + newName);
            await writeFile(oldRelPath, '', r.sha, 'Delete old: ' + oldName);
            // Notify parent about media rename for page reference updates
            notifyParent('media:renamed', { oldPath: '/' + oldRelPath, newPath: '/' + newRelPath });
        }
        toast('已重命名');
    } catch (e) { toast('重命名失败: ' + e.message, 'error'); }
    await loadMedia();
}

function replaceMediaFile(name) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target.result.split(',')[1];
            const path = currentMediaPath + '/' + name;
            try {
                const r = await readFile(path);
                await writeFile(path, base64, r.sha, 'Replace ' + name);
                toast('已替换: ' + name);
                await loadMedia();
            } catch (err) { toast('替换失败: ' + err.message, 'error'); }
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

async function delMediaItem(name, isDir) {
    const ok = await confirmDialog(`确认删除 "${name}"？此操作不可恢复。`);
    if (!ok) return;
    try {
        if (isDir) {
            const items = await listRepo(currentMediaPath + '/' + name);
            for (const item of items) {
                const r = await readFile(currentMediaPath + '/' + name + '/' + item.name);
                await writeFile(currentMediaPath + '/' + name + '/' + item.name, '', r.sha, 'Delete');
            }
        } else {
            const r = await readFile(currentMediaPath + '/' + name);
            await writeFile(currentMediaPath + '/' + name, '', r.sha, 'Delete ' + name);
        }
        toast('已删除');
        await loadMedia();
    } catch (e) { toast('删除失败: ' + e.message, 'error'); }
}

function uploadMediaFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        for (const file of files) {
            const base64 = await new Promise(r => {
                const rd = new FileReader();
                rd.onload = e => r(e.target.result.split(',')[1]);
                rd.readAsDataURL(file);
            });
            const path = currentMediaPath + '/' + file.name;
            try {
                let sha = null;
                try { const r = await readFile(path); sha = r.sha; } catch {}
                await writeFile(path, base64, sha, 'Upload ' + file.name);
            } catch (err) { toast('上传失败: ' + file.name + ' - ' + err.message, 'error'); }
        }
        toast('上传完成');
        await loadMedia();
    };
    input.click();
}

// ═══════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════

function setupEvents() {
    // Click delegation
    document.addEventListener('click', e => {
        // Navigation
        const nav = e.target.closest('[data-media-nav]');
        if (nav) { navigateMedia(nav.dataset.mediaNav); return; }

        // Context menu actions
        const action = e.target.closest('[data-media-action]');
        if (action) {
            const act = action.dataset.mediaAction;
            const name = action.dataset.name;
            const isDir = action.dataset.isdir === '1';
            if (act === 'copy') { copyMediaUrl(name); closeMediaMenu(); }
            else if (act === 'replace') { replaceMediaFile(name); closeMediaMenu(); }
            else if (act === 'rename') { promptRenameMedia(name, isDir); closeMediaMenu(); }
            else if (act === 'delete') { delMediaItem(name, isDir); closeMediaMenu(); }
            return;
        }

        // Toolbar actions
        const toolbarAction = e.target.closest('[data-action]');
        if (toolbarAction) {
            const act = toolbarAction.dataset.action;
            if (act === 'create-folder') createMediaFolder();
            else if (act === 'upload-media') uploadMediaFile();
        }
    });

    // Context menu
    document.addEventListener('contextmenu', e => {
        const card = e.target.closest('.media-card[data-media-ctx]');
        if (card) {
            e.preventDefault();
            showMediaMenu(e, card.dataset.mediaCtx, card.dataset.mediaIsdir === '1');
        }
    });

    // Close context menu
    document.addEventListener('click', e => {
        if (!e.target.closest('#mediaCtxMenu') && !e.target.closest('.media-card')) closeMediaMenu();
    });
}

// ═══════════════════════════════════════
// Init
// ═══════════════════════════════════════

async function init() {
    registerPlugin({
        id: 'media-browser',
        name: '媒体浏览器',
        icon: '🖼',
        desc: '管理媒体文件，支持上传、重命名、删除',
        version: '1.0',
    });

    setupEvents();
    await loadMedia();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
