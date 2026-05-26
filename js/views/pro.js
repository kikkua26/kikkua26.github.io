import { $ } from '../utils.js';
import { ICONS } from '../storage.js';
import { navigate } from '../navigation.js';
import { SITE } from '../config.js';

const TV = '?v=2'; // cache buster for tool iframes
const TOOLS = [
    { id: 'occlusion', name: '遮挡块工具', icon: '🖼', desc: '在图片上绘制遮挡块，生成Anki图遮挡题数据', url: '/tools/occlusion/index.html' + TV },
    { id: 'question-bank', name: '题库编辑器', icon: '📋', desc: '表格化题库管理，支持CSV/Excel导入导出、AI生成题目', url: '/tools/question-bank/index.html' + TV },
];

export function renderPro() {
    const app = $('#app');
    let activeTool = TOOLS[0].id;
    const params = new URLSearchParams(location.search);
    if (params.get('tool')) activeTool = params.get('tool');

    app.innerHTML = `
        <div class="page pro-page">
            <header class="header" style="border:none;">
                <div class="header-inner">
                    <div class="header-left">
                        <a href="/" class="back-btn" title="返回首页">${ICONS.back}</a>
                        <h1 class="header-title" style="margin-left:4px;">kikkua Pro</h1>
                    </div>
                    <div class="header-right">
                        <span style="font-size:11px;color:var(--ink-light);">专业工具集</span>
                    </div>
                </div>
            </header>
            <div class="pro-layout">
                <div class="pro-tabs">
                    ${TOOLS.map(t => `
                        <div class="pro-tab${t.id === activeTool ? ' active' : ''}" data-tool="${t.id}" title="${t.desc}">
                            <span class="pro-tab-icon">${t.icon}</span>
                            <span class="pro-tab-name">${t.name}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="pro-content">
                    <iframe id="proFrame" src="${TOOLS.find(t => t.id === activeTool)?.url || TOOLS[0].url}" class="pro-frame"></iframe>
                </div>
            </div>
        </div>`;

    // Tab switching
    app.querySelectorAll('.pro-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const toolId = tab.dataset.tool;
            navigate('/pro?tool=' + toolId);
        });
    });
}
