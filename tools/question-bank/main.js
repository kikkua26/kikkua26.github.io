// kikkua · 题库编辑器
// 表格化题库管理，支持 CSV/Excel 导入导出、AI 生成

// Lazy-load xlsx library (862KB) only when import/export/template is triggered
let _xlsxLoaded = false, _xlsxLoading = false, _xlsxWaiters = [];
function loadXlsx() {
    if (_xlsxLoaded) return Promise.resolve();
    if (_xlsxLoading) return new Promise(r => _xlsxWaiters.push(r));
    _xlsxLoading = true;
    return new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'lib/xlsx.full.min.js?v=4';
        s.onload = () => { _xlsxLoaded = true; _xlsxLoading = false; _xlsxWaiters.forEach(r => r()); _xlsxWaiters = []; resolve(); };
        document.head.appendChild(s);
    });
}

const tbody = document.getElementById('tbody');
const statusEl = document.getElementById('statusText');
const OPT_LETTERS = ['A','B','C','D','E','F','G'];
let hiddenOptCols = 0;
let editingTr = null;

const VALID_TYPES = ['单选题','多选题','判断题','问答题','挖空题'];
const TYPE_LOCK_MAP = {
    '单选题':  ['clozetext','answertext'],
    '多选题':  ['clozetext','answertext'],
    '判断题':  ['clozetext','answertext','optA','optB','optC','optD','optE','optF','optG'],
    '问答题':  ['clozetext','optA','optB','optC','optD','optE','optF','optG','answer'],
    '挖空题':  ['optA','optB','optC','optD','optE','optF','optG','answer','answertext','question'],
};

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
    html += '<col style="width:' + flexPct + '%">'; // type
    html += '<col style="width:' + flexPct + '%">'; // chapter
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

function buildTypeSelect(val) {
    let html = '<select data-field="type">';
    html += '<option value="">—</option>';
    VALID_TYPES.forEach(t => { html += `<option value="${t}"${val===t?' selected':''}>${t}</option>`; });
    if (val && !VALID_TYPES.includes(val)) html += `<option value="${esc(val)}" selected>${esc(val)}</option>`;
    html += '</select>';
    return html;
}

function applyTypeLock(tr) {
    const typeEl = tr.querySelector('[data-field="type"]');
    const type = typeEl ? typeEl.value : '';
    const locks = TYPE_LOCK_MAP[type] || [];
    tr.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'type') return;
        const locked = locks.includes(field);
        el.disabled = locked;
        el.closest('td').classList.toggle('locked', locked);
        if (locked) el.value = '';
    });
    // 判断题: auto-fill A=正确 B=错误
    if (type === '判断题') {
        const optA = tr.querySelector('[data-field="optA"]');
        const optB = tr.querySelector('[data-field="optB"]');
        if (optA && !optA.value) optA.value = '正确';
        if (optB && !optB.value) optB.value = '错误';
    }
    // Warning badge for non-standard types
    const td = typeEl.closest('td');
    let warn = td.querySelector('.type-warn');
    if (type && !VALID_TYPES.includes(type)) {
        if (!warn) { warn = document.createElement('span'); warn.className = 'type-warn'; warn.textContent = '!'; td.appendChild(warn); }
    } else if (warn) { warn.remove(); }
    applyAnswerHighlight(tr);
}

function applyAnswerHighlight(tr) {
    const answerEl = tr.querySelector('[data-field="answer"]');
    if (!answerEl) return;
    const letters = (answerEl.value || '').toUpperCase().replace(/[^A-G]/g, '');
    OPT_LETTERS.forEach(o => {
        const optTd = tr.querySelector(`[data-col="opt${o}"]`);
        if (optTd) optTd.classList.toggle('answer-hit', letters.includes(o));
    });
    validateAnswer(tr);
}

function validateAnswer(tr) {
    const typeEl = tr.querySelector('[data-field="type"]');
    const answerEl = tr.querySelector('[data-field="answer"]');
    if (!answerEl) return;
    const type = typeEl ? typeEl.value : '';
    const val = (answerEl.value || '').trim();
    const td = answerEl.closest('td');
    let hint = td.querySelector('.ans-hint');

    // Remove old hint
    if (hint) hint.remove();
    td.removeAttribute('data-valid');

    if (!type || !val || TYPE_LOCK_MAP[type]?.includes('answer')) return;

    const maxOpt = 7 - hiddenOptCols;
    const maxLetter = OPT_LETTERS[maxOpt - 1];
    const letters = val.toUpperCase().split('').filter(c => c >= 'A' && c <= maxLetter);
    const validLetters = letters.join('') === val.toUpperCase() && letters.length > 0;

    let msg = '';
    if (type === '单选题') {
        if (val.length !== 1 || !validLetters) msg = `需 1 个字母 (A-${maxLetter})`;
    } else if (type === '多选题') {
        if (!validLetters || letters.length < 2) msg = `需 2+ 个字母 (A-${maxLetter})`;
    } else if (type === '判断题') {
        if (!['A', 'B'].includes(val.toUpperCase())) msg = '需 A 或 B';
    }

    if (msg) {
        td.setAttribute('data-valid', 'no');
        hint = document.createElement('span');
        hint.className = 'ans-hint';
        hint.textContent = msg;
        td.appendChild(hint);
    } else {
        td.setAttribute('data-valid', 'ok');
    }
}

