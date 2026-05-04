import { setPageMeta } from './seo.js';
import { renderHome } from './views/home.js';
import { renderDeckList } from './views/decks.js';
import { renderDeckDetail } from './views/detail.js';
import { renderStudy } from './views/study.js';
import { setRouteHandler } from './navigation.js';

async function handleRoute() {
    let path = location.pathname;
    if (path.startsWith('/')) path = path.slice(1);
    let query = location.search;
    if (query.startsWith('?')) query = query.slice(1);
    if (path.endsWith('/')) path = path.slice(0, -1);

    if (!path) {
        setPageMeta('知识卡片', '基于间隔重复的在线卡片学习工具，支持自定义牌组与 Anki 模板。');
        renderHome();
    } else if (path === 'decks') {
        const tag = query.startsWith('tag=') ? decodeURIComponent(query.slice(4)) : '';
        await renderDeckList(tag);
    } else if (path.startsWith('deck/')) {
        const name = decodeURIComponent(path.slice(5));
        await renderDeckDetail(name);
    } else if (path.startsWith('study/')) {
        const name = decodeURIComponent(path.slice(6));
        renderStudy(name);
    } else {
        history.pushState(null, '', '/');
        handleRoute();
    }
}

setRouteHandler(handleRoute);
window.addEventListener('popstate', handleRoute);
window.addEventListener('load', handleRoute);
