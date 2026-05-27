// kikkua Pro · 题库编辑器
// 表格化题库管理，支持 CSV/Excel 导入导出、AI 生成

const tbody = document.getElementById('tbody');
const statusEl = document.getElementById('statusText');
const OPT_LETTERS = ['A','B','C','D','E','F','G'];
let hiddenOptCols = 0;
let editingTr = null;

// ═══ Column Resize ═══
document.addEventListener('mousedown', e => {
    if (!e.target.classList.contains('resizer')) return;
    const th = e.target.parentElement;
    const colIdx = Array.from(th.parentElement.children).indexOf(th);
    const colEl = document.querySelectorAll('colgroup col')[colIdx];
    if (!colEl) return;
    const startX = e.pageX;
    const startW = colEl.offsetWidth;
    e.target.classList.add('active');
    const onMove = ev => { colEl.style.width = Math.max(30, startW + ev.pageX - startX) + 'px'; };
    const onUp = () => { e.target.classList.remove('active'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
});

function setOptCols(n) {
    const show = parseInt(n);
    hiddenOptCols = 7 - show;
    OPT_LETTERS.forEach((_, i) => {
        document.querySelectorAll(`[data-col="opt${OPT_LETTERS[i]}"]`).forEach(el => { el.style.display = i < show ? '' : 'none'; });
    });
    buildColGroup(show);
}

function buildColGroup(optCount) {
    const cg = document.getElementById('colgroup');
    const visibleOpts = optCount != null ? optCount : (7 - hiddenOptCols);
    const flexCols = 8 + visibleOpts; // chapter, type, question, clozetext, opts, answer, answertext, analysis, reference
    // idx=3%, actions=2.5%, remaining 94.5% split equally among flex columns
    const flexPct = (94.5 / flexCols).toFixed(3);
    let html = '<col style="width:3%">';
    html += '<col style="width:' + flexPct + '%">'; // chapter
    html += '<col style="width:' + flexPct + '%">'; // type
    html += '<col style="width:' + flexPct + '%">'; // question
    html += '<col style="width:' + flexPct + '%">'; // clozetext
    for (let i = 0; i < visibleOpts; i++) html += '<col style="width:' + flexPct + '%">';
    html += '<col style="width:' + flexPct + '%">'; // answer
    html += '<col style="width:' + flexPct + '%">'; // answertext
    html += '<col style="width:' + flexPct + '%">'; // analysis
    html += '<col style="width:' + flexPct + '%">'; // reference
    html += '<col style="width:2.5%">'; // actions
    cg.innerHTML = html;
}

// ═══ Row CRUD ═══
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function addRow(data, beforeTr) {
    const tr = document.createElement('tr');
    const d = data || {};
    tr.innerHTML = `<td class="idx" data-col="idx" title="双击编辑 · 右键菜单"></td>`;
    tr.innerHTML += `<td data-col="chapter"><input type="text" data-field="chapter" placeholder="章节" value="${esc(d.chapter||'')}"></td>`;
    tr.innerHTML += `<td data-col="type"><input type="text" data-field="type" placeholder="Type" value="${esc(d.type||'')}"></td>`;
    tr.innerHTML += `<td data-col="question"><input type="text" data-field="question" placeholder="题干" value="${esc(d.question||'')}"></td>`;
    tr.innerHTML += `<td data-col="clozetext"><input type="text" data-field="clozetext" placeholder="Cloze" value="${esc(d.clozetext||'')}"></td>`;
    OPT_LETTERS.forEach((o, i) => {
        const visible = i < (7 - hiddenOptCols);
        tr.innerHTML += `<td data-col="opt${o}" style="${visible?'':'display:none'}"><input type="text" data-field="opt${o}" placeholder="${o}" value="${esc(d['opt'+o]||'')}"></td>`;
    });
    tr.innerHTML += `<td data-col="answer"><input type="text" data-field="answer" maxlength="10" placeholder="A" value="${esc(d.answer||'')}"></td>`;
    tr.innerHTML += `<td data-col="answertext"><input type="text" data-field="answertext" placeholder="答案文本" value="${esc(d.answertext||'')}"></td>`;
    tr.innerHTML += `<td data-col="analysis"><input type="text" data-field="analysis" placeholder="解析" value="${esc(d.analysis||'')}"></td>`;
    tr.innerHTML += `<td data-col="reference"><input type="text" data-field="reference" placeholder="参考" value="${esc(d.reference||'')}"></td>`;
    tr.innerHTML += `<td data-col="actions" class="actions" title="删除">✕</td>`;
    if (beforeTr) tbody.insertBefore(tr, beforeTr); else tbody.appendChild(tr);
    renumber();
    return tr;
}

function addRows() {
    const n = parseInt(prompt('添加几行？', '10'));
    if (n > 0) { for (let i = 0; i < n; i++) addRow(); }
}

function delRow(el) {
    const tr = el.closest('tr');
    if (tr) { tr.remove(); renumber(); }
}

function renumber() {
    Array.from(tbody.rows).forEach((tr, i) => { tr.querySelector('.idx').textContent = i + 1; });
    statusEl.innerHTML = `共 <span class="count">${tbody.rows.length}</span> 行`;
}

function collectData() {
    const rows = [];
    Array.from(tbody.rows).forEach(tr => {
        const obj = {};
        tr.querySelectorAll('[data-field]').forEach(el => { obj[el.dataset.field] = el.value; });
        rows.push(obj);
    });
    return rows;
}

function getRowData(tr) {
    const obj = {};
    tr.querySelectorAll('[data-field]').forEach(el => { obj[el.dataset.field] = el.value; });
    return obj;
}

function setRowData(tr, data) {
    tr.querySelectorAll('[data-field]').forEach(el => {
        if (data[el.dataset.field] !== undefined) { el.value = data[el.dataset.field]; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
}

// ═══ Row Edit Form ═══
const FORM_FIELDS = [
    { key: 'chapter', label: 'Chapter', type: 'text' },
    { key: 'type', label: 'Type', type: 'text' },
    { key: 'question', label: 'Question', type: 'textarea' },
    { key: 'clozetext', label: 'Clozetext', type: 'textarea' },
    { key: 'optA', label: 'Option A', type: 'textarea' },
    { key: 'optB', label: 'Option B', type: 'textarea' },
    { key: 'optC', label: 'Option C', type: 'textarea' },
    { key: 'optD', label: 'Option D', type: 'textarea' },
    { key: 'optE', label: 'Option E', type: 'textarea' },
    { key: 'optF', label: 'Option F', type: 'textarea' },
    { key: 'optG', label: 'Option G', type: 'textarea' },
    { key: 'answer', label: 'Answer', type: 'text' },
    { key: 'answertext', label: 'AnswerText', type: 'textarea' },
    { key: 'analysis', label: 'Analysis', type: 'textarea' },
    { key: 'reference', label: 'Reference', type: 'textarea' },
];

function openForm(tr) {
    editingTr = tr;
    const data = getRowData(tr);
    const idx = Array.from(tbody.rows).indexOf(tr) + 1;
    document.getElementById('formBadge').textContent = '#' + idx;
    const body = document.getElementById('formGrid');
    body.innerHTML = '';
    FORM_FIELDS.forEach(f => {
        const oi = OPT_LETTERS.indexOf(f.key.replace('opt',''));
        if (f.key.startsWith('opt') && oi >= (7 - hiddenOptCols)) return;
        const val = esc(data[f.key]||'');
        const isTextarea = f.type === 'textarea';
        body.innerHTML += `<div class="form-row"><span class="form-label">${f.label}</span>${
            isTextarea
            ? `<textarea data-field="${f.key}" rows="1">${val}</textarea>`
            : `<input type="text" data-field="${f.key}" value="${val}">`
        }</div>`;
    });
    document.getElementById('rowFormModal').classList.add('show');
    const first = body.querySelector('input, textarea'); if (first) first.focus();
}

function closeForm() { document.getElementById('rowFormModal').classList.remove('show'); editingTr = null; }

function saveForm() {
    if (!editingTr) return;
    const grid = document.getElementById('formGrid');
    const data = {};
    grid.querySelectorAll('[data-field]').forEach(el => { data[el.dataset.field] = el.value; });
    setRowData(editingTr, data);
    closeForm();
}

// ═══ Context Menu ═══
let ctxTr = null;

document.addEventListener('contextmenu', e => {
    const td = e.target.closest('td.idx');
    if (!td) { hideCtx(); return; }
    e.preventDefault();
    ctxTr = td.parentElement;
    const menu = document.getElementById('ctxMenu');
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 220) + 'px';
});

document.addEventListener('click', e => { if (!e.target.closest('.ctx-menu')) hideCtx(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideCtx(); closeForm(); } });

function hideCtx() { document.getElementById('ctxMenu').style.display = 'none'; }

document.getElementById('ctxMenu').addEventListener('click', e => {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    const action = item.dataset.action;
    hideCtx();
    if (!ctxTr) return;
    if (action === 'edit') openForm(ctxTr);
    else if (action === 'insertAbove') addRow({}, ctxTr);
    else if (action === 'insertBelow') addRow({}, ctxTr.nextElementSibling);
    else if (action === 'duplicate') addRow(getRowData(ctxTr), ctxTr.nextElementSibling);
    else if (action === 'delete') { ctxTr.remove(); renumber(); }
});

// ═══ Double-click to edit ═══
document.addEventListener('dblclick', e => {
    const td = e.target.closest('td.idx');
    if (td) openForm(td.parentElement);
});

// ═══ CSV/Excel Export ═══
function buildExportData(data) {
    const fields = ['chapter','type','question','clozetext','optA','optB','optC','optD','optE','optF','optG','answer','answertext','analysis','reference'];
    const header = ['序号','Chapter','Type','Question','Clozetext','OptionA','OptionB','OptionC','OptionD','OptionE','OptionF','OptionG','Answer','AnswerText','Analysis','Reference'];
    const aoa = [header];
    data.forEach((row, i) => { aoa.push([i+1, ...fields.map(f => row[f] || '')]); });
    return { aoa, header, fields };
}

function csvVal(s) { s = String(s); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s; }

function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
    URL.revokeObjectURL(a.href);
}

function exportStandardCSV() {
    const { aoa } = buildExportData(collectData());
    download('questions.csv', '﻿' + aoa.map(row => row.map(csvVal).join(',')).join('\n'), 'text/csv');
}

function exportKikkuaCSV() {
    const data = collectData();
    const visibleOpts = OPT_LETTERS.slice(0, 7 - hiddenOptCols);
    const header = ['序号','Chapter','Type','Question','Options','Answer','AnswerText','Analysis','Reference'];
    const fields = ['_chapter','_type','_question','_options','answer','answertext','analysis','reference'];
    let csv = '﻿' + header.join(',') + '\n';
    data.forEach((row, i) => {
        let q = row.question || '';
        if (row.clozetext && row.clozetext.trim()) q = row.clozetext;
        const optParts = visibleOpts.map(o => row['opt'+o] || '').filter(v => v.trim());
        const TYPE_MAP = { choice:'选择题', cloze:'填空题', short:'问答题' };
        csv += [i+1, ...fields.map(f => csvVal(({ _chapter: row.chapter||'', _type: TYPE_MAP[row.type]||row.type||'', _question: q, _options: optParts.join('||'), ...row })[f] || ''))].join(',') + '\n';
    });
    download('questions_kikkua.csv', csv, 'text/csv');
}

function exportXLSX() {
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

function downloadTemplate() {
    const header = ['序号','Chapter','Type','Question','Clozetext','OptionA','OptionB','OptionC','OptionD','OptionE','Answer','AnswerText','Analysis','Reference'];
    const example = ['1','Chapter 1','choice','What is 1+1?','','1','2','3','4','5','B','The answer is 2','Basic math','Math textbook'];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws['!cols'] = header.map(h => ({ wch: Math.max(h.length + 2, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'questions_template.xlsx');
}

// ═══ Import ═══
function parseCSVLine(line) {
    const r = []; let c = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) { if (ch === '"' && line[i+1] === '"') { c += '"'; i++; } else if (ch === '"') q = false; else c += ch; }
        else { if (ch === '"') q = true; else if (ch === ',') { r.push(c); c = ''; } else c += ch; }
    }
    r.push(c); return r;
}

function importAOA(aoa) {
    if (aoa.length < 2) { alert('文件无数据行'); return; }
    const hdr = aoa[0].map(h => String(h).trim().toLowerCase());
    const TYPE_IMPORT_MAP = { '选择题':'choice','填空题':'cloze','问答题':'short','choice':'choice','cloze':'cloze','short':'short','single choice':'choice','multiple choice':'choice','fill-in-the-blank':'cloze','short answer':'short' };
    const fm = { 'chapter':'chapter','type':'type','question':'question','clozetext':'clozetext','optiona':'optA','a':'optA','optionb':'optB','b':'optB','optionc':'optC','c':'optC','optiond':'optD','d':'optD','optione':'optE','e':'optE','optionf':'optF','f':'optF','optiong':'optG','g':'optG','answer':'answer','answertext':'answertext','analysis':'analysis','reference':'reference','options':'_options' };
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
        if (obj.type === 'cloze' && !obj.answer && obj.clozetext) {
            const matches = obj.clozetext.match(/\[\[([^\]]*)\]\]/g);
            if (matches) obj.answer = matches.map(m => m.slice(2, -2)).join('|');
        }
        addRow(obj);
    }
}

function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = ev => {
            const wb = XLSX.read(ev.target.result, { type: 'array' });
            importAOA(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }));
        };
        reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = ev => {
            importAOA(ev.target.result.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).map(parseCSVLine));
        };
        reader.readAsText(file);
    } else { alert('不支持的文件格式，请使用 .csv 或 .xlsx'); }
    e.target.value = '';
}

