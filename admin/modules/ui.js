// kikkua · admin — 通用 UI（toast, modal, section switching）

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let _tt;
export function toast(text, type = 'success') {
    const el = $('#toast'); el.textContent = text; el.className = `toast ${type} show`;
    clearTimeout(_tt); _tt = setTimeout(() => el.classList.remove('show'), 3000);
}

export function confirmModal(title, text) {
    return new Promise(r => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal">
            <h3>${title}</h3><p>${text}</p>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div></div>`;
        overlay.addEventListener('click', e => {
            if (e.target.dataset.action === 'ok') { overlay.remove(); r(true); }
            else if (e.target.dataset.action === 'cancel' || e.target === overlay) { overlay.remove(); r(false); }
        });
        document.body.appendChild(overlay);
    });
}

export function inputModal(title, label, placeholder = '') {
    return new Promise(r => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal">
            <h3>${title}</h3>
            <div class="field"><label>${label}</label><input placeholder="${placeholder}"></div>
            <div class="modal-actions">
                <button class="btn btn-secondary" data-action="cancel">取消</button>
                <button class="btn btn-primary" data-action="ok">确定</button>
            </div></div>`;
        const input = overlay.querySelector('input');
        overlay.addEventListener('click', e => {
            if (e.target.dataset.action === 'ok') { overlay.remove(); r(input.value.trim()); }
            else if (e.target.dataset.action === 'cancel' || e.target === overlay) { overlay.remove(); r(null); }
        });
        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 100);
    });
}

export function setStatus(text, cls = '') {
    $('#statusBadge').textContent = text;
    $('#statusBadge').className = 'status' + (cls ? ' ' + cls : '');
}

export function switchSection(name) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === name));
    $$('.page-section').forEach(s => s.classList.toggle('active', s.id === 'sec' + name.charAt(0).toUpperCase() + name.slice(1)));
    const titles = { dashboard: '📊 仪表盘', decks: '📋 牌组', templates: '🎨 模板', tags: '🏷 标签', pages: '📄 页面', media: '🖼 媒体' };
    $('#pageTitle').textContent = titles[name] || name;
    if (window.innerWidth <= 767) closeSidebar();
    // Trigger section-specific loaders (imported lazily)
    if (switchSection._handlers[name]) switchSection._handlers[name]();
    // All sections except dashboard use iframe plugins - remove padding
    const pc = $('.page-content');
    if (pc) {
        if (name === 'dashboard') {
            pc.classList.remove('no-padding');
        } else {
            pc.classList.add('no-padding');
        }
    }
}
switchSection._handlers = {};

export function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarOverlay').classList.add('show'); }
export function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); }
