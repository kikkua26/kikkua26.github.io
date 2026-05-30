// kikkua · 题库编辑器 — CSV/Excel 导出

import { OPT_LETTERS } from './constants.js';
import { download, loadScript } from './utils.js';
import { collectData, getHiddenOptCols } from './table.js';

function buildExportData(data) {
    const fields = ['chapter','type','question','clozetext','optA','optB','optC','optD','optE','optF','optG','answer','answertext','analysis','reference'];
    const header = ['序号','Chapter','Type','Question','ClozeText','OptionA','OptionB','OptionC','OptionD','OptionE','OptionF','OptionG','Answer','AnswerText','Analysis','Reference'];
    const aoa = [header];
    data.forEach((row, i) => { aoa.push([i+1, ...fields.map(f => row[f] || '')]); });
    return { aoa, header, fields };
}

function csvVal(s) { s = String(s); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s; }

export function exportStandardCSV() {
    const { aoa } = buildExportData(collectData());
    download('questions.csv', '﻿' + aoa.map(row => row.map(csvVal).join(',')).join('\n'), 'text/csv');
}

export function exportKikkuaCSV() {
    const data = collectData();
    const visibleOpts = OPT_LETTERS.slice(0, 7 - getHiddenOptCols());
    const header = ['序号','Chapter','Type','Question','ClozeText','Options','Answer','AnswerText','Analysis','Reference'];
    const fields = ['_chapter','_type','_question','clozetext','_options','answer','answertext','analysis','reference'];
    let csv = '﻿' + header.join(',') + '\n';
    data.forEach((row, i) => {
        const optParts = visibleOpts.map(o => row['opt'+o] || '').filter(v => v.trim());
        const TYPE_MAP = { '单选题':'单选题','判断题':'判断题','多选题':'多选题','选择题':'单选题','填空题':'挖空题','挖空题':'挖空题','问答题':'问答题', choice:'单选题', cloze:'挖空题', short:'问答题' };
        csv += [i+1, ...fields.map(f => csvVal(({ _chapter: row.chapter||'', _type: TYPE_MAP[row.type]||row.type||'', _question: row.question||'', clozetext: row.clozetext||'', _options: optParts.join('||'), ...row })[f] || ''))].join(',') + '\n';
    });
    download('questions_kikkua.csv', csv, 'text/csv');
}

export async function exportXLSX() {
    await loadScript('lib/xlsx.full.min.js?v=4');
    const { aoa } = buildExportData(collectData());
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = aoa[0].map((h, ci) => {
        let max = h.length;
        aoa.slice(1).forEach(row => { const v = String(row[ci] || ''); if (v.length > max) max = v.length; });
        return { wch: Math.min(Math.max(max + 2, 8), 50) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'questions.xlsx');
}

export async function downloadTemplate() {
    await loadScript('lib/xlsx.full.min.js?v=4');
    const header = ['序号','Chapter','Type','Question','ClozeText','OptionA','OptionB','OptionC','OptionD','OptionE','Answer','AnswerText','Analysis','Reference'];
    const example = ['1','Chapter 1','choice','What is 1+1?','','1','2','3','4','5','B','The answer is 2','Basic math','Math textbook'];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws['!cols'] = header.map(h => ({ wch: Math.max(h.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'questions_template.xlsx');
}