function doTextImport() {
    const text = document.getElementById('textInputArea').value.trim();
    if (!text) { alert('请输入 CSV 数据'); return; }
    document.getElementById('textImportModal').classList.remove('show');
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    const aoa = lines.map(parseCSVLine);
    importAOA(aoa);
}

// ═══ Selection & Fill ═══
let activeTd = null, selection = [];

function getTdFromInput(el) { return el ? el.closest('td[data-col]') : null; }
function getColName(td) { return td ? td.dataset.col : null; }
function getRowIndex(td) { return td ? td.parentElement.rowIndex : -1; }
function getInputValue(td) { const i = td.querySelector('input, textarea'); return i ? i.value : ''; }
function setInputValue(td, v) { const i = td.querySelector('input, textarea'); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } }
function clearSelection() { selection.forEach(t => t.classList.remove('selected', 'fill-range', 'active-cell')); selection = []; activeTd = null; }
function setActiveCell(td) { clearSelection(); if (!td) return; activeTd = td; td.classList.add('active-cell'); selection = [td]; }

document.addEventListener('focusin', e => {
    const td = getTdFromInput(e.target);
    if (td && td.dataset.col !== 'idx' && td.dataset.col !== 'actions') setActiveCell(td);
});

document.addEventListener('click', e => {
    const td = e.target.closest('td[data-col]');
    if (!td || td.dataset.col === 'idx' || td.dataset.col === 'actions') return;
    if (e.shiftKey && activeTd && getColName(td) === getColName(activeTd)) {
        clearSelection();
        const col = getColName(td);
        const lo = Math.min(getRowIndex(activeTd), getRowIndex(td));
        const hi = Math.max(getRowIndex(activeTd), getRowIndex(td));
        document.querySelectorAll('td[data-col="'+col+'"]').forEach(c => {
            const ri = c.parentElement.rowIndex;
            if (ri >= lo && ri <= hi) { c.classList.add('selected'); selection.push(c); }
        });
        activeTd.classList.add('active-cell');
    }
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (selection.length < 2) return;
        const sorted = [...selection].sort((a, b) => getRowIndex(a) - getRowIndex(b));
        const sv = getInputValue(sorted[0]);
        for (let i = 1; i < sorted.length; i++) setInputValue(sorted[i], sv);
    }
});

