// kikkua · admin — 媒体文件管理

import { readRepo, writeRepo, listRepo } from './api.js';
import { toast, confirmModal, inputModal } from './ui.js';
import { pages, savePagesSilent } from './pages.js';

const $ = s => document.querySelector(s);
const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export let currentMediaPath = 'data/media';
export let mediaItems = [];

export async function loadMedia() {
    const grid = $('#mediaGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);width:100%;">加载中…</div>';
    renderBreadcrumb();
    try {
        try { await readRepo('data/media/.gitkeep'); } catch { try { await writeRepo('data/media/.gitkeep', '', null, 'Init media folder'); } catch {} }
        const items = await listRepo(currentMediaPath);
        mediaItems = items.filter(i => i.type === 'dir' || i.type === 'file');
        renderMediaGrid();
    } catch (e) {
        grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);width:100%;">暂无媒体文件</div>';
        mediaItems = [];
    }
}

export function renderBreadcrumb() {
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

export function navigateMedia(path) {
    currentMediaPath = path;
    loadMedia();
}

export async function createMediaFolder() {
    const name = await inputModal('新建文件夹', '文件夹名称', '');
    if (!name) return;
    const folderPath = currentMediaPath + '/' + name;
    try {
        await writeRepo(folderPath + '/.gitkeep', '', null, 'Create folder');
        toast('文件夹已创建');
        await loadMedia();
    } catch (e) { toast('创建失败: ' + e.message, 'error'); }
}

function isMediaFile(name) { return /\.(png|jpe?g|gif|svg|webp|bmp|ico|mp4|webm|mov|mp3|wav|ogg|pdf)$/i.test(name); }

export function renderMediaGrid() {
    const grid = $('#mediaGrid');
    if (!grid) return;
    const dirs = mediaItems.filter(i => i.type === 'dir');
    const files = mediaItems.filter(i => i.type === 'file' && isMediaFile(i.name));

    if (!dirs.length && !files.length) {
        grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3);width:100%;">此文件夹为空，上传文件或创建子文件夹</div>';
        return;
    }

    grid.innerHTML = dirs.map(d => `
        <div class="media-card media-folder" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;width:140px;text-align:center;cursor:pointer;transition:all .15s;"
             data-media-nav="${currentMediaPath + '/' + d.name}"
             data-media-ctx="${esc(d.name)}" data-media-isdir="1">
            <div style="font-size:36px;">📁</div>
            <div style="font-size:12px;color:var(--text);margin-top:6px;word-break:break-all;font-weight:500;">${esc(d.name)}</div>
        </div>
    `).join('') + files.map(f => {
        const url = '/' + currentMediaPath + '/' + f.name;
        const isImg = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(f.name);
        const isVideo = /\.(mp4|webm|mov)$/i.test(f.name);
        const isAudio = /\.(mp3|wav|ogg)$/i.test(f.name);
        const icon = isVideo ? '🎬' : isAudio ? '🎵' : '🖼';
        return `<div class="media-card" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px;width:150px;text-align:center;cursor:default;transition:all .15s;"
             data-media-ctx="${esc(f.name)}" data-media-isdir="0">
            ${isImg ? `<img src="${url}" style="width:100%;height:90px;object-fit:cover;border-radius:4px;margin-bottom:4px;pointer-events:none;">`
              : `<div style="width:100%;height:90px;display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--bg);border-radius:4px;margin-bottom:4px;">${icon}</div>`}
            <div style="font-size:11px;color:var(--text2);word-break:break-all;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f.name)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px;">右键操作</div>
        </div>`;
    }).join('');
}

