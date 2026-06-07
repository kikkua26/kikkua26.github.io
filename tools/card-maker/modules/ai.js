// kikkua · 制卡工具 — AI 集成（支持 DeepSeek + 小米 MiMo）

import { state, rootEl } from './constants.js';
import { flushData } from './data.js';
import { genId, toast } from './utils.js';
import { renderAll } from './render.js';
import { parseDataObject, hideQuickPaste } from './paste.js';

// AI Provider 配置
const AI_PROVIDERS = {
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        keyPrefix: 'sk-',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
        defaultModel: 'deepseek-v4-flash',
    },
    mimo: {
        name: '小米 MiMo',
        baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
        keyPrefix: 'tp-',
        models: ['mimo-v2.5', 'mimo-v2.5-pro'],
        defaultModel: 'mimo-v2.5-pro',
    },
};

// ═══════════════════════════════════════
// Settings Modal
// ═══════════════════════════════════════

export function showSettings() {
    const modal = rootEl.querySelector('#cmSettingsModal');
    if (!modal) return;

    // Restore current settings
    const provider = localStorage.getItem('kikkua_ai_provider') || 'deepseek';
    const key = localStorage.getItem('kikkua_ai_key') || '';
    const model = localStorage.getItem('kikkua_ai_model') || AI_PROVIDERS[provider].defaultModel;

    // Set provider
    const providerBtns = modal.querySelectorAll('[data-provider]');
    providerBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.provider === provider);
    });

    // Set key
    const keyInput = modal.querySelector('#cmSettingsKey');
    if (keyInput) keyInput.value = key;

    // Update model options
    updateSettingsModels(provider, model);

    // Clear test result
    const testResult = modal.querySelector('#cmTestResult');
    if (testResult) { testResult.innerHTML = ''; testResult.className = 'test-result'; }

    modal.classList.remove('hidden');
}

export function hideSettings() {
    const modal = rootEl.querySelector('#cmSettingsModal');
    if (modal) modal.classList.add('hidden');
}

export function saveSettings() {
    const modal = rootEl.querySelector('#cmSettingsModal');
    if (!modal) return;

    const provider = modal.querySelector('[data-provider].active')?.dataset?.provider || 'deepseek';
    const key = modal.querySelector('#cmSettingsKey')?.value?.trim() || '';
    const model = modal.querySelector('#cmSettingsModel')?.value || AI_PROVIDERS[provider].defaultModel;

    localStorage.setItem('kikkua_ai_provider', provider);
    localStorage.setItem('kikkua_ai_key', key);
    localStorage.setItem('kikkua_ai_model', model);

    toast('AI 设置已保存');
    hideSettings();
}

function updateSettingsModels(provider, selectedModel) {
    const modal = rootEl.querySelector('#cmSettingsModal');
    if (!modal) return;

    const config = AI_PROVIDERS[provider];
    const modelSelect = modal.querySelector('#cmSettingsModel');
    const keyInput = modal.querySelector('#cmSettingsKey');

    if (modelSelect) {
        modelSelect.innerHTML = config.models.map(m =>
            `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`
        ).join('');
    }

    if (keyInput) {
        keyInput.placeholder = `${config.name} Key (${config.prefix}...)`;
    }
}

// ═══════════════════════════════════════
// Test Connection
// ═══════════════════════════════════════