// ═══ AI Generation ═══
let aiType = 'choice';
let aiMode = 'batch';
let aiAnalysisStyle = 'default';

const ANALYSIS_STYLE_MAP = {
    default:  '清晰准确地撰写解析，点明正确答案的依据，30~60 字',
    simple:   '用通俗易懂的语言撰写解析，避免专业术语，像老师给初学者讲解一样，30~60 字',
    detailed: '详细撰写解析，展开相关知识点的背景、原理和延伸，帮助深入理解，80~150 字',
    brief:    '简洁精炼地撰写解析，只点明核心要点，15~30 字',
    example:  '结合具体实例撰写解析，先说明原理，再举一个实际案例帮助理解，60~100 字',
};

function openAIModal() {
    const saved = JSON.parse(localStorage.getItem('kikkua_ai_config') || '{}');
    if (saved.apiKey) document.getElementById('aiApiKey').value = saved.apiKey;
    if (saved.baseUrl) document.getElementById('aiBaseUrl').value = saved.baseUrl;
    if (saved.model) document.getElementById('aiModel').value = saved.model;

    document.getElementById('aiStatus').className = 'ai-status';
    document.getElementById('aiStatusText').textContent = '';
    document.getElementById('btnGenerateAI').disabled = false;
    document.getElementById('aiModal').classList.add('show');
}

