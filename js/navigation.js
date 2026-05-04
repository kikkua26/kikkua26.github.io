let _routeHandler = null;

export function setRouteHandler(fn) {
    _routeHandler = fn;
}

export function navigate(url) {
    history.pushState(null, '', url);
    if (_routeHandler) _routeHandler();
}

// Intercept internal link clicks
document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.host !== location.host) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href === '//' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    e.preventDefault();
    navigate(href);
});
