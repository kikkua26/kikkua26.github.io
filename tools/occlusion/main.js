// kikkua Pro · 遮挡块工具
// 图片遮挡编辑，生成 Anki 图遮挡题 JSON 数据

document.addEventListener('DOMContentLoaded', () => {

const state = {
    image: null, imageRect: null, naturalSize: null,
    rectangles: [], currentColor: '#FF6B6B', opacity: 0.5,
    isDrawing: false, isDragging: false, startX: 0, startY: 0, currentBlock: null,
    isMoving: false, moveStarted: false, movingBlock: null, moveOffX: 0, moveOffY: 0, moveStartX: 0, moveStartY: 0,
    containerRect: null, imageOffset: { x: 0, y: 0 },
    zoomLevel: 1, isPanning: false, panLastMidX: 0, panLastMidY: 0, panLastDist: 0,
};

const pointers = new Map();

const COLORS = ['#FF6B6B','#FFD166','#06D6A0','#118AB2','#073B4C','#EF476F','#FF9F1C','#1A936F'];

const $ = s => document.querySelector(s);
const imageEl = $('#image');
const canvasWrap = $('#canvas-wrap');
const canvasInner = $('#canvas-inner');
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
}

function pointInImage(mx, my) {
    const r = drawingLayer.getBoundingClientRect();
    return mx >= 0 && my >= 0 && mx <= r.width && my <= r.height;
}

// ── Pan & Zoom ──
function getMidpoint() {
    const pts = [...pointers.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}
function cancelCurrentAction() {
    if (state.isDrawing) { if (state.currentBlock) state.currentBlock.remove(); state.isDrawing = false; state.isDragging = false; state.currentBlock = null; }
    if (state.isMoving) { if (state.moveStarted) { rebuildRects(); updateJSON(); } state.isMoving = false; state.moveStarted = false; state.movingBlock = null; }
}
function applyZoom() { canvasInner.style.zoom = state.zoomLevel; const el = $('#zoom-level'); if (el) el.textContent = Math.round(state.zoomLevel * 100) + '%'; }
function zoomIn() { state.zoomLevel = Math.min(5, +(state.zoomLevel + 0.25).toFixed(2)); applyZoom(); }
function zoomOut() { state.zoomLevel = Math.max(0.25, +(state.zoomLevel - 0.25).toFixed(2)); applyZoom(); }
function zoomReset() { state.zoomLevel = 1; applyZoom(); }

// ── Drawing ──
function startDraw(e) {
    if (!e.isPrimary || state.isPanning) return;
    if (!state.image) return;
    e.preventDefault();
    updateRects();
    const rect = drawingLayer.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (!pointInImage(mx, my)) return;

    drawingLayer.setPointerCapture(e.pointerId);
    state.isDrawing = true; state.isDragging = false;
    state.startX = mx;
    state.startY = my;
}

function draw(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.isPanning && pointers.size >= 2) {
        const pts = [...pointers.values()];
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        canvasWrap.scrollLeft -= mid.x - state.panLastMidX;
        canvasWrap.scrollTop -= mid.y - state.panLastMidY;
        state.panLastMidX = mid.x; state.panLastMidY = mid.y;
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (state.panLastDist > 0) { state.zoomLevel = Math.max(0.25, Math.min(5, +(state.zoomLevel * dist / state.panLastDist).toFixed(2))); applyZoom(); }
        state.panLastDist = dist;
        return;
    }
    if (!e.isPrimary) return;
    if (!state.isMoving && !state.isDrawing) return;
    updateRects();
    const rect = drawingLayer.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    if (state.isMoving && state.movingBlock) {
        if (!state.moveStarted) {
            if (Math.abs(mx - state.moveStartX) < 8 && Math.abs(my - state.moveStartY) < 8) return;
            state.moveStarted = true;
        }
        const bw = parseFloat(state.movingBlock.style.width);
        const bh = parseFloat(state.movingBlock.style.height);
        let left = mx - state.moveOffX, top = my - state.moveOffY;
        left = Math.max(0, Math.min(left, rect.width - bw));
        top = Math.max(0, Math.min(top, rect.height - bh));
        state.movingBlock.style.left = left + 'px';
        state.movingBlock.style.top = top + 'px';
        return;
    }

    if (!state.isDragging) {
        if (Math.abs(mx - state.startX) < 4 && Math.abs(my - state.startY) < 4) return;
        state.isDragging = true;
        state.currentBlock = createBlock(state.startX, state.startY, 0, 0);
    }

    let left = state.startX, top = state.startY;
    let width = mx - state.startX, height = my - state.startY;

    if (width < 0) { left = mx; width = -width; }
    if (height < 0) { top = my; height = -height; }

    left = Math.max(0, left);
    top = Math.max(0, top);
    width = Math.min(width, rect.width - left);
    height = Math.min(height, rect.height - top);

    state.currentBlock.style.left = left + 'px';
    state.currentBlock.style.top = top + 'px';
    state.currentBlock.style.width = width + 'px';
    state.currentBlock.style.height = height + 'px';
}

function endDraw(e) {
    pointers.delete(e.pointerId);
    if (state.isPanning) { if (pointers.size < 2) state.isPanning = false; return; }
    if (state.isMoving) {
        if (state.moveStarted) {
            rebuildRects();
            updateJSON();
        } else if (state.movingBlock && Date.now() - state.pointerDownTime >= 500) {
            removeBlock(state.movingBlock);
        }
        state.isMoving = false;
        state.moveStarted = false;
        state.movingBlock = null;
        return;
    }
    if (!state.isDrawing) return;
    state.isDrawing = false;
    if (!state.isDragging || !state.currentBlock) return;

    const b = state.currentBlock;
    const bw = parseFloat(b.style.width), bh = parseFloat(b.style.height);
    if (bw < 8 || bh < 8) { b.remove(); state.currentBlock = null; state.isDragging = false; return; }

    const ir = state.imageRect;
    const bx = parseFloat(b.style.left), by = parseFloat(b.style.top);
    state.rectangles.push({
        x: +(bx / ir.width).toFixed(4),
        y: +(by / ir.height).toFixed(4),
        w: +(bw / ir.width).toFixed(4),
        h: +(bh / ir.height).toFixed(4),
        c: state.currentColor,
    });
    updateJSON();
    state.currentBlock = null; state.isDragging = false;
}

// ── Block Move ──
function startMoveBlock(e, block) {
    if (!e.isPrimary || state.isPanning) return;
    e.stopPropagation();
    e.preventDefault();
    if (!state.image) return;
    updateRects();
    const rect = drawingLayer.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    block.setPointerCapture(e.pointerId);
    state.isMoving = true;
    state.moveStarted = false;
    state.movingBlock = block;
    state.pointerDownTime = Date.now();
    state.moveStartX = mx;
    state.moveStartY = my;
    state.moveOffX = mx - parseFloat(block.style.left);
    state.moveOffY = my - parseFloat(block.style.top);
}

function createBlock(x, y, w, h) {
    const div = document.createElement('div');
    div.className = 'rect-block';
    div.style.left = x + 'px'; div.style.top = y + 'px';
    div.style.width = w + 'px'; div.style.height = h + 'px';
    div.style.backgroundColor = state.currentColor + Math.round(state.opacity*255).toString(16).padStart(2,'0');
    div.addEventListener('dblclick', () => removeBlock(div));
    div.addEventListener('pointerdown', e => startMoveBlock(e, div));
    drawingLayer.appendChild(div);
    return div;
}

function removeBlock(b) { b.remove(); rebuildRects(); updateJSON(); }

function rebuildRects() {
    state.rectangles = [];
    updateRects();
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const ir = state.imageRect;
        const bx = parseFloat(b.style.left), by = parseFloat(b.style.top);
        const bw = parseFloat(b.style.width), bh = parseFloat(b.style.height);
        state.rectangles.push({
            x: +(bx / ir.width).toFixed(4),
            y: +(by / ir.height).toFixed(4),
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
        const ir = state.imageRect;
        const div = createBlock(r.x*ir.width, r.y*ir.height, r.w*ir.width, r.h*ir.height);
        div.style.backgroundColor = r.c + Math.round(state.opacity*255).toString(16).padStart(2,'0');
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

    drawingLayer.addEventListener('pointerdown', startDraw);
    document.addEventListener('pointermove', draw);
    document.addEventListener('pointerup', endDraw);

    // Multi-pointer tracking for two-finger pan & pinch zoom
    const trackPointer = e => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size >= 2 && !state.isPanning) { cancelCurrentAction(); state.isPanning = true; const mid = getMidpoint(); state.panLastMidX = mid.x; state.panLastMidY = mid.y; const pts = [...pointers.values()]; state.panLastDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y); } };
    const untrackPointer = e => { pointers.delete(e.pointerId); if (state.isPanning && pointers.size < 2) { state.isPanning = false; if (pointers.size === 1 && state.image) { const [[id, pos]] = pointers; const rect = drawingLayer.getBoundingClientRect(); const mx = pos.x - rect.left, my = pos.y - rect.top; if (mx >= 0 && my >= 0 && mx <= rect.width && my <= rect.height) { drawingLayer.setPointerCapture(id); state.isDrawing = true; state.isDragging = false; state.startX = mx; state.startY = my; } } } };
    document.addEventListener('pointerdown', trackPointer, true);
    document.addEventListener('pointerup', untrackPointer, true);
    document.addEventListener('pointercancel', untrackPointer, true);

    // Zoom: Ctrl+wheel (capture phase to intercept before browser zoom)
    document.addEventListener('wheel', e => { if ((e.ctrlKey || e.metaKey) && canvasWrap.contains(e.target)) { e.preventDefault(); state.zoomLevel = Math.max(0.25, Math.min(5, +(state.zoomLevel + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))); applyZoom(); } }, { passive: false, capture: true });
    $('#btn-zoom-in').addEventListener('click', zoomIn);
    $('#btn-zoom-out').addEventListener('click', zoomOut);
    $('#btn-zoom-reset').addEventListener('click', zoomReset);

    $('#btn-copy').addEventListener('click', copyData);
    $('#btn-clear').addEventListener('click', clearAll);
    $('#preset-colors').addEventListener('click', e => { const s = e.target.closest('.color-swatch'); if(s) selectColor(s.dataset.color); });
    $('#custom-color').addEventListener('input', e => selectColor(e.target.value));
    $('#opacity-slider').addEventListener('input', e => { state.opacity = parseFloat(e.target.value); $('#opacity-val').textContent = Math.round(state.opacity*100)+'%'; updateOpacity(); });

    imageEl.addEventListener('load', () => {
        state.image = imageEl;
        state.naturalSize = { w:imageEl.naturalWidth, h:imageEl.naturalHeight };
        imageEl.style.display = 'block'; $('#drop-hint').style.display = 'none';
        updateRects(); updateJSON();
    });
    window.addEventListener('resize', () => { updateRects(); if(state.image) redrawBlocks(); });
}

init();
});
