// kikkua · 制卡工具 — 本地知识笔记管理器
// 纯本地工具，数据存储在 localStorage，不与 GitHub 交互

import { replaceFields, wrapWithCSS, escapeRegex } from '../card.js';

const STORAGE_KEY = 'kikkua_cardmaker_data_v1';
const DRAFT_KEY = 'kikkua_cardmaker_draft';
const TEMPLATE_NAME = 'kikkua高级模板';

// ── State ──
let state = {
    notebooks: {},
    activeNotebook: '',
    currentNoteId: null,
    expandedChapters: new Set(),
    searchQuery: '',
    batchMode: false,
    batchSet: new Set(),
    initialized: false,
};

// ── Template cache ──
let templateCache = null; // { front: '...', back: '...', css: '...' }

// ── DOM Refs (set on init) ──
let $ = () => null;
let rootEl = null;

// ── Helpers ──
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const genId = () => 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

// ── Data Layer ──
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            state.notebooks = JSON.parse(raw);
            const names = Object.keys(state.notebooks);
            if (names.length === 0) {
                state.notebooks = { '默认笔记本': [] };
                state.activeNotebook = '默认笔记本';
            } else if (!state.notebooks[state.activeNotebook]) {
                state.activeNotebook = names[0];
            }
        } else {
            state.notebooks = createDefaultData();
            state.activeNotebook = '默认笔记本';
        }
    } catch {
        state.notebooks = createDefaultData();
        state.activeNotebook = '默认笔记本';
    }
    // Ensure all values are arrays
    for (const k of Object.keys(state.notebooks)) {
        if (!Array.isArray(state.notebooks[k])) state.notebooks[k] = [];
    }
    flushData();
}

function createDefaultData() {
    return {
        '默认笔记本': [
            { id: genId(), mainField: '变量与数据类型', chapter: '编程::Python::基础',
              knowledgeAnalysis: '定义::变量是存储数据的容器，Python支持动态类型<br>###常见类型::int、float、str、bool、list、tuple、dict、set',
              extendedAnalysis: '类型推断::Python在运行时自动推断变量类型<br>###内存管理::变量通过引用计数进行内存管理' },
            { id: genId(), mainField: '控制流程', chapter: '编程::Python::基础',
              knowledgeAnalysis: '条件语句::if-elif-else结构<br>###循环::for循环和while循环',
              extendedAnalysis: '列表推导式::提供简洁的循环写法 [x for x in range(10)]' },
        ],
    };
}

function flushData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notebooks)); }
    catch { toast('存储空间不足，请导出数据！', 'error'); }
}

function activeNotes() { return state.notebooks[state.activeNotebook] || []; }

