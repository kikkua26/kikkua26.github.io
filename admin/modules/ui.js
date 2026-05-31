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
        $('#modalTitle').textContent = title; $('#modalText').textContent = text;
        $('#modalOverlay').classList.add('show');
        $('#modalConfirm').onclick = () => { $('#modalOverlay').classList.remove('show'); r(true); };
        $('#modalCancel').onclick = () => { $('#modalOverlay').classList.remove('show'); r(false); };
    });
}

export function inputModal(title, label, placeholder = '') {
    return new Promise(r => {
        $('#modalTitle').textContent = title;
        document.querySelectorAll('#modalBody .field').forEach(e => e.remove());
        const f = document.createElement('div'); f.className = 'field';
        f.innerHTML = `<input id="modalInput" placeholder="${placeholder}">`;
        $('#modalText').after(f);
        $('#modalOverlay').classList.add('show');
        $('#modalConfirm').textContent = '确定';
        $('#modalConfirm').onclick = () => { const v = $('#modalInput').value.trim(); $('#modalOverlay').classList.remove('show'); r(v); };
        $('#modalCancel').onclick = () => { $('#modalOverlay').classList.remove('show'); r(null); };
        setTimeout(() => $('#modalInput').focus(), 100);
    });
}

export function setStatus(text, cls = '') {
    $('#statusBadge').textContent = text;
    $('#statusBadge').className = 'status' + (cls ? ' ' + cls : '');
}

export function switchSection(name) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === name));
    $$('.page-section').forEach(s => s.classList.toggle('active', s.id === 'sec' + name.charAt(0).toUpperCase() + name.slice(1)));
    const titles = { dashboard: '📊 仪表盘', decks: '📋 牌组', templates: '🎨 模板', tags: '🏷 标签', pages: '📄 页面', media: '🖼 媒体', cardmaker: '🃏 制卡' };
    $('#pageTitle').textContent = titles[name] || name;
    $('#saveBtn').style.display = (name === 'decks') ? 'inline-flex' : 'none';
    $('#saveTagsBtn').style.display = (name === 'tags') ? 'inline-flex' : 'none';
    $('#savePagesBtn').style.display = (name === 'pages') ? 'inline-flex' : 'none';
    if (window.innerWidth <= 767) closeSidebar();
    // Trigger section-specific loaders (imported lazily)
    if (switchSection._handlers[name]) switchSection._handlers[name]();
    // Card Maker special handling
    if (name === 'cardmaker') { $('.page-content').style.padding = '0'; $('.page-content').style.overflow = 'hidden'; }
    else { $('.page-content').style.padding = ''; $('.page-content').style.overflow = ''; }
}
switchSection._handlers = {};

export function openSidebar() { $('#sidebar').classList.add('open'); $('#sidebarOverlay').classList.add('show'); }
export function closeSidebar() { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); }
