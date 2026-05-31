// kikkua · admin — Card Maker lazy loader

let _inited = false;
export async function initCardMaker() {
    if (_inited) return;
    const root = document.getElementById('cardMakerRoot');
    if (!root) return;
    const { initCardMaker } = await import('../../js/admin/cm-798887.js');
    initCardMaker(root);
    _inited = true;
}
