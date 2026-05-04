import { UI } from './config.js';

export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const esc = s => (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return UI.time.justNow;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}${UI.time.minutesAgo}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}${UI.time.hoursAgo}`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}${UI.time.daysAgo}`;
    const months = Math.floor(days / 30);
    return `${months}${UI.time.monthsAgo}`;
}