function addRow(data, beforeTr) {
    const tr = document.createElement('tr');
    const d = data || {};
    tr.innerHTML = `<td class="idx" data-col="idx" title="双击编辑 · 右键菜单"></td>`;
    tr.innerHTML += `<td data-col="type">${buildTypeSelect(d.type||'')}</td>`;
    tr.innerHTML += `<td data-col="chapter"><input type="text" data-field="chapter" placeholder="章节" value="${esc(d.chapter||'')}"></td>`;
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
    applyTypeLock(tr);
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
    const filled = Array.from(tbody.rows).filter(tr => !isRowEmpty(tr)).length;
    statusEl.innerHTML = `共 <span class="count">${filled}</span> 行`;
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

function isRowEmpty(tr) {
    return ![...tr.querySelectorAll('[data-field]')].some(el => el.value.trim());
}

function ensureEmptyRows() {
    const rows = Array.from(tbody.rows);
    if (rows.length === 0 || !isRowEmpty(rows[rows.length - 1])) addRow();
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
    { key: 'type', label: 'Type', type: 'select' },
    { key: 'chapter', label: 'Chapter', type: 'text' },
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
    const rows = Array.from(tbody.rows);
    const idx = rows.indexOf(tr);
    document.getElementById('formBadge').textContent = '#' + (idx + 1);
    document.getElementById('formPrev').disabled = idx <= 0;
    document.getElementById('formNext').disabled = idx >= rows.length - 1;

    const data = getRowData(tr);
    renderFormFields(data);

    document.getElementById('rowFormModal').classList.add('show');
    const first = document.getElementById('formGrid').querySelector('input, textarea');
    if (first) first.focus();
}

function renderFormFields(data) {
    const body = document.getElementById('formGrid');
    body.innerHTML = '';
    FORM_FIELDS.forEach(f => {
        const oi = OPT_LETTERS.indexOf(f.key.replace('opt',''));
        if (f.key.startsWith('opt') && oi >= (7 - hiddenOptCols)) return;
        const val = (data || {})[f.key] || '';
        let input;
        if (f.key === 'type') {
            input = buildTypeSelect(val);
        } else {
            const isTextarea = f.type === 'textarea';
            input = isTextarea
                ? `<textarea data-field="${f.key}" rows="1">${esc(val)}</textarea>`
                : `<input type="text" data-field="${f.key}" value="${esc(val)}">`;
        }
        body.innerHTML += `<div class="form-row"><span class="form-label">${f.label}</span>${input}</div>`;
    });
    applyFormTypeLock();
}

function applyFormTypeLock() {
    const grid = document.getElementById('formGrid');
    const typeEl = grid.querySelector('[data-field="type"]');
    const type = typeEl ? typeEl.value : '';
    const locks = TYPE_LOCK_MAP[type] || [];
    grid.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'type') return;
        const row = el.closest('.form-row');
        const locked = locks.includes(field);
        if (locked) { row.style.display = 'none'; }
        else { row.style.display = ''; el.disabled = false; }
    });
    validateFormAnswer();
}

function validateFormAnswer() {
    const grid = document.getElementById('formGrid');
    const typeEl = grid.querySelector('[data-field="type"]');
    const answerEl = grid.querySelector('[data-field="answer"]');
    if (!answerEl) return;
    const type = typeEl ? typeEl.value : '';
    const val = (answerEl.value || '').trim();
    const row = answerEl.closest('.form-row');
    let hint = row.querySelector('.ans-hint');
    if (hint) hint.remove();
    row.removeAttribute('data-valid');
    if (!type || !val || TYPE_LOCK_MAP[type]?.includes('answer')) return;

    const maxOpt = 7 - hiddenOptCols;
    const maxLetter = OPT_LETTERS[maxOpt - 1];
    const letters = val.toUpperCase().split('').filter(c => c >= 'A' && c <= maxLetter);
    const validLetters = letters.join('') === val.toUpperCase() && letters.length > 0;

    let msg = '';
    if (type === '单选题') {
        if (val.length !== 1 || !validLetters) msg = `需 1 个字母 (A-${maxLetter})`;
    } else if (type === '多选题') {
        if (!validLetters || letters.length < 2) msg = `需 2+ 个字母 (A-${maxLetter})`;
    } else if (type === '判断题') {
        if (!['A', 'B'].includes(val.toUpperCase())) msg = '需 A 或 B';
    }

    if (msg) {
        row.setAttribute('data-valid', 'no');
        hint = document.createElement('div');
        hint.className = 'ans-hint';
        hint.textContent = msg;
        row.appendChild(hint);
    } else {
        row.setAttribute('data-valid', 'ok');
    }
}

