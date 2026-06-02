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
// AI Parse
// ═══════════════════════════════════════

export async function aiParse() {
    const input = rootEl.querySelector('#cmPasteInput');
    const btn = rootEl.querySelector('#cmAiParse');
    if (!input || !btn) return;
    const text = input.value.trim();
    if (!text) { toast('请先粘贴内容', 'error'); return; }

    // Get settings from localStorage
    const provider = localStorage.getItem('kikkua_ai_provider') || 'deepseek';
    const apiKey = localStorage.getItem('kikkua_ai_key') || '';
    const model = localStorage.getItem('kikkua_ai_model') || AI_PROVIDERS[provider].defaultModel;
    const config = AI_PROVIDERS[provider];

    if (!apiKey) {
        toast('请先在设置中配置 AI', 'error');
        return;
    }

    btn.disabled = true; btn.textContent = '⏳ AI 思考中...';
    try {
        const result = await callAI(text, apiKey, provider, model);
        parseDataObject(typeof result === 'string' ? JSON.parse(result) : result);
        hideQuickPaste();
        toast('AI 解析完成', 'success');
    } catch (e) {
        toast('AI 解析失败: ' + (e.message || '未知错误'), 'error');
    }
    btn.disabled = false; btn.textContent = '🤖 AI 解析';
}

async function callAI(text, apiKey, providerKey, model) {
    const provider = AI_PROVIDERS[providerKey];

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