export function showMediaMenu(e, name, isDir) {
    e.preventDefault();
    const menu = $('#mediaCtxMenu');
    let html = `<div style="padding:4px 14px;font-size:11px;color:var(--text3);">${esc(name)}</div><div class="ctx-divider"></div>`;
    if (!isDir) {
        html += `<div class="ctx-item" data-media-action="copy" data-name="${esc(name)}">📋 复制路径</div>`;
        html += `<div class="ctx-item" data-media-action="replace" data-name="${esc(name)}">🔄 替换文件</div>`;
    }
    html += `<div class="ctx-item" data-media-action="rename" data-name="${esc(name)}" data-isdir="${isDir?1:0}">✏️ 重命名</div>`;
    html += `<div class="ctx-divider"></div>`;
    html += `<div class="ctx-item danger" data-media-action="delete" data-name="${esc(name)}" data-isdir="${isDir?1:0}">🗑 删除</div>`;

    menu.innerHTML = html;
    menu.style.display = 'block';
    const x = Math.min(e.clientX, window.innerWidth - 170);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

export function closeMediaMenu() { $('#mediaCtxMenu').style.display = 'none'; }

export function copyMediaUrl(name) {
    const path = '/' + currentMediaPath + '/' + name;
    navigator.clipboard.writeText(path).then(() => toast('已复制: ' + path)).catch(() => { prompt('复制以下路径:', path); });
}

export async function promptRenameMedia(name, isDir) {
    const newName = prompt('新名称：', name);
    if (newName && newName !== name) renameMediaItem(name, newName, isDir);
}

export async function renameMediaItem(oldName, newName, isDir) {
    const oldRelPath = currentMediaPath + '/' + oldName;
    const newRelPath = currentMediaPath + '/' + newName;
    try {
        if (isDir) {
            const items = await listRepo(oldRelPath);
            for (const item of items) {
                const r = await readRepo(oldRelPath + '/' + item.name);
                await writeRepo(newRelPath + '/' + item.name, r.content, null, 'Rename folder: ' + oldName + ' -> ' + newName);
            }
        } else {
            const r = await readRepo(oldRelPath);
            await writeRepo(newRelPath, r.content, null, 'Rename: ' + oldName + ' -> ' + newName);
            await writeRepo(oldRelPath, '', r.sha, 'Delete old: ' + oldName);
            const oldUrl = '/' + oldRelPath;
            const newUrl = '/' + newRelPath;
            let updated = 0;
            for (const p of pages) {
                const before = p.content;
                p.content = p.content.split(oldUrl).join(newUrl);
                if (p.content !== before) updated++;
            }
            if (updated > 0) {
                await savePagesSilent();
                toast(`已重命名，并更新了 ${updated} 个页面的引用`);
                return;
            }
        }
        toast('已重命名');
    } catch (e) { toast('重命名失败: ' + e.message, 'error'); }
    await loadMedia();
}

export function replaceMediaFile(name) {
    const input = $('#mediaReplaceInput');
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target.result.split(',')[1];
            const path = currentMediaPath + '/' + name;
            try {
                const r = await readRepo(path);
                await writeRepo(path, base64, r.sha, 'Replace ' + name);
                toast('已替换: ' + name);
                await loadMedia();
            } catch (err) { toast('替换失败: ' + err.message, 'error'); }
        };
        reader.readAsDataURL(file);
        input.value = '';
    };
    input.click();
}

export async function delMediaItem(name, isDir) {
    const ok = await confirmModal('删除', `确认删除 "${name}"？此操作不可恢复。`);
    if (!ok) return;
    try {
        if (isDir) {
            const items = await listRepo(currentMediaPath + '/' + name);
            for (const item of items) {
                const r = await readRepo(currentMediaPath + '/' + name + '/' + item.name);
                await writeRepo(currentMediaPath + '/' + name + '/' + item.name, '', r.sha, 'Delete');
            }
        } else {
            const r = await readRepo(currentMediaPath + '/' + name);
            await writeRepo(currentMediaPath + '/' + name, '', r.sha, 'Delete ' + name);
        }
        toast('已删除');
        await loadMedia();
    } catch (e) { toast('删除失败: ' + e.message, 'error'); }
}

export function uploadMediaFile() {
    const input = $('#mediaFileInput');
    input.onchange = async (e) => {
        const files = e.target.files;
        if (!files.length) return;
        for (const file of files) {
            const base64 = await new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result.split(',')[1]); rd.readAsDataURL(file); });
            const path = currentMediaPath + '/' + file.name;
            try {
                let sha = null;
                try { const r = await readRepo(path); sha = r.sha; } catch {}
                await writeRepo(path, base64, sha, 'Upload ' + file.name);
            } catch (err) { toast('上传失败: ' + file.name + ' - ' + err.message, 'error'); }
        }
        toast('上传完成');
        await loadMedia();
        input.value = '';
    };
    input.click();
}
