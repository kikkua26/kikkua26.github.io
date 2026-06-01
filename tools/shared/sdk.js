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

// ═══════════════════════════════════════
// 请求/响应模式（带 Promise）
// ═══════════════════════════════════════

let _reqId = 0;
const _pending = {};

/**
 * 向父框架发送请求并等待响应
 * @param {string} type - 请求类型
 * @param {*} data - 请求数据
 * @param {number} timeout - 超时 ms
 * @returns {Promise<*>}
 */
export function requestParent(type, data, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const id = 'plugin_' + (++_reqId);
        const timer = setTimeout(() => {
            delete _pending[id];
            reject(new Error(`Parent request timeout: ${type}`));
        }, timeout);

        _pending[id] = { resolve, reject, timer };
        notifyParent(type, { ...data, _reqId: id });
    });
}

// 监听父框架的响应
window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || msg.source !== 'kikkua-admin') return;

    // 处理响应消息
    if (msg.data?._reqId && _pending[msg.data._reqId]) {
        const { resolve, timer } = _pending[msg.data._reqId];
        clearTimeout(timer);
        delete _pending[msg.data._reqId];
        resolve(msg.data);
    }

    // 处理父框架主动发送的消息
    if (_messageHandlers[msg.type]) {
        _messageHandlers[msg.type](msg.data);
    }
});

const _messageHandlers = {};

/**
 * 注册父框架消息处理器
 * @param {string} type - 消息类型
 * @param {Function} handler - (data) => void
 */
export function onParentMessage(type, handler) {
    _messageHandlers[type] = handler;
}

// ═══════════════════════════════════════
// Token 和 API 请求
// ═══════════════════════════════════════

/**
 * 向父框架请求 GitHub token
 * @returns {Promise<string|null>}
 */
export async function requestToken() {
    const resp = await requestParent('plugin:request-token', {});
    return resp?.token || null;
}

/**
 * 通过父框架代理 GitHub API 请求（插件无法直接访问 token 时使用）
 * @param {string} path - API 路径（不含 /repos/owner/repo/contents/）
 * @param {Object} opts - { method, body }
 * @returns {Promise<{ok, status, data, error}>}
 */
export async function apiRequest(path, opts = {}) {
    const resp = await requestParent('plugin:api-request', {
        path,
        method: opts.method || 'GET',
        body: opts.body || null,
    });
    return resp || { ok: false, error: 'No response' };
}
