// kikkua · 题库编辑器 — AI 生成（prompt 构建 + API 调用）

import { ANALYSIS_STYLE_MAP } from './constants.js';
import { stripCodeBlock, parseCSVLine, importAOA } from './import.js';

let aiType = 'choice';
let aiMode = 'batch';
let aiAnalysisStyle = 'default';

// ═══════════════════════════════════════
// AI Provider 配置
// ═══════════════════════════════════════

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

function getAIConfig() {
    return {
        provider: localStorage.getItem('kikkua_ai_provider') || 'deepseek',
        apiKey: localStorage.getItem('kikkua_ai_key') || '',
        model: localStorage.getItem('kikkua_ai_model') || '',
    };
}

// ═══════════════════════════════════════
// Settings Modal
// ═══════════════════════════════════════

export function showSettings() {
    const modal = document.getElementById('aiSettingsModal');
    if (!modal) return;

    const { provider, apiKey, model } = getAIConfig();
    const selectedModel = model || AI_PROVIDERS[provider].defaultModel;

    // Set provider
    modal.querySelectorAll('[data-provider]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.provider === provider);
    });

    // Set key
    const keyInput = document.getElementById('aiSettingsKey');
    if (keyInput) keyInput.value = apiKey;

    // Update model options
    updateSettingsModels(provider, selectedModel);

    // Clear test result
    const testResult = document.getElementById('aiTestResult');
    if (testResult) { testResult.innerHTML = ''; testResult.className = 'test-result'; }

    modal.classList.add('show');
}

export function hideSettings() {
    const modal = document.getElementById('aiSettingsModal');
    if (modal) modal.classList.remove('show');
}

export function saveSettings() {
    const modal = document.getElementById('aiSettingsModal');
    if (!modal) return;

    const provider = modal.querySelector('[data-provider].active')?.dataset?.provider || 'deepseek';
    const key = document.getElementById('aiSettingsKey')?.value?.trim() || '';
    const model = document.getElementById('aiSettingsModel')?.value || AI_PROVIDERS[provider].defaultModel;

    localStorage.setItem('kikkua_ai_provider', provider);
    localStorage.setItem('kikkua_ai_key', key);
    localStorage.setItem('kikkua_ai_model', model);

    hideSettings();
}

function updateSettingsModels(provider, selectedModel) {
    const config = AI_PROVIDERS[provider];
    const modelSelect = document.getElementById('aiSettingsModel');
    const keyInput = document.getElementById('aiSettingsKey');

    if (modelSelect) {
        modelSelect.innerHTML = config.models.map(m =>
            `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`
        ).join('');
    }

    if (keyInput) {
        keyInput.placeholder = `${config.name} Key (${config.keyPrefix}...)`;
    }
}

export function switchProvider(provider) {
    const config = AI_PROVIDERS[provider];
    if (!config) return;

    document.querySelectorAll('#aiSettingsModal [data-provider]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.provider === provider);
    });
    updateSettingsModels(provider, config.defaultModel);
}

export async function testConnection() {
    const provider = document.querySelector('#aiSettingsModal [data-provider].active')?.dataset?.provider || 'deepseek';
    const key = document.getElementById('aiSettingsKey')?.value?.trim() || '';
    const model = document.getElementById('aiSettingsModel')?.value || AI_PROVIDERS[provider].defaultModel;
    const config = AI_PROVIDERS[provider];
    const testBtn = document.getElementById('aiTestBtn');
    const testResult = document.getElementById('aiTestResult');

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

    try {
        const resp = await fetch(config.baseUrl + '/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 5,
            }),
        });
        if (resp.ok) {
            testResult.innerHTML = '✅ 连接成功！';
            testResult.className = 'test-result success';
        } else {
            const err = await resp.text();
            testResult.innerHTML = `❌ 连接失败 (${resp.status})`;
            testResult.className = 'test-result error';
        }
    } catch (e) {
        testResult.innerHTML = '❌ 网络错误：' + e.message;
        testResult.className = 'test-result error';
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = '🔗 测试连接';
    }
}

