// kikkua Pro · 遮挡块工具
// 图片遮挡编辑，生成 Anki 图遮挡题 JSON 数据

document.addEventListener('DOMContentLoaded', () => {

const state = {
    image: null, imageRect: null, naturalSize: null,
    rectangles: [], currentColor: '#FF6B6B', opacity: 0.5,
    isDrawing: false, isDragging: false, startX: 0, startY: 0, currentBlock: null,
    containerRect: null, imageOffset: { x: 0, y: 0 },
};

const COLORS = ['#FF6B6B','#FFD166','#06D6A0','#118AB2','#073B4C','#EF476F','#FF9F1C','#1A936F'];

const $ = s => document.querySelector(s);
const imageEl = $('#image');
const canvasWrap = $('#canvas-wrap');
const drawingLayer = $('#drawing-layer');
const jsonOutput = $('#json-output');
const toastEl = $('#toast');

function init() { renderColorSwatches(); bindEvents(); updateJSON(); }

function renderColorSwatches() {
    $('#preset-colors').innerHTML = COLORS.map(c =>
        `<div class="color-swatch${c===state.currentColor?' active':''}" style="background:${c}" data-color="${c}"></div>`
    ).join('');
}

function selectColor(color) {
    state.currentColor = color;
    $('#custom-color').value = color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
}

// ── Image ──
function loadImage(file) {
    const r = new FileReader();
    r.onload = e => { imageEl.src = e.target.result; };
    r.readAsDataURL(file);
}

function updateRects() {
    state.imageRect = imageEl.getBoundingClientRect();
    state.containerRect = canvasWrap.getBoundingClientRect();
    state.imageOffset.x = state.imageRect.left - state.containerRect.left;
    state.imageOffset.y = state.imageRect.top - state.containerRect.top;
}

function pointInImage(x, y) {
    if (!state.imageRect) return false;
    return x >= state.imageOffset.x && x <= state.imageOffset.x + state.imageRect.width
        && y >= state.imageOffset.y && y <= state.imageOffset.y + state.imageRect.height;
}

// ── Drawing ──
function startDraw(e) {
    if (!state.image) return;
    updateRects();
    const rect = drawingLayer.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (!pointInImage(mx, my)) return;
    if (e.target.closest('.rect-block')) return;

    state.isDrawing = true; state.isDragging = false;
    state.startX = Math.max(mx, state.imageOffset.x);
    state.startY = Math.max(my, state.imageOffset.y);
}

function draw(e) {
    if (!state.isDrawing) return;
    updateRects();
    const rect = drawingLayer.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (!state.isDragging) {
        if (Math.abs(mx - state.startX) < 4 && Math.abs(my - state.startY) < 4) return;
        state.isDragging = true;
        state.currentBlock = createBlock(state.startX, state.startY, 0, 0);
    }

    let left = state.startX, top = state.startY;
    let width = mx - state.startX, height = my - state.startY;

    if (width < 0) { left = Math.max(mx, state.imageOffset.x); width = -width; }
    if (height < 0) { top = Math.max(my, state.imageOffset.y); height = -height; }

    width = Math.min(width, state.imageOffset.x + state.imageRect.width - left);
    height = Math.min(height, state.imageOffset.y + state.imageRect.height - top);

    state.currentBlock.style.left = left + 'px';
    state.currentBlock.style.top = top + 'px';
    state.currentBlock.style.width = width + 'px';
    state.currentBlock.style.height = height + 'px';
}

function endDraw() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    if (!state.isDragging || !state.currentBlock) return;

    const b = state.currentBlock;
    const bw = parseFloat(b.style.width), bh = parseFloat(b.style.height);
    if (bw < 8 || bh < 8) { b.remove(); state.currentBlock = null; state.isDragging = false; return; }

    const ir = state.imageRect, cr = state.containerRect;
    const bx = parseFloat(b.style.left), by = parseFloat(b.style.top);
    state.rectangles.push({
        x: +((bx + cr.left - ir.left) / ir.width).toFixed(4),
        y: +((by + cr.top - ir.top) / ir.height).toFixed(4),
        w: +(bw / ir.width).toFixed(4),
        h: +(bh / ir.height).toFixed(4),
        c: state.currentColor,
    });
    updateJSON();
    state.currentBlock = null; state.isDragging = false;
}

function createBlock(x, y, w, h) {
    const div = document.createElement('div');
    div.className = 'rect-block';
    div.style.left = x + 'px'; div.style.top = y + 'px';
    div.style.width = w + 'px'; div.style.height = h + 'px';
    div.style.backgroundColor = state.currentColor + Math.round(state.opacity*255).toString(16).padStart(2,'0');
    drawingLayer.appendChild(div);
    return div;
}

function removeBlock(b) { b.remove(); rebuildRects(); updateJSON(); }

function rebuildRects() {
    state.rectangles = [];
    updateRects();
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const ir = state.imageRect, cr = state.containerRect;
        const bx = parseFloat(b.style.left), by = parseFloat(b.style.top);
        const bw = parseFloat(b.style.width), bh = parseFloat(b.style.height);
        state.rectangles.push({
            x: +((bx + cr.left - ir.left) / ir.width).toFixed(4),
            y: +((by + cr.top - ir.top) / ir.height).toFixed(4),
            w: +(bw / ir.width).toFixed(4),
            h: +(bh / ir.height).toFixed(4),
            c: b.style.backgroundColor.slice(0,7).toUpperCase(),
        });
    });
}

