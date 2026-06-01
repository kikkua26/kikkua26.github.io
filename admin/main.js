// kikkua · admin — 入口

import { bindAllEvents } from './modules/events.js';
import { autoConnect } from './modules/auth.js';
import { initPluginHost } from './modules/plugin-host.js';

initPluginHost();
bindAllEvents();
autoConnect();
