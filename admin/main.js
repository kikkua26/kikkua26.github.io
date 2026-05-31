// kikkua · admin — 入口

import { bindAllEvents } from './modules/events.js';
import { autoConnect } from './modules/auth.js';

bindAllEvents();
autoConnect();
