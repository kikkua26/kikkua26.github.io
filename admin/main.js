// kikkua · admin — 入口

import { bindAllEvents } from './modules/events.js';
import { autoConnect, connect, disconnect } from './modules/auth.js';
import { initPluginHost } from './modules/plugin-host.js';

const $ = s => document.querySelector(s);

// Initialize plugin host
initPluginHost();

// Bind events
bindAllEvents();

// Bind connection modal events
$('#connectSubmitBtn')?.addEventListener('click', connect);
$('#connectTokenInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
$('#disconnectBtn')?.addEventListener('click', disconnect);

// Auto-connect if token saved
autoConnect();