// ── Draft Save/Restore ──
function saveDraft(formData) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData)); } catch {}
}
function loadDraft() {
    try { const r = sessionStorage.getItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
}
function clearDraft() { sessionStorage.removeItem(DRAFT_KEY); }

// ── Subfield Parse/Serialize ──
function parseSubfields(raw) {
    if (!raw || !raw.trim()) return [];
    return raw.split('<br>###').map(p => {
        const idx = p.trim().indexOf('::');
        if (idx >= 0) return { name: p.substring(0, idx).trim(), content: p.substring(idx + 2).trim() };
        return { name: '', content: p.trim() };
    }).filter(f => f.name || f.content);
}

function serializeSubfields(fields) {
    if (!fields || !fields.length) return '';
    return fields.map(f => (f.name || '') + '::' + (f.content || '')).join('<br>###');
}

// ── CSV ──
function parseCSV(text) {
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

function generateCSV(notes) {
    const escCsv = v => {
        const s = String(v || '');
        return /[,"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = ['主字段,章节,知识解析,拓展解析'];
    for (const n of notes) rows.push([escCsv(n.mainField), escCsv(n.chapter), escCsv(n.knowledgeAnalysis), escCsv(n.extendedAnalysis)].join(','));
    return '﻿' + rows.join('\n');
}

function downloadCSV(csv, filename) {
    const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = filename;
    a.click(); URL.revokeObjectURL(a.href);
}

// ── Tree ──
function buildChapterTree(notes) {
    const root = { children: {}, notes: [], fullPath: '' };
    for (const n of notes) {
        const cp = (n.chapter || '').trim();
        if (!cp) { root.notes.push(n); continue; }
        const parts = cp.split('::').map(p => p.trim()).filter(Boolean);
        if (!parts.length) { root.notes.push(n); continue; }
        let cur = root; let acc = '';
        for (const p of parts) {
            acc = acc ? acc + '::' + p : p;
            if (!cur.children[p]) cur.children[p] = { children: {}, notes: [], fullPath: acc, name: p };
            cur = cur.children[p];
        }
        cur.notes.push(n);
    }
    return root;
}

function sortTree(node) {
    const keys = Object.keys(node.children).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const sorted = {};
    for (const k of keys) sorted[k] = sortTree(node.children[k]);
    node.children = sorted;
    node.notes.sort((a, b) => (a.mainField || '').localeCompare(b.mainField || '', 'zh-CN'));
    return node;
}

function countTreeNotes(node) {
    let c = node.notes.length;
    for (const k of Object.keys(node.children)) c += countTreeNotes(node.children[k]);
    return c;
}

// ── Render ──
function renderAll() {
    const notes = activeNotes();
    let filtered = notes;
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = notes.filter(n => (n.mainField || '').toLowerCase().includes(q) || (n.chapter || '').toLowerCase().includes(q));
    }
    const tree = sortTree(buildChapterTree(filtered));

    // Note count
    const countEl = rootEl.querySelector('#cmNoteCount');
    if (countEl) countEl.textContent = filtered.length + '条笔记';

    // Tree
    const treeEl = rootEl.querySelector('#cmTree');
    if (!treeEl) return;
    if (!notes.length) {
        treeEl.innerHTML = '<div class="cm-empty"><div class="cm-empty-icon">📝</div><p>暂无笔记</p><p style="font-size:12px;">新建笔记或导入CSV开始使用</p></div>';
    } else {
        let html = '';
        for (const n of tree.notes) html += renderNoteNode(n, 0);
        for (const k of Object.keys(tree.children)) html += renderChapterNode(tree.children[k], 0);
        treeEl.innerHTML = html;
    }

    // Chapter tags
    renderChapterTags(notes);

    // Notebook selector
    const sel = rootEl.querySelector('#cmNotebook');
    if (sel) {
        sel.innerHTML = Object.keys(state.notebooks).map(n => `<option value="${esc(n)}"${n === state.activeNotebook ? ' selected' : ''}>📓 ${esc(n)}</option>`).join('');
    }

    // Status
    const status = rootEl.querySelector('#cmStatus');
    if (status) status.textContent = `📓 ${state.activeNotebook} · ${notes.length}条` + (state.currentNoteId ? ' · 编辑中' : '');
}

function renderChapterNode(node, depth) {
    const hasKids = Object.keys(node.children).length > 0;
    const cnt = countTreeNotes(node);
    const expanded = state.expandedChapters.has(node.fullPath);
    let h = `<div class="cm-chapter" data-path="${esc(node.fullPath)}">`;
    h += `<div class="cm-tree-row" style="padding-left:${12 + depth * 16}px;" data-action="chapter-click" data-path="${esc(node.fullPath)}">`;
    h += `<span class="cm-toggle${hasKids ? (expanded ? ' expanded' : '') : ''}" data-action="chapter-toggle" data-path="${esc(node.fullPath)}">▶</span>`;
    h += `<span class="cm-icon">📁</span>`;
    h += `<span class="cm-label">${esc(node.name)}</span>`;
    if (cnt > 0) h += `<span class="cm-badge">${cnt}</span>`;
    h += `</div></div>`;
    h += `<div class="cm-children${expanded ? ' expanded' : ''}" data-children="${esc(node.fullPath)}">`;
    for (const n of node.notes) h += renderNoteNode(n, depth + 1);
    for (const k of Object.keys(node.children)) h += renderChapterNode(node.children[k], depth + 1);
    h += `</div>`;
    return h;
}

function renderNoteNode(note, depth) {
    const active = state.currentNoteId === note.id ? ' active' : '';
    const checked = state.batchSet.has(note.id);
    const label = note.mainField || '(未命名)';
    return `<div class="cm-note" data-note-id="${note.id}">
        <div class="cm-tree-row${active}" style="padding-left:${12 + depth * 16 + 20}px;" data-action="note-click" data-note-id="${note.id}">
            ${state.batchMode ? `<input type="checkbox" class="cm-check" data-action="batch-check" data-note-id="${note.id}" ${checked ? 'checked' : ''}>` : ''}
            <span class="cm-toggle" style="visibility:hidden;">▶</span>
            <span class="cm-icon">📄</span>
            <span class="cm-label">${esc(label)}</span>
        </div>
    </div>`;
}

function renderChapterTags(notes) {
    const el = rootEl.querySelector('#cmChapterTags');
    if (!el) return;
    const set = new Set();
    for (const n of notes) {
        const cp = (n.chapter || '').trim();
        if (!cp) continue;
        set.add(cp);
        const parts = cp.split('::').filter(Boolean);
        let acc = '';
        for (const p of parts) { acc = acc ? acc + '::' + p : p; set.add(acc); }
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b, 'zh-CN')).slice(0, 15);
    const cur = (rootEl.querySelector('#cmInputChapter')?.value || '').trim();
    el.innerHTML = sorted.map(p => `<span class="cm-tag${p === cur ? ' active' : ''}" data-action="tag-click" data-path="${esc(p)}">${esc(p)}</span>`).join('')
        + (set.size > 15 ? `<span style="font-size:11px;color:var(--text3);">...共${set.size}个</span>` : '');
}

// ── Form ──
const q = (sel) => rootEl.querySelector(sel);

function clearForm(keepChapter) {
    state.currentNoteId = null;
    state.batchMode = false;
    state.batchSet.clear();
    const ch = q('#cmInputChapter'); if (ch && !keepChapter) ch.value = '';
    const mf = q('#cmInputMain'); if (mf) mf.value = '';
    const kf = q('#cmKnowledgeFields'); if (kf) kf.innerHTML = '';
    const ef = q('#cmExtendedFields'); if (ef) ef.innerHTML = '';
    const del = q('#cmBtnDelete'); if (del) del.style.display = 'none';
    const bat = q('#cmBtnBatch'); if (bat) bat.style.display = 'none';
    const sch = q('#cmSearch'); if (sch) sch.value = '';
    state.searchQuery = '';
    addSubfield('knowledge', true);
    addSubfield('extended', true);
    clearDraft();
    renderAll();
    setTimeout(updatePreview, 30);
}

function loadForm(note) {
    state.currentNoteId = note.id;
    const chEl = rootEl.querySelector('#cmInputChapter');
    const mfEl = rootEl.querySelector('#cmInputMain');
    if (chEl) chEl.value = note.chapter || '';
    if (mfEl) mfEl.value = note.mainField || '';

    const kf = rootEl.querySelector('#cmKnowledgeFields');
    kf.innerHTML = '';
    const kFields = parseSubfields(note.knowledgeAnalysis);
    (kFields.length ? kFields : [{ name: '', content: '' }]).forEach(f => addSubfield('knowledge', false, f.name, f.content));

    const ef = rootEl.querySelector('#cmExtendedFields');
    ef.innerHTML = '';
    const eFields = parseSubfields(note.extendedAnalysis);
    (eFields.length ? eFields : [{ name: '', content: '' }]).forEach(f => addSubfield('extended', false, f.name, f.content));

    rootEl.querySelector('#cmBtnDelete').style.display = 'inline-flex';
    clearDraft();
    renderAll();
    // Trigger preview immediately (DOM is populated synchronously)
    setTimeout(updatePreview, 30);
}

function getFormData() {
    return {
        chapter: rootEl.querySelector('#cmInputChapter').value.trim(),
        mainField: rootEl.querySelector('#cmInputMain').value.trim(),
        knowledgeAnalysis: serializeSubfields(collectSubfields('knowledge')),
        extendedAnalysis: serializeSubfields(collectSubfields('extended')),
    };
}

function collectSubfields(type) {
    const c = rootEl.querySelector(type === 'knowledge' ? '#cmKnowledgeFields' : '#cmExtendedFields');
    const fields = [];
    c.querySelectorAll('.cm-subfield').forEach(el => {
        const n = el.querySelector('.cm-sf-name')?.value?.trim() || '';
        const ct = el.querySelector('.cm-sf-content')?.value?.trim() || '';
        if (n || ct) fields.push({ name: n, content: ct });
    });
    return fields;
}

function addSubfield(type, isInit, name, content) {
    const c = rootEl.querySelector(type === 'knowledge' ? '#cmKnowledgeFields' : '#cmExtendedFields');
    const div = document.createElement('div');
    div.className = 'cm-subfield';
    div.innerHTML = `<div class="cm-sf-inputs">
        <input class="cm-sf-name" placeholder="字段名称" value="${esc(name || '')}">
        <textarea class="cm-sf-content" placeholder="字段内容..." rows="2">${esc(content || '')}</textarea>
    </div><button class="cm-sf-remove" data-action="remove-subfield" title="移除">✕</button>`;
    c.appendChild(div);
    if (!isInit && !name && !content) setTimeout(() => div.querySelector('.cm-sf-name')?.focus(), 100);
}

function removeSubfield(btn) {
    const c = btn.closest('.cm-subfield')?.parentElement;
    if (!c) return;
    if (c.querySelectorAll('.cm-subfield').length <= 1) {
        const sf = c.querySelector('.cm-subfield');
        sf.querySelector('.cm-sf-name').value = '';
        sf.querySelector('.cm-sf-content').value = '';
        toast('至少保留一个字段（已清空）');
        return;
    }
    btn.closest('.cm-subfield').remove();
}

// ── Actions ──
function saveNote() {
    const fd = getFormData();
    if (!fd.mainField && !fd.chapter) { toast('请至少填写知识名称或章节路径', 'error'); return; }
    const notes = activeNotes();
    if (state.currentNoteId) {
        const idx = notes.findIndex(n => n.id === state.currentNoteId);
        if (idx >= 0) {
            notes[idx] = { ...notes[idx], ...fd };
            toast('笔记已更新', 'success');
        } else {
            state.currentNoteId = null;
            notes.push({ id: genId(), ...fd });
        }
    } else {
        const nn = { id: genId(), ...fd };
        notes.push(nn);
        state.currentNoteId = nn.id;
        toast('笔记已保存', 'success');
    }
    flushData();
    clearDraft();
    rootEl.querySelector('#cmBtnDelete').style.display = 'inline-flex';
    renderAll();
    setTimeout(updatePreview, 30);
}

function deleteNote() {
    if (!state.currentNoteId) return;
    if (!confirm('确定要删除这条笔记吗？此操作不可恢复。')) return;
    const notes = activeNotes();
    const idx = notes.findIndex(n => n.id === state.currentNoteId);
    if (idx >= 0) { notes.splice(idx, 1); flushData(); toast('笔记已删除', 'success'); }
    clearForm(false);
}

function deleteBatch() {
    if (!state.batchSet.size) return;
    if (!confirm(`确定删除 ${state.batchSet.size} 条笔记吗？此操作不可恢复。`)) return;
    const notes = activeNotes();
    state.notebooks[state.activeNotebook] = notes.filter(n => !state.batchSet.has(n.id));
    flushData();
    state.batchSet.clear();
    state.batchMode = false;
    rootEl.querySelector('#cmBtnBatch').style.display = 'none';
    toast('已删除选中笔记', 'success');
    renderAll();
}

// ── Template Loading ──
async function loadTemplate() {
    if (templateCache) return templateCache;
    const base = `/templates/${encodeURIComponent(TEMPLATE_NAME)}/`;
    try {
        const [frontResp, backResp, cssResp] = await Promise.all([
            fetch(base + '正面模板.html'), fetch(base + '背面模板.html'), fetch(base + '样式.css'),
        ]);
        templateCache = {
            front: frontResp.ok ? await frontResp.text() : '{{主字段}}',
            back: backResp.ok ? await backResp.text() : '{{FrontSide}}\n<hr>\n{{主字段}}',
            css: cssResp.ok ? await cssResp.text() : '',
        };
    } catch {
        templateCache = { front: '{{主字段}}', back: '{{FrontSide}}\n<hr>\n{{主字段}}', css: '' };
    }
    return templateCache;
}

// ── Preview ──
let previewSeq = 0;
async function updatePreview() {
    const iframe = rootEl.querySelector('#cmPreviewFrame');
    const infoEl = rootEl.querySelector('#cmPreviewInfo');
    if (!iframe) return;
    const seq = ++previewSeq;
    const tmpl = await loadTemplate();
    if (seq !== previewSeq) return; // Skip stale calls
    const fd = getFormData();

    // Build record object matching kikkua template fields
    const record = {
        '主字段': fd.mainField || ' ',
        '章节': fd.chapter || '',
        '等级': '',
        '提要': '',
        '用户笔记': '',
        '知识解析': fd.knowledgeAnalysis || '',
        '知识拓展': fd.extendedAnalysis || '',
    };

    // Debug: show what data is being sent to template
    if (infoEl) {
        const hasData = record['主字段'].trim() || record['章节'] || record['知识解析'] || record['知识拓展'];
        infoEl.innerHTML = hasData
            ? `主字段:${record['主字段']?.slice(0,20) || '-'} | 章节:${record['章节']?.slice(0,20) || '-'} | 解析:${(record['知识解析']?.length||0)}字 | 拓展:${(record['知识拓展']?.length||0)}字`
            : '⚠ 表单为空，请选择笔记或填写字段';
        infoEl.style.color = hasData ? 'var(--green)' : 'var(--accent)';
    }

    // 1. Replace fields in front template, then wrap with CSS
    const frontHTML = replaceFields(tmpl.front, record);
    const wrappedFront = wrapWithCSS(frontHTML, tmpl.css);

    // 2. Extract body from wrapped front HTML (for {{FrontSide}})
    const bodyMatch = wrappedFront.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const frontBody = bodyMatch ? bodyMatch[1] : wrappedFront;

    // 3. Replace fields in back template, then inject {{FrontSide}} body
    const backWithFields = replaceFields(tmpl.back, record);
    const backWithFront = backWithFields.replace(/\{\{FrontSide\}\}/gi, frontBody);

    // 4. Wrap back template with CSS to get full HTML document
    let backHTML = wrapWithCSS(backWithFront, tmpl.css);

    // 5. Inject dummy decrypt functions to prevent ReferenceError
    backHTML = backHTML.replace(/<\/head>/i, '<script>function decryptBack(){}function decryptFront(){}</script></head>');

    iframe.srcdoc = backHTML;
}

// ── Quick Paste Auto-Parse ──
function showQuickPaste() {
    const modal = rootEl.querySelector('#cmPasteModal');
    const input = rootEl.querySelector('#cmPasteInput');
    if (modal && input) { modal.style.display = 'flex'; input.value = ''; input.focus(); }
}
function hideQuickPaste() { const m = rootEl.querySelector('#cmPasteModal'); if (m) m.style.display = 'none'; }

async function aiParse() {
    const input = rootEl.querySelector('#cmPasteInput');
    const btn = rootEl.querySelector('#cmAiParse');
    console.log('AI Parse triggered', { hasInput: !!input, hasBtn: !!btn, rootEl: !!rootEl });
    if (!input || !btn) return;
    const text = input.value.trim();
    if (!text) { toast('请先粘贴内容', 'error'); return; }

    const dsKey = rootEl.querySelector('#cmDsKey')?.value?.trim();
    if (!dsKey) { toast('请先在工具栏填写 DeepSeek API Key', 'error'); return; }
    if (!dsKey.startsWith('sk-')) { toast('API Key 格式不正确（应以 sk- 开头）', 'error'); return; }

    // Save key + model
    try { localStorage.setItem('kikkua_ds_key', dsKey); } catch {}
    try { localStorage.setItem('kikkua_ds_model', rootEl.querySelector('#cmDsModel')?.value || 'deepseek-v4-pro'); } catch {}

    btn.disabled = true;
    btn.textContent = '⏳ AI 思考中...';
    console.log('Calling DeepSeek with model:', rootEl.querySelector('#cmDsModel')?.value);
    try {
        const result = await callDeepSeek(text, dsKey);
        console.log('DeepSeek response:', result);
        const data = typeof result === 'string' ? JSON.parse(result) : result;
        parseDataObject(data);
        hideQuickPaste();
        const kCount = Object.keys(data['知识解析'] || {}).length;
        const eCount = Object.keys(data['拓展解析'] || data['知识拓展'] || {}).length;
        toast(`AI 解析完成：${data['主字段'] || ''} | ${kCount + eCount}条字段`, 'success');
    } catch (e) {
        toast('AI 解析失败: ' + (e.message || '未知错误'), 'error');
        console.error('DeepSeek error:', e);
    }
    btn.disabled = false;
    btn.textContent = '🤖 AI 解析';
}

async function callDeepSeek(text, apiKey) {
    const systemPrompt = `你是知识卡片结构化助手。无论用户输入的是自由文本、笔记摘录、教材段落、聊天记录还是已标注字段，都要准确解析。只输出JSON。

输出格式：
{
  "主字段": "知识点名称（≤20字，提取核心概念）",
  "章节": "层级路径（用::分隔，如 方剂学::解表剂；无法推断则为空字符串）",
  "知识解析": { "要点1": "内容", "要点2": "内容" },
  "拓展解析": { "补充1": "内容" }
}

解析规则：
1. 如果输入已含"主字段："等标记 → 直接提取
2. 如果是自由文本 → 先判断知识领域，再提炼核心概念作为主字段
3. 章节推断：从上下文推断学科归属（中西医/理工/人文等），识别章节/单元信息
4. 知识解析：提取3-5个关键点，可以是 定义/组成/功效/主治/特征/原理/步骤 等，字段名≤8字
5. 拓展解析：提取1-3个补充信息，如 方歌/口诀/鉴别/举例/注意事项/记忆技巧 等
6. 如果输入本身就是结构化的 name：value 格式，保留原有字段名
7. 如果输入是纯数据/表格，按列名拆分为不同字段
8. 空白字段用空字符串""，不要写"无"或"暂无"
9. 只输出JSON，不要markdown包裹`;

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: rootEl.querySelector('#cmDsModel')?.value || 'deepseek-v4-pro',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: 0.3,
            max_tokens: 2000,
        }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Try to extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 未返回有效的 JSON');
    return JSON.parse(jsonMatch[0]);
}

function parseDataObject(obj) {
    const chapter = obj['章节'] || obj['chapter'] || obj['Chapter'] || '';
    const mainField = obj['主字段'] || obj['Front'] || obj['mainField'] || obj['知识名称'] || '';
    const knowledge = [];
    const extended = [];
    if (obj['知识解析']) {
        if (typeof obj['知识解析'] === 'string') parseSubfieldString(obj['知识解析']).forEach(f => knowledge.push(f));
        else if (typeof obj['知识解析'] === 'object') Object.entries(obj['知识解析']).forEach(([k, v]) => knowledge.push({ name: k, content: String(v) }));
    }
    if (obj['拓展解析'] || obj['知识拓展']) {
        const val = obj['拓展解析'] || obj['知识拓展'];
        if (typeof val === 'string') parseSubfieldString(val).forEach(f => extended.push(f));
        else if (typeof val === 'object') Object.entries(val).forEach(([k, v]) => extended.push({ name: k, content: String(v) }));
    }
    fillFormFromParsed({ chapter, mainField, knowledge, extended });
}

function parseSubfieldString(raw) {
    if (!raw) return [];
    return raw.split(/<br>###|\n###|\n(?=[^：:\n]+[：:])/).map(s => {
        const m = s.trim().match(/^(.+?)[：:]\s*(.*)$/);
        return m ? { name: m[1].trim(), content: m[2].trim() } : { name: '', content: s.trim() };
    }).filter(f => f.name || f.content);
}

