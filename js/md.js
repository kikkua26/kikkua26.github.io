export function mdToHtml(text) {
    if (!text) return '';
    const inline = (s) => s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const blocks = text.split(/\n{2,}/);
    return blocks.map(b => {
        b = b.trim();
        if (!b) return '';
        if (/^#{1,3}\s/.test(b)) {
            const level = b.match(/^#{1,3}/)[0].length;
            return `<h${level}>${inline(b.slice(level + 1))}</h${level}>`;
        }
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
        return `<p>${inline(b.replace(/\n/g, '<br>'))}</p>`;
    }).join('');
}
