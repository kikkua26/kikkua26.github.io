// kikkua · 制卡工具 — APKG 导出
// 参考 question-bank/modules/apkg.js 实现

import { state, rootEl } from './constants.js';
import { activeNotes } from './data.js';
import { toast } from './utils.js';
import { loadScript } from '../../shared/sdk.js';

let apkgModel = null;

// ═══════════════════════════════════════
// 加载依赖库
// ═══════════════════════════════════════

async function loadDeps() {
    if (window._sqlJsReady && window.JSZip) return;
    await Promise.all([
        loadScript('/tools/question-bank/lib/jszip.min.js'),
        loadScript('/tools/question-bank/lib/sql-wasm.js'),
    ]);
    if (!window._sqlJsReady) {
        const SQL = await initSqlJs({
            locateFile: file => '/tools/question-bank/lib/' + file
        });
        window._sqlJsReady = SQL;
    }
}

// ═══════════════════════════════════════
// Phase 1: 解析上传的 apkg 提取模板
// ═══════════════════════════════════════

export async function parseApkg(file) {
    await loadDeps();

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 查找 collection 文件
    let dbFile = zip.file('collection.anki21') || zip.file('collection.anki2');
    if (!dbFile) throw new Error('无效的 apkg 文件：找不到 collection.anki2');

    const dbBuffer = await dbFile.async('uint8array');
    const SQL = window._sqlJsReady;
    const db = new SQL.Database(dbBuffer);

    // 查询模型
    const result = db.exec('SELECT models FROM col WHERE id = 1');
    if (!result.length || !result[0].values.length) {
        throw new Error('无法读取模板信息');
    }

    const models = JSON.parse(result[0].values[0][0]);
    const modelKeys = Object.keys(models);

    // 查找 kikkua Pro+ 智能卡片模板
    let foundModel = null;
    for (const key of modelKeys) {
        const m = models[key];
        if (m.name && m.name.includes('kikkua Pro')) {
            foundModel = m;
            break;
        }
    }

    // 如果没找到，尝试模糊匹配
    if (!foundModel) {
        for (const key of modelKeys) {
            const m = models[key];
            if (m.name && (m.name.includes('kikkua') || m.name.includes('智能卡片'))) {
                foundModel = m;
                break;
            }
        }
    }

    // 如果还是没找到，使用第一个模板
    if (!foundModel && modelKeys.length > 0) {
        foundModel = models[modelKeys[0]];
    }

    if (!foundModel) throw new Error('未找到可用的模板');

    // 检查模板字段
    const fieldNames = foundModel.flds.map(f => f.name);
    console.log('模板字段:', fieldNames);

    apkgModel = foundModel;
    db.close();

    return {
        name: foundModel.name,
        fields: fieldNames,
    };
}

// ═══════════════════════════════════════
// Phase 2: 导出 apkg
// ═══════════════════════════════════════

