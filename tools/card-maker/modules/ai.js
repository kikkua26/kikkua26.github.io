// kikkua · 制卡工具 — AI 集成（支持 DeepSeek + 小米 MiMo）

import { rootEl } from './constants.js';
import { parseDataObject, hideQuickPaste } from './paste.js';
import { toast } from './utils.js';

// AI Provider 配置
const AI_PROVIDERS = {
    deepseek: {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        keyPrefix: 'sk-',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        defaultModel: 'deepseek-chat',
    },
    mimo: {
        name: '小米 MiMo',
        baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
        keyPrefix: 'tp-',
        models: ['mimo-v2.5-pro'],
        defaultModel: 'mimo-v2.5-pro',
    },
};

export async function aiParse() {
    const input = rootEl.querySelector('#cmPasteInput');
    const btn = rootEl.querySelector('#cmAiParse');
    if (!input || !btn) return;
    const text = input.value.trim();
    if (!text) { toast('请先粘贴内容', 'error'); return; }

    // Get selected provider and key
    const provider = rootEl.querySelector('#cmAIProvider')?.value || 'deepseek';
    const apiKey = rootEl.querySelector('#cmDsKey')?.value?.trim();
    const providerConfig = AI_PROVIDERS[provider];

    if (!apiKey) {
        toast(`请填写 ${providerConfig.name} API Key`, 'error');
        return;
    }
    if (!apiKey.startsWith(providerConfig.keyPrefix)) {
        toast(`Key 格式错误，应以 ${providerConfig.keyPrefix} 开头`, 'error');
        return;
    }

    // Save settings
    try { localStorage.setItem('kikkua_ai_provider', provider); } catch {}
    try { localStorage.setItem('kikkua_ai_key', apiKey); } catch {}
    try { localStorage.setItem('kikkua_ai_model', rootEl.querySelector('#cmDsModel')?.value || providerConfig.defaultModel); } catch {}

    btn.disabled = true; btn.textContent = '⏳ AI 思考中...';
    try {
        const result = await callAI(text, apiKey, provider);
        parseDataObject(typeof result === 'string' ? JSON.parse(result) : result);
        hideQuickPaste();
        toast('AI 解析完成', 'success');
    } catch (e) {
        toast('AI 解析失败: ' + (e.message || '未知错误'), 'error');
    }
    btn.disabled = false; btn.textContent = '🤖 AI 解析';
}

async function callAI(text, apiKey, providerKey) {
    const provider = AI_PROVIDERS[providerKey];
    const model = rootEl.querySelector('#cmDsModel')?.value || provider.defaultModel;

    const systemPrompt = `你是一个知识卡片结构化助手。将用户输入的文本解析为JSON格式（只输出JSON，不要任何其他文字）。

{
  "主字段": "核心知识点名称（不超过20字）",
  "章节": "学科::大类::小类（用::分隔层级，无法推断则留空）",
  "知识解析": { "要点1": "内容", "要点2": "内容" },
  "拓展解析": { "补充1": "内容" }
}

规则：
- 主字段提取最核心的知识点名称
- 章节推断学科归属，用::分隔（如 方剂学::解表剂::辛温解表）
- 知识解析提取3-5个关键概念/定义/组成/功效，字段名不超过8字
- 拓展解析提取1-3个补充信息（方歌/口诀/鉴别/举例/注意事项）
- 兼容多种输入格式：自由文本/教材段落/已标注字段/表格数据
- 空字段用空字符串""，不要写"无"或"暂无"`;

    const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
            temperature: 0.3, max_tokens: 2000,
        }),
    });
    if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error?.message || `HTTP ${resp.status}`); }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI 未返回有效的 JSON');
    return JSON.parse(m[0]);
}

// Update model options when provider changes
export function updateModelOptions() {
    const provider = rootEl.querySelector('#cmAIProvider')?.value || 'deepseek';
    const modelSelect = rootEl.querySelector('#cmDsModel');
    const keyInput = rootEl.querySelector('#cmDsKey');
    const providerConfig = AI_PROVIDERS[provider];

    if (modelSelect) {
        modelSelect.innerHTML = providerConfig.models.map(m =>
            `<option value="${m}">${m}</option>`
        ).join('');
    }

    if (keyInput) {
        keyInput.placeholder = `${providerConfig.name} Key (${providerConfig.keyPrefix}...)`;
    }
}
