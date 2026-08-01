// kikkua · 汉字书写 — 3500 常用字数据构建脚本
// 用法: node tools/hanzi/build-data.mjs <3500常用字.txt> <makemeahanzi dictionary.txt> <词频表.txt>
// 输出:
//   data/hanzi/chars.json   3500 常用字库（字 / 拼音 / 组词）
//
// 策略：
//   1. 前 267 个人工精选字（curated-chars.mjs）直接保留，拼音与组词质量优先；
//   2. 其余字自动生成：
//      - 拼音：从词频表的多音字读音做多数投票，再匹配字典的声调写法；
//      - 组词：取词频表中包含该字的常用两字词（全部为常用字的词），不足时补三字词。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARS } from './curated-chars.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '../../data/hanzi/chars.json');

const [chars3500Path, dictPath, cibiaoPath] = process.argv.slice(2);
if (!chars3500Path || !dictPath || !cibiaoPath) {
  console.error('用法: node tools/hanzi/build-data.mjs <3500常用字.txt> <dictionary.txt> <词频表.txt>');
  process.exit(1);
}

// ── 基础工具 ──
const isCJK = (ch) => {
  const cp = ch.codePointAt(0);
  return cp >= 0x4e00 && cp <= 0x9fff;
};
const stripTone = (p) =>
  String(p || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[üǖǘǚǜ]/g, 'v')
    .toLowerCase();
const stripNum = (s) => String(s || '').replace(/[1-5]/g, '');

// 声调数字 → 声调符号（如 ba4 → bà）
const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};
function toneSyllable(syl) {
  const m = String(syl).match(/^([a-zü]+)([1-5])?$/);
  if (!m) return syl;
  const base = m[1];
  const tone = m[2] ? Number(m[2]) : 5;
  if (tone === 5) return base;
  let idx = -1;
  let v = '';
  for (const c of ['a', 'o', 'e']) {
    idx = base.indexOf(c);
    if (idx >= 0) { v = c; break; }
  }
  if (idx < 0) {
    if (base.includes('iu')) { idx = base.lastIndexOf('u'); v = 'u'; }
    else if (base.includes('ui')) { idx = base.lastIndexOf('i'); v = 'i'; }
    else {
      for (const c of ['i', 'u', 'ü']) {
        idx = base.indexOf(c);
        if (idx >= 0) { v = c; break; }
      }
      if (idx < 0) return base;
    }
  }
  return base.slice(0, idx) + TONE_MARKS[v][tone - 1] + base.slice(idx + 1);
}
const pyNumToMark = (py) => String(py).split("'").map(toneSyllable).join("'");

// ── 读取 3500 常用字表（单行拼接，取 CJK 字符） ──
const charList = [...fs.readFileSync(chars3500Path, 'utf8')].filter(isCJK);
const charSet = new Set(charList);
console.log(`3500 字表: ${charList.length} 字`);

// ── 读取 makemeahanzi 字典拼音 ──
const dict = new Map();
for (const line of fs.readFileSync(dictPath, 'utf8').split('\n')) {
  if (!line.startsWith('{')) continue;
  try {
    const o = JSON.parse(line);
    if (o.character && Array.isArray(o.pinyin) && o.pinyin.length) dict.set(o.character, o.pinyin);
  } catch { /* skip */ }
}
console.log(`字典拼音: ${dict.size} 字`);

// ── 读取词频表，构建 字 → 词候选项 ──
// 行格式: 词 \t 拼音(数字声调) \t 排名
const wordCands = new Map();
for (const line of fs.readFileSync(cibiaoPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const [w, py, rankStr] = line.split('\t');
  if (!w || !py) continue;
  const chars = [...w];
  const len = chars.length;
  if (len < 2 || len > 5) continue;
  if (!chars.every(isCJK)) continue;
  if (!chars.every((c) => charSet.has(c))) continue; // 只保留全为常用字的词
  const rank = Number(rankStr) || 999999;
  const syls = py.split("'");
  chars.forEach((c, i) => {
    if (!wordCands.has(c)) wordCands.set(c, []);
    wordCands.get(c).push({ w, rank, plain: stripNum(syls[i] || '').toLowerCase() });
  });
}
console.log(`词频表: ${fs.readFileSync(cibiaoPath, 'utf8').split('\n').filter(Boolean).length} 词条，构建字词索引完成`);

// ── 组词选择：优先两字词，按频率排名取前 3 ──
function pickWords(c) {
  const all = wordCands.get(c) || [];
  const two = all.filter((i) => [...i.w].length === 2).sort((a, b) => a.rank - b.rank);
  const picks = [];
  const seen = new Set();
  for (const item of two) {
    if (seen.has(item.w)) continue;
    seen.add(item.w);
    picks.push(item);
    if (picks.length >= 3) break;
  }
  if (picks.length < 3) {
    const more = all
      .filter((i) => [...i.w].length >= 3)
      .sort((a, b) => a.rank - b.rank);
    for (const item of more) {
      if (seen.has(item.w)) continue;
      seen.add(item.w);
      picks.push(item);
      if (picks.length >= 3) break;
    }
  }
  return picks;
}

// ── 拼音选择：对选中组词的多音字读音做多数投票，匹配字典声调写法 ──
function pickPinyin(c, wordItems) {
  const votes = new Map();
  for (const item of wordItems) {
    votes.set(item.plain, (votes.get(item.plain) || 0) + 1);
  }
  let best = '';
  let bestN = -1;
  for (const [p, n] of votes) {
    if (n > bestN) { best = p; bestN = n; }
  }
  const readings = dict.get(c) || [];
  const hit = readings.find((r) => stripTone(r) === best);
  if (hit) return hit;
  if (readings[0]) return readings[0];
  // 兜底：词频表读音转声调符号
  return wordItems.length ? pyNumToMark((wordCands.get(c) || []).find((i) => i.w === wordItems[0].w)?.plain || best) || best : best;
}

// ── 汇总输出 ──
const curatedMap = new Map(CHARS.map((e) => [e.c, e]));
const chars = charList.map((c) => {
  const curated = curatedMap.get(c);
  if (curated) return { c, p: curated.p, w: curated.w };
  const wordItems = pickWords(c);
  return {
    c,
    p: wordItems.length ? pickPinyin(c, wordItems) : (dict.get(c) || [])[0] || '',
    w: wordItems.map((i) => i.w),
  };
});

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
const payload = { version: 3, updated: new Date().toISOString().slice(0, 10), chars };
fs.writeFileSync(OUT_FILE, JSON.stringify(payload));

const noPinyin = chars.filter((e) => !e.p).length;
const noWords = chars.filter((e) => !e.w.length).length;
console.log(`已生成 ${OUT_FILE}`);
console.log(`共 ${chars.length} 字（精选覆盖 ${curatedMap.size}，自动生成 ${chars.length - curatedMap.size}）`);
console.log(`无拼音 ${noPinyin}，无组词 ${noWords}`);

// 抽查
const samples = ['天', '的', '长', '地', '乐', '行', '蚌', '洼', '骤', '瓷'];
for (const c of samples) {
  const e = chars.find((x) => x.c === c);
  if (e) console.log(`  样例 ${c} → ${e.p} [${e.w.join('、')}]`);
}