export async function exportApkg(deckName) {
    if (!apkgModel) {
        toast('请先上传 apkg 模板文件', 'error');
        return;
    }

    await loadDeps();

    const notes = activeNotes();
    if (!notes.length) {
        toast('当前笔记本没有笔记', 'error');
        return;
    }

    const SQL = window._sqlJsReady;
    const db = new SQL.Database();

    // 创建表
    db.run(`CREATE TABLE col (
        id integer primary key, crt integer, mod integer, scm integer,
        ver integer, dty integer, usn integer, ls integer,
        conf text, models text, decks text, dconf text, tags text
    )`);

    db.run(`CREATE TABLE notes (
        id integer primary key, guid text, mid integer, mod integer,
        usn integer, tags text, flds text, sfld text,
        csum integer, flags integer, data text
    )`);

    db.run(`CREATE TABLE cards (
        id integer primary key, nid integer, did integer, ord integer,
        mod integer, usn integer, type integer, queue integer,
        due integer, ivl integer, factor integer, reps integer,
        lapses integer, left integer, odue integer, odid integer,
        flags integer, data text
    )`);

    db.run(`CREATE TABLE revlog (
        id integer primary key, cid integer, usn integer, ease integer,
        ivl integer, lastIvl integer, factor integer, time integer, type integer
    )`);

    db.run(`CREATE TABLE graves (usn integer, oid integer, type integer)`);

    // 准备模型
    const now = Date.now();
    const modelId = now;
    const model = JSON.parse(JSON.stringify(apkgModel));
    model.id = modelId;
    model.mod = Math.floor(now / 1000);
    model.usn = -1;

    // 创建牌组
    const deckId = now + 1;
    const decks = {
        "1": { id: 1, name: "Default", mod: 0, usn: 0, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], collapsed: false, browserCollapsed: false, desc: "", dyn: 0, conf: 1 },
        [deckId]: {
            id: deckId,
            name: deckName || 'kikkua卡片',
            mod: Math.floor(now / 1000),
            usn: -1,
            lrnToday: [0, 0],
            revToday: [0, 0],
            newToday: [0, 0],
            timeToday: [0, 0],
            collapsed: false,
            browserCollapsed: false,
            desc: "",
            dyn: 0,
            conf: 1
        }
    };

    // 支持子牌组（按章节分）
    const chapterDecks = {};
    for (const note of notes) {
        if (note.chapter) {
            const parts = note.chapter.split('::');
            let path = '';
            for (const part of parts) {
                const parentPath = path;
                path = path ? path + '::' + part : part;
                const deckPath = deckName ? deckName + '::' + path : path;
                if (!chapterDecks[deckPath]) {
                    const subId = now + 100 + Object.keys(chapterDecks).length;
                    chapterDecks[deckPath] = {
                        id: subId,
                        name: deckPath,
                        mod: Math.floor(now / 1000),
                        usn: -1,
                        lrnToday: [0, 0],
                        revToday: [0, 0],
                        newToday: [0, 0],
                        timeToday: [0, 0],
                        collapsed: false,
                        browserCollapsed: false,
                        desc: "",
                        dyn: 0,
                        conf: 1
                    };
                    decks[subId] = chapterDecks[deckPath];
                }
            }
        }
    }

    // 配置
    const conf = {
        activeDecks: [1],
        addToCur: true,
        curDeck: 1,
        curModel: modelId.toString(),
        dueCounts: true,
        estTimes: true,
        newBury: true,
        newSpread: 0,
        nextPos: 1,
        sortBackwards: false,
        sortType: "noteFld",
        timeLim: 0,
        collapseTime: 1200
    };

    const dconf = {
        "1": {
            id: 1,
            mod: 0,
            name: "Default",
            usn: 0,
            maxTaken: 60,
            autoplay: true,
            timer: 0,
            replayq: true,
            new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 0, perDay: 20 },
            rev: { bury: true, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 100, hardFactor: 1.2, fuzz: 0.05 },
            lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
            dyn: false
        }
    };

    // 插入 col
    db.run(
        'INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [1, Math.floor(now / 1000), Math.floor(now / 1000), now, 11, 0, -1, 0,
         JSON.stringify(conf), JSON.stringify({ [modelId]: model }),
         JSON.stringify(decks), JSON.stringify(dconf), '{}']
    );

    // 插入笔记和卡片
    const fieldNames = model.flds.map(f => f.name);
    const stmtNotes = db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const stmtCards = db.prepare('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        const noteId = now + 100 + i;
        const cardId = now + 10000 + i;

        // 构建字段值（按模板字段顺序）
        const fieldValues = buildNoteFields(note, fieldNames);
        const flds = fieldValues.join('\x1f');
        const sfld = stripHtml(fieldValues[0] || '');
        const csum = sha1hex(sfld);

        // 确定牌组
        let did = deckId;
        if (note.chapter && chapterDecks[deckName + '::' + note.chapter]) {
            did = chapterDecks[deckName + '::' + note.chapter].id;
        } else if (note.chapter && !deckName && chapterDecks[note.chapter]) {
            did = chapterDecks[note.chapter].id;
        }

        // 插入笔记
        stmtNotes.run([
            noteId, genGuid(), modelId, Math.floor(now / 1000),
            -1, '', flds, sfld, csum, 0, ''
        ]);

        // 插入卡片
        stmtCards.run([
            cardId, noteId, did, 0,
            Math.floor(now / 1000), -1, 0, 0,
            i, 0, 0, 0, 0, 0, 0, 0, 0, ''
        ]);
    }

    stmtNotes.free();
    stmtCards.free();

    // 导出数据库
    const dbData = db.export();
    db.close();

    // 打包 apkg
    const zip = new JSZip();
    zip.file('collection.anki2', dbData);
    zip.file('media', '{}');

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
    downloadBlob(blob, (deckName || 'kikkua卡片') + '.apkg');

    toast(`已导出 ${notes.length} 张卡片`, 'success');
}

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

function buildNoteFields(note, fieldNames) {
    // 卡片制作器字段映射到模板字段
    const fieldMap = {
        '主字段': note.mainField || '',
        '章节': note.chapter || '',
        '知识解析': note.knowledgeAnalysis || '',
        '知识拓展': note.extendedAnalysis || '',
        '知识名称': note.mainField || '',
        '等级': note.level || '',
        '提要': '',
        '用户笔记': '',
    };

    // 按模板字段顺序返回值
    return fieldNames.map(name => fieldMap[name] || '');
}

function stripHtml(html) {
    return String(html).replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
}

function sha1hex(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + ch;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

function genGuid() {
    return Math.random().toString(36).slice(2, 10);
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════
// UI 交互
// ═══════════════════════════════════════

export function showApkgModal() {
    const modal = rootEl.querySelector('#cmApkgModal');
    if (modal) modal.classList.remove('hidden');
}

export function hideApkgModal() {
    const modal = rootEl.querySelector('#cmApkgModal');
    if (modal) modal.classList.add('hidden');
}

export function handleApkgUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.apkg';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = rootEl.querySelector('#cmApkgStatus');
        if (statusEl) {
            statusEl.textContent = '⏳ 解析中...';
            statusEl.className = 'cm-ai-status';
            statusEl.classList.remove('hidden');
        }

        try {
            const result = await parseApkg(file);
            if (statusEl) {
                statusEl.innerHTML = `✅ 模板已加载: ${esc(result.name)}<br><span class="test-detail">字段: ${result.fields.join(', ')}</span>`;
                statusEl.className = 'cm-ai-status success';
            }
        } catch (e) {
            if (statusEl) {
                statusEl.textContent = '❌ ' + e.message;
                statusEl.className = 'cm-ai-status error';
            }
        }
    };
    input.click();
}

export async function handleApkgExport() {
    const nameInput = rootEl.querySelector('#cmApkgDeckName');
    const deckName = nameInput?.value?.trim() || state.activeNotebook || 'kikkua卡片';
    await exportApkg(deckName);
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
