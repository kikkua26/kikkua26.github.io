// kikkua · 题库编辑器 — localStorage 缓存

import { CACHE_KEY } from './constants.js';
import { collectData } from './table.js';
import { addRow } from './table.js';

let _cacheTimer = null;

export function saveToCache() {
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

export function loadFromCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return false;
        data.forEach(row => addRow(row));
        return true;
    } catch { return false; }
}