function closeAIModal() {
    document.getElementById('aiModal').classList.remove('show');
}

function toggleAIConfig() {
    document.getElementById('aiConfigPanel').classList.toggle('show');
}

function selectAIType(el) {
    el.parentElement.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    aiType = el.dataset.type;
}

function selectAIMode(el) {
    el.parentElement.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    aiMode = el.dataset.mode;
    document.getElementById('aiBatchHint').textContent = aiMode === 'single'
        ? 'AI 会从内容中选取最核心的知识点，生成 1 道题。'
        : aiMode === 'batch'
        ? 'AI 会完整覆盖所有知识点生成题目，按难度分布。'
        : '整理模式：粘贴格式混乱的题目，AI 会自动整理为标准格式并导入。';

    const knowledgeInput = document.getElementById('aiKnowledgeInput');
    if (aiMode === 'organize') {
        knowledgeInput.placeholder = '在此粘贴需要整理的题目内容（格式不限），AI 会自动识别并整理为标准格式...';
    } else {
        knowledgeInput.placeholder = '在此粘贴知识点、课文段落、笔记等任何内容，AI 会据此生成题目...';
    }
}

function selectAnalysisStyle(el) {
    el.parentElement.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    aiAnalysisStyle = el.dataset.style;
}

function setAIStatus(type, text) {
    const el = document.getElementById('aiStatus');
    el.className = 'ai-status show ' + type;
    document.getElementById('aiStatusText').textContent = text;
}

