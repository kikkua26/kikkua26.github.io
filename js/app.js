// kikkua · 知识卡片 — 入口模块
// 模块化拆分参见 js/ 目录下的各子模块

// 版本号：与 index.html / 404.html 中的 ?v= 保持一致。
// ES 模块各自独立缓存，仅给 app.js 加 ?v= 无法刷新子模块，
// 因此这里显式给整条依赖链带上同一版本号。
// 注意：ES 模块中 document.currentScript 为 null，须用 import.meta.url 取查询串。
const V = (import.meta.url ? new URL(import.meta.url).searchParams.get('v') : '') || '';

const load = (path) => import(`./${path}${V ? `?v=${V}` : ''}`);

await Promise.all([load('storage.js'), load('seo.js')]);
// router 依赖 views/*，需在 storage/seo 之后加载；其内部同样透传版本号
await load('router.js');
