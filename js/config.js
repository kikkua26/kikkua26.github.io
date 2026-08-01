// kikkua · 全局配置
// 所有硬编码字符串、路径、默认值集中于此

export const SITE = {
    brand: 'kikkua',
    title: 'kikkua · 知识卡片',
    tagline: '精选牌组 · 预览选购',
    description: 'kikkua 出品的 Anki 牌组 — 先看后买，高效备考。',
    url: 'https://kikkua.online/',
    githubUrl: 'https://kikkua26.github.io/',
    locale: 'zh-CN',
    ogLocale: 'zh_CN',
    author: 'kikkua',
    keywords: 'Anki,记忆卡片,牌组,知识卡片,学习工具',
    footerQuote: '学习之要，在于重复。温故知新，积微成著。',
};

export const ROUTES = {
    home: '',
    decks: 'decks',
    deckDetail: 'deck/',
    study: 'study/',
    about: 'about',
    tools: 'tools',
    hanzi: 'hanzi',
};

export const DATA_PATHS = {
    index: '/data/index.json',
    pages: '/data/pages.json',
    deckData: (name) => `/data/${encodeURIComponent(name)}/data.csv`,
    templateFront: (name) => `/templates/${encodeURIComponent(name)}/正面模板.html`,
    templateBack: (name) => `/templates/${encodeURIComponent(name)}/背面模板.html`,
    templateCss: (name) => `/templates/${encodeURIComponent(name)}/样式.css`,
};

export const DEFAULTS = {
    chapterField: '章节',
    templateFront: '{{Front}}',
    templateBack: '{{FrontSide}}\n\n<hr>\n\n{{Back}}',
};

export const STORAGE = {
    cache: 'k_ck_',
    progress: 'kikkua_',
};

export const UI = {
    home: {
        features: [
            { icon: 'book', label: '精选内容', desc: '精心梳理的知识体系，直击考点' },
            { icon: 'eye', label: '先看后买', desc: '每副牌组提供约 15% 的卡片免费预览' },
            { icon: 'edit', label: '专业模板', desc: '精心设计的 Anki 模板，兼具美感与效率' },
        ],
        cta: '浏览牌组',
    },
    decks: {
        title: '牌组列表',
        desc: '浏览所有可用的学习牌组，按标签筛选。',
        allLabel: '全部',
        noResults: '没有匹配的牌组',
        noResultsHint: '换一个标签试试',
        notStudied: '尚未学习',
        cardUnit: ' 张卡片',
        deckUnit: ' 个牌组',
        preview: '预览',
        purchase: '购买完整版',
    },
    detail: {
        notFound: '牌组不存在',
        backToList: '返回列表',
        back: '返回',
        cardUnit: ' 张卡片',
        startStudy: '开始学习',
        or: '或者',
        purchase: '购买完整牌组 →',
    },
    study: {
        titleSuffix: ' · 学习',
        loading: '加载中...',
        empty: '暂无卡片',
        emptyHint: '这个牌组还没有任何卡片',
        back: '返回',
        sidebarTitle: '目录',
        prev: '上一张',
        flip: '翻转',
        next: '下一张',
        purchase: '购买完整牌组 →',
    },
    about: {
        title: '关于 kikkua',
        back: '返回首页',
        loading: '加载中...',
        notFound: '页面不存在',
        breadcrumbHome: '首页',
        tocTitle: '本页目录',
        prevPage: '上一页',
        nextPage: '下一页',
        minuteRead: '分钟阅读',
        updatedAt: '更新时间',
        tags: '标签',
    },
    time: {
        justNow: '刚刚',
        minutesAgo: ' 分钟前',
        hoursAgo: ' 小时前',
        daysAgo: ' 天前',
        monthsAgo: ' 个月前',
    },
};
