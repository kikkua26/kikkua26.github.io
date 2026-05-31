// kikkua · 制卡工具 — 工具函数

import { rootEl } from './constants.js';

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const genId = () => 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

let toastTimer;
export function toast(msg, type) {
    const el = rootEl?.querySelector('#cmToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'cm-toast ' + (type || '') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
