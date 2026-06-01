// kikkua · 制卡工具 — 模板渲染工具
// 内联自 js/card.js，去除对主站代码的依赖

export function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceFields(template, data) {
    let result = template;
    const fieldsInTemplate = extractFieldsFromTemplate(template);
    const filledData = { ...data };
    fieldsInTemplate.forEach(field => { if (filledData[field] === undefined) filledData[field] = ''; });
    for (const [key, value] of Object.entries(filledData)) {
        const regex = new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

export function extractFieldsFromTemplate(template) {
    const regex = /\{\{([^#\/\{}^]+?)\}\}/g;
    const matches = [...template.matchAll(regex)];
    return [...new Set(matches.map(m => m[1].trim()))];
}

export function wrapWithCSS(html, css) {
    if (html.includes('<html') || html.includes('<!DOCTYPE')) {
        if (css) {
            const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            if (styleMatch) return html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>${css}</style>`);
            const headMatch = html.match(/<\/head>/i);
            if (headMatch) return html.replace(/<\/head>/i, `<style>${css}</style></head>`);
        }
        return html;
    }
    let bodyContent = html;
    let allScripts = '';

    bodyContent = bodyContent.replace(/<template[^>]*>([\s\S]*?)<\/template>/gi, (full, inner) => inner);

    const scriptRegex = /<script(?:[^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        const sc = match[1].trim();
        if (sc && !sc.startsWith('<!--')) allScripts += `\n<script>${sc}</script>\n`;
    }
    bodyContent = bodyContent.replace(/<script(?:[^>]*)>[\s\S]*?<\/script>/gi, '');

    return `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<style>${css}</style>\n</head>\n<body>${bodyContent}${allScripts}</body>\n</html>`;
}
