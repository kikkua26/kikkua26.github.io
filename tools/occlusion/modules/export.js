// kikkua · 遮挡块工具 — 数据导出、复制、提示

import { state } from './state.js';

const $ = s => document.querySelector(s);
let toastTimer;

export function updateJSON() {
    const jsonOutput = $('#json-output');
    jsonOutput.textContent = state.rectangles.length
        ? JSON.stringify(state.rectangles, null, 2)
        : '[]  （在图片上拖动绘制遮挡块）';
}

export function copyData() {
    if (!state.rectangles.length) { toast('没有数据', 'error'); return; }
    navigator.clipboard.writeText(JSON.stringify(state.rectangles)).then(
        () => toast('已复制', 'success'), () => toast('复制失败', 'error')
    );
}

export function toast(msg, type) {
    const toastEl = $('#toast');
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + (type||'info') + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
