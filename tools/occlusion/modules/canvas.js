// kikkua · 遮挡块工具 — 画布绘制、遮挡块管理

import { state, pointers } from './state.js';
import { updateJSON } from './export.js';

const $ = s => document.querySelector(s);
let imageEl, canvasWrap, drawingLayer;

export function initCanvas() {
    imageEl = $('#image');
    canvasWrap = $('#canvas-wrap');
    drawingLayer = $('#drawing-layer');
}

export function getImageEl() { return imageEl; }
export function getCanvasWrap() { return canvasWrap; }
export function getDrawingLayer() { return drawingLayer; }

export function updateRects() {
    if (!imageEl) return;
    state.imageRect = imageEl.getBoundingClientRect();
    state.containerRect = canvasWrap.getBoundingClientRect();
}

export function getMidpoint() {
    const pts = [...pointers.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

export function cancelCurrentAction() {
    if (state.isDrawing) {
        if (state.currentBlock) state.currentBlock.remove();
        state.isDrawing = false; state.isDragging = false; state.currentBlock = null;
    }
    if (state.isMoving) {
        if (state.moveStarted) { rebuildRects(); updateJSON(); }
        state.isMoving = false; state.moveStarted = false; state.movingBlock = null;
    }
}

// ── Drawing ──
export function startDraw(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
        cancelCurrentAction();
        if (!state.isPanning) { state.isPanning = true; const mid = getMidpoint(); state.panLastMidX = mid.x; state.panLastMidY = mid.y; }
        return;
    }
    if (!e.isPrimary || state.isPanning) return;
    if (!state.image) return;
    e.preventDefault();
    state.isDrawing = true; state.isDragging = false;
    updateRects();
    const rect = drawingLayer.getBoundingClientRect();
    state.startX = e.clientX - rect.left;
    state.startY = e.clientY - rect.top;
}

export function draw(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.isPanning && pointers.size >= 2) {
        const mid = getMidpoint();
        canvasWrap.scrollLeft -= mid.x - state.panLastMidX;
        canvasWrap.scrollTop -= mid.y - state.panLastMidY;
        state.panLastMidX = mid.x; state.panLastMidY = mid.y;
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

export function endDraw(e) {
    pointers.delete(e.pointerId);
    if (state.isPanning) {
        if (pointers.size < 2) {
            state.isPanning = false;
            if (pointers.size === 1 && state.image) {
                const [[, pos]] = pointers;
                const rect = drawingLayer.getBoundingClientRect();
                state.isDrawing = true; state.isDragging = false;
                state.startX = pos.x - rect.left; state.startY = pos.y - rect.top;
            }
        }
        return;
    }
    if (state.isMoving) {
        if (state.moveStarted) { rebuildRects(); updateJSON(); }
        else if (state.movingBlock && Date.now() - state.pointerDownTime >= 500) { removeBlock(state.movingBlock); }
        state.isMoving = false; state.moveStarted = false; state.movingBlock = null;
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
        x: +(bx / ir.width).toFixed(4), y: +(by / ir.height).toFixed(4),
        w: +(bw / ir.width).toFixed(4), h: +(bh / ir.height).toFixed(4),
        c: state.currentColor,
    });
    updateJSON();
    state.currentBlock = null; state.isDragging = false;
}

// ── Block Move ──
export function startMoveBlock(e, block) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) {
        cancelCurrentAction();
        if (!state.isPanning) { state.isPanning = true; const mid = getMidpoint(); state.panLastMidX = mid.x; state.panLastMidY = mid.y; }
        return;
    }
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

export function rebuildRects() {
    state.rectangles = [];
    updateRects();
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const ir = state.imageRect;
        const bx = parseFloat(b.style.left), by = parseFloat(b.style.top);
        const bw = parseFloat(b.style.width), bh = parseFloat(b.style.height);
        state.rectangles.push({
            x: +(bx / ir.width).toFixed(4), y: +(by / ir.height).toFixed(4),
            w: +(bw / ir.width).toFixed(4), h: +(bh / ir.height).toFixed(4),
            c: b.style.backgroundColor.slice(0,7).toUpperCase(),
        });
    });
}

export function redrawBlocks() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => b.remove());
    updateRects();
    state.rectangles.forEach(r => {
        const ir = state.imageRect;
        createBlock(r.x*ir.width, r.y*ir.height, r.w*ir.width, r.h*ir.height);
        // The createBlock uses state.currentColor; override with stored color
        const last = drawingLayer.lastElementChild;
        if (last) last.style.backgroundColor = r.c + Math.round(state.opacity*255).toString(16).padStart(2,'0');
    });
}

export function updateOpacity() {
    drawingLayer.querySelectorAll('.rect-block').forEach(b => {
        const c = b.style.backgroundColor.slice(0,7);
        b.style.backgroundColor = c + Math.round(state.opacity*255).toString(16).padStart(2,'0');
    });
}

export function clearAll() {
    drawingLayer.innerHTML = '';
    state.rectangles = [];
    updateJSON();
}
