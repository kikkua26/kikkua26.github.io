// kikkua · 遮挡块工具 — 事件绑定

import { state, pointers } from './state.js';
import { initCanvas, getImageEl, getCanvasWrap, getDrawingLayer, startDraw, draw, endDraw, updateRects, redrawBlocks, updateOpacity, clearAll } from './canvas.js';
import { copyData, updateJSON, toast } from './export.js';
import { COLORS } from './state.js';

const $ = s => document.querySelector(s);

export function bindEvents() {
    initCanvas();
    const imageEl = getImageEl();
    const canvasWrap = getCanvasWrap();
    const drawingLayer = getDrawingLayer();

    // ── Color swatches ──
    renderColorSwatches();
    $('#preset-colors').addEventListener('click', e => {
        const s = e.target.closest('.color-swatch');
        if (s) selectColor(s.dataset.color);
    });
    $('#custom-color').addEventListener('input', e => selectColor(e.target.value));

    // ── Image upload ──
    $('#image-upload').addEventListener('change', e => {
        if (e.target.files[0]) loadImage(e.target.files[0]);
    });
    // Drop hint click (replaces inline onclick)
    $('#drop-hint').addEventListener('click', () => $('#image-upload').click());

    // ── Paste / drag ──
    document.addEventListener('paste', e => {
        const it = e.clipboardData?.items?.[0];
        if (it?.type?.startsWith('image/')) loadImage(it.getAsFile());
    });
    canvasWrap.addEventListener('dragover', e => e.preventDefault());
    canvasWrap.addEventListener('drop', e => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type?.startsWith('image/')) loadImage(f);
    });

    // ── Drawing ──
    drawingLayer.addEventListener('pointerdown', startDraw);
    drawingLayer.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointermove', draw);
    document.addEventListener('pointerup', endDraw);

    // ── Prevent browser gestures ──
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('touchmove', e => {
        if (e.target.closest('.drawing-layer, .rect-block')) e.preventDefault();
    }, { passive: false });
    document.addEventListener('pointercancel', e => {
        pointers.delete(e.pointerId);
        if (state.isPanning && pointers.size < 2) state.isPanning = false;
    });

    // ── Actions ──
    $('#btn-copy').addEventListener('click', copyData);
    $('#btn-clear').addEventListener('click', clearAll);

    // ── Opacity ──
    $('#opacity-slider').addEventListener('input', e => {
        state.opacity = parseFloat(e.target.value);
        $('#opacity-val').textContent = Math.round(state.opacity*100)+'%';
        updateOpacity();
    });

    // ── Image load ──
    imageEl.addEventListener('load', () => {
        state.image = imageEl;
        state.naturalSize = { w: imageEl.naturalWidth, h: imageEl.naturalHeight };
        imageEl.style.display = 'block';
        $('#drop-hint').style.display = 'none';
        updateRects();
        updateJSON();
    });

    // ── Resize ──
    window.addEventListener('resize', () => {
        updateRects();
        if (state.image) redrawBlocks();
    });
}

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

function loadImage(file) {
    const r = new FileReader();
    r.onload = e => { getImageEl().src = e.target.result; };
    r.readAsDataURL(file);
}