function fillFormFromParsed(data) {
    const chEl = rootEl.querySelector('#cmInputChapter');
    const mfEl = rootEl.querySelector('#cmInputMain');
    if (chEl) chEl.value = data.chapter || '';
    if (mfEl) mfEl.value = data.mainField || '';

    const kf = rootEl.querySelector('#cmKnowledgeFields');
    kf.innerHTML = '';
    (data.knowledge.length ? data.knowledge : [{ name: '', content: '' }]).forEach(f => addSubfield('knowledge', false, f.name, f.content));

    const ef = rootEl.querySelector('#cmExtendedFields');
    ef.innerHTML = '';
    (data.extended.length ? data.extended : [{ name: '', content: '' }]).forEach(f => addSubfield('extended', false, f.name, f.content));

    if (data.mainField || data.chapter) {
        state.currentNoteId = null;
        rootEl.querySelector('#cmBtnDelete').style.display = 'none';
    }
    renderAll();
    setTimeout(updatePreview, 60);
}

// Wrap updatePreview with error handling for setTimeout calls
const _updatePreviewSafe = updatePreview;
updatePreview = function() { _updatePreviewSafe().catch(e => console.warn('Preview update failed:', e)); };

function previewIfNeeded() {
    const panel = rootEl.querySelector('.cm-preview-panel');
    if (panel && panel.offsetParent !== null) updatePreview();
}

