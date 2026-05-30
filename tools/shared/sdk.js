/*
 * kikkua 工具箱 — 插件 SDK
 * 提供共享工具函数、缓存、插件注册和父框架通信
 */

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function sanitizeHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const DANGEROUS = /script|iframe|object|embed|form|input|textarea|button|select|style|link|meta|base|applet|marquee/i;
    const EVIL_ATTR = /^on|^xmlns/i;
    const EVIL_VAL = /javascript\s*:/i;
    function clean(node) {
        for (const child of [...node.childNodes]) {
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
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

export function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

// Unified script loader with dedup
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
        s.onerror = () => reject(new Error('Load failed: ' + src));
        document.head.appendChild(s);
    });
}

// ═══════════════════════════════════════
// 缓存
// ═══════════════════════════════════════

export function saveCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch {}
}

export function loadCache(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function clearCache(key) {
    try { localStorage.removeItem(key); } catch {}
}

// ═══════════════════════════════════════
// 插件注册
// ═══════════════════════════════════════

/**
 * 注册插件元数据，通过 postMessage 通知父框架
 * @param {Object} manifest - { id, name, icon, desc, version }
 */
export function registerPlugin(manifest) {
    window.__kikkua_plugin = manifest;
    notifyParent('plugin:register', manifest);
}

// ═══════════════════════════════════════
// 父框架通信
// ═══════════════════════════════════════

/**
 * 向父框架发送消息
 * @param {string} type - 消息类型
 * @param {*} data - 消息数据
 */
export function notifyParent(type, data) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'kikkua-plugin', type, data }, '*');
    }
}