// ═══════════════════════════════════════
// AI Modal
// ═══════════════════════════════════════

export function openAIModal() {
    document.getElementById('aiStatus').className = 'ai-status';
    document.getElementById('aiStatusText').textContent = '';
    document.getElementById('btnGenerateAI').disabled = false;
    document.getElementById('aiModal').classList.add('show');
}

export function closeAIModal() {
    document.getElementById('aiModal').classList.remove('show');
}

export function selectAIType(el) {
    el.parentElement.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    aiType = el.dataset.type;
}

export function selectAIMode(el) {
    el.parentElement.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    aiMode = el.dataset.mode;
    document.getElementById('aiBatchHint').textContent = aiMode === 'single'
        ? 'AI 会从内容中选取最核心的知识点，生成 1 道题。'
        : aiMode === 'batch'
        ? 'AI 会完整覆盖所有知识点生成题目，按难度分布。'
        : '整理模式：粘贴格式混乱的题目，AI 会自动整理为标准格式并导入。建议每次控制在 50 题以内，效果最佳。';

    const knowledgeInput = document.getElementById('aiKnowledgeInput');
    if (aiMode === 'organize') {
        knowledgeInput.placeholder = '在此粘贴需要整理的题目内容（格式不限），AI 会自动识别并整理为标准格式...';
    } else {
        knowledgeInput.placeholder = '在此粘贴知识点、课文段落、笔记等任何内容，AI 会据此生成题目...';
    }
}