function closeForm() { document.getElementById('rowFormModal').classList.remove('show'); editingTr = null; }

function collectVisibleFormData(grid) {
    const data = {};
    grid.querySelectorAll('[data-field]').forEach(el => {
        const row = el.closest('.form-row');
        if (row && row.style.display === 'none') return;
        data[el.dataset.field] = el.value;
    });
    return data;
}

function navForm(dir) {
    if (!editingTr) return;
    const grid = document.getElementById('formGrid');
    setRowData(editingTr, collectVisibleFormData(grid));

    const rows = Array.from(tbody.rows);
    const idx = rows.indexOf(editingTr);
    const next = rows[idx + dir];
    if (next) openForm(next);
}

function saveForm() {
    if (!editingTr) return;
    const grid = document.getElementById('formGrid');
    setRowData(editingTr, collectVisibleFormData(grid));
    applyTypeLock(editingTr);
    closeForm();
}

// ═══ Context Menu ═══
let ctxTr = null;

document.addEventListener('contextmenu', e => {
    // Skip if right-clicking a toolbar button (has its own contextmenu handler)
    if (e.target.closest('.toolbar .btn')) return;
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
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    hideCtx();
    if (editingTr) closeForm();
    else document.querySelectorAll('.modal-mask.show').forEach(m => m.classList.remove('show'));
});

function hideCtx() {
    document.getElementById('ctxMenu').style.display = 'none';
    document.getElementById('btnCtxMenu').style.display = 'none';
}

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

// ═══ Button Context Menu ═══
function showBtnCtx(e, items) {
    e.preventDefault();
    const menu = document.getElementById('btnCtxMenu');
    menu.innerHTML = items.map(i => `<div class="ctx-item" data-cb="${i.cb}">${i.label}</div>`).join('');
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
}

