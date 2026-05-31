// kikkua · admin — 统一事件绑定

import { connect, disconnect } from './auth.js';
import { switchSection, openSidebar, closeSidebar } from './ui.js';
import { decks, renderDeckList, showDeckList, selectDeck, saveDecks, delDeck, addDeck, previewCsv, downloadCsv, uploadCsv, removeDeckTag } from './decks.js';
import { renderTplGrid, selectTpl, switchTplFile, saveTplFile, createTpl } from './templates.js';
import { renderTagTree, saveTags, addRootTag, renameTagDesc, renameTag, addSubTag, delTagNode, openTagSelector, closeTagSelector, confirmTagSelector, tagToggle } from './tags.js';
import { renderPageList, showPageList, selectPage, savePages, addPage, importMdFile, previewMd, delPage, currentPageIdx } from './pages.js';
import { loadMedia, navigateMedia, createMediaFolder, uploadMediaFile, showMediaMenu, closeMediaMenu, copyMediaUrl, promptRenameMedia, replaceMediaFile, delMediaItem } from './media.js';

const $ = s => document.querySelector(s);

export function bindAllEvents() {
    // ── Auth ──
    $('#connectBtn').addEventListener('click', connect);
    $('#disconnectBtn').addEventListener('click', disconnect);
    $('#tokenInput').addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });

    // ── Sidebar ──
    $('#menuBtn').addEventListener('click', openSidebar);
    $('#sidebarOverlay').addEventListener('click', closeSidebar);

    // ── Nav ──
    document.querySelectorAll('.nav-item').forEach(n => {
        n.addEventListener('click', () => switchSection(n.dataset.section));
    });

    // Register section loaders
    switchSection._handlers = {
        decks: () => { renderDeckList(); if (window.innerWidth <= 767) { document.getElementById('deckListView').classList.add('mob-show'); document.getElementById('deckDetailView').classList.remove('mob-show'); } },
        templates: renderTplGrid,
        tags: () => renderTagTree(true),
        pages: () => { renderPageList(); if (window.innerWidth <= 767) { document.getElementById('pageListView').classList.add('mob-show'); document.getElementById('pageDetailView').classList.remove('mob-show'); } },
        media: loadMedia,
        cardmaker: async () => { const { initCardMaker } = await import('../modules/cardmaker-loader.js'); initCardMaker(); },
    };

    // ── Save buttons ──
    $('#saveBtn').addEventListener('click', () => saveDecks());
    $('#saveTagsBtn').addEventListener('click', saveTags);
    $('#savePagesBtn').addEventListener('click', savePages);

    // ── Add buttons ──
    $('#addDeckBtn').addEventListener('click', addDeck);
    $('#addPageBtn').addEventListener('click', addPage);

    // ── Template save ──
    $('#tplSaveBtn').addEventListener('click', saveTplFile);

    // ── CSV preview close ──
    $('#csvPreviewOverlay').addEventListener('click', e => { if (e.target.id === 'csvPreviewOverlay') $('#csvPreviewOverlay').classList.remove('show'); });

    // ── Tag selector close ──
    $('#tagSelectorOverlay').addEventListener('click', e => { if (e.target.id === 'tagSelectorOverlay') closeTagSelector(); });

    // ── Media context menu close ──
    document.addEventListener('click', e => {
        if (!e.target.closest('.media-context-menu') && !e.target.closest('.media-card')) closeMediaMenu();
    });

    // ── Event delegation for dynamic content ──
    document.addEventListener('click', e => {
        const target = e.target;

        // Deck list items
        const deckItem = target.closest('.deck-list-item[data-idx]');
        if (deckItem) { selectDeck(parseInt(deckItem.dataset.idx)); return; }

        // Page list items
        const pageItem = target.closest('.pages-list-item[data-page-idx]');
        if (pageItem) { selectPage(parseInt(pageItem.dataset.pageIdx)); return; }

        // Template cards
        const tplCard = target.closest('.tpl-card[data-tpl]');
        if (tplCard) { selectTpl(tplCard.dataset.tpl); return; }
        const tplCreate = target.closest('[data-action="create-tpl"]');
        if (tplCreate) { createTpl(); return; }

        // Template file tabs
        const tplTab = target.closest('.file-tab[data-tpl-file]');
        if (tplTab) { switchTplFile(tplTab.dataset.tplFile, tplTab.dataset.tplFilename, tplTab); return; }

        // Deck edit actions
        const action = target.closest('[data-action]');
        if (action) {
            const act = action.dataset.action;
            if (act === 'save-decks') saveDecks();
            else if (act === 'del-deck' && decks[currentDeckIdx]) delDeck(currentDeckIdx);
            else if (act === 'save-pages') savePages();
            else if (act === 'del-page') delPage(currentPageIdx);
            else if (act === 'import-md') importMdFile();
            else if (act === 'preview-md') previewMd();
            else if (act === 'show-deck-list') showDeckList();
            else if (act === 'show-page-list') showPageList();
            else if (act === 'add-root-tag') addRootTag();
            else if (act === 'create-media-folder') createMediaFolder();
            else if (act === 'upload-media') uploadMediaFile();
            else if (act === 'close-csv-preview') $('#csvPreviewOverlay').classList.remove('show');
            else if (act === 'close-tag-selector') closeTagSelector();
            else if (act === 'confirm-tag-selector') confirmTagSelector();
            else if (act === 'cm-quick-paste') { const { initCardMaker } = await import('./cardmaker-loader.js'); if (window._cmQuickPaste) window._cmQuickPaste(); }
            return;
        }

        // CSV actions
        const csvAction = target.closest('[data-csv-action]');
        if (csvAction) {
            const act = csvAction.dataset.csvAction;
            const deck = csvAction.dataset.deck;
            if (act === 'preview') previewCsv(deck);
            else if (act === 'download') downloadCsv(deck);
            else if (act === 'upload') uploadCsv(deck);
            return;
        }

        // Tag actions
        const tagDesc = target.closest('[data-tag-desc]');
        if (tagDesc) return; // handled by change event
        const tagRename = target.closest('[data-tag-rename]');
        if (tagRename) { renameTag(tagRename.dataset.tagRename); return; }
        const tagAddsub = target.closest('[data-tag-addsub]');
        if (tagAddsub) { addSubTag(tagAddsub.dataset.tagAddsub); return; }
        const tagDel = target.closest('[data-tag-del]');
        if (tagDel) { delTagNode(tagDel.dataset.tagDel); return; }

        // Deck tag actions
        const removeTag = target.closest('[data-remove-tag]');
        if (removeTag && decks[currentDeckIdx]) { removeDeckTag(currentDeckIdx, removeTag.dataset.removeTag); return; }
        const addTag = target.closest('[data-add-tag]');
        if (addTag) { openTagSelector(currentDeckIdx); return; }

        // Media navigation
        const mediaNav = target.closest('[data-media-nav]');
        if (mediaNav) { navigateMedia(mediaNav.dataset.mediaNav); return; }

        // Media context menu actions
        const mediaAction = target.closest('[data-media-action]');
        if (mediaAction) {
            const act = mediaAction.dataset.mediaAction;
            const name = mediaAction.dataset.name;
            const isDir = mediaAction.dataset.isdir === '1';
            if (act === 'copy') { copyMediaUrl(name); closeMediaMenu(); }
            else if (act === 'replace') { replaceMediaFile(name); closeMediaMenu(); }
            else if (act === 'rename') { promptRenameMedia(name, isDir); closeMediaMenu(); }
            else if (act === 'delete') { delMediaItem(name, isDir); closeMediaMenu(); }
            return;
        }

        // Dashboard actions
        if (target.closest('[data-dashboard-action]')) {
            const act = target.closest('[data-dashboard-action]').dataset.dashboardAction;
            switchSection(act);
            return;
        }
    });

    // Event delegation for context menu
    document.addEventListener('contextmenu', e => {
        const mediaCard = e.target.closest('.media-card[data-media-ctx]');
        if (mediaCard) {
            e.preventDefault();
            showMediaMenu(e, mediaCard.dataset.mediaCtx, mediaCard.dataset.mediaIsdir === '1');
        }
    });

    // Tag description change
    document.addEventListener('change', e => {
        const tagDesc = e.target.closest('[data-tag-desc]');
        if (tagDesc) { renameTagDesc(tagDesc.dataset.tagDesc, tagDesc.value); }

        const tagToggleEl = e.target.closest('[data-tag-toggle]');
        if (tagToggleEl) {
            tagToggle(tagToggleEl.dataset.tagToggle, tagToggleEl.checked);
        }
    });
}
