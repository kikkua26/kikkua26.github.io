// kikkua · admin — GitHub API 封装

export const GH = 'https://api.github.com';
export const REPO = 'kikkua26/kikkua26.github.io';

let _token = '';
export function setToken(t) { _token = t; }
export function getToken() { return _token; }

export async function gh(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(url.startsWith('http') ? url : GH + url, {
            ...opts,
            signal: ctrl.signal,
            headers: { 'Authorization': `Bearer ${_token}`, 'Accept': 'application/vnd.github.v3+json', ...opts.headers }
        });
        clearTimeout(timer);
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `HTTP ${res.status}`); }
        return res.json();
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

export function b64enc(s) { return btoa(unescape(encodeURIComponent(s))); }
export function b64dec(s) { const r = atob(s.replace(/\s/g,'')); return new TextDecoder().decode(Uint8Array.from(r,c=>c.charCodeAt(0))); }
export function encGitPath(path) { return path.split('/').map(s => encodeURIComponent(s)).join('/'); }

export async function readRepo(path) {
    const r = await gh(`/repos/${REPO}/contents/${encGitPath(path)}`);
    if (r.content && r.encoding === 'base64') return { sha: r.sha, text: b64dec(r.content) };
    const resp = await fetch(r.download_url); return { sha: r.sha, text: await resp.text() };
}

export async function writeRepo(path, content, sha, msg) {
    return gh(`/repos/${REPO}/contents/${encGitPath(path)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg || 'Update from admin', content: b64enc(content), sha })
    });
}

export async function listRepo(path) { return gh(`/repos/${REPO}/contents/${path}`); }
