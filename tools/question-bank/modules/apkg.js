// kikkua · 题库编辑器 — APKG 牌组导出

import { OPT_LETTERS } from './constants.js';
import { esc, loadScript } from './utils.js';
import { collectData, getHiddenOptCols } from './table.js';

let apkgModel = null;

async function loadJSZip() { return loadScript('lib/jszip.min.js?v=1'); }

async function loadSqlJs() {
    await loadScript('lib/sql-wasm.js?v=1');
    if (!window._sqlJsReady) {
        window._sqlJsReady = await initSqlJs({ locateFile: () => 'lib/sql-wasm.wasm?v=1' });
    }
}

function setApkgStatus(el, type, text) {
    el.className = 'apkg-status ' + type;
    el.innerHTML = type === 'loading'
        ? '<span class="ai-spinner"></span> ' + esc(text)
        : esc(text);
}

export function openApkgModal() {
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

export function closeApkgModal() {
    document.getElementById('apkgModal').classList.remove('show');
}

export async function parseApkg(file) {
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
    const visibleOpts = OPT_LETTERS.slice(0, 7 - getHiddenOptCols());
    let options, answer;

    if (row.type === '判断题') {
        options = '正确||错误';
        answer = row.answer === '正确' ? 'A' : row.answer === '错误' ? 'B' : (row.answer || '');
    } else {
        options = visibleOpts.map(o => row['opt' + o] || '').filter(v => v.trim()).join('||');
        answer = row.answer || '';
    }

    const valueMap = {
        'Chapter': row.chapter || '',
        'Type': row.type || '',
        'Question': row.question || '',
        'ClozeText': row.clozetext || '',
        'Options': options,
        'Answer': answer,
        'AnswerText': row.answertext || '',
        'Analysis': row.analysis || '',
        'Refrence': row.reference || '',
        'ImageCloze': '',
    };

    if (valueMap['Refrence'] === '' && row.reference) valueMap['Refrence'] = row.reference;

    return fieldDefs.map(f => valueMap[f.name] !== undefined ? valueMap[f.name] : '');
}

function sha1hex(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash |= 0;
    }
    return (hash >>> 0).toString(16).padStart(8, '0') + '0000000000000000';
}

export async function exportApkg() {
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

        db.run(`CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text)`);
        db.run(`CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text)`);
        db.run(`CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text)`);
        db.run(`CREATE TABLE revlog (id integer primary key, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer)`);
        db.run(`CREATE TABLE graves (usn integer, oid integer, type integer)`);

        const modelId = nowMs;
        const model = JSON.parse(JSON.stringify(apkgModel));
        model.id = modelId;
        model.mod = now;
        model.usn = -1;
        const models = {};
        models[modelId] = model;

        const defaultDeckId = 1;
        const mainDeckId = nowMs + 1;
        const decks = {};
        decks[defaultDeckId] = { id: defaultDeckId, name: 'Default', desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };

        if (useSubDecks) {
            const deckPaths = new Set();
            data.forEach(row => {
                if (row.chapter && row.chapter.trim()) {
                    const parts = row.chapter.split('::');
                    for (let i = 1; i <= parts.length; i++) {
                        deckPaths.add(parts.slice(0, i).join('::'));
                    }
                }
            });

            let deckIdCounter = mainDeckId;
            const deckIdMap = {};
            decks[mainDeckId] = { id: mainDeckId, name: deckName, desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };
            deckIdMap[deckName] = mainDeckId;

            deckPaths.forEach(path => {
                deckIdCounter++;
                const fullName = deckName + '::' + path;
                decks[deckIdCounter] = { id: deckIdCounter, name: fullName, desc: '', dyn: 0, conf: 1, usn: -1, mod: now, collapsed: false, browserCollapsed: false, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0], extendNew: 0, extendRev: 0 };
                deckIdMap[path] = deckIdCounter;
            });

            data.forEach((row, i) => {
                const noteId = nowMs + 100 + i;
                const flds = buildApkgNoteFields(row, model.flds).join('\x1f');
                const sfld = flds.split('\x1f')[0].replace(/<[^>]*>/g, '');
                const csum = sha1hex(sfld).slice(0, 8);
                const guid = Math.random().toString(36).slice(2, 10);

                db.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    [noteId, guid, modelId, now, -1, '', flds, sfld, parseInt(csum, 16), 0, '']);

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

        const conf = JSON.stringify({ activeDecks: [1], addToCur: true, curDeck: 1, curModel: String(modelId), dueCounts: true, estTimes: true, newBury: true, newSpread: 0, nextPos: 1, sortBackwards: false, sortType: 'noteFld', timeLim: 0, collapseTime: 1200 });
        const dconf = JSON.stringify({ '1': { id: 1, name: 'Default', dyn: 0, conf: 1, usn: 0, mod: 0, collapsed: false, browserCollapsed: false, new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true }, rev: { bury: true, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 100, minSpace: 1, fuzz: 0.05 }, lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 }, autoplay: true, replayq: true, timer: 0, maxTaken: 60 } });
        const tags = JSON.stringify({});

        db.run('INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [1, now, now * 1000, now * 1000, 11, 0, -1, 0, conf, JSON.stringify(models), JSON.stringify(decks), dconf, tags]);

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
