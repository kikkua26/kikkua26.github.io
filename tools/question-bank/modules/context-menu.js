// kikkua · 题库编辑器 — 右键菜单

import { addRow, delRow, renumber, getRowData } from './table.js';
import { openForm, closeForm, getEditingTr } from './form.js';

let ctxTr = null;

export function hideCtx() {
    document.getElementById('ctxMenu').style.display = 'none';
    document.getElementById('btnCtxMenu').style.display = 'none';
}

export function showBtnCtx(e, items) {
    e.preventDefault();
    const menu = document.getElementById('btnCtxMenu');
    menu.innerHTML = items.map(i => `<div class="ctx-item" data-cb="${i.cb}">${i.label}</div>`).join('');
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
}

export function initContextMenu() {
    // Right-click on index cell
    document.addEventListener('contextmenu', e => {
        if (e.target.closest('.toolbar .btn')) return;
        const td = e.target.closest('td.idx');
        if (!td) { hideCtx(); return; }
        e.preventDefault();
        ctxTr = td.parentElement;
        const menu = document.getElementById('ctxMenu');
        menu.style.display = 'block';
        menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
        menu.style.top = Math.min(e.clientY, window.innerHeight - 220) + 'px';
    });

    // Hide on outside click
    document.addEventListener('click', e => { if (!e.target.closest('.ctx-menu')) hideCtx(); });

    // Escape key
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        hideCtx();
        if (getEditingTr()) closeForm();
        else document.querySelectorAll('.modal-mask.show').forEach(m => m.classList.remove('show'));
    });

    // Context menu actions
    document.getElementById('ctxMenu').addEventListener('click', e => {
        const item = e.target.closest('.ctx-item');
        if (!item) return;
        const action = item.dataset.action;
        hideCtx();
        if (!ctxTr) return;
        if (action === 'edit') openForm(ctxTr);
        else if (action === 'insertAbove') addRow({}, ctxTr);
        else if (action === 'insertBelow') addRow({}, ctxTr.nextElementSibling);
        else if (action === 'duplicate') addRow(getRowData(ctxTr), ctxTr.nextElementSibling);
        else if (action === 'delete') { ctxTr.remove(); renumber(); }
    });

    // Note: btnCtxMenu click handler is in events.js (has access to addRows, downloadTemplate)

    // Double-click to edit
    document.addEventListener('dblclick', e => {
        const td = e.target.closest('td.idx');
        if (td) openForm(td.parentElement);
    });
}
