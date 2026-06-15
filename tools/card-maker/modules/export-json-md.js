// kikkua · 制卡工具 — JSON / Markdown 导出

import { state } from './constants.js';
import { activeNotes, parseSubfields } from './data.js';
import { toast } from './utils.js';
import { loadScript } from '../../shared/sdk.js';

function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── JSON 导出（与导入格式一致） ──

export function exportJSON() {
    const notes = activeNotes().filter(n => n.mainField || n.chapter);
    const arr = notes.map(n => ({
        '主字段': n.mainField || '',
        '章节': n.chapter || '',
        '等级': n.level || '2',
        '知识解析': parseSubfieldsToObject(n.knowledgeAnalysis),
        '拓展解析': parseSubfieldsToObject(n.extendedAnalysis),
    }));
    const json = JSON.stringify(arr, null, 2);
    download((state.activeNotebook || '笔记本') + '.json', json, 'application/json');
    toast('已导出 JSON', 'success');
}

function parseSubfieldsToObject(raw) {
    const fields = parseSubfields(raw);
    const obj = {};
    for (const f of fields) {
        if (f.name) obj[f.name] = f.content;
        else if (f.content) obj['_'] = (obj['_'] || '') + f.content;
    }
    return obj;
}

// ── Markdown 包导出（zip） ──

let fileIndex = 0;

export async function exportMarkdownZip() {
    fileIndex = 0;
    const notes = activeNotes().filter(n => n.mainField || n.chapter);
    if (!notes.length) { toast('没有可导出的笔记', 'error'); return; }

    await loadScript('/tools/question-bank/lib/jszip.min.js?v=1');
    const zip = new JSZip();

    // 构建章节顺序（复用 APKG 逻辑）
    const nb = state.notebooks[state.activeNotebook];
    const rawOrder = nb?._order || {};
    const allChildren = {};
    for (const note of notes) {
        if (!note.chapter) continue;
        const parts = note.chapter.split('::');
        let path = '';
        for (const part of parts) {
            const parent = path;
            path = path ? path + '::' + part : part;
            if (!allChildren[parent]) allChildren[parent] = new Set();
            allChildren[parent].add(part);
        }
    }
    const orderMap = {};
    for (const [parent, children] of Object.entries(allChildren)) {
        const manual = rawOrder[parent] || [];
        const remaining = [...children].filter(c => !manual.includes(c)).sort();
        orderMap[parent] = [...manual, ...remaining];
    }

    // 将章节路径转为编号路径
    function toNumberedPath(chapter) {
        const parts = chapter.split('::');
        let raw = '', numbered = '';
        for (const part of parts) {
            const parent = raw;
            raw = raw ? raw + '::' + part : part;
            const siblings = orderMap[parent] || [];
            const idx = siblings.indexOf(part);
            const prefix = idx >= 0 ? String(idx + 1).padStart(2, '0') + ' ' : '';
            numbered = numbered ? numbered + '::' + prefix + part : prefix + part;
        }
        return numbered;
    }

    // 按编号章节分组
    const chapters = {};
    for (const n of notes) {
        const ch = n.chapter || '未分类';
        const numbered = toNumberedPath(ch);
        if (!chapters[numbered]) chapters[numbered] = [];
        chapters[numbered].push(n);
    }

    // 按编号排序
    const sortedChapters = Object.keys(chapters).sort();

    // 生成目录索引（带链接）
    let indexMd = `# ${state.activeNotebook || '笔记本'}\n\n`;
    indexMd += `> 共 ${notes.length} 条笔记，${sortedChapters.length} 个章节\n\n`;

    // 构建目录树并生成索引
    const tree = {};
    for (const numbered of sortedChapters) {
        const parts = numbered.split('::');
        let node = tree;
        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (!node[p]) node[p] = i === parts.length - 1 ? { _notes: chapters[numbered] } : {};
            else if (i === parts.length - 1) node[p]._notes = chapters[numbered];
            node = node[p];
        }
    }

    // 生成文件并添加链接
    function buildIndexAndFiles(node, folderPath) {
        let md = '';
        for (const [name, child] of Object.entries(node)) {
            if (name === '_notes') continue;
            if (child._notes) {
                fileIndex++;
                const filename = folderPath + padNum(fileIndex) + '_' + sanitizeFilename(name) + '.md';
                md += `- [${name}](${filename}) (${child._notes.length}条)\n`;
                // 生成章节 md 文件
                let chapterMd = `# ${name}\n\n`;
                chapterMd += `> 本章节共 ${child._notes.length} 条笔记\n\n`;
                for (const n of child._notes) {
                    chapterMd += renderNoteMd(n);
                }
                zip.file(filename, chapterMd);
            } else {
                md += `- **${name}**/\n`;
                md += buildIndexAndFiles(child, folderPath + sanitizeFilename(name) + '/');
            }
        }
        return md;
    }

    indexMd += buildIndexAndFiles(tree, '');
    zip.file('README.md', indexMd);

    // 生成 zip 并下载
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.activeNotebook || '笔记本') + '_md.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出 Markdown 压缩包', 'success');
}

function padNum(n) { return String(n).padStart(3, '0'); }

function renderNoteMd(note) {
    let md = '';
    const name = note.mainField || '(未命名)';
    const level = { '1': '核心必记', '2': '重点掌握', '3': '了解即可' }[note.level] || '重点掌握';

    md += `## ${name}\n\n`;
    md += `**等级**: ${level}\n\n`;

    const allFields = [
        ...parseSubfields(note.knowledgeAnalysis),
        ...parseSubfields(note.extendedAnalysis),
    ];
    for (const f of allFields) {
        md += formatFieldMd(f);
    }

    md += `---\n\n`;
    return md;
}

function cleanContent(text) {
    if (!text) return '';
    return text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\[\[([^\]]*)\]\]/g, '**$1**')
        .trim();
}

function formatFieldMd(field) {
    if (!field.name && !field.content) return '';
    const cleaned = cleanContent(field.content);
    const lines = cleaned.split('\n').filter(l => l.trim());
    if (lines.length <= 1) {
        return field.name ? `**${field.name}**: ${cleaned || ''}\n\n` : `${cleaned || ''}\n\n`;
    }
    let md = '';
    if (field.name) md += `**${field.name}**:\n\n`;
    for (const line of lines) {
        md += `> ${line.trim()}\n`;
    }
    md += `\n`;
    return md;
}

// ── 辅助函数 ──

function sanitizeFilename(str) {
    return str.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}
