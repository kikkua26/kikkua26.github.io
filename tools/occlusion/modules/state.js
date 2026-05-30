// kikkua · 遮挡块工具 — 状态管理

export const COLORS = ['#FF6B6B','#FFD166','#06D6A0','#118AB2','#073B4C','#EF476F','#FF9F1C','#1A936F'];

export const state = {
    image: null, imageRect: null, naturalSize: null,
    rectangles: [], currentColor: '#FF6B6B', opacity: 0.5,
    isDrawing: false, isDragging: false, startX: 0, startY: 0, currentBlock: null,
    isMoving: false, moveStarted: false, movingBlock: null, moveOffX: 0, moveOffY: 0, moveStartX: 0, moveStartY: 0,
    containerRect: null, imageOffset: { x: 0, y: 0 },
    isPanning: false, panLastMidX: 0, panLastMidY: 0,
    pointerDownTime: 0,
};

export const pointers = new Map();
