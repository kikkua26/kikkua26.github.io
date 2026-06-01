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