function redrawBlocks() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => b.remove());
    updateRects();
    state.rectangles.forEach(r => {
        const ir = state.imageRect, cr = state.containerRect;
        const div = createBlock(
            r.x*ir.width + ir.left - cr.left, r.y*ir.height + ir.top - cr.top,
            r.w*ir.width, r.h*ir.height
        );
        div.style.backgroundColor = r.c + Math.round(state.opacity*255).toString(16).padStart(2,'0');
        div.addEventListener('dblclick', () => removeBlock(div));
    });
}

function updateOpacity() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const c = b.style.backgroundColor.slice(0,7);
        b.style.backgroundColor = c + Math.round(state.opacity*255).toString(16).padStart(2,'0');
    });
}

// ── Export ──
function updateJSON() {
    jsonOutput.textContent = state.rectangles.length
        ? JSON.stringify(state.rectangles, null, 2)
        : '[]  （在图片上拖动绘制遮挡块）';
}
function copyData() {
    if (!state.rectangles.length) { toast('没有数据', 'error'); return; }
    navigator.clipboard.writeText(JSON.stringify(state.rectangles)).then(
        () => toast('已复制', 'success'), () => toast('复制失败', 'error')
    );
}
function clearAll() { drawingLayer.innerHTML = ''; state.rectangles = []; updateJSON(); }

// ── Toast ──
let tt;
function toast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + (type||'info') + ' show';
    clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ── Events ──
function bindEvents() {
    $('#image-upload').addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });
    document.addEventListener('paste', e => { const it = e.clipboardData?.items?.[0]; if (it?.type?.startsWith('image/')) loadImage(it.getAsFile()); });
    canvasWrap.addEventListener('dragover', e => { e.preventDefault(); });
    canvasWrap.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type?.startsWith('image/')) loadImage(f); });

    drawingLayer.addEventListener('mousedown', startDraw);
    document.addEventListener('mousemove', draw);
    document.addEventListener('mouseup', endDraw);
    drawingLayer.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; startDraw({ clientX:t.clientX, clientY:t.clientY }); }, {passive:false});
    document.addEventListener('touchmove', e => { if(!state.isDrawing) return; e.preventDefault(); const t = e.touches[0]; draw({ clientX:t.clientX, clientY:t.clientY }); }, {passive:false});
    document.addEventListener('touchend', endDraw);

    $('#btn-copy').addEventListener('click', copyData);
    $('#btn-clear').addEventListener('click', clearAll);
    $('#preset-colors').addEventListener('click', e => { const s = e.target.closest('.color-swatch'); if(s) selectColor(s.dataset.color); });
    $('#custom-color').addEventListener('input', e => selectColor(e.target.value));
    $('#opacity-slider').addEventListener('input', e => { state.opacity = parseFloat(e.target.value); $('#opacity-val').textContent = Math.round(state.opacity*100)+'%'; updateOpacity(); });

    imageEl.addEventListener('load', () => {
        state.naturalSize = { w:imageEl.naturalWidth, h:imageEl.naturalHeight };
        imageEl.style.display = 'block'; $('#drop-hint').style.display = 'none';
        updateRects(); updateJSON();
    });
    window.addEventListener('resize', () => { updateRects(); if(state.image) redrawBlocks(); });
}

init();
});
