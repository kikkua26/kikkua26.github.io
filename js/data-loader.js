import { storage, sessionCache } from './storage.js';
import { wrapWithCSS } from './card.js';

export class DataLoader {
    async loadDeck(deckName, { template: templateName = '', chapterField = '章节' } = {}) {
        const cached = sessionCache.get('deck_' + deckName);
        if (cached) return cached;

        const basePath = `/data/${encodeURIComponent(deckName)}`;
        try {
            const csvResp = await fetch(`${basePath}/data.csv`).catch(() => null);
            let template = { front: '', back: '' };
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
            return { template: { front: '', back: '' }, records: [], fields: [], chapterField: '章节' };
        }
    }

    async loadTemplate(templateName) {
        const cached = sessionCache.get('tpl_' + templateName);
        if (cached) return cached;

        const basePath = `/templates/${encodeURIComponent(templateName)}`;
        try {
            const [frontResp, backResp, cssResp] = await Promise.all([
                fetch(`${basePath}/正面模板.html`).catch(() => null),
                fetch(`${basePath}/背面模板.html`).catch(() => null),
                fetch(`${basePath}/样式.css`).catch(() => null)
            ]);
            const css = cssResp?.ok ? await cssResp.text() : '';
            const front = frontResp?.ok ? await frontResp.text() : '{{Front}}';
            const back = backResp?.ok ? await backResp.text() : '{{FrontSide}}\n\n<hr>\n\n{{Back}}';
            const result = { front: wrapWithCSS(front, css), back: wrapWithCSS(back, css) };
            sessionCache.set('tpl_' + templateName, result);
            return result;
        } catch {
            return { front: wrapWithCSS('{{Front}}', ''), back: wrapWithCSS('{{FrontSide}}\n\n<hr>\n\n{{Back}}', '') };
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length === 0) return { fields: [], records: [] };
        const parseLine = (line) => {
            const result = []; let current = ''; let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                } else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
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
            const response = await fetch('/data/index.json');
            if (!response.ok) return [];
            const entries = await response.json();
            const decks = [];
            for (const entry of entries) {
                const progress = storage.getDeckProgress(entry.name);
                decks.push({
                    name: entry.name,
                    lastStudy: progress.lastStudy,
                    totalCards: entry.totalCards || 0,
                    tags: entry.tags || [],
                    detail: entry.detail || '',
                    template: entry.template || '',
                    chapterField: entry.chapterField || '章节',
                    purchaseUrl: entry.purchaseUrl || ''
                });
            }
            return decks;
        } catch { return []; }
    }
}

export const dataLoader = new DataLoader();