function buildPrompt() {
    const chapter = document.getElementById('aiChapter').value.trim();
    const content = document.getElementById('aiKnowledgeInput').value.trim();
    const analysisRule = ANALYSIS_STYLE_MAP[aiAnalysisStyle] || ANALYSIS_STYLE_MAP.default;
    const countRule = aiMode === 'single'
        ? '只生成 1 道题，从内容中选取最核心的知识点出题'
        : '完整覆盖内容中的所有知识点生成题目，数量根据实际知识点数量决定，不遗漏任何知识点';
    const chapterRule = chapter ? `Chapter 字段统一填写「${chapter}」` : 'Chapter 字段根据内容自行归类';
    const diffRule = aiMode === 'batch' ? `- 难度分布：大致按 3:5:2 的比例分配「识记」「理解」「应用」三个层次的题目，不要全部集中在同一层次\n` : '';

    const base = `你是一个专业的题目出题助手。根据用户提供的知识内容生成高质量考题。

硬性规则：
- 只输出 CSV 格式数据，禁止输出任何解释、说明、markdown 标记（如 \`\`\`csv）
- 第一行是表头，后续每行一道题
- 字段含逗号或换行时必须用英文双引号包裹，字段内部的双引号用两个双引号转义
- ${countRule}
- ${chapterRule}
- ${diffRule}- Analysis（解析）：${analysisRule}
- Reference（知识点来源）字段：从内容中提取该题涉及的核心知识点名称，如「光合作用的定义」「牛顿第二定律」`;

    if (aiMode === 'organize') {
        const organizeBase = `你是一个专业的题目整理助手。用户会提供格式混乱、不规范的题目内容，你需要将其整理为标准 CSV 格式。

硬性规则：
- 只输出 CSV 格式数据，禁止输出任何解释、说明、markdown 标记（如 \`\`\`csv）
- 第一行是表头，后续每行一道题
- 字段含逗号或换行时必须用英文双引号包裹，字段内部的双引号用两个双引号转义
- 必须完整保留所有题目，不得遗漏任何一道
- 必须准确还原每道题的原始内容，不得篡改题意、选项或答案
- 如果原始内容中存在完全重复的题目，只保留 1 道
- 如果某道题缺少选项或答案等关键信息，在对应字段标注「[待补全]」，不要删除该题
- ${chapterRule}
- Reference 字段：从内容中提取该题涉及的核心知识点名称`;

        if (aiType === 'choice') {
            return `${organizeBase}

将题目整理为选择题格式。
表头：Type,Question,OptionA,OptionB,OptionC,OptionD,OptionE,Answer,Analysis,Reference,Chapter

字段要求：
- Type：固定填写 choice
- Question：题干，表述清晰完整
- OptionA ~ OptionE：各选项内容，根据题目需要决定选项数量（至少 4 个，最多 6 个，不需要的选项留空）
- 如果原始题目选项不足 4 个，用相关内容补齐至 4 个
- Answer：正确选项的大写字母，单选填一个字母（如 B），多选填多个字母（如 AC）
- 保留原始题目的单选/多选设定；如果原始题目未标明，默认为单选

以下是需要整理的题目内容：
${content}`;
        } else if (aiType === 'cloze') {
            return `${organizeBase}

将题目整理为填空题格式。
表头：Type,ClozeText,Analysis,Reference,Chapter

字段要求：
- Type：固定填写 cloze
- ClozeText：将原始题目中的关键术语用 [[正确答案]] 挖空
- 每道题可挖 1~3 个空，挖空内容应是理解该知识点必不可少的关键术语
- 如果原始题目已有下划线或括号标注的填空位置，按原始位置处理

以下是需要整理的题目内容：
${content}`;
        } else {
            return `${organizeBase}

将题目整理为问答题格式。
表头：Type,Question,AnswerText,Analysis,Reference,Chapter

字段要求：
- Type：固定填写 short
- Question：问题，表述清晰
- AnswerText：完整的标准答案

以下是需要整理的题目内容：
${content}`;
        }
    }

    if (aiType === 'choice') {
        return `${base}

生成选择题。
表头：Type,Question,OptionA,OptionB,OptionC,OptionD,OptionE,Answer,Analysis,Reference,Chapter

字段要求：
- Type：固定填写 choice
- Question：题干，表述清晰完整，包含足够的上下文信息
- OptionA ~ OptionE：各选项内容，根据题目需要决定选项数量（至少 4 个，最多 6 个，不需要的选项留空）
- 干扰项要求：每个错误选项必须是该知识点中容易混淆的概念或常见误解，不能是明显无关或荒谬的内容
- Answer：正确选项的大写字母，默认生成单选题（填一个字母如 B）；仅当题目明确考查「以下哪些」「多选」时才填多个字母（如 AC）
- 大部分题目应为单选题，多选题占比不超过 20%

以下是知识内容：
${content}`;
    } else if (aiType === 'cloze') {
        return `${base}

生成填空题。
表头：Type,ClozeText,Analysis,Reference,Chapter

字段要求：
- Type：固定填写 cloze
- ClozeText：在关键位置用 [[正确答案]] 挖空，如「光合作用需要 [[阳光]]、[[水]] 和 [[二氧化碳]]」
- 每道题可挖 1~3 个空，挖空内容应是理解该知识点必不可少的关键术语，去掉后该句无法靠上下文推断
- 不要在不重要的修饰词、连接词上挖空
- 如果知识内容适合拆成多道填空题，可以生成多道

以下是知识内容：
${content}`;
    } else {
        return `${base}

生成问答题（简答/论述）。
表头：Type,Question,AnswerText,Analysis,Reference,Chapter

字段要求：
- Type：固定填写 short
- Question：问题，表述清晰，明确指出答题方向（如「简述」「比较」「分析原因」）
- AnswerText：完整的标准答案，简答题 2~3 句话点明核心要点，论述题需分点展开、逻辑完整
- 如果知识内容适合拆成多道问答题，可以生成多道

以下是知识内容：
${content}`;
    }
}

