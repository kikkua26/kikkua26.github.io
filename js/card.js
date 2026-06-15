import { $ } from './utils.js';

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
        const htmlValue = String(value).replace(/\n/g, '<br>');
        result = result.replace(regex, htmlValue);
    }
    return result;
}

export function extractFieldsFromTemplate(template) {
    const regex = /\{\{([^#\/\{}^]+?)\}\}/g;
    const matches = [...template.matchAll(regex)];
    return [...new Set(matches.map(m => m[1].trim()))];
}

function extractBody(html) {
    const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return m ? m[1] : html;
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

export function renderCard(state) {
    const frame = $('#card-frame');
    if (!frame) return;
    frame.srcdoc = state.isShowingFront ? state.frontHTML : state.backHTML;
}
