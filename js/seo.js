export function setPageMeta(title, desc) {
    const base = 'kikkua · ';
    document.title = base + title;
    const setMeta = (prop, name, val) => {
        let el = document.querySelector(`meta[${prop}="${name}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute(prop, name); document.head.appendChild(el); }
        el.setAttribute('content', val);
    };
    if (desc) {
        setMeta('name', 'description', desc);
        setMeta('property', 'og:description', desc);
        setMeta('name', 'twitter:description', desc);
    }
    setMeta('property', 'og:title', document.title);
    setMeta('name', 'twitter:title', document.title);
    setMeta('property', 'og:url', location.href);
}

// Inject JSON-LD once on startup
(function() {
    const data = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'kikkua',
        url: 'https://kikkua.online/',
        description: '基于间隔重复的在线卡片学习工具',
        inLanguage: 'zh-CN',
        potentialAction: {
            '@type': 'SearchAction',
            target: 'https://kikkua.online/decks?tag={search_term_string}',
            'query-input': 'required name=search_term_string'
        }
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
})();
