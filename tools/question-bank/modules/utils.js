// kikkua · 题库编辑器 — 通用工具函数

export function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function sanitizeHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const DANGEROUS = /script|iframe|object|embed|form|input|textarea|button|select|style|link|meta|base|applet|marquee/i;
    const EVIL_ATTR = /^on|^xmlns/i;
    const EVIL_VAL = /javascript\s*:/i;
    function clean(node) {
        const children = [...node.childNodes];
        for (const child of children) {
            if (child.nodeType === 1) {
                if (DANGEROUS.test(child.tagName)) { child.remove(); continue; }
                [...child.attributes].forEach(a => {
                    if (EVIL_ATTR.test(a.name) || EVIL_VAL.test(a.value)) child.removeAttribute(a.name);
                    if (a.name === 'style' && /expression\s*\(|url\s*\(/i.test(a.value)) child.removeAttribute('style');
                });
                clean(child);
            }
        }
    }
    clean(tmp);
    return tmp.innerHTML;
}

export function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
    URL.revokeObjectURL(a.href);
}

export function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// Unified lazy-load pattern for external scripts
const _loaded = {};
const _loading = {};
const _waiters = {};

export function loadScript(src) {
    if (_loaded[src]) return Promise.resolve();
    if (_loading[src]) return new Promise(r => { _waiters[src] = _waiters[src] || []; _waiters[src].push(r); });
    _loading[src] = true;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => {
            _loaded[src] = true;
            _loading[src] = false;
            (_waiters[src] || []).forEach(r => r());
            _waiters[src] = [];
            resolve();
        };
        s.onerror = () => reject(new Error('加载失败: ' + src));
        document.head.appendChild(s);
    });
}
