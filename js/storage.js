export const ICONS = {
    back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
    cards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    click: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>`,
    scroll: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>`
};

import { STORAGE } from './config.js';

export const sessionCache = {
    get(key) {
        try {
            const raw = sessionStorage.getItem(STORAGE.cache + key);
            if (!raw) return null;
            const { data, expires } = JSON.parse(raw);
            if (expires && Date.now() > expires) {
                sessionStorage.removeItem(STORAGE.cache + key);
                return null;
            }
            return data;
        } catch { return null; }
    },
    set(key, value, ttlMs = 0) {
        try {
            sessionStorage.setItem(STORAGE.cache + key, JSON.stringify({
                data: value, expires: ttlMs ? Date.now() + ttlMs : 0
            }));
        } catch {}
    }
};

export class Storage {
    constructor() { this.prefix = STORAGE.progress; }
    get(key) {
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    }
    set(key, value) {
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch (e) { console.warn('Storage error:', e); }
    }
    getDeckProgress(deckName) {
        return this.get(`progress_${deckName}`) || { lastIndex: 0, lastStudy: null };
    }
    saveDeckProgress(deckName, progress) {
        progress.lastStudy = Date.now();
        this.set(`progress_${deckName}`, progress);
    }
}

export const storage = new Storage();
