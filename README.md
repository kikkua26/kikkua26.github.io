# kikkua · 知识卡片

> 精心制作的专业 Anki 牌组，先预览后购买

🌐 **线上访问**：[kikkua.online](https://kikkua.online) ｜ 📖 **牌组数量**：4 个 ｜ 🃏 **卡片总量**：~4930 张

---

## 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [数据架构](#数据架构)
- [牌组数据格式](#牌组数据格式)
- [后台管理](#后台管理)
- [专业工具](#专业工具)
- [Anki 模板系统](#anki-模板系统)
- [SEO 与站点配置](#seo-与站点配置)
- [本地开发](#本地开发)
- [部署](#部署)
- [添加新牌组](#添加新牌组)
- [当前牌组一览](#当前牌组一览)

---

## 项目简介

[kikkua](https://kikkua.online) 是一个 Anki 牌组发布与预览站点，面向中医、考研等领域的学习者。

[Anki](https://apps.ankiweb.net/) 是一款开源间隔重复记忆软件。本项目为其提供了一个完整的 Web 发布平台，让用户可以：

- **浏览** 所有牌组，了解内容结构与卡片数量
- **免费预览** 约 15% 的卡片，感受模板质量与内容深度
- **按章节导航** 通过目录树快速定位感兴趣的知识点
- **购买完整版** 满意后跳转至交易平台获取全部卡片

整站采用纯静态架构，无需后端服务器，通过 GitHub Pages 托管，零运维成本。

---

## 核心功能

### 牌组浏览与筛选

- 牌组以彩色卡片网格展示，每张卡片含标题、摘要、标签、卡片总数、上次学习时间
- 层级标签系统（`::` 分隔），支持多维度分类（如 `中医专业::中综考研::方剂`）
- 侧边栏标签树，点击即可筛选对应牌组
- 面包屑导航，清晰展示当前筛选路径

### 卡片预览 / 学习系统

- **iframe 渲染** — Anki 模板（正面/背面 HTML + CSS）在 iframe 内通过 `srcdoc` 渲染，模拟真实 Anki 体验
- **字段替换** — 模板中的 `{{FieldName}}` 占位符自动替换为 CSV 数据中的实际值
- **`{{FrontSide}}` 支持** — 背面模板可嵌入正面内容
- **目录树** — 从 CSV 数据的章节字段自动构建多级目录，支持展开/折叠与快速跳转
- **键盘快捷键** — `Space` 翻转、`←`/`→` 切换卡片、`☰` 开关侧边栏
- **进度持久化** — localStorage 自动保存当前卡片位置与章节，下次打开自动恢复
- **会话缓存** — sessionStorage + TTL 机制，减少重复请求

### 后台管理面板

访问 `/admin.html`，输入 GitHub Personal Access Token 即可在线管理全部内容。详见 [后台管理](#后台管理) 章节。

### 专业工具集

- **图片遮挡编辑器** — Canvas 绘制矩形遮挡区域，生成 Anki 图片遮挡卡片数据
- **题库表格编辑器** — 完整的电子表格界面，支持 CSV/Excel 导入导出、AI 出题

详见 [专业工具](#专业工具) 章节。

---

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| **前端框架** | 无 | 纯 Vanilla JavaScript，ES Modules 原生模块 |
| **样式** | CSS Custom Properties | 全局配色变量，桉树绿（`#0d9488`）+ 藏金色（`#f59e0b`）主题 |
| **路由** | History API | `pushState` / `popstate` 实现 SPA 无刷新切换 |
| **数据格式** | CSV + JSON | 牌组数据为 CSV，元数据/配置为 JSON |
| **Markdown** | 自研解析器 | `js/md.js`，支持标题、列表、代码块、引用、提示框（`:::info`/`:::warning`/`:::success`） |
| **托管** | GitHub Pages | 静态托管，`404.html` 实现 SPA fallback |
| **后端 API** | GitHub REST API v3 | 管理面板直接读写仓库文件 |
| **Excel 处理** | SheetJS | `xlsx.full.min.js`，题库工具的 Excel 导入导出 |
| **AI 集成** | DeepSeek API | 题库工具的 AI 自动出题功能 |
| **构建工具** | 无 | 零依赖、零配置，开箱即用 |

**核心特点：无框架、无构建工具、无 `package.json`、零依赖。** 整个项目只用浏览器原生能力。

---

## 项目结构

```
.
├── index.html                          # SPA 入口页面
├── 404.html                            # GitHub Pages SPA 回退（路由兜底）
├── admin.html                          # 后台管理面板（~1690 行，自包含单页应用）
├── CNAME                               # 自定义域名 → kikkua.online
├── robots.txt                          # 搜索引擎爬虫配置
├── sitemap.xml                         # SEO 站点地图
├── googlee531e6354d71f4f5.html         # Google Search Console 验证文件
│
├── js/                                 # 前端 JavaScript（ES Modules）
│   ├── app.js                          # 应用入口：初始化 storage → seo → router
│   ├── config.js                       # 全局配置：站点信息、路由、数据路径、UI 文案、默认值
│   ├── router.js                       # 路由器：History API 路由分发到各视图
│   ├── navigation.js                   # 链接拦截 + pushState 导航
│   ├── seo.js                          # 动态 meta 标签 + JSON-LD 结构化数据注入
│   ├── storage.js                      # localStorage 进度存储 + sessionStorage 缓存（带 TTL）
│   ├── data-loader.js                  # DataLoader 类：CSV 解析、模板加载、牌组发现
│   ├── card.js                         # 模板字段替换 + iframe srcdoc 渲染
│   ├── md.js                           # 轻量 Markdown → HTML 转换器
│   ├── utils.js                        # 工具函数：$、$$、esc、formatTimeAgo
│   └── views/
│       ├── home.js                     # 首页：Hero 区 + 功能介绍 + CTA
│       ├── decks.js                    # 牌组列表：卡片网格 + 标签筛选（面包屑 + 药丸选择器）
│       ├── detail.js                   # 牌组详情：Markdown 描述 + 开始学习 + 购买入口
│       ├── study.js                    # 学习页：侧边目录树 + iframe 卡片 + 键盘导航
│       ├── about.js                    # 文档页：左侧导航 + 目录 + 滚动监听
│       └── tools.js                    # 工具宿主页：Tab 切换 + iframe 嵌入工具
│
├── src/assets/css/
│   ├── variables.css                   # CSS 自定义属性（配色、间距、阴影、圆角）
│   ├── reset.css                       # 浏览器默认样式重置
│   ├── base.css                        # 全局基础样式、布局、动画
│   └── components.css                  # 全部组件样式（~2040 行）：头部、卡片、学习页、文档页、工具页
│
├── data/
│   ├── index.json                      # 牌组注册表（所有牌组的元数据）
│   ├── tags.json                       # 层级标签树注册表
│   ├── pages.json                      # CMS 页面注册（关于、教程、牌组介绍等）
│   ├── media/                          # 上传的媒体文件（教程图片、牌组封面等）
│   ├── 方剂学牌组/data.csv              # 278 张卡片 — 方剂学
│   ├── 中药学/data.csv                  # 390 张卡片 — 中药学
│   ├── 中医经典三级大纲牌组/data.csv     # 762 张卡片 — 中医经典三级大纲
│   └── 中医经典等级考试题库/data.csv     # 3500 张卡片 — 中医经典题库
│
├── templates/
│   ├── kikkua高级模板/                  # 「高级模板」— 用于知识/填空类牌组（3 个牌组使用）
│   │   ├── 正面模板.html                # 正面模板：填空、术语解释、设置面板
│   │   ├── 背面模板.html                # 背面模板
│   │   └── 样式.css                    # 模板 CSS：多主题支持
│   └── kikkua pro模板/                 # 「Pro 模板」— 用于题库/选择题类牌组（1 个牌组使用）
│       ├── 正面模板.html                # 正面模板：选择题、计时器、统计面板
│       ├── 背面模板.html                # 背面模板
│       └── 样式.css                    # 模板 CSS
│
├── tools/
│   ├── occlusion/                      # 图片遮挡编辑器
│   │   ├── index.html
│   │   ├── main.js                     # Canvas 矩形绘制、JSON 导出
│   │   └── style.css
│   └── question-bank/                  # 题库表格编辑器
│       ├── index.html
│       ├── main.js                     # 电子表格：增删改查、导入导出、AI 出题
│       ├── style.css
│       └── lib/xlsx.full.min.js        # SheetJS（Excel 处理库）
│
└── js/admin/
    ├── card-maker.js                   # 卡片制作器 v1
    ├── card-maker-v2.js                # 卡片制作器 v2
    ├── cm-640689.js                    # 卡片制作器模块变体
    └── cm-798887.js                    # 卡片制作器模块（admin.html 懒加载）
```

### 核心模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **配置中心** | `config.js` | 所有硬编码字符串、路径、默认值的唯一来源 |
| **路由器** | `router.js` | 基于 `pushState`/`popstate` 的无刷新页面切换 |
| **导航控制** | `navigation.js` | 拦截 `<a>` 标签点击，统一走 History API |
| **SEO 管理** | `seo.js` | 根据当前路由动态更新 meta 标签、Open Graph、JSON-LD |
| **数据加载** | `data-loader.js` | CSV 解析、模板加载、牌组发现，支持预加载与缓存 |
| **卡片渲染** | `card.js` | 字段替换 → 模板 CSS 注入 → iframe `srcdoc` 渲染 |
| **存储管理** | `storage.js` | localStorage 进度持久化 + sessionStorage 缓存（自动过期） |
| **Markdown** | `md.js` | 轻量级 Markdown 转 HTML，支持提示框等扩展语法 |
| **工具函数** | `utils.js` | DOM 选择器（`$`/`$$`）、HTML 转义、时间格式化 |

---

## 数据架构

### 数据流

```
┌─────────────────┐
│ data/index.json  │  ← 牌组注册表（元数据）
└────────┬────────┘
         ▼
┌─────────────────────────────┐
│ data/<牌组名>/data.csv       │  ← 卡片数据（CSV 格式）
└────────┬────────────────────┘
         ▼
┌─────────────────────────────────────┐
│ templates/<模板名>/                  │
│   ├── 正面模板.html                  │  ← Anki 模板（含 {{字段名}} 占位符）
│   ├── 背面模板.html                  │
│   └── 样式.css                      │
└────────┬────────────────────────────┘
         ▼
┌─────────────────────────────┐
│ js/data-loader.js            │  ← CSV 解析 + 模板加载
└────────┬────────────────────┘
         ▼
┌─────────────────────────────┐
│ js/card.js                   │  ← {{字段名}} → 实际内容 → iframe srcdoc
└─────────────────────────────┘
```

### 辅助数据文件

| 文件 | 用途 |
|------|------|
| `data/tags.json` | 层级标签树，用于牌组分类与筛选 |
| `data/pages.json` | CMS 页面注册，存储关于页、教程等 Markdown 内容 |
| `data/media/` | 媒体文件目录，存放教程图片、牌组封面等 |

### 缓存策略

| 存储层 | 机制 | 用途 |
|--------|------|------|
| **sessionStorage** | 带 TTL 的键值缓存 | 牌组数据、模板内容（减少重复请求） |
| **localStorage** | 持久化键值对 | 学习进度（当前卡片索引、章节位置） |

---

## 牌组数据格式

### `data/index.json` — 牌组注册表

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
|------|:----:|------|
| `name` | ✅ | 牌组名称，同时也是 `data/<name>/` 目录名 |
| `summary` | | 牌组列表中显示的简短介绍 |
| `totalCards` | | 卡片总数（用于列表展示） |
| `tags` | | 标签数组，使用 `::` 表示层级关系 |
| `template` | | 使用的模板目录名，对应 `templates/<name>/` |
| `chapterField` | | CSV 中用于构建目录树的字段名，默认 `"章节"` |
| `detail` | | 详情页的 Markdown 介绍文案，支持完整 Markdown 语法 |
| `purchaseUrl` | | 购买链接，为空则不显示购买按钮 |

### CSV 数据文件

路径：`data/<牌组名>/data.csv`

```csv
章节,正面,背面
第一章::第一节,心脉的生理功能,心主血脉是指心气推动血液在脉中运行
第一章::第二节,肺主气功能,肺主气包括主呼吸之气和主一身之气
第二章::第一节,脾胃运化,脾主运化水谷精微
```

**格式规则：**
- 首行为字段名（对应模板中的 `{{字段名}}` 占位符）
- 支持逗号分隔或 Tab 分隔
- 支持引号包裹的多行字段
- `chapterField` 指定的列用于构建学习页的目录树（`::` 分隔层级）
- 支持 `{{FrontSide}}` 在背面模板中嵌入正面内容

### `data/tags.json` — 标签注册表

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
          { "path": "中医专业::中综考研::方剂", "desc": "方剂学" },
          { "path": "中医专业::中综考研::中药", "desc": "中药学" }
        ]
      },
      {
        "path": "中医专业::中医经典",
        "desc": "中医经典等级考试",
        "children": [
          { "path": "中医专业::中医经典::中医经典考试::三级", "desc": "三级大纲" },
          { "path": "中医专业::中医经典::题库", "desc": "经典题库" }
        ]
      }
    ]
  }
]
```

### `data/pages.json` — CMS 页面

用于存储关于页、教程等 Markdown 内容页面，支持分组、排序与图标配置。

---

## 后台管理

访问 `/admin.html`，输入 GitHub Personal Access Token 即可使用。所有修改通过 GitHub API 直接写回仓库。

### 功能模块

| 模块 | 功能 |
|------|------|
| **仪表盘** | 统计概览：牌组数量、模板数量、卡片总数 |
| **牌组管理** | CRUD 牌组元数据：名称、模板、标签、章节字段、摘要、详情 Markdown、购买链接 |
| **模板管理** | 在线编辑正面模板、背面模板、样式 CSS，实时保存到仓库 |
| **标签管理** | 可视化树形编辑器：添加、重命名、删除标签节点 |
| **页面管理** | CMS 内容编辑：Markdown 编辑 + 实时预览 + `.md` 文件导入 |
| **媒体管理** | 文件上传、重命名、替换、删除；面包屑导航；重命名时自动更新页面引用 |
| **卡片制作器** | 笔记式编辑器：章节树、知识字段、扩展字段、iframe 实时预览、CSV 导入导出、DeepSeek AI 集成 |

### 技术实现

- 通过 GitHub REST API v3 的 Contents API 读写文件
- 使用 SHA 追踪文件版本，避免冲突覆盖
- 管理面板为完全自包含的单页应用（~1690 行），无需额外依赖

---

## 专业工具

工具通过 `/tools` 路由以 iframe 方式嵌入访问。

### 图片遮挡编辑器 (`/tools/occlusion/`)

Canvas 实现的图片遮挡区域绘制工具：

- 在图片上绘制矩形遮挡区域
- 支持拖拽移动、颜色选择、透明度调节
- 支持粘贴图片、触摸事件（移动端适配）
- 导出 JSON 数据，用于生成 Anki 图片遮挡卡片

### 题库表格编辑器 (`/tools/question-bank/`)

功能完整的电子表格界面：

- **基础操作** — 添加、编辑、删除行；右键菜单；批量操作
- **列配置** — 可配置选项列数量（A-G）
- **列宽调整** — 拖拽调整列宽
- **导入导出** — 支持 CSV 和 Excel（`.xlsx`）格式
- **行内编辑表单** — 弹窗式行编辑
- **AI 出题** — 集成 DeepSeek API，支持：
  - 可配置 API Key、模型
  - 多种生成模式与解析风格
  - 自动生成选择题并填入表格

---

## Anki 模板系统

### kikkua 高级模板

适用于知识记忆 / 填空类牌组（3 个牌组使用）：

| 功能 | 说明 |
|------|------|
| 填空遮挡 | `[[...]]` 语法自动生成填空区域 |
| 术语解释 | `【*术语::解释*】` 语法自动渲染术语卡片 |
| 多主题切换 | 蓝色、粉色、薄荷、暗色、护眼、跟随系统（6 种主题） |
| 字号控制 | 用户可调节卡片字号 |
| 设置面板 | 通过齿轮图标打开，设置保存在 localStorage |
| 授权码生成 | 内置授权码生成逻辑 |

### kikkua Pro 模板

适用于题库 / 选择题类牌组（1 个牌组使用）：

| 功能 | 说明 |
|------|------|
| 选择题支持 | 单选、多选、填空、简答、图片遮挡、完形填空 |
| 计时器 | 答题倒计时进度条 |
| 会话统计 | 答题正确率、用时统计 |
| 设置面板 | 用户偏好配置 |

---

## SEO 与站点配置

| 配置项 | 文件 | 说明 |
|--------|------|------|
| 自定义域名 | `CNAME` | `kikkua.online` |
| 搜索引擎验证 | `googlee531e6354d71f4f5.html` | Google Search Console |
| 爬虫配置 | `robots.txt` | 允许所有爬虫，指向 sitemap |
| 站点地图 | `sitemap.xml` | 4 个主要页面 |
| 动态 meta | `js/seo.js` | Open Graph + Twitter Card，随路由变化更新 |
| 结构化数据 | `js/seo.js` | JSON-LD（WebSite schema + SearchAction） |
| Bing 验证 | `index.html` `<meta>` | Bing Webmaster Tools |
| 搜狗验证 | `index.html` `<meta>` | 搜狗站长平台 |

---

## 本地开发

纯静态项目，无需安装依赖，无需构建步骤。

```bash
# 方式一：Python
python -m http.server 3000

# 方式二：Node.js
npx serve .

# 方式三：VS Code
# 安装 Live Server 扩展，右键 index.html → Open with Live Server

# 然后访问
open http://localhost:3000
```

### 开发注意事项

- 所有配置集中在 `js/config.js`，修改文案、路径、默认值只需改这一个文件
- 样式变量在 `src/assets/css/variables.css`，换肤只需修改 CSS 自定义属性
- 牌组数据为 CSV 文件，可用 Excel 或文本编辑器直接编辑
- 模板中的 `{{字段名}}` 必须与 CSV 首行的字段名完全匹配

---

## 部署

项目托管在 **GitHub Pages**，从 `main` 分支根目录自动部署。

### 部署步骤

1. 推送 `main` 分支到 GitHub
2. 仓库 Settings → Pages → 选择 `main` 分支，`/` 根目录
3. 自定义域名通过 `CNAME` 文件自动配置（`kikkua.online`）

### SPA 路由兜底

`404.html` 与 `index.html` 内容一致（带 `<base href="/">`），GitHub Pages 对未匹配路径返回 `404.html`，从而实现 SPA 客户端路由。

### 文件大小限制

> GitHub Pages 有约 1MB 的文件大小限制。大于 1MB 的 CSV 文件通过 GitHub API 的 `download_url` 以 raw HTTP 方式直接获取。

---

## 添加新牌组

### 步骤

1. **创建数据文件** — 在 `data/` 下创建 `<牌组名>/data.csv`，首行为字段名
2. **注册牌组** — 在 `data/index.json` 中添加牌组条目
3. **选择模板** — 指定 `template` 字段使用已有模板，或在 `templates/` 下创建新模板
4. **配置标签**（可选）— 在 `data/tags.json` 中添加标签节点
5. **编写详情**（可选）— 在 `detail` 字段中使用 Markdown 编写牌组介绍

### 或者使用管理面板

访问 `/admin.html`，通过可视化界面完成以上所有操作，无需手动编辑文件。

---

## 当前牌组一览

| 牌组 | 卡片数 | 模板 | 标签 |
|------|:------:|------|------|
| **方剂学牌组** | 278 | kikkua高级模板 | `中医专业::中综考研::方剂` |
| **中药学** | 390 | kikkua高级模板 | `中医专业::中综考研::中药` |
| **中医经典三级大纲牌组** | 762 | kikkua高级模板 | `中医专业::中医经典::中医经典考试::三级` |
| **中医经典等级考试题库** | 3500 | kikkua pro模板 | `中医专业::中医经典::题库` |

**总计：约 4,930 张卡片**

---

## 许可证

本项目为个人作品，牌组内容版权归 [kikkua](https://kikkua.online) 所有。
