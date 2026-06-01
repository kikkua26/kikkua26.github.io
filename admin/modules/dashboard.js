// kikkua · admin — 仪表盘统计
// 直接从 API 获取数据，不再依赖 decks.js/templates.js

import { readRepo, listRepo } from './api.js';

const $ = s => document.querySelector(s);

export async function updateDashboard() {
    const statDecks = $('#statDecks');
    const statTemplates = $('#statTemplates');
    const statCards = $('#statCards');
    const statData = $('#statData');
    const footerStats = $('#footerStats');

    // Reset
    if (statDecks) statDecks.textContent = '-';
    if (statTemplates) statTemplates.textContent = '-';
    if (statCards) statCards.textContent = '-';
    if (statData) statData.textContent = '-';
    if (footerStats) footerStats.textContent = '';

    try {
        // Load decks
        let decks = [];
        try {
            const r = await readRepo('data/index.json');
            decks = JSON.parse(r.text);
        } catch {}

        // Load templates
        let tplNames = [];
        try {
            const items = await listRepo('templates');
            tplNames = (items || []).filter(i => i.type === 'dir').map(i => i.name);
        } catch {}

        const total = decks.reduce((s, d) => s + (d.totalCards || 0), 0);
        if (statDecks) statDecks.textContent = decks.length || '-';
        if (statTemplates) statTemplates.textContent = tplNames.length || '-';
        if (statCards) statCards.textContent = total || '-';
        if (statData) statData.textContent = decks.filter(d => d.totalCards > 0).length || '-';
        if (footerStats) footerStats.textContent = `📋 ${decks.length} 牌组 · 🎨 ${tplNames.length} 模板`;
    } catch (e) {
        console.warn('Dashboard load failed:', e);
    }
}
