// kikkua · 制卡工具 — CSV 导入/导出

import { state } from './constants.js';
import { activeNotes, flushData } from './data.js';
import { genId, toast } from './utils.js';

export function parseCSV(text) {
    const notes = [];
    const lines = [];
    let cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') { inQ = !inQ; cur += ch; }
        else if (ch === '\n' && !inQ) { lines.push(cur); cur = ''; }
        else if (ch === '\r' && !inQ) { if (text[i + 1] === '\n') i++; lines.push(cur); cur = ''; }
        else { cur += ch; }
    }
    if (cur.trim()) lines.push(cur);
    if (lines.length < 2) return notes;

    function parseLine(l) {
        const r = []; let c = '', q = false;
        for (let i = 0; i < l.length; i++) {
            const ch = l[i];
            if (ch === '"') {
                if (q && i + 1 < l.length && l[i + 1] === '"') { c += '"'; i++; }
                else q = !q;
            } else if (ch === ',' && !q) { r.push(c); c = ''; }
            else c += ch;
        }
        r.push(c); return r;
    }

    const headers = parseLine(lines[0]).map(h => h.trim());
    const idxM = Math.max(0, headers.indexOf('主字段'));
    const idxC = Math.max(1, headers.indexOf('章节'));
    const idxK = Math.max(2, headers.indexOf('知识解析'));
    const idxE = Math.max(3, headers.indexOf('拓展解析'));

    for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (!cols.length || (cols.length === 1 && !cols[0].trim())) continue;
        const mf = (cols[idxM] || '').trim();
        const ch = (cols[idxC] || '').trim();
        if (!mf && !ch) continue;
        notes.push({ id: genId(), mainField: mf, chapter: ch, knowledgeAnalysis: (cols[idxK] || '').trim(), extendedAnalysis: (cols[idxE] || '').trim() });
    }
    return notes;
}

export function generateCSV(notes) {
    const escCsv = v => {
        const s = String(v || '');
        return /[,"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = ['主字段,章节,知识解析,拓展解析'];
    for (const n of notes) rows.push([escCsv(n.mainField), escCsv(n.chapter), escCsv(n.knowledgeAnalysis), escCsv(n.extendedAnalysis)].join(','));
    return '﻿' + rows.join('\n');
}

export function downloadCSV(csv, filename) {
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = filename;
    a.click(); URL.revokeObjectURL(a.href);
}

export function importCSV(file, renderAll) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const text = e.target.result.replace(/^﻿/, '');
            const imported = parseCSV(text);
            if (!imported.length) { toast('CSV 中未解析到有效笔记', 'error'); return; }
            const notes = activeNotes();
            let added = 0, updated = 0;
            for (const im of imported) {
                const ei = notes.findIndex(n => n.mainField === im.mainField && n.chapter === im.chapter);
                if (ei >= 0) { notes[ei] = { ...notes[ei], ...im, id: notes[ei].id }; updated++; }
                else { notes.push(im); added++; }
            }
            flushData();
            renderAll();
            toast(`导入完成：新增 ${added} 条${updated ? `，更新 ${updated} 条` : ''}`, 'success');
        } catch (err) { toast('导入失败: ' + err.message, 'error'); }
    };
    reader.readAsText(file, 'UTF-8');
}

export function exportCSV(renderAll) {
    const notes = activeNotes();
    const csv = generateCSV(notes);
    downloadCSV(csv, (state.activeNotebook || '笔记本') + '.csv');
    toast('已导出 CSV', 'success');
}
