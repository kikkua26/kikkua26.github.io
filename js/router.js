import { setPageMeta } from './seo.js';
import { renderHome } from './views/home.js';
import { renderDeckList } from './views/decks.js';
import { renderDeckDetail } from './views/detail.js';
import { renderStudy } from './views/study.js';
import { renderAbout } from './views/about.js';
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
