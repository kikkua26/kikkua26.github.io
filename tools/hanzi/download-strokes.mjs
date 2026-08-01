// kikkua · 汉字书写 — 下载精选字库的本地笔画数据
// 用法: node tools/hanzi/download-strokes.mjs
// 从 hanzi-writer-data (jsdelivr) 下载 data/hanzi/chars.json 中每个字的
// 笔画数据到 data/hanzi/strokes/<unicode-hex>.json，已存在的自动跳过。
// 未收录的字在运行时走 CDN 回退。支持并发与失败重试。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_FILE = path.resolve(__dirname, '../../data/hanzi/chars.json');
const STROKES_DIR = path.resolve(__dirname, '../../data/hanzi/strokes');
const BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';

const hexCode = (ch) => ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

const { chars } = JSON.parse(fs.readFileSync(CHARS_FILE, 'utf8'));
fs.mkdirSync(STROKES_DIR, { recursive: true });

let ok = 0;
let skip = 0;
const fail = [];
const CONCURRENCY = 8;

const pending = chars
  .filter(({ c }) => !fs.existsSync(path.join(STROKES_DIR, hexCode(c) + '.json')))
  .map(({ c }) => c);
skip = chars.length - pending.length;

async function downloadOne(c) {
  const out = path.join(STROKES_DIR, hexCode(c) + '.json');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(BASE + encodeURIComponent(c) + '.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim().startsWith('{')) throw new Error('非JSON');
      fs.writeFileSync(out, text);
      ok++;
      return;
    } catch (e) {
      if (attempt === 1) fail.push(`${c} ${e.message}`);
      else await new Promise((r) => setTimeout(r, 300));
    }
  }
}

for (let i = 0; i < pending.length; i += CONCURRENCY) {
  await Promise.all(pending.slice(i, i + CONCURRENCY).map(downloadOne));
}

console.log(`完成: 新下载 ${ok}, 已存在 ${skip}, 失败 ${fail.length}`);
if (fail.length) {
  console.log('失败列表:');
  fail.forEach((f) => console.log('  ' + f));
}
