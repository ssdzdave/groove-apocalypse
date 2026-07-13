// Crash reporter for the hosted MVP. Catches uncaught errors/rejections,
// snapshots game state, and shows a plain-DOM overlay (the Phaser loop may be
// dead) with copy/download buttons so testers can send the report back.
import { GAME_VERSION, EVT } from '../config.js';

const MAX_ERRORS = 5;
const MAX_CRUMBS = 25;

let installed = false;
let game = null;
let overlayShown = false;
const errors = [];
const crumbs = []; // recent notable game events, oldest first

function crumb(kind, detail) {
    crumbs.push({ t: Date.now(), kind, detail });
    if (crumbs.length > MAX_CRUMBS) crumbs.shift();
}

function snapshotGameState() {
    try {
        const s = game && game.scene && game.scene.getScene('GameScene');
        if (s && s.scene.isActive() && typeof s.getDebugState === 'function') return s.getDebugState();
        const active = game && game.scene ? game.scene.getScenes(true).map((x) => x.scene.key) : [];
        return { activeScenes: active };
    } catch (e) {
        return { snapshotError: String(e) };
    }
}

function buildReport() {
    return {
        game: 'Groove Apocalypse',
        version: GAME_VERSION,
        when: new Date().toISOString(),
        url: location.href,
        userAgent: navigator.userAgent,
        screen: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
        errors: errors.slice(0, MAX_ERRORS),
        stateAtCrash: snapshotGameState(),
        recentEvents: crumbs.slice()
    };
}

function showOverlay() {
    if (overlayShown) return;
    overlayShown = true;
    const report = JSON.stringify(buildReport(), null, 2);

    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(13,5,24,0.94);color:#ff8a3c;' +
        'font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
    el.innerHTML =
        '<div style="font-size:22px;font-weight:bold;color:#ff3cbe;margin-bottom:8px;">THE GROOVE CRASHED</div>' +
        '<div style="font-size:13px;color:#3cf0ff;margin-bottom:14px;">Please send this report to the developer.</div>' +
        '<textarea readonly style="width:min(680px,90vw);height:40vh;background:#0d0518;color:#8a8a94;' +
        'border:1px solid #8c3cff;font-size:10px;padding:8px;"></textarea>' +
        '<div style="margin-top:14px;display:flex;gap:12px;">' +
        '<button data-act="copy" style="font-family:monospace;font-weight:bold;padding:8px 16px;cursor:pointer;">COPY REPORT</button>' +
        '<button data-act="dl" style="font-family:monospace;font-weight:bold;padding:8px 16px;cursor:pointer;">DOWNLOAD .json</button>' +
        '<button data-act="reload" style="font-family:monospace;font-weight:bold;padding:8px 16px;cursor:pointer;">RELOAD GAME</button>' +
        '</div>';
    const ta = el.querySelector('textarea');
    ta.value = report;
    el.addEventListener('click', (ev) => {
        const act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act');
        if (act === 'copy') {
            ta.select();
            try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
            ev.target.textContent = 'COPIED!';
        } else if (act === 'dl') {
            const a = document.createElement('a');
            a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(ta.value);
            a.download = 'groove-apocalypse-crash-' + Date.now() + '.json';
            a.click();
        } else if (act === 'reload') {
            location.reload();
        }
    });
    document.body.appendChild(el);
}

function onError(message, stack) {
    // Ignore errors from browser extensions / cross-origin noise with no stack
    errors.push({ t: Date.now(), message: String(message).slice(0, 500), stack: String(stack || '').slice(0, 1500) });
    if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
    showOverlay();
}

export const CrashReporter = {
    install(gameInstance) {
        if (installed) return;
        installed = true;
        game = gameInstance;

        window.addEventListener('error', (ev) => {
            onError(ev.message || ev.error, ev.error && ev.error.stack);
        });
        window.addEventListener('unhandledrejection', (ev) => {
            const r = ev.reason;
            onError(r && r.message ? r.message : String(r), r && r.stack);
        });

        // Breadcrumbs: cheap trail of what was happening before the crash
        try {
            game.events.on(EVT.LEVEL_START, (p) => crumb('level', p));
            game.events.on(EVT.GAME_OVER, (p) => crumb('game_over', p));
            game.events.on(EVT.BOSS_HP, (hp, max) => crumb('boss_hp', { hp, max }));
            game.events.on(EVT.PLAYER_HP, (hp) => crumb('player_hp', { hp }));
        } catch (e) { /* breadcrumbs are best-effort */ }
    },

    // Manual trigger for testing: CrashReporter.test() from the console
    test() { onError('Manual test report', new Error('test').stack); }
};
