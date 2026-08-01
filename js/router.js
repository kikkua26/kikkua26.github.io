import { setPageMeta } from './seo.js';
import { renderHome } from './views/home.js';
import { renderDeckList } from './views/decks.js';
import { renderDeckDetail } from './views/detail.js';
import { renderStudy } from './views/study.js';
import { renderAbout } from './views/about.js';
import { renderTools } from './views/tools.js';
import { renderHanzi, renderHanziStudy, renderCopybook } from './views/hanzi.js';
import { setRouteHandler } from './navigation.js';
import { ROUTES, SITE, UI } from './config.js';

async function handleRoute() {
    try {
        let path = location.pathname;
        if (path.startsWith('/')) path = path.slice(1);
        let query = location.search;
        if (query.startsWith('?')) query = query.slice(1);
        if (path.endsWith('/')) path = path.slice(0, -1);

        if (path === ROUTES.home) {
            setPageMeta('知识卡片', SITE.description);
            renderHome();
        } else if (path === ROUTES.decks) {
            const tag = query.startsWith('tag=') ? decodeURIComponent(query.slice(4)) : '';
            await renderDeckList(tag);
        } else if (path.startsWith(ROUTES.deckDetail)) {
            const name = decodeURIComponent(path.slice(ROUTES.deckDetail.length));
            await renderDeckDetail(name);
        } else if (path.startsWith(ROUTES.study)) {
            const name = decodeURIComponent(path.slice(ROUTES.study.length));
            renderStudy(name);
        } else if (path === ROUTES.about || path.startsWith(ROUTES.about + '?')) {
            setPageMeta(UI.about.title, '');
            await renderAbout();
        } else if (path === ROUTES.tools || path.startsWith(ROUTES.tools + '?')) {
            setPageMeta('工具箱', '专业制卡工具集');
            renderTools();
        } else if (path === ROUTES.hanzi) {
            setPageMeta('汉字小书房', '儿童汉字书写学习：选择字库，认字、看笔顺、临写、组词');
            await renderHanzi();
        } else if (path.startsWith(ROUTES.hanzi + '/copybook')) {
            setPageMeta('抄写本', '把想写的字组成一句话，像字帖一样逐字临写');
            await renderCopybook();
        } else if (path.startsWith(ROUTES.hanzi + '/')) {
            const libId = decodeURIComponent(path.slice(ROUTES.hanzi.length + 1));
            setPageMeta('汉字小书房', '儿童汉字书写练习：认字、看笔顺、临写、组词');
            await renderHanziStudy(libId);
        } else {
            history.pushState(null, '', '/');
            handleRoute();
        }
    } catch (e) {
        console.error('Route error:', e);
        history.pushState(null, '', '/');
        renderHome();
    }
}

setRouteHandler(handleRoute);
window.addEventListener('popstate', handleRoute);
window.addEventListener('load', handleRoute);
