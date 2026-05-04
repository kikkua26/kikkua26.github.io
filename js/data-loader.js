import { storage } from './storage.js';
import { wrapWithCSS } from './card.js';
import { DATA_PATHS, DEFAULTS } from './config.js';

const _preloaded = new Map();

export function preloadDeck(deckName, templateName, chapterField) {
    if (_preloaded.has(deckName)) return _preloaded.get(deckName);
    const promise = dataLoader._loadDeck(deckName, { template: templateName, chapterField })
        .then(data => { _preloaded.set(deckName, data); return data; });
    _preloaded.set(deckName, promise);
    return promise;
}

export class DataLoader {
    async loadDeck(deckName, { template: templateName = '', chapterField = DEFAULTS.chapterField } = {}) {
        if (_preloaded.has(deckName)) {
            const data = _preloaded.get(deckName);
            _preloaded.delete(deckName);
            const ready = data.then ? await data : data;
            if (templateName && (!ready.template || (!ready.template.front && !ready.template.back))) {
                ready.template = await this.loadTemplate(templateName);
            }
            return ready;
        }
        return this._loadDeck(deckName, { template: templateName, chapterField });
    }

    async _loadDeck(deckName, { template: templateName = '', chapterField = DEFAULTS.chapterField } = {}) {
        const basePath = DATA_PATHS.deckData(deckName);
        try {
            const csvResp = await fetch(basePath).catch(() => null);
            let template = { front: DEFAULTS.templateFront, back: DEFAULTS.templateBack };
            if (templateName) template = await this.loadTemplate(templateName);

            let records = [], csvFields = [];
            if (csvResp?.ok) {
                const csvText = await csvResp.text();
                const parsed = this.parseCSV(csvText);
                csvFields = parsed.fields;
                records = parsed.records;
            }
            return { template, records, fields: csvFields, chapterField };
        } catch (e) {
            console.error('Failed to load deck:', e);
            return { template: { front: DEFAULTS.templateFront, back: DEFAULTS.templateBack }, records: [], fields: [], chapterField };
        }
    }

    async loadTemplate(templateName) {
        try {
            const [frontResp, backResp, cssResp] = await Promise.all([
                fetch(DATA_PATHS.templateFront(templateName), { cache: 'no-cache' }).catch(() => null),
                fetch(DATA_PATHS.templateBack(templateName), { cache: 'no-cache' }).catch(() => null),
                fetch(DATA_PATHS.templateCss(templateName), { cache: 'no-cache' }).catch(() => null)
            ]);
            const css = cssResp?.ok ? await cssResp.text() : '';
            const front = frontResp?.ok ? await frontResp.text() : DEFAULTS.templateFront;
            const back = backResp?.ok ? await backResp.text() : DEFAULTS.templateBack;
            return { front: wrapWithCSS(front, css), back: wrapWithCSS(back, css) };
        } catch {
            return { front: wrapWithCSS(DEFAULTS.templateFront, ''), back: wrapWithCSS(DEFAULTS.templateBack, '') };
        }
    }

    parseCSV(csvText) {
        const text = csvText.replace(/^﻿/, '').trim();
        if (!text) return { fields: [], records: [] };
        const sep = text.includes('\t') && !text.includes(',') ? '\t' : ',';
        // 逐字符解析
        const rows = []; let row = [], field = '', q = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i], next = text[i + 1];
            if (q) {
                if (ch === '"') { if (next === '"') { field += '"'; i++; } else q = false; }
                else field += ch;
            } else {
                if (ch === '"') q = true;
                else if (ch === '\r') continue;
                else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
                else if (ch === sep) { row.push(field); field = ''; }
                else field += ch;
            }
        }
        row.push(field); rows.push(row);
        if (rows.length < 2) return { fields: [], records: [] };
        const header = rows[0].map(f => f.trim());
        const records = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (r.length === 1 && !r[0]) continue;
            const record = {};
            header.forEach((f, idx) => { record[f] = r[idx] !== undefined ? r[idx] : ''; });
            records.push(record);
        }
        return { fields: header, records };
    }

    async discoverDecks() {
        try {
            const response = await fetch(DATA_PATHS.index);
            if (!response.ok) return [];
            const entries = await response.json();
            const decks = [];
            for (const entry of entries) {
                const progress = storage.getDeckProgress(entry.name);
                decks.push({
                    name: entry.name,
                    summary: entry.summary || '',
                    lastStudy: progress.lastStudy,
                    totalCards: entry.totalCards || 0,
                    tags: entry.tags || [],
                    detail: entry.detail || '',
                    template: entry.template || '',
                    chapterField: entry.chapterField || DEFAULTS.chapterField,
                    purchaseUrl: entry.purchaseUrl || ''
                });
            }
            return decks;
        } catch { return []; }
    }
}

export const dataLoader = new DataLoader();