export function selectAnalysisStyle(el) {
    el.parentElement.querySelectorAll('.ai-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    aiAnalysisStyle = el.dataset.style;
}

function setAIStatus(type, text) {
    const el = document.getElementById('aiStatus');
    el.className = 'ai-status show ' + type;
    document.getElementById('aiStatusText').textContent = text;
}

function buildPrompt() {
    const chapter = document.getElementById('aiChapter').value.trim();
    const content = document.getElementById('aiKnowledgeInput').value.trim();
    const analysisRule = ANALYSIS_STYLE_MAP[aiAnalysisStyle] || ANALYSIS_STYLE_MAP.default;
    const countRule = aiMode === 'single'
        ? '只生成 1 道题，从内容中选取最核心的知识点出题'
        : '完整覆盖内容中的所有知识点生成题目，数量根据实际知识点数量决定，不遗漏任何知识点';
    const chapterRule = chapter
        ? `"Chapter" 字段统一填写「${chapter}」`
        : '"Chapter" 字段根据内容自行归类，多级标题用 :: 分隔（如「中医基础理论::绪论::……」）';
    const diffRule = aiMode === 'batch' ? `- 难度分布：大致按 3:5:2 的比例分配「识记」「理解」「应用」三个层次的题目，不要全部集中在同一层次\n` : '';

    const base = `你是一个专业的题目出题助手。根据用户提供的知识内容生成高质量考题。

硬性规则：
- 只输出一个 \`\`\`json 代码块，代码块内为 JSON 数组，禁止输出代码块以外的任何文字
- JSON 的键和字符串值必须使用半角双引号
- ${countRule}
- ${chapterRule}
- ${diffRule}- "Analysis"（解析）：${analysisRule}
- "Reference"（知识点来源）字段：从内容中提取该题涉及的核心知识点名称，如「光合作用的定义」「牛顿第二定律」`;

    if (aiMode === 'organize') {
        const organizeBase = `你是一个专业的题目整理助手。用户会提供格式混乱、不规范的题目内容，你需要将其整理为标准 JSON 格式。

硬性规则：
- 只输出一个 \`\`\`json 代码块，代码块内为 JSON 数组，禁止输出代码块以外的任何文字
- JSON 的键和字符串值必须使用半角双引号
- "Type" 字段只能填写下方「字段要求」中指定的题型值，严禁填写其他任何值，严禁添加括号注释
- 必须完整保留所有题目，不得遗漏任何一道
- 必须准确还原每道题的原始内容，不得篡改题意、选项或答案
- 如果原始内容中存在完全重复的题目，只保留 1 道
- 如果某道题缺少选项或答案等关键信息，在对应字段标注「[待补全]」，不要删除该题
- ${chapterRule}
- "Reference" 字段：从内容中提取该题涉及的核心知识点名称`;

        if (aiType === 'choice') {
            return `${organizeBase}

将题目整理为选择题格式。

JSON 结构示例：
\`\`\`json
[
  {
    "Type": "单选题",
    "Question": "题干内容",
    "OptionA": "选项A",
    "OptionB": "选项B",
    "OptionC": "选项C",
    "OptionD": "选项D",
    "OptionE": "",
    "Answer": "B",
    "Analysis": "解析内容",
    "Reference": "知识点名称",
    "Chapter": "章节路径"
  }
]
\`\`\`

字段要求：
- "Type" 字段只允许填 3 种值：「单选题」「多选题」「判断题」。判断题指只有对/错或是/否两个选项的题目。严禁填写其他任何值，严禁加括号注释
- "Question"：题干，表述清晰完整
- "OptionA" ~ "OptionE"：各选项内容，根据题目需要决定选项数量（至少 4 个，最多 6 个，不需要的选项留空）
- 如果原始题目选项不足 4 个，用相关内容补齐至 4 个
- "Answer"：单选题填一个大写字母（如 B），多选题填多个大写字母（如 AC），判断题填「正确」或「错误」
- 保留原始题目的单选/多选/判断设定；如果原始题目未标明，默认为单选题

以下是需要整理的题目内容：
${content}`;
        } else if (aiType === 'cloze') {
            return `${organizeBase}

将题目整理为挖空题格式。

JSON 结构示例：
\`\`\`json
[
  {
    "Type": "挖空题",
    "ClozeText": "光合作用需要 [[阳光]]、[[水]] 和 [[二氧化碳]]",
    "Analysis": "解析内容",
    "Reference": "知识点名称",
    "Chapter": "章节路径"
  }
]
\`\`\`

字段要求：
- "Type" 字段只允许填「挖空题」，严禁填写其他任何值
- "ClozeText"：将原始题目中的关键术语用 [[正确答案]] 挖空
- 每道题可挖 1~3 个空，挖空内容应是理解该知识点必不可少的关键术语
- 如果原始题目已有下划线或括号标注的填空位置，按原始位置处理

以下是需要整理的题目内容：
${content}`;
        } else {
            return `${organizeBase}

将题目整理为问答题格式。

JSON 结构示例：
\`\`\`json
[
  {
    "Type": "问答题",
    "Question": "问题内容",
    "AnswerText": "标准答案",
    "Analysis": "解析内容",
    "Reference": "知识点名称",
    "Chapter": "章节路径"
  }
]
\`\`\`

字段要求：
- "Type" 字段只允许填「问答题」，严禁填写其他任何值
- "Question"：问题，表述清晰
- "AnswerText"：完整的标准答案

以下是需要整理的题目内容：
${content}`;
        }
    }

    if (aiType === 'choice') {
        return `${base}

生成选择题。

JSON 结构示例：
\`\`\`json
[
  {
    "Type": "单选题",
    "Question": "题干内容",
    "OptionA": "选项A",
    "OptionB": "选项B",
    "OptionC": "选项C",
    "OptionD": "选项D",
    "OptionE": "",
    "Answer": "B",
    "Analysis": "解析内容",
    "Reference": "知识点名称",
    "Chapter": "章节路径"
  }
]
\`\`\`

字段要求：
- "Type" 字段只允许填 3 种值：「单选题」「多选题」「判断题」。判断题指只有对/错或是/否两个选项的题目。严禁填写其他任何值，严禁加括号注释
- "Question"：题干，表述清晰完整，包含足够的上下文信息
- "OptionA" ~ "OptionE"：各选项内容，根据题目需要决定选项数量（至少 4 个，最多 6 个，不需要的选项留空）
- 干扰项要求：每个错误选项必须是该知识点中容易混淆的概念或常见误解，不能是明显无关或荒谬的内容
- "Answer"：单选题填一个大写字母（如 B），多选题填多个大写字母（如 AC），判断题填「正确」或「错误」

以下是知识内容：
${content}`;
    } else if (aiType === 'cloze') {
        return `${base}

生成挖空题。

JSON 结构示例：
\`\`\`json
[
  {
    "Type": "挖空题",
    "ClozeText": "光合作用需要 [[阳光]]、[[水]] 和 [[二氧化碳]]",
    "Analysis": "解析内容",
    "Reference": "知识点名称",
    "Chapter": "章节路径"
  }
]
\`\`\`

字段要求：
- "Type" 字段只允许填「挖空题」，严禁填写其他任何值
- "ClozeText"：在关键位置用 [[正确答案]] 挖空，如「光合作用需要 [[阳光]]、[[水]] 和 [[二氧化碳]]」
- 每道题可挖 1~3 个空，挖空内容应是理解该知识点必不可少的关键术语，去掉后该句无法靠上下文推断
- 不要在不重要的修饰词、连接词上挖空
- 如果知识内容适合拆成多道填空题，可以生成多道

以下是知识内容：
${content}`;
    } else {
        return `${base}

生成问答题（简答/论述）。

JSON 结构示例：
\`\`\`json
[
  {
    "Type": "问答题",
    "Question": "问题内容",
    "AnswerText": "标准答案",
    "Analysis": "解析内容",
    "Reference": "知识点名称",
    "Chapter": "章节路径"
  }
]
\`\`\`

字段要求：
- "Type" 字段只允许填「问答题」，严禁填写其他任何值
- "Question"：问题，表述清晰，明确指出答题方向（如「简述」「比较」「分析原因」）
- "AnswerText"：完整的标准答案，简答题 2~3 句话点明核心要点，论述题需分点展开、逻辑完整
- 如果知识内容适合拆成多道问答题，可以生成多道

以下是知识内容：
${content}`;
    }
}

export async function copyPrompt() {
    const content = document.getElementById('aiKnowledgeInput').value.trim();
    const systemMsg = aiMode === 'organize'
        ? '你是一个专业的题目整理助手，只输出 JSON 格式数据，绝不输出任何多余文字。必须完整保留所有题目，不得遗漏。'
        : '你是一个专业的题目出题助手，只输出 JSON 格式数据，绝不输出任何多余文字。';

    let fullPrompt;
    if (content) {
        const prompt = buildPrompt();
        fullPrompt = `[System]\n${systemMsg}\n\n[User]\n${prompt}`;
    } else {
        const confirmMsg = `${systemMsg}

请理解以上系统规则，并确认以下几点：
1. 输出格式为 JSON 数组，用 \`\`\`json 代码块包裹
2. 各题型的字段结构你是否理解
3. 回复「已准备好，等待内容」，然后等待我发送知识内容`;
        fullPrompt = confirmMsg;
    }

    try {
        await navigator.clipboard.writeText(fullPrompt);
        setAIStatus('success', content ? '已复制提示词！请粘贴到 AI 对话中' : '已复制系统提示词！请粘贴到 AI 对话，AI 确认后再发送内容');
    } catch {
        const ta = document.createElement('textarea');
        ta.value = fullPrompt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        setAIStatus('success', content ? '已复制提示词！请粘贴到 AI 对话中' : '已复制系统提示词！请粘贴到 AI 对话，AI 确认后再发送内容');
    }
}

function parseJsonSafe(str) {
    try { return JSON.parse(str); } catch {}
    let fixed = str;
    fixed = fixed.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
    fixed = fixed.replace(/,\s*([\]}])/g, '$1');
    try { return JSON.parse(fixed); } catch (e) {
        throw new Error('AI 返回的 JSON 格式错误: ' + e.message);
    }
}