export async function testConnection() {
    const modal = rootEl.querySelector('#cmSettingsModal');
    if (!modal) return;

    const provider = modal.querySelector('[data-provider].active')?.dataset?.provider || 'deepseek';
    const key = modal.querySelector('#cmSettingsKey')?.value?.trim() || '';
    const model = modal.querySelector('#cmSettingsModel')?.value || AI_PROVIDERS[provider].defaultModel;
    const config = AI_PROVIDERS[provider];
    const testBtn = modal.querySelector('#cmTestBtn');
    const testResult = modal.querySelector('#cmTestResult');

    if (!key) {
        testResult.innerHTML = '❌ 请先输入 API Key';
        testResult.className = 'test-result error';
        return;
    }

    if (!key.startsWith(config.keyPrefix)) {
        testResult.innerHTML = `❌ Key 格式错误，应以 ${config.keyPrefix} 开头`;
        testResult.className = 'test-result error';
        return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '⏳ 测试中...';
    testResult.innerHTML = '正在连接...';
    testResult.className = 'test-result';

    const startTime = Date.now();

    try {
        const resp = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: '回复 ok' }],
                max_tokens: 10,
            }),
        });

        const elapsed = Date.now() - startTime;

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        const reply = data.choices?.[0]?.message?.content?.trim() || '';

        testResult.innerHTML = `
            ✅ 连接成功<br>
            <span class="test-detail">模型: ${model}</span><br>
            <span class="test-detail">响应: ${reply.slice(0, 20)}</span><br>
            <span class="test-detail">耗时: ${elapsed}ms</span>
        `;
        testResult.className = 'test-result success';
    } catch (e) {
        const elapsed = Date.now() - startTime;
        testResult.innerHTML = `
            ❌ 连接失败<br>
            <span class="test-detail">${e.message}</span><br>
            <span class="test-detail">耗时: ${elapsed}ms</span>
        `;
        testResult.className = 'test-result error';
    }

    testBtn.disabled = false;
    testBtn.textContent = '🔗 测试连接';
}

// ═══════════════════════════════════════
// Copy Prompt (no API needed)
// ═══════════════════════════════════════

const SYSTEM_PROMPT = `你是一个知识卡片结构化助手。根据用户输入的内容（文字或图片），提取并整理为JSON格式。

输出格式（严格只输出这个JSON对象，不要任何其他文字）：
{
  "主字段": "核心知识点名称",
  "章节": "学科::大类::小类",
  "知识解析": { "字段名": "内容" },
  "拓展解析": { "字段名": "内容" }
}

规则：
- 严格只输出JSON，禁止输出任何解释、说明、引用标记（如[reference:X]）、markdown代码块标记
- **格式要求**：确保输出合法的JSON格式——所有字符串必须用英文双引号包裹，字符串内部的双引号用 \" 转义，不能有多余的逗号（尤其最后一个字段后），不能有注释，确保所有括号正确闭合
- **内容不重复**：同一条数据中，各字段之间不要出现相同或高度相似的内容。知识解析和拓展解析应各有侧重，不要互相复制
- 如果用户提供了章节信息则保留，否则根据内容推断
- **全覆盖**：逐一识别并提取输入内容中的每一个知识点，不遗漏任何要点。如果输入内容包含多个知识点，请将所有知识点都整理进来
- **提炼精简**：对原始内容进行提炼和归纳，去除冗余表述，保留核心要点，使内容适合记忆和复习。善用简洁的短语、关键词、口诀等形式辅助记忆
- **重点标记**：对内容中的关键术语、核心定义、重要数据等用 {{……}} 标记（注意用花括号而非方括号，避免与JSON数组语法冲突），用于后续制作挖空卡片。例如：麻黄的功效是{{发汗解表}}、{{宣肺平喘}}
- **名词解释**：对专业术语或概念，在正文中用【*术语::解释*】的格式内联标注，不单独设字段。例如：此方具有{{辛温解表}}之功，【*辛温::指用温性药物驱散寒邪*】
- **引号规范**：内容中引用原文时用中文引号「」或『』，不要在英文双引号内再嵌套英文双引号
- 知识解析：全面覆盖该知识点的核心内容（定义、组成、功效、主治、方解、用法等），字段名自行拟定
- 拓展解析：全面覆盖补充信息（方歌、口诀、鉴别、注意事项、现代研究等），字段名控制在2个字
- 如果用户指定了字段，按用户要求的字段来组织，并尽量补充相关知识
- 内容应来源于权威教材、文献，确保准确完整
- 内容中不要包含任何引用标记或来源标注`;

function getExtraRequirements(inputId) {
    const el = rootEl.querySelector(inputId || '#cmAIExtra');
    return el?.value?.trim() || '';
}

function buildUserMessage(content, extraInputId) {
    const extra = getExtraRequirements(extraInputId);
    return extra ? `${content}\n\n【补充要求】${extra}` : content;
}

