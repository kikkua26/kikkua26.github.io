/*
 * plugin-host.js — admin 侧 iframe 插件宿主
 * 管理插件 iframe 的加载、通信和生命周期
 */

import { getToken } from './api.js';
import { GH, REPO } from './api.js';

// 已注册的插件实例 { id: { iframe, manifest, ready } }
const _plugins = {};

// 等待响应的请求 { requestId: { resolve, reject, timer } }
const _pending = {};

let _reqId = 0;

// ═══════════════════════════════════════
// 插件加载
// ═══════════════════════════════════════

/**
 * 加载插件到指定容器
 * @param {string} id - 插件 ID
 * @param {string} url - 插件 index.html 路径
 * @param {string} containerId - 容器元素 ID
 * @returns {HTMLIFrameElement}
 */
export function loadPlugin(id, url, containerId) {
    // 已加载则直接返回
    if (_plugins[id]?.iframe) {
        const container = document.getElementById(containerId);
        if (container && !container.contains(_plugins[id].iframe)) {
            container.appendChild(_plugins[id].iframe);
        }
        return _plugins[id].iframe;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[plugin-host] container #${containerId} not found`);
        return null;
    }

    // 清空容器
    container.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.className = 'plugin-frame';
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    iframe.src = url;
    iframe.dataset.pluginId = id;

    _plugins[id] = { iframe, manifest: null, ready: false };
    container.appendChild(iframe);

    return iframe;
}

/**
 * 卸载插件
 * @param {string} id - 插件 ID
 */
export function unloadPlugin(id) {
    const plugin = _plugins[id];
    if (!plugin) return;
    if (plugin.iframe?.parentNode) {
        plugin.iframe.parentNode.removeChild(plugin.iframe);
    }
    delete _plugins[id];
}

/**
 * 获取已加载的插件列表
 * @returns {Object[]}
 */
export function getLoadedPlugins() {
    return Object.entries(_plugins).map(([id, p]) => ({
        id,
        manifest: p.manifest,
        ready: p.ready,
    }));
}

// ═══════════════════════════════════════
// postMessage 通信
// ═══════════════════════════════════════

/**
 * 向指定插件发送消息
 * @param {string} id - 插件 ID
 * @param {string} type - 消息类型
 * @param {*} data - 消息数据
 */
export function sendToPlugin(id, type, data) {
    const plugin = _plugins[id];
    if (!plugin?.iframe?.contentWindow) {
        console.warn(`[plugin-host] plugin ${id} not found or no contentWindow`);
        return;
    }
    plugin.iframe.contentWindow.postMessage(
        { source: 'kikkua-admin', type, data },
        '*'
    );
}

/**
 * 向插件发送请求并等待响应（带超时）
 * @param {string} id - 插件 ID
 * @param {string} type - 请求类型
 * @param {*} data - 请求数据
 * @param {number} timeout - 超时 ms
 * @returns {Promise<*>}
 */
export function requestPlugin(id, type, data, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const reqId = 'admin_' + (++_reqId);
        const timer = setTimeout(() => {
            delete _pending[reqId];
            reject(new Error(`Plugin ${id} request timeout: ${type}`));
        }, timeout);

        _pending[reqId] = { resolve, reject, timer };
        sendToPlugin(id, type, { ...data, _reqId: reqId });
    });
}

// ═══════════════════════════════════════
// 消息处理器
// ═══════════════════════════════════════

// 从 iframe 找到对应的插件 ID
function findPluginId(sourceWindow) {
    for (const [id, plugin] of Object.entries(_plugins)) {
        if (plugin.iframe?.contentWindow === sourceWindow) return id;
    }
    return null;
}

function handleMessage(event) {
    const msg = event.data;
    if (!msg || msg.source !== 'kikkua-plugin') return;

    const pluginId = findPluginId(event.source);
    if (!pluginId) return;

    const { type, data } = msg;

    switch (type) {
        case 'plugin:register':
            handleRegister(pluginId, data);
            break;

        case 'plugin:request-token':
            handleTokenRequest(pluginId, data);
            break;

        case 'plugin:api-request':
            handleApiRequest(pluginId, data);
            break;

        case 'plugin:response':
            handleResponse(data);
            break;

        case 'plugin:ready':
            handleReady(pluginId);
            break;

        case 'plugin:error':
            console.error(`[plugin-host] plugin ${pluginId} error:`, data?.message);
            break;

        default:
            // 转发给自定义处理器
            if (_customHandlers[type]) {
                _customHandlers[type](pluginId, data);
            }
    }
}

function handleRegister(pluginId, manifest) {
    const plugin = _plugins[pluginId];
    if (!plugin) return;
    plugin.manifest = manifest;
    console.log(`[plugin-host] registered: ${manifest.name || pluginId}`);
}

function handleTokenRequest(pluginId, data) {
    const token = getToken();
    sendToPlugin(pluginId, 'plugin:token', {
        token: token || null,
        _reqId: data?._reqId,
    });
}

async function handleApiRequest(pluginId, data) {
    const { path, method, body, _reqId } = data;
    const token = getToken();

    if (!token) {
        sendToPlugin(pluginId, 'plugin:api-response', {
            ok: false,
            error: 'Not authenticated',
            _reqId,
        });
        return;
    }

    try {
        const url = `${GH}/repos/${REPO}/contents/${path}`;
        const opts = {
            method: method || 'GET',
            headers: {
                Authorization: `token ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/vnd.github.v3+json',
            },
        };
        if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
        }

        const resp = await fetch(url, opts);
        const result = await resp.json();

        sendToPlugin(pluginId, 'plugin:api-response', {
            ok: resp.ok,
            status: resp.status,
            data: result,
            _reqId,
        });
    } catch (err) {
        sendToPlugin(pluginId, 'plugin:api-response', {
            ok: false,
            error: err.message,
            _reqId,
        });
    }
}

function handleResponse(data) {
    const { _reqId } = data;
    if (!_reqId || !_pending[_reqId]) return;
    const { resolve, timer } = _pending[_reqId];
    clearTimeout(timer);
    delete _pending[_reqId];
    resolve(data);
}

function handleReady(pluginId) {
    const plugin = _plugins[pluginId];
    if (!plugin) return;
    plugin.ready = true;
    console.log(`[plugin-host] plugin ${pluginId} ready`);
}

// ═══════════════════════════════════════
// 自定义处理器
// ═══════════════════════════════════════

const _customHandlers = {};

/**
 * 注册自定义消息处理器
 * @param {string} type - 消息类型
 * @param {Function} handler - (pluginId, data) => void
 */
export function onPluginMessage(type, handler) {
    _customHandlers[type] = handler;
}

// ═══════════════════════════════════════
// 初始化
// ═══════════════════════════════════════

let _initialized = false;

export function initPluginHost() {
    if (_initialized) return;
    _initialized = true;
    window.addEventListener('message', handleMessage);
}
