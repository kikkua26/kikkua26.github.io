// kikkua · admin — Card Maker lazy loader

let _inited = false;
export async function initCardMaker() {
    if (_inited) return;
    const root = document.getElementById('cardMakerRoot');
    if (!root) return;
    const { initCardMaker } = await import('../../js/admin/card-maker/main.js');
    initCardMaker(root);
    _inited = true;
}
