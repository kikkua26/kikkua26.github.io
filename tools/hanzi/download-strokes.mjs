// kikkua · 汉字书写 — 下载精选字库的本地笔画数据
// 用法: node tools/hanzi/download-strokes.mjs
// 从 hanzi-writer-data (jsdelivr) 下载 data/hanzi/chars.json 中每个字的
// 笔画数据到 data/hanzi/strokes/<unicode-hex>.json，已存在的自动跳过。
// 未收录的字在运行时走 CDN 回退。

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

let ok = 0, skip = 0;
const fail = [];

for (const { c } of chars) {
  const out = path.join(STROKES_DIR, hexCode(c) + '.json');
  if (fs.existsSync(out)) { skip++; continue; }
  try {
    const res = await fetch(BASE + encodeURIComponent(c) + '.json');
    if (!res.ok) { fail.push(`${c} HTTP ${res.status}`); continue; }
    const text = await res.text();
    if (!text.trim().startsWith('{')) { fail.push(`${c} 非JSON`); continue; }
    fs.writeFileSync(out, text);
    ok++;
  } catch (e) {
    fail.push(`${c} ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 40));
}

console.log(`完成: 新下载 ${ok}, 已存在 ${skip}, 失败 ${fail.length}`);
if (fail.length) {
  console.log('失败列表:');
  fail.forEach((f) => console.log('  ' + f));
}
