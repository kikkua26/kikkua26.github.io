// kikkua Pro · 遮挡块工具
// 图片遮挡编辑，生成 Anki 图遮挡题 JSON 数据

document.addEventListener('DOMContentLoaded', () => {

// ── State ──
const state = {
    image: null,
    imageRect: null,
    scale: 1,
    naturalSize: null,
    rectangles: [],
    currentColor: '#FF6B6B',
    opacity: 0.5,
    isDrawing: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    currentBlock: null,
};

const COLORS = ['#FF6B6B','#FFD166','#06D6A0','#118AB2','#073B4C','#EF476F','#FF9F1C','#1A936F'];

// ── DOM ──
const $ = s => document.querySelector(s);
const imageEl = $('#image');
const canvasWrap = $('#canvas-wrap');
const drawingLayer = $('#drawing-layer');
const jsonOutput = $('#json-output');
const toastEl = $('#toast');

// ── Init ──
function init() {
    renderColorSwatches();
    bindEvents();
    updateJSON();
}

// ── Color Swatches ──
function renderColorSwatches() {
    const grid = $('#preset-colors');
    grid.innerHTML = COLORS.map(c =>
        `<div class="color-swatch${c === state.currentColor ? ' active' : ''}" style="background:${c}" data-color="${c}"></div>`
    ).join('');
}

function selectColor(color) {
    state.currentColor = color;
    $('#custom-color').value = color;
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === color);
    });
}

