import { storage, sessionCache } from './storage.js';
import { wrapWithCSS } from './card.js';
import { DATA_PATHS, DEFAULTS } from './config.js';

export class DataLoader {
    async loadDeck(deckName, { template: templateName = '', chapterField = DEFAULTS.chapterField } = {}) {
        const cached = sessionCache.get('deck_' + deckName);
        if (cached) return cached;

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
            const result = { template, records, fields: csvFields, chapterField };
            sessionCache.set('deck_' + deckName, result);
            return result;
        } catch (e) {
            console.error('Failed to load deck:', e);
            return { template: { front: DEFAULTS.templateFront, back: DEFAULTS.templateBack }, records: [], fields: [], chapterField };
        }
    }

    async loadTemplate(templateName) {
        const cached = sessionCache.get('tpl_' + templateName);
        if (cached) return cached;

        try {
            const [frontResp, backResp, cssResp] = await Promise.all([
                fetch(DATA_PATHS.templateFront(templateName)).catch(() => null),
                fetch(DATA_PATHS.templateBack(templateName)).catch(() => null),
                fetch(DATA_PATHS.templateCss(templateName)).catch(() => null)
            ]);
            const css = cssResp?.ok ? await cssResp.text() : '';
            const front = frontResp?.ok ? await frontResp.text() : DEFAULTS.templateFront;
            const back = backResp?.ok ? await backResp.text() : DEFAULTS.templateBack;
            const result = { front: wrapWithCSS(front, css), back: wrapWithCSS(back, css) };
            sessionCache.set('tpl_' + templateName, result);
            return result;
        } catch {
            return { front: wrapWithCSS(DEFAULTS.templateFront, ''), back: wrapWithCSS(DEFAULTS.templateBack, '') };
        }
    }

    parseCSV(csvText) {
        const text = csvText.replace(/^﻿/, '');
        const lines = text.trim().split(/\r?\n/);
        if (lines.length === 0) return { fields: [], records: [] };
        const sep = lines[0].includes('\t') && !lines[0].includes(',') ? '\t' : ',';
        const parseLine = (line) => {
            const result = []; let current = ''; let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                } else if (ch === sep && !inQuotes) { result.push(current); current = ''; }
                else { current += ch; }
            }
            result.push(current);
            return result;
        };
        const header = parseLine(lines[0]).map(f => f.trim());
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = parseLine(line);
            const record = {};
            header.forEach((field, idx) => { record[field] = values[idx] !== undefined ? values[idx] : ''; });
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
