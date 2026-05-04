# kikkua · 知识卡片

精选 Anki 牌组预览选购平台。浏览专业编者打造的牌组，预览卡片内容后购买完整版本。

## 功能

- **牌组列表** — 展示所有牌组，支持按层级标签筛选
- **牌组详情** — Markdown 介绍、标签展示、开始学习/购买入口
- **卡片预览** — iframe 内渲染 Anki 模板，支持章节目录导航
- **键盘快捷键** — `Space` 翻转，`←/↑` 上一张，`→/↓` 下一张
- **进度记忆** — localStorage 保存学习进度，自动恢复
- **购买链接** — 每个牌组可配置外部购买链接
- **后台管理** — GitHub API 在线编辑牌组、模板、数据文件

## 技术栈

- 纯 Vanilla JS ES Modules，无框架依赖
- CSS 自定义属性配色系统，支持一键换肤
- 数据存储于 CSV + JSON 配置文件
- Anki 模板在 iframe 内通过 `srcdoc` 渲染

## 项目结构

```
.
├── index.html              # 入口页面（含预渲染首页）
├── 404.html                # SPA 回退页面
├── admin.html              # 后台管理面板
├── CNAME                   # 自定义域名 kikkua.online
├── robots.txt              # SEO
├── sitemap.xml             # SEO
│
├── js/
│   ├── app.js              # 入口
│   ├── config.js           # 全局配置（文案、路径、默认值）
│   ├── router.js           # 路由分发
│   ├── navigation.js       # 链接拦截 + pushState
│   ├── seo.js              # meta 标签 + JSON-LD
│   ├── storage.js          # sessionCache + localStorage
│   ├── data-loader.js      # DataLoader（CSV 解析、模板加载）
│   ├── card.js             # Anki 卡片渲染（iframe srcdoc）
│   ├── md.js               # Markdown → HTML
│   ├── utils.js            # $、$$、esc、formatTimeAgo
│   └── views/
│       ├── home.js         # 首页
│       ├── decks.js        # 牌组列表 + 标签筛选
│       ├── detail.js       # 牌组详情
│       └── study.js        # 学习页（目录树 + 卡片导航）
│
├── src/assets/css/
│   ├── variables.css       # 配色变量
│   ├── reset.css           # 全局重置
│   ├── base.css            # 基础布局 + 背景纹理
│   └── components.css      # 组件样式
│
├── data/
│   └── index.json          # 牌组元数据
│
└── templates/
    └── <模板名>/
        ├── 正面模板.html
        ├── 背面模板.html
        └── 样式.css
```

## 牌组数据格式

`data/index.json`:

```json
[
  {
    "name": "方剂学牌组",
    "summary": "精选279首古今名方...",
    "totalCards": 278,
    "tags": ["中医学::中综考研::方剂"],
    "template": "kikkua高级模板",
    "chapterField": "章节",
    "detail": "Markdown 介绍...",
    "purchaseUrl": "https://..."
  }
]
```

| 字段 | 说明 |
|------|------|
| `name` | 牌组名称 |
| `summary` | 卡片列表中显示的简短介绍 |
| `totalCards` | 卡片总数 |
| `tags` | 层级标签数组（`::` 分隔） |
| `template` | 使用的模板目录名 |
| `chapterField` | CSV 中用于分章的字段名 |
| `detail` | 详情页 Markdown 介绍 |
| `purchaseUrl` | 购买链接（留空则不显示） |

## 后台管理

访问 `/admin.html`，输入 GitHub Personal Access Token 后可在线上编辑牌组信息和模板文件。

## 本地开发

```bash
python -m http.server 3000
```

浏览器打开 `http://localhost:3000` 即可预览。
