const V = (import.meta.url ? new URL(import.meta.url).searchParams.get('v') : '') || '';
const load = (path) => import(`./${path}${V ? `?v=${V}` : ''}`);

const [
    { setPageMeta },
    { renderHome },
    { renderDeckList },
    { renderDeckDetail },
    { renderStudy },
    { renderAbout },
    { renderTools },
    { renderHanzi, renderHanziStudy, renderCopybook, renderColorGame },
    { setRouteHandler },
    { ROUTES, SITE, UI },
] = await Promise.all([
    load('seo.js'),
    load('views/home.js'),
    load('views/decks.js'),
    load('views/detail.js'),
    load('views/study.js'),
    load('views/about.js'),
    load('views/tools.js'),
    load('views/hanzi.js'),
    load('navigation.js'),
    load('config.js'),
]);

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
        } else if (path.startsWith(ROUTES.hanzi + '/color')) {
            const libId = query.startsWith('lib=') ? decodeURIComponent(query.slice(4)) : '';
            setPageMeta('认字涂色', '选出同色的字涂满它，在玩中认字');
            await renderColorGame(libId);
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
// 本模块经由顶层 await 加载，可能已错过 load 事件；需按文档状态择机触发首次路由
if (document.readyState === 'complete') {
    handleRoute();
} else {
    window.addEventListener('load', handleRoute);
}
