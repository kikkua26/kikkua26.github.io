// kikkua · admin — 仪表盘统计

import { decks } from './decks.js';
import { tplNames } from './templates.js';

const $ = s => document.querySelector(s);

export function updateDashboard() {
    const total = decks.reduce((s, d) => s + (d.totalCards || 0), 0);
    $('#statDecks').textContent = decks.length || '-';
    $('#statTemplates').textContent = tplNames.length || '-';
    $('#statCards').textContent = total || '-';
    $('#statData').textContent = decks.filter(d => d.totalCards > 0).length || '-';
}
