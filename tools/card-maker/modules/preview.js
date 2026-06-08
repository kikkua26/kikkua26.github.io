// kikkua · 制卡工具 — 模板预览

import { TEMPLATE_NAME, templateCache, setTemplateCache, rootEl } from './constants.js';
import { replaceFields, wrapWithCSS } from './card-utils.js';
import { getFormData } from './form.js';

export async function loadTemplate() {
    if (templateCache) return templateCache;
    const base = `/templates/${encodeURIComponent(TEMPLATE_NAME)}/`;
    try {
        const [frontResp, backResp, cssResp] = await Promise.all([
            fetch(base + '正面模板.html'), fetch(base + '背面模板.html'), fetch(base + '样式.css'),
        ]);
        setTemplateCache({
            front: frontResp.ok ? await frontResp.text() : '{{主字段}}',
            back: backResp.ok ? await backResp.text() : '{{FrontSide}}\n<hr>\n{{主字段}}',
            css: cssResp.ok ? await cssResp.text() : '',
        });
    } catch {
        setTemplateCache({ front: '{{主字段}}', back: '{{FrontSide}}\n<hr>\n{{主字段}}', css: '' });
    }
    return templateCache;
}

let previewSeq = 0;
export async function updatePreview() {
    const iframe = rootEl.querySelector('#cmPreviewFrame');
    const infoEl = rootEl.querySelector('#cmPreviewInfo');
    if (!iframe) return;
    const seq = ++previewSeq;
    const tmpl = await loadTemplate();
    if (seq !== previewSeq) return;
    const fd = getFormData();

    const record = {
        '主字段': fd.mainField || ' ',
        '章节': fd.chapter || '',
        '等级': fd.level || '',
        '提要': '',
        '用户笔记': '',
        '知识解析': fd.knowledgeAnalysis || '',
        '知识拓展': fd.extendedAnalysis || '',
    };

    if (infoEl) {
        const hasData = record['主字段'].trim() || record['章节'] || record['知识解析'] || record['知识拓展'];
        infoEl.innerHTML = hasData
            ? `主字段:${record['主字段']?.slice(0,20) || '-'} | 章节:${record['章节']?.slice(0,20) || '-'} | 解析:${(record['知识解析']?.length||0)}字 | 拓展:${(record['知识拓展']?.length||0)}字`
            : '⚠ 表单为空，请选择笔记或填写字段';
        infoEl.style.color = hasData ? 'var(--green)' : 'var(--accent)';
    }

    const frontHTML = replaceFields(tmpl.front, record);
    const wrappedFront = wrapWithCSS(frontHTML, tmpl.css);

    const bodyMatch = wrappedFront.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const frontBody = bodyMatch ? bodyMatch[1] : wrappedFront;

    const backWithFields = replaceFields(tmpl.back, record);
    const backWithFront = backWithFields.replace(/\{\{FrontSide\}\}/gi, frontBody);

    let backHTML = wrapWithCSS(backWithFront, tmpl.css);
    backHTML = backHTML.replace(/<\/head>/i, '<script>function decryptBack(){}function decryptFront(){}</script></head>');

    iframe.srcdoc = backHTML;
}

export function previewIfNeeded() {
    const panel = rootEl.querySelector('.cm-preview-panel');
    if (panel && panel.offsetParent !== null) updatePreview();
}
