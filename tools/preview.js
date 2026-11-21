#!/usr/bin/env node
/**
 * kikkua 本地预览服务器（零依赖）
 *
 * 相比 `python -m http.server`，这里多了 SPA 回退：
 * 直接访问 /kids、/hanzi/color 这类前端路由也能正确打开，而不是 404。
 *
 * 用法：
 *   node tools/preview.js            # 默认 http://localhost:3000
 *   node tools/preview.js 8080       # 指定端口
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || 3000);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'text/xml; charset=utf-8',
    '.apkg': 'application/octet-stream',
};

function send(res, filePath) {
    fs.readFile(filePath, (err, buf) => {
        if (err) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, {
            'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'cache-control': 'no-cache',
        });
        res.end(buf);
    });
}

http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const target = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));

    // 目录 → index.html
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        const idx = path.join(target, 'index.html');
        if (fs.existsSync(idx)) return send(res, idx);
    }
    if (fs.existsSync(target) && fs.statSync(target).isFile()) return send(res, target);

    // 有扩展名的缺失文件按真 404 处理，其余交给 SPA 路由
    if (path.extname(urlPath)) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + urlPath);
        return;
    }
    return send(res, path.join(ROOT, 'index.html'));
}).listen(PORT, () => {
    console.log(`kikkua 本地预览：http://localhost:${PORT}`);
    console.log(`儿童导航：  http://localhost:${PORT}/kids`);
    console.log(`汉字小书房：http://localhost:${PORT}/hanzi`);
});