// ── Events ──
function bindEvents() {
    $('#image-upload').addEventListener('change', e => {
        if (e.target.files[0]) loadImage(e.target.files[0]);
    });

    document.addEventListener('paste', e => {
        const item = e.clipboardData?.items?.[0];
        if (item?.type?.startsWith('image/')) loadImage(item.getAsFile());
    });

    // Drag & drop
    canvasWrap.addEventListener('dragover', e => { e.preventDefault(); });
    canvasWrap.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type?.startsWith('image/')) loadImage(f);
    });

    // Drawing
    drawingLayer.addEventListener('mousedown', startDraw);
    document.addEventListener('mousemove', draw);
    document.addEventListener('mouseup', endDraw);

    // Touch
    drawingLayer.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.touches[0];
        startDraw({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
    document.addEventListener('touchmove', e => {
        if (!state.isDrawing) return;
        e.preventDefault();
        const t = e.touches[0];
        draw({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
    document.addEventListener('touchend', endDraw);

    // Buttons
    $('#btn-copy').addEventListener('click', copyData);
    $('#btn-clear').addEventListener('click', clearAll);

    // Color
    $('#preset-colors').addEventListener('click', e => {
        const swatch = e.target.closest('.color-swatch');
        if (swatch) selectColor(swatch.dataset.color);
    });
    $('#custom-color').addEventListener('input', e => selectColor(e.target.value));

    // Opacity
    $('#opacity-slider').addEventListener('input', e => {
        e.stopPropagation();
        state.opacity = parseFloat(e.target.value);
        $('#opacity-val').textContent = Math.round(state.opacity * 100) + '%';
        updateBlockOpacity();
    });

    // Image load
    imageEl.addEventListener('load', () => {
        state.naturalSize = { w: imageEl.naturalWidth, h: imageEl.naturalHeight };
        updateImageRect();
        imageEl.style.display = 'block';
        $('#drop-hint').style.display = 'none';
    });

    window.addEventListener('resize', () => { if (state.image) { updateImageRect(); redrawBlocks(); } });
}

// ── Image ──
function loadImage(file) {
    const reader = new FileReader();
    reader.onload = e => { imageEl.src = e.target.result; };
    reader.readAsDataURL(file);
}

function updateImageRect() {
    state.imageRect = imageEl.getBoundingClientRect();
}

// ── Drawing ──
function startDraw(e) {
    if (!state.image) return;
    updateImageRect();
    const rect = canvasWrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (e.target.closest('.rect-block')) return;

    state.isDrawing = true;
    state.isDragging = false;
    state.startX = mx;
    state.startY = my;
}

function draw(e) {
    if (!state.isDrawing) return;
    const rect = canvasWrap.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (!state.isDragging && (Math.abs(mx - state.startX) > 3 || Math.abs(my - state.startY) > 3)) {
        state.isDragging = true;
        state.currentBlock = createBlock(state.startX, state.startY, 0, 0);
    }
    if (!state.isDragging) return;

    const x = Math.min(mx, state.startX), y = Math.min(my, state.startY);
    const w = Math.abs(mx - state.startX), h = Math.abs(my - state.startY);
    state.currentBlock.style.left = x + 'px';
    state.currentBlock.style.top = y + 'px';
    state.currentBlock.style.width = w + 'px';
    state.currentBlock.style.height = h + 'px';
}

function endDraw() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    if (!state.isDragging || !state.currentBlock) return;

    const b = state.currentBlock;
    const w = parseFloat(b.style.width), h = parseFloat(b.style.height);
    if (w < 8 || h < 8) { b.remove(); state.currentBlock = null; state.isDragging = false; return; }

    const ir = state.imageRect, cr = canvasWrap.getBoundingClientRect();
    const x = (parseFloat(b.style.left) + cr.left - ir.left) / ir.width;
    const y = (parseFloat(b.style.top) + cr.top - ir.top) / ir.height;
    const rw = w / ir.width, rh = h / ir.height;

    state.rectangles.push({
        x: +x.toFixed(4), y: +y.toFixed(4), w: +rw.toFixed(4), h: +rh.toFixed(4), c: state.currentColor
    });
    b.addEventListener('dblclick', () => removeBlock(b));
    updateJSON();
    state.currentBlock = null;
    state.isDragging = false;
}

function createBlock(x, y, w, h) {
    const div = document.createElement('div');
    div.className = 'rect-block';
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.width = w + 'px';
    div.style.height = h + 'px';
    div.style.backgroundColor = state.currentColor + Math.round(state.opacity * 255).toString(16).padStart(2, '0');
    drawingLayer.appendChild(div);
    return div;
}

function removeBlock(block) {
    block.remove();
    state.rectangles = [];
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const ir = state.imageRect, cr = canvasWrap.getBoundingClientRect();
        const bx = parseFloat(b.style.left), by = parseFloat(b.style.top);
        const bw = parseFloat(b.style.width), bh = parseFloat(b.style.height);
        state.rectangles.push({
            x: +((bx + cr.left - ir.left) / ir.width).toFixed(4),
            y: +((by + cr.top - ir.top) / ir.height).toFixed(4),
            w: +(bw / ir.width).toFixed(4),
            h: +(bh / ir.height).toFixed(4),
            c: b.style.backgroundColor.slice(0, 7).toUpperCase(),
        });
    });
    updateJSON();
}

function redrawBlocks() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => b.remove());
    const ir = state.imageRect, cr = canvasWrap.getBoundingClientRect();
    state.rectangles.forEach(r => {
        const x = r.x * ir.width + ir.left - cr.left;
        const y = r.y * ir.height + ir.top - cr.top;
        const w = r.w * ir.width, h = r.h * ir.height;
        const div = createBlock(x, y, w, h);
        div.style.backgroundColor = r.c + Math.round(state.opacity * 255).toString(16).padStart(2, '0');
        div.addEventListener('dblclick', () => removeBlock(div));
    });
}

function updateBlockOpacity() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const color = b.style.backgroundColor.slice(0, 7);
        b.style.backgroundColor = color + Math.round(state.opacity * 255).toString(16).padStart(2, '0');
    });
}

// ── Export ──
function updateJSON() {
    jsonOutput.textContent = state.rectangles.length
        ? JSON.stringify(state.rectangles, null, 2)
        : '[]  （在图片上拖动绘制遮挡块）';
}

function copyData() {
    if (!state.rectangles.length) { toast('没有遮挡块数据', 'error'); return; }
    navigator.clipboard.writeText(JSON.stringify(state.rectangles)).then(
        () => toast('已复制到剪贴板', 'success'),
        () => toast('复制失败', 'error')
    );
}

function clearAll() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => b.remove());
    state.rectangles = [];
    updateJSON();
}

// ── Toast ──
let tt;
function toast(msg, type) {
    const el = toastEl;
    el.textContent = msg;
    el.className = 'toast ' + (type || 'info') + ' show';
    clearTimeout(tt);
    tt = setTimeout(() => el.classList.remove('show'), 2200);
}

init();
});
