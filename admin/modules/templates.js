// kikkua · admin — 模板管理

import { readRepo, writeRepo, listRepo } from './api.js';
import { toast, inputModal } from './ui.js';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export let tplNames = [], currentTpl = '', currentTplFile = '';
export let tplFiles = {};

export async function loadTemplates() {
    try {
        const items = await listRepo('templates');
        tplNames = items.filter(i => i.type === 'dir').map(i => i.name);
        renderTplGrid();
    } catch (e) { $('#tplGrid').innerHTML = `<div class="tpl-card add" style="grid-column:1/-1;">加载失败</div>`; }
}

export function renderTplGrid() {
    const el = $('#tplGrid');
    if (!el) return;
    el.innerHTML = tplNames.map(n => `
        <div class="tpl-card${n===currentTpl?' selected':''}" data-tpl="${esc(n)}">
            <div class="icon">📁</div><div class="name">${esc(n)}</div>
            <div class="meta">模板包</div>
        </div>
    `).join('') + '<div class="tpl-card add" data-action="create-tpl"><div class="big">+</div><span>新建</span></div>';
}

export async function selectTpl(name) {
    currentTpl = name; renderTplGrid();
    const editor = $('#tplEditor'); editor.style.display = 'block';
    $('#tplEditorTitle').textContent = name;
    const files = ['正面模板.html', '背面模板.html', '样式.css'];
    $('#tplFileTabs').innerHTML = files.map((f, i) =>
        `<span class="file-tab${i===0?' active':''}" data-tpl-file="${esc(name)}" data-tpl-filename="${esc(f)}">${f}</span>`
    ).join('');
    switchTplFile(name, files[0], $('#tplFileTabs').firstChild);
}

export async function switchTplFile(tpl, file, tab) {
    currentTplFile = `templates/${tpl}/${file}`;
    $$('.file-tab').forEach(t => t.classList.remove('active'));
    if (tab) tab.classList.add('active');
    $('#tplEditorContent').value = '加载中…';
    try {
        const r = await readRepo(currentTplFile);
        tplFiles[currentTplFile] = { sha: r.sha };
        $('#tplEditorContent').value = r.text;
    } catch (e) {
        if (e.message.includes('Not Found')) {
            $('#tplEditorContent').value = `/* 新文件 */\n`;
            tplFiles[currentTplFile] = { sha: null };
        } else {
            $('#tplEditorContent').value = `/* 加载失败 */`;
        }
    }
}

export async function saveTplFile() {
    const info = tplFiles[currentTplFile] || { sha: null };
    try {
        await writeRepo(currentTplFile, $('#tplEditorContent').value, info.sha, 'Update ' + currentTplFile);
        const r = await readRepo(currentTplFile);
        tplFiles[currentTplFile] = { sha: r.sha };
        toast('已保存');
    } catch (e) { toast(e.message, 'error'); }
}

export async function createTpl() {
    const name = await inputModal('新建模板', '模板名称', 'my-template');
    if (!name) return;
    if (tplNames.includes(name)) { toast('已存在', 'error'); return; }
    try {
        await writeRepo(`templates/${name}/正面模板.html`, '{{Front}}', null, 'Create');
        await writeRepo(`templates/${name}/背面模板.html`, '{{FrontSide}}\n\n<hr>\n\n{{Back}}', null, 'Create');
        await writeRepo(`templates/${name}/样式.css`, '.card { font-family: arial; font-size: 20px; }', null, 'Create');
        tplNames.push(name); renderTplGrid(); selectTpl(name);
        toast(`"${name}" 已创建`);
    } catch (e) { toast(e.message, 'error'); }
}
