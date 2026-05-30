// kikkua · 遮挡块工具 — 入口
// 图片遮挡编辑，生成 Anki 图遮挡题 JSON 数据

import { registerPlugin } from '../shared/sdk.js';
import { bindEvents } from './modules/events.js';

registerPlugin({
    id: 'occlusion',
    name: '遮挡块工具',
    icon: '🖼',
    desc: '在图片上绘制遮挡块，生成Anki图遮挡题数据',
    version: '2.0.0'
});

bindEvents();