export async function copyPrompt() {
    const contentInput = rootEl.querySelector('#cmAIContent');
    const content = contentInput?.value?.trim();

    let fullPrompt;
    if (content) {
        fullPrompt = `[System]\n${SYSTEM_PROMPT}\n\n[User]\n${buildUserMessage(content)}`;
    } else {
        // No content — copy system prompt + instruction to wait
        fullPrompt = `${SYSTEM_PROMPT}\n\n请理解以上系统规则，并确认以下几点：\n1. 你将如何组织知识解析和拓展解析的字段结构\n2. 重点标记和名词解释的格式你是否理解\n3. 回复「已准备好，等待内容」，然后等待我发送知识内容`;
    }

    try {
        await navigator.clipboard.writeText(fullPrompt);
        showAIStatus('success', content ? '✅ 已复制到剪切板！请粘贴到 AI 对话中' : '✅ 已复制系统提示词！粘贴到 AI 对话后，再发送知识内容');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = fullPrompt;
        ta.style.cssText = 'position:fixed;left:-9999px;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showAIStatus('success', content ? '✅ 已复制到剪切板！请粘贴到 AI 对话中' : '✅ 已复制系统提示词！粘贴到 AI 对话后，再发送知识内容');
    }
}

function showAIStatus(type, msg) {
    const el = rootEl.querySelector('#cmAIStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'cm-ai-status ' + type;
    el.classList.remove('hidden');
    if (type === 'success') {
        setTimeout(() => el.classList.add('hidden'), 3000);
    }
}

// ═══════════════════════════════════════
// Batch Import
// ═══════════════════════════════════════

const BATCH_SYSTEM_PROMPT = `你是一个知识卡片批量结构化助手。根据用户输入的内容（文字或图片），逐一提取所有知识点，整理为JSON数组格式。

输出格式（严格只输出这个JSON数组，不要任何其他文字）：
[
  {
    "章节": "学科::大类::小类",
    "主字段": "知识点名称",
    "知识解析": { "字段名": "内容" },
    "拓展解析": { "字段名": "内容" }
  }
]

规则：
- 严格只输出JSON数组，禁止输出任何解释、说明、引用标记（如[reference:X]）、markdown代码块标记
- **格式要求**：确保输出合法的JSON格式——所有字符串必须用英文双引号包裹，字符串内部的双引号用 \" 转义，不能有多余的逗号（尤其最后一个字段后），不能有注释，确保所有括号正确闭合
- **内容不重复**：同一条数据中，各字段之间不要出现相同或高度相似的内容。知识解析和拓展解析应各有侧重，不要互相复制
- **全覆盖**：逐一识别并提取输入内容中的每一个知识点，确保不遗漏任何要点。每个独立知识点生成一个对象
- **提炼精简**：对原始内容进行提炼和归纳，去除冗余表述，保留核心要点，使内容适合记忆和复习。善用简洁的短语、关键词、口诀等形式辅助记忆
- **重点标记**：对内容中的关键术语、核心定义、重要数据等用 {{……}} 标记（注意用花括号而非方括号，避免与JSON数组语法冲突），用于后续制作挖空卡片。例如：麻黄的功效是{{发汗解表}}、{{宣肺平喘}}
- **名词解释**：对专业术语或概念，在正文中用【*术语::解释*】的格式内联标注，不单独设字段。例如：此方具有{{辛温解表}}之功，【*辛温::指用温性药物驱散寒邪*】
- **引号规范**：内容中引用原文时用中文引号「」或『』，不要在英文双引号内再嵌套英文双引号
- 如果用户提供了章节信息则保留，否则根据内容推断
- 知识解析：全面覆盖该知识点的核心内容，字段名自行拟定
- 拓展解析：全面覆盖补充信息，字段名控制在2个字
- 如果用户指定了字段，按用户要求的字段来组织，并尽量补充相关知识
- 内容应来源于权威教材、文献，确保准确完整
- 内容中不要包含任何引用标记或来源标注`;

export function showBatchModal() {
    const modal = rootEl.querySelector('#cmBatchModal');
    if (modal) modal.classList.remove('hidden');
}

export function hideBatchModal() {
    const modal = rootEl.querySelector('#cmBatchModal');
    if (modal) modal.classList.add('hidden');
}

export async function copyBatchPrompt() {
    const contentInput = rootEl.querySelector('#cmBatchContent');
    const content = contentInput?.value?.trim();

    let fullPrompt;
    if (content) {
        fullPrompt = `[System]\n${BATCH_SYSTEM_PROMPT}\n\n[User]\n${buildUserMessage(content, '#cmBatchExtra')}`;
    } else {
        fullPrompt = `${BATCH_SYSTEM_PROMPT}\n\n请理解以上系统规则，并确认以下几点：\n1. 你将如何组织知识解析和拓展解析的字段结构\n2. 重点标记和名词解释的格式你是否理解\n3. 回复「已准备好，等待内容」，然后等待我发送知识内容`;
    }

    try {
        await navigator.clipboard.writeText(fullPrompt);
        showBatchStatus('success', content ? '✅ 已复制到剪切板！请粘贴到 AI 对话中' : '✅ 已复制系统提示词！粘贴到 AI 对话后，再发送知识内容');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = fullPrompt;
        ta.style.cssText = 'position:fixed;left:-9999px;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        showBatchStatus('success', content ? '✅ 已复制到剪切板！请粘贴到 AI 对话中' : '✅ 已复制系统提示词！粘贴到 AI 对话后，再发送知识内容');
    }
}

export async function batchAIParse() {
    const contentInput = rootEl.querySelector('#cmBatchContent');
    const content = contentInput?.value?.trim();
    if (!content) {
        showBatchStatus('error', '请先输入要批量制作的内容');
        return;
    }

    const provider = localStorage.getItem('kikkua_ai_provider') || 'deepseek';
    const apiKey = localStorage.getItem('kikkua_ai_key') || '';
    const model = localStorage.getItem('kikkua_ai_model') || AI_PROVIDERS[provider].defaultModel;

    if (!apiKey) {
        showBatchStatus('error', '请先在 AI 设置中配置 API Key');
        return;
    }

    const btn = rootEl.querySelector('#cmBatchAIParse');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ AI 思考中...'; }

    try {
        const result = await callAI(buildUserMessage(content, '#cmBatchExtra'), apiKey, provider, model);
        const jsonInput = rootEl.querySelector('#cmBatchInput');
        if (jsonInput) {
            jsonInput.value = JSON.stringify(result, null, 2);
        }
        showBatchStatus('success', '✅ AI 解析完成，请检查后点击「批量导入」');
    } catch (e) {
        showBatchStatus('error', '❌ AI 解析失败: ' + (e.message || '未知错误'));
    }

    if (btn) { btn.disabled = false; btn.textContent = '🤖 AI 解析'; }
}

export function applyBatchImport() {
    const input = rootEl.querySelector('#cmBatchInput');
    if (!input) return;
    let text = input.value.trim();
    if (!text) {
        showBatchStatus('error', '请粘贴 AI 返回的 JSON');
        return;
    }

    // Clean AI artifacts like [reference:X]
    text = text.replace(/\[reference:\d+\]/g, '');

    let data;
    try {
        data = JSON.parse(text);
        // Accept object (wrap in array) or array
        if (!Array.isArray(data)) {
            data = [data];
        }
    } catch {
        showBatchStatus('error', 'JSON 格式错误，请检查');
        return;
    }

    // Import notes
    const nb = rootEl.querySelector ? state.notebooks[state.activeNotebook] : null;
    if (!nb) return;
    if (!nb.notes) nb.notes = [];
    if (!nb._chapters) nb._chapters = [];
    if (!nb._order) nb._order = {};

    let addedNotes = 0;
    let addedChapters = 0;

    for (const item of data) {
        if (!item['主字段']) continue;

        const chapter = item['章节'] || '';
        const mainField = item['主字段'];
        const knowledgeAnalysis = item['知识解析'] ? serializeFields(item['知识解析']) : '';
        const extendedAnalysis = item['拓展解析'] ? serializeFields(item['拓展解析']) : '';

        // Add chapter if needed
        if (chapter && !nb._chapters.includes(chapter)) {
            nb._chapters.push(chapter);
            addedChapters++;
            // Add to order
            const parts = chapter.split('::');
            const parentPath = parts.length > 1 ? parts.slice(0, -1).join('::') : '';
            const name = parts[parts.length - 1];
            const orderKey = parentPath || '';
            if (!nb._order[orderKey]) nb._order[orderKey] = [];
            if (!nb._order[orderKey].includes(name)) nb._order[orderKey].push(name);
            // Expand
            let acc = '';
            for (const p of parts) { acc = acc ? acc + '::' + p : p; state.expandedChapters.add(acc); }
        }

        // Add note
        nb.notes.push({
            id: genId(),
            mainField,
            chapter,
            knowledgeAnalysis,
            extendedAnalysis,
        });
        addedNotes++;
    }

    flushData();
    renderAll();
    hideBatchModal();

    const parts = [];
    if (addedChapters > 0) parts.push(`${addedChapters} 个目录`);
    if (addedNotes > 0) parts.push(`${addedNotes} 条笔记`);
    toast(`已导入 ${parts.join('、')}`, 'success');
}

function serializeFields(obj) {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object') {
        return Object.entries(obj).map(([k, v]) => `${k}::${v}`).join('<br>###');
    }
    return '';
}