async function copyPrompt() {
    const content = document.getElementById('aiKnowledgeInput').value.trim();
    if (!content) { setAIStatus('error', '请输入知识内容'); return; }

    const prompt = buildPrompt();
    const systemMsg = aiMode === 'organize'
        ? '你是一个专业的题目整理助手，只输出 CSV 格式数据，绝不输出任何多余文字。必须完整保留所有题目，不得遗漏。'
        : '你是一个专业的题目出题助手，只输出 CSV 格式数据，绝不输出任何多余文字。';

    const fullPrompt = `[System]\n${systemMsg}\n\n[User]\n${prompt}`;

    try {
        await navigator.clipboard.writeText(fullPrompt);
        setAIStatus('success', '已复制到剪切板！请粘贴到 AI 对话中，生成后回来导入');
        setTimeout(() => { closeAIModal(); openTextImport(); }, 800);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = fullPrompt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        setAIStatus('success', '已复制到剪切板！请粘贴到 AI 对话中，生成后回来导入');
        setTimeout(() => { closeAIModal(); openTextImport(); }, 800);
    }
}

async function generateAI() {
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const baseUrl = document.getElementById('aiBaseUrl').value.trim().replace(/\/+$/, '');
    const model = document.getElementById('aiModel').value;
    const content = document.getElementById('aiKnowledgeInput').value.trim();

    if (!apiKey) { setAIStatus('error', '请先配置 API Key'); document.getElementById('aiConfigPanel').classList.add('show'); return; }
    if (!content) { setAIStatus('error', '请输入知识内容'); return; }

    localStorage.setItem('kikkua_ai_config', JSON.stringify({ apiKey, baseUrl, model }));

    const prompt = buildPrompt();
    setAIStatus('loading', '正在生成，请稍候...');
    document.getElementById('btnGenerateAI').disabled = true;

    try {
        const resp = await fetch(baseUrl + '/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: aiMode === 'organize'
                        ? '你是一个专业的题目整理助手，只输出 CSV 格式数据，绝不输出任何多余文字。必须完整保留所有题目，不得遗漏。'
                        : '你是一个专业的题目出题助手，只输出 CSV 格式数据，绝不输出任何多余文字。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.4,
                max_tokens: 16384,
            })
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`API 请求失败 (${resp.status}): ${err}`);
        }

        const data = await resp.json();
        let csvText = data.choices?.[0]?.message?.content?.trim() || '';
        csvText = csvText.replace(/^```(?:csv)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        if (!csvText) throw new Error('AI 返回内容为空');

        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('AI 返回数据格式异常，行数不足');

        const aoa = lines.map(parseCSVLine);
        const header = aoa[0].map(h => String(h).trim().toLowerCase());
        const validHeaders = ['type','question','clozetext','answertext','answer','analysis','reference','chapter',
            'optiona','optionb','optionc','optiond','optione','optionf','optiong'];
        if (!header.some(h => validHeaders.includes(h))) throw new Error('AI 返回的表头不包含有效字段');

        importAOA(aoa);
        const rowCount = aoa.length - 1;
        setAIStatus('success', `成功生成 ${rowCount} 道题并导入表格`);
        setTimeout(closeAIModal, 1200);
    } catch (err) {
        setAIStatus('error', err.message);
    } finally {
        document.getElementById('btnGenerateAI').disabled = false;
    }
}

function openTextImport() {
    document.getElementById('textInputArea').value = '';
    document.getElementById('textImportModal').classList.add('show');
    document.getElementById('textInputArea').focus();
}

// ═══ Button Events ═══
function bindEvents() {
    document.getElementById('optCount').addEventListener('change', function() { setOptCols(this.value); });
    document.getElementById('btnAddRow').addEventListener('click', () => addRow());
    document.getElementById('btnAddRows').addEventListener('click', addRows);
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('btnExportCSV').addEventListener('click', () => document.getElementById('csvFormatModal').classList.add('show'));
    document.getElementById('btnExportXLSX').addEventListener('click', exportXLSX);
    document.getElementById('btnTemplate').addEventListener('click', downloadTemplate);
    document.getElementById('btnAI').addEventListener('click', openAIModal);
    document.getElementById('btnClear').addEventListener('click', () => {
        if (confirm('确定清空全部数据？')) { tbody.innerHTML = ''; renumber(); }
    });

    // File import
    document.getElementById('fileInput').addEventListener('change', handleImport);

    // CSV format modal
    document.getElementById('btnCancelCsvFmt').addEventListener('click', () => document.getElementById('csvFormatModal').classList.remove('show'));
    document.getElementById('btnDoExportCSV').addEventListener('click', () => {
        const fmt = document.querySelector('input[name="csvFmt"]:checked').value;
        document.getElementById('csvFormatModal').classList.remove('show');
        if (fmt === 'kikkua') exportKikkuaCSV(); else exportStandardCSV();
    });

    // Text import modal
    document.getElementById('btnCancelTextImport').addEventListener('click', () => document.getElementById('textImportModal').classList.remove('show'));
    document.getElementById('btnDoTextImport').addEventListener('click', doTextImport);

    // Row form modal
    document.getElementById('btnCancelForm').addEventListener('click', closeForm);
    document.getElementById('btnCancelForm2').addEventListener('click', closeForm);
    document.getElementById('btnSaveForm').addEventListener('click', saveForm);
    document.getElementById('formGrid').addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); saveForm(); }
    });

    // AI modal
    document.getElementById('btnCancelAI').addEventListener('click', closeAIModal);
    document.getElementById('btnCopyPrompt').addEventListener('click', copyPrompt);
    document.getElementById('btnGenerateAI').addEventListener('click', generateAI);
    document.getElementById('aiConfigToggle').addEventListener('click', toggleAIConfig);

    // AI type chips
    document.getElementById('aiTypeChips').addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (chip) selectAIType(chip);
    });

    // AI mode chips
    document.getElementById('aiModeChips').addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (chip) selectAIMode(chip);
    });

    // AI analysis style chips
    document.getElementById('aiAnalysisChips').addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (chip) selectAnalysisStyle(chip);
    });

    // Close modals on mask click
    document.getElementById('aiModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAIModal(); });

    // Table action clicks (delete button)
    tbody.addEventListener('click', e => {
        const actionsTd = e.target.closest('td.actions');
        if (actionsTd) delRow(actionsTd);
    });
}

// ═══ Init ═══
bindEvents();
buildColGroup();
addRow(); addRow(); addRow();
