export function mdToHtml(text) {
    if (!text) return '';
    const inline = (s) => s
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
            if (/^(https?:|mailto:)/.test(url)) return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
            return `<a href="${url}">${text}</a>`;
        })
        .replace(/(?<!["'>])(https?:\/\/[^\s<>"'，。；：、]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
        .replace(/(?<!["'>])([\w.-]+@[\w.-]+\.\w+)/g, '<a href="mailto:$1">$1</a>');

    // Handle fenced callout blocks
    const calloutMap = {};
    text = text.replace(/^:::(\w+)\n([\s\S]*?)\n:::/gm, (_, type, content) => {
        const key = 'CALLOUT_' + Math.random().toString(36).slice(2);
        const inner = content.split(/\n{2,}/).map(b => {
            b = b.trim();
            if (!b) return '';
            return `<p>${inline(b.replace(/\n/g, '<br>'))}</p>`;
        }).join('');
        calloutMap[key] = `<div class="callout callout-${type}"><div>${inner}</div></div>`;
        return key;
    });

    const blocks = text.split(/\n{2,}/);
    return blocks.map(b => {
        b = b.trim();
        if (!b) return '';
        if (calloutMap[b]) return calloutMap[b];
        if (/^#{1,3}\s/.test(b)) {
            const level = b.match(/^#{1,3}/)[0].length;
            return `<h${level}>${inline(b.slice(level + 1))}</h${level}>`;
        }
        if (/^[-*]{3,}\s*$/.test(b)) return '<hr>';
        if (/^> /.test(b)) {
            return `<blockquote>${inline(b.replace(/\n> /g, '\n').slice(2))}</blockquote>`;
        }
        if (/^[-*]\s/.test(b)) {
            const items = b.split(/\n(?=[-*]\s)/).map(i => `<li>${inline(i.slice(2))}</li>`).join('');
            return `<ul>${items}</ul>`;
        }
        if (/^\d+\.\s/.test(b)) {
            const items = b.split(/\n(?=\d+\.\s)/).map(i => `<li>${inline(i.replace(/^\d+\.\s/, ''))}</li>`).join('');
            return `<ol>${items}</ol>`;
        }
        if (/^```/.test(b)) {
            const code = b.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
            return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        }
        if (/^\|/.test(b)) {
            const rows = b.split(/\n/).filter(r => r.trim());
            if (rows.length >= 2 && /^\|[\s:-]+\|/.test(rows[1])) {
                const parseCells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
                const headers = parseCells(rows[0]);
                const aligns = parseCells(rows[1]).map(c => {
                    if (/^:-+:$/.test(c)) return 'center';
                    if (/^-+:$/.test(c)) return 'right';
                    return 'left';
                });
                let html = '<table><thead><tr>';
                headers.forEach((h, i) => {
                    html += `<th style="text-align:${aligns[i] || 'left'}">${inline(h)}</th>`;
                });
                html += '</tr></thead><tbody>';
                rows.slice(2).forEach(r => {
                    const cells = parseCells(r);
                    html += '<tr>';
                    cells.forEach((c, i) => {
                        html += `<td style="text-align:${aligns[i] || 'left'}">${inline(c)}</td>`;
                    });
                    html += '</tr>';
                });
                html += '</tbody></table>';
                return html;
            }
        }
        return `<p>${inline(b.replace(/\n/g, '<br>'))}</p>`;
    }).join('');
}