function jsonToAOA(data) {
    if (!Array.isArray(data)) data = [data];
    if (data.length === 0) throw new Error('AI 返回数据为空');
    const headers = Object.keys(data[0]);
    const aoa = [headers, ...data.map(item => headers.map(h => String(item[h] ?? '')))];
    return aoa;
}

export async function generateAI() {
    const { provider, apiKey, model: savedModel } = getAIConfig();
    const config = AI_PROVIDERS[provider];
    const baseUrl = config.baseUrl;
    const model = savedModel || config.defaultModel;
    const content = document.getElementById('aiKnowledgeInput').value.trim();

    if (!apiKey) {
        closeAIModal();
        showSettings();
        return;
    }
    if (!content) { setAIStatus('error', '请输入知识内容'); return; }

    const prompt = buildPrompt();
    setAIStatus('loading', '正在生成，请稍候...');
    document.getElementById('btnGenerateAI').disabled = true;

    try {
        const resp = await fetch(baseUrl + '/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: aiMode === 'organize'
                        ? '你是一个专业的题目整理助手，只输出 JSON 格式数据，绝不输出任何多余文字。必须完整保留所有题目，不得遗漏。'
                        : '你是一个专业的题目出题助手，只输出 JSON 格式数据，绝不输出任何多余文字。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.4,
                max_tokens: 16384,
            })
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`API 请求失败 (${resp.status}): ${err}`);
        }

        const data = await resp.json();
        let contentText = stripCodeBlock(data.choices?.[0]?.message?.content || '');
        if (!contentText) throw new Error('AI 返回内容为空');

        contentText = contentText.replace(/^﻿/, '');
        const objMatch = contentText.match(/\{[\s\S]*\}/);
        const arrMatch = contentText.match(/\[[\s\S]*\]/);
        const m = objMatch || arrMatch;
        if (!m) throw new Error('AI 未返回有效的 JSON');

        const jsonData = parseJsonSafe(m[0]);
        const aoa = jsonToAOA(jsonData);

        const validHeaders = ['type','question','clozetext','answertext','answer','analysis','reference','chapter',
            'optiona','optionb','optionc','optiond','optione','optionf','optiong'];
        const header = aoa[0].map(h => String(h).trim().toLowerCase());
        if (!header.some(h => validHeaders.includes(h))) throw new Error('AI 返回的数据不包含有效字段');

        const resultArea = document.getElementById('aiResultArea');
        if (resultArea) resultArea.value = JSON.stringify(jsonData, null, 2);
        const rowCount = Array.isArray(jsonData) ? jsonData.length : 1;
        setAIStatus('success', `AI 生成完成，共 ${rowCount} 道题，请检查后点击「导入数据」`);
    } catch (err) {
        setAIStatus('error', err.message);
    } finally {
        document.getElementById('btnGenerateAI').disabled = false;
    }
}

export function importResult() {
    const resultArea = document.getElementById('aiResultArea');
    let text = resultArea?.value?.trim();
    if (!text) { setAIStatus('error', '请先粘贴 AI 返回的数据，或点击「生成」自动生成'); return; }

    text = stripCodeBlock(text).replace(/^﻿/, '');

    try {
        let aoa;
        const trimmed = text.trim();
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const jsonData = parseJsonSafe(trimmed);
            aoa = jsonToAOA(jsonData);
        } else {
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            aoa = lines.map(parseCSVLine);
        }

        const validHeaders = ['type','question','clozetext','answertext','answer','analysis','reference','chapter',
            'optiona','optionb','optionc','optiond','optione','optionf','optiong'];
        const header = aoa[0].map(h => String(h).trim().toLowerCase());
        if (!header.some(h => validHeaders.includes(h))) throw new Error('数据不包含有效字段');

        importAOA(aoa);
        const rowCount = aoa.length - 1;
        setAIStatus('success', `成功导入 ${rowCount} 道题`);
        resultArea.value = '';
        setTimeout(closeAIModal, 1200);
    } catch (e) {
        setAIStatus('error', '导入失败: ' + e.message);
    }
}
