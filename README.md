# kikkua · 知识卡片

精选 Anki 牌组**预览选购平台**。专业编者打造的知识卡片，先预览后购买，高效备考。

> 🌐 线上访问：[kikkua.online](https://kikkua.online)

---

## 这是什么？

很多人在 [Anki](https://apps.ankiweb.net/)（一个开源的记忆卡片软件）上学习，但找到好牌组不容易。这个平台解决两个问题：

- **编者** — 发布牌组、提供部分免费预览，引导用户购买完整版
- **学习者** — 浏览牌组目录，在线预览约 15% 的卡片内容，满意后再购买

## 快速上手

### 作为学习者

1. 打开首页，浏览牌组列表
2. 点进一个牌组查看详细介绍
3. 点击 **「开始学习」** 免费预览部分卡片
4. 侧边栏 **目录树** 可按章节快速跳转
5. 满意后点击 **「购买完整牌组」** 跳转至交易平台

### 学习快捷键

| 按键 | 功能 |
|------|------|
| `Space` | 翻转卡片（看正面 → 看背面） |
| `←` / `↑` | 上一张 |
| `→` / `↓` | 下一张 |
| `☰`（左上角） | 打开/关闭目录侧边栏 |

学习进度会自动保存在浏览器中，下次打开时继续。

---

## 功能详解

### 🏠 首页
品牌展示 + 功能介绍 + 卡片式牌组预览入口。首页内容通过 `js/config.js` 中的 `UI.home` 配置，无需修改 HTML。

### 📚 牌组列表
所有牌组以卡片网格展示，每张卡片包含：
- 标题与图标（根据牌组名称自动分配颜色主题）
- 摘要描述
- 层级标签
- 卡片总数
- 上次学习时间

支持 **按标签筛选** — 侧边栏展开标签树，点击任意标签筛选对应牌组。

### 📄 牌组详情
- Markdown 渲染的介绍文案
- 标签展示
- **开始学习**（进入预览模式）与 **购买** 入口

### 🎴 学习页
核心功能，围绕 Anki 卡片预览：

- **iframe 渲染** — Anki 模板（正面/背面 HTML + CSS）在 iframe 内渲染，模拟真实 Anki 体验
- **目录树** — 从 CSV 数据的章节字段自动构建层级结构，支持多级展开/折叠，点击跳转
- **进度记忆** — 自动保存当前卡片位置，下次打开恢复

### 🏷️ 标签系统
标签采用 `::` 分隔的层级结构，存储在 `data/tags.json` 中：

```
中医专业
├── 中综考研
│   ├── 方剂
│   └── 中药
└── 中医经典
    ├── 中医经典考试
    │   └── 三级
    └── 题库
```

- 每个牌组可关联多个标签
- 牌组列表页可按标签树筛选
- 后台管理面板提供可视化标签编辑

### 🔧 后台管理
访问 `/admin.html`，输入 GitHub Personal Access Token 后可在线上编辑：

- **牌组管理** — 增删改牌组元数据（名称、描述、标签、模板关联等）
- **模板管理** — 在线编辑正面模板、背面模板、样式 CSS
- **标签管理** — 树形可视化编辑标签注册表
- **CSV 上传** — 上传牌组数据文件

所有修改通过 GitHub API 直接写回仓库。

---

## 数据架构

### 数据流

```
data/index.json (牌组元数据)
       │
       ▼
data/<牌组名>/data.csv (卡片数据)
       │
       ▼
templates/<模板名>/ (正面模板.html + 背面模板.html + 样式.css)
       │
       ▼
  js/data-loader.js (CSV 解析 + 模板加载)
       │
       ▼
  js/card.js (替换 {{字段名}} → 实际内容 → iframe srcdoc 渲染)
```

### 文件结构

```
.
├── index.html              # 入口页面（SPA 壳）
├── 404.html                # GitHub Pages SPA 回退
├── admin.html              # 后台管理面板（单页应用）
├── CNAME                   # 自定义域名 → kikkua.online
├── robots.txt              # 搜索引擎配置
├── sitemap.xml             # SEO 站点地图
│
├── js/                     # 前端 JavaScript（ES Modules）
│   ├── app.js              # 应用入口
│   ├── config.js           # 全局配置（文案、路径、默认值）
│   ├── router.js           # 基于 History API 的路由分发
│   ├── navigation.js       # 链接拦截 + pushState
│   ├── seo.js              # meta 标签 + JSON-LD 结构化数据
│   ├── storage.js          # 浏览器存储（sessionCache + localStorage）
│   ├── data-loader.js      # DataLoader 类：CSV 解析、模板加载、牌组发现
│   ├── card.js             # Anki 卡片渲染（ifame srcdoc）
│   ├── md.js               # 轻量 Markdown → HTML 转换
│   ├── utils.js            # 工具函数（$、$$、esc、formatTimeAgo）
│   └── views/
│       ├── home.js         # 首页视图
│       ├── decks.js        # 牌组列表 + 标签筛选
│       ├── detail.js       # 牌组详情视图
│       └── study.js        # 学习视图（目录树 + 卡片导航 + 进度）
│
├── src/assets/css/
│   ├── variables.css       # CSS 自定义属性（配色、间距、阴影）
│   ├── reset.css           # 浏览器默认样式重置
│   ├── base.css            # 全局基础样式
│   └── components.css      # 组件样式（卡片、按钮、侧边栏等）
│
├── data/
│   ├── index.json          # 牌组注册表（所有牌组的元数据）
│   └── tags.json           # 标签层级树注册表
│
├── data/<牌组名>/
│   └── data.csv            # 牌组卡片数据（CSV 格式）
│
└── templates/
    └── <模板名>/
        ├── 正面模板.html    # Anki 正面模板（含 {{字段名}} 占位）
        ├── 背面模板.html    # Anki 背面模板（含 {{FrontSide}} 占位）
        └── 样式.css         # 模板专用样式
```

### 核心模块说明

| 模块 | 职责 |
|------|------|
| `config.js` | 所有硬编码字符串、路径、默认值的唯一来源 |
| `data-loader.js` | 异步加载数据（CSV + 模板 + 牌组索引），支持预加载 |
| `card.js` | 字段替换 + 模板 CSS 注入 + iframe srcdoc 渲染 |
| `router.js` | 基于 pushState/popstate 的无刷新页面切换 |
| `storage.js` | localStorage 进度存储 + sessionStorage 缓存（自动过期） |

---

## 牌组数据格式

### `data/index.json` — 牌组注册表

每个牌组一个条目：

```json
{
  "name": "方剂学牌组",
  "summary": "精选279首古今名方，涵盖解表、泻下、和解、清热等各类方剂",
  "totalCards": 278,
  "tags": ["中医专业::中综考研::方剂"],
  "template": "kikkua高级模板",
  "chapterField": "章节",
  "detail": "Markdown 格式的详细介绍...",
  "purchaseUrl": "https://file.ankichinas.cn/card/..."
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 牌组名称，也是 `data/<name>/` 目录名 |
| `summary` | | 卡片列表中显示的简短介绍 |
| `totalCards` | | 卡片总数（用于列表展示） |
| `tags` | | 标签数组，用 `::` 表示层级 |
| `template` | | 使用的模板目录名（`templates/<name>/`） |
| `chapterField` | | CSV 中用于构建目录树的字段名，默认 `"章节"` |
| `detail` | | 详情页的 Markdown 介绍文案 |
| `purchaseUrl` | | 购买链接（为空则不显示购买按钮） |

### CSV 数据文件

`data/<牌组名>/data.csv`，首行为字段名，支持逗号分隔或 Tab 分隔，支持引号包裹的多行字段：

```csv
章节,正面,背面
第一章::第一节,心脉的生理功能,心主血脉是指心气推动血液在脉中运行
第一章::第二节,肺主气功能,肺主气包括主呼吸之气和主一身之气
第二章::第一节,脾胃运化,脾主运化水谷精微
```

- `chapterField` 指定的列用于构建学习页的目录树
- 模板中的 `{{字段名}}` 会被替换为对应单元格的值
- 支持 `{{FrontSide}}` 在背面模板嵌入正面内容

### `data/tags.json` — 标签注册表

层级树结构：

```json
[
  {
    "path": "中医专业",
    "desc": "中医学相关牌组",
    "children": [
      {
        "path": "中医专业::中综考研",
        "desc": "中医综合考研",
        "children": [
          { "path": "中医专业::中综考研::方剂", "desc": "方剂学" }
        ]
      }
    ]
  }
]
```

---

## 本地开发

因为项目是纯静态页面（HTML + CSS + JS），不需要构建工具：

```bash
# 用任意 HTTP 服务器启动（Python、Node、VS Code Live Server 均可）
python -m http.server 3000

# 或使用 Node
npx serve .

# 然后打开
open http://localhost:3000
```

### 技术栈

- **纯 Vanilla JS** — ES Modules 原生模块，无框架、无构建工具
- **CSS 自定义属性** — 全局配色变量，一键换肤
- **GitHub API** — 后台管理通过 GitHub REST API v3 直接读写仓库文件
- **GitHub Pages** — 静态托管 + SPA fallback 通过 404.html 实现

### 添加新牌组

1. 在 `data/` 下创建 `<牌组名>/data.csv`
2. 在 `data/index.json` 中添加条目
3. （可选）在 `templates/` 下创建模板目录
4. （可选）在 `data/tags.json` 中添加标签

---

## 部署

项目托管在 **GitHub Pages**（`gh-pages` 分支或 `main` 根目录）：

1. 推送 `main` 分支到 GitHub
2. 仓库 Settings → Pages → 选择 `main` 分支 `/` 根目录
3. 自定义域名通过 `CNAME` 文件配置

> 注意：GitHub Pages 有约 1MB 的文件大小限制。大于 1MB 的 CSV 文件通过 GitHub API 的 `download_url` 直接以 raw HTTP 方式获取。