function showBatchStatus(type, msg) {
    const el = rootEl.querySelector('#cmBatchStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'cm-ai-status ' + type;
    el.classList.remove('hidden');
    if (type === 'success') {
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}

// ═══════════════════════════════════════
// AI Parse (with API)
// ═══════════════════════════════════════

export async function aiParse() {
    const contentInput = rootEl.querySelector('#cmAIContent');
    const jsonInput = rootEl.querySelector('#cmPasteInput');
    const btn = rootEl.querySelector('#cmAiParse');
    if (!contentInput || !btn) return;
    const content = contentInput.value.trim();
    if (!content) { showAIStatus('error', '请先输入要解析的内容'); return; }

    // Get settings from localStorage
    const provider = localStorage.getItem('kikkua_ai_provider') || 'deepseek';
    const apiKey = localStorage.getItem('kikkua_ai_key') || '';
    const model = localStorage.getItem('kikkua_ai_model') || AI_PROVIDERS[provider].defaultModel;

    if (!apiKey) {
        showAIStatus('error', '请先在 AI 设置中配置 API Key，或使用「复制提示词」功能');
        return;
    }

    btn.disabled = true; btn.textContent = '⏳ AI 思考中...';
    try {
        const result = await callAI(buildUserMessage(content), apiKey, provider, model);
        // Write JSON result to the JSON textarea
        if (jsonInput) {
            jsonInput.value = JSON.stringify(result, null, 2);
        }
        showAIStatus('success', '✅ AI 解析完成，请检查后点击「填入表单」');
    } catch (e) {
        showAIStatus('error', '❌ AI 解析失败: ' + (e.message || '未知错误'));
    }
    btn.disabled = false; btn.textContent = '🤖 AI 解析';
}

async function callAI(text, apiKey, providerKey, model) {
    const provider = AI_PROVIDERS[providerKey];

    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }],
            temperature: 0.3, max_tokens: 2000,
        }),
    });
    if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${resp.status}`); }
    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content || '';

    // Clean AI artifacts
    content = content.replace(/\[reference:\d+\]/g, '');
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    content = content.replace(/^﻿/, ''); // BOM

    // Try to extract JSON object or array
    const objMatch = content.match(/\{[\s\S]*\}/);
    const arrMatch = content.match(/\[[\s\S]*\]/);
    const m = objMatch || arrMatch;
    if (!m) throw new Error('AI 未返回有效的 JSON');

    return parseJsonSafe(m[0]);
}

function parseJsonSafe(str) {
    // Try direct parse first
    try { return JSON.parse(str); } catch {}

    // Auto-fix common AI JSON errors
    let fixed = str;

    // Chinese quotes → standard quotes
    fixed = fixed.replace(/“/g, '"').replace(/”/g, '"');
    fixed = fixed.replace(/‘/g, "'").replace(/’/g, "'");

    // Remove single-line comments
    fixed = fixed.replace(/\/\/.*$/gm, '');

    // Remove trailing commas before } or ]
    fixed = fixed.replace(/,\s*([\]}])/g, '$1');

    // Fix unescaped newlines inside strings (heuristic)
    fixed = fixed.replace(/"([^"]*)\n([^"]*)"/g, (match, a, b) => {
        // Only fix if it looks like a broken string value
        if (!a.endsWith('\\')) return '"' + a + '\\n' + b + '"';
        return match;
    });

    try { return JSON.parse(fixed); } catch (e) {
        throw new Error('AI 返回的 JSON 格式错误，请检查后手动修正: ' + e.message);
    }
}
