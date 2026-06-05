import { $ } from '../utils.js';
import { ICONS } from '../icons.js';
import { navigate } from '../navigation.js';
import { SITE } from '../config.js';

const TV = '?v=7'; // cache buster for tool iframes

// SHA-256 hash of password (kikkua2649)
const PROTECTED_HASH = '2f9ce55a6be0183a94b0271738254dad35a34467b0fc852fd65654485f751c25';

const TOOLS = [
    { id: 'occlusion', name: '遮挡块工具', icon: '🖼', desc: '在图片上绘制遮挡块，生成Anki图遮挡题数据', url: '/tools/occlusion/index.html' + TV },
    { id: 'question-bank', name: '题库编辑器', icon: '📋', desc: '表格化题库管理，支持CSV/Excel导入导出、AI生成题目', url: '/tools/question-bank/index.html' + TV },
    { id: 'card-maker', name: '制卡工具', icon: '🃏', desc: '制卡工具，支持章节管理、AI解析、CSV导入导出', url: '/tools/card-maker/index.html' + TV, protected: true },
];

// Store verified tools in session
const verifiedTools = new Set(JSON.parse(sessionStorage.getItem('verified_tools') || '[]'));

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showPasswordDialog(toolId) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'password-overlay';
        overlay.innerHTML = `
            <div class="password-dialog">
                <h3>🔐 需要密码</h3>
                <p>此工具需要密码才能使用</p>
                <input type="password" class="password-input" placeholder="请输入密码" id="passwordInput">
                <div class="password-error hidden" id="passwordError">密码错误</div>
                <div class="password-actions">
                    <button class="btn-cancel" id="passwordCancel">取消</button>
                    <button class="btn-confirm" id="passwordConfirm">确定</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        const input = overlay.querySelector('#passwordInput');
        const error = overlay.querySelector('#passwordError');
        const cancelBtn = overlay.querySelector('#passwordCancel');
        const confirmBtn = overlay.querySelector('#passwordConfirm');

        input.focus();

        const cleanup = (result) => {
            overlay.remove();
            resolve(result);
        };

        confirmBtn.addEventListener('click', async () => {
            const hash = await hashPassword(input.value);
            if (hash === PROTECTED_HASH) {
                verifiedTools.add(toolId);
                sessionStorage.setItem('verified_tools', JSON.stringify([...verifiedTools]));
                cleanup(true);
            } else {
                error.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        });

        cancelBtn.addEventListener('click', () => cleanup(false));

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') cleanup(false);
        });

        overlay.addEventListener('click', e => {
            if (e.target === overlay) cleanup(false);
        });
    });
}

export function renderTools() {
    const app = $('#app');
    let activeTool = TOOLS[0].id;
    const params = new URLSearchParams(location.search);
    if (params.get('tool')) activeTool = params.get('tool');

    // Check if trying to access protected tool without verification
    const activeToolData = TOOLS.find(t => t.id === activeTool);
    if (activeToolData?.protected && !verifiedTools.has(activeTool)) {
        activeTool = TOOLS[0].id; // Redirect to first unprotected tool
    }

    app.innerHTML = `
        <style>
            .password-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,.5);
                z-index: 10000; display: flex; align-items: center; justify-content: center;
            }
            .password-dialog {
                background: var(--bg, #fff); border-radius: 12px; padding: 32px;
                max-width: 360px; width: 90%; box-shadow: 0 8px 40px rgba(0,0,0,.2);
                text-align: center;
            }
            .password-dialog h3 { font-size: 20px; margin-bottom: 8px; }
            .password-dialog p { color: var(--ink-light, #666); font-size: 14px; margin-bottom: 20px; }
            .password-input {
                width: 100%; padding: 12px 16px; border: 2px solid var(--border, #ddd);
                border-radius: 8px; font-size: 16px; text-align: center;
                outline: none; transition: border-color .2s;
            }
            .password-input:focus { border-color: var(--accent, #0d9488); }
            .password-error { color: #e74c3c; font-size: 13px; margin-top: 8px; }
            .password-error.hidden { display: none; }
            .password-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: center; }
            .password-actions button {
                padding: 10px 24px; border-radius: 8px; font-size: 14px;
                font-weight: 500; cursor: pointer; border: none; transition: .2s;
            }
            .btn-cancel { background: var(--border, #eee); color: var(--text, #333); }
            .btn-cancel:hover { background: #ddd; }
            .btn-confirm { background: var(--accent, #0d9488); color: #fff; }
            .btn-confirm:hover { background: var(--accent-hover, #0f766e); }
            .pro-tab.locked { opacity: 0.6; }
            .pro-tab.locked::after { content: '🔒'; font-size: 10px; margin-left: 4px; }
        </style>
        <div class="page pro-page">
            <header class="header">
                <div class="header-inner">
                    <div class="header-left">
                        <a href="/" class="back-btn" title="返回首页">${ICONS.back}</a>
                        <button class="pro-menu-btn" id="proMenuBtn" title="切换工具列表">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                        </button>
                        <h1 class="header-title">工具箱</h1>
                    </div>
                    <div class="header-right">
                        <span class="header-link" style="font-size:11px;">专业工具集</span>
                    </div>
                </div>
            </header>
            <div class="pro-layout">
                <div class="pro-tabs">
                    ${TOOLS.map(t => {
                        const isLocked = t.protected && !verifiedTools.has(t.id);
                        return `
                            <div class="pro-tab${t.id === activeTool ? ' active' : ''}${isLocked ? ' locked' : ''}"
                                 data-tool="${t.id}"
                                 data-protected="${t.protected ? '1' : '0'}"
                                 title="${t.desc}">
                                <span class="pro-tab-icon">${t.icon}</span>
                                <span class="pro-tab-name">${t.name}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="pro-content">
                    <iframe id="proFrame" src="${TOOLS.find(t => t.id === activeTool)?.url || TOOLS[0].url}" class="pro-frame"></iframe>
                </div>
            </div>
        </div>`;

    // Sidebar toggle on mobile
    const menuBtn = document.getElementById('proMenuBtn');
    const proTabs = app.querySelector('.pro-tabs');
    const proLayout = app.querySelector('.pro-layout');

    if (menuBtn && proTabs) {
        // Create overlay element for mobile
        const overlay = document.createElement('div');
        overlay.className = 'pro-overlay';
        proLayout.appendChild(overlay);

        const closeSidebar = () => {
            proTabs.classList.remove('open');
            menuBtn.classList.remove('active');
            overlay.classList.remove('visible');
        };

        menuBtn.addEventListener('click', () => {
            const opening = !proTabs.classList.contains('open');
            proTabs.classList.toggle('open');
            menuBtn.classList.toggle('active');
            overlay.classList.toggle('visible', opening);
        });

        overlay.addEventListener('click', closeSidebar);
    }

    // Tab switching with password protection
    app.querySelectorAll('.pro-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const toolId = tab.dataset.tool;
            const isProtected = tab.dataset.protected === '1';

            if (isProtected && !verifiedTools.has(toolId)) {
                const verified = await showPasswordDialog(toolId);
                if (!verified) return;
            }

            // Close sidebar on mobile after selecting a tool
            if (proTabs && proTabs.classList.contains('open')) {
                proTabs.classList.remove('open');
                menuBtn?.classList.remove('active');
                app.querySelector('.pro-overlay')?.classList.remove('visible');
            }

            navigate('/tools?tool=' + toolId);
        });
    });
}