document.getElementById('btnCtxMenu').addEventListener('click', e => {
    const item = e.target.closest('.ctx-item');
    if (!item) return;
    hideCtx();
    const cb = item.dataset.cb;
    if (cb === 'addRows') addRows();
    else if (cb === 'downloadTemplate') downloadTemplate();
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

async function exportXLSX() {
    await loadXlsx();
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

async function downloadTemplate() {
    await loadXlsx();
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
    const TYPE_IMPORT_MAP = { '选择题':'单选题','单选题':'单选题','判断题':'判断题','多选题':'多选题','填空题':'挖空题','挖空题':'挖空题','问答题':'问答题','choice':'单选题','cloze':'挖空题','short':'问答题','single choice':'单选题','multiple choice':'多选题','fill-in-the-blank':'挖空题','short answer':'问答题' };
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
        if ((obj.type === '挖空题' || obj.type === '填空题' || obj.type === 'cloze') && !obj.answer && obj.clozetext) {
            const matches = obj.clozetext.match(/\[\[([^\]]*)\]\]/g);
            if (matches) obj.answer = matches.map(m => m.slice(2, -2)).join('|');
        }
        addRow(obj);
    }
    ensureEmptyRows();
}

function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        loadXlsx().then(() => {
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

function stripCodeBlock(text) {
    return text.replace(/^```(?:\w+)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function doTextImport() {
    let text = document.getElementById('textInputArea').value.trim();
    if (!text) { alert('请输入 CSV 数据'); return; }
    text = stripCodeBlock(text);
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
function getInputValue(td) { const i = td.querySelector('input, textarea, select'); return i ? i.value : ''; }
function setInputValue(td, v) {
    const i = td.querySelector('input, textarea, select');
    if (i) { i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }
}
function clearSelection() {
    selection.forEach(t => t.classList.remove('selected', 'fill-range', 'active-cell', 'fill-col'));
    selection = []; activeTd = null;
}
function setActiveCell(td) {
    clearSelection();
    if (!td) return;
    activeTd = td; td.classList.add('active-cell'); selection = [td];
    if (FILL_COLS.includes(td.dataset.col)) td.classList.add('fill-col');
}

document.addEventListener('focusin', e => {
    const td = getTdFromInput(e.target);
    if (td && td.dataset.col !== 'idx' && td.dataset.col !== 'actions') setActiveCell(td);
});

document.addEventListener('mousedown', e => {
    if (!e.target.closest('table') && !e.target.closest('.modal-mask')) clearSelection();
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

// ═══ Fill Handle Drag ═══
const FILL_COLS = ['type', 'chapter'];
let filling = false, fillCol = null, fillStartRow = -1;
document.addEventListener('mousedown', e => {
    const td = e.target.closest('td.fill-col');
    if (!td) return;
    const rect = td.getBoundingClientRect();
    if (e.clientX < rect.right - 12 || e.clientY < rect.bottom - 12) return;
    e.preventDefault();
    filling = true;
    fillCol = td.dataset.col;
    fillStartRow = getRowIndex(td);
});
document.addEventListener('mousemove', e => {
    if (!filling) return;
    const td = e.target.closest('td[data-col="' + fillCol + '"]');
    document.querySelectorAll('td[data-col="' + fillCol + '"].fill-range').forEach(c => c.classList.remove('fill-range'));
    if (!td) return;
    const endRow = getRowIndex(td);
    const lo = Math.min(fillStartRow, endRow);
    const hi = Math.max(fillStartRow, endRow);
    document.querySelectorAll('td[data-col="' + fillCol + '"]').forEach(c => {
        const ri = c.parentElement.rowIndex;
        if (ri >= lo && ri <= hi) c.classList.add('fill-range');
    });
});
document.addEventListener('mouseup', () => {
    if (!filling) return;
    filling = false;
    const targets = document.querySelectorAll('td[data-col="' + fillCol + '"].fill-range');
    const sv = getInputValue(activeTd);
    targets.forEach(c => { if (c !== activeTd) setInputValue(c, sv); });
    targets.forEach(c => c.classList.remove('fill-range'));
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
        : '整理模式：粘贴格式混乱的题目，AI 会自动整理为标准格式并导入。建议每次控制在 50 题以内，效果最佳。';

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
    const chapterRule = chapter
        ? `Chapter 字段统一填写「${chapter}」`
        : 'Chapter 字段根据内容自行归类，多级标题用 :: 分隔（如「中医基础理论::绪论::……」）';
    const diffRule = aiMode === 'batch' ? `- 难度分布：大致按 3:5:2 的比例分配「识记」「理解」「应用」三个层次的题目，不要全部集中在同一层次\n` : '';

    const base = `你是一个专业的题目出题助手。根据用户提供的知识内容生成高质量考题。

硬性规则：
- 只输出一个 \`\`\`csv 代码块，代码块内为 CSV 格式数据，禁止输出代码块以外的任何文字
- 第一行是表头，后续每行一道题
- 字段含逗号或换行时必须用英文双引号包裹，字段内部的双引号用两个双引号转义
- ${countRule}
- ${chapterRule}
- ${diffRule}- Analysis（解析）：${analysisRule}
- Reference（知识点来源）字段：从内容中提取该题涉及的核心知识点名称，如「光合作用的定义」「牛顿第二定律」`;

    if (aiMode === 'organize') {
        const organizeBase = `你是一个专业的题目整理助手。用户会提供格式混乱、不规范的题目内容，你需要将其整理为标准 CSV 格式。

硬性规则：
- 只输出一个 \`\`\`csv 代码块，代码块内为 CSV 格式数据，禁止输出代码块以外的任何文字
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
- Type：根据题目性质填写「单选题」「判断题」或「多选题」（判断题指只有对/错或是/否两个选项的题目），只能使用这三种，不得使用其他值
- Question：题干，表述清晰完整
- OptionA ~ OptionE：各选项内容，根据题目需要决定选项数量（至少 4 个，最多 6 个，不需要的选项留空）
- 如果原始题目选项不足 4 个，用相关内容补齐至 4 个
- Answer：正确选项的大写字母，单选题和判断题填一个字母（如 B），多选题填多个字母（如 AC）
- 保留原始题目的单选/多选/判断设定；如果原始题目未标明，默认为单选题

以下是需要整理的题目内容：
${content}`;
        } else if (aiType === 'cloze') {
            return `${organizeBase}

将题目整理为挖空题格式。
表头：Type,ClozeText,Analysis,Reference,Chapter

字段要求：
- Type：固定填写「挖空题」
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
- Type：固定填写 问答题
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
- Type：根据题目性质填写「单选题」「判断题」或「多选题」（判断题指只有对/错或是/否两个选项的题目），只能使用这三种，不得使用其他值
- Question：题干，表述清晰完整，包含足够的上下文信息
- OptionA ~ OptionE：各选项内容，根据题目需要决定选项数量（至少 4 个，最多 6 个，不需要的选项留空）
- 干扰项要求：每个错误选项必须是该知识点中容易混淆的概念或常见误解，不能是明显无关或荒谬的内容
- Answer：正确选项的大写字母，单选题和判断题填一个字母（如 B），多选题填多个字母（如 AC）

以下是知识内容：
${content}`;
    } else if (aiType === 'cloze') {
        return `${base}

生成挖空题。
表头：Type,ClozeText,Analysis,Reference,Chapter

字段要求：
- Type：固定填写「挖空题」
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
- Type：固定填写 问答题
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
        let csvText = stripCodeBlock(data.choices?.[0]?.message?.content || '');
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

// ═══ APKG Export ═══
let _jszipLoaded = false, _sqlLoaded = false;
let apkgModel = null; // extracted model from uploaded .apkg

function loadJSZip() {
    if (_jszipLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'lib/jszip.min.js?v=1';
        s.onload = () => { _jszipLoaded = true; resolve(); };
        s.onerror = () => reject(new Error('JSZip 加载失败'));
        document.head.appendChild(s);
    });
}

function loadSqlJs() {
    if (_sqlLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'lib/sql-wasm.js?v=1';
        s.onload = async () => {
            try {
                window._sqlJsReady = await initSqlJs({ locateFile: () => 'lib/sql-wasm.wasm?v=1' });
                _sqlLoaded = true;
                resolve();
            } catch (e) { reject(e); }
        };
        s.onerror = () => reject(new Error('sql.js 加载失败'));
        document.head.appendChild(s);
    });
}

function setApkgStatus(el, type, text) {
    el.className = 'apkg-status ' + type;
    el.innerHTML = type === 'loading'
        ? '<span class="ai-spinner"></span> ' + esc(text)
        : esc(text);
}

function openApkgModal() {
    apkgModel = null;
    document.getElementById('apkgFileInput').value = '';
    document.getElementById('apkgFileName').textContent = '尚未选择文件';
    document.getElementById('apkgDeckName').value = '';
    document.getElementById('apkgSubDecks').checked = false;
    document.getElementById('apkgParseStatus').textContent = '';
    document.getElementById('apkgExportStatus').textContent = '';
    document.getElementById('btnDoApkg').disabled = true;
    document.getElementById('apkgModal').classList.add('show');
}

function closeApkgModal() {
    document.getElementById('apkgModal').classList.remove('show');
}

async function parseApkg(file) {
    const statusEl = document.getElementById('apkgParseStatus');
    setApkgStatus(statusEl, 'loading', '正在加载依赖...');
    document.getElementById('apkgFileName').textContent = file.name;
    document.getElementById('btnDoApkg').disabled = true;
    apkgModel = null;

    try {
        setApkgStatus(statusEl, 'loading', '正在加载依赖...');
        await Promise.all([loadJSZip(), loadSqlJs()]);

        setApkgStatus(statusEl, 'loading', '正在解压牌组...');
        const zip = await JSZip.loadAsync(file);
        const dbFile = zip.file('collection.anki2') || zip.file('collection.anki21');
        if (!dbFile) throw new Error('无效的 APKG 文件：缺少 collection.anki2');

        setApkgStatus(statusEl, 'loading', '正在读取数据库...');
        const buf = await dbFile.async('arraybuffer');
        const SQL = window._sqlJsReady;
        const db = new SQL.Database(new Uint8Array(buf));

        const result = db.exec('SELECT models FROM col WHERE id = 1');
        if (!result.length || !result[0].values.length) throw new Error('牌组数据库损坏：无法读取配置');

        setApkgStatus(statusEl, 'loading', '正在查找模板...');
        const models = JSON.parse(result[0].values[0][0]);
        db.close();

        // Find kikkua pro model
        let found = null;
        const allNames = [];
        for (const key of Object.keys(models)) {
            const name = models[key].name || '';
            allNames.push(name);
            if (name.includes('kikkua pro模板') || name.includes('kikkua pro')) {
                found = models[key];
            }
        }
        if (!found) {
            const names = allNames.filter(n => n).join('、') || '无';
            throw new Error('未找到 kikkua pro 模板，请购买正版牌组后重试。当前牌组包含的模板：' + names);
        }

        // Validate required fields
        const requiredFields = ['Question', 'Options', 'Answer', 'ClozeText', 'Chapter', 'Type', 'Analysis'];
        const templateFields = found.flds.map(f => f.name);
        const missing = requiredFields.filter(f => !templateFields.includes(f) && !templateFields.includes(f === 'Refrence' ? 'Reference' : f));
        if (missing.length > 0) {
            throw new Error('模板字段不完整，缺少：' + missing.join('、') + '。当前字段：' + templateFields.join('、'));
        }

        apkgModel = found;
        const fieldNames = found.flds.map(f => f.name).join('、');
        setApkgStatus(statusEl, 'success', '模板已提取 ✓ 字段：' + fieldNames);
        document.getElementById('btnDoApkg').disabled = false;
    } catch (err) {
        setApkgStatus(statusEl, 'error', err.message);
    }
}

function buildApkgNoteFields(row, fieldDefs) {
    // Map table row to Anki field values in template field order
    const visibleOpts = OPT_LETTERS.slice(0, 7 - hiddenOptCols);
    const options = visibleOpts.map(o => row['opt' + o] || '').filter(v => v.trim()).join('||');

    const valueMap = {
        'Chapter': row.chapter || '',
        'Type': row.type || '',
        'Question': row.question || '',
        'ClozeText': row.clozetext || '',
        'Options': options,
        'Answer': row.answer || '',
        'AnswerText': row.answertext || '',
        'Analysis': row.analysis || '',
        'Refrence': row.reference || '',
        'ImageCloze': '',
    };

    // Also try common alternate spellings
    if (valueMap['Refrence'] === '' && row.reference) valueMap['Refrence'] = row.reference;

    return fieldDefs.map(f => valueMap[f.name] !== undefined ? valueMap[f.name] : '');
}

async function exportApkg() {
    const deckName = document.getElementById('apkgDeckName').value.trim();
    if (!deckName) { setApkgStatus(document.getElementById('apkgExportStatus'), 'error', '请输入牌组名称'); return; }
    if (!apkgModel) { setApkgStatus(document.getElementById('apkgExportStatus'), 'error', '请先上传模板牌组'); return; }

    const statusEl = document.getElementById('apkgExportStatus');
    setApkgStatus(statusEl, 'loading', '正在生成牌组，请稍候...');
    document.getElementById('btnDoApkg').disabled = true;

    try {
        const useSubDecks = document.getElementById('apkgSubDecks').checked;
        const data = collectData();
        if (data.length === 0) throw new Error('表格中没有数据');

        const SQL = window._sqlJsReady;
        const db = new SQL.Database();
        const now = Math.floor(Date.now() / 1000);
        const nowMs = Date.now();

        // Create tables
        db.run(`CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text)`);
        db.run(`CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text)`);
        db.run(`CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text)`);
        db.run(`CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer)`);
        db.run(`CREATE TABLE graves (usn integer, oid integer, type integer)`);

        // Model
        const modelId = nowMs;
        const model = JSON.parse(JSON.stringify(apkgModel));
        model.id = modelId;
        model.mod = now;
        model.usn = -1;
        const models = {};
        models[modelId] = model;

        // Decks
        const defaultDeckId = 1;
        const mainDeckId = nowMs + 1;
        const decks = {};
        decks[defaultDeckId] = { id: defaultDeckId, name: 'Default', desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };

        if (useSubDecks) {
            // Collect all unique deck paths from chapter field
            const deckPaths = new Set();
            data.forEach(row => {
                if (row.chapter && row.chapter.trim()) {
                    // Build all ancestor paths too
                    const parts = row.chapter.split('::');
                    for (let i = 1; i <= parts.length; i++) {
                        deckPaths.add(parts.slice(0, i).join('::'));
                    }
                }
            });

            let deckIdCounter = mainDeckId;
            const deckIdMap = {};
            // Main deck
            decks[mainDeckId] = { id: mainDeckId, name: deckName, desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };
            deckIdMap[deckName] = mainDeckId;

            deckPaths.forEach(path => {
                deckIdCounter++;
                const fullName = deckName + '::' + path;
                decks[deckIdCounter] = { id: deckIdCounter, name: fullName, desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };
                deckIdMap[path] = deckIdCounter;
            });

            // Insert notes and cards
            data.forEach((row, i) => {
                const noteId = nowMs + 100 + i;
                const flds = buildApkgNoteFields(row, model.flds).join('\x1f');
                const sfld = flds.split('\x1f')[0].replace(/<[^>]*>/g, '');
                const csum = sha1hex(sfld).slice(0, 8);
                const guid = Math.random().toString(36).slice(2, 10);

                db.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    [noteId, guid, modelId, now, -1, '', flds, sfld, parseInt(csum, 16), 0, '']);

                // Determine deck
                let did = mainDeckId;
                if (row.chapter && row.chapter.trim() && deckIdMap[row.chapter.trim()]) {
                    did = deckIdMap[row.chapter.trim()];
                }

                const cardId = nowMs + 10000 + i;
                db.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    [cardId, noteId, did, 0, now, -1, 0, 0, i, 0, 0, 0, 0, 0, 0, 0, 0, '']);
            });
        } else {
            decks[mainDeckId] = { id: mainDeckId, name: deckName, desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };

            data.forEach((row, i) => {
                const noteId = nowMs + 100 + i;
                const flds = buildApkgNoteFields(row, model.flds).join('\x1f');
                const sfld = flds.split('\x1f')[0].replace(/<[^>]*>/g, '');
                const csum = sha1hex(sfld).slice(0, 8);
                const guid = Math.random().toString(36).slice(2, 10);

                db.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    [noteId, guid, modelId, now, -1, '', flds, sfld, parseInt(csum, 16), 0, '']);

                const cardId = nowMs + 10000 + i;
                db.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    [cardId, noteId, mainDeckId, 0, now, -1, 0, 0, i, 0, 0, 0, 0, 0, 0, 0, 0, '']);
            });
        }

        // Insert col
        const conf = JSON.stringify({ activeDecks: [1], addToCur: true, curDeck: 1, curModel: String(modelId), dueCounts: true, estTimes: true, newBury: true, newSpread: 0, nextPos: 1, sortBackwards: false, sortType: 'noteFld', timeLim: 0, collapseTime: 1200 });
        const dconf = JSON.stringify({ '1': { id: 1, name: 'Default', dyn: 0, conf: 1, usn: 0, mod: 0, collapsed: false, browserCollapsed: false, new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true }, rev: { bury: true, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 100, minSpace: 1, fuzz: 0.05 }, lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 }, autoplay: true, replayq: true, timer: 0, maxTaken: 60 } });
        const tags = JSON.stringify({});

        db.run('INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [1, now, now * 1000, now * 1000, 11, 0, -1, 0, conf, JSON.stringify(models), JSON.stringify(decks), dconf, tags]);

        // Export
        const dbData = db.export();
        db.close();

        const zip = new JSZip();
        zip.file('collection.anki2', dbData);
        zip.file('media', '{}');

        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = deckName + '.apkg';
        a.click();
        URL.revokeObjectURL(a.href);

        setApkgStatus(statusEl, 'success', `导出成功 ✓ ${data.length} 张卡片`);
        setTimeout(closeApkgModal, 1500);
    } catch (err) {
        setApkgStatus(statusEl, 'error', err.message);
    } finally {
        document.getElementById('btnDoApkg').disabled = false;
    }
}

function sha1hex(str) {
    // Simple SHA1 for checksum (Anki uses first 8 hex chars)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
    }
    // Return as hex, padded
    return (hash >>> 0).toString(16).padStart(8, '0') + '0000000000000000';
}

// ═══ Paste Handler (Excel-like) ═══
const PASTE_COL_ORDER = ['chapter','type','question','clozetext','optA','optB','optC','optD','optE','optF','optG','answer','answertext','analysis','reference'];

function getVisibleCols() {
    const visible = 7 - hiddenOptCols;
    return PASTE_COL_ORDER.filter(c => {
        if (!c.startsWith('opt')) return true;
        return OPT_LETTERS.indexOf(c.replace('opt', '')) < visible;
    });
}

function handlePaste(e) {
    const input = e.target;
    if (!input || !input.matches('input[data-field]')) return;

    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;

    const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cells = rows.map(r => r.split('\t'));

    e.preventDefault();

    const tr = input.closest('tr');
    const startTd = input.closest('td');
    const visibleCols = getVisibleCols();
    const startColIdx = visibleCols.indexOf(startTd.dataset.col);
    if (startColIdx < 0) return;

    let currentTr = tr;
    for (let r = 0; r < cells.length; r++) {
        if (!currentTr) {
            currentTr = addRow();
        }
        const inputs = {};
        currentTr.querySelectorAll('input[data-field]').forEach(el => { inputs[el.dataset.field] = el; });

        for (let c = 0; c < cells[r].length; c++) {
            const colIdx = startColIdx + c;
            if (colIdx >= visibleCols.length) break;
            const field = visibleCols[colIdx];
            if (inputs[field]) {
                inputs[field].value = cells[r][c];
                inputs[field].dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        currentTr = currentTr.nextElementSibling;
    }
}

// ═══ Button Events ═══
function bindEvents() {
    document.getElementById('optCount').addEventListener('change', function() {
        setOptCols(this.value);
        // Update open form if editing
        if (editingTr) renderFormFields(getRowData(editingTr));
    });
    document.getElementById('btnAddRow').addEventListener('click', () => addRow());
    document.getElementById('btnAddRow').addEventListener('contextmenu', e => {
        showBtnCtx(e, [{ label: '批量添加', cb: 'addRows' }]);
    });
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('btnImport').addEventListener('contextmenu', e => {
        showBtnCtx(e, [{ label: '下载模板', cb: 'downloadTemplate' }]);
    });
    document.getElementById('btnExport').addEventListener('click', () => document.getElementById('exportModal').classList.add('show'));
    document.getElementById('btnAI').addEventListener('click', openAIModal);
    document.getElementById('btnClear').addEventListener('click', () => {
        if (confirm('确定清空全部数据？')) { tbody.innerHTML = ''; renumber(); localStorage.removeItem(CACHE_KEY); ensureEmptyRows(); }
    });

    // File import
    document.getElementById('fileInput').addEventListener('change', handleImport);

    // Export modal
    document.getElementById('btnCancelExport').addEventListener('click', () => document.getElementById('exportModal').classList.remove('show'));
    document.getElementById('btnDoExport').addEventListener('click', () => {
        const fmt = document.querySelector('input[name="exportFmt"]:checked').value;
        document.getElementById('exportModal').classList.remove('show');
        if (fmt === 'kikkua') exportKikkuaCSV();
        else if (fmt === 'xlsx') exportXLSX();
        else exportStandardCSV();
    });

    // Text import modal
    document.getElementById('btnCancelTextImport').addEventListener('click', () => document.getElementById('textImportModal').classList.remove('show'));
    document.getElementById('btnDoTextImport').addEventListener('click', doTextImport);

    // Row form modal
    document.getElementById('btnCancelForm').addEventListener('click', closeForm);
    document.getElementById('btnCancelForm2').addEventListener('click', closeForm);
    document.getElementById('btnSaveForm').addEventListener('click', saveForm);
    document.getElementById('formGrid').addEventListener('change', e => {
        if (e.target.matches('[data-field="type"]')) applyFormTypeLock();
    });
    document.getElementById('formGrid').addEventListener('input', e => {
        if (e.target.matches('[data-field="answer"]')) validateFormAnswer();
    });
    document.getElementById('formPrev').addEventListener('click', () => navForm(-1));
    document.getElementById('formNext').addEventListener('click', () => navForm(1));
    document.getElementById('rowFormModal').addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); closeForm(); }
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
    document.getElementById('apkgModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeApkgModal(); });

    // APKG modal
    document.getElementById('btnApkg').addEventListener('click', openApkgModal);
    document.getElementById('btnCancelApkg').addEventListener('click', closeApkgModal);
    document.getElementById('btnDoApkg').addEventListener('click', exportApkg);
    document.getElementById('apkgFileInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) parseApkg(file);
    });

    // Table action clicks (delete button)
    tbody.addEventListener('click', e => {
        const actionsTd = e.target.closest('td.actions');
        if (actionsTd) delRow(actionsTd);
    });

    // Paste: Excel-like multi-cell paste
    tbody.addEventListener('paste', handlePaste);
}

// ═══ Data Cache ═══
const CACHE_KEY = 'kikkua_qb_data';
let _cacheTimer = null;

function saveToCache() {
    clearTimeout(_cacheTimer);
    _cacheTimer = setTimeout(() => {
        try {
            const data = collectData();
            if (data.length > 0 && data.some(r => Object.values(r).some(v => v.trim()))) {
                localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            } else {
                localStorage.removeItem(CACHE_KEY);
            }
        } catch {}
    }, 500);
}

function loadFromCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return false;
        data.forEach(row => addRow(row));
        return true;
    } catch { return false; }
}

// ═══ Init ═══
bindEvents();
setOptCols(document.getElementById('optCount').value);
const hasCache = loadFromCache();
if (!hasCache) { for (let i = 0; i < 20; i++) addRow(); }
ensureEmptyRows();

// Auto-save on any input change
let _ensureTimer;
tbody.addEventListener('input', e => {
    saveToCache();
    if (e.target.matches('[data-field="answer"]')) applyAnswerHighlight(e.target.closest('tr'));
    clearTimeout(_ensureTimer);
    _ensureTimer = setTimeout(ensureEmptyRows, 300);
});
tbody.addEventListener('change', e => {
    if (e.target.matches('[data-field="type"]')) {
        applyTypeLock(e.target.closest('tr'));
        saveToCache();
    }
});
// Also save on row delete
const _origRenumber = renumber;
renumber = function() { _origRenumber(); saveToCache(); };
