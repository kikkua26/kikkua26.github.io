// kikkua · 题库编辑器 — CSV/Excel 导入

import { OPT_LETTERS } from './constants.js';
import { loadScript } from './utils.js';
import { addRow, isRowEmpty, ensureEmptyRows, getTbody } from './table.js';

export function parseCSVLine(line) {
    const r = []; let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) { if (ch === '"' && line[i+1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
        else { if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; } else c += ch; }
    }
    r.push(c); return r;
}

export function importAOA(aoa) {
    if (aoa.length < 2) { alert('文件无数据行'); return; }
    const tbody = getTbody();
    const hdr = aoa[0].map(h => String(h).trim().toLowerCase());
    const TYPE_IMPORT_MAP = { '选择题':'单选题','单选题':'单选题','判断题':'判断题','多选题':'多选题','填空题':'挖空题','挖空题':'挖空题','问答题':'问答题','choice':'单选题','cloze':'挖空题','short':'问答题','single choice':'单选题','multiple choice':'多选题','fill-in-the-blank':'挖空题','short answer':'问答题' };
    const fm = { 'chapter':'chapter','type':'type','question':'question','clozetext':'clozetext','optiona':'optA','a':'optA','optionb':'optB','b':'optB','optionc':'optC','c':'optC','optiond':'optD','d':'optD','optione':'optE','e':'optE','optionf':'optF','f':'optF','optiong':'optG','g':'optG','answer':'answer','answertext':'answertext','analysis':'analysis','reference':'reference','options':'_options' };
    // Find insertion point: before first trailing empty row
    const rows = Array.from(tbody.rows);
    let insertBefore = null;
    for (let i = rows.length - 1; i >= 0; i--) {
        if (!isRowEmpty(rows[i])) break;
        insertBefore = rows[i];
    }
    for (let i = 1; i < aoa.length; i++) {
        const vals = aoa[i]; if (!vals || vals.every(v => v === '')) continue;
        const obj = {};
        vals.forEach((v, j) => {
            const key = fm[hdr[j]] || hdr[j];
            let val = String(v || '');
            if (key === 'type') val = TYPE_IMPORT_MAP[val.toLowerCase()] || val;
            if (key && key !== '_options') obj[key] = val;
            if (key === '_options') val.split('||').forEach((p, k) => { if (k < 7) obj['opt'+OPT_LETTERS[k]] = p.trim(); });
        });
        if ((obj.type === '挖空题' || obj.type === '填空题' || obj.type === 'cloze') && !obj.answer && obj.clozetext) {
            const matches = obj.clozetext.match(/\[\[([^\]]*)\]\]/g);
            if (matches) obj.answer = matches.map(m => m.slice(2, -2)).join('|');
        }
        addRow(obj, insertBefore);
    }
    ensureEmptyRows();
}

export function handleFileImport(e) {
    const file = e.target.files[0]; if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        loadScript('lib/xlsx.full.min.js?v=4').then(() => {
            const reader = new FileReader();
            reader.onload = ev => {
                const wb = XLSX.read(ev.target.result, { type: 'array' });
                importAOA(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }));
            };
            reader.readAsArrayBuffer(file);
        });
    } else if (name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = ev => {
            importAOA(ev.target.result.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).map(parseCSVLine));
        };
        reader.readAsText(file);
    } else { alert('不支持的文件格式，请使用 .csv 或 .xlsx'); }
    e.target.value = '';
}

export function stripCodeBlock(text) {
    return text.replace(/^```(?:\w+)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

export function doTextImport() {
    let text = document.getElementById('textInputArea').value.trim();
    if (!text) { alert('请输入 CSV 数据'); return; }
    text = stripCodeBlock(text);
    document.getElementById('textImportModal').classList.remove('show');
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    const aoa = lines.map(parseCSVLine);
    importAOA(aoa);
}