// ── Import/Export ──
function importCSV(file) {
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

function exportCSV() {
    const notes = activeNotes();
    const csv = generateCSV(notes);
    downloadCSV(csv, (state.activeNotebook || '笔记本') + '.csv');
    toast('已导出 CSV', 'success');
}

// ── Toast ──
let toastTimer;
function toast(msg, type) {
    const el = rootEl.querySelector('#cmToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'cm-toast ' + (type || '') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Event Delegation ──
function setupEvents() {
    // Global click delegation
    rootEl.addEventListener('click', e => {
        const row = e.target.closest('[data-action]');
        if (!row) return;
        const action = row.dataset.action;

        if (action === 'chapter-click') {
            const path = row.dataset.path;
            rootEl.querySelector('#cmInputChapter').value = path;
            rootEl.querySelector('#cmInputMain').value = '';
            rootEl.querySelector('#cmKnowledgeFields').innerHTML = '';
            rootEl.querySelector('#cmExtendedFields').innerHTML = '';
            addSubfield('knowledge', true);
            addSubfield('extended', true);
            rootEl.querySelector('#cmBtnDelete').style.display = 'none';
            state.currentNoteId = null;
            state.batchMode = false; state.batchSet.clear();
            rootEl.querySelector('#cmBtnBatch').style.display = 'none';
            clearDraft();
            rootEl.querySelector('#cmInputMain').focus();
            renderAll();
            setTimeout(updatePreview, 30);
        } else if (action === 'note-click') {
            if (e.target.matches('input[type=checkbox]')) return;
            const notes = activeNotes();
            const note = notes.find(n => n.id === row.dataset.noteId);
            if (note) {
                loadForm(note);
                rootEl.querySelector('#cmContentScroll').scrollTop = 0;
                // Force immediate preview update after DOM settles
                requestAnimationFrame(() => { requestAnimationFrame(() => updatePreview()); });
            }
        } else if (action === 'chapter-toggle') {
            const path = row.dataset.path;
            state.expandedChapters.has(path) ? state.expandedChapters.delete(path) : state.expandedChapters.add(path);
            renderAll();
        } else if (action === 'tag-click') {
            rootEl.querySelector('#cmInputChapter').value = row.dataset.path;
            rootEl.querySelector('#cmInputMain').focus();
            renderAll();
        } else if (action === 'remove-subfield') {
            removeSubfield(e.target);
        } else if (action === 'batch-check') {
            const nid = row.dataset.noteId;
            state.batchSet.has(nid) ? state.batchSet.delete(nid) : state.batchSet.add(nid);
        } else if (action === 'add-knowledge') {
            addSubfield('knowledge', false);
        } else if (action === 'add-extended') {
            addSubfield('extended', false);
        }
    });

    // Helper: safe event listener
    const on = (id, event, fn) => {
        const el = rootEl.querySelector(id);
        if (el) el.addEventListener(event, fn);
    };

    // Buttons
    on('#cmBtnSave', 'click', saveNote);
    on('#cmBtnClear', 'click', () => {
        if (state.currentNoteId && !confirm('正在编辑笔记，清空表单将放弃当前修改。确定清空吗？')) return;
        clearForm(false);
    });
    on('#cmBtnDelete', 'click', deleteNote);
    on('#cmBtnNew', 'click', () => { clearForm(false); rootEl.querySelector('#cmInputMain')?.focus(); });

    on('#cmBtnNewNb', 'click', () => {
        const name = prompt('新笔记本名称：', '笔记本_' + new Date().toLocaleDateString('zh-CN'));
        if (!name || !name.trim()) return;
        const tn = name.trim();
        if (state.notebooks[tn]) { toast('该笔记本已存在', 'error'); return; }
        state.notebooks[tn] = [];
        state.activeNotebook = tn;
        flushData();
        clearForm(false);
        renderAll();
    });

    on('#cmBtnExport', 'click', exportCSV);
    on('#cmBtnImport', 'click', () => rootEl.querySelector('#cmFileInput')?.click());
    on('#cmFileInput', 'change', function () {
        if (this.files[0]) { importCSV(this.files[0]); this.value = ''; }
    });

    on('#cmBtnBatch', 'click', deleteBatch);

    // Notebook selector
    on('#cmNotebook', 'change', function () {
        const name = this.value;
        if (name && state.notebooks[name]) {
            const fd = getFormData();
            if (fd.mainField || fd.chapter) saveDraft(fd);
            state.activeNotebook = name;
            state.currentNoteId = null;
            clearDraft();
            renderAll();
            const draft = loadDraft();
            if (draft && draft.mainField) {
                const chEl = rootEl.querySelector('#cmInputChapter');
                const mEl = rootEl.querySelector('#cmInputMain');
                if (chEl) chEl.value = draft.chapter || '';
                if (mEl) mEl.value = draft.mainField || '';
            } else {
                clearForm(false);
            }
            toast('已切换: ' + name, 'success');
        }
    });

    // Search
    on('#cmSearch', 'input', function () {
        state.searchQuery = this.value.trim();
        renderAll();
    });

    // Chapter input
    on('#cmInputChapter', 'input', () => { renderAll(); });
    on('#cmInputChapter', 'blur', () => { renderAll(); });

    // Form change → auto-save draft
    const formEls = rootEl.querySelectorAll('#cmInputChapter, #cmInputMain');
    formEls.forEach(el => el.addEventListener('input', () => {
        if (state.currentNoteId) saveDraft(getFormData());
    }));

    // Keyboard
    rootEl.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveNote(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); clearForm(false); rootEl.querySelector('#cmInputMain')?.focus(); }
    });

    // Auto-update preview on form input (debounced) + blur (immediate)
    let previewTimer;
    rootEl.addEventListener('input', e => {
        if (e.target.closest('#cmInputChapter, #cmInputMain, .cm-sf-name, .cm-sf-content')) {
            clearTimeout(previewTimer);
            previewTimer = setTimeout(updatePreview, 300);
        }
    });
    rootEl.addEventListener('blur', e => {
        if (e.target.closest('#cmInputChapter, #cmInputMain, .cm-sf-name, .cm-sf-content')) {
            clearTimeout(previewTimer);
            updatePreview();
        }
    }, true);

    // Quick paste modal
    on('#cmPasteCancel', 'click', hideQuickPaste);
    on('#cmPasteApply', 'click', applyQuickPaste);
    on('#cmAiParse', 'click', aiParse);
    rootEl.querySelector('#cmPasteModal')?.addEventListener('click', e => { if (e.target === e.currentTarget) hideQuickPaste(); });

    // Expose to admin.html button
    window._cmQuickPaste = showQuickPaste;

    // Batch toggle
    on('#cmBtnToggleBatch', 'click', () => {
        state.batchMode = !state.batchMode;
        state.batchSet.clear();
        const batchBtn = rootEl.querySelector('#cmBtnBatch');
        const toggleBtn = rootEl.querySelector('#cmBtnToggleBatch');
        if (batchBtn) batchBtn.style.display = state.batchMode ? 'inline-flex' : 'none';
        if (toggleBtn) toggleBtn.textContent = state.batchMode ? '☑ 取消批量' : '☑ 批量';
        renderAll();
    });
}

// ── Init ──
export function initCardMaker(containerEl) {
    rootEl = containerEl;
    $ = (sel) => containerEl.querySelector(sel);
    if (state.initialized) { renderAll(); return; }

    loadData();
    setupEvents();
    state.initialized = true;
    // Restore saved API key + model
    const savedKey = localStorage.getItem('kikkua_ds_key');
    if (savedKey) { const el = rootEl.querySelector('#cmDsKey'); if (el) el.value = savedKey; }
    const savedModel = localStorage.getItem('kikkua_ds_model');
    if (savedModel) { const el = rootEl.querySelector('#cmDsModel'); if (el) el.value = savedModel; }
    clearForm(false);
    renderAll();
    setTimeout(updatePreview, 100);

    // Restore draft if any
    const draft = loadDraft();
    if (draft && draft.mainField) {
        rootEl.querySelector('#cmInputChapter').value = draft.chapter || '';
        rootEl.querySelector('#cmInputMain').value = draft.mainField || '';
    }
}

export function destroyCardMaker() {
    // Save draft before leaving
    const fd = getFormData();
    if (fd.mainField || fd.chapter) saveDraft(fd);
}
