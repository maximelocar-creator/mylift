// MyLift v3.3 — single-file React component.
// Usage: import MyLiftRoot (default export), render it anywhere.
// Le composant auto-injecte son CSS dans document.head au montage.
// Requiert une version React supportant les hooks (16.8+).
//
// v3.3 — passe "APP PREMIUM" motion/transitions (pas de refonte visuelle):
//  • système motion à 4 niveaux (micro / local / container / view)
//  • transitions entre onglets (fade léger + lift 4px, directionnel)
//  • sheets iOS-like (entrée/sortie propres, couplage backdrop/panel, drag-to-dismiss)
//  • press states différenciés par contexte (tab bar / cards / chips / lignes)
//  • expand/collapse fluide (grid-template-rows 1fr trick, GPU-safe)
//  • séance live : feedback validation set + transitions d'état
//  • LWB overlay : sortie maîtrisée, mascot calmé, confetti allégé
//  • cohérence globale des timings via tokens --t-* et easings --ease-*
//  • prefers-reduced-motion strictement respecté

const { useState, useEffect, useMemo, useCallback, useRef } = React;

const MYLIFT_CSS = "/* ============================================================\n   MYLIFT \u2014 DESIGN TOKENS (Strava \u00d7 iOS \u00d7 data viz)\n   ============================================================ */\n:root{\n  --bg-0:#050509;--bg-1:#0A0A12;--bg-2:#10101C;--bg-3:#181828;--bg-hover:#1F1F33;\n  --line:rgba(255,255,255,.06);--line-strong:rgba(255,255,255,.12);\n  --ink-0:#FFFFFF;--ink-1:#E9E9F2;--ink-2:#9CA0B5;--ink-3:#5D6077;--ink-4:#383B4D;\n  --accent:#FC4C02;--accent-hi:#FF6B2C;--accent-lo:#D63F00;\n  --accent-wash:rgba(252,76,2,.12);--accent-glow:rgba(252,76,2,.28);\n  --pr-gold:#FFC233;--pr-gold-wash:rgba(255,194,51,.14);\n  --success:#2FD27D;--success-wash:rgba(47,210,125,.12);\n  --danger:#FF3B48;--info:#5CC8FF;--regress:#696980;\n  --f-sans:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"SF Pro Text\",\"Inter\",system-ui,sans-serif;\n  --f-mono:\"SF Mono\",\"JetBrains Mono\",ui-monospace,Menlo,monospace;\n  --r-xs:8px;--r-sm:12px;--r-md:16px;--r-lg:22px;--r-xl:28px;--r-pill:999px;\n  --shadow-card:0 1px 0 rgba(255,255,255,.04) inset,0 12px 32px -12px rgba(0,0,0,.7);\n  --shadow-accent:0 8px 32px -8px rgba(252,76,2,.45),0 1px 0 rgba(255,255,255,.18) inset;\n  /* Motion system — 4 levels */\n  --ease-ios:cubic-bezier(.22,1,.36,1);              /* ease-out-expo, default L2 */\n  --ease-out-std:cubic-bezier(.32,.72,0,1);          /* iOS native standard, L1/L3 entry */\n  --ease-in-std:cubic-bezier(.4,0,.84,.34);          /* L3/L4 exit */\n  --ease-emph:cubic-bezier(.2,.9,.3,1.2);            /* rare, micro-accent */\n  --t-micro:140ms;  /* L1 press, hover, focus */\n  --t-local:220ms;  /* L2 local state change */\n  --t-ctn:340ms;    /* L3 container expand/sheet */\n  --t-view:280ms;   /* L4 view transition */\n  --sa-t:env(safe-area-inset-top,0px);--sa-b:env(safe-area-inset-bottom,0px);\n}\n@media (prefers-reduced-motion: reduce){\n  :root{--t-micro:0ms;--t-local:0ms;--t-ctn:0ms;--t-view:120ms}\n  *,*::before,*::after{animation-duration:1ms!important;animation-iteration-count:1!important;transition-duration:120ms!important}\n}\n*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}\nhtml,body{margin:0;padding:0;background:var(--bg-0);color:var(--ink-1);font-family:var(--f-sans);min-height:100vh;overscroll-behavior-y:contain}\nbody{font-size:15px;font-weight:500;line-height:1.4}\n#root{min-height:100vh}\nbutton,input,textarea,select{font-family:inherit;font-size:inherit;color:inherit}\ninput[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}\ninput{-webkit-appearance:none;appearance:none}\nbutton{background:none;border:0;cursor:pointer;color:inherit;user-select:none;-webkit-user-select:none;touch-action:manipulation}\n/* No global :active transform — press states are handled per-context for a premium, differentiated feel */\n::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}::-webkit-scrollbar-track{background:transparent}\n.num{font-variant-numeric:tabular-nums}\n\n/* ============================================================\n   APP SHELL\n   ============================================================ */\n.app{min-height:100vh;display:flex;flex-direction:column;position:relative;\n  background:radial-gradient(900px 500px at 50% -240px,rgba(252,76,2,.06),transparent 60%),var(--bg-0)}\n.app-body{flex:1;padding:calc(12px + var(--sa-t)) 16px calc(96px + var(--sa-b));max-width:540px;margin:0 auto;width:100%}\n\n/* Tab bar */\n.tabbar{position:fixed;bottom:0;left:0;right:0;z-index:90;\n  height:calc(64px + var(--sa-b));padding-bottom:var(--sa-b);\n  background:rgba(10,10,18,.78);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);\n  border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-around;padding-inline:8px}\n.tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;\n  color:var(--ink-3);font-size:10px;font-weight:600;letter-spacing:-0.01em;\n  transition:color var(--t-local) var(--ease-ios),opacity var(--t-micro) var(--ease-out-std)}\n.tabbar button svg{width:24px;height:24px;stroke-width:2;transition:transform var(--t-local) var(--ease-ios)}\n.tabbar button.active{color:var(--accent)}\n.tabbar button.active svg{transform:translateY(-1px)}\n/* Press: opacity dip only, no scale — tabs must feel anchored */\n.tabbar button:active{opacity:.55;transition:opacity 60ms linear}\n\n/* ============================================================\n   MOTION SYSTEM — press states & reusable animations\n   ============================================================ */\n/* Press states differentiated by context. Each element type has its own signature.\n   Rule: use scale only where the element is \"card-like\" and has room to compress visually.\n   Flat rows, tab bar buttons, and toggles use opacity/background changes instead. */\n\n/* L1 — card press: subtle scale + brightness dip, emulates iOS touch-down on cards */\n.press-card{transition:transform var(--t-micro) var(--ease-out-std),filter var(--t-micro) var(--ease-out-std),background-color var(--t-micro) var(--ease-out-std)}\n.press-card:active{transform:scale(.985);filter:brightness(.92)}\n\n/* L1 — chip press: background wash, no scale (chips are small, scale looks cheap) */\n.press-chip{transition:background-color var(--t-micro) var(--ease-out-std),color var(--t-micro) var(--ease-out-std)}\n.press-chip:active{background-color:rgba(255,255,255,.12)}\n\n/* L1 — row press: background wash, no scale (rows in lists) */\n.press-row{transition:background-color var(--t-micro) var(--ease-out-std)}\n.press-row:active{background-color:var(--bg-hover)}\n\n/* L1 — button press (primary CTAs): slight scale + brightness, keeps weight */\n.press-btn{transition:transform var(--t-micro) var(--ease-out-std),filter var(--t-micro) var(--ease-out-std)}\n.press-btn:active{transform:scale(.975);filter:brightness(.94)}\n\n/* L1 — icon press: opacity only (icons too small for scale) */\n.press-icon{transition:opacity var(--t-micro) var(--ease-out-std),transform var(--t-micro) var(--ease-out-std)}\n.press-icon:active{opacity:.55}\n\n/* Back-compat: .pressable keeps working for unmigrated call sites.\n   Uses card signature as a safe default (most call sites are card-like). */\n.pressable{transition:transform var(--t-micro) var(--ease-out-std),background-color var(--t-micro) var(--ease-out-std),filter var(--t-micro) var(--ease-out-std)}\n.pressable:active{transform:scale(.985);filter:brightness(.93)}\n\n/* ============================================================\n   MOTION — keyframes & utilities\n   ============================================================ */\n@keyframes mv-fade-in{from{opacity:0}to{opacity:1}}\n@keyframes mv-fade-out{from{opacity:1}to{opacity:0}}\n@keyframes mv-view-enter{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}\n@keyframes mv-sheet-in{from{transform:translate3d(0,16px,0);opacity:0}to{transform:translate3d(0,0,0);opacity:1}}\n@keyframes mv-sheet-out{from{transform:translate3d(0,0,0);opacity:1}to{transform:translate3d(0,24px,0);opacity:0}}\n@keyframes mv-backdrop-in{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(20px)}}\n@keyframes mv-backdrop-out{from{opacity:1}to{opacity:0}}\n@keyframes mv-check-pop{0%{transform:scale(.7);opacity:.5}60%{transform:scale(1.05);opacity:1}100%{transform:scale(1);opacity:1}}\n@keyframes mv-sticky-in{from{opacity:0;transform:translate3d(0,-6px,0)}to{opacity:1;transform:translate3d(0,0,0)}}\n@keyframes mv-exo-switch{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:translate3d(0,0,0)}}\n.mv-exo-switch{animation:mv-exo-switch var(--t-view) var(--ease-out-std);will-change:transform,opacity}\n\n/* ============================================================\n   DASHBOARD ENTRANCE — stagger animations, one-shot at mount\n   ============================================================ */\n/* Generic fade-up for cards and content blocks. --mv-d sets the per-item delay. */\n@keyframes mv-card-in{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:translate3d(0,0,0)}}\n.mv-card-in{animation:mv-card-in 480ms var(--ease-out-std) both;animation-delay:var(--mv-d,0ms);will-change:transform,opacity}\n\n/* KPI numbers: slightly more pronounced lift, faster */\n@keyframes mv-kpi-in{from{opacity:0;transform:translate3d(0,6px,0) scale(.96)}to{opacity:1;transform:translate3d(0,0,0) scale(1)}}\n.mv-kpi-in{animation:mv-kpi-in 420ms var(--ease-out-std) both;animation-delay:var(--mv-d,0ms);will-change:transform,opacity;transform-origin:left bottom;display:inline-block}\n\n/* Sparkline / path stroke drawing — dasharray trick */\n@keyframes mv-stroke-in{from{stroke-dashoffset:var(--mv-dash,500)}to{stroke-dashoffset:0}}\n.mv-stroke-in{stroke-dasharray:var(--mv-dash,500);animation:mv-stroke-in 900ms var(--ease-out-std) both;animation-delay:var(--mv-d,60ms)}\n\n/* Volume bar fill: width 0 -> target. Applied via inline style + delay token. */\n@keyframes mv-bar-in{from{transform:scaleX(0)}to{transform:scaleX(1)}}\n.mv-bar-in{transform-origin:left center;animation:mv-bar-in 700ms var(--ease-out-std) both;animation-delay:var(--mv-d,0ms)}\n\n/* Streak bars: height grow from 0 */\n@keyframes mv-grow-up{from{transform:scaleY(0)}to{transform:scaleY(1)}}\n.mv-grow-up{transform-origin:bottom center;animation:mv-grow-up 520ms var(--ease-out-std) both;animation-delay:var(--mv-d,0ms)}\n\n/* Ring: stroke dashoffset drawn from full (invisible) to target position */\n@keyframes mv-ring-in{from{stroke-dashoffset:var(--mv-ring-from,365)}to{stroke-dashoffset:var(--mv-ring-to,0)}}\n.mv-ring-in{animation:mv-ring-in 900ms var(--ease-out-std) both;animation-delay:var(--mv-d,80ms)}\n@keyframes mv-set-done{0%{background-position:100% 50%}100%{background-position:0 50%}}\n\n/* View transition: used when swapping tabs — content lifts in */\n.mv-view{animation:mv-view-enter var(--t-view) var(--ease-out-std)}\n\n/* Expand/collapse utility — grid-rows 0fr→1fr trick, GPU-safe, height-unknown friendly */\n.mv-expand{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--t-ctn) var(--ease-out-std),opacity var(--t-ctn) var(--ease-out-std);opacity:0}\n.mv-expand.open{grid-template-rows:1fr;opacity:1}\n.mv-expand > .mv-expand-inner{overflow:hidden;min-height:0}\n\n/* Chevron rotation — unified timing across the app */\n.mv-chev{display:inline-flex;transition:transform var(--t-local) var(--ease-ios);color:var(--ink-3)}\n.mv-chev.open{transform:rotate(180deg)}\n\n/* ============================================================\n   TYPOGRAPHY\n   ============================================================ */\n.hero-num{font-size:56px;font-weight:900;letter-spacing:-0.05em;line-height:.95;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.kpi-xl{font-size:38px;font-weight:800;letter-spacing:-0.04em;line-height:1;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.kpi-lg{font-size:28px;font-weight:800;letter-spacing:-0.03em;line-height:1;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.kpi-md{font-size:20px;font-weight:800;letter-spacing:-0.02em;line-height:1;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.unit{font-size:14px;font-weight:500;color:var(--ink-2);margin-left:4px;letter-spacing:-0.01em}\n.title-lg{font-size:26px;font-weight:800;letter-spacing:-0.035em;line-height:1.1;color:var(--ink-0);margin:0}\n.title-md{font-size:18px;font-weight:700;letter-spacing:-0.02em;color:var(--ink-0);line-height:1.2}\n.title-sm{font-size:15px;font-weight:700;letter-spacing:-0.01em;color:var(--ink-0)}\n.body{font-size:15px;font-weight:500;color:var(--ink-1);line-height:1.45}\n.body-sm{font-size:13px;font-weight:500;color:var(--ink-2);line-height:1.4}\n.meta{font-size:11.5px;font-weight:500;color:var(--ink-3);letter-spacing:-0.01em}\n.label{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}\n\n.delta{display:inline-flex;align-items:baseline;gap:3px;font-size:12px;font-weight:700;letter-spacing:-0.01em;font-variant-numeric:tabular-nums}\n.delta.up{color:var(--success)}\n.delta.down{color:var(--danger)}\n.delta.flat{color:var(--ink-3)}\n\n/* ============================================================\n   HEADER\n   ============================================================ */\n.hd{margin-bottom:20px}\n.hd .kicker{display:flex;gap:10px;align-items:center;margin-bottom:6px;font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}\n.hd .kicker .dot{width:6px;height:6px;border-radius:50%;background:var(--accent)}\n.hd h1{margin:0;font-size:32px;font-weight:800;letter-spacing:-0.04em;line-height:1.05;color:var(--ink-0)}\n.hd .meta-line{margin-top:6px;color:var(--ink-2);font-size:14px;font-weight:500}\n\n/* ============================================================\n   CARDS & BENTO\n   ============================================================ */\n.card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-md);padding:16px;position:relative;overflow:hidden;box-shadow:var(--shadow-card)}\n.card.feat{background:radial-gradient(600px 200px at 100% -60%,rgba(252,76,2,.18),transparent 60%),linear-gradient(180deg,#1A1325 0%,#0F0B15 100%);border-color:rgba(252,76,2,.22);padding:20px}\n.card.pr{background:linear-gradient(160deg,rgba(255,194,51,.1),rgba(252,76,2,.04));border-color:rgba(255,194,51,.25)}\n.card-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);margin-bottom:8px;display:flex;align-items:center;gap:6px}\n.card-label .bullet{width:4px;height:4px;border-radius:50%;background:var(--accent)}\n.card-label.gold .bullet{background:var(--pr-gold)}\n.card-label.gold{color:var(--pr-gold)}\n\n.bento{display:grid;gap:10px;grid-template-columns:repeat(6,1fr)}\n.bento > *{min-width:0}\n.sp-6{grid-column:span 6}.sp-4{grid-column:span 4}.sp-3{grid-column:span 3}.sp-2{grid-column:span 2}\n\n/* ============================================================\n   SPARKLINE, RING, BARS\n   ============================================================ */\n.sparkline{width:100%;height:40px;display:block;margin-top:8px}\n.ring-wrap{display:flex;align-items:center;gap:12px;margin-top:4px}\n.ring{width:58px;height:58px;position:relative;flex:0 0 58px}\n.ring svg{transform:rotate(-90deg)}\n.ring .pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;letter-spacing:-0.02em;color:var(--ink-0);font-variant-numeric:tabular-nums}\n\n.streak-row{display:flex;gap:5px;margin-top:10px;align-items:flex-end;height:34px}\n.streak-row .bar{flex:1;height:100%;border-radius:4px 4px 2px 2px;background:var(--bg-3);position:relative}\n.streak-row .bar.done{background:linear-gradient(180deg,var(--accent-hi),var(--accent))}\n.streak-row .bar.today{background:var(--accent-wash);border:1px dashed rgba(252,76,2,.5)}\n.streak-row-labels{display:flex;justify-content:space-around;margin-top:6px;color:var(--ink-3);font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}\n\n.volbar{display:flex;flex-direction:column;gap:9px;margin-top:4px}\n.volbar-row{display:grid;grid-template-columns:78px 1fr 52px;align-items:center;gap:10px}\n.volbar-row .name{font-size:12px;font-weight:600;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.volbar-row .track{height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;position:relative}\n.volbar-row .fill{position:absolute;top:0;left:0;bottom:0;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent-hi))}\n.volbar-row .fill.done{background:linear-gradient(90deg,var(--success),#56E89F)}\n.volbar-row .fill.under{background:var(--ink-4)}\n.volbar-row .fill.over{background:linear-gradient(90deg,var(--pr-gold),#FFDB66)}\n.volbar-row .val{text-align:right;font-size:11px;font-weight:600;color:var(--ink-2);font-variant-numeric:tabular-nums}\n.volbar-row .val strong{color:var(--ink-0);font-weight:700}\n\n/* ============================================================\n   BUTTONS\n   ============================================================ */\n.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 16px;border-radius:var(--r-sm);font-size:14px;font-weight:700;letter-spacing:-0.01em;transition:transform var(--t-micro) var(--ease-out-std),filter var(--t-micro) var(--ease-out-std),box-shadow var(--t-local) var(--ease-ios);min-height:44px;will-change:transform}\n.btn:active{transform:scale(.975);filter:brightness(.94)}\n.btn-primary{background:linear-gradient(180deg,var(--accent-hi) 0%,var(--accent) 100%);color:#fff;box-shadow:var(--shadow-accent)}\n.btn-ghost{background:rgba(255,255,255,.07);color:var(--ink-1)}\n.btn-gold{background:linear-gradient(180deg,#FFDB66 0%,var(--pr-gold) 100%);color:#2A1800;box-shadow:0 8px 24px -8px rgba(255,194,51,.5)}\n.btn-danger{background:linear-gradient(180deg,#FF5A50 0%,var(--danger) 100%);color:#fff}\n.btn-full{width:100%}\n.btn-sm{padding:8px 12px;min-height:36px;font-size:12.5px;border-radius:10px}\n\n.chip{display:inline-flex;align-items:center;padding:4px 9px;border-radius:var(--r-pill);background:var(--bg-3);color:var(--ink-2);font-size:11px;font-weight:600;letter-spacing:-0.01em;white-space:nowrap;transition:background-color var(--t-local) var(--ease-ios),color var(--t-local) var(--ease-ios)}\n.chip.primary{background:var(--accent-wash);color:var(--accent-hi)}\n.chip.gold{background:var(--pr-gold-wash);color:var(--pr-gold)}\n.chip.success{background:var(--success-wash);color:var(--success)}\n\n.pr-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:var(--r-pill);background:var(--pr-gold-wash);color:var(--pr-gold);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}\n\n/* ============================================================\n   INPUTS\n   ============================================================ */\n.input{width:100%;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:12px;color:var(--ink-0);font-size:15px;font-weight:500;outline:none;box-sizing:border-box;transition:border-color var(--t-local) var(--ease-ios),background-color var(--t-local) var(--ease-ios),box-shadow var(--t-local) var(--ease-ios);font-variant-numeric:tabular-nums}\n.input:focus{border-color:var(--accent);background:rgba(252,76,2,.05);box-shadow:0 0 0 3px var(--accent-wash)}\n.seg{display:flex;gap:2px;background:var(--bg-2);border:1px solid var(--line);border-radius:12px;padding:3px;margin-bottom:16px}\n.seg button{flex:1;padding:8px 10px;border-radius:10px;font-size:12px;font-weight:700;color:var(--ink-2);letter-spacing:-0.01em;transition:background-color var(--t-local) var(--ease-ios),color var(--t-local) var(--ease-ios),box-shadow var(--t-local) var(--ease-ios)}\n.seg button:active{opacity:.7;transition:opacity 60ms linear}\n.seg button.active{background:var(--bg-hover);color:var(--ink-0);box-shadow:0 2px 6px rgba(0,0,0,.25)}\n\n/* ============================================================\n   SHEET / MODAL — iOS-like enter/exit, coupled backdrop\n   ============================================================ */\n.sheet-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);display:flex;align-items:flex-end;justify-content:center;animation:mv-fade-in var(--t-ctn) var(--ease-out-std)}\n.sheet-backdrop.closing{animation:mv-fade-out calc(var(--t-ctn) - 60ms) var(--ease-in-std) forwards}\n.sheet{background:var(--bg-2);border-radius:20px 20px 0 0;padding:20px 20px calc(20px + var(--sa-b));width:100%;max-width:540px;max-height:88vh;overflow-y:auto;border:1px solid var(--line);border-bottom:none;animation:mv-sheet-in var(--t-ctn) var(--ease-out-std);will-change:transform,opacity;transform:translate3d(0,0,0)}\n.sheet-backdrop.closing .sheet{animation:mv-sheet-out calc(var(--t-ctn) - 60ms) var(--ease-in-std) forwards}\n.sheet.dragging{transition:none;animation:none}\n.sheet .grip{width:36px;height:4px;background:rgba(255,255,255,.18);border-radius:2px;margin:0 auto 14px;transition:background-color var(--t-local) var(--ease-ios)}\n.sheet:hover .grip,.sheet.dragging .grip{background:rgba(255,255,255,.3)}\n.sheet h3{margin:0 0 16px;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:var(--ink-0);display:flex;justify-content:space-between;align-items:center}\n.sheet h3 .x{color:var(--ink-3);padding:6px;display:inline-flex}\n@keyframes fade-in{0%{opacity:0}100%{opacity:1}}\n@keyframes sheet-up{0%{transform:translateY(30px);opacity:0}100%{transform:translateY(0);opacity:1}}\n@keyframes pop-in{0%{opacity:0;transform:scale(.94)}60%{opacity:1;transform:scale(1.015)}100%{opacity:1;transform:scale(1)}}\n\n/* ============================================================\n   SET ROW \u2014 session live\n   ============================================================ */\n.set-row{display:grid;grid-template-columns:22px 1fr 1fr 62px 70px;gap:5px;align-items:center;padding:11px 12px;border-radius:12px;background:var(--bg-2);border:1px solid var(--line);transition:background var(--t-local) var(--ease-ios),border-color var(--t-local) var(--ease-ios),box-shadow var(--t-local) var(--ease-ios);will-change:transform}\n.set-row.done{background:linear-gradient(180deg,rgba(47,210,125,.07),rgba(47,210,125,.02));border-color:rgba(47,210,125,.2)}\n.set-row.active{background:radial-gradient(300px 100px at 50% 50%,rgba(252,76,2,.12),transparent 70%),var(--bg-2);border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-wash)}\n.set-row.locked{opacity:.38;filter:grayscale(.8);background:var(--bg-1);border-color:rgba(255,255,255,.04)}\n.set-row.locked .idx{color:var(--ink-4)}\n.set-row.locked .flab{color:var(--ink-4)}\n.set-row.locked input.ghost{color:var(--ink-4);pointer-events:none;cursor:not-allowed}\n.set-row.locked input.ghost::placeholder{color:var(--ink-4)}\n.set-row.locked .check{background:var(--bg-3);color:var(--ink-4);pointer-events:none;box-shadow:none;cursor:not-allowed}\n.set-row.locked .press-icon{pointer-events:auto;opacity:.8}\n.set-row.just-done{animation:mv-row-done 420ms var(--ease-ios)}\n@keyframes mv-row-done{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(47,210,125,0)}35%{transform:scale(1.012);box-shadow:0 0 0 5px var(--success-wash)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(47,210,125,0)}}\n.set-row .idx{font-family:var(--f-mono);font-size:11px;font-weight:700;color:var(--ink-3);letter-spacing:.05em;transition:color var(--t-local) var(--ease-ios)}\n.set-row.done .idx{color:var(--success)}\n.set-row.active .idx{color:var(--accent)}\n.set-row .flab{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin-bottom:1px}\n.set-row .fval{font-size:17px;font-weight:800;letter-spacing:-0.02em;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.set-row .fval .sfx{font-size:11px;font-weight:600;color:var(--ink-3);margin-left:1px}\n.set-row input.ghost{background:transparent;border:0;outline:0;color:var(--ink-0);font-size:17px;font-weight:800;letter-spacing:-0.02em;width:100%;font-variant-numeric:tabular-nums;padding:0}\n.set-row .check{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg-3);color:var(--ink-3);transition:background-color var(--t-local) var(--ease-ios),color var(--t-local) var(--ease-ios),box-shadow var(--t-local) var(--ease-ios),transform var(--t-micro) var(--ease-out-std)}\n.set-row .check:active{transform:scale(.9)}\n.set-row.done .check{background:var(--success);color:#fff;animation:mv-check-pop 260ms var(--ease-ios)}\n.set-row.active .check{background:var(--accent);color:#fff;box-shadow:var(--shadow-accent)}\n.stp-btn{transition:background-color var(--t-micro) var(--ease-out-std),color var(--t-micro) var(--ease-out-std),transform var(--t-micro) var(--ease-out-std)}\n.stp-btn:active:not(:disabled){background:var(--accent-wash)!important;color:var(--accent-hi)!important;transform:scale(.92)}\n.stp-btn:disabled{opacity:.4;pointer-events:none}\n\n/* ============================================================\n   LIVE HERO (session live)\n   ============================================================ */\n.live-hero{background:radial-gradient(400px 200px at 50% 120%,rgba(252,76,2,.3),transparent 60%),linear-gradient(180deg,#1C0F1A 0%,#0A0812 100%);border:1px solid rgba(252,76,2,.25);border-radius:var(--r-lg);padding:20px;position:relative;overflow:hidden;margin-bottom:14px}\n.live-dot{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border-radius:var(--r-pill);background:rgba(47,210,125,.14);color:var(--success);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}\n.live-dot .pulse{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(47,210,125,.7);animation:pulse 1.6s infinite}\n@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(47,210,125,.7)}70%{box-shadow:0 0 0 10px rgba(47,210,125,0)}100%{box-shadow:0 0 0 0 rgba(47,210,125,0)}}\n@keyframes pulse-dot{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}70%{box-shadow:0 0 0 10px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}\n.timer{display:flex;align-items:baseline;gap:8px;margin-top:14px}\n.timer .value{font-family:var(--f-mono);font-size:44px;font-weight:700;letter-spacing:-0.04em;color:var(--ink-0);line-height:1;font-variant-numeric:tabular-nums}\n.timer .unit{color:var(--ink-3);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}\n\n/* ============================================================\n   CONFETTI + LWB\n   ============================================================ */\n.lwb-overlay{position:fixed;inset:0;z-index:1000;background:radial-gradient(circle at center,rgba(252,76,2,.18) 0%,rgba(0,0,0,.88) 70%);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:mv-fade-in var(--t-ctn) var(--ease-out-std);padding:20px;will-change:opacity}\n.lwb-overlay.closing{animation:mv-fade-out calc(var(--t-ctn) - 40ms) var(--ease-in-std) forwards}\n.lwb-overlay .mascot-glow{width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,var(--accent-glow),transparent 70%);display:flex;align-items:center;justify-content:center;animation:mv-mascot-in 520ms var(--ease-out-std)}\n@keyframes mv-mascot-in{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}\n.lwb-overlay .mascot-glow img{width:180px;height:180px;object-fit:contain;filter:drop-shadow(0 0 24px rgba(252,76,2,.55))}\n@keyframes float-up{0%{transform:translateY(0)}100%{transform:translateY(-8px)}}\n.lwb-overlay .lwb-text{margin-top:20px;font-size:36px;font-weight:900;letter-spacing:-0.04em;text-align:center;line-height:1;\n  background:linear-gradient(180deg,var(--pr-gold) 0%,var(--accent-hi) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;\n  animation:mv-lwb-text 420ms var(--ease-out-std) 120ms both;text-transform:uppercase}\n@keyframes mv-lwb-text{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}\n.lwb-overlay .lwb-sub{margin-top:8px;font-size:14px;font-weight:600;color:var(--ink-2);letter-spacing:.04em;animation:mv-lwb-text 420ms var(--ease-out-std) 200ms both}\n.lwb-overlay .lwb-badge{margin-top:16px;padding:8px 16px;border-radius:var(--r-pill);background:var(--pr-gold-wash);color:var(--pr-gold);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;animation:mv-lwb-text 420ms var(--ease-out-std) 280ms both}\n.lwb-overlay .tap-hint{position:absolute;bottom:calc(40px + var(--sa-b));color:var(--ink-3);font-size:13px;font-weight:600;letter-spacing:.05em;animation:mv-fade-in 600ms ease 900ms both}\n\n@keyframes confetti-fall{0%{transform:translate3d(0,-10vh,0) rotate(0deg);opacity:1}80%{opacity:1}100%{transform:translate3d(var(--dr),110vh,0) rotate(900deg);opacity:0}}\n.confetti-piece{position:absolute;top:0;opacity:0;animation:confetti-fall 2.5s cubic-bezier(.25,.46,.45,.94) forwards}\n\n/* ============================================================\n   SESSION RECAP — full-screen post-workout celebration\n   ============================================================ */\n.recap{position:fixed;inset:0;z-index:900;background:linear-gradient(180deg,#0A0610 0%,var(--bg-0) 50%,var(--bg-0) 100%);overflow-y:auto;overflow-x:hidden;will-change:opacity;-webkit-overflow-scrolling:touch}\n.recap.enter{animation:mv-fade-in calc(var(--t-ctn) + 40ms) var(--ease-out-std)}\n.recap.closing{animation:mv-fade-out calc(var(--t-ctn) - 60ms) var(--ease-in-std) forwards}\n.recap-glow{position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:600px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(252,76,2,.22) 0%,transparent 60%);pointer-events:none;filter:blur(20px);animation:recap-glow-in 1200ms var(--ease-out-std) both}\n.recap-glow.gold{background:radial-gradient(circle,rgba(255,194,51,.24) 0%,transparent 60%)}\n@keyframes recap-glow-in{from{opacity:0;transform:translate(-50%,-40px) scale(.8)}to{opacity:1;transform:translate(-50%,0) scale(1)}}\n.recap-body{position:relative;z-index:1;max-width:540px;margin:0 auto;padding:calc(60px + var(--sa-t)) 20px calc(120px + var(--sa-b));display:flex;flex-direction:column;align-items:center}\n.recap-kicker{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--success);display:inline-flex;align-items:center;gap:8px;margin-bottom:10px}\n.recap-kicker .tick{width:18px;height:18px;border-radius:50%;background:var(--success);color:#062;display:inline-flex;align-items:center;justify-content:center;animation:mv-check-pop 420ms var(--ease-ios)}\n.recap-title{font-size:34px;font-weight:900;letter-spacing:-0.04em;line-height:1.05;color:var(--ink-0);text-align:center;margin:0 0 6px}\n.recap-subtitle{font-size:14px;color:var(--ink-2);font-weight:500;text-align:center;margin-bottom:32px}\n.recap-hero{text-align:center;margin-bottom:36px;padding:0 10px}\n.recap-hero-label{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px}\n.recap-hero-num{font-size:88px;font-weight:900;letter-spacing:-0.06em;line-height:.9;color:var(--ink-0);font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#FFF 0%,#AAA8C8 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;display:inline-block}\n.recap-hero-unit{font-size:22px;font-weight:700;color:var(--ink-2);margin-left:8px;letter-spacing:-0.02em}\n.recap-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;margin-bottom:24px}\n.recap-kpi{padding:16px 12px;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-md);text-align:center}\n.recap-kpi-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}\n.recap-kpi-val{font-size:22px;font-weight:800;letter-spacing:-0.02em;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.recap-kpi-val .u{font-size:12px;font-weight:600;color:var(--ink-3);margin-left:3px}\n.recap-pr{width:100%;padding:18px 20px;border-radius:var(--r-lg);background:linear-gradient(160deg,rgba(255,194,51,.16) 0%,rgba(252,76,2,.08) 100%);border:1px solid rgba(255,194,51,.4);margin-bottom:24px;position:relative;overflow:hidden}\n.recap-pr::before{content:'';position:absolute;inset:0;background:radial-gradient(400px 120px at 100% 0%,rgba(255,194,51,.2),transparent 60%);pointer-events:none}\n.recap-pr-head{display:flex;align-items:center;gap:12px;margin-bottom:10px;position:relative}\n.recap-pr-icon{width:38px;height:38px;border-radius:12px;background:linear-gradient(180deg,#FFDB66,#FFC233);color:#2A1800;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px -4px rgba(255,194,51,.5);flex:0 0 auto;animation:recap-trophy-in 600ms var(--ease-emph) both}\n@keyframes recap-trophy-in{0%{transform:scale(.5) rotate(-12deg);opacity:0}60%{transform:scale(1.1) rotate(4deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}\n.recap-pr-title{font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:var(--pr-gold)}\n.recap-pr-subtitle{font-size:18px;font-weight:800;letter-spacing:-0.02em;color:var(--ink-0);margin-top:2px;line-height:1.2}\n.recap-pr-item{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-top:1px solid rgba(255,194,51,.15);position:relative;font-size:13px}\n.recap-pr-item:first-of-type{border-top:none;padding-top:4px}\n.recap-pr-name{font-weight:600;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:10px}\n.recap-pr-val{font-weight:800;color:var(--pr-gold);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:14px}\n.recap-muscles{width:100%;margin-bottom:28px}\n.recap-muscles-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;padding:0 2px}\n.recap-muscles-title{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}\n.recap-muscles-total{font-size:11px;font-weight:600;color:var(--ink-2);font-variant-numeric:tabular-nums}\n.recap-muscle-row{display:grid;grid-template-columns:90px 1fr 36px;align-items:center;gap:10px;padding:6px 0}\n.recap-muscle-name{font-size:12px;font-weight:600;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.recap-muscle-track{height:8px;background:var(--bg-3);border-radius:4px;overflow:hidden;position:relative}\n.recap-muscle-fill{position:absolute;top:0;left:0;bottom:0;background:linear-gradient(90deg,var(--accent),var(--accent-hi));border-radius:4px;transform-origin:left center;will-change:transform}\n.recap-muscle-val{text-align:right;font-size:12px;font-weight:700;color:var(--ink-0);font-variant-numeric:tabular-nums}\n.recap-cta{position:fixed;bottom:0;left:0;right:0;padding:20px 20px calc(20px + var(--sa-b));background:linear-gradient(180deg,transparent 0%,rgba(5,5,9,.95) 40%,var(--bg-0) 100%);z-index:2}\n.recap-cta-inner{max-width:540px;margin:0 auto}\n.recap-act{opacity:0;transform:translate3d(0,12px,0);will-change:transform,opacity}\n.recap-act.on{animation:recap-act-in 560ms var(--ease-out-std) forwards;animation-delay:var(--mv-d,0ms)}\n@keyframes recap-act-in{to{opacity:1;transform:translate3d(0,0,0)}}\n\n/* ============================================================\n   MISC\n   ============================================================ */\n.divider{height:1px;background:var(--line);margin:16px 0}\n/* .pressable defined in MOTION SYSTEM section above */\n.section-label{display:flex;align-items:center;gap:8px;padding:18px 4px 10px;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}\n.section-label .bullet{width:4px;height:4px;border-radius:50%;background:var(--accent)}\n.section-label .right{margin-left:auto;text-transform:none;letter-spacing:0;font-size:11px;font-weight:600;color:var(--ink-3)}\n\n.empty-state{text-align:center;padding:40px 20px;color:var(--ink-3)}\n.empty-state .icon{font-size:32px;opacity:.5;margin-bottom:8px}\n.empty-state .title{font-size:15px;font-weight:700;color:var(--ink-2);margin-bottom:4px}\n.empty-state .sub{font-size:13px}\n\n/* ============================================================\n   RANGE SLIDER \u2014 custom styling for subgroup split editor\n   ============================================================ */\n/* The track is a linear-gradient set inline via --slider-fill to show progress.\n   Thumb is a white disc with shadow, enlarged hit target for mobile. */\n.sub-slider{-webkit-appearance:none;appearance:none;width:100%;height:24px;background:transparent;cursor:pointer;padding:0;margin:0;outline:none;display:block}\n.sub-slider::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--accent-hi) 0%,var(--accent) var(--slider-fill,0%),var(--bg-1) var(--slider-fill,0%),var(--bg-1) 100%);box-shadow:inset 0 1px 2px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.06)}\n.sub-slider::-moz-range-track{height:8px;border-radius:4px;background:var(--bg-1);border:1px solid rgba(255,255,255,.06);box-shadow:inset 0 1px 2px rgba(0,0,0,.4)}\n.sub-slider::-moz-range-progress{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--accent-hi),var(--accent))}\n.sub-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:0;margin-top:-8px;box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 1px rgba(0,0,0,.2),0 0 0 4px var(--accent-wash);transition:transform var(--t-micro) var(--ease-out-std),box-shadow var(--t-micro) var(--ease-out-std);cursor:grab}\n.sub-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:0;box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 1px rgba(0,0,0,.2),0 0 0 4px var(--accent-wash);cursor:grab}\n.sub-slider:active::-webkit-slider-thumb{transform:scale(1.12);box-shadow:0 3px 10px rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.2),0 0 0 6px var(--accent-glow);cursor:grabbing}\n.sub-slider:focus::-webkit-slider-thumb{box-shadow:0 2px 8px rgba(0,0,0,.45),0 0 0 1px var(--accent),0 0 0 5px var(--accent-wash)}\n.sub-slider-row{background:var(--bg-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;transition:border-color var(--t-local) var(--ease-ios),background var(--t-local) var(--ease-ios)}\n.sub-slider-row.focus{border-color:rgba(252,76,2,.35);background:linear-gradient(180deg,rgba(252,76,2,.04),transparent)}\n\n/* ============================================================\n   SUBGROUP SPLIT SLIDER — program creator\n   Premium slider: thick track, visible orange fill, large rounded thumb,\n   always-visible % label on the thumb. Overlays a native range input for\n   native drag UX (a11y, keyboard, touch) with invisible track/thumb.\n   ============================================================ */\n.sg-slider{position:relative;height:32px;display:flex;align-items:center;margin:2px 0 4px;touch-action:pan-y;-webkit-tap-highlight-color:transparent}\n.sg-slider .sg-track{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:10px;background:linear-gradient(180deg,var(--bg-3) 0%,#0E0E18 100%);border-radius:999px;border:1px solid rgba(255,255,255,.04);overflow:hidden}\n.sg-slider .sg-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--accent-lo) 0%,var(--accent) 50%,var(--accent-hi) 100%);border-radius:999px;box-shadow:0 0 12px rgba(252,76,2,.35) inset;transition:width 160ms var(--ease-ios)}\n.sg-slider .sg-ticks{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);height:10px;pointer-events:none;display:flex;justify-content:space-between;padding:0 2px}\n.sg-slider .sg-tick{width:1px;height:4px;background:rgba(255,255,255,.1);border-radius:1px;align-self:center}\n.sg-slider .sg-thumb{position:absolute;top:50%;width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid var(--accent);box-shadow:0 4px 14px rgba(252,76,2,.5),0 1px 2px rgba(0,0,0,.4);transform:translate(-50%,-50%);pointer-events:none;transition:transform 140ms var(--ease-ios),box-shadow 140ms var(--ease-ios);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:var(--accent);letter-spacing:-0.03em;font-variant-numeric:tabular-nums}\n.sg-slider.is-active .sg-thumb{transform:translate(-50%,-50%) scale(1.12);box-shadow:0 6px 20px rgba(252,76,2,.65),0 0 0 6px rgba(252,76,2,.18)}\n.sg-slider input[type=range]{position:absolute;left:-14px;right:-14px;width:calc(100% + 28px);height:44px;margin:0;opacity:0;cursor:pointer;z-index:2}\n.sg-slider input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:44px;height:44px}\n.sg-slider input[type=range]::-moz-range-thumb{width:44px;height:44px;border:0;background:transparent}\n.sg-row{padding:11px 12px 10px;background:var(--bg-2);border:1px solid var(--line);border-radius:12px;margin-bottom:6px;transition:border-color 160ms var(--ease-ios),background 160ms var(--ease-ios)}\n.sg-row.is-active{border-color:rgba(252,76,2,.35);background:linear-gradient(180deg,rgba(252,76,2,.05),transparent 60%)}\n.sg-row-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;gap:8px}\n.sg-name{font-size:13px;font-weight:700;color:var(--ink-0);letter-spacing:-0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.sg-val{font-size:12px;font-weight:700;color:var(--ink-1);font-variant-numeric:tabular-nums;white-space:nowrap;display:inline-flex;align-items:baseline;gap:6px}\n.sg-pct{color:var(--accent-hi);font-size:15px;font-weight:800;letter-spacing:-0.02em}\n.sg-sets{color:var(--ink-3);font-weight:500;font-size:11px}\n/* prevent iOS zoom on focus */\n@media screen and (max-width:540px){\n  input[type=number],input[type=text]{font-size:16px}\n}";

/* ==========================================================================
   MYLIFT v2 — helpers, constantes, calculs
   ========================================================================== */

// hooks provided by react import above
const h = React.createElement;

/* --- utilities --------------------------------------------------- */
const uid = () => 'id-'+Math.random().toString(36).slice(2,9)+'-'+Date.now();
const PX = 'mylift_';
const LS = {
  get(k, d){ try{ const v=localStorage.getItem(PX+k); return v?JSON.parse(v):d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem(PX+k, JSON.stringify(v)); }catch{} },
};

/* ====================================================================
   NOTES DE SÉANCE FUTURE
   Une note attachée à un couple (programId, sessionId). Persiste jusqu'à
   la prochaine séance de ce type, puis se consomme (supprimée) à la fin
   de la séance validée. Stockées en LS sous 'session_notes' :
   { "<programId>::<sessionId>": { text, createdAt } }
   ==================================================================== */
const sessionNoteKey = (programId, sessionId) => (programId || '') + '::' + (sessionId || '');
function getSessionNote(programId, sessionId) {
  const all = LS.get('session_notes', {});
  return all[sessionNoteKey(programId, sessionId)] || null;
}
function setSessionNote(programId, sessionId, text) {
  const all = LS.get('session_notes', {});
  const k = sessionNoteKey(programId, sessionId);
  if (text && text.trim()) {
    all[k] = { text: text.trim(), createdAt: Date.now() };
  } else {
    delete all[k];
  }
  LS.set('session_notes', all);
}
function clearSessionNote(programId, sessionId) {
  const all = LS.get('session_notes', {});
  delete all[sessionNoteKey(programId, sessionId)];
  LS.set('session_notes', all);
}

const haptic = t => {
  if (!navigator.vibrate) return;
  const p = {light:5, medium:12, success:[8,40,8], warning:[10,30,10,30,10], heavy:[15]}[t] || 5;
  try{ navigator.vibrate(p); }catch{}
};
const pad2 = n => n<10?'0'+n:''+n;
const iso = d => d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
const todayIso = () => iso(new Date());
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_FR_S = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
const DOW_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const DOW_FR_S = ['L','M','M','J','V','S','D'];

function startOfWeek(d){ const x=new Date(d); x.setHours(0,0,0,0); const dow=(x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; }
function daysAgo(n){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-n); return d; }
function formatDate(isoStr){
  const [y,m,d] = isoStr.split('-').map(Number);
  return `${d} ${MONTHS_FR_S[m-1]}`;
}
function formatRelative(isoStr){
  if (!isoStr) return '—';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 86400000;
  if (diff < 1) return "aujourd'hui";
  if (diff < 2) return "hier";
  if (diff < 7) return "il y a "+Math.floor(diff)+" j";
  if (diff < 30) return "il y a "+Math.floor(diff/7)+" sem.";
  return "il y a "+Math.floor(diff/30)+" mois";
}
function formatDur(sec){
  if (!sec) return '—';
  const m = Math.floor(sec/60), s = sec%60;
  if (m < 60) return `${m}m${pad2(s)}`;
  const h = Math.floor(m/60), mm = m%60;
  return `${h}h${pad2(mm)}`;
}
function formatNum(n, dec=0){
  if (n===null||n===undefined||isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 10000) return (n/1000).toFixed(1)+'k';
  if (abs >= 1000)  return (n/1000).toFixed(2)+'k';
  return Number(n).toFixed(dec).replace(/\.0+$/,'');
}

/* --- muscle groups & exos seed ----------------------------------- */
const MUSCLE_GROUPS_DEFAULT = ["Pectoraux","Dos","Épaules","Biceps","Triceps","Quadriceps","Ischios","Fessiers","Mollets","Adducteurs","Abdos"];

// Sous-groupes par muscle (pour ciblage fin dans générateur + volume tracking)
const SUB_GROUPS_DEFAULT = {
  Pectoraux: ['Haut','Milieu','Bas'],
  Dos: ['Trapèze','Grand dorsal','Lombaires'],
  Épaules: ['Antérieur','Latéral','Arrière']
};

// Répartition % par défaut du volume d'un muscle parent sur ses sous-groupes
// Basée sur sous-développement relatif moyen (Helms/Delavier) :
// - pectoraux : haut & milieu prioritaires, bas naturellement sollicité
// - dos : grand dorsal en volume majeur, trapèze et lombaires en soutien
// - épaules : latéral en priorité (sous-développé chez la plupart), ant/arr équilibrés
const SUB_GROUP_DEFAULT_SPLIT = {
  Pectoraux: { Haut: 40, Milieu: 40, Bas: 20 },
  Dos:       { Trapèze: 25, 'Grand dorsal': 60, Lombaires: 15 },
  Épaules:   { Antérieur: 25, Latéral: 50, Arrière: 25 }
};

// Répartition du volume d'un muscle parent sur ses sous-groupes
// Retourne { subGroup: sériesArrondies } respectant totalSets
function splitVolumeBySubGroups(muscleGroup, totalSets, customPct, customSubGroupsDict) {
  const dict = customSubGroupsDict || SUB_GROUPS_DEFAULT;
  const subs = dict[muscleGroup];
  if (!subs || !subs.length || totalSets <= 0) return null;
  const pct = customPct || SUB_GROUP_DEFAULT_SPLIT[muscleGroup] || {};
  // Complète les sous-groupes manquants avec part équitable du reste
  const defined = subs.filter(s => pct[s] !== undefined);
  const undefinedSubs = subs.filter(s => pct[s] === undefined);
  const definedTotal = defined.reduce((a,s) => a + (pct[s]||0), 0);
  const remain = Math.max(0, 100 - definedTotal);
  const pctFull = {...pct};
  undefinedSubs.forEach(s => { pctFull[s] = undefinedSubs.length ? remain / undefinedSubs.length : 0; });

  // Calcul float puis arrondi avec conservation du total (largest remainder)
  const raw = subs.map(s => ({sub: s, val: totalSets * (pctFull[s]||0) / 100}));
  const floored = raw.map(r => ({...r, floor: Math.floor(r.val), frac: r.val - Math.floor(r.val)}));
  let used = floored.reduce((a,r)=>a+r.floor, 0);
  const deficit = totalSets - used;
  floored.sort((a,b) => b.frac - a.frac);
  const out = {};
  floored.forEach((r, i) => { out[r.sub] = r.floor + (i < deficit ? 1 : 0); });
  return out;
}

// Format: [name, muscleGroup, subGroup (or null), compound, priority]
const SEED_EXOS_RAW = [
  // Pectoraux
  ["Développé couché barre","Pectoraux","Milieu",1,10],
  ["Développé couché haltères","Pectoraux","Milieu",1,9],
  ["Développé incliné barre","Pectoraux","Haut",1,9],
  ["Développé incliné haltères","Pectoraux","Haut",1,9],
  ["Développé incliné machine","Pectoraux","Haut",1,8],
  ["Développé couché machine","Pectoraux","Milieu",1,8],
  ["Développé décliné machine","Pectoraux","Bas",1,7],
  ["Développé incliné à la Smith","Pectoraux","Haut",1,7],
  ["Développé couché à la Smith","Pectoraux","Milieu",1,7],
  ["Peck deck","Pectoraux","Milieu",0,6],
  ["Peck deck décliné","Pectoraux","Bas",0,6],
  ["Écarté poulie","Pectoraux","Milieu",0,5],
  ["Écarté poulie haut","Pectoraux","Haut",0,5],
  ["Écarté poulie bas","Pectoraux","Bas",0,5],
  // Dos
  ["Traction pronation","Dos","Grand dorsal",1,10],
  ["Rowing barre","Dos","Grand dorsal",1,10],
  ["Rowing bucheron","Dos","Grand dorsal",1,9],
  ["Tirage vertical poulie","Dos","Grand dorsal",1,8],
  ["Tirage vertical machine","Dos","Grand dorsal",1,8],
  ["Tirage horizontal machine","Dos","Trapèze",1,8],
  ["Tirage horizontal poulie","Dos","Trapèze",1,8],
  ["Tirage machine unilatéral","Dos","Grand dorsal",1,8],
  ["Machine pullover","Dos","Grand dorsal",0,6],
  ["Pullover poulie","Dos","Grand dorsal",0,5],
  // Biceps
  ["Traction supination","Biceps",null,1,9],
  ["Curl debout","Biceps",null,0,8],
  ["Curl pupitre","Biceps",null,0,7],
  ["Curl incliné","Biceps",null,0,7],
  ["Curl marteau","Biceps",null,0,6],
  ["Reverse curl","Biceps",null,0,4],
  // Triceps
  ["Dips","Triceps",null,1,9],
  ["JM press","Triceps",null,1,8],
  ["Barre au front","Triceps",null,1,7],
  ["Haltère au front","Triceps",null,1,7],
  ["Machine dips","Triceps",null,1,7],
  ["Extension poulie","Triceps",null,0,7],
  ["Extension poulie derrière","Triceps",null,0,6],
  ["Carter extension","Triceps",null,0,5],
  // Épaules
  ["Militaire barre","Épaules","Antérieur",1,10],
  ["Militaire haltères","Épaules","Antérieur",1,9],
  ["Militaire machine","Épaules","Antérieur",1,8],
  ["Élévation latérale haltères","Épaules","Latéral",0,9],
  ["Élévation latérale poulie","Épaules","Latéral",0,7],
  ["Machine élévation latérale","Épaules","Latéral",0,7],
  ["Élévation frontale haltères","Épaules","Antérieur",0,5],
  ["Élévation frontale poulie","Épaules","Antérieur",0,5],
  ["Arrière épaule haltères","Épaules","Arrière",0,7],
  ["Arrière épaule poulie","Épaules","Arrière",0,7],
  ["Reverse peck fly","Épaules","Arrière",0,7],
  ["Face pull","Épaules","Arrière",0,7],
  ["Tirage menton","Épaules","Latéral",1,6],
  // Jambes
  ["Squat libre","Quadriceps",null,1,10],
  ["Squat smith","Quadriceps",null,1,9],
  ["Hack squat","Quadriceps",null,1,9],
  ["Pendulum","Quadriceps",null,1,8],
  ["Presse","Quadriceps",null,1,8],
  ["Belt squat","Quadriceps",null,1,7],
  ["Leg extension","Quadriceps",null,0,6],
  ["Sissy squat","Quadriceps",null,0,5],
  ["RDL barre","Ischios",null,1,10],
  ["RDL haltères","Ischios",null,1,9],
  ["Leg curl assis","Ischios",null,0,7],
  ["Leg curl debout","Ischios",null,0,7],
  ["Hip thrust","Fessiers",null,1,10],
  ["Extension banc lombaire pour fessiers","Fessiers",null,0,7],
  ["Abduction","Fessiers",null,0,6],
  ["Kick back","Fessiers",null,0,6],
  ["Machine mollet debout","Mollets",null,0,8],
  ["Machine mollet assis","Mollets",null,0,7],
  ["Extension smith mollet","Mollets",null,0,7],
  ["Extension lombaire","Dos","Lombaires",0,7],
  ["Crunch poulie","Abdos",null,0,7],
  ["Crunch machine","Abdos",null,0,7],
  ["Crunch","Abdos",null,0,6],
  ["Relevé de jambes","Abdos",null,0,6],
  ["Machine adducteurs","Adducteurs",null,0,7],
  ["Presse sumo","Adducteurs",null,1,7]
];
const SEED_LIB = SEED_EXOS_RAW.map(([name,muscle,subGroup,compound,pri]) => ({
  id: 'seed-'+name.toLowerCase().replace(/[^a-z0-9]/g,'-'),
  name, muscleGroup:muscle, subGroup: subGroup||null, compound:!!compound, priority:pri||5
}));

/* --- program templates ------------------------------------------- */
const d = (name, sets) => ({name, sets});
const PROGRAM_TPL = {
  fb2:{label:"Full Body 2x/semaine",freq:2,sessions:[{name:"Full Body A",exos:[d("Squat libre",4),d("Développé couché barre",4),d("Traction pronation",4),d("Militaire barre",3),d("Curl debout",3),d("Crunch",3)]},{name:"Full Body B",exos:[d("RDL barre",4),d("Développé couché barre incliné",4),d("Rowing barre",4),d("Élévation latérale haltères",3),d("Extension poulie",3),d("Crunch",3)]}],targets:{Pectoraux:8,Dos:8,Quadriceps:4,Ischios:4,Épaules:6,Biceps:3,Triceps:3,Abdos:6}},
  fb3:{label:"Full Body 3x/semaine",freq:3,sessions:[{name:"Full Body A",exos:[d("Squat libre",4),d("Développé couché barre",4),d("Traction pronation",3),d("Élévation latérale haltères",3),d("Curl debout",3),d("Crunch",3)]},{name:"Full Body B",exos:[d("RDL barre",4),d("Militaire barre",4),d("Rowing barre",4),d("Dips",3),d("Machine mollet debout",3),d("Crunch",3)]},{name:"Full Body C",exos:[d("Presse",4),d("Développé couché haltères incliné",4),d("Tirage horizontal machine",4),d("Arrière épaule haltères",3),d("Curl marteau",3),d("Relevé de jambes",3)]}],targets:{Pectoraux:11,Dos:11,Quadriceps:8,Ischios:4,Épaules:6,Biceps:6,Triceps:3,Mollets:3,Abdos:6}},
  ul4:{label:"Upper / Lower 4x/semaine",freq:4,sessions:[{name:"Upper A",exos:[d("Développé couché barre",4),d("Traction pronation",4),d("Militaire barre",3),d("Rowing bucheron",3),d("Curl debout",3),d("Extension poulie",3)]},{name:"Lower A",exos:[d("Squat libre",4),d("RDL barre",3),d("Presse",3),d("Leg curl assis",3),d("Machine mollet debout",4),d("Crunch",3)]},{name:"Upper B",exos:[d("Développé couché haltères incliné",4),d("Traction pronation",4),d("Élévation latérale haltères",3),d("Tirage horizontal machine",3),d("Curl marteau",3),d("Dips",3)]},{name:"Lower B",exos:[d("Hip thrust",4),d("Hack squat",3),d("Leg extension",3),d("RDL haltères",3),d("Machine mollet assis",4),d("Relevé de jambes",3)]}],targets:{Pectoraux:11,Dos:14,Quadriceps:10,Ischios:9,Épaules:6,Biceps:6,Triceps:6,Fessiers:4,Mollets:8,Abdos:6}},
  ppl6:{label:"Push / Pull / Legs 6x/semaine",freq:6,sessions:[{name:"Push A",exos:[d("Développé couché barre",4),d("Militaire barre",4),d("Développé couché haltères incliné",3),d("Élévation latérale haltères",3),d("Extension poulie",3),d("Dips",3)]},{name:"Pull A",exos:[d("Traction pronation",4),d("Rowing barre",4),d("Tirage horizontal machine",3),d("Arrière épaule haltères",3),d("Curl debout",3),d("Curl marteau",3)]},{name:"Legs A",exos:[d("Squat libre",4),d("RDL barre",4),d("Presse",3),d("Leg curl assis",3),d("Machine mollet debout",4),d("Crunch",3)]},{name:"Push B",exos:[d("Développé couché haltères incliné",4),d("Militaire haltères",4),d("Fly poulie",3),d("Élévation latérale poulie",3),d("Haltère au front",3),d("Peck fly",3)]},{name:"Pull B",exos:[d("Tirage vertical poulie",4),d("Rowing bucheron",4),d("Machine pullover",3),d("Reverse peck fly",3),d("Curl pupitre",3),d("Curl incliné",3)]},{name:"Legs B",exos:[d("Hip thrust",4),d("Hack squat",3),d("Leg extension",3),d("Leg curl debout",3),d("Machine mollet assis",4),d("Relevé de jambes",3)]}],targets:{Pectoraux:14,Dos:14,Quadriceps:10,Ischios:10,Épaules:13,Biceps:9,Triceps:9,Fessiers:4,Mollets:8,Abdos:6}},
};

/* --- core formulas ----------------------------------------------- */
const parseSetVals = s => ({w: parseFloat(s.weight)||0, r: parseInt(s.reps)||0});
// w>=0 (poids 0 OK pour exos poids du corps), mais on exige que weight ait été explicitement saisi
// (chaîne non vide), pour ne pas confondre "0 saisi" avec "pas encore rempli".
const isValidSet = s => {
  const {w,r}=parseSetVals(s);
  const weightSet = s && s.weight !== '' && s.weight !== null && s.weight !== undefined;
  return weightSet && w>=0 && r>0 && r<=50 && w<=1000;
};
const e1RM = (w,r) => { const W=parseFloat(w)||0, R=parseInt(r)||0; return (W<=0||R<=0)?0:W*(1+R/30); };
const topSetOf = ex => {
  const sets = (ex.sets||[]).filter(isValidSet);
  if (!sets.length) return null;
  return sets.reduce((a,b) => e1RM(b.weight,b.reps) > e1RM(a.weight,a.reps) ? b : a);
};
const exoScore = ex => {
  const t = topSetOf(ex);
  if (!t) return 0;
  const top = e1RM(t.weight, t.reps);
  const thr = top * 0.93;
  const n = (ex.sets||[]).filter(s => e1RM(s.weight,s.reps) >= thr).length;
  return top * (1 + 0.02 * Math.max(0, n-1));
};
const tonnageExo = ex => (ex.sets||[]).reduce((a,s)=>a+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0);
const tonnageSession = s => (s.exercises||[]).reduce((a,ex)=>a+tonnageExo(ex),0);
const setsCountSession = s => (s.exercises||[]).reduce((a,ex)=>a+(ex.sets||[]).filter(isValidSet).length,0);
const scoreSession = s => (s.exercises||[]).reduce((a,ex)=>a+exoScore(ex),0);

/* --- exo matching key (across sessions) -------------------------- */
const norm = t => (t||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
// Inclut le modelId si présent : un PR sur "Leg ext / Hammer" est différent d'un PR sur "Leg ext / Technogym".
// Accepte 'modelId' (logs persistés) OU 'activeModelId' (séance en cours) — c'est le même concept,
// juste le nom du champ qui diffère selon le contexte.
const exoKey = ex => {
  const base = ex.exId ? 'lib:'+ex.exId : 'name:'+norm(ex.exName||ex.name||'');
  const mid = ex.modelId || ex.activeModelId;
  return mid ? base + '/m:' + mid : base;
};
// Variante "tous modèles confondus" — utilisée pour la vue agrégée optionnelle
const exoKeyNoModel = ex => ex.exId ? 'lib:'+ex.exId : 'name:'+norm(ex.exName||ex.name||'');

/* --- muscle group of an exercise --------------------------------- */
function exoMuscleGroup(ex, lib) {
  if (ex.exId) {
    const L = lib.find(l => l.id === ex.exId);
    if (L?.muscleGroup) return L.muscleGroup;
  }
  if (ex.muscleGroup) return ex.muscleGroup;
  // try matching by name
  const nm = norm(ex.exName||ex.name||'');
  const L = lib.find(l => norm(l.name) === nm);
  return L?.muscleGroup || 'Autre';
}

/* ====================================================================
   PROGRESSION INTELLIGENTE — la vraie métrique de surcharge
   ==================================================================== */

/**
 * Scanne l'historique d'un exo dans l'ordre chronologique et flag chaque set
 * comme all-time PR et/ou rep PR selon les définitions :
 *   - All-Time PR : nouveau poids max (jamais touché auparavant)
 *   - Rep PR : à un poids déjà touché, plus de reps que jamais à ce poids exact
 *
 * Les deux PRs sont indépendants. Une série peut être l'un, l'autre, les deux ou aucun.
 *
 * @param journalLogs — tous les logs (déjà triés par date, mais on retri par sécurité)
 * @param keyResolver — fonction (ex) => clé d'identité (gère exoKey ou exoKeyNoModel)
 * @param targetKey — la clé qu'on cherche (peut inclure /m:<modelId>)
 * @returns Array<{date, sessionId, ex, set, weight, reps, isAllTimePR, isRepPR}>
 */
function scanExoPRs(journalLogs, keyResolver, targetKey) {
  // Aplatit toutes les séries de cet exo en respectant l'ordre temporel
  const flatSets = [];
  const sessions = [...journalLogs].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  sessions.forEach(session => {
    (session.exercises||[]).forEach(ex => {
      if (keyResolver(ex) !== targetKey) return;
      (ex.sets||[]).forEach((s, setIdx) => {
        if (!isValidSet(s)) return;
        flatSets.push({
          date: session.date,
          sessionId: session.id,
          exId: ex.exId,
          exName: ex.exName,
          modelId: ex.modelId || null,
          setIdx,
          weight: parseFloat(s.weight),
          reps: parseInt(s.reps)
        });
      });
    });
  });

  // Scan chronologique en maintenant l'état "déjà vu"
  const EPS = 0.05;
  let maxWeightEver = 0;
  let everSeenAny = false; // false tant qu'aucun set n'a encore été observé pour cet exo
  const maxRepsAtWeight = {}; // weight (en string pour key) → max reps observé à ce poids
  return flatSets.map(set => {
    const wKey = set.weight.toFixed(2);
    const sameWBefore = maxRepsAtWeight[wKey];

    // All-Time : nouveau poids max strict. La toute première série ever sur cet exo
    // n'est jamais un PR (pas de baseline).
    const isAllTime = everSeenAny && set.weight > maxWeightEver + EPS;
    // Rep PR : poids déjà touché ET plus de reps qu'avant
    const isRep = sameWBefore !== undefined && set.reps > sameWBefore;

    // Mise à jour de l'état après évaluation
    if (set.weight > maxWeightEver) maxWeightEver = set.weight;
    if (sameWBefore === undefined || set.reps > sameWBefore) {
      maxRepsAtWeight[wKey] = set.reps;
    }
    everSeenAny = true;

    return {...set, isAllTimePR: isAllTime, isRepPR: isRep};
  });
}

/* Timeline e1RM par séance pour un exo donné */
// Si modelFilter est fourni : 'all' → pas de filtre, 'none' → seulement les séries sans modelId,
// '<id>' → seulement les séries de ce modèle. Sinon (undefined), on prend tout (back-compat).
function exoTimeline(journalLogs, key, modelFilter) {
  // key peut contenir /m:<modelId> (clé spécifique) ou pas (clé générique exo).
  // Si modelFilter est fourni, on ignore la part modèle de la clé et on filtre via modelFilter.
  const baseKey = key.split('/m:')[0];

  // Pour matcher les séries d'un log dans la bonne portée (avec/sans modèle)
  const matchesScope = (ex) => {
    if (exoKeyNoModel(ex) !== baseKey) return false;
    if (modelFilter !== undefined && modelFilter !== 'all') {
      const exModel = ex.modelId || 'none';
      return exModel === modelFilter;
    } else if (modelFilter === undefined) {
      return exoKey(ex) === key;
    }
    return true; // 'all'
  };

  // Scan complet de l'historique pour calculer les vrais PRs (all-time + rep PR)
  // sur les séries qui matchent le scope (modèle filtré ou pas).
  // On utilise un keyResolver custom qui retourne 'match'/'nope' pour faire passer
  // exactement les séries dans le scope.
  const SCOPE_KEY = '__scope__';
  const allPRFlags = scanExoPRs(
    journalLogs,
    (ex) => matchesScope(ex) ? SCOPE_KEY : 'nope',
    SCOPE_KEY
  );
  // Construit un index par (sessionId, setIdx) → flags PR pour lookup rapide
  const prFlagsBySetKey = {};
  allPRFlags.forEach(p => {
    const k = p.sessionId + '|' + p.setIdx + '|' + (p.modelId||'') + '|' + p.weight.toFixed(2) + '|' + p.reps;
    prFlagsBySetKey[k] = {isAllTimePR: p.isAllTimePR, isRepPR: p.isRepPR};
  });

  const points = [];
  journalLogs.forEach(session => {
    (session.exercises||[]).forEach(ex => {
      if (!matchesScope(ex)) return;
      const t = topSetOf(ex);
      if (!t) return;
      // Enrichit chaque set avec ses flags PR
      const enrichedSets = (ex.sets||[]).filter(isValidSet).map((s, idx) => {
        const w = parseFloat(s.weight);
        const r = parseInt(s.reps);
        const k = session.id + '|' + idx + '|' + (ex.modelId||'') + '|' + w.toFixed(2) + '|' + r;
        const flags = prFlagsBySetKey[k] || {isAllTimePR: false, isRepPR: false};
        return {w, r, rir: s.rir, isAllTimePR: flags.isAllTimePR, isRepPR: flags.isRepPR};
      });
      // Une séance est marquée PR si au moins une de ses séries est un PR (all-time ou rep)
      const sessionHasAnyPR = enrichedSets.some(s => s.isAllTimePR || s.isRepPR);
      const sessionHasAllTime = enrichedSets.some(s => s.isAllTimePR);
      const sessionHasRep = enrichedSets.some(s => s.isRepPR);

      points.push({
        date: session.date,
        sessionId: session.id,
        exName: ex.exName || ex.name,
        modelId: ex.modelId || null,
        weight: parseFloat(t.weight),
        reps: parseInt(t.reps),
        e1rm: e1RM(t.weight, t.reps),
        allSets: enrichedSets,
        hasAllTimePR: sessionHasAllTime,
        hasRepPR: sessionHasRep,
        hasAnyPR: sessionHasAnyPR
      });
    });
  });
  points.sort((a,b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId));
  let maxE1RM = 0;
  return points.map((p, i) => {
    const prev = points[i-1];
    const delta = prev ? (p.e1rm - prev.e1rm) : 0;
    let kind = 'first';
    if (prev) {
      if (delta >= 0.3) kind = 'up';
      else if (delta <= -0.3) kind = 'down';
      else kind = 'flat';
    }
    // isPR reflète maintenant un VRAI PR utilisateur (all-time ou rep), pas une projection e1RM
    const isPR = p.hasAnyPR;
    if (p.e1rm > maxE1RM) maxE1RM = p.e1rm;
    return { ...p, delta, kind, isPR };
  });
}

/* Surcharge progressive résumée sur période (défaut 28j) */
function progressionSummary(journalLogs, lib, periodDays=28) {
  const cutIso = iso(daysAgo(periodDays));
  // Tous les exos travaillés dans la période — clé sans modèle pour ne pas dupliquer
  const keysSeen = new Set();
  journalLogs.forEach(s => {
    if (s.date < cutIso) return;
    (s.exercises||[]).forEach(ex => keysSeen.add(exoKeyNoModel(ex)));
  });
  const items = [];
  keysSeen.forEach(baseKey => {
    // Timeline complète (avec flags PR enrichis) pour cet exo, tous modèles
    const tl = exoTimeline(journalLogs, baseKey, 'all');
    if (tl.length < 1) return;
    const inPeriod = tl.filter(t => t.date >= cutIso);
    if (inPeriod.length === 0) return;

    // === Calcul indice % d'amélioration (même logique que muscles) ===
    // Groupé par modèle : baseline = 1ère séance dans la période = 100, indices ensuite.
    // Par date : moyenne des indices observés ce jour-là (cross-modèles).
    // Évite le bug "changer de machine fait chuter le delta kg".
    const byModel = {};
    inPeriod.forEach(p => {
      const mid = p.modelId || 'none';
      if (!byModel[mid]) byModel[mid] = [];
      byModel[mid].push(p);
    });
    const indexPointsByDate = {};
    Object.values(byModel).forEach(pts => {
      pts.sort((a,b) => a.date.localeCompare(b.date));
      const base = pts[0].e1rm;
      if (base <= 0) return;
      pts.forEach(p => {
        const idx = p.e1rm / base * 100;
        if (!indexPointsByDate[p.date]) indexPointsByDate[p.date] = [];
        indexPointsByDate[p.date].push(idx);
      });
    });
    const dates = Object.keys(indexPointsByDate).sort();
    if (dates.length === 0) return;
    const rawIndex = dates.map(d => indexPointsByDate[d].reduce((a,x)=>a+x,0) / indexPointsByDate[d].length);
    // Lissage moyenne mobile 7 points (séances)
    const smoothIndex = rawIndex.map((v, i) => {
      const start = Math.max(0, i - 6);
      const sl = rawIndex.slice(start, i + 1);
      return sl.reduce((a,x)=>a+x,0) / sl.length;
    });
    const finalIndex = smoothIndex[smoothIndex.length-1];
    const deltaPct = finalIndex - 100;

    // === Flags PR ===
    const hasAllTimePR = inPeriod.some(p => p.hasAllTimePR);
    // Rep PR significatif = un PR de rep range qui n'est PAS aussi un all-time
    const hasRepPRonly = !hasAllTimePR && inPeriod.some(p => p.hasRepPR);

    // === Last performance (top set de la dernière séance dans la période) ===
    const last = inPeriod[inPeriod.length-1];
    const first = inPeriod[0];

    // === Muscle group ===
    const muscleGroup = (function(){
      for (const s of journalLogs) {
        const ex = (s.exercises||[]).find(e => exoKeyNoModel(e) === baseKey);
        if (ex) return exoMuscleGroup(ex, lib);
      }
      return 'Autre';
    })();

    items.push({
      key: baseKey,
      name: last.exName,
      muscleGroup,
      deltaPct,
      finalIndex,
      // Flags PR explicites pour l'UI
      hasAllTimePR,
      hasRepPRonly,
      isPR: hasAllTimePR || hasRepPRonly, // retro-compat
      // Classification : up/down/flat sur la base de deltaPct (seuil 0.5% pour éviter le bruit)
      kind: deltaPct > 0.5 ? 'up' : deltaPct < -0.5 ? 'down' : 'flat',
      // Top set de la dernière séance (utilisé dans la sub-meta)
      lastWeight: last.weight, lastReps: last.reps,
      // Conserve l'ancien deltaE1RM pour rétro-compat éventuelle (kg brut, peut être trompeur cross-modèles)
      deltaE1RM: last.e1rm - first.e1rm,
      lastE1RM: last.e1rm,
      baselineE1RM: first.e1rm,
      prevWeight: first.weight, prevReps: first.reps,
      count: inPeriod.length
    });
  });
  // Tri par deltaPct desc (progression réelle), plus de bias PR-first
  items.sort((a,b) => b.deltaPct - a.deltaPct);
  const up = items.filter(i => i.deltaPct > 0).length;
  const prs = items.filter(i => i.hasAllTimePR).length;
  return { items, total: items.length, up, prs, pct: items.length ? Math.round(100*up/items.length) : 0 };
}

/* Agrégation par muscle : deltaE1RM moyen + PRs par muscleGroup */
function muscleProgressSummary(journalLogs, lib, periodDays=28) {
  const { items } = progressionSummary(journalLogs, lib, periodDays);
  const byMuscle = {};
  items.forEach(it => {
    const g = it.muscleGroup || 'Autre';
    if (!byMuscle[g]) byMuscle[g] = { total: 0, count: 0, prs: 0, positives: 0 };
    byMuscle[g].total += it.deltaE1RM;
    byMuscle[g].count += 1;
    if (it.isPR) byMuscle[g].prs += 1;
    if (it.deltaE1RM > 0) byMuscle[g].positives += 1;
  });
  return Object.entries(byMuscle).map(([muscleGroup, data]) => ({
    muscleGroup,
    avgDelta: data.count ? data.total / data.count : 0,
    totalDelta: data.total,
    exoCount: data.count,
    prs: data.prs,
    positives: data.positives,
    progressRate: data.count ? data.positives / data.count : 0
  })).filter(m => m.exoCount > 0).sort((a,b) => b.avgDelta - a.avgDelta);
}

/* ==========================================================================
   INDICE DE PROGRESSION PAR MUSCLE (vraie logique bodybuilding)
   ==========================================================================
   Au lieu d'agréger les e1RM en kg (qui se fait défoncer dès qu'on change de
   machine ou qu'on mélange des exos avec des plages de poids différentes),
   on raisonne en INDICE :
     - Pour chaque exo×modèle dans la période : sa 1ère séance = base 100
     - Chaque séance suivante : indice = e1RM / e1RM_base × 100
     - Par date : on prend la moyenne des indices observés ce jour-là
   Avantage : la courbe traduit la progression RELATIVE, peu importe les kg
   absolus. Changer une Presse Hammer pour une Technogym ne fait plus chuter
   la courbe ; Technogym démarre sa propre baseline.

   exoModelKey(ex) = exoKey(ex) — inclut déjà le modelId, ce qui sépare
   Hammer de Technogym même pour le même exo.
   ========================================================================== */

/**
 * Construit la timeline d'indice pour un muscle (filtré optionnellement par sous-muscle).
 * @returns {raw, smooth, exoCount, finalIndex, deltaPct}
 *   raw    : [{date, value: indice moyen brut ce jour}, ...]
 *   smooth : [{date, value: indice moyen lissé (moyenne mobile 7 points)}, ...]
 *   finalIndex : valeur de l'indice à la dernière date (100 = pas de progression)
 *   deltaPct : finalIndex - 100 (≈ progression en %)
 */
function muscleIndexTimeline(journalLogs, lib, muscleGroup, cutIso, subGroupFilter) {
  // 1) Récupère tous les exos×modèles du muscle dans la période, avec leurs séances
  // emKey = exoKey complet (avec modelId). Sépare Hammer/Technogym.
  const byEmKey = new Map(); // emKey -> {subGroup, points: [{date, e1rm}, ...]}
  journalLogs.forEach(session => {
    if (session.date < cutIso) return;
    (session.exercises||[]).forEach(ex => {
      if (exoMuscleGroup(ex, lib) !== muscleGroup) return;
      // SubGroup filter
      let sg = null;
      if (ex.exId) {
        const L = lib.find(l => l.id === ex.exId);
        if (L?.subGroup) sg = L.subGroup;
      }
      if (!sg) {
        const nm = norm(ex.exName || ex.name || '');
        const L = lib.find(l => norm(l.name) === nm);
        if (L?.subGroup) sg = L.subGroup;
      }
      if (subGroupFilter && subGroupFilter !== 'all' && sg !== subGroupFilter) return;
      const t = topSetOf(ex);
      if (!t) return;
      const w = parseFloat(t.weight), r = parseInt(t.reps);
      const e = e1RM(w, r);
      if (e <= 0) return;
      const emk = exoKey(ex);
      if (!byEmKey.has(emk)) byEmKey.set(emk, { subGroup: sg, points: [] });
      byEmKey.get(emk).points.push({date: session.date, e1rm: e});
    });
  });

  // 2) Pour chaque exo×modèle : trier par date, baseline = premier point, indices ensuite
  // On exige ≥1 point ; les exos×modèles avec 1 seul point ont indice=100 sur leur date.
  // Pour le calcul du delta global, on n'inclura que ceux avec ≥2 points.
  const indexPointsByDate = {}; // date -> [indices ce jour]
  let nExoModelWithDelta = 0;
  let nPositives = 0;
  byEmKey.forEach(({points}) => {
    points.sort((a,b) => a.date.localeCompare(b.date));
    const base = points[0].e1rm;
    if (base <= 0) return;
    points.forEach((p, i) => {
      const idx = p.e1rm / base * 100;
      if (!indexPointsByDate[p.date]) indexPointsByDate[p.date] = [];
      indexPointsByDate[p.date].push(idx);
    });
    if (points.length >= 2) {
      nExoModelWithDelta += 1;
      if (points[points.length-1].e1rm > base) nPositives += 1;
    }
  });

  // 3) Construire la timeline : moyenne des indices par date
  const dates = Object.keys(indexPointsByDate).sort();
  const raw = dates.map(d => ({
    date: d,
    value: indexPointsByDate[d].reduce((a,x)=>a+x,0) / indexPointsByDate[d].length
  }));

  // 4) Lissage moyenne mobile sur 7 points (séances). Pour les premiers points,
  // fenêtre rétrécie. Style PeseeChart.
  const SMOOTH_WIN = 7;
  const smooth = raw.map((p, i) => {
    const start = Math.max(0, i - SMOOTH_WIN + 1);
    const slice = raw.slice(start, i + 1);
    return { date: p.date, value: slice.reduce((a,x)=>a+x.value,0) / slice.length };
  });

  // 5) Delta global = indice lissé final - 100. Lissé pour cohérence visuelle avec la courbe.
  const finalIndex = smooth.length ? smooth[smooth.length-1].value : 100;
  const deltaPct = finalIndex - 100;

  return {
    raw, smooth, finalIndex, deltaPct,
    exoCount: byEmKey.size,
    exoWithDelta: nExoModelWithDelta,
    positives: nPositives
  };
}

/**
 * Sommaire indice par muscle pour la vue liste Progrès.
 * Renvoie un tableau trié par deltaPct desc.
 */
function muscleIndexSummary(journalLogs, lib, periodDays=28) {
  const cutIso = iso(daysAgo(periodDays));
  // Tous les muscles ayant ≥1 séance dans la période
  const muscles = new Set();
  journalLogs.forEach(s => {
    if (s.date < cutIso) return;
    (s.exercises||[]).forEach(ex => {
      const mg = exoMuscleGroup(ex, lib);
      if (mg) muscles.add(mg);
    });
  });
  // Compte des PRs par muscle (via progressionSummary — déjà solide via scanExoPRs)
  const { items } = progressionSummary(journalLogs, lib, periodDays);
  const prsByMuscle = {};
  items.forEach(it => {
    const g = it.muscleGroup || 'Autre';
    if (it.isPR) prsByMuscle[g] = (prsByMuscle[g] || 0) + 1;
  });
  const rows = [];
  muscles.forEach(mg => {
    const tl = muscleIndexTimeline(journalLogs, lib, mg, cutIso);
    rows.push({
      muscleGroup: mg,
      deltaPct: tl.deltaPct,
      exoCount: tl.exoCount,
      exoWithDelta: tl.exoWithDelta,
      positives: tl.positives,
      prs: prsByMuscle[mg] || 0
    });
  });
  return rows.sort((a,b) => b.deltaPct - a.deltaPct);
}

/* Volume programme (static) — incluant sous-groupes */
function programVolume(program, lib) {
  const total={}, perSession={}, totalSub={};
  (program?.sessions||[]).forEach(s => {
    const ps = {};
    (s.exercises||[]).forEach(ex => {
      const sets = parseInt(ex.sets)||0;
      let g = ex.muscleGroup||'Autre';
      let sg = ex.subGroup || null;
      const c = ex.choices?.[0];
      if (c?.exId) {
        const L = lib.find(l => l.id === c.exId);
        if (L?.muscleGroup) g = L.muscleGroup;
        if (L?.subGroup) sg = L.subGroup;
      }
      ps[g] = (ps[g]||0) + sets;
      total[g] = (total[g]||0) + sets;
      if (sg) {
        if (!totalSub[g]) totalSub[g] = {};
        totalSub[g][sg] = (totalSub[g][sg]||0) + sets;
      }
    });
    perSession[s.id] = ps;
  });
  return { total, perSession, totalSub };
}

/* Volume actuel cette semaine */
function weekActualVolume(journalLogs, lib, weekStart) {
  const s0 = iso(weekStart);
  const end = new Date(weekStart); end.setDate(end.getDate()+6);
  const e0 = iso(end);
  const vol = {};
  journalLogs.forEach(ses => {
    if (ses.date < s0 || ses.date > e0) return;
    (ses.exercises||[]).forEach(ex => {
      const sets = (ex.sets||[]).filter(isValidSet).length;
      if (!sets) return;
      const g = exoMuscleGroup(ex, lib);
      vol[g] = (vol[g]||0) + sets;
    });
  });
  return vol;
}

/* KPI agrégés (7j ou période) */
function periodKPI(journalLogs, days=7) {
  const end = new Date(); end.setHours(23,59,59,999);
  const start = daysAgo(days-1);
  const s0 = iso(start), e0 = iso(end);
  const sessions = journalLogs.filter(l => l.date >= s0 && l.date <= e0);
  const prevStart = daysAgo(days*2-1);
  const prevEnd = daysAgo(days);
  const prevSessions = journalLogs.filter(l => l.date >= iso(prevStart) && l.date <= iso(prevEnd));
  const agg = arr => ({
    sessions: arr.length,
    tonnage: arr.reduce((a,s)=>a+tonnageSession(s),0),
    duration: arr.reduce((a,s)=>a+(s.durationSec||0),0),
    prs: arr.reduce((a,s)=>a+(s.prs?.length||0),0),
    sets: arr.reduce((a,s)=>a+setsCountSession(s),0),
    score: arr.reduce((a,s)=>a+scoreSession(s),0)
  });
  return { curr: agg(sessions), prev: agg(prevSessions), rawSessions: sessions };
}

function deltaPct(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

/* Next session recommendation (oldest-last logic) */
function recommendedSession(program, journalLogs) {
  if (!program?.sessions?.length) return null;
  const lastBySession = {};
  journalLogs.forEach(l => {
    if (l.programId === program.id && l.sessionId) {
      if (!lastBySession[l.sessionId] || l.date > lastBySession[l.sessionId]) {
        lastBySession[l.sessionId] = l.date;
      }
    }
  });
  // pick session with oldest date (or never done)
  let best = program.sessions[0], bestDate = lastBySession[best.id] || '0000';
  for (const s of program.sessions) {
    const d = lastBySession[s.id] || '0000';
    if (d < bestDate) { best = s; bestDate = d; }
  }
  return best;
}

/* Exo from program session, with last performance for the same exo */
function hydrateSessionExos(session, lib, journalLogs) {
  return (session.exercises||[]).map(progEx => {
    const c = progEx.choices?.[0];
    const libEx = c?.exId ? lib.find(l => l.id === c.exId) : null;
    const name = libEx?.name || progEx.exName || '?';
    const muscleGroup = libEx?.muscleGroup || progEx.muscleGroup || 'Autre';
    const k = c?.exId ? 'lib:'+c.exId : 'name:'+norm(name);
    // find last performance
    let last = null;
    for (let i = journalLogs.length - 1; i >= 0; i--) {
      const log = journalLogs[i];
      const found = (log.exercises||[]).find(ex => exoKey(ex) === k && (ex.sets||[]).some(isValidSet));
      if (found) {
        last = { date: log.date, sets: (found.sets||[]).filter(isValidSet) };
        break;
      }
    }
    // Modèles de la lib + cibles programmées (filter sur les modèles encore existants)
    const libModels = libEx?.models || [];
    const programmedTargets = (progEx.modelTargets || [])
      .filter(t => libModels.find(m => m.id === t.modelId));
    return {
      progId: progEx.id,
      exId: c?.exId || null,
      exName: name,
      muscleGroup,
      targetSets: parseInt(progEx.sets) || 0,
      targetWeight: c?.weight || '',
      machine: c?.machine || '',
      setting: libEx?.setting || '', // réglage global (utilisé si pas de modèle actif)
      variants: progEx.choices || [],
      libModels,                      // tous les modèles dispo dans la lib pour cet exo
      modelTargets: programmedTargets, // cibles spécifiques par modèle programmées dans le programme
      activeModelId: null,            // modèle choisi pour cette séance (null tant que pas choisi)
      lastPerformance: last
    };
  });
}

/* ====================================================================
   PROGRAM GENERATOR — Helms/Norton/Delavier, focus progression/maintenance
   ====================================================================

   Règles :
   - Focus = progression (volume normal) ou maintenance (×0.6, priorités ignorées)
   - Niveau module : débutant ×0.75, intermédiaire ×1.0, confirmé ×1.2
   - Priorités ×1.4 en progression seulement
   - Hard caps par session :
     • max 8 séries par muscle par session (Helms)
     • max 6 exos par session
     • max 22 séries totales par session
   - Chaque muscle : 2 sessions/sem minimum quand volume > 8
   - Compound-first sur les groupes majors (= ayant des exos compound dans la biblio)
   - Rep ranges : compound 6-10, accessoire 10-15 (Helms standard)
   ==================================================================== */

const LEVEL_MULT = { debutant: 0.75, intermediaire: 1.0, confirme: 1.15 };
const STATUS_MULT = { maintenance: 0.5, progression: 1.0, focus: 1.4 };
const REP_COMPOUND = [6,10];
const REP_ACCESSORY = [10,15];
const MAX_SETS_PER_MUSCLE_PER_SESSION = 8;
const MAX_EXOS_PER_SESSION = 9;
const MAX_SETS_PER_SESSION = 24;
const MAX_SETS_COMPOUND = 3; // jamais 4 sets d'un polyarticulaire
const MAX_SETS_ACCESSORY = 4;
const MIN_SETS_COMPOUND = 2; // compound minimum utile
const MIN_SETS_ACCESSORY = 1; // isolation : 1 série OK pour travailler un angle
const WEEKLY_HARD_CAP = 30; // cap Helms MRV / muscle

// Base weekly targets (intermediate baseline, progression) — calibré Helms moyenne basse MEV→MAV
// Pour volumes plus bas et plus soutenables. L'utilisateur peut passer en focus (+40%) pour pousser
const BASE_VOLUME = {
  Pectoraux:10, Dos:12, Quadriceps:10, Épaules:8,
  Ischios:8, Biceps:6, Triceps:6, Fessiers:6, Mollets:6,
  Abdos:5, Adducteurs:4
};

// Legacy compat: construit muscleStatus depuis focus + priorities
function resolveMuscleStatus({muscleStatus, focus, priorities, muscleGroups}) {
  if (muscleStatus && typeof muscleStatus === 'object') return muscleStatus;
  const defaultStatus = focus === 'maintenance' ? 'maintenance' : 'progression';
  const out = {};
  (muscleGroups || Object.keys(BASE_VOLUME)).forEach(g => {
    out[g] = priorities && priorities.includes(g) ? 'focus' : defaultStatus;
  });
  return out;
}

function computeVolumeTargets({level='intermediaire', muscleStatus, focus, priorities=[], muscleGroups}) {
  const lm = LEVEL_MULT[level] || 1;
  const groups = muscleGroups || Object.keys(BASE_VOLUME);
  const status = resolveMuscleStatus({muscleStatus, focus, priorities, muscleGroups: groups});
  const targets = {};
  groups.forEach(g => {
    const base = BASE_VOLUME[g] !== undefined ? BASE_VOLUME[g] : 6;
    const sm = STATUS_MULT[status[g]] !== undefined ? STATUS_MULT[status[g]] : 1;
    let t = base * lm * sm;
    t = Math.round(t);
    if (t > WEEKLY_HARD_CAP) t = WEEKLY_HARD_CAP;
    targets[g] = t;
  });
  return targets;
}

// Avertissements si config peu réaliste (Helms/Norton)
function validateMuscleStatus({muscleStatus, frequency, level, muscleGroups}) {
  const groups = muscleGroups || Object.keys(BASE_VOLUME);
  const focusCount = groups.filter(g => muscleStatus?.[g] === 'focus').length;
  const warnings = [];
  const focusCap = frequency <= 3 ? 2 : frequency <= 5 ? 3 : 4;
  if (focusCount > focusCap) {
    warnings.push(`${focusCount} muscles en focus simultanés — au-delà de ${focusCap} le MRV sera dépassé. Passe les moins prioritaires en "progression".`);
  }
  const targets = computeVolumeTargets({level, muscleStatus, muscleGroups: groups});
  const totalSets = Object.values(targets).reduce((a,v)=>a+v,0);
  const weeklyCap = frequency * MAX_SETS_PER_SESSION;
  if (totalSets > weeklyCap * 1.1) {
    warnings.push(`Volume total (${totalSets} séries/sem) dépasse la capacité de ${frequency} séances. Augmente la fréquence ou passe des muscles en "maintenance".`);
  }
  return { warnings, focusCount, totalSets, weeklyCap };
}

// Session split templates by frequency
const SPLIT_TEMPLATES = {
  2: [{name:'Full Body A', focus:['push','legs_quad','pull','calves','core']},
      {name:'Full Body B', focus:['pull','legs_post','push','shoulders','calves']}],
  3: [{name:'Full Body A', focus:['push','legs_quad','pull','calves','core']},
      {name:'Full Body B', focus:['pull','legs_post','shoulders','core']},
      {name:'Full Body C', focus:['push','legs_quad','arms','calves']}],
  4: [{name:'Upper A', focus:['push','pull','shoulders','arms','core']},
      {name:'Lower A', focus:['legs_quad','legs_post','calves','glutes']},
      {name:'Upper B', focus:['pull','push','shoulders','arms']},
      {name:'Lower B', focus:['legs_post','legs_quad','calves','glutes','core']}],
  5: [{name:'Upper', focus:['push','pull','shoulders','arms','core']},
      {name:'Lower A', focus:['legs_quad','legs_post','calves']},
      {name:'Push', focus:['push','shoulders','triceps']},
      {name:'Pull', focus:['pull','biceps','rear_delt','core']},
      {name:'Lower B', focus:['legs_post','legs_quad','calves','glutes']}],
  6: [{name:'Push A', focus:['push','shoulders','triceps']},
      {name:'Pull A', focus:['pull','biceps','rear_delt','core']},
      {name:'Legs A', focus:['legs_quad','legs_post','calves']},
      {name:'Push B', focus:['push','shoulders','triceps','core']},
      {name:'Pull B', focus:['pull','biceps','rear_delt']},
      {name:'Legs B', focus:['legs_post','legs_quad','glutes','calves']}]
};

const FOCUS_TO_GROUPS = {
  push: ['Pectoraux','Triceps','Épaules'],
  pull: ['Dos','Biceps'],
  shoulders: ['Épaules'],
  rear_delt: ['Épaules'],
  triceps: ['Triceps'],
  biceps: ['Biceps'],
  arms: ['Biceps','Triceps'],
  legs_quad: ['Quadriceps'],
  legs_post: ['Ischios','Fessiers'],
  calves: ['Mollets'],
  glutes: ['Fessiers'],
  core: ['Abdos','Lombaires']
};

function sessionsForGroup(split, group) {
  return split.map((sess, i) => {
    const groups = new Set();
    (sess.focus||[]).forEach(f => (FOCUS_TO_GROUPS[f]||[]).forEach(g => groups.add(g)));
    return groups.has(group) ? i : null;
  }).filter(i => i !== null);
}

function exoBankByGroup(lib, muscleGroups) {
  const bank = {};
  muscleGroups.forEach(g => {
    const exos = lib.filter(l => l.muscleGroup === g);
    const bySub = {};
    exos.forEach(e => {
      const k = e.subGroup || '_';
      if (!bySub[k]) bySub[k] = [];
      bySub[k].push(e);
    });
    Object.keys(bySub).forEach(k => bySub[k].sort((a,b)=>(b.priority||5)-(a.priority||5)));
    bank[g] = {
      compounds: exos.filter(l => l.compound).sort((a,b) => (b.priority||5) - (a.priority||5)),
      accessories: exos.filter(l => !l.compound).sort((a,b) => (b.priority||5) - (a.priority||5)),
      all: exos.sort((a,b) => (b.priority||5) - (a.priority||5)),
      bySub
    };
  });
  return bank;
}

function generateProgram({level='intermediaire', muscleStatus, focus, frequency=4, priorities=[], subGroupSplit={}, lib, muscleGroups, name}) {
  const tplSplit = SPLIT_TEMPLATES[frequency] || SPLIT_TEMPLATES[4];
  const groups = muscleGroups || MUSCLE_GROUPS_DEFAULT;
  const resolvedStatus = resolveMuscleStatus({muscleStatus, focus, priorities, muscleGroups: groups});
  const targets = computeVolumeTargets({level, muscleStatus: resolvedStatus, muscleGroups: groups});
  const bank = exoBankByGroup(lib, groups);

  // Cibles sous-groupes = split hebdo demandé (custom ou défaut)
  const subGroupTargets = {};
  groups.forEach(g => {
    const customPct = subGroupSplit[g] || null;
    const split = splitVolumeBySubGroups(g, targets[g] || 0, customPct);
    if (split) subGroupTargets[g] = split;
  });

  // Tracker du volume déjà placé par sous-groupe sur tout le programme — sert à biaiser le picker
  const programSubUsed = {}; // programSubUsed[muscle][subGroup] = séries déjà placées

  // Focus muscles (treated as protected + higher volume)
  const focusGroups = new Set(groups.filter(g => resolvedStatus[g] === 'focus'));

  const sessionsByGroup = {};
  groups.forEach(g => { sessionsByGroup[g] = sessionsForGroup(tplSplit, g); });

  const idealPerSession = {};
  groups.forEach(g => {
    idealPerSession[g] = tplSplit.map(() => 0);
    const sIdxs = sessionsByGroup[g];
    const total = targets[g] || 0;
    if (total === 0 || sIdxs.length === 0) return;
    const perSession = Math.min(MAX_SETS_PER_MUSCLE_PER_SESSION, Math.ceil(total / sIdxs.length));
    let remaining = Math.min(total, perSession * sIdxs.length);
    sIdxs.forEach(si => {
      if (remaining <= 0) return;
      const s = Math.min(perSession, remaining);
      idealPerSession[g][si] = s;
      remaining -= s;
    });
  });

  // Pour chaque session, groupes présents + scaling proportionnel si > cap
  const MAJORS = new Set(['Pectoraux','Dos','Quadriceps','Ischios','Épaules']);
  const sessions = tplSplit.map((sessTpl, si) => {
    const groupsInSession = [...new Set((sessTpl.focus||[]).flatMap(f => FOCUS_TO_GROUPS[f]||[]))]
      .filter(g => idealPerSession[g]?.[si] > 0 && groups.includes(g));

    // Trier : focus d'abord, puis majors, puis autres (tous par cible décroissante)
    const ordered = [...groupsInSession].sort((a,b) => {
      const ap = focusGroups.has(a), bp = focusGroups.has(b);
      if (ap !== bp) return ap ? -1 : 1;
      const am = MAJORS.has(a), bm = MAJORS.has(b);
      if (am !== bm) return am ? -1 : 1;
      return (targets[b]||0) - (targets[a]||0);
    });

    // Scaling: focus + majors protégés, reste scalé
    const protectedGroups = ordered.filter(g => focusGroups.has(g) || MAJORS.has(g));
    const secondaryGroups = ordered.filter(g => !focusGroups.has(g) && !MAJORS.has(g));
    const protectedPlanned = protectedGroups.reduce((a,g) => a + idealPerSession[g][si], 0);
    const secondaryPlanned = secondaryGroups.reduce((a,g) => a + idealPerSession[g][si], 0);

    const adjusted = {};
    // Si même les protégés dépassent le cap → on scale tout
    if (protectedPlanned > MAX_SETS_PER_SESSION) {
      const scale = MAX_SETS_PER_SESSION / (protectedPlanned + secondaryPlanned);
      ordered.forEach(g => {
        adjusted[g] = Math.max(2, Math.round(idealPerSession[g][si] * scale));
      });
    } else {
      // Protected groups at full volume
      protectedGroups.forEach(g => { adjusted[g] = idealPerSession[g][si]; });
      // Secondary groups scale down to fit in remaining budget
      const remaining = Math.max(0, MAX_SETS_PER_SESSION - protectedPlanned);
      const scaleSec = secondaryPlanned > 0 && remaining < secondaryPlanned
        ? remaining / secondaryPlanned : 1;
      secondaryGroups.forEach(g => {
        const v = Math.round(idealPerSession[g][si] * scaleSec);
        adjusted[g] = v >= 1 ? v : 0; // au moins 1 série pour garder l'exo d'angle
      });
      // Pass de récupération : réinjecter 1 série min aux groupes skipped si budget restant
      let used = Object.values(adjusted).reduce((a,v)=>a+v,0);
      const dropped = secondaryGroups.filter(g => adjusted[g] === 0);
      // priorité aux plus gros écarts target/actual (pour éviter qu'un muscle soit systématiquement orphelin)
      dropped.sort((a,b) => (targets[b]||0) - (targets[a]||0));
      for (const g of dropped) {
        if (used + 1 > MAX_SETS_PER_SESSION) break;
        adjusted[g] = 1;
        used += 1;
      }
    }

    const exercises = [];
    let totalSessionSets = 0;
    const usedExoIds = new Set();
    const lowFreq = frequency <= 3; // à 2-3 séances/sem, on mise sur les polyarticulaires

    for (const g of ordered) {
      if (exercises.length >= MAX_EXOS_PER_SESSION) break;
      const remaining = MAX_SETS_PER_SESSION - totalSessionSets;
      if (remaining < MIN_SETS_ACCESSORY) break;

      const setsForGroup = Math.min(adjusted[g] || 0, remaining, MAX_SETS_PER_MUSCLE_PER_SESSION);
      if (setsForGroup < MIN_SETS_ACCESSORY) continue;

      const b = bank[g];
      if (!b || b.all.length === 0) continue;

      // Nombre d'exos à poser pour ce muscle dans cette session
      // Budget ≥ 5 → 2 exos (compound + accessoire OU 2 compounds si freq basse)
      // Budget ≥ 8 → 3 exos (compound + 2 accessoires, variés en angle)
      let nExos;
      if (setsForGroup >= 8 && b.accessories.length >= 2) nExos = 3;
      else if (setsForGroup >= 5) nExos = 2;
      else nExos = 1;

      const picks = [];
      const subGroupsUsed = new Set();

      // Helper : trie les candidats pour privilégier les sous-groupes en déficit
      // déficit = cible_sous_groupe - déjà_utilisé_par_le_programme
      const subTgt = subGroupTargets[g] || {};
      const progUsed = programSubUsed[g] || {};
      const sortByDeficit = (list) => {
        return [...list].sort((a, b) => {
          // On évite d'abord les sous-groupes déjà utilisés dans cette session
          const aUsedNow = a.subGroup && subGroupsUsed.has(a.subGroup) ? 1 : 0;
          const bUsedNow = b.subGroup && subGroupsUsed.has(b.subGroup) ? 1 : 0;
          if (aUsedNow !== bUsedNow) return aUsedNow - bUsedNow;
          // Puis on privilégie le plus gros déficit programme
          const aDef = a.subGroup ? ((subTgt[a.subGroup] || 0) - (progUsed[a.subGroup] || 0)) : 0;
          const bDef = b.subGroup ? ((subTgt[b.subGroup] || 0) - (progUsed[b.subGroup] || 0)) : 0;
          if (aDef !== bDef) return bDef - aDef;
          // Enfin par priorité d'exo
          return (a.priority || 5) - (b.priority || 5);
        });
      };

      // 1er pick : compound prioritaire (biaisé par déficit sous-groupe)
      if (b.compounds.length > 0) {
        const sortedCompounds = sortByDeficit(b.compounds.filter(e => !usedExoIds.has(e.id)));
        const compound = sortedCompounds[0] || b.compounds[0];
        picks.push({exo: compound, type:'compound'});
        usedExoIds.add(compound.id);
        if (compound.subGroup) subGroupsUsed.add(compound.subGroup);
      } else if (b.accessories.length > 0) {
        const sortedAcc = sortByDeficit(b.accessories.filter(e => !usedExoIds.has(e.id)));
        const acc = sortedAcc[0] || b.accessories[0];
        picks.push({exo: acc, type:'accessory'});
        usedExoIds.add(acc.id);
        if (acc.subGroup) subGroupsUsed.add(acc.subGroup);
      }

      // 2e pick : si freq basse → 2e compound (autre angle) si dispo ; sinon accessoire d'un subGroup différent
      if (nExos >= 2 && picks.length === 1) {
        let second = null;
        if (lowFreq && b.compounds.length >= 2) {
          const pool = sortByDeficit(b.compounds.filter(e => !usedExoIds.has(e.id)));
          second = pool[0];
        }
        if (!second && b.accessories.length > 0) {
          const pool = sortByDeficit(b.accessories.filter(e => !usedExoIds.has(e.id)));
          second = pool[0];
        }
        if (!second) {
          const pool = sortByDeficit([...b.accessories, ...b.compounds].filter(e => !usedExoIds.has(e.id)));
          second = pool[0];
        }
        if (second) {
          picks.push({exo: second, type: second.compound ? 'compound' : 'accessory'});
          usedExoIds.add(second.id);
          if (second.subGroup) subGroupsUsed.add(second.subGroup);
        }
      }

      // 3e pick : accessoire d'un subGroup non encore travaillé (1 seule série acceptable)
      if (nExos >= 3 && picks.length === 2 && b.accessories.length > 0) {
        const pool = sortByDeficit(b.accessories.filter(e => !usedExoIds.has(e.id)));
        const third = pool[0];
        if (third) {
          picks.push({exo: third, type:'accessory'});
          usedExoIds.add(third.id);
          if (third.subGroup) subGroupsUsed.add(third.subGroup);
        }
      }

      // Répartition des séries par pick :
      // On priorise les compounds sur le budget. L'isolation peut finir à 1 série (angle).
      const compoundPicks = picks.filter(p => p.type === 'compound');
      const accessoryPicks = picks.filter(p => p.type === 'accessory');
      const compoundShare = compoundPicks.length * MAX_SETS_COMPOUND; // max théorique compound
      let compoundBudget = Math.min(compoundShare, setsForGroup);
      // Quand on a à la fois compound+accessoire, on réserve au moins 1 série à l'accessoire si le budget le permet
      if (compoundPicks.length > 0 && accessoryPicks.length > 0) {
        const minAccessory = Math.min(accessoryPicks.length, setsForGroup - compoundPicks.length * MIN_SETS_COMPOUND);
        compoundBudget = Math.min(compoundBudget, setsForGroup - Math.max(0, minAccessory));
      }
      let accessoryBudget = Math.max(0, setsForGroup - compoundBudget);

      const setsByPick = new Map();
      // Compound : répartir compoundBudget entre compoundPicks (max MAX_SETS_COMPOUND, min MIN_SETS_COMPOUND)
      compoundPicks.forEach((p, i) => {
        const leftPicks = compoundPicks.length - i;
        let s = Math.round(compoundBudget / leftPicks);
        s = Math.max(MIN_SETS_COMPOUND, Math.min(MAX_SETS_COMPOUND, s));
        setsByPick.set(p, s);
        compoundBudget -= s;
      });
      // Accessoire : répartir le reste entre accessoryPicks (min 1, max MAX_SETS_ACCESSORY)
      accessoryPicks.forEach((p, i) => {
        const leftPicks = accessoryPicks.length - i;
        let s = Math.round(accessoryBudget / leftPicks);
        s = Math.max(MIN_SETS_ACCESSORY, Math.min(MAX_SETS_ACCESSORY, s));
        setsByPick.set(p, s);
        accessoryBudget -= s;
      });

      picks.forEach(pick => {
        let sets = setsByPick.get(pick) || (pick.type === 'compound' ? MIN_SETS_COMPOUND : MIN_SETS_ACCESSORY);
        // Cap global
        if (pick.type === 'compound') sets = Math.min(sets, MAX_SETS_COMPOUND);
        else sets = Math.min(sets, MAX_SETS_ACCESSORY);

        if (exercises.length >= MAX_EXOS_PER_SESSION) return;
        if (totalSessionSets + sets > MAX_SETS_PER_SESSION) {
          sets = MAX_SETS_PER_SESSION - totalSessionSets;
          const minOk = pick.type === 'compound' ? MIN_SETS_COMPOUND : MIN_SETS_ACCESSORY;
          if (sets < minOk) return;
        }
        exercises.push({
          id: uid(), sets,
          muscleGroup: g,
          subGroup: pick.exo.subGroup || null,
          choices: [{exId: pick.exo.id, weight:'', machine:'', muscleGroup: g, subGroup: pick.exo.subGroup || null}],
          repRange: pick.type === 'compound' ? REP_COMPOUND : REP_ACCESSORY,
          isCompound: pick.type === 'compound',
          history: []
        });
        totalSessionSets += sets;
        // Met à jour le tracker de volume par sous-groupe au niveau programme
        if (pick.exo.subGroup) {
          if (!programSubUsed[g]) programSubUsed[g] = {};
          programSubUsed[g][pick.exo.subGroup] = (programSubUsed[g][pick.exo.subGroup] || 0) + sets;
        }
      });
    }

    return { id: uid(), name: sessTpl.name, exercises };
  });

  return {
    id: uid(),
    name: name || `Auto · ${frequency}j`,
    level, frequency,
    muscleStatus: resolvedStatus,
    priorities, // legacy compat
    focus, // legacy compat
    subGroupSplit, // répartition % custom par sous-groupe (pour regénérer/ajuster)
    sessions,
    volumeTargets: {
      program: targets,
      subGroups: subGroupTargets,
      sessions: {}
    },
    createdAt: Date.now(),
    auto: true
  };
}

/* --- MASCOT base64 (injected) ------------------------------------ */
const __MASCOT__ = "data:image/webp;base64,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";


/* ==========================================================================
   UI PRIMITIVES
   ========================================================================== */

/* --- Icons --- */
const ICONS = {
  home: h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('path',{d:'M3 12l9-9 9 9'}),h('path',{d:'M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10'})),
  journal: h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('path',{d:'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'})),
  trend: h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('polyline',{points:'13 7 21 7 21 15'}),h('polyline',{points:'3 18 9 12 13 16 21 7'})),
  scale: h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('path',{d:'M4 4h16c1 0 2 1 2 2v12c0 1-1 2-2 2H4c-1 0-2-1-2-2V6c0-1 1-2 2-2z'}),
    h('path',{d:'M8 10h8m-4 0v4'})),
  settings: h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('circle',{cx:12,cy:12,r:3}),
    h('path',{d:'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'})),
  // Réglage / tune (sliders horizontaux) — utilisé inline pour afficher "le réglage machine"
  tune: h('svg',{width:11,height:11,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.4,strokeLinecap:'round',strokeLinejoin:'round',style:{display:'inline-block',verticalAlign:'-1px',marginRight:3,flex:'0 0 auto'}},
    h('line',{x1:4,y1:7,x2:11,y2:7}),
    h('line',{x1:15,y1:7,x2:20,y2:7}),
    h('circle',{cx:13,cy:7,r:2.2}),
    h('line',{x1:4,y1:17,x2:9,y2:17}),
    h('line',{x1:13,y1:17,x2:20,y2:17}),
    h('circle',{cx:11,cy:17,r:2.2})),
  plus: h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round'},
    h('line',{x1:12,y1:5,x2:12,y2:19}),h('line',{x1:5,y1:12,x2:19,y2:12})),
  check: h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:3.5,strokeLinecap:'round',strokeLinejoin:'round'},
    h('polyline',{points:'20 6 9 17 4 12'})),
  x: h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round'},
    h('line',{x1:18,y1:6,x2:6,y2:18}),h('line',{x1:6,y1:6,x2:18,y2:18})),
  left: h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'},
    h('polyline',{points:'15 18 9 12 15 6'})),
  right: h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'},
    h('polyline',{points:'9 6 15 12 9 18'})),
  play: h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'currentColor'},
    h('polygon',{points:'5 3 19 12 5 21 5 3'})),
  pause: h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'currentColor'},
    h('rect',{x:6,y:4,width:4,height:16,rx:1}),
    h('rect',{x:14,y:4,width:4,height:16,rx:1})),
  trash: h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('polyline',{points:'3 6 5 6 21 6'}),
    h('path',{d:'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2'})),
  edit: h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('path',{d:'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7'}),
    h('path',{d:'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'})),
  trophy: h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'currentColor'},
    h('path',{d:'M12 2l3 7h7l-5.5 4.5L18.5 22 12 17l-6.5 5 1.5-8.5L1.5 9h7z'})),
  flame: h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
    h('path',{d:'M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z'})),
  up: h('svg',{width:12,height:12,viewBox:'0 0 24 24',fill:'currentColor'},h('polygon',{points:'12 4 22 16 2 16'})),
  dumbbell: h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:'currentColor'},
    h('rect',{x:2,y:8,width:3,height:8,rx:1}),h('rect',{x:19,y:8,width:3,height:8,rx:1}),
    h('rect',{x:5,y:6,width:3,height:12,rx:1}),h('rect',{x:16,y:6,width:3,height:12,rx:1}),
    h('rect',{x:8,y:10,width:8,height:4,rx:1})),
  chevDown: h('svg',{width:12,height:12,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'},
    h('polyline',{points:'6 9 12 15 18 9'})),
  info: h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},
    h('circle',{cx:12,cy:12,r:10}),h('line',{x1:12,y1:8,x2:12,y2:12}),h('line',{x1:12,y1:16,x2:12.01,y2:16})),
};

/* --- Sheet (bottom modal) --- */
function ViewContainer({activeTab, children, scrollToTopOnChange=false}) {
  // Plays a subtle enter animation on each tab change WITHOUT remounting children.
  // Children keep their local state (open sheets, scroll, expanded sections).
  // Animation is re-triggered via className toggle + forced reflow.
  //
  // scrollToTopOnChange: opt-in scroll reset. Off by default so main tabs preserve their scroll
  // (iOS-native behavior — each tab is its own world). Turned on for sub-tabs (Params sections,
  // Progression view switch) where the content changes completely and preserved scroll makes no
  // sense. First activeTab value is treated as the initial mount and does NOT scroll.
  const ref = useRef(null);
  const isFirstRun = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('mv-view');
    // Force reflow so the class re-addition restarts the animation
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth;
    el.classList.add('mv-view');
    // Scroll to top only on subsequent changes, never on first mount.
    if (scrollToTopOnChange && !isFirstRun.current) {
      // Use the scrolling root — our app scrolls the document, not an inner container.
      // behavior:auto (instant) feels more responsive than smooth for a tab switch, and
      // avoids fighting with the enter animation.
      if (typeof window !== 'undefined') {
        window.scrollTo({top:0, left:0, behavior:'auto'});
      }
    }
    isFirstRun.current = false;
  }, [activeTab]);
  return React.createElement('div', {ref, className:'mv-view'}, children);
}

function Sheet({open, onClose, title, children}) {
  // Cycle de vie d'une bottom sheet iOS premium :
  //
  //   IDLE (unmounted) ──open→true──→ ENTERING (CSS slide-up anim, 300ms)
  //          ↑                           │
  //          │                           ↓
  //   (unmount, after 300ms)         OPEN (idle, gestures active)
  //          │                           │
  //          │                  ┌────────┼────────┐
  //          │                  │        │        │
  //          │              drag <100   drag >100  tap X/backdrop
  //          │                  │        │        │
  //          │              RUBBER-RETURN  DISMISS-GLIDE
  //          │                  │        │        │
  //          │                  └────────┴────────┤
  //          │                                    ↓
  //          └────────────── CLOSING (CSS or JS slide-down, 280ms)
  //
  // Réouverture pendant CLOSING : annule timer, reset drag (dragY=0,
  // dragState='idle'), re-animation d'entrée. Pas de panel coincé en
  // bas ni de transform résiduel. C'est ce qui plantait avant.

  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef(null);
  const prefersReduced = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false, []);
  const exitMs = prefersReduced ? 120 : 300;

  // État de drag : 'idle' | 'dragging' | 'rubber-return' | 'dismiss-glide'
  const [dragY, setDragY] = useState(0);
  const [dragState, setDragState] = useState('idle');
  const dragRef = useRef({active:false, startY:0, lastY:0, lastT:0, vel:0});
  const releaseTimerRef = useRef(null);

  // RESET drag — utilisé à chaque changement d'état d'ouverture.
  // Indispensable pour éviter qu'un panel se retrouve translaté en bas
  // au moment d'une réouverture rapide.
  const resetDrag = useCallback(() => {
    setDragY(0);
    setDragState('idle');
    dragRef.current.active = false;
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  // Cycle ouverture/fermeture
  useEffect(() => {
    if (open) {
      // Annule un éventuel unmount en attente
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      // Reset état drag avant d'afficher — empêche le glitch panel-en-bas
      resetDrag();
      setClosing(false);
      setMounted(true);
    } else if (mounted) {
      // Démarre la fermeture si le panel n'est pas déjà en train de glisser
      // (sinon on laisse dismiss-glide finir et le useEffect repassera ici).
      if (dragState !== 'dismiss-glide') {
        setClosing(true);
      }
      closeTimerRef.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
        resetDrag();
        closeTimerRef.current = null;
      }, exitMs);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  // === Gestures drag-to-dismiss ===
  const onTouchStart = useCallback(e => {
    // Si on est en train de glisser/animer, on bloque le drag pour éviter
    // de capturer un touch pendant une animation de fermeture.
    if (dragState === 'dismiss-glide' || dragState === 'rubber-return') return;
    const t = e.touches[0];
    dragRef.current = {active:true, startY:t.clientY, lastY:t.clientY, lastT:Date.now(), vel:0};
    setDragState('dragging');
  }, [dragState]);

  const onTouchMove = useCallback(e => {
    if (!dragRef.current.active) return;
    const t = e.touches[0];
    const now = Date.now();
    const dy = Math.max(0, t.clientY - dragRef.current.startY);
    const dt = Math.max(1, now - dragRef.current.lastT);
    dragRef.current.vel = (t.clientY - dragRef.current.lastY) / dt;
    dragRef.current.lastY = t.clientY;
    dragRef.current.lastT = now;
    setDragY(dy);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!dragRef.current.active) return;
    const dy = dragY;
    const vel = dragRef.current.vel;
    dragRef.current.active = false;

    if (dy > 100 || vel > 0.6) {
      // Dismiss : on glisse le panel jusqu'en bas en JS, puis onClose.
      // Pas de conflit avec l'anim CSS .closing : on fait tout en transform.
      setDragState('dismiss-glide');
      // Calcule la cible : hauteur viewport (avec fallback)
      const target = (typeof window !== 'undefined' ? window.innerHeight : 800);
      setDragY(target);
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null;
        onClose();
        // resetDrag() sera appelé par le useEffect [open] quand open passe false
      }, 260);
    } else {
      // Rubber return : panel revient à 0 avec transition smooth
      setDragState('rubber-return');
      setDragY(0);
      releaseTimerRef.current = setTimeout(() => {
        setDragState('idle');
        releaseTimerRef.current = null;
      }, 280);
    }
  }, [dragY, onClose]);

  // Cleanup releaseTimer au unmount
  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    };
  }, []);

  if (!mounted) return null;

  // Style panel :
  // - dragging : transform direct sans transition (suit le doigt)
  // - rubber-return / dismiss-glide : transition cubic-bezier iOS
  // - idle : aucun style inline, l'anim CSS d'entrée/sortie prend le relais
  let panelStyle = null;
  if (dragState === 'dragging') {
    panelStyle = {transform:`translate3d(0,${dragY}px,0)`, transition:'none'};
  } else if (dragState === 'rubber-return' || dragState === 'dismiss-glide') {
    panelStyle = {
      transform: `translate3d(0,${dragY}px,0)`,
      transition: 'transform 260ms cubic-bezier(.32,.72,0,1)',
      animation: 'none'
    };
  }

  const backdropStyle = (dragState === 'dragging' && dragY > 0)
    ? {opacity: Math.max(0.2, 1 - dragY/300)}
    : (dragState === 'dismiss-glide')
      ? {opacity: 0, transition:'opacity 260ms cubic-bezier(.32,.72,0,1)'}
      : null;

  return h('div', {
      className:'sheet-backdrop' + (closing && dragState !== 'dismiss-glide' ? ' closing' : ''),
      onClick: onClose,
      style: backdropStyle
    },
    h('div', {
        className:'sheet' + (dragState==='dragging'?' dragging':''),
        onClick:e=>e.stopPropagation(),
        style: panelStyle
      },
      h('div', {
        onTouchStart, onTouchMove, onTouchEnd,
        style:{touchAction:'none', cursor:'grab', margin:'-8px -20px 0', padding:'8px 20px 0'}
      },
        h('div', {style:{display:'flex', alignItems:'center', justifyContent:'center', padding:'2px 0 8px'}},
          h('div', {className:'grip', style:{margin:0}})
        ),
        h('h3', {style:{margin:'4px 0 16px'}}, title,
          h('button', {className:'x press-icon',
            onClick: e => { e.stopPropagation(); onClose(); },
            onTouchStart: e => e.stopPropagation()
          }, ICONS.x))
      ),
      children
    )
  );
}

function ConfirmSheet({open, onClose, onConfirm, title, message, danger=true, confirmLabel}) {
  return h(Sheet, {open, onClose, title: title||'Confirmation'},
    h('p', {className:'body', style:{marginTop:0,marginBottom:16}}, message),
    h('div', {style:{display:'flex',gap:8}},
      h('button', {className:'btn btn-ghost', style:{flex:1}, onClick:onClose}, 'Annuler'),
      h('button', {className:'btn ' + (danger?'btn-danger':'btn-primary'), style:{flex:1}, onClick:()=>{ onConfirm(); onClose(); }}, confirmLabel || 'Confirmer')
    )
  );
}

/* --- Status bar + tab bar --- */
function StatusBarSpacer(){ return h('div', {style:{height:'var(--sa-t)'}}); }

const TAB_DEF = [
  {id:'dashboard', icon:ICONS.home, label:'Accueil'},
  {id:'journal', icon:ICONS.journal, label:'Journal'},
  {id:'progression', icon:ICONS.trend, label:'Progrès'},
  {id:'pesee', icon:ICONS.scale, label:'Pesée'},
  {id:'params', icon:ICONS.settings, label:'Params'}
];

function TabBar({tab, onTab}) {
  return h('nav', {className:'tabbar'},
    TAB_DEF.map(t => h('button', {
      key:t.id,
      className:tab===t.id?'active':'',
      onClick:()=>{ haptic('light'); onTab(t.id); }
    }, t.icon, h('span', null, t.label)))
  );
}

/* --- Header --- */
function Header({kicker, title, sub, right}) {
  return h('div', {className:'hd'},
    kicker && h('div', {className:'kicker'}, h('span',{className:'dot'}), kicker),
    h('div', {style:{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:10}},
      h('h1', null, title),
      right
    ),
    sub && h('div', {className:'meta-line'}, sub)
  );
}

/* --- Segment control --- */
function Segment({options, value, onChange}) {
  return h('div', {className:'seg'},
    options.map(opt => h('button', {
      key: opt.value,
      className: value===opt.value?'active':'',
      onClick: () => { haptic('light'); onChange(opt.value); }
    }, opt.label))
  );
}

/* --- Sparkline (SVG area + line) --- */
/**
 * Drives the Revolut-style chart entrance / morph animation.
 *
 * Returns: { progress, interpolate }
 *  - progress: number in [0, 1]. 0 = start of animation, 1 = final state.
 *  - interpolate(targetPts, opts): given the target points (with .y coords), returns
 *    an interpolated array of points. On first animation it grows from a flat baseline
 *    (mean Y of target points). On subsequent data changes it morphs from the previous
 *    rendered points to the new target.
 *
 * Options:
 *  - dataSig: a string that changes when the data changes (used to detect morph trigger).
 *  - animIn: play on first mount (true = yes).
 *  - animateOnChange: play again when dataSig changes (true = morph between old/new).
 *  - animDelay: ms to wait before starting.
 *  - animDuration: ms of the animation itself.
 */
/**
 * Count-up animation for integer KPIs. Runs once on mount (when `animate` is true)
 * and morphs to new values when `value` changes. Only sensible for integers — on
 * decimals it reads as gadget jitter, so we expose it behind an explicit component.
 *
 * Usage: h(AnimatedNumber, {value: 12, animate: true, duration: 900, delay: 200})
 *   -> renders the current interpolated integer value as a text node.
 */
function AnimatedNumber({value=0, animate=true, duration=800, delay=0, render=null}) {
  // render: optional fn (v: number) => string. If provided, formats the interpolated value.
  // Useful for decimals (store value*10 as int, format as (v/10).toFixed(1)).
  const [display, setDisplay] = useState(animate ? 0 : value);
  const rafRef = useRef(null);
  const prevValueRef = useRef(animate ? 0 : value);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;
    if (from === to) return;
    if (!animate) { setDisplay(to); prevValueRef.current = to; return; }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now() + delay;
    const ease = t => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / duration);
      const v = from + (to - from) * ease(t);
      setDisplay(Math.round(v));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setDisplay(to);
        prevValueRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [value]);

  return render ? render(display) : display;
}

function useMorphProgress({dataSig, animIn=true, animateOnChange=true, animDelay=0, animDuration=700, mode='auto'}) {
  // mode:
  //  - 'auto' (default): morph point-to-point when lengths match, grow-from-baseline otherwise
  //  - 'baseline': always grow-from-baseline on every animation (iOS Health style)
  //  - 'morph': always try point-to-point (falls back to baseline if incompatible)
  const [progress, setProgress] = useState(animIn ? 0 : 1);
  const rafRef = useRef(null);
  const prevPtsRef = useRef(null);
  const prevSmoothRef = useRef(null);
  const isFirstRender = useRef(true);
  const prevSigRef = useRef(dataSig);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  useEffect(() => {
    const isMount = isFirstRender.current;
    const sigChanged = prevSigRef.current !== dataSig;
    const shouldAnimate = (isMount && animIn) || (!isMount && animateOnChange && sigChanged);
    isFirstRender.current = false;
    prevSigRef.current = dataSig;

    if (!shouldAnimate) { setProgress(1); return; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(0);
    const start = performance.now() + animDelay;
    const ease = t => 1 - Math.pow(1 - t, 4); // ease-out-quart
    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < 0) { rafRef.current = requestAnimationFrame(tick); return; }
      const t = Math.min(1, elapsed / animDuration);
      setProgress(ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSig]);

  // Called in render to build interpolated points
  const interpolate = useCallback((targetPts, prevKey='line') => {
    if (progress >= 1) return targetPts;
    const ref = prevKey === 'smooth' ? prevSmoothRef.current : prevPtsRef.current;
    const canMorph = ref && ref.length === targetPts.length && mode !== 'baseline';
    if (!canMorph) {
      // Grow-from-baseline: flatten at mean Y of target
      const meanY = targetPts.reduce((a, p) => a + p.y, 0) / targetPts.length;
      return targetPts.map(p => ({...p, y: meanY + (p.y - meanY) * progress}));
    }
    return targetPts.map((p, i) => ({...p, y: ref[i].y + (p.y - ref[i].y) * progress}));
  }, [progress, mode]);

  // Store final points at animation end so subsequent morphs have a source
  const commit = useCallback((targetPts, smoothTargetPts=null) => {
    if (progress >= 1) {
      prevPtsRef.current = targetPts;
      prevSmoothRef.current = smoothTargetPts;
    }
  }, [progress]);

  return { progress, interpolate, commit };
}

/**
 * useChartScrubber — gère le scrubber tactile/souris sur un graphe SVG.
 * @param mapped — array de points {x, y, ...} en coords SVG
 * @param W — largeur SVG (viewBox)
 * @param ready — bool, doit être true pour activer (ex: animation finie)
 * Retourne {scrubIdx, activePt, handlers, containerRef} à brancher sur le wrapper.
 */
function useChartScrubber(mapped, W, ready) {
  const containerRef = useRef(null);
  const [scrubIdx, setScrubIdx] = useState(null);

  const handleMove = (clientX) => {
    if (!containerRef.current || !mapped?.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const xSvg = ratio * W;
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < mapped.length; i++) {
      const d = Math.abs(mapped[i].x - xSvg);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    setScrubIdx(bestI);
  };

  const handlers = {
    onTouchStart: (e) => { if (!ready) return; const t = e.touches[0]; if (t) handleMove(t.clientX); },
    onTouchMove: (e) => { if (!ready) return; const t = e.touches[0]; if (t) { handleMove(t.clientX); e.preventDefault(); } },
    onTouchEnd: () => setScrubIdx(null),
    onTouchCancel: () => setScrubIdx(null),
    onMouseDown: (e) => { if (ready) handleMove(e.clientX); },
    onMouseMove: (e) => { if (!ready || e.buttons === 0) return; handleMove(e.clientX); },
    onMouseLeave: () => setScrubIdx(null),
    onMouseUp: () => setScrubIdx(null)
  };

  const activePt = (scrubIdx !== null && mapped?.[scrubIdx]) ? mapped[scrubIdx] : null;
  return { scrubIdx, activePt, handlers, containerRef };
}

/** Format date court genre "15 mars" */
const fmtScrubDate = (iso) => {
  if (!iso) return '';
  const months = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
  const [y, m, d] = iso.split('-').map(n => parseInt(n));
  return parseInt(d) + ' ' + months[m-1];
};


function Sparkline({points, color='#FC4C02', height=40, showDots=false, showLastDot=true, goldDots=[], smoothed=false, smoothWindow=7, animIn=false, animDelay=0, animateOnChange=false, animDuration=700, scrubbable=false, valueLabel='', valueUnit='', valueFormat}) {
  // Early return guards
  if (!points?.length) return null;
  if (points.length === 1) {
    return h('div', {style:{height, display:'flex',alignItems:'center',color:'var(--ink-3)',fontSize:11}}, 'une seule donnée');
  }
  const vals = points.map(p => p.value);
  const smoothVals = smoothed ? vals.map((v, i) => {
    const w = Math.min(smoothWindow, i + 1);
    const slice = vals.slice(Math.max(0, i - w + 1), i + 1);
    return slice.reduce((a,x) => a + x, 0) / slice.length;
  }) : null;
  const allVals = smoothed ? [...vals, ...smoothVals] : vals;
  const min = Math.min(...allVals), max = Math.max(...allVals);
  const range = (max-min) || 1;
  const W = 100, H = height;
  const pad = 4;

  const ptsTarget = points.map((p,i) => ({
    x: pad + (i / (points.length-1)) * (W - 2*pad),
    y: pad + (1 - (p.value-min)/range) * (H - 2*pad),
    raw: p
  }));
  const smoothPtsTarget = smoothed ? smoothVals.map((sv, i) => ({
    x: pad + (i / (points.length-1)) * (W - 2*pad),
    y: pad + (1 - (sv-min)/range) * (H - 2*pad)
  })) : null;

  const dataSig = useMemo(() => points.map(p => p.value).join(','), [points]);
  const { progress, interpolate, commit } = useMorphProgress({dataSig, animIn, animateOnChange, animDelay, animDuration});

  const pts = interpolate(ptsTarget, 'line');
  const smoothPts = smoothPtsTarget ? interpolate(smoothPtsTarget, 'smooth') : null;

  useEffect(() => { commit(ptsTarget, smoothPtsTarget); }, [progress, dataSig]);

  const linePath = pts.map((p,i) => (i===0?'M':'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ');
  const smoothPath = smoothPts ? smoothPts.map((p,i) => (i===0?'M':'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ') : null;
  const areaPath = (smoothPath || linePath) + ` L${pts[pts.length-1].x},${H} L${pts[0].x},${H} Z`;
  const gradId = 'grad-' + color.replace('#','');
  const dotsOpacity = progress > .85 ? (progress - .85) / .15 : 0;

  // Scrubber (opt-in, pour grands sparklines uniquement)
  const scrubReady = false; // scrubber retiré du Sparkline — voir TonnageChart pour le tonnage
  const fmtVal = valueFormat || ((v) => v.toFixed(0));

  return h('svg', {
      className:'sparkline', viewBox:`0 0 ${W} ${H}`, preserveAspectRatio:'none',
      style:{height, width:'100%', display:'block'}},
    h('defs', null,
      h('linearGradient', {id:gradId, x1:0,y1:0,x2:0,y2:1},
        h('stop', {offset:'0%', stopColor:color, stopOpacity:.35}),
        h('stop', {offset:'100%', stopColor:color, stopOpacity:0})
      )
    ),
    h('path', {d: areaPath, fill:`url(#${gradId})`, style:{opacity: Math.min(1, progress * 1.2)}}),
    smoothed
      ? h('path', {d: linePath, stroke: color, strokeWidth:1, fill:'none', strokeLinecap:'round', strokeLinejoin:'round', strokeOpacity:.3 * progress, vectorEffect:'non-scaling-stroke'})
      : h('path', {d: linePath, stroke: color, strokeWidth:1.5, fill:'none', strokeLinecap:'round', strokeLinejoin:'round', vectorEffect:'non-scaling-stroke'}),
    smoothed && h('path', {d: smoothPath, stroke: color, strokeWidth:2, fill:'none', strokeLinecap:'round', strokeLinejoin:'round', vectorEffect:'non-scaling-stroke'}),
    goldDots.map((idx,i) => pts[idx] && h('circle', {key:'g'+i, cx:pts[idx].x, cy:pts[idx].y, r:2, fill:'#FFC233', stroke:'#10101C', strokeWidth:.8, opacity: dotsOpacity})),
    showLastDot && h('circle', {cx:pts[pts.length-1].x, cy:pts[pts.length-1].y, r:2.2, fill:color, stroke:'#10101C', strokeWidth:.8, opacity: dotsOpacity})
  );
}

/* --- TonnageChart : calqué exactement sur PeseeChart pour avoir le même comportement --- */
/* Note : reçoit `points` = [{date, value}] et l'affiche avec lissage et scrubber tactile */
function TonnageChart({points, period, dataSig}) {
  if (!points || points.length < 2) return null;
  const vs = points.map(p => p.value);
  const min = Math.min(...vs) * 0.92, max = Math.max(...vs) * 1.05;
  const range = (max - min) || 1;
  const W = 300, H = 100;
  // Lisse sur 5 jours pour atténuer les pics
  const smoothed = points.map((p, i) => {
    const w = Math.min(5, i + 1);
    const slice = points.slice(Math.max(0, i - w + 1), i + 1);
    const avg = slice.reduce((a, x) => a + x.value, 0) / slice.length;
    return { ...p, smooth: avg };
  });
  const targetPts = smoothed.map((p, i) => ({
    x: (i/(smoothed.length-1))*W,
    y: H - ((p.smooth - min)/range) * H * .9 - 5,
    p
  }));
  const rawTargetPts = smoothed.map((p, i) => ({
    x: (i/(smoothed.length-1))*W,
    y: H - ((p.value - min)/range) * H * .9 - 5,
    p
  }));

  const { progress, interpolate, commit } = useMorphProgress({
    dataSig,
    animIn: true,
    animateOnChange: true,
    animDelay: 120,
    animDuration: 800,
    mode: 'baseline'
  });

  const pts = interpolate(targetPts, 'line');
  const rawPts = interpolate(rawTargetPts, 'smooth');
  useEffect(() => { commit(targetPts, rawTargetPts); }, [progress, dataSig]);

  const line = pts.map((p,i) => (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const area = line + ` L${W},${H} L0,${H} Z`;
  const rawLine = rawPts.map((p,i) => (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const dotOpacity = progress > .85 ? (progress - .85) / .15 : 0;
  const CHART_HEIGHT = 90;
  const lastPt = pts[pts.length-1];

  // Scrubber
  const scrubReady = progress > .9 && targetPts.length > 0;
  const { scrubIdx, activePt, handlers, containerRef } = useChartScrubber(targetPts, W, scrubReady);

  return h('div', {
    ref: containerRef, ...handlers,
    style:{
      position:'relative', width:'100%', height: CHART_HEIGHT + 36, marginTop: 14,
      paddingTop: 36,
      touchAction: scrubReady ? 'pan-y' : 'auto',
      userSelect:'none', WebkitUserSelect:'none',
      cursor: scrubReady ? 'crosshair' : 'default'
    }
  },
    activePt && h('div', {
      style:{
        position:'absolute', top:0, left:0, right:0,
        display:'flex', alignItems:'baseline', gap:8, padding:'0 2px',
        fontVariantNumeric:'tabular-nums', pointerEvents:'none',
        animation:'fadeIn .12s ease-out'
      }
    },
      h('span', {style:{fontSize:11, color:'var(--ink-3)', fontWeight:600}}, fmtScrubDate(activePt.p.date)),
      h('span', {style:{fontSize:18, fontWeight:800, color:'var(--ink-0)', letterSpacing:'-0.02em'}},
        Math.round(activePt.p.smooth).toLocaleString('fr-FR')),
      h('span', {style:{fontSize:10, color:'var(--ink-3)', fontWeight:600}}, 'kg moy.'),
      h('span', {style:{fontSize:10, color:'var(--ink-2)', fontWeight:600, marginLeft:'auto'}},
        'jour : ' + Math.round(activePt.p.value).toLocaleString('fr-FR') + ' kg')
    ),
    h('svg', {
      viewBox:'0 0 300 100', preserveAspectRatio:'none',
      style:{width:'100%', height:CHART_HEIGHT, display:'block', pointerEvents:'none'}
    },
      h('defs', null,
        h('linearGradient', {id:'ton-grad', x1:0,y1:0,x2:0,y2:1},
          h('stop', {offset:'0%', stopColor:'#FC4C02', stopOpacity:.25}),
          h('stop', {offset:'100%', stopColor:'#FC4C02', stopOpacity:0}))),
      h('path', {d: rawLine, stroke:'rgba(252,76,2,.3)', strokeWidth:1, fill:'none', style:{opacity: progress}}),
      h('path', {d: area, fill:'url(#ton-grad)', style:{opacity: Math.min(1, progress * 1.2)}}),
      h('path', {d: line, stroke:'#FC4C02', strokeWidth:2, fill:'none', strokeLinecap:'round', vectorEffect:'non-scaling-stroke'}),
      activePt && h('line', {
        x1: activePt.x, x2: activePt.x, y1: 0, y2: H,
        stroke:'#FC4C02', strokeWidth:1, strokeDasharray:'3 3', strokeOpacity:0.5, vectorEffect:'non-scaling-stroke'
      })
    ),
    h('div', {style:{position:'absolute', left:0, right:0, top:36, height:CHART_HEIGHT, pointerEvents:'none'}},
      activePt
        ? h('div', {style:{
            position:'absolute',
            left: `calc(${(activePt.x/W)*100}% - 6px)`,
            top: `calc(${(activePt.y/H)*100}% - 6px)`,
            width:12, height:12, borderRadius:'50%',
            background:'#FC4C02', border:'2px solid #fff',
            boxShadow:'0 0 0 4px rgba(252,76,2,.25)',
            transform:'scale(1.05)',
            transition:'box-shadow .12s, transform .12s'
          }})
        : h('div', {style:{
            position:'absolute',
            left: `calc(${(lastPt.x/W)*100}% - 4px)`,
            top: `calc(${(lastPt.y/H)*100}% - 4px)`,
            width:8, height:8, borderRadius:'50%',
            background:'#FC4C02', border:'1.5px solid #10101C',
            opacity: dotOpacity
          }})
    )
  );
}

/* --- Progress ring --- */
function Ring({value, max, size=58, stroke=6, color='#FC4C02', label}) {
  const pct = max>0 ? Math.min(1, value/max) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return h('div', {className:'ring', style:{width:size, height:size, flex:`0 0 ${size}px`}},
    h('svg', {width:size, height:size},
      h('circle', {cx:size/2, cy:size/2, r, stroke:'var(--bg-3)', strokeWidth:stroke, fill:'none'}),
      h('circle', {cx:size/2, cy:size/2, r, stroke:color, strokeWidth:stroke, fill:'none',
        strokeDasharray:c, strokeDashoffset:off, strokeLinecap:'round',
        style:{transition:'stroke-dashoffset .6s var(--ease-ios)'}})
    ),
    h('div', {className:'pct'}, label || Math.round(pct*100)+'%')
  );
}

/* --- LWB Overlay (when PR) --- */
/**
 * PR celebration overlay — Light weight baby.
 *
 * Strava/Revolut/iOS Fitness-inspired staging:
 *  - Full-screen overlay, not a popup corner toast
 *  - 4-act sequential reveal (kicker → mascot + hero → context → CTA)
 *  - The weight is the hero (large gradient number like recap)
 *  - Mascot stays as signature element, badge-style above the hero
 *  - All-time PR = gold glow (bigger achievement), rep-PR = orange glow
 *  - Confetti bursts once at reveal, no loop
 *  - No auto-close. User dismisses via the CTA.
 *  - Haptic cues synced with reveals (success, medium, success)
 */
function LWBOverlay({pr, lib, onClose}) {
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const startClose = useCallback(() => {
    if (closing) return;
    haptic('light');
    setClosing(true);
    const t = setTimeout(() => onCloseRef.current(), 260);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!pr) return;
    setStep(0);
    setClosing(false);
    haptic('success');
    const timers = [
      setTimeout(() => setStep(1), 80),
      setTimeout(() => setStep(2), 380),
      setTimeout(() => { setStep(3); haptic('medium'); }, 700),
      setTimeout(() => setStep(4), 1100)
    ];
    return () => timers.forEach(clearTimeout);
  }, [pr]);

  // Confetti — single burst, 40 pieces. No loop. Only released once step >= 1.
  const confetti = useMemo(() => {
    if (!pr) return [];
    const colors = ['#FC4C02','#FF6B2C','#FFC233','#2FD27D','#5CC8FF','#FFDB66'];
    return Array.from({length: 40}, (_, i) => ({
      id: i,
      left: Math.random()*100,
      delay: Math.random()*.35,
      duration: 2.2 + Math.random()*1.4,
      color: colors[i%colors.length],
      drift: (Math.random()-.5)*36,
      size: 5 + Math.random()*6,
      rot: Math.random()*360,
      shape: i%3
    }));
  }, [pr?.exName, pr?.weight, pr?.reps]);

  if (!pr) return null;

  const isAllTime = pr.type === 'all-time';
  // All-Time = nouveau poids max. Rep PR = nouveau record de reps à ce poids exact.
  const typeLabel = isAllTime ? 'NOUVEAU RECORD' : 'RECORD DE REPS';
  const glowColor = isAllTime ? 'rgba(255,194,51,.28)' : 'rgba(252,76,2,.28)';
  const mascotGlow = isAllTime ? 'rgba(255,194,51,.5)' : 'rgba(252,76,2,.5)';

  const reveal = (visible, extraDelay=0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 500ms cubic-bezier(.32,.72,0,1) ${extraDelay}ms, transform 500ms cubic-bezier(.32,.72,0,1) ${extraDelay}ms`,
    willChange: 'transform, opacity'
  });

  return h('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9500,
      background: 'linear-gradient(180deg,#0A0610 0%,#050509 50%,#050509 100%)',
      overflow: 'hidden',
      opacity: closing ? 0 : 1,
      transition: 'opacity 260ms cubic-bezier(.4,0,.84,.34)',
      display: 'flex', flexDirection: 'column'
    }
  },
    // Glow at top — color varies with PR type
    h('div', {style: {
      position: 'absolute', top: -150, left: '50%', transform: 'translateX(-50%)',
      width: 700, height: 500, borderRadius: '50%',
      background: `radial-gradient(circle, ${glowColor} 0%, transparent 60%)`,
      pointerEvents: 'none', filter: 'blur(20px)',
      opacity: step >= 1 ? 1 : 0,
      transition: 'opacity 900ms ease-out'
    }}),

    // Confetti burst — released once at step >= 1, falls through, no loop
    h('div', {style: {position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2}},
      confetti.map(c => h('div', {
        key: c.id,
        style: {
          position: 'absolute', top: 0,
          left: c.left + '%',
          width: c.size, height: c.shape === 2 ? c.size * .4 : c.size,
          background: c.color,
          borderRadius: c.shape === 0 ? '50%' : (c.shape === 1 ? '2px' : '1px'),
          transform: `rotate(${c.rot}deg)`,
          animation: step >= 1 ? `confetti-fall ${c.duration}s cubic-bezier(.25,.46,.45,.94) ${c.delay}s forwards` : 'none',
          '--dr': c.drift + 'vw',
          boxShadow: `0 0 4px ${c.color}`,
          opacity: 0
        }
      }))
    ),

    // Main content — vertically centered, limited width
    h('div', {style: {
      position: 'relative', zIndex: 3, flex: 1,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      maxWidth: 540, margin: '0 auto', width: '100%',
      padding: 'calc(40px + env(safe-area-inset-top,0px)) 24px 20px'
    }},
      // Kicker — NOUVEAU RECORD / RECORD PAR REPS
      h('div', {style: Object.assign({
        fontSize: 11, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase',
        color: isAllTime ? '#FFC233' : '#FF6B2C',
        marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 8
      }, reveal(step >= 1))},
        h('span', {style: {width: 6, height: 6, borderRadius: '50%', background: isAllTime ? '#FFC233' : '#FF6B2C'}}),
        typeLabel
      ),

      // Mascot with type-aware glow
      h('div', {style: Object.assign({
        width: 140, height: 140, borderRadius: '50%',
        background: `radial-gradient(circle, ${mascotGlow} 0%, transparent 70%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18
      }, reveal(step >= 1, 60))},
        h('img', {
          src: __MASCOT__, alt: 'coach',
          style: {
            width: 120, height: 120, objectFit: 'contain',
            filter: `drop-shadow(0 0 20px ${mascotGlow})`,
            animation: 'float-up 3s cubic-bezier(.22,1,.36,1) infinite alternate'
          }
        })
      ),

      // Signature headline — Light weight baby (NO quotes, uppercase, gradient)
      h('div', {style: Object.assign({
        fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1,
        textAlign: 'center', textTransform: 'uppercase',
        background: 'linear-gradient(180deg,#FFC233 0%,#FC4C02 100%)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 28
      }, reveal(step >= 2))},
        'Light weight baby'
      ),

      // Hero weight — huge, gradient white
      h('div', {style: Object.assign({
        textAlign: 'center', marginBottom: 10
      }, reveal(step >= 2, 80))},
        h('span', {style: {
          fontSize: 88, fontWeight: 900, letterSpacing: '-0.06em', lineHeight: .9,
          fontVariantNumeric: 'tabular-nums',
          background: 'linear-gradient(180deg,#FFF 0%,#AAA8C8 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          display: 'inline-block'
        }}, pr.weight),
        h('span', {style: {
          fontSize: 22, fontWeight: 700, color: '#9CA0B5', marginLeft: 8, letterSpacing: '-0.02em'
        }}, 'kg')
      ),

      h('div', {style: Object.assign({
        fontSize: 15, color: '#9CA0B5', fontWeight: 500, marginBottom: 28, textAlign: 'center'
      }, reveal(step >= 2, 140))},
        pr.reps, ' rep', pr.reps > 1 ? 's' : ''
      ),

      // Context card — exo name, type explanation
      (() => {
        // Résolution du nom du modèle si présent
        const libEx = pr.exId && lib ? lib.find(l => l.id === pr.exId) : null;
        const modelName = pr.modelId && libEx?.models
          ? libEx.models.find(m => m.id === pr.modelId)?.name
          : null;
        return h('div', {style: Object.assign({
          padding: '14px 18px',
          background: isAllTime
            ? 'linear-gradient(160deg,rgba(255,194,51,.14) 0%,rgba(252,76,2,.06) 100%)'
            : 'linear-gradient(160deg,rgba(252,76,2,.14) 0%,rgba(252,76,2,.04) 100%)',
          border: isAllTime ? '1px solid rgba(255,194,51,.35)' : '1px solid rgba(252,76,2,.35)',
          borderRadius: 16, textAlign: 'center', minWidth: 240, maxWidth: '100%'
        }, reveal(step >= 3))},
          h('div', {style: {
            fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
            color: '#5D6077', marginBottom: 4
          }}, 'Exercice'),
          h('div', {style: {
            fontSize: 16, fontWeight: 800, color: '#FFF', letterSpacing: '-0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}, pr.exName),
          modelName && h('div', {style: {
            fontSize: 12, fontWeight: 600, color: '#FFC233', marginTop: 4, letterSpacing: '-0.01em'
          }}, modelName),
          h('div', {style: {
            fontSize: 11, color: '#9CA0B5', fontWeight: 500, marginTop: 6, letterSpacing: '-0.01em'
          }},
            isAllTime
              ? 'Charge jamais atteinte sur cet exercice'
              : 'Plus de reps que jamais à ' + pr.weight + ' kg')
        );
      })()
    ),

    // Fixed CTA at bottom — same pattern as SessionRecapFull
    h('div', {style: {
      position: 'relative', zIndex: 3,
      padding: '20px 20px calc(20px + env(safe-area-inset-bottom,0px))',
      background: 'linear-gradient(180deg,transparent 0%,rgba(5,5,9,.95) 40%,#050509 100%)'
    }},
      h('div', {style: Object.assign({maxWidth: 540, margin: '0 auto'}, reveal(step >= 4))},
        h('button', {
          className: 'btn btn-primary btn-full press-btn',
          onClick: startClose
        }, 'Continuer')
      )
    )
  );
}

/* --- Mascot (coach) reusable --- */
/**
 * Live session-duration ticker. Counts wall-clock time since `startedAt` and updates
 * every second. It's rendered in the persistent header (visible across all tabs) and
 * in the SessionLive hero, so the duration keeps counting even when the user navigates
 * to Dashboard, Progression, etc. — time tracked from start to finish, regardless of
 * which screen is visible.
 *
 * `startedAt` is a JS timestamp (ms). Format is compact: m:ss under 1h, h:mm:ss after.
 */
function SessionElapsed({startedAt, style={}, className=''}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    // Tick every second. Using Date.now() each tick means any "lost time" from tab
    // backgrounding / app suspension is recovered the moment the interval resumes.
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return null;
  const totalSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h_ = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const display = h_ > 0 ? `${h_}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  return h('span', {className, style:{fontVariantNumeric:'tabular-nums', ...style}}, display);
}

function Mascot({size=64, style={}, glow=false, float=false}) {
  return h('div', {
    style:{
      width:size, height:size, display:'inline-flex', alignItems:'center', justifyContent:'center',
      flexShrink:0, position:'relative',
      ...(glow ? {background:'radial-gradient(circle,var(--accent-glow),transparent 70%)', borderRadius:'50%'} : {}),
      // Float animation is paused for users who prefer reduced motion.
      // Kept infinite elsewhere but with gentler easing — see CSS keyframe float-up.
      ...(float ? {animation:'float-up 3s var(--ease-ios) infinite alternate'} : {}),
      ...style
    }
  },
    h('img', {
      src: __MASCOT__, alt:'coach', draggable:false,
      style:{
        width: glow ? size*.9 : size, height: glow ? size*.9 : size,
        objectFit:'contain', display:'block',
        filter: glow ? 'drop-shadow(0 0 16px rgba(252,76,2,.45))' : 'drop-shadow(0 4px 10px rgba(0,0,0,.4))'
      }
    })
  );
}

/* --- Chip with muscle group color --- */
const MG_COLOR = {
  Pectoraux:'#FC4C02', Dos:'#5CC8FF', Épaules:'#FFC233', Biceps:'#2FD27D', Triceps:'#FF6B2C',
  Quadriceps:'#BF5AF2', Ischios:'#FF3B48', Fessiers:'#FFDB66', Mollets:'#9CA0B5', Adducteurs:'#696980',
  Lombaires:'#696980', Abdos:'#E9E9F2', Autre:'#696980'
};

/* --- PickerSheet — remplace les <select> natifs moches --- */
function PickerSheet({open, onClose, title, options, value, onPick, search=false}) {
  const [q, setQ] = useState('');
  useEffect(() => { if (!open) setQ(''); }, [open]);
  const filtered = q ? options.filter(o => (o.label||'').toLowerCase().includes(q.toLowerCase())) : options;
  return h(Sheet, {open, onClose, title},
    search && h('input', {
      className:'input', style:{marginBottom:10}, placeholder:'Rechercher…',
      value:q, onChange:e=>setQ(e.target.value), autoFocus:true
    }),
    h('div', {style:{display:'flex',flexDirection:'column',gap:4, maxHeight:'55vh', overflowY:'auto'}},
      filtered.length ? filtered.map(opt => {
        const active = opt.value === value;
        return h('button', {
          key: opt.value,
          className:'press-row',
          onClick: () => { haptic('light'); onPick(opt.value); onClose(); },
          style:{
            display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'12px 14px', borderRadius:10, textAlign:'left',
            background: active ? 'var(--accent-wash)' : 'var(--bg-3)',
            border: active ? '1px solid rgba(252,76,2,.35)' : '1px solid transparent'
          }
        },
          h('div', null,
            h('div', {style:{fontSize:14,fontWeight:600,color:active?'var(--accent-hi)':'var(--ink-0)'}}, opt.label),
            opt.sub && h('div', {style:{fontSize:11,color:'var(--ink-3)',marginTop:2}}, opt.sub)),
          active && h('span', {style:{color:'var(--accent)'}}, ICONS.check)
        );
      }) : h('div', {className:'empty-state', style:{padding:24}}, h('div', {className:'sub'}, 'Aucun résultat'))
    )
  );
}

/* --- Volume bar (single row, progress bar) --- */
function VolumeBar({label, actual, target, compact=false}) {
  const pct = target > 0 ? Math.min(110, (actual/target)*100) : 0;
  const state = !target ? 'none' : actual >= target*1.1 ? 'over' : actual >= target ? 'done' : actual >= target*0.6 ? '' : 'under';
  const color = state==='done'||state==='over' ? 'var(--success)' : state==='under' ? 'var(--ink-4)' : 'var(--accent)';
  return h('div', {className:'volbar-row', style: compact ? {gridTemplateColumns:'62px 1fr 46px'} : null},
    h('span', {className:'name'}, label),
    h('div', {className:'track'}, h('div', {className:'fill '+state, style:{width: Math.min(100,pct)+'%', background:color}})),
    h('span', {className:'val', style: compact?{fontSize:10}:null},
      h('strong', null, actual), target ? '/' + target : '')
  );
}

/* --- Delta display --- */
function Delta({value, unit='kg', hideZero=false}) {
  if (value===null || value===undefined) return null;
  if (hideZero && Math.abs(value)<0.1) return h('span', {className:'delta flat'}, '—');
  const kind = Math.abs(value)<0.1 ? 'flat' : (value>0 ? 'up' : 'down');
  const sign = value>0 ? '+' : (value<0 ? '' : '±');
  return h('span', {className:'delta '+kind},
    kind==='up' && h('span', null, '▲ '),
    kind==='down' && h('span', null, '▼ '),
    sign + (Math.abs(value)>=10 ? value.toFixed(0) : value.toFixed(1)) + (unit?' '+unit:'')
  );
}

function DeltaPct({value, hideZero=false}) {
  if (value===null || value===undefined) return h('span',{className:'delta flat'},'—');
  if (hideZero && Math.abs(value)<0.5) return h('span', {className:'delta flat'}, '—');
  const kind = Math.abs(value)<0.5 ? 'flat' : (value>0 ? 'up' : 'down');
  const sign = value>0 ? '+' : '';
  return h('span', {className:'delta '+kind},
    kind==='up' && h('span', null, '▲ '),
    kind==='down' && h('span', null, '▼ '),
    sign + value.toFixed(1) + '%'
  );
}


/* ==========================================================================
   DASHBOARD — Surcharge progressive en hero + tous les KPI existants
   ========================================================================== */

const DASHBOARD_KPIS = {
  surcharge: {
    label: 'Surcharge progressive',
    shortLabel: 'Surcharge',
    compute: (ctx) => {
      const s = progressionSummary(ctx.journalLogs, ctx.exerciseLib, 28);
      return {
        big: s.up + '/' + s.total,
        unit: 'exos en progression',
        sub: s.prs + (s.prs>1?' nouveaux PR':' PR') + ' · ' + s.pct + '% du cycle',
        summary: s
      };
    }
  },
  muscle_progress: {
    label: 'Muscle qui progresse le plus',
    shortLabel: 'Top muscle',
    compute: (ctx) => {
      const ranked = muscleIndexSummary(ctx.journalLogs, ctx.exerciseLib, 28);
      if (!ranked.length) return { big:'—', unit:'', sub:'Pas assez de données (28j)', ranked:[] };
      const top = ranked[0];
      const sign = top.deltaPct >= 0 ? '+' : '';
      return {
        big: top.muscleGroup,
        unit: sign + top.deltaPct.toFixed(1) + ' %',
        sub: top.prs + (top.prs>1?' PR':' PR') + ' · ' + top.positives + '/' + top.exoCount + ' exos en hausse',
        ranked
      };
    }
  },
  tonnage: {
    label: 'Tonnage',
    shortLabel: 'Tonnage',
    compute: (ctx) => {
      const k = periodKPI(ctx.journalLogs, 7);
      const dp = deltaPct(k.curr.tonnage, k.prev.tonnage);
      return {
        big: formatNum(k.curr.tonnage/1000, 1),
        unit: 't · 7j',
        sub: dp!==null ? (dp>0?'▲':dp<0?'▼':'') + ' ' + Math.abs(dp).toFixed(1) + '% vs semaine précédente' : 'première semaine',
        deltaPct: dp
      };
    }
  },
  score: {
    label: 'Score d\'entraînement',
    shortLabel: 'Score',
    compute: (ctx) => {
      const k = periodKPI(ctx.journalLogs, 7);
      const dp = deltaPct(k.curr.score, k.prev.score);
      return {
        big: formatNum(k.curr.score, 0),
        unit: 'points · 7j',
        sub: dp!==null ? (dp>0?'▲':dp<0?'▼':'') + ' ' + Math.abs(dp).toFixed(1) + '% vs semaine précédente' : 'première semaine',
        deltaPct: dp
      };
    }
  },
  sessions: {
    label: 'Séances',
    shortLabel: 'Séances',
    compute: (ctx) => {
      const k = periodKPI(ctx.journalLogs, 7);
      const freq = ctx.currentProgram?.sessions?.length || 4;
      return {
        big: k.curr.sessions + '',
        unit: '/ ' + freq + ' · 7j',
        sub: k.curr.sets + ' séries · ' + formatDur(k.curr.duration),
        pct: freq>0 ? k.curr.sessions/freq : 0
      };
    }
  }
};

/**
 * Dashboard Séances card with an animated progress bar.
 *
 * The bar must animate once on mount (grow 0% → target%) and then STAY at the target.
 * The previous implementation used the Dashboard-level `animIn` state which flips to
 * false after ~1.4s, which caused the bar to animate back to 0%. Here we keep a local
 * `barFilled` state that flips to true after mount and never flips back, so the bar
 * stays filled for the lifetime of the card.
 */
function SessionsCard({animIn, pct, done, totalSessions, sessions, sets, duration}) {
  const [barFilled, setBarFilled] = useState(false);
  useEffect(() => {
    // Trigger the fill on next frame so the transition animates from 0 → pct
    const t = setTimeout(() => setBarFilled(true), 50);
    return () => clearTimeout(t);
  }, []);
  // When sessions value changes (e.g. a session was logged), the bar should animate
  // smoothly to the new pct — not reset to 0. Since `pct` is recalculated each render
  // and the bar style uses `barFilled ? pct : 0`, once barFilled is true a new pct just
  // triggers a smooth width transition. No extra handling needed.
  return h('div', {
    className: 'card sp-3' + (animIn ? ' mv-card-in' : ''),
    style: animIn ? {'--mv-d':'280ms'} : undefined
  },
    h('div', {className:'card-label'}, 'Séances'),
    h('div', null,
      h('div', {className: 'kpi-md' + (animIn ? ' mv-kpi-in' : ''), style: animIn ? {'--mv-d':'380ms'} : undefined},
        h(AnimatedNumber, {value: sessions, animate: animIn, duration: 700, delay: 420}),
        h('span',{className:'unit'}, '/ ' + totalSessions)),
      h('div', {style:{height:6, background:'var(--bg-3)', borderRadius:3, overflow:'hidden', marginTop:10, marginBottom:8}},
        h('div', {style:{
          height:'100%',
          width: barFilled ? pct + '%' : '0%',
          background: done
            ? 'linear-gradient(90deg,var(--pr-gold),#FFDB66)'
            : 'linear-gradient(90deg,var(--accent),var(--accent-hi))',
          borderRadius: 3,
          transition: 'width 900ms cubic-bezier(.32,.72,0,1)',
          transitionDelay: '520ms',
          boxShadow: done ? '0 0 8px rgba(255,194,51,.4)' : 'none'
        }})
      ),
      h('div', {className:'meta', style:{marginTop:2}}, sets + ' séries'),
      h('div', {className:'meta'}, formatDur(duration))
    )
  );
}

function Dashboard({state}) {
  const {journalLogs, exerciseLib, programs, currentProgram, currentProgramId, setTab, setCurrentProgramId} = state;
  const [heroKpi, setHeroKpi] = useState(() => LS.get('dash_hero', 'surcharge'));
  const [kpiPickerOpen, setKpiPickerOpen] = useState(false);
  useEffect(() => LS.set('dash_hero', heroKpi), [heroKpi]);

  // Entrance animations: one-shot on initial mount only. After ~1.1s, we drop the classes
  // so subsequent re-renders (e.g. when heroKpi changes or useMemos recompute) don't retrigger.
  // This also means tabbing away and returning to Dashboard won't replay — scroll is preserved
  // via ViewContainer and the content is already on screen.
  const [animIn, setAnimIn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimIn(false), 1200);
    return () => clearTimeout(t);
  }, []);
  // Helper: builds className + inline delay var for staggered entrance
  const fx = (base, cls, delay) => ({
    className: (base ? base + ' ' : '') + (animIn ? cls : ''),
    style: animIn && delay ? {'--mv-d': delay + 'ms'} : undefined
  });

  const ctx = { journalLogs, exerciseLib, programs, currentProgram };

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const actualVol = useMemo(() => weekActualVolume(journalLogs, exerciseLib, weekStart), [journalLogs, exerciseLib, weekStart]);
  const progSum = useMemo(() => progressionSummary(journalLogs, exerciseLib, 28), [journalLogs, exerciseLib]);
  const weekKPI = useMemo(() => periodKPI(journalLogs, 7), [journalLogs]);

  // streak: last 7 days session flags
  const streak = useMemo(() => {
    const days = [];
    for (let i=6; i>=0; i--) {
      const d = daysAgo(i);
      const id = iso(d);
      const has = journalLogs.some(l => l.date === id);
      days.push({
        iso: id,
        dow: DOW_FR_S[(d.getDay()+6)%7],
        today: i===0,
        done: has
      });
    }
    return days;
  }, [journalLogs]);

  // top exo (score) last 7 days
  const topExo = useMemo(() => {
    const map = {};
    weekKPI.rawSessions.forEach(s => (s.exercises||[]).forEach(ex => {
      const sc = exoScore(ex);
      if (sc > 0) map[ex.exName||'?'] = (map[ex.exName||'?']||0) + sc;
    }));
    const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]);
    return sorted[0] || null;
  }, [weekKPI]);

  // last PR
  const lastPR = useMemo(() => {
    const sorted = [...journalLogs].sort((a,b) => (b.date||'').localeCompare(a.date||''));
    for (const s of sorted) if (s.prs?.length) return { pr: s.prs[0], date: s.date };
    return null;
  }, [journalLogs]);

  // daily heatmap 7d
  const daysHeat = useMemo(() => {
    const days = [];
    for (let i=6; i>=0; i--) {
      const d = daysAgo(i);
      const id = iso(d);
      const sessions = journalLogs.filter(l => l.date === id);
      const setsCount = sessions.reduce((a,s) => a + setsCountSession(s), 0);
      days.push({ iso:id, dow:DOW_FR_S[(d.getDay()+6)%7], dom:d.getDate(), count:sessions.length, sets:setsCount });
    }
    return days;
  }, [journalLogs]);

  // hero KPI computation
  const hero = DASHBOARD_KPIS[heroKpi].compute(ctx);

  // volume program (target)
  const volTargets = currentProgram?.volumeTargets?.program || {};
  const volEntries = Object.entries(actualVol).filter(([g,v])=>v>0);
  state.muscleGroups.forEach(g => {
    if (volTargets[g] && !actualVol[g]) volEntries.push([g, 0]);
  });
  volEntries.sort((a,b) => {
    const ta = volTargets[a[0]]||0, tb = volTargets[b[0]]||0;
    if (ta !== tb) return tb - ta;
    return b[1] - a[1];
  });

  // user name
  const userName = LS.get('user_name', '');
  const activeSession = state.activeSession;

  return h('div', {className:'app-body'},
    h('div', {style:{display:'flex',alignItems:'flex-start',gap:12,marginBottom:20}},
      h(Mascot, {size:56}),
      h('div', {style:{flex:1,minWidth:0}},
        h('div', {className:'hd', style:{marginBottom:0}},
          h('div', {className:'kicker'}, h('span',{className:'dot'}),
            'Cette semaine · ' + formatDate(iso(weekStart)) + ' → ' + formatDate(iso(new Date(weekStart.getTime()+6*86400000)))),
          h('div', {style:{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:10}},
            h('h1', {style:{margin:0,fontSize:28,fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.05,color:'var(--ink-0)'}},
              userName ? `Salut ${userName}.` : 'Ton training.'),
            programs.length > 1 && h('button', {
              className:'chip primary pressable',
              style:{padding:'6px 10px',fontSize:11,fontWeight:700},
              onClick:()=>{ const idx=programs.findIndex(p=>p.id===currentProgramId); setCurrentProgramId(programs[(idx+1)%programs.length].id); haptic('light'); }
            }, currentProgram?.name || 'Programme')
          ),
          journalLogs.length === 0 && h('div', {className:'meta-line'}, 'Aucune séance encore. Va au Journal pour démarrer.')
        )
      )
    ),

    /* HERO KPI CARD */
    h('div', {
      className: 'card feat' + (animIn ? ' mv-card-in' : ''),
      style: {marginBottom:10, ...(animIn ? {'--mv-d':'60ms'} : {})},
      onClick:()=>setKpiPickerOpen(true)
    },
      h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}},
        h('div', {className:'card-label'},
          h('span',{className:'bullet'}),
          DASHBOARD_KPIS[heroKpi].label
        ),
        h('button', {className:'chip pressable', style:{fontSize:10}, onClick:(e)=>{e.stopPropagation(); setKpiPickerOpen(true);}},
          'Changer', h('span',{style:{marginLeft:4,display:'inline-flex',alignItems:'center'}}, ICONS.chevDown))
      ),
      h('div', {style:{display:'flex',alignItems:'baseline',gap:10,marginTop:4}},
        h('div', {
          className: 'hero-num' + (animIn ? ' mv-kpi-in' : ''),
          style: animIn ? {'--mv-d':'180ms'} : undefined
        }, hero.big),
        h('div', {className:'unit', style:{fontSize:16,marginLeft:2}}, hero.unit)
      ),
      h('div', {className:'body-sm', style:{marginTop:8, color:'var(--ink-2)'}}, hero.sub),

      /* Hero visual based on KPI */
      heroKpi === 'surcharge' ? h(SurchargeDetail, {summary: progSum, setTab}) :
      heroKpi === 'muscle_progress' ? h(MuscleProgressDetail, {ranked: hero.ranked || []}) :
      heroKpi === 'tonnage' ? h(WeekTonnageSpark, {journalLogs}) :
      heroKpi === 'score' ? h(WeekScoreBars, {journalLogs}) :
      heroKpi === 'sessions' ? h(StreakBarsInline, {days:streak, goal:currentProgram?.sessions?.length||4}) :
      null
    ),

    /* BENTO: streak + sessions ring + PR + top exo */
    h('div', {className:'bento', style:{marginTop:10}},
      h('div', {
        className: 'card sp-3' + (animIn ? ' mv-card-in' : ''),
        style: animIn ? {'--mv-d':'240ms'} : undefined
      },
        h('div', {className:'card-label'}, 'Streak 7j'),
        h('div', {className: 'kpi-lg' + (animIn ? ' mv-kpi-in' : ''), style: animIn ? {'--mv-d':'340ms'} : undefined},
          h(AnimatedNumber, {value: streak.filter(d=>d.done).length, animate: animIn, duration: 700, delay: 380}), h('span',{className:'unit'}, '/ 7')),
        h('div', {className:'streak-row'},
          streak.map((d, i) => h('div', {
            key:d.iso,
            className:'bar' + (d.done?' done':'') + (d.today && !d.done?' today':'') + (animIn ? ' mv-grow-up' : ''),
            style: animIn ? {'--mv-d': (360 + i*40) + 'ms'} : undefined,
            title: d.iso
          }))
        ),
        h('div', {className:'streak-row-labels'},
          streak.map(d => h('span', {key:d.iso}, d.dow.charAt(0)))
        )
      ),

      (() => {
        const totalSessions = currentProgram?.sessions?.length || 4;
        const pct = Math.min(100, (weekKPI.curr.sessions / totalSessions) * 100);
        const done = pct >= 100;
        return h(SessionsCard, {
          animIn, pct, done, totalSessions,
          sessions: weekKPI.curr.sessions, sets: weekKPI.curr.sets, duration: weekKPI.curr.duration
        });
      })(),

      h('div', {
        className: 'card pr sp-3' + (animIn ? ' mv-card-in' : ''),
        style: animIn ? {'--mv-d':'320ms'} : undefined
      },
        h('div', {className:'card-label gold'}, h('span',{className:'bullet'}), 'Records'),
        h('div', {className: 'kpi-lg' + (animIn ? ' mv-kpi-in' : ''), style: {color:'var(--pr-gold)', ...(animIn ? {'--mv-d':'420ms'} : {})}},
          h(AnimatedNumber, {value: weekKPI.curr.prs, animate: animIn, duration: 700, delay: 460})),
        h('div', {className:'body-sm', style:{marginTop:6}},
          weekKPI.curr.prs > 0 ? 'cette semaine' : (lastPR ? 'dernier ' + formatRelative(lastPR.date) : 'aucun pour le moment')
        )
      ),

      h('div', {
        className: 'card sp-3' + (animIn ? ' mv-card-in' : ''),
        style: animIn ? {'--mv-d':'360ms'} : undefined
      },
        h('div', {className:'card-label'}, 'Tonnage 7j'),
        h('div', {className: 'kpi-lg' + (animIn ? ' mv-kpi-in' : ''), style: animIn ? {'--mv-d':'460ms'} : undefined},
          formatNum(weekKPI.curr.tonnage/1000, 1), h('span',{className:'unit'}, 't')),
        h('div', {style:{marginTop:6}}, h(DeltaPct, {value: deltaPct(weekKPI.curr.tonnage, weekKPI.prev.tonnage)}))
      ),

      /* Top exo */
      topExo && h('div', {
        className: 'card sp-6' + (animIn ? ' mv-card-in' : ''),
        style: animIn ? {'--mv-d':'400ms'} : undefined
      },
        h('div', {className:'card-label'}, h('span',{className:'bullet'}), 'Exo du moment'),
        h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}},
          h('div', null,
            h('div', {className:'title-md'}, topExo[0]),
            h('div', {className:'body-sm', style:{marginTop:4}}, 'Score ', formatNum(topExo[1]), ' pts')
          )
        )
      ),

      /* Muscle qui progresse le plus (sur 28j) */
      (function(){
        const muscleProgs = muscleIndexSummary(journalLogs, exerciseLib, 28);
        if (!muscleProgs.length) return null;
        const top = muscleProgs[0];
        const positive = top.deltaPct >= 0;
        const positivesRate = top.exoCount > 0 ? top.positives / top.exoCount : 0;
        return h('div', {className:'card sp-6 pressable',
          onClick: () => setTab('progression')},
          h('div', {className:'card-label', style:{display:'flex',justifyContent:'space-between'}},
            h('span', null, h('span',{className:'bullet'}), 'Muscle qui progresse'),
            h('span', {style:{color:'var(--ink-3)',textTransform:'none',letterSpacing:0,fontSize:11}}, '28 j')
          ),
          h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}},
            h('div', null,
              h('div', {className:'title-md'}, top.muscleGroup),
              h('div', {className:'body-sm', style:{marginTop:4}},
                (positive ? '+' : '') + top.deltaPct.toFixed(1) + '% · ',
                top.exoCount + ' exo' + (top.exoCount>1?'s':''),
                top.prs > 0 ? ' · ' + top.prs + ' PR' : '')),
            h('div', {style:{textAlign:'right'}},
              h('div', {style:{fontSize:24,fontWeight:800,color:positive?'var(--success)':'var(--ink-3)',fontVariantNumeric:'tabular-nums'}},
                Math.round(positivesRate*100) + '%'),
              h('div', {className:'meta'}, 'exos en hausse'))
          ),
          /* Top 3 */
          muscleProgs.length > 1 && h('div', {style:{marginTop:10,paddingTop:10,borderTop:'1px solid var(--line)',display:'flex',flexDirection:'column',gap:4}},
            muscleProgs.slice(1, 4).map(m => h('div', {key:m.muscleGroup,
              style:{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}},
              h('span', {style:{fontWeight:600,color:'var(--ink-1)'}}, m.muscleGroup),
              h('span', {style:{fontVariantNumeric:'tabular-nums',color:m.deltaPct>=0?'var(--success)':'var(--ink-3)',fontWeight:700}},
                (m.deltaPct>=0?'+':'') + m.deltaPct.toFixed(1) + '%'))))
        );
      })(),

      /* Volume per muscle (program targets) */
      volEntries.length > 0 && h('div', {className:'card sp-6'},
        h('div', {className:'card-label', style:{justifyContent:'space-between',display:'flex'}},
          h('span', null, h('span',{className:'bullet'}), ' Volume cible · hebdo'),
          h('span', {style:{color:'var(--ink-3)',textTransform:'none',letterSpacing:0,fontSize:11}},
            'jour ' + (((new Date().getDay()+6)%7)+1) + '/7')
        ),
        h('div', {className:'volbar'},
          volEntries.map(([g, actual]) => {
            const target = volTargets[g] || 0;
            const pct = target > 0 ? Math.min(100, (actual/target)*100) : 0;
            const state = target===0 ? 'under' : actual>=target ? (actual>target*1.1 ? 'over' : 'done') : actual>=target*0.5 ? '' : 'under';
            return h('div', {key:g, className:'volbar-row'},
              h('span', {className:'name'}, g),
              h('div', {className:'track'},
                h('div', {className:'fill '+state, style:{width: pct+'%'}})
              ),
              h('span', {className:'val'},
                h('strong', null, actual),
                target ? ' / ' + target : '')
            );
          })
        )
      )
    ),

    /* KPI picker sheet */
    h(Sheet, {open: kpiPickerOpen, onClose:()=>setKpiPickerOpen(false), title: 'KPI principal'},
      h('p', {className:'body-sm', style:{marginTop:0,marginBottom:14,color:'var(--ink-2)'}},
        'Choisis le KPI affiché en hero. Les autres restent visibles en cartes.'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:8}},
        Object.entries(DASHBOARD_KPIS).map(([k, def]) => {
          const active = heroKpi === k;
          const val = def.compute(ctx);
          return h('button', {
            key:k,
            className:'pressable',
            onClick:()=>{ setHeroKpi(k); haptic('light'); setKpiPickerOpen(false); },
            style:{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 16px', borderRadius:12, textAlign:'left',
              background: active ? 'var(--accent-wash)' : 'var(--bg-3)',
              border: active ? '1px solid rgba(252,76,2,.4)' : '1px solid var(--line)'
            }
          },
            h('div', null,
              h('div', {style:{fontSize:14,fontWeight:700,color:active?'var(--accent-hi)':'var(--ink-0)'}}, def.label),
              h('div', {style:{fontSize:12,fontWeight:500,color:'var(--ink-2)',marginTop:2}},
                val.big + ' ' + val.unit)
            ),
            active && h('span', {style:{color:'var(--accent)'}}, ICONS.check)
          );
        })
      )
    )
  );
}

/* --- Surcharge progressive detail shown in hero card --- */
function SurchargeDetail({summary, setTab}) {
  if (summary.total === 0) {
    return h('div', {style:{marginTop:12,padding:14,background:'rgba(255,255,255,.02)',borderRadius:10,fontSize:12,color:'var(--ink-3)',textAlign:'center'}},
      'Fais au moins 2 séances sur les mêmes exos pour voir ta surcharge progressive');
  }
  const top = summary.items.slice(0, 4);
  return h('div', {style:{marginTop:16, display:'flex', flexDirection:'column', gap:6}},
    top.map(it => {
      // Icône + couleur : prioriser le statut PR sur la tendance
      let color, icon;
      if (it.hasAllTimePR) {
        color = 'var(--pr-gold)';
        icon = ICONS.trophy;
      } else if (it.hasRepPRonly) {
        color = 'var(--accent-hi)';
        icon = ICONS.trophy;
      } else if (it.kind === 'up') {
        color = 'var(--success)';
        icon = ICONS.up;
      } else if (it.kind === 'down') {
        color = 'var(--ink-3)';
        icon = ICONS.chevDown;
      } else {
        color = 'var(--ink-3)';
        icon = null;
      }
      return h('div', {key:it.key, style:{display:'grid',gridTemplateColumns:'16px 1fr auto',gap:10,alignItems:'center',padding:'4px 2px'}},
        h('span', {style:{color, display:'inline-flex'}}, icon),
        h('span', {style:{fontSize:13, fontWeight:600, color:'var(--ink-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}, it.name),
        h('span', {style:{fontSize:12, fontWeight:700, color, fontVariantNumeric:'tabular-nums'}},
          (it.deltaPct >= 0 ? '+' : '') + it.deltaPct.toFixed(1) + '%')
      );
    }),
    summary.items.length > 4 && h('button', {
      className:'pressable',
      onClick:()=>setTab && setTab('progression'),
      style:{fontSize:11, fontWeight:700, color:'var(--accent-hi)', textTransform:'uppercase', letterSpacing:'.08em', marginTop:8, textAlign:'left'}
    }, 'voir les ' + (summary.items.length - 4) + ' autres →')
  );
}

/* --- Muscle progress ranking visual for hero --- */
function MuscleProgressDetail({ranked}) {
  if (!ranked || ranked.length === 0) {
    return h('div', {style:{marginTop:12,padding:14,background:'rgba(255,255,255,.02)',borderRadius:10,fontSize:12,color:'var(--ink-3)',textAlign:'center'}},
      'Pas encore assez de données pour classer les muscles');
  }
  const top = ranked.slice(0, 5);
  const maxAbs = Math.max(...top.map(m => Math.abs(m.deltaPct)), 0.5);
  return h('div', {style:{marginTop:16, display:'flex', flexDirection:'column', gap:8}},
    top.map((m, i) => {
      const positive = m.deltaPct >= 0;
      const color = m.prs > 0 ? 'var(--pr-gold)' : (positive ? 'var(--accent)' : 'var(--ink-3)');
      const pct = Math.min(100, Math.abs(m.deltaPct) / maxAbs * 100);
      return h('div', {key:m.muscleGroup, style:{display:'flex',flexDirection:'column',gap:4}},
        h('div', {style:{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:10,alignItems:'center'}},
          h('span', {style:{fontSize:10,fontWeight:700,color:'var(--ink-3)',width:14}}, '#'+(i+1)),
          h('span', {style:{fontSize:13, fontWeight:700, color:'var(--ink-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}},
            m.muscleGroup,
            m.prs > 0 && h('span', {style:{marginLeft:6,fontSize:10,color:'var(--pr-gold)',fontWeight:800}}, m.prs + ' PR')),
          h('span', {style:{fontSize:12, fontWeight:800, color, fontVariantNumeric:'tabular-nums'}},
            (positive?'+':'') + m.deltaPct.toFixed(1) + '%')),
        h('div', {style:{height:4,borderRadius:2,background:'var(--bg-3)',overflow:'hidden'}},
          h('div', {style:{height:'100%',width:pct+'%',background:color,transition:'width .3s var(--ease-ios)'}})),
        h('div', {className:'meta', style:{marginTop:0,fontSize:10}},
          m.positives + '/' + m.exoCount + ' exos en hausse · progression sur 28j')
      );
    })
  );
}

/* --- Week tonnage sparkline visual for hero --- */
function WeekTonnageSpark({journalLogs}) {
  const pts = [];
  for (let i=13; i>=0; i--) {
    const d = daysAgo(i);
    const id = iso(d);
    const daySessions = journalLogs.filter(l => l.date === id);
    const tonnage = daySessions.reduce((a,s)=>a+tonnageSession(s),0);
    pts.push({ date:id, value: tonnage });
  }
  return h('div', {style:{marginTop:12}},
    h(Sparkline, {points: pts, color:'#FC4C02', height:48, animIn:true, animDelay:200, animateOnChange:true, animDuration:800, showLastDot:false}),
    h('div', {style:{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:'var(--ink-3)',fontWeight:600,letterSpacing:'.05em'}},
      h('span', null, 'J-13'), h('span', null, 'J-7'), h('span', null, "Aujourd'hui"))
  );
}

function WeekScoreBars({journalLogs}) {
  const days = [];
  for (let i=6; i>=0; i--) {
    const d = daysAgo(i);
    const id = iso(d);
    const daySessions = journalLogs.filter(l => l.date === id);
    const score = daySessions.reduce((a,s)=>a+scoreSession(s),0);
    days.push({ iso:id, dow:DOW_FR_S[(d.getDay()+6)%7], value: score });
  }
  const max = Math.max(...days.map(d=>d.value), 1);
  // animIn on mount: each bar grows from 0 with a small stagger
  return h('div', {style:{marginTop:12,display:'flex',alignItems:'flex-end',gap:4,height:48}},
    days.map((d, i) => h('div', {key:d.iso, style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%'}},
      h('div', {style:{
        flex:1, width:'100%', display:'flex', alignItems:'flex-end', justifyContent:'center'
      }},
        h('div', {
          className:'mv-grow-up',
          style:{
            width:'70%',
            height: Math.max(3, (d.value/max)*100) + '%',
            background: d.value>0 ? 'linear-gradient(180deg,#FF6B2C,#FC4C02)' : 'var(--bg-3)',
            borderRadius:'3px 3px 2px 2px',
            transition:'height .4s var(--ease-ios)',
            '--mv-d': (200 + i*50) + 'ms'
          }})
      ),
      h('span', {style:{fontSize:9,fontWeight:700,color:'var(--ink-3)',letterSpacing:'.05em'}}, d.dow.charAt(0))
    ))
  );
}

function StreakBarsInline({days, goal}) {
  return h('div', {style:{marginTop:12}},
    h('div', {className:'streak-row'},
      days.map((d, i) => h('div', {
        key:d.iso,
        className:'bar mv-grow-up' + (d.done?' done':'') + (d.today && !d.done?' today':''),
        style:{'--mv-d': (200 + i*40) + 'ms'}
      }))
    )
  );
}


/* ==========================================================================
   JOURNAL — picker + history + SESSION LIVE
   ========================================================================== */

function Journal({state}) {
  const {journalLogs, programs, currentProgram, currentProgramId, setCurrentProgramId, exerciseLib, activeSession, setActiveSession} = state;
  const [detailLog, setDetailLog] = useState(null);
  const [deleteLogConfirm, setDeleteLogConfirm] = useState(null);
  const [otherPickerOpen, setOtherPickerOpen] = useState(false);
  const [confirmStartSession, setConfirmStartSession] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(() => {
    const now = new Date();
    return new Set([`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`]);
  });
  const [recapLog, setRecapLog] = useState(null);
  // Édition de note de séance future : {session, draft}
  const [noteEdit, setNoteEdit] = useState(null);
  // Force un re-render après save de note (les notes sont en LS, pas dans le state React)
  const [noteVersion, setNoteVersion] = useState(0);

  const openNoteEditor = (sess) => {
    const existing = getSessionNote(currentProgram?.id, sess.id);
    setNoteEdit({ session: sess, draft: existing?.text || '' });
  };
  const saveNote = () => {
    if (!noteEdit) return;
    setSessionNote(currentProgram?.id, noteEdit.session.id, noteEdit.draft);
    setNoteEdit(null);
    setNoteVersion(v => v + 1);
    haptic('success');
  };

  if (activeSession) {
    return h(SessionLive, {
      state, session: activeSession,
      onSave: (log) => {
        state.setJournalLogs([...journalLogs, log]);
        setActiveSession(null);
        setRecapLog(log);
      },
      onDiscard: () => setActiveSession(null),
      onPause: () => state.setTab('dashboard'),  // retour sans effacer la séance — header persistant prend le relais
      onUpdate: (updated) => setActiveSession(updated)
    });
  }

  if (!currentProgram) {
    return h('div', {className:'app-body'},
      h(Header, {title:'Journal.'}),
      h('div', {className:'empty-state'},
        h(Mascot, {size:120, float:true, style:{marginBottom:16}}),
        h('div', {className:'title'}, 'Pas de programme actif'),
        h('div', {className:'sub'}, 'Va dans Paramètres pour créer un programme et ses séances.'),
        h('button', {className:'btn btn-primary', style:{marginTop:16}, onClick:()=>state.setTab('params')},
          'Aller aux paramètres')
      )
    );
  }

  const recommended = recommendedSession(currentProgram, journalLogs);
  const otherSessions = (currentProgram.sessions||[]).filter(s => s.id !== recommended?.id);

  // Historique groupé par mois
  const sortedLogs = [...journalLogs].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const monthsMap = new Map();
  sortedLogs.forEach(log => {
    const key = (log.date||'').slice(0,7);
    if (!monthsMap.has(key)) monthsMap.set(key, []);
    monthsMap.get(key).push(log);
  });
  const months = [...monthsMap.entries()];

  const monthLabel = (ym) => {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    return (MONTHS_FR ? MONTHS_FR[parseInt(m)-1] : m) + ' ' + y;
  };

  const toggleMonth = (ym) => {
    const next = new Set(expandedMonths);
    if (next.has(ym)) next.delete(ym); else next.add(ym);
    setExpandedMonths(next);
  };

  return h('div', {className:'app-body'},
    h(Header, {
      kicker: iso(new Date()).split('-').reverse().join('-') + ' · ' + DOW_FR[(new Date().getDay()+6)%7],
      title: 'Prochaine séance.',
      right: programs.length > 1 ? h('button', {
        className:'chip primary pressable',
        onClick:()=>{ const idx=programs.findIndex(p=>p.id===currentProgramId); setCurrentProgramId(programs[(idx+1)%programs.length].id); haptic('light'); }
      }, currentProgram.name) : null
    }),

    recommended && h(SessionCard, {
      key: 'rec-' + noteVersion,
      session: recommended, program: currentProgram, journalLogs, lib: exerciseLib,
      recommended: true,
      onStart: () => startSession(recommended, currentProgram, exerciseLib, journalLogs, setActiveSession),
      onEditNote: openNoteEditor
    }),

    otherSessions.length > 0 && h('button', {
      className:'btn btn-ghost btn-full pressable', style:{marginTop:12},
      onClick: () => setOtherPickerOpen(true)
    }, ICONS.plus, ' Autre séance du programme'),

    h(Sheet, {open: otherPickerOpen, onClose:()=>setOtherPickerOpen(false), title:'Choisir une séance'},
      h('div', {key: 'other-' + noteVersion, style:{display:'flex',flexDirection:'column',gap:6}},
        otherSessions.map(s => {
          const lastLog = journalLogs.filter(l => l.sessionId === s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
          const daysAgo = lastLog ? Math.floor((Date.now() - new Date(lastLog.date).getTime())/86400000) : null;
          const sNote = getSessionNote(currentProgram?.id, s.id);
          return h('div', {key:s.id,
            style:{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,background:'var(--bg-3)'}
          },
            h('button', {
              className:'press-row',
              style:{display:'flex',justifyContent:'space-between',alignItems:'center',flex:1,textAlign:'left',background:'transparent',minWidth:0},
              onClick:()=>{ setOtherPickerOpen(false); setConfirmStartSession(s); }
            },
              h('div', {style:{minWidth:0}},
                h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)'}}, s.name),
                h('div', {className:'meta', style:{marginTop:2}},
                  (s.exercises||[]).length + ' exos' + (daysAgo !== null ? ` · il y a ${daysAgo}j` : ' · jamais faite')
                  + (sNote ? ' · note ✎' : ''))),
              h('span', {style:{color:'var(--accent)',flex:'0 0 auto'}}, ICONS.right)),
            h('button', {
              className:'press-icon',
              onClick: () => { setOtherPickerOpen(false); openNoteEditor(s); },
              style:{
                flex:'0 0 auto', width:32, height:32, borderRadius:8,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: sNote ? 'var(--accent-wash)' : 'var(--bg-2)',
                color: sNote ? 'var(--accent-hi)' : 'var(--ink-3)'
              }
            }, ICONS.edit)
          );
        })
      )
    ),

    /* Sheet édition note de séance future */
    h(Sheet, {
      open: !!noteEdit, onClose: () => setNoteEdit(null),
      title: noteEdit ? 'Note · ' + noteEdit.session.name : 'Note'
    },
      noteEdit && h('div', null,
        h('p', {className:'body-sm', style:{marginTop:0, marginBottom:12, color:'var(--ink-2)'}},
          'Cette note s\'affichera au lancement de la séance. Elle reste jusqu\'à ce que tu la supprimes.'),
        h('textarea', {
          className:'input',
          value: noteEdit.draft,
          onChange: e => setNoteEdit({...noteEdit, draft: e.target.value}),
          placeholder: 'Écris ta note ici…',
          rows: 4,
          style:{resize:'none', minHeight:100, lineHeight:1.5, fontFamily:'var(--f-sans)'}
        }),
        h('div', {style:{display:'flex', gap:8, marginTop:16}},
          getSessionNote(currentProgram?.id, noteEdit.session.id) && h('button', {
            className:'btn btn-ghost pressable',
            style:{flex:'0 0 auto', color:'var(--danger)'},
            onClick: () => {
              clearSessionNote(currentProgram?.id, noteEdit.session.id);
              setNoteEdit(null); setNoteVersion(v => v+1); haptic('light');
            }
          }, ICONS.trash),
          h('button', {className:'btn btn-primary btn-full pressable', onClick: saveNote},
            'Enregistrer')
        )
      )
    ),

    /* Confirmation lancer séance */
    h(ConfirmSheet, {
      open: !!confirmStartSession,
      onClose: ()=>setConfirmStartSession(null),
      onConfirm: ()=>{
        startSession(confirmStartSession, currentProgram, exerciseLib, journalLogs, setActiveSession);
        setConfirmStartSession(null);
      },
      title: 'Lancer cette séance ?',
      message: confirmStartSession ? `"${confirmStartSession.name}" · ${(confirmStartSession.exercises||[]).length} exercices` : '',
      confirmLabel: 'Lancer',
      danger: false
    }),

    months.length > 0 && h('div', {className:'section-label'},
      h('span',{className:'bullet'}), 'Historique',
      h('span', {className:'right'}, sortedLogs.length + ' séance' + (sortedLogs.length>1?'s':''))
    ),
    months.map(([ym, logs]) => {
      const expanded = expandedMonths.has(ym);
      const totalTon = logs.reduce((a,l) => a + tonnageSession(l), 0) / 1000;
      return h('div', {key:ym, style:{marginBottom:6}},
        h('button', {className:'press-row',
          style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:10,background:'var(--bg-2)',border:'1px solid var(--line)',width:'100%',marginBottom:expanded?4:0,textAlign:'left'},
          onClick:()=>toggleMonth(ym)},
          h('div', {style:{display:'flex',alignItems:'center',gap:8}},
            h('span', {className: 'mv-chev' + (expanded?' open':'')}, ICONS.chevDown),
            h('span', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)',textTransform:'capitalize'}}, monthLabel(ym))),
          h('span', {className:'meta'}, logs.length + ' séance' + (logs.length>1?'s':'') + ' · ' + formatNum(totalTon,1) + ' t')
        ),
        h('div', {className: 'mv-expand' + (expanded?' open':'')},
          h('div', {className:'mv-expand-inner'},
            h('div', {style:{paddingTop:4}},
              logs.map(log => h(HistoryRow, {key: log.id, log, onClick:()=>setDetailLog(log)})))))
      );
    }),

    h(Sheet, {open: !!detailLog, onClose:()=>setDetailLog(null), title: detailLog?.sessionName || 'Détail'},
      detailLog && h(HistoryDetail, {log: detailLog, lib: exerciseLib, journalLogs,
        onUpdate: (updatedLog) => {
          state.setJournalLogs(journalLogs.map(l => l.id === updatedLog.id ? updatedLog : l));
          setDetailLog(updatedLog);
        },
        onDelete: () => setDeleteLogConfirm(detailLog)})),
    h(ConfirmSheet, {
      open: !!deleteLogConfirm, onClose: () => setDeleteLogConfirm(null),
      onConfirm: () => {
        state.setJournalLogs(journalLogs.filter(l => l.id !== deleteLogConfirm.id));
        setDetailLog(null);
        setDeleteLogConfirm(null);
      },
      title: 'Supprimer la séance ?',
      message: "Cette séance sera définitivement supprimée de l'historique."
    }),

    /* Récap post-séance — full-screen overlay, not a sheet.
       Renders OUTSIDE the normal layout to cover the whole screen including tab bar. */
    recapLog && h(SessionRecapFull, {log: recapLog, journalLogs, exerciseLib, onClose: ()=>setRecapLog(null)})
  );
}

/**
 * Full-screen post-workout recap — Strava/Revolut/iOS Fitness inspired.
 *
 * Design rationale:
 *  - Takes over the full screen (not a bottom sheet). A workout completion is a "moment"
 *    in the user's day and deserves full attention, not a dismissible popup.
 *  - Content reveals in 5 sequential acts over ~1.6s: kicker → title → hero KPI →
 *    secondary KPIs → PR celebration (if any) → muscle volume breakdown → CTA.
 *  - Every KPI counts up from 0 with ease-out-cubic. The hero number is the hero.
 *  - PR block, when present, gets a dedicated celebration moment with trophy pop and
 *    gold gradient glow. If no PR, the block is simply skipped and the other acts
 *    close the gap naturally.
 *  - Muscle-volume bars fill from 0 width, staggered.
 *  - Close action: smooth fade-out, not a cut.
 */
/**
 * One-line progression indicator: exo name on the left, delta + colored icon on the right.
 * Renders with a reveal transition tied to `visible`. Used in SessionRecapFull.
 */
/**
 * Row for a single subgroup in the program-creator split editor.
 * The actual implementation is defined later in the file (see ~line 5123).
 * This comment block is kept here as a marker for where the original duplicate was.
 */

function ProgressionRow({item, delay=0, visible=true, lib}) {
  const style = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(6px)',
    transition: `opacity 400ms cubic-bezier(.32,.72,0,1) ${delay}ms, transform 400ms cubic-bezier(.32,.72,0,1) ${delay}ms`,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    background: '#10101C', border: '1px solid rgba(255,255,255,.06)',
    borderRadius: 10
  };

  // Récupère le nom du modèle si dispo
  const libEx = item.exId && lib ? lib.find(l => l.id === item.exId) : null;
  const modelName = item.modelId && libEx?.models
    ? libEx.models.find(m => m.id === item.modelId)?.name
    : null;

  let color, bg, icon, deltaText;
  if (item.kind === 'up') {
    color = '#2FD27D';
    bg = 'rgba(47,210,125,.14)';
    icon = h('svg', {width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'},
      h('polyline',{points:'17 8 12 3 7 8'}), h('line',{x1:12,y1:3,x2:12,y2:21}));
    deltaText = '+' + item.delta.toFixed(1) + ' kg';
  } else if (item.kind === 'down') {
    color = '#FF3B48';
    bg = 'rgba(255,59,72,.12)';
    icon = h('svg', {width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'},
      h('polyline',{points:'7 16 12 21 17 16'}), h('line',{x1:12,y1:3,x2:12,y2:21}));
    deltaText = item.delta.toFixed(1) + ' kg';
  } else {
    // new
    color = '#FFC233';
    bg = 'rgba(255,194,51,.14)';
    icon = h('span', {style:{fontSize:14,lineHeight:1,fontWeight:900}}, '✦');
    deltaText = 'premier';
  }

  return h('div', {style},
    h('div', {style: {
      width: 26, height: 26, borderRadius: 8, flex: '0 0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color
    }}, icon),
    h('div', {style: {flex: 1, minWidth: 0}},
      h('div', {style: {
        fontSize: 13, fontWeight: 700, color: '#FFF', letterSpacing: '-0.01em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}, item.exName),
      modelName && h('div', {style: {
        fontSize: 10, fontWeight: 600, color: '#9CA0B5', marginTop: 2,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
      }}, modelName),
      h('div', {style: {
        fontSize: 10, fontWeight: 500, color: '#9CA0B5', marginTop: 1,
        fontVariantNumeric: 'tabular-nums'
      }},
        item.isFirstTime
          ? item.todayW + ' × ' + item.todayR + ' · jamais fait avant'
          : item.todayW + ' × ' + item.todayR + '  vs  ' + item.histW + ' × ' + item.histR)
    ),
    h('div', {style: {
      fontSize: 13, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap'
    }}, deltaText)
  );
}

function SessionRecapFull({log, journalLogs, exerciseLib, onClose}) {
  const totalSets = (log.exercises||[]).reduce((a, ex) => a + (ex.sets||[]).length, 0);
  const totalReps = (log.exercises||[]).reduce((a, ex) => a + (ex.sets||[]).reduce((b, s) => b + (parseInt(s.reps)||0), 0), 0);
  const tonnage = tonnageSession(log) / 1000;
  const durationMin = Math.round((log.durationSec||0)/60);
  const prCount = (log.prs||[]).length;
  const hasPR = prCount > 0;

  const byMuscle = {};
  (log.exercises||[]).forEach(ex => {
    const g = ex.muscleGroup || 'Autre';
    byMuscle[g] = (byMuscle[g]||0) + (ex.sets||[]).length;
  });
  const muscleEntries = Object.entries(byMuscle).sort((a,b) => b[1]-a[1]);
  const maxMuscleVal = Math.max(1, ...muscleEntries.map(e => e[1]));

  // Progression analysis — compare each exo's top e1RM in this session vs the all-time
  // historical max e1RM for the same exo, BEFORE this session. The goal is to give the
  // user a one-shot view of what moved up, what stayed, what regressed — not just vs
  // last session but vs everything they've ever done on that exo.
  //
  // We use e1RM (not raw weight) because it captures progress through both heavier loads
  // and more reps at the same load. Matches the app's progression analytics elsewhere.
  //
  // `journalLogs` already includes the current session at this point (setJournalLogs
  // ran before setRecapLog). We filter it out by id so the comparison is against the past,
  // not against the session we just did.
  const progressionItems = useMemo(() => {
    if (!journalLogs) return [];
    const pastLogs = journalLogs.filter(l => l.id !== log.id);
    const items = [];
    (log.exercises || []).forEach(ex => {
      const sets = (ex.sets || []).filter(s => s.weight > 0 && s.reps > 0);
      if (sets.length === 0) return;
      const todayTop = sets.reduce((best, s) => {
        const e = e1RM(s.weight, s.reps);
        return e > best.e ? {e, w: s.weight, r: s.reps} : best;
      }, {e: 0, w: 0, r: 0});

      // Find historical max e1RM for this exo across all past sessions
      const key = exoKey(ex);
      let histMaxE1 = 0;
      let histBestW = 0, histBestR = 0;
      pastLogs.forEach(l => (l.exercises || []).forEach(hex => {
        if (exoKey(hex) !== key) return;
        (hex.sets || []).forEach(s => {
          if (!(s.weight > 0 && s.reps > 0)) return;
          const e = e1RM(s.weight, s.reps);
          if (e > histMaxE1) { histMaxE1 = e; histBestW = s.weight; histBestR = s.reps; }
        });
      }));

      const isFirstTime = histMaxE1 === 0;
      const delta = todayTop.e - histMaxE1;
      // Classification:
      //  - first time doing this exo → "new"
      //  - delta > 0.3 kg → up
      //  - delta < -0.3 kg → down
      //  - otherwise → flat (within tolerance)
      let kind;
      if (isFirstTime) kind = 'new';
      else if (delta > 0.3) kind = 'up';
      else if (delta < -0.3) kind = 'down';
      else kind = 'flat';

      items.push({
        exName: ex.exName,
        exId: ex.exId,
        modelId: ex.modelId || null,
        kind,
        delta,
        todayW: todayTop.w,
        todayR: todayTop.r,
        histW: histBestW,
        histR: histBestR,
        isFirstTime
      });
    });
    // Sort: ups first by highest delta, then news, then flats, then downs by most negative
    const weight = (k) => k === 'up' ? 0 : k === 'new' ? 1 : k === 'flat' ? 2 : 3;
    items.sort((a, b) => {
      const wa = weight(a.kind), wb = weight(b.kind);
      if (wa !== wb) return wa - wb;
      return b.delta - a.delta; // up: biggest first; down: least negative first (we'll reverse for display)
    });
    return items;
  }, [log, journalLogs]);

  const ups = progressionItems.filter(i => i.kind === 'up');
  const downs = progressionItems.filter(i => i.kind === 'down');
  const flats = progressionItems.filter(i => i.kind === 'flat');
  const news = progressionItems.filter(i => i.kind === 'new');
  const hasProgression = progressionItems.length > 0;

  // step 0: nothing visible yet (mount)
  // step 1: kicker + title + subtitle
  // step 2: hero tonnage (count-up starts)
  // step 3: 3 KPIs grid
  // step 4: PR block (if any)
  // step 5: progression highlights
  // step 6: muscles block + CTA button
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    haptic('success');
    const timers = [];
    // Step progression — each act reveals progressively. Delays adapted to whether the
    // PR block is shown (it adds ~500ms to the cascade).
    const baseAfterKPIs = 1500;
    const prEnd = hasPR ? baseAfterKPIs + 400 : baseAfterKPIs; // ~1900 with PR, 1500 without
    const progressionEnd = prEnd + (hasProgression ? 500 : 0);
    const musclesEnd = progressionEnd + 400;
    const schedule = [
      [1, 100],              // kicker/title
      [2, 500],              // hero tonnage
      [3, 1000],             // secondary KPIs
      [4, baseAfterKPIs],    // PR (skipped visually if no PR)
      [5, prEnd],            // progression highlights
      [6, progressionEnd],   // muscles
      [7, musclesEnd]        // CTA
    ];
    schedule.forEach(([s, delay]) => {
      timers.push(setTimeout(() => setStep(s), delay));
    });
    timers.push(setTimeout(() => haptic('medium'), 600));
    if (hasPR) timers.push(setTimeout(() => haptic('success'), 1600));
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    haptic('light');
    setClosing(true);
    setTimeout(onClose, 260);
  }, [closing, onClose]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Per-element styles for the reveal. We use inline transition on opacity + transform.
  // This is a simpler guarantee than CSS classes + animation-delay. When `visible` flips
  // from false to true, the transition plays. Browsers apply transitions on state changes
  // reliably; they do not depend on stacking context or parent transforms the way keyframe
  // animations on new elements might.
  const reveal = (visible, extraDelay=0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 500ms cubic-bezier(.32,.72,0,1) ${extraDelay}ms, transform 500ms cubic-bezier(.32,.72,0,1) ${extraDelay}ms`,
    willChange: 'transform, opacity'
  });

  return h('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000,
      background: 'linear-gradient(180deg,#0A0610 0%,#050509 50%,#050509 100%)',
      overflowY: 'auto', overflowX: 'hidden',
      opacity: closing ? 0 : 1,
      transition: 'opacity 260ms cubic-bezier(.4,0,.84,.34)',
      WebkitOverflowScrolling: 'touch'
    }
  },
    // Orange/gold glow at the top
    h('div', {style: {
      position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
      width: 600, height: 400, borderRadius: '50%',
      background: hasPR
        ? 'radial-gradient(circle,rgba(255,194,51,.24) 0%,transparent 60%)'
        : 'radial-gradient(circle,rgba(252,76,2,.22) 0%,transparent 60%)',
      pointerEvents: 'none', filter: 'blur(20px)',
      opacity: step >= 1 ? 1 : 0,
      transition: 'opacity 800ms ease-out'
    }}),

    h('div', {style: {
      position: 'relative', zIndex: 1, maxWidth: 540, margin: '0 auto',
      padding: 'calc(60px + env(safe-area-inset-top,0px)) 20px calc(120px + env(safe-area-inset-bottom,0px))',
      display: 'flex', flexDirection: 'column', alignItems: 'center'
    }},
      // STEP 1 — kicker
      h('div', {style: reveal(step >= 1)},
        h('div', {style: {
          fontSize: 11, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase',
          color: '#2FD27D', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10
        }},
          h('span', {style: {
            width: 18, height: 18, borderRadius: '50%', background: '#2FD27D',
            color: '#062', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }},
            h('svg', {width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round'},
              h('polyline', {points: '4 12 10 18 20 6'}))),
          'Séance enregistrée'
        )
      ),

      // STEP 1 — title
      h('h1', {style: Object.assign({
        fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05,
        color: '#FFF', textAlign: 'center', margin: '0 0 6px'
      }, reveal(step >= 1, 80))},
        log.sessionName || 'Séance terminée'),

      // STEP 1 — subtitle
      h('div', {style: Object.assign({
        fontSize: 14, color: '#9CA0B5', fontWeight: 500, textAlign: 'center', marginBottom: 32
      }, reveal(step >= 1, 160))},
        formatDate(log.date) + (log.programName ? ' · ' + log.programName : '')),

      // STEP 2 — hero tonnage
      h('div', {style: Object.assign({
        textAlign: 'center', marginBottom: 36, padding: '0 10px'
      }, reveal(step >= 2))},
        h('div', {style: {
          fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
          color: '#5D6077', marginBottom: 10
        }}, 'Tonnage'),
        h('span', {style: {
          fontSize: 88, fontWeight: 900, letterSpacing: '-0.06em', lineHeight: .9,
          color: '#FFF', fontVariantNumeric: 'tabular-nums',
          background: 'linear-gradient(180deg,#FFF 0%,#AAA8C8 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          display: 'inline-block'
        }},
          // AnimatedNumber is given animate=true once step >= 2 so count-up starts there.
          // Using a unique key forces remount when step flips; that way the count-up always
          // plays, regardless of what animate prop says.
          step >= 2
            ? h(AnimatedNumber, {key: 'tonnage', value: Math.round(tonnage * 10), animate: true, duration: 1100, delay: 0, render: v => (v/10).toFixed(1)})
            : '0.0'),
        h('span', {style: {
          fontSize: 22, fontWeight: 700, color: '#9CA0B5', marginLeft: 8, letterSpacing: '-0.02em'
        }}, 't')
      ),

      // STEP 3 — KPIs grid
      h('div', {style: {display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, width: '100%', marginBottom: 24}},
        [
          {lbl: 'Durée', val: durationMin, unit: 'min', key: 'dur'},
          {lbl: 'Séries', val: totalSets, unit: null, key: 'sets'},
          {lbl: 'Reps', val: totalReps, unit: null, key: 'reps'}
        ].map((k, i) => h('div', {key: k.key, style: Object.assign({
          padding: '16px 12px', background: '#10101C', border: '1px solid rgba(255,255,255,.06)',
          borderRadius: 16, textAlign: 'center'
        }, reveal(step >= 3, i * 80))},
          h('div', {style: {
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
            color: '#5D6077', marginBottom: 6
          }}, k.lbl),
          h('div', {style: {
            fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFF', fontVariantNumeric: 'tabular-nums'
          }},
            step >= 3
              ? h(AnimatedNumber, {key: k.key, value: k.val, animate: true, duration: 800, delay: i * 80})
              : 0,
            k.unit && h('span', {style: {fontSize: 12, fontWeight: 600, color: '#5D6077', marginLeft: 3}}, k.unit)))
        )
      ),

      // STEP 4 — PR block
      hasPR && h('div', {style: Object.assign({
        width: '100%', padding: '18px 20px', borderRadius: 22,
        background: 'linear-gradient(160deg,rgba(255,194,51,.16) 0%,rgba(252,76,2,.08) 100%)',
        border: '1px solid rgba(255,194,51,.4)', marginBottom: 24, position: 'relative', overflow: 'hidden'
      }, reveal(step >= 4))},
        h('div', {style: {display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}},
          h('div', {style: {
            width: 38, height: 38, borderRadius: 12,
            background: 'linear-gradient(180deg,#FFDB66,#FFC233)', color: '#2A1800',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px -4px rgba(255,194,51,.5)', flex: '0 0 auto',
            transform: step >= 4 ? 'scale(1) rotate(0)' : 'scale(.5) rotate(-12deg)',
            opacity: step >= 4 ? 1 : 0,
            transition: 'transform 600ms cubic-bezier(.2,.9,.3,1.2) 100ms, opacity 400ms ease 100ms'
          }},
            h('svg', {width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor'},
              h('path', {d: 'M7 3h10v2h3v4a4 4 0 0 1-4 4h-.3a5 5 0 0 1-3.7 3v2h3v2H9v-2h3v-2a5 5 0 0 1-3.7-3H8a4 4 0 0 1-4-4V5h3V3zM6 7v2a2 2 0 0 0 2 2V7H6zm10 0v4a2 2 0 0 0 2-2V7h-2z'}))),
          h('div', null,
            h('div', {style: {fontSize: 11, fontWeight: 800, letterSpacing: '.15em', textTransform: 'uppercase', color: '#FFC233'}},
              prCount + ' RECORD' + (prCount > 1 ? 'S' : '')),
            h('div', {style: {fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFF', marginTop: 2, lineHeight: 1.2}},
              'Nouveau personal best'))),
        (log.prs || []).slice(0, 4).map((pr, i) => {
          // Récupère le nom du modèle si présent dans le PR
          const libEx = pr.exId ? exerciseLib?.find(l => l.id === pr.exId) : null;
          const modelName = pr.modelId && libEx?.models
            ? libEx.models.find(m => m.id === pr.modelId)?.name
            : null;
          return h('div', {
            key: i,
            style: {
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,194,51,.15)' : 'none',
              fontSize: 13, gap: 10
            }
          },
            h('div', {style:{flex:1, minWidth:0}},
              h('div', {style: {fontWeight: 600, color: '#E9E9F2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}, pr.exName),
              modelName && h('div', {style: {fontSize:10, color:'#9CA0B5', fontWeight: 600, marginTop: 2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}, modelName)),
            h('span', {style: {fontWeight: 800, color: '#FFC233', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontSize: 14, flex:'0 0 auto'}}, pr.weight + ' kg × ' + pr.reps)
          );
        }),
        (log.prs || []).length > 4 && h('div', {style: {textAlign: 'center', color: '#5D6077', fontSize: 12, padding: '8px 0', borderTop: '1px solid rgba(255,194,51,.15)'}},
          '+ ' + ((log.prs || []).length - 4) + ' autres')
      ),

      // STEP 5 — progression highlights (vs all-time history per exo)
      hasProgression && h('div', {style: Object.assign({width: '100%', marginBottom: 24}, reveal(step >= 5))},
        h('div', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, padding: '0 2px'}},
          h('div', {style: {fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#5D6077'}}, 'Progression'),
          h('div', {style: {fontSize: 11, fontWeight: 600, color: '#9CA0B5'}}, 'vs meilleur historique')
        ),

        // Summary counts — up / new / flat / down, as chips
        h('div', {style: {display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14}},
          ups.length > 0 && h('div', {style: {
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'6px 10px', borderRadius: 10,
            background:'rgba(47,210,125,.14)', color:'#2FD27D',
            fontSize:12, fontWeight:800
          }},
            h('svg', {width:12,height:12,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'},
              h('polyline',{points:'17 8 12 3 7 8'}),
              h('line',{x1:12,y1:3,x2:12,y2:21})),
            ups.length, ' progressent'
          ),
          news.length > 0 && h('div', {style: {
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'6px 10px', borderRadius: 10,
            background:'rgba(255,194,51,.14)', color:'#FFC233',
            fontSize:12, fontWeight:800
          }}, '✦ ', news.length, ' nouveau' + (news.length>1?'x':'')),
          flats.length > 0 && h('div', {style: {
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'6px 10px', borderRadius: 10,
            background:'rgba(255,255,255,.06)', color:'#9CA0B5',
            fontSize:12, fontWeight:800
          }}, '= ', flats.length, ' stable' + (flats.length>1?'s':'')),
          downs.length > 0 && h('div', {style: {
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'6px 10px', borderRadius: 10,
            background:'rgba(255,59,72,.14)', color:'#FF3B48',
            fontSize:12, fontWeight:800
          }},
            h('svg', {width:12,height:12,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:3,strokeLinecap:'round',strokeLinejoin:'round'},
              h('polyline',{points:'7 16 12 21 17 16'}),
              h('line',{x1:12,y1:3,x2:12,y2:21})),
            downs.length, ' en baisse'
          )
        ),

        // Detail rows — ups first, then news, then downs. Flats intentionally skipped
        // to keep the list focused on what moved. Limit to top 3 ups + top 2 downs to
        // avoid overflowing the screen.
        h('div', {style: {display: 'flex', flexDirection: 'column', gap: 4}},
          ups.slice(0, 3).map((it, i) => h(ProgressionRow, {
            key:'u'+i, item: it, delay: i * 60, visible: step >= 5, lib: exerciseLib
          })),
          news.slice(0, 2).map((it, i) => h(ProgressionRow, {
            key:'n'+i, item: it, delay: (ups.slice(0,3).length + i) * 60, visible: step >= 5, lib: exerciseLib
          })),
          downs.slice(0, 2).map((it, i) => h(ProgressionRow, {
            key:'d'+i, item: it, delay: (ups.slice(0,3).length + news.slice(0,2).length + i) * 60, visible: step >= 5, lib: exerciseLib
          })),
          // "+N autres" line if some were hidden
          (ups.length > 3 || news.length > 2 || downs.length > 2) && h('div', {
            style: {textAlign: 'center', color: '#5D6077', fontSize: 11, padding: '6px 0', fontWeight: 600}
          },
            'et ' + (
              Math.max(0, ups.length - 3) +
              Math.max(0, news.length - 2) +
              Math.max(0, downs.length - 2)
            ) + ' autre' + ((ups.length - 3 + news.length - 2 + downs.length - 2) > 1 ? 's' : ''))
        )
      ),

      // STEP 6 — muscles
      muscleEntries.length > 0 && h('div', {style: Object.assign({width: '100%', marginBottom: 28}, reveal(step >= 6))},
        h('div', {style: {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, padding: '0 2px'}},
          h('div', {style: {fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#5D6077'}}, 'Volume par muscle'),
          h('div', {style: {fontSize: 11, fontWeight: 600, color: '#9CA0B5', fontVariantNumeric: 'tabular-nums'}},
            totalSets + ' séries au total')),
        muscleEntries.map(([g, sets], i) => {
          const w = (sets / maxMuscleVal) * 100;
          return h('div', {key: g, style: {display: 'grid', gridTemplateColumns: '90px 1fr 36px', alignItems: 'center', gap: 10, padding: '6px 0'}},
            h('div', {style: {fontSize: 12, fontWeight: 600, color: '#E9E9F2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}, g),
            h('div', {style: {height: 8, background: '#181828', borderRadius: 4, overflow: 'hidden', position: 'relative'}},
              h('div', {style: {
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: w + '%',
                background: 'linear-gradient(90deg,#FC4C02,#FF6B2C)', borderRadius: 4,
                transformOrigin: 'left center',
                transform: step >= 6 ? 'scaleX(1)' : 'scaleX(0)',
                transition: `transform 700ms cubic-bezier(.32,.72,0,1) ${i * 70}ms`,
                willChange: 'transform'
              }})),
            h('div', {style: {textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#FFF', fontVariantNumeric: 'tabular-nums'}}, sets)
          );
        })
      )
    ),

    // Fixed bottom CTA
    h('div', {style: {
      position: 'fixed', bottom: 0, left: 0, right: 0,
      padding: '20px 20px calc(20px + env(safe-area-inset-bottom,0px))',
      background: 'linear-gradient(180deg,transparent 0%,rgba(5,5,9,.95) 40%,#050509 100%)',
      zIndex: 2
    }},
      h('div', {style: Object.assign({maxWidth: 540, margin: '0 auto'}, reveal(step >= 7, 200))},
        h('button', {className: 'btn btn-primary btn-full press-btn', onClick: handleClose},
          'Terminé'))
    )
  );
}

function SessionRecap({log, onClose}) {
  const totalSets = (log.exercises||[]).reduce((a, ex) => a + (ex.sets||[]).length, 0);
  const totalReps = (log.exercises||[]).reduce((a, ex) => a + (ex.sets||[]).reduce((b, s) => b + (parseInt(s.reps)||0), 0), 0);
  const tonnage = tonnageSession(log) / 1000;
  const durationMin = Math.round((log.durationSec||0)/60);
  const prCount = (log.prs||[]).length;
  const byMuscle = {};
  (log.exercises||[]).forEach(ex => {
    const g = ex.muscleGroup || 'Autre';
    byMuscle[g] = (byMuscle[g]||0) + (ex.sets||[]).length;
  });
  const muscleEntries = Object.entries(byMuscle).sort((a,b) => b[1]-a[1]);

  return h('div', null,
    h('div', {style:{display:'flex',justifyContent:'center',marginBottom:8}},
      h(Mascot, {size:90, float:true})),
    h('p', {className:'body', style:{textAlign:'center',color:'var(--ink-2)',marginTop:0,marginBottom:18}},
      log.sessionName),

    /* KPI grid */
    h('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}},
      h('div', {style:{padding:14,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10}},
        h('div', {className:'meta'}, 'Tonnage'),
        h('div', {style:{fontSize:22,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums',marginTop:2}},
          formatNum(tonnage, 1), h('span', {style:{fontSize:14,color:'var(--ink-3)',marginLeft:4}}, 't'))),
      h('div', {style:{padding:14,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10}},
        h('div', {className:'meta'}, 'Durée'),
        h('div', {style:{fontSize:22,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums',marginTop:2}},
          durationMin, h('span', {style:{fontSize:14,color:'var(--ink-3)',marginLeft:4}}, 'min'))),
      h('div', {style:{padding:14,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10}},
        h('div', {className:'meta'}, 'Séries'),
        h('div', {style:{fontSize:22,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums',marginTop:2}},
          totalSets)),
      h('div', {style:{padding:14,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10}},
        h('div', {className:'meta'}, 'Répétitions'),
        h('div', {style:{fontSize:22,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums',marginTop:2}},
          totalReps))),

    /* PR highlight */
    prCount > 0 && h('div', {style:{padding:14,background:'var(--pr-gold-wash)',border:'1px solid rgba(255,194,51,.4)',borderRadius:10,marginBottom:14}},
      h('div', {style:{display:'flex',alignItems:'center',gap:10,marginBottom:8}},
        h('span', {style:{fontSize:24}}, '🏆'),
        h('div', null,
          h('div', {style:{fontSize:12,fontWeight:700,color:'var(--pr-gold)',textTransform:'uppercase',letterSpacing:'.1em'}}, prCount + ' PR battu' + (prCount>1?'s':'')),
          h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',marginTop:2}}, 'Nouveau record !'))),
      (log.prs||[]).map((pr, i) => h('div', {key:i, style:{fontSize:12,color:'var(--ink-1)',padding:'4px 0'}},
        '• ' + pr.exName + ' — ' + pr.weight + ' kg × ' + pr.reps + ' reps'))),

    /* Volume par muscle */
    muscleEntries.length > 0 && h('div', {style:{marginBottom:14}},
      h('div', {className:'label', style:{marginBottom:8}}, 'Volume par muscle'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:3}},
        muscleEntries.map(([g, sets]) => h('div', {key:g,
          style:{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 10px',background:'var(--bg-3)',borderRadius:6}},
          h('span', {style:{fontWeight:600,color:'var(--ink-1)'}}, g),
          h('span', {style:{fontVariantNumeric:'tabular-nums',color:'var(--ink-2)',fontWeight:700}}, sets + ' séries'))))),

    h('button', {className:'btn btn-primary btn-full pressable', onClick:onClose},
      ICONS.check, ' C\'est bon')
  );
}

function startSession(progSession, program, lib, journalLogs, setActiveSession) {
  const hydratedExos = hydrateSessionExos(progSession, lib, journalLogs);
  // Note de séance future attachée à ce (programId, sessionId), s'il y en a une.
  const note = getSessionNote(program?.id, progSession.id);
  const liveSession = {
    id: uid(), sessionId: progSession.id, programId: program?.id || null,
    sessionName: progSession.name, programName: program?.name || 'Séance libre',
    date: todayIso(), startedAt: Date.now(),
    sessionNote: note ? note.text : null, // affichée en modal au lancement
    exercises: hydratedExos.map(ex => {
      // Find isCompound from lib
      const libEx = ex.exId ? lib.find(l => l.id === ex.exId) : null;
      // Préremplissage : cible de poids du programme + 10 reps par défaut
      // L'utilisateur n'a plus qu'à confirmer ou ajuster
      const prefillWeight = ex.targetWeight ? String(ex.targetWeight) : '';
      const prefillReps = '10';
      const prefillRir = '1';
      return {
        ...ex, id: uid(),
        sets: Array.from({length: ex.targetSets || 3}, () => ({
          weight: prefillWeight,
          reps: prefillReps,
          rir: prefillRir,
          _confirmed: false
        })),
        activeVariant: 0,
        isCompound: libEx?.compound || false
      };
    }),
    currentExoIdx: 0
  };
  haptic('medium');
  setActiveSession(liveSession);
}

function SessionCard({session, program, journalLogs, lib, recommended, onStart, onEditNote}) {
  const [expanded, setExpanded] = useState(false);
  const lastLog = journalLogs.filter(l => l.sessionId === session.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const exos = session.exercises || [];
  const note = getSessionNote(program?.id, session.id);
  const topExos = exos.slice(0,3).map(ex => {
    const c = ex.choices?.[0];
    const libEx = c?.exId ? lib.find(l=>l.id===c.exId) : null;
    return libEx?.name || ex.exName || '?';
  });
  const more = Math.max(0, exos.length - 3);
  return h('div', {
    className:'pressable',
    onClick: (e) => {
      if (e.target.closest('[data-no-expand]')) return;
      setExpanded(!expanded);
    },
    style:{
      background: recommended ? 'linear-gradient(180deg,rgba(252,76,2,.04),transparent 60%),var(--bg-2)' : 'var(--bg-2)',
      border: recommended ? '1px solid rgba(252,76,2,.3)' : '1px solid var(--line)',
      borderRadius:'var(--r-md)', padding:18, marginBottom:10, position:'relative', overflow:'hidden',
      cursor:'pointer', textAlign:'left', width:'100%'
    }
  },
    recommended && h('div', {style:{position:'absolute',left:0,top:18,bottom:18,width:3,background:'linear-gradient(180deg,var(--accent-hi),var(--accent))',borderRadius:'0 2px 2px 0'}}),
    h('div', {style:{display:'flex',alignItems:'center',gap:12,marginBottom:12}},
      recommended && h(Mascot, {size:44, style:{flex:'0 0 auto'}}),
      // Bloc titre + meta
      h('div', {style:{flex:1,minWidth:0}},
        // Ligne 1 : titre + badge Recommandée
        h('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:2}},
          h('div', {style:{fontSize:18,fontWeight:800,letterSpacing:'-0.02em',color:'var(--ink-0)',lineHeight:1.15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}, session.name),
          recommended && h('span', {style:{
            flex:'0 0 auto', fontSize:9, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase',
            color:'var(--pr-gold)', background:'var(--pr-gold-wash)', padding:'3px 7px', borderRadius:999
          }}, 'Reco')),
        // Ligne 2 : meta
        h('div', {style:{fontSize:12,color:'var(--ink-2)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
          exos.length + ' exo' + (exos.length>1?'s':'') +
          (lastLog ? ' · ' + formatRelative(lastLog.date) : ' · jamais fait'))),
      // Chevron discret d'expand
      h('span', {className: 'mv-chev' + (expanded?' open':''), style:{
        flex:'0 0 auto', color:'var(--ink-3)', display:'inline-flex', alignItems:'center'
      }}, ICONS.chevDown)
    ),
    !expanded && topExos.length > 0 && h('div', {style:{display:'flex',flexWrap:'wrap',gap:4,marginBottom:12}},
      topExos.map((n,i) => h('span', {key:i, className:'chip' + (i===0 && recommended?' primary':'')}, n)),
      more > 0 && h('span', {className:'chip'}, '+ '+more)),
    h('div', {className: 'mv-expand' + (expanded?' open':'')}, h('div', {className:'mv-expand-inner'}, h('div', {style:{marginBottom:12,padding:'10px 0',borderTop:'1px solid var(--line)',borderBottom:'1px solid var(--line)'}},
      exos.map((ex, i) => {
        const c = ex.choices?.[0];
        const libEx = c?.exId ? lib.find(l=>l.id===c.exId) : null;
        const name = libEx?.name || ex.exName || '?';
        const muscle = libEx?.muscleGroup || ex.muscleGroup;
        const sets = parseInt(ex.sets) || 0;
        const target = ex.targetWeight || c?.weight;
        const range = ex.repRange ? ex.repRange.join('-') + ' reps' : '';
        return h('div', {key:ex.id || i, style:{
          display:'grid', gridTemplateColumns:'24px 1fr auto', gap:10, alignItems:'center',
          padding:'6px 2px', fontSize:13
        }},
          h('span', {style:{color:'var(--ink-3)',fontFamily:'var(--f-mono)',fontSize:10,fontWeight:700}}, (i+1)),
          h('div', {style:{minWidth:0}},
            h('div', {style:{fontWeight:700,color:'var(--ink-0)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, name),
            h('div', {style:{fontSize:11,color:'var(--ink-3)',marginTop:1}},
              [muscle, range].filter(Boolean).join(' · '))),
          h('div', {style:{fontVariantNumeric:'tabular-nums',fontSize:12,color:'var(--ink-2)',textAlign:'right'}},
            sets + ' × ' + (target ? target + ' kg' : '—'))
        );
      })))),
    // Note de séance : bandeau cliquable si présente (tap = éditer), sinon lien discret pour ajouter.
    note
      ? h('button', {'data-no-expand': true, className:'pressable',
          onClick: (e) => { e.stopPropagation(); onEditNote && onEditNote(session); },
          style:{
            display:'flex', alignItems:'center', gap:10, marginBottom:12, width:'100%', textAlign:'left',
            padding:'12px', borderRadius:10,
            background:'var(--accent-wash)', border:'1px solid rgba(252,76,2,.25)'
          }},
          h('span', {style:{color:'var(--accent-hi)', flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', width:18, height:18}}, ICONS.edit),
          h('div', {style:{fontSize:12.5, fontWeight:500, color:'var(--ink-1)', lineHeight:1.35, flex:1, minWidth:0, whiteSpace:'pre-wrap', wordBreak:'break-word'}}, note.text)
        )
      : h('button', {'data-no-expand': true, className:'press-row',
          onClick: (e) => { e.stopPropagation(); onEditNote && onEditNote(session); },
          style:{
            display:'flex', alignItems:'center', gap:6, marginBottom:12, width:'100%',
            padding:'8px 10px', borderRadius:10, background:'transparent',
            color:'var(--ink-3)', fontSize:12, fontWeight:600
          }},
          ICONS.edit, ' Ajouter une note pour cette séance'
        ),
    h('button', {'data-no-expand':true, className:'btn ' + (recommended?'btn-primary':'btn-ghost') + ' btn-full pressable',
      onClick: (e) => { e.stopPropagation(); onStart(); }},
      ICONS.play, ' Commencer')
  );
}

function HistoryRow({log, onClick}) {
  const ton = tonnageSession(log)/1000;
  const prs = log.prs?.length || 0;
  return h('button', {className:'pressable', onClick,
    style:{display:'grid',gridTemplateColumns:'48px 1fr auto',gap:12,alignItems:'center',padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',marginBottom:6,textAlign:'left',width:'100%'}
  },
    h('div', {style:{width:48,height:48,borderRadius:12,background:'var(--bg-3)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}},
      h('span', {style:{fontFamily:'var(--f-mono)',fontSize:10,color:'var(--ink-3)',fontWeight:700,letterSpacing:'.05em'}},
        DOW_FR_S[(new Date(log.date).getDay()+6)%7].toUpperCase()),
      h('span', {style:{fontSize:18,fontWeight:800,color:'var(--ink-0)',letterSpacing:'-0.02em',fontVariantNumeric:'tabular-nums'}},
        parseInt(log.date.split('-')[2]))),
    h('div', null,
      h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)'}}, log.sessionName || 'Séance'),
      h('div', {style:{fontSize:12,color:'var(--ink-2)',marginTop:2,fontWeight:500}},
        (log.exercises||[]).length + ' exos · ', formatNum(ton,1) + ' t · ', formatDur(log.durationSec||0))),
    prs > 0 && h('span', {className:'pr-badge'}, prs + ' PR')
  );
}

function HistoryDetail({log, lib, journalLogs, onUpdate, onDelete}) {
  // Mode édition : draftLog = copie modifiable des séries. Quand le user enregistre,
  // on appelle onUpdate(updatedLog) qui propage au state global.
  const [editMode, setEditMode] = useState(false);
  const [draftLog, setDraftLog] = useState(null);
  // Reset draft à chaque ouverture/changement de log
  useEffect(() => { setEditMode(false); setDraftLog(null); }, [log.id]);

  const enterEdit = () => {
    // Deep clone des sets pour pouvoir modifier sans toucher au log original
    const draft = {
      ...log,
      exercises: (log.exercises||[]).map(ex => ({
        ...ex,
        sets: (ex.sets||[]).map(s => ({...s}))
      }))
    };
    setDraftLog(draft);
    setEditMode(true);
    haptic('light');
  };

  const cancelEdit = () => {
    setDraftLog(null);
    setEditMode(false);
    haptic('light');
  };

  const saveEdit = () => {
    if (!draftLog) return;
    onUpdate?.(draftLog);
    setEditMode(false);
    setDraftLog(null);
    haptic('success');
  };

  const updateDraftSet = (exIdx, setIdx, key, value) => {
    setDraftLog(d => {
      if (!d) return d;
      const exos = [...d.exercises];
      const sets = [...exos[exIdx].sets];
      sets[setIdx] = {...sets[setIdx], [key]: value};
      exos[exIdx] = {...exos[exIdx], sets};
      return {...d, exercises: exos};
    });
  };

  // Recalcul rétroactif des PRs en se basant sur l'historique complet jusqu'à cette séance.
  // Utilise draftLog si en édition, sinon log. Garantit que les nouvelles définitions
  // (1ère série pas PR, etc.) s'appliquent aussi aux anciennes séances.
  const viewLog = editMode && draftLog ? draftLog : log;
  // Quand on édite, on doit utiliser un journalLogs qui contient la version draft de ce log,
  // sinon le scan voit toujours les anciens chiffres.
  const journalLogsForScan = useMemo(() => {
    if (!editMode || !draftLog) return journalLogs;
    return (journalLogs || []).map(l => l.id === draftLog.id ? draftLog : l);
  }, [editMode, draftLog, journalLogs]);

  const recalculatedPRs = useMemo(() => {
    if (!journalLogsForScan) return viewLog.prs || [];
    const prs = [];
    (viewLog.exercises || []).forEach(ex => {
      const targetKey = exoKey(ex);
      const flagged = scanExoPRs(journalLogsForScan, exoKey, targetKey);
      flagged
        .filter(f => f.sessionId === viewLog.id)
        .forEach(f => {
          if (f.isAllTimePR) {
            prs.push({type:'all-time', exName: f.exName, exId: f.exId, modelId: f.modelId, weight: f.weight, reps: f.reps});
          }
          if (f.isRepPR) {
            prs.push({type:'rep', exName: f.exName, exId: f.exId, modelId: f.modelId, weight: f.weight, reps: f.reps});
          }
        });
    });
    return prs;
  }, [viewLog, journalLogsForScan]);

  const setFlagsIndex = useMemo(() => {
    const idx = {};
    if (!journalLogsForScan) return idx;
    (viewLog.exercises || []).forEach(ex => {
      const targetKey = exoKey(ex);
      const flagged = scanExoPRs(journalLogsForScan, exoKey, targetKey);
      flagged
        .filter(f => f.sessionId === viewLog.id)
        .forEach(f => {
          const k = (f.exId||'') + '|' + (f.modelId||'') + '|' + f.weight.toFixed(2) + '|' + f.reps + '|' + f.setIdx;
          idx[k] = {isAllTimePR: f.isAllTimePR, isRepPR: f.isRepPR};
        });
    });
    return idx;
  }, [viewLog, journalLogsForScan]);

  return h('div', null,
    h('div', {style:{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}},
      h('div', null, h('div', {className:'label'}, 'Date'), h('div', {className:'title-sm'}, viewLog.date, ' · ', DOW_FR[(new Date(viewLog.date).getDay()+6)%7])),
      h('div', null, h('div', {className:'label'}, 'Tonnage'), h('div', {className:'title-sm'}, formatNum(tonnageSession(viewLog)/1000,1)+' t')),
      h('div', null, h('div', {className:'label'}, 'Durée'), h('div', {className:'title-sm'}, formatDur(viewLog.durationSec||0))),
      h('div', null, h('div', {className:'label'}, 'PR'), h('div', {className:'title-sm', style:{color:recalculatedPRs.length?'var(--pr-gold)':'var(--ink-3)'}}, recalculatedPRs.length))),
    // Bouton Modifier / Annuler+Enregistrer
    !editMode && onUpdate && h('button', {
      className:'btn btn-ghost btn-sm pressable',
      style:{marginBottom:14},
      onClick: enterEdit
    }, ICONS.edit, ' Modifier les séries'),
    editMode && h('div', {style:{display:'flex',gap:8,marginBottom:14}},
      h('button', {className:'btn btn-ghost btn-sm pressable', style:{flex:1}, onClick: cancelEdit}, 'Annuler'),
      h('button', {className:'btn btn-primary btn-sm pressable', style:{flex:1}, onClick: saveEdit}, ICONS.check, ' Enregistrer')),
    recalculatedPRs.length > 0 && !editMode && h('div', {style:{marginBottom:14}},
      recalculatedPRs.map((pr,i) => h('div', {key:i, style:{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'var(--pr-gold-wash)',border:'1px solid rgba(255,194,51,.3)',borderRadius:10,marginBottom:4}},
        h('span', {style:{color:'var(--pr-gold)'}}, ICONS.trophy),
        h('div', {style:{flex:1}},
          h('div', {style:{fontSize:12,color:'var(--pr-gold)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em'}},
            pr.type === 'rep' ? 'Rep PR · ' + pr.reps + ' reps à ' + pr.weight + ' kg' : 'All-Time PR · ' + pr.weight + ' kg'),
          h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',marginTop:2}},
            pr.exName + ' · ' + pr.weight + ' kg × ' + pr.reps))))),
    h('div', {className:'divider'}),
    (viewLog.exercises||[]).map((ex, exIdx) => {
      const libEx = ex.exId ? lib?.find(l => l.id === ex.exId) : null;
      const modelName = ex.modelId && libEx?.models
        ? libEx.models.find(m => m.id === ex.modelId)?.name
        : null;
      return h('div', {key:ex.id, style:{marginBottom:12}},
        h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,gap:8}},
          h('div', {style:{flex:1, minWidth:0}},
            h('div', {className:'title-sm', style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, ex.exName),
            modelName && h('div', {style:{fontSize:10,color:'var(--ink-3)',fontWeight:600,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
              modelName)),
          h('div', {className:'meta', style:{flex:'0 0 auto'}}, ex.muscleGroup)),
        (ex.sets||[]).map((s, i) => {
          // En lecture : on filtre les sets invalides. En édition : on les garde tous pour pouvoir corriger.
          if (!editMode && !isValidSet(s)) return null;
          const w = parseFloat(s.weight)||0, r = parseInt(s.reps)||0;
          const k = (ex.exId||'') + '|' + (ex.modelId||'') + '|' + w.toFixed(2) + '|' + r + '|' + i;
          const flags = setFlagsIndex[k] || {};
          const isPR = !editMode && (flags.isAllTimePR || flags.isRepPR);
          if (editMode) {
            return h('div', {key:i, style:{
              display:'grid',gridTemplateColumns:'24px 1fr 1fr 60px',gap:6,padding:'6px 8px',
              background:'var(--bg-3)',borderRadius:8,marginBottom:3,fontSize:13,alignItems:'center'
            }},
              h('span', {style:{color:'var(--ink-3)',fontWeight:700,fontFamily:'var(--f-mono)',fontSize:10}}, (i+1)),
              h('input', {type:'number', step:'0.5', inputMode:'decimal', className:'input',
                style:{padding:'4px 6px',fontSize:12,textAlign:'center'},
                placeholder:'kg', value: s.weight ?? '',
                onChange: e => updateDraftSet(exIdx, i, 'weight', e.target.value)}),
              h('input', {type:'number', inputMode:'numeric', className:'input',
                style:{padding:'4px 6px',fontSize:12,textAlign:'center'},
                placeholder:'reps', value: s.reps ?? '',
                onChange: e => updateDraftSet(exIdx, i, 'reps', e.target.value)}),
              h('input', {type:'number', inputMode:'numeric', className:'input',
                style:{padding:'4px 6px',fontSize:11,textAlign:'center'},
                placeholder:'RIR', value: s.rir ?? '',
                onChange: e => updateDraftSet(exIdx, i, 'rir', e.target.value)})
            );
          }
          return h('div', {key:i, style:{
            display:'grid',gridTemplateColumns:'24px 1fr 1fr 60px auto',gap:8,padding:'6px 10px',
            background: isPR ? 'rgba(255,194,51,.08)' : 'var(--bg-3)',
            border: isPR ? '1px solid rgba(255,194,51,.3)' : '1px solid transparent',
            borderRadius:8, marginBottom:3, fontSize:13, fontVariantNumeric:'tabular-nums', alignItems:'center'
          }},
            h('span', {style:{color: isPR ? 'var(--pr-gold)' : 'var(--ink-3)', fontWeight:700, fontFamily:'var(--f-mono)', fontSize:10}}, (i+1)),
            h('span', {style:{color: isPR ? 'var(--pr-gold)' : 'inherit', fontWeight: isPR ? 700 : 'inherit'}}, s.weight, ' kg'),
            h('span', {style:{color: isPR ? 'var(--pr-gold)' : 'inherit', fontWeight: isPR ? 700 : 'inherit'}}, s.reps, ' reps'),
            h('span', {style:{color:'var(--ink-2)',fontSize:11}}, s.rir!==undefined && s.rir!==null && s.rir!==''?'RIR '+s.rir:''),
            flags.isAllTimePR
              ? h('span', {style:{fontSize:9, fontWeight:800, color:'var(--pr-gold)', letterSpacing:'.05em'}}, '★ PR')
              : flags.isRepPR
                ? h('span', {style:{fontSize:9, fontWeight:800, color:'var(--accent-hi)', letterSpacing:'.05em'}}, '✦ REP')
                : h('span')
          );
        })
      );
    }),
    !editMode && h('button', {className:'btn btn-danger btn-full', style:{marginTop:10}, onClick:onDelete},
      ICONS.trash, ' Supprimer cette séance')
  );
}

/* ==========================================================================
   SESSION LIVE
   ========================================================================== */

/* ==========================================================================
   REST TIMER — circular progress ring, start/stop/reset
   ========================================================================== */

/**
 * RestTimer — v2 "gros et central" avec cible ajustable.
 *
 * Nouveau comportement :
 *  - cible par défaut 2min (120s) — ajustable par série via onTargetChange
 *  - progress bar horizontale (0 → cible), passe au pr-gold quand over
 *  - démarrage 100% manuel (pas d'auto-start à la validation d'une série)
 *  - bouton +30s pour ajouter du rab sans redémarrer
 *  - pause conserve le chrono à l'endroit où il est (pas reset)
 *  - reset remet le chrono à 0 et arrête
 *
 * Le chrono est géré par le parent via ref (timestamp de démarrage + elapsed).
 * Ce composant est purement présentationnel : il reçoit seconds/running/target
 * et appelle les callbacks onStart/onStop/onReset/onAddRest.
 */
function RestTimer({seconds, running, targetSeconds=120, onStart, onStop, onReset, onAddRest}) {
  // Progression : 0 → 1 sur targetSeconds. Après targetSeconds, on passe en "over" (doré).
  const progress = Math.min(1, seconds / targetSeconds);
  const over = seconds > targetSeconds;
  const mm = pad2(Math.floor(seconds / 60));
  const ss = pad2(seconds % 60);

  // Couleur de la barre : ink-4 au repos, success en cours, gold en dépassement
  const barColor = over ? 'var(--pr-gold)' : (running ? 'var(--success)' : 'var(--ink-3)');
  const numColor = over ? 'var(--pr-gold)' : (running ? 'var(--ink-0)' : 'var(--ink-1)');

  return h('div', {
    style:{
      background: running
        ? 'linear-gradient(180deg, rgba(47,210,125,.1), rgba(47,210,125,.02))'
        : 'var(--bg-2)',
      border: '1px solid ' + (running ? 'rgba(47,210,125,.3)' : 'var(--line)'),
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 12,
      transition: 'background var(--t-local) var(--ease-ios), border-color var(--t-local) var(--ease-ios)'
    }
  },
    // Ligne 1 : label + cible
    h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}},
      h('span', {style:{
        fontSize:10, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase',
        color: running ? 'var(--success)' : 'var(--ink-3)'
      }}, over ? 'repos +' : 'repos'),
      h('span', {style:{fontSize:10,color:'var(--ink-3)',fontVariantNumeric:'tabular-nums'}},
        'cible ' + pad2(Math.floor(targetSeconds/60)) + ':' + pad2(targetSeconds%60))
    ),

    // Ligne 2 : chrono gros
    h('div', {style:{display:'flex',alignItems:'baseline',gap:8,marginBottom:10}},
      h('span', {style:{
        fontFamily:'var(--f-mono)', fontSize:32, fontWeight:700,
        letterSpacing:'-0.02em', color: numColor,
        fontVariantNumeric:'tabular-nums', lineHeight:1,
        transition: 'color var(--t-local) var(--ease-ios)'
      }}, mm + ':' + ss),
      running && !over && h('span', {style:{fontSize:10,color:'var(--ink-3)'}},
        'restants : ' + pad2(Math.floor((targetSeconds-seconds)/60)) + ':' + pad2((targetSeconds-seconds)%60))
    ),

    // Ligne 3 : progress bar
    h('div', {style:{
      height:4, background:'rgba(255,255,255,.06)', borderRadius:2,
      marginBottom:10, overflow:'hidden'
    }},
      h('div', {style:{
        width: (progress*100) + '%', height:'100%', background: barColor, borderRadius:2,
        transition: 'width .4s var(--ease-ios), background .3s'
      }})
    ),

    // Ligne 4 : contrôles — Start/Pause gauche, +30s et ↺ droite
    h('div', {style:{display:'flex',gap:6}},
      h('button', {
        className:'pressable',
        onClick: running ? onStop : onStart,
        style:{
          flex: 1.4, padding:'10px 12px', borderRadius:10,
          background: running ? 'rgba(255,255,255,.05)' : 'var(--success-wash)',
          color: running ? 'var(--ink-2)' : 'var(--success)',
          border: '1px solid ' + (running ? 'var(--line)' : 'rgba(47,210,125,.3)'),
          fontSize:13, fontWeight:700, letterSpacing:'-0.01em',
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:4
        }
      }, running
        ? h('span', {style:{display:'inline-flex',alignItems:'center',gap:5}}, ICONS.pause, 'Pause')
        : h('span', {style:{display:'inline-flex',alignItems:'center',gap:5}}, ICONS.play, 'Start')),
      h('button', {
        className:'pressable',
        onClick: onAddRest,
        style:{
          flex: 1, padding:'10px 10px', borderRadius:10,
          background: 'rgba(255,255,255,.05)',
          color: 'var(--ink-1)',
          border: '1px solid var(--line)',
          fontSize:12, fontWeight:700, letterSpacing:'-0.01em'
        }
      }, '+30s'),
      h('button', {
        className:'pressable',
        onClick: onReset,
        disabled: seconds === 0 && !running,
        style:{
          padding:'10px 12px', borderRadius:10,
          background: 'rgba(255,255,255,.05)',
          color: 'var(--ink-2)',
          border: '1px solid var(--line)',
          fontSize:14, fontWeight:700,
          opacity: (seconds === 0 && !running) ? .4 : 1,
          minWidth: 40
        }
      }, '↺')
    )
  );
}

function SessionLive({state, session, onSave, onDiscard, onPause, onUpdate}) {
  const {exerciseLib, journalLogs, currentProgram} = state;
  // Timer v3 — persisté dans session.timer pour survivre au switch d'exo ET au changement
  // d'onglet (SessionLive unmount → state reload depuis activeSession via LS).
  // Modèle : {accum, startedAt, target}. running = !!startedAt. display = accum + (now - startedAt) si running.
  const t0 = session.timer || {accum: 0, startedAt: null, target: 120};
  const timerStartRef = useRef(t0.startedAt);
  const timerAccumRef = useRef(t0.accum || 0);
  const [timerRunning, setTimerRunning] = useState(!!t0.startedAt);
  const [timerDisplay, setTimerDisplay] = useState(() => {
    if (t0.startedAt) return (t0.accum||0) + Math.floor((Date.now() - t0.startedAt)/1000);
    return t0.accum || 0;
  });
  const [timerTarget, setTimerTarget] = useState(t0.target || 120);
  const [exoSheetOpen, setExoSheetOpen] = useState(false); // popup liste exos + actions
  const [pickerOpen, setPickerOpen] = useState(false);     // picker complet biblio
  const [lwbPR, setLwbPR] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [updateTargetOpen, setUpdateTargetOpen] = useState(null); // {exIdx, newWeight}
  const [switchVariantConfirm, setSwitchVariantConfirm] = useState(null); // {count, name, doSwitch}
  // When the user taps "Terminer" but some sets are neither confirmed nor deleted, we show
  // a modal explaining exactly what remains to do instead of a bare alert().
  const [finishBlocked, setFinishBlocked] = useState(null); // {pending: [{exName, setCount}], emptyExos: [names]}
  // Note de séance affichée en header orange pendant la séance (posée par
  // startSession dans session.sessionNote). Reste visible jusqu'à ce que
  // l'utilisateur la ferme via la croix. Ne supprime pas la note stockée
  // (elle est consommée à la fin de séance validée).
  const [noteHeaderVisible, setNoteHeaderVisible] = useState(!!session.sessionNote);

  // Helper : persiste l'état timer dans la session (donc dans activeSession → LS).
  // Appelé à chaque mutation timer pour que survivre à un unmount.
  // On utilise une ref pour éviter de capturer session/onUpdate stales dans les closures.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  const persistTimer = (partial) => {
    const cur = sessionRef.current.timer || {accum: 0, startedAt: null, target: 120};
    const next = {...cur, ...partial};
    onUpdateRef.current({...sessionRef.current, timer: next});
  };

  // Timer v3 : tick depuis startedAt si running, sinon display reste figé à accum.
  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => {
      const elapsedSinceStart = Math.floor((Date.now() - timerStartRef.current)/1000);
      setTimerDisplay(timerAccumRef.current + elapsedSinceStart);
    };
    tick();
    const int = setInterval(tick, 500);
    return () => clearInterval(int);
  }, [timerRunning]);

  const startTimer = () => {
    timerStartRef.current = Date.now();
    setTimerRunning(true);
    persistTimer({startedAt: timerStartRef.current, accum: timerAccumRef.current, target: timerTarget});
    haptic('light');
  };
  // Pause : arrête l'intervalle mais conserve le temps écoulé dans accum
  const stopTimer = () => {
    if (timerStartRef.current) {
      const elapsedSinceStart = Math.floor((Date.now() - timerStartRef.current)/1000);
      timerAccumRef.current += elapsedSinceStart;
    }
    timerStartRef.current = null;
    setTimerRunning(false);
    persistTimer({startedAt: null, accum: timerAccumRef.current, target: timerTarget});
  };
  // Reset : remet tout à zéro, arrête le timer, restaure la cible par défaut (2min)
  const resetTimer = () => {
    timerStartRef.current = null;
    timerAccumRef.current = 0;
    setTimerDisplay(0);
    setTimerTarget(120);
    setTimerRunning(false);
    persistTimer({startedAt: null, accum: 0, target: 120});
    haptic('light');
  };
  // +30s : ajoute 30 sec à la cible pour repousser le "over" sans toucher au chrono
  const addRestTime = () => {
    setTimerTarget(t => {
      const next = t + 30;
      persistTimer({target: next});
      return next;
    });
    haptic('light');
  };

  const updateExo = (idx, updater) => {
    const newExos = [...session.exercises];
    newExos[idx] = updater({...newExos[idx]});
    onUpdate({...session, exercises: newExos});
  };

  const updateSet = (exIdx, setIdx, key, value) => {
    updateExo(exIdx, ex => {
      const sets = [...ex.sets];
      sets[setIdx] = {...sets[setIdx], [key]: value};
      return {...ex, sets};
    });
  };

  const addSet = (exIdx) => {
    // Hérite des valeurs de la dernière série pour pré-remplir une série supplémentaire
    // du même type. C'est le cas typique : on ajoute une série à la fin d'un exo avec
    // le même poids et la même cible de reps. RIR repart à 1 par défaut (peut différer).
    updateExo(exIdx, ex => {
      const last = ex.sets[ex.sets.length - 1];
      const inherited = last
        ? {weight: last.weight || '', reps: last.reps || '', rir: '1'}
        : {weight: '', reps: '', rir: '1'};
      return {...ex, sets:[...ex.sets, {...inherited, _confirmed:false}]};
    });
    haptic('light');
  };

  const removeSet = (exIdx, setIdx) => {
    updateExo(exIdx, ex => ({...ex, sets: ex.sets.filter((_,i)=>i!==setIdx)}));
    haptic('light');
  };

  const unconfirmSet = (exIdx, setIdx) => {
    updateExo(exIdx, ex => {
      const sets = [...ex.sets];
      sets[setIdx] = {...sets[setIdx], _confirmed:false};
      return {...ex, sets};
    });
    haptic('light');
  };

  const confirmSet = (exIdx, setIdx) => {
    const ex = session.exercises[exIdx];
    const s = ex.sets[setIdx];
    // Fallback : si poids non saisi mais targetWeight présent, on adopte le targetWeight.
    // Évite le bug où le placeholder gris ressemble à une valeur déjà saisie et bloque la confirmation.
    const fallbackWeight = (s.weight === '' || s.weight === null || s.weight === undefined) && ex.targetWeight
      ? String(ex.targetWeight)
      : s.weight;
    const sNormalized = {...s, weight: fallbackWeight};
    if (!isValidSet(sNormalized)) { haptic('warning'); return; }
    // Garde : si l'exo a des modèles dans la lib (lecture live), sélection obligatoire
    const liveLibEx = ex.exId ? exerciseLib.find(l => l.id === ex.exId) : null;
    const liveLibModels = liveLibEx?.models || [];
    if (liveLibModels.length > 0 && !ex.activeModelId) {
      haptic('warning');
      setExoSheetOpen(true); // ouvre la popup pour forcer le choix
      return;
    }
    const newExos = [...session.exercises];
    const newSets = [...newExos[exIdx].sets];
    newSets[setIdx] = {...sNormalized, _confirmed:true};
    newExos[exIdx] = {...newExos[exIdx], sets: newSets};
    onUpdate({...session, exercises: newExos});
    // PR check: scoped to THIS specific set being confirmed. A PR is a property of a single
    // set at the moment it's validated — it's only a PR if it beats everything that came
    // before it (previous sessions + previous sets already confirmed in this same session).
    // Otherwise the "same weight × same reps" on set 2 would re-trigger a PR the user
    // already celebrated on set 1.
    const prs = computePRsForSet(newExos[exIdx], setIdx, journalLogs);
    haptic('success');
    if (prs.length) setLwbPR(prs[0]);
    // Timer no longer starts automatically — user must start it manually via the timer card.
    // Popup dépassement poids cible.
    // La cible effective dépend du modèle actif : si un modèle est sélectionné et a
    // une cible dans modelTargets, c'est celle-là qu'on compare (pas ex.targetWeight
    // qui est la cible générique de l'exo/variante).
    const w = parseFloat(fallbackWeight);
    let effectiveTarget = parseFloat(ex.targetWeight);
    let targetModelId = null;
    if (ex.activeModelId) {
      const mt = (ex.modelTargets || []).find(t => t.modelId === ex.activeModelId);
      if (mt && mt.weight !== '' && mt.weight !== undefined && mt.weight !== null) {
        effectiveTarget = parseFloat(mt.weight);
        targetModelId = ex.activeModelId;
      }
    }
    if (!isNaN(w) && !isNaN(effectiveTarget) && effectiveTarget > 0 && w > effectiveTarget) {
      setUpdateTargetOpen({exIdx, newWeight: w, oldTarget: effectiveTarget, targetModelId, exId: ex.exId});
    }
  };

  /**
   * Compute PRs earned specifically by the set at `targetSetIdx` of `ex`.
   *
   * PR definitions (user-facing semantics, NOT e1RM-based):
   *  - All-time PR: first time this exact **weight** is ever hit on this exo, regardless
   *    of reps. Ex: never touched 100kg before → 100kg × 3 → all-time PR. Later 100kg × 8
   *    → not a PR (100kg already done). 105kg × 2 → all-time PR (new weight threshold).
   *
   *  - Rep PR: first time this **weight is hit for this many reps (or more)** on this exo.
   *    Ex: history max = 80kg × 10 → 80kg × 12 → rep PR (80kg never done at 12 reps).
   *    85kg × 10 → rep PR (85kg never done at 10 reps).
   *
   *  e1RM is intentionally NOT used here. PRs are a raw "did I hit a new weight threshold?"
   *  question. The e1RM-based progression metrics elsewhere (exoTimeline, muscle summaries,
   *  ExoDetail chart) are independent analytics — they measure strength projection, not PRs.
   *
   *  Dedup: if a set triggers both an all-time and a rep PR for its own (w, r), we only
   *  keep the all-time (it's the bigger achievement). A set that's an all-time PR is by
   *  definition also a rep-PR for its rep count (new weight → never seen at this rep count).
   *
   * Scope: history = all previous-session sets + earlier confirmed sets in THIS session
   * (so set 2 matching set 1 of the same session will NOT re-trigger a PR).
   */
  /**
   * Compute PRs earned specifically by the set at `targetSetIdx` of `ex`.
   *
   * PR definitions :
   *  - All-Time PR: weight strictly greater than any weight ever lifted on this exo.
   *    Question : "Did I lift a heavier weight than ever before ?"
   *
   *  - Rep PR: more reps than ever achieved at this exact weight.
   *    Question : "At this exact weight, did I do more reps than my best ever ?"
   *    Requires the weight to have been lifted before — a never-touched weight is just an
   *    all-time PR, not a rep PR (no baseline to compare reps against).
   *
   * Both PR types are independent. A single set can trigger 0, 1 or 2 PRs simultaneously.
   *  - 80x10 -> 90x12 with hist 80x10, 90x8 : both (90>80 = all-time, 12>8 at 90 = rep)
   *  - 80x10 -> 80x12 : rep only (no new weight, but new reps at 80)
   *  - 80x10 -> 90x6  : all-time only (new weight, 90kg never touched before so no rep PR)
   *  - 80x10 -> 80x8  : neither (no new weight, fewer reps than 80x10)
   *
   * Scope: history = all previous-session sets + earlier confirmed sets in THIS session.
   */
  const computePRsForSet = (ex, targetSetIdx, logs) => {
    const key = exoKey(ex);
    const targetSet = ex.sets[targetSetIdx];
    if (!targetSet || !targetSet._confirmed || !isValidSet(targetSet)) return [];

    const historicalSets = [];
    logs.forEach(log => (log.exercises||[]).forEach(hex => {
      if (exoKey(hex) !== key) return;
      (hex.sets||[]).forEach(s => {
        if (!isValidSet(s)) return;
        historicalSets.push({w: parseFloat(s.weight), r: parseInt(s.reps)});
      });
    }));
    (ex.sets || []).forEach((s, i) => {
      if (i >= targetSetIdx) return;
      if (!s._confirmed || !isValidSet(s)) return;
      historicalSets.push({w: parseFloat(s.weight), r: parseInt(s.reps)});
    });

    const w = parseFloat(targetSet.weight);
    const r = parseInt(targetSet.reps);
    const EPS = 0.05; // 50g tolerance for floating-point safety

    // All-Time : new max weight ever (any reps count)
    const histMaxWeight = historicalSets.reduce((m, s) => s.w > m ? s.w : m, 0);
    // Rep PR : new max reps strictly at this exact weight (with EPS tolerance for floats)
    // Si le poids n'a jamais été touché, on ne déclenche pas de rep PR (pas de baseline reps).
    const samePoidsSets = historicalSets.filter(s => Math.abs(s.w - w) <= EPS);
    const histMaxRepsAtW = samePoidsSets.reduce((m, s) => s.r > m ? s.r : m, 0);

    const prs = [];
    const mid = ex.modelId || ex.activeModelId || null;
    // Les deux PRs sont indépendants : une série peut déclencher l'un, l'autre, les deux ou aucun.
    // La toute première série ever sur cet exo n'est jamais un PR (pas de baseline).
    if (historicalSets.length > 0 && w > histMaxWeight + EPS) {
      prs.push({type:'all-time', exName:ex.exName, exId: ex.exId, modelId: mid, weight:w, reps:r});
    }
    // Rep PR : seulement si le poids a déjà été touché ET qu'on a fait plus de reps qu'avant
    if (samePoidsSets.length > 0 && r > histMaxRepsAtW) {
      prs.push({type:'rep', exName:ex.exName, exId: ex.exId, modelId: mid, weight:w, reps:r});
    }
    return prs;
  };

  /**
   * Legacy: computePRs on the whole exo — used at session finalization to populate log.prs
   * for the recap screen. Must match the same weight-threshold semantics as
   * computePRsForSet, because the count and identity of PRs must be consistent between
   * what was shown live (LWB overlay) and what shows up in the recap.
   *
   * Strategy: scan confirmed sets in order, maintaining a "seen" history. Each set checks
   * itself against the history accumulated so far. This exactly mirrors the live behavior
   * and avoids double-counting (set 2 identical to set 1 won't re-trigger).
   */
  const computePRs = (ex, logs) => {
    const key = exoKey(ex);
    const confirmedSets = (ex.sets||[]).filter(s => s._confirmed && isValidSet(s));
    if (!confirmedSets.length) return [];
    const EPS = 0.05;

    // Seed with historical data from previous sessions
    const seen = [];
    logs.forEach(log => (log.exercises||[]).forEach(hex => {
      if (exoKey(hex) !== key) return;
      (hex.sets||[]).forEach(s => {
        if (!isValidSet(s)) return;
        seen.push({w: parseFloat(s.weight), r: parseInt(s.reps)});
      });
    }));

    const prs = [];
    confirmedSets.forEach(s => {
      const w = parseFloat(s.weight);
      const r = parseInt(s.reps);
      const seenLenBefore = seen.length;
      const histMaxWeight = seen.reduce((m, x) => x.w > m ? x.w : m, 0);
      // Reps max déjà fait à ce poids exact (avec tolérance EPS)
      const samePoidsSets = seen.filter(x => Math.abs(x.w - w) <= EPS);
      const histMaxRepsAtW = samePoidsSets.reduce((m, x) => x.r > m ? x.r : m, 0);
      // Capture le modelId actif pour pouvoir afficher la machine sur laquelle le PR a été fait
      const mid = ex.modelId || ex.activeModelId || null;
      // All-Time PR : nouveau poids max — pas de PR sur la 1ère série ever (seen vide)
      if (seenLenBefore > 0 && w > histMaxWeight + EPS) {
        prs.push({type:'all-time', exName:ex.exName, exId: ex.exId, modelId: mid, weight:w, reps:r});
      }
      // Rep PR : nouveau record de reps à ce poids exact (poids déjà touché auparavant)
      if (samePoidsSets.length > 0 && r > histMaxRepsAtW) {
        prs.push({type:'rep', exName:ex.exName, exId: ex.exId, modelId: mid, weight:w, reps:r});
      }
      // Add this set to "seen" so subsequent sets of the same exo compare against it too.
      seen.push({w, r});
    });
    return prs;
  };

  // (replaceByVariant supprimée — la logique est désormais inline dans le PickerSheet onPick ci-dessous)

  const finishSession = () => {
    // Validation: every set row in every exo must be either confirmed (valid weight/reps)
    // or deleted. An exo with zero sets is treated as voluntarily skipped — the user
    // deleted all its sets because they didn't have time, that's a valid choice. We
    // just won't log it.
    //
    // We only block if:
    //   - Some exo still has unconfirmed sets (user needs to either validate or delete them), OR
    //   - The entire session is empty (no exo has any confirmed set → nothing to log)
    const pending = []; // [{exName, pendingCount}]
    session.exercises.forEach(ex => {
      const sets = ex.sets || [];
      if (sets.length === 0) return; // skipped exo, no blocker
      const unconfirmed = sets.filter(s => !(s._confirmed && isValidSet(s))).length;
      if (unconfirmed > 0) {
        pending.push({exName: ex.exName || '?', pendingCount: unconfirmed});
      }
    });

    const hasAnyConfirmed = session.exercises.some(ex =>
      (ex.sets || []).some(s => s._confirmed && isValidSet(s))
    );

    if (pending.length > 0 || !hasAnyConfirmed) {
      setFinishBlocked({
        pending,
        emptyExos: hasAnyConfirmed ? [] : ['Aucun exercice avec série validée']
      });
      haptic('warning');
      return;
    }

    // All good — build log, filtering out exos with no confirmed sets
    const ex = session.exercises.filter(e => (e.sets||[]).some(s => s._confirmed && isValidSet(s)));
    const allPRs = [];
    ex.forEach(e => { const prs = computePRs(e, journalLogs); allPRs.push(...prs); });
    const log = {
      id: session.id, sessionId: session.sessionId, programId: session.programId,
      sessionName: session.sessionName, programName: session.programName, date: session.date,
      durationSec: Math.floor((Date.now() - session.startedAt)/1000),
      exercises: ex.map(e => ({
        id: e.id, exId: e.exId, exName: e.exName, muscleGroup: e.muscleGroup,
        modelId: e.activeModelId || null, // modèle utilisé pour cet exo dans cette séance
        sets: (e.sets||[]).filter(s => s._confirmed && isValidSet(s)).map(s => ({
          weight: parseFloat(s.weight), reps: parseInt(s.reps),
          rir: (s.rir !== '' && s.rir !== null && s.rir !== undefined) ? parseInt(s.rir) : null
        }))
      })),
      prs: allPRs
    };
    // La note de séance a servi son but : on la consomme (persistance = jusqu'à la
    // prochaine séance de ce type, puis disparait après validation).
    if (session.sessionNote) {
      clearSessionNote(session.programId, session.sessionId);
    }
    haptic('success');
    onSave(log);
  };

  // Ré-hydrate les exos de la séance avec les données live de la LIB UNIQUEMENT.
  // Ça garantit que les renommages/réglages/modèles ajoutés dans la biblio se propagent
  // immédiatement. En revanche, les PARAMÈTRES (targetWeight, machine, repRange, targetSets,
  // variants, modelTargets) restent FIGÉS dès le démarrage de la séance : modifier le
  // programme pendant une séance en cours ne change pas la séance en cours (ne s'appliquera
  // qu'à la prochaine). Évite l'écrasement des modifs locales de la séance.
  const liveExercises = useMemo(() => {
    return session.exercises.map(ex => {
      const libEx = ex.exId ? exerciseLib.find(l => l.id === ex.exId) : null;
      const libModels = libEx?.models || [];
      // Si l'activeModelId pointe vers un modèle supprimé de la lib, on reset
      const validActiveModelId = libModels.find(m => m.id === ex.activeModelId)
        ? ex.activeModelId
        : null;
      return {
        ...ex,
        // Dérivés de la biblio (resync à chaque render — réglage, nom, muscle, modèles dispo)
        exName: libEx?.name || ex.exName,
        muscleGroup: libEx?.muscleGroup || ex.muscleGroup,
        setting: libEx?.setting || '',
        libModels,
        isCompound: libEx?.compound !== undefined ? libEx.compound : ex.isCompound,
        // Params séance : on garde tels quels (targetWeight, machine, targetSets, repRange,
        // variants, modelTargets, sets, _confirmed, etc.)
        activeModelId: validActiveModelId
      };
    });
  }, [session.exercises, exerciseLib]);

  // Pour le reste du composant, on utilise `liveExercises` comme source de vérité
  // au lieu de `session.exercises`. Mais pour les writes (updateExo etc.), on continue
  // à passer par session.exercises car c'est ça qu'on persiste.
  const currentExo = liveExercises[session.currentExoIdx];
  if (!currentExo) {
    return h('div', {className:'app-body'},
      h('div', {className:'empty-state'},
        h('div', {className:'title'}, 'Aucun exercice dans cette séance'),
        h('button', {className:'btn btn-ghost', style:{marginTop:16}, onClick:onPause}, 'Retour')));
  }
  const switchExo = (idx) => {
    // Le timer SURVIT au switch d'exo : pas de reset. L'utilisateur peut le reset manuellement
    // depuis la carte timer si besoin.
    onUpdate({...session, currentExoIdx: idx});
    haptic('light');
  };
  const rrLabel = currentExo.repRange ? `${currentExo.repRange[0]}-${currentExo.repRange[1]} reps` : null;

  // Calcul dynamique de la dernière performance : recalculé à chaque changement de variante
  // ou de modèle. Utilise exoKey complet (avec modelId si actif) pour ne récupérer que les
  // séries faites sur la même machine — sinon les courbes seraient bruitées.
  const liveLastPerformance = useMemo(() => {
    const k = exoKey({
      exId: currentExo.exId,
      exName: currentExo.exName,
      modelId: currentExo.activeModelId
    });
    for (let i = journalLogs.length - 1; i >= 0; i--) {
      const log = journalLogs[i];
      const found = (log.exercises||[]).find(ex => exoKey(ex) === k && (ex.sets||[]).some(isValidSet));
      if (found) {
        return { date: log.date, sets: (found.sets||[]).filter(isValidSet) };
      }
    }
    return null;
  }, [currentExo.exId, currentExo.exName, currentExo.activeModelId, journalLogs]);

  return h('div', {className:'app-body'},
    h(LWBOverlay, {pr: lwbPR, lib: exerciseLib, onClose:()=>{ setLwbPR(null); }}),

    // ============================================================
    // HEADER COMPACT 1 LIGNE : ← · dot · nom séance · chrono · ✓ Terminer
    // Annuler déplacé dans l'ExoSheet (danger zone)
    // ============================================================
    h('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
      h('button', {className:'press-icon', onClick:onPause,
        style:{color:'var(--ink-2)',fontSize:18,padding:4,flex:'0 0 auto',display:'inline-flex',alignItems:'center'},
        title:'Retour au journal'}, ICONS.left),
      h('div', {style:{flex:1,display:'flex',alignItems:'center',gap:6,minWidth:0}},
        h('span', {style:{
          display:'inline-block',width:6,height:6,borderRadius:'50%',background:'var(--success)',flex:'0 0 auto',
          animation:'pulse 1.8s infinite'
        }}),
        h('span', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',letterSpacing:'-0.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
          session.sessionName),
        h(SessionElapsed, {startedAt: session.startedAt,
          style:{fontSize:11,color:'var(--ink-3)',fontFamily:'var(--f-mono)',fontWeight:600,flex:'0 0 auto'}})
      ),
      h('button', {className:'btn btn-sm pressable', onClick:()=>setDiscardOpen(true),
        style:{flex:'0 0 auto', background:'rgba(255,59,72,.12)', color:'var(--danger)', border:'1px solid rgba(255,59,72,.3)'},
        title:'Annuler la séance'},
        ICONS.x),
      h('button', {className:'btn btn-primary btn-sm pressable', onClick:finishSession, style:{flex:'0 0 auto'}},
        ICONS.check, ' Fin')
    ),

    // ============================================================
    // HEADER NOTE — bandeau orange fin, visible si une note existe pour
    // cette séance. Croix pour le masquer (la note stockée sera consommée
    // à la fin de la séance validée, pas ici).
    // ============================================================
    noteHeaderVisible && session.sessionNote && h('div', {
      style:{
        display:'flex', alignItems:'center', gap:10, marginBottom:10,
        padding:'12px', borderRadius:10,
        background:'linear-gradient(135deg, rgba(252,76,2,.16), rgba(252,76,2,.08))',
        border:'1px solid rgba(252,76,2,.3)'
      }
    },
      h('span', {style:{color:'var(--accent-hi)', flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', width:18, height:18}}, ICONS.edit),
      h('div', {style:{
        flex:1, minWidth:0, fontSize:13, fontWeight:600, color:'var(--ink-0)',
        lineHeight:1.35, whiteSpace:'pre-wrap', wordBreak:'break-word'
      }}, session.sessionNote),
      h('button', {
        className:'press-icon',
        onClick: () => { setNoteHeaderVisible(false); haptic('light'); },
        style:{color:'var(--accent-hi)', flex:'0 0 auto', display:'flex', alignItems:'center', justifyContent:'center', width:22, height:22, opacity:.85},
        title:'Masquer'
      }, ICONS.x)
    ),

    // ============================================================
    // CARTE EXO COMPACTE — tap ouvre l'ExoSheet
    // Affiche les variantes planifiées en "ou ..." (max 2 visibles)
    // ============================================================
    (() => {
      // Résout la liste des variantes planifiées *autres* que l'actif
      const variants = currentExo.variants || [];
      const otherVariants = variants.map((v, vi) => {
        const libEx = v.exId ? exerciseLib.find(l => l.id === v.exId) : null;
        const name = libEx?.name || v.name || ('Variante ' + (vi+1));
        // active = variante actuellement choisie
        const active = currentExo.activeVariant === vi || (currentExo.exId && v.exId === currentExo.exId);
        return {vi, name, active, libEx};
      }).filter(x => !x.active);

      const visibleOther = otherVariants.slice(0, 2);
      const hiddenCount = otherVariants.length - visibleOther.length;

      return h('button', {
        key: session.currentExoIdx,
        className:'mv-exo-switch press-card',
        onClick: () => setExoSheetOpen(true),
        style:{
          width:'100%', textAlign:'left', display:'block',
          padding:'10px 12px', marginBottom:10,
          background:'linear-gradient(180deg, rgba(252,76,2,.08), rgba(252,76,2,.02))',
          border:'1px solid rgba(252,76,2,.22)', borderRadius:12
        }
      },
        // Ligne exo actif
        h('div', {style:{display:'flex',alignItems:'center',gap:8}},
          h('span', {style:{
            color:'var(--ink-3)',fontSize:10,fontFamily:'var(--f-mono)',fontWeight:700,
            background:'rgba(255,255,255,.05)',padding:'3px 6px',borderRadius:4,flex:'0 0 auto'
          }}, (session.currentExoIdx+1) + '/' + session.exercises.length),
          h('div', {style:{flex:1,minWidth:0}},
            h('div', {style:{
              fontSize:16,fontWeight:700,color:'var(--ink-0)',letterSpacing:'-0.02em',
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.2
            }}, currentExo.exName),
            h('div', {style:{fontSize:11,color:'var(--ink-2)',fontWeight:500,marginTop:2}},
              currentExo.muscleGroup,
              currentExo.isCompound ? ' · poly' : '',
              rrLabel ? ' · ' + rrLabel : '',
              currentExo.targetWeight ? ' · cible ' + currentExo.targetWeight + ' kg' : ''),
            // Ligne 3 : nom du modèle actif OU avertissement "choisir une machine"
            (() => {
              const hasModels = (currentExo.libModels?.length || 0) > 0;
              const activeModel = currentExo.activeModelId
                ? (currentExo.libModels||[]).find(m => m.id === currentExo.activeModelId)
                : null;
              const setting = activeModel?.setting || (!hasModels ? currentExo.setting : null);
              // Cas 1 : exo avec modèles, aucun choisi → invitation à sélectionner
              if (hasModels && !activeModel) {
                return h('div', {style:{
                  fontSize:10, fontWeight:700, color:'var(--accent-hi)', marginTop:4,
                  display:'flex', alignItems:'center', gap:4
                }},
                  '⚠ Choisis une machine');
              }
              // Cas 2 : modèle actif → afficher nom + réglage
              if (!activeModel && !setting) return null;
              return h('div', {style:{
                fontSize:10,color:'var(--ink-3)',marginTop:3,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
              }},
                activeModel && h('span', {style:{fontWeight:700,color:'var(--ink-2)'}}, activeModel.name),
                activeModel && setting && ' · ',
                setting && h('span', {style:{fontStyle:'italic',display:'inline-flex',alignItems:'center'}}, ICONS.tune, setting)
              );
            })()
          ),
          h('span', {className:'mv-chev', style:{color:'var(--ink-3)',fontSize:14,flex:'0 0 auto'}}, '▾')
        ),
        // Lignes "ou" pour les variantes planifiées
        otherVariants.length > 0 && h('div', {style:{
          marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,.05)'
        }},
          visibleOther.map(o =>
            h('div', {key:o.vi, style:{
              display:'flex',alignItems:'center',gap:8,padding:'2px 0',fontSize:12
            }},
              h('span', {style:{
                flex:'0 0 auto',width:22,textAlign:'center',fontWeight:700,
                color:'var(--accent-hi)',fontSize:11,letterSpacing:'-0.01em'
              }}, 'ou'),
              h('span', {style:{
                flex:1,color:'var(--ink-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
              }}, o.name)
            )
          ),
          hiddenCount > 0 && h('div', {style:{
            display:'flex',alignItems:'center',gap:8,padding:'2px 0',fontSize:11,color:'var(--ink-3)'
          }},
            h('span', {style:{flex:'0 0 auto',width:22,textAlign:'center',fontWeight:700,color:'var(--accent-hi)'}}, 'ou'),
            h('span', null, hiddenCount + ' autre' + (hiddenCount>1?'s':'') + ' variante' + (hiddenCount>1?'s':''))
          )
        )
      );
    })(),

    // ============================================================
    // TIMER DE REPOS gros central (cible 2min, +30s, reset)
    // ============================================================
    h(RestTimer, {
      seconds: timerDisplay,
      running: timerRunning,
      targetSeconds: timerTarget,
      onStart: startTimer,
      onStop: stopTimer,
      onReset: resetTimer,
      onAddRest: addRestTime
    }),

    // ============================================================
    // DERNIÈRE FOIS (chips inline compactes) — recalculé à chaque variante
    // ============================================================
    liveLastPerformance && h('div', {style:{
      display:'flex',flexWrap:'wrap',gap:5,alignItems:'center',marginBottom:10,paddingLeft:2
    }},
      h('span', {style:{fontSize:10,color:'var(--ink-3)',fontWeight:500}}, 'la dernière :'),
      liveLastPerformance.sets.map((s,i) => h('span', {
        key:i,
        style:{
          fontSize:11,fontWeight:700,color:'var(--ink-1)',
          padding:'2px 6px',background:'rgba(255,255,255,.05)',borderRadius:4,
          fontVariantNumeric:'tabular-nums'
        }
      }, s.weight+'×'+s.reps + (s.rir!==undefined && s.rir!==null ? ' @'+s.rir : ''))),
      h('span', {style:{fontSize:10,color:'var(--ink-4)'}}, '· ' + formatRelative(liveLastPerformance.date))
    ),

    // ============================================================
    // SÉRIES
    // ============================================================
    h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'6px 0 8px'}},
      h('div', {className:'title-sm'}, 'Séries'),
      h('div', {className:'meta'},
        currentExo.sets.filter(s => s._confirmed && isValidSet(s)).length + ' / ' + currentExo.sets.length + ' confirmées')),

    h('div', {style:{display:'flex',flexDirection:'column',gap:6}},
      currentExo.sets.map((s, idx) => {
        const prevAllConfirmed = currentExo.sets.slice(0, idx).every(x => x._confirmed && isValidSet(x));
        // Lock si série précédente non confirmée OU si modèle requis mais pas choisi
        const modelRequired = (currentExo.libModels?.length || 0) > 0 && !currentExo.activeModelId;
        const locked = (idx > 0 && !prevAllConfirmed) || modelRequired;
        return h(SetRow, {
          key: idx, set: s, idx,
          confirmed: s._confirmed && isValidSet(s),
          active: !s._confirmed && idx === currentExo.sets.findIndex(x => !x._confirmed),
          locked,
          targetWeight: currentExo.targetWeight,
          repRange: currentExo.repRange,
          onChange: (key,val) => updateSet(session.currentExoIdx, idx, key, val),
          onConfirm: () => confirmSet(session.currentExoIdx, idx),
          onUnconfirm: () => unconfirmSet(session.currentExoIdx, idx),
          onRemove: () => removeSet(session.currentExoIdx, idx)
        });
      }),
      h('button', {className:'btn btn-ghost btn-sm pressable', style:{marginTop:6},
        onClick: () => addSet(session.currentExoIdx)
      }, ICONS.plus, ' Série')),

    // ============================================================
    // EXO SHEET — popup complète (variantes + séance + annuler)
    // Ouverture par tap sur la carte exo
    // ============================================================
    h(Sheet, {
      open: exoSheetOpen, onClose: () => setExoSheetOpen(false), title: null
    },
      // ============ SECTION MACHINE / MODÈLE ============
      // Si l'exo a des modèles dans la lib, on les présente en radio select.
      // Choix avant la 1re série, ensuite la machine est verrouillée pour tout l'exo.
      ((currentExo.libModels?.length || 0) > 0) && (() => {
        const libModels = currentExo.libModels || [];
        const programmed = currentExo.modelTargets || [];
        const someConfirmed = (currentExo.sets || []).some(s => s._confirmed && isValidSet(s));
        const confirmedCount = (currentExo.sets || []).filter(s => s._confirmed && isValidSet(s)).length;
        return h('div', null,
          h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}},
            h('span', {className:'label'}, 'Machine'),
            h('span', {style:{fontSize:10, fontWeight:600,
              color: currentExo.activeModelId ? 'var(--ink-3)' : 'var(--accent-hi)'
            }},
              someConfirmed ? 'séries déjà validées'
                : currentExo.activeModelId ? 'modifiable jusqu\'à la 1ʳᵉ série'
                : '⚠ obligatoire avant la 1ʳᵉ série')),
          h('div', {style:{display:'flex',flexDirection:'column',gap:5,marginBottom:14}},
            libModels.map(m => {
              const target = programmed.find(t => t.modelId === m.id);
              const active = currentExo.activeModelId === m.id;
              const doSwitchModel = () => {
                updateExo(session.currentExoIdx, ex => ({
                  ...ex,
                  activeModelId: m.id,
                  targetWeight: target?.weight ? parseFloat(target.weight) : ex.targetWeight,
                  // Si sets confirmés (autre machine) : on wipe TOUT, les anciennes séries
                  // sont invalides pour cette nouvelle machine.
                  sets: someConfirmed
                    ? ex.sets.map(() => ({weight:'', reps:'', rir:'1', _confirmed:false}))
                    : ex.sets.map(s => s._confirmed ? s : ({...s, weight:''}))
                }));
                haptic('medium');
                setExoSheetOpen(false);
              };
              return h('button', {
                key: m.id,
                className: 'press-row',
                onClick: () => {
                  if (active) { setExoSheetOpen(false); return; }
                  if (someConfirmed) {
                    setSwitchVariantConfirm({count: confirmedCount, name: m.name, doSwitch: doSwitchModel});
                  } else {
                    doSwitchModel();
                  }
                },
                style: {
                  display:'flex',alignItems:'center',gap:10,
                  padding:'10px 12px',borderRadius:10,textAlign:'left',width:'100%',
                  background: active ? 'rgba(252,76,2,.08)' : 'rgba(255,255,255,.03)',
                  border: '1px solid ' + (active ? 'rgba(252,76,2,.35)' : 'rgba(255,255,255,.06)'),
                  cursor: 'pointer'
                }
              },
                h('span', {style:{
                  width:14,height:14,borderRadius:'50%',flex:'0 0 auto',
                  display:'inline-flex',alignItems:'center',justifyContent:'center',
                  background: active ? 'var(--accent)' : 'transparent',
                  border: active ? 'none' : '1.5px solid rgba(255,255,255,.25)',
                  color:'#fff',fontSize:9,fontWeight:700
                }}, active ? '✓' : ''),
                h('div', {style:{flex:1,minWidth:0}},
                  h('div', {style:{fontSize:13,fontWeight:active?700:600,color:'var(--ink-0)',letterSpacing:'-0.01em'}},
                    m.name),
                  m.setting && h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:1,fontStyle:'italic',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center'}},
                    ICONS.tune, m.setting),
                  target?.weight && h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:1}},
                    'cible ' + target.weight + ' kg')
                )
              );
            })
          )
        );
      })(),

      // Section VARIANTES (si l'exo a des variantes planifiées)
      (currentExo.variants?.length > 0) && h('div', null,
        h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}},
          h('span', {className:'label'}, 'Variantes'),
          h('span', {className:'meta'}, currentExo.muscleGroup)
        ),
        h('div', {style:{display:'flex',flexDirection:'column',gap:5,marginBottom:8}},
          (currentExo.variants||[]).map((v, vi) => {
            const libEx = v.exId ? exerciseLib.find(l => l.id === v.exId) : null;
            const name = libEx?.name || v.name || ('Variante ' + (vi+1));
            const active = currentExo.activeVariant === vi || (currentExo.exId && v.exId === currentExo.exId);
            return h('button', {
              key: vi,
              className: 'press-row',
              onClick: () => {
                if (active) { setExoSheetOpen(false); return; }
                // Si des sets sont confirmés, demander confirmation avant d'effacer
                const confirmedCount = (currentExo.sets||[]).filter(s => s._confirmed && isValidSet(s)).length;
                const doSwitch = () => {
                  updateExo(session.currentExoIdx, ex => ({
                    ...ex,
                    activeVariant: vi,
                    exId: v.exId || ex.exId,
                    exName: libEx?.name || ex.exName,
                    muscleGroup: libEx?.muscleGroup || ex.muscleGroup,
                    subGroup: libEx?.subGroup || ex.subGroup,
                    isCompound: libEx?.compound || false,
                    targetWeight: v.weight || ex.targetWeight,
                    libModels: libEx?.models || [],
                    setting: libEx?.setting || '',
                    modelTargets: v.modelTargets || [],
                    activeModelId: null, // reset car on change d'exo
                    // Si confirmé : on wipe TOUS les sets (anciennes séries sur ancienne variante invalides
                    // pour la nouvelle). Sinon : juste reset des inputs non-confirmés.
                    sets: confirmedCount > 0
                      ? ex.sets.map(() => ({weight:'', reps:'', rir:'1', _confirmed:false}))
                      : ex.sets.map(s => s._confirmed ? s : ({...s, weight:''}))
                  }));
                  haptic('medium');
                  setExoSheetOpen(false);
                };
                if (confirmedCount > 0) {
                  setSwitchVariantConfirm({count: confirmedCount, name, doSwitch});
                } else {
                  doSwitch();
                }
              },
              style: {
                display:'flex',alignItems:'center',gap:10,
                padding:'10px 12px',borderRadius:10,textAlign:'left',width:'100%',
                background: active ? 'rgba(252,76,2,.08)' : 'rgba(255,255,255,.03)',
                border: '1px solid ' + (active ? 'rgba(252,76,2,.35)' : 'rgba(255,255,255,.08)')
              }
            },
              h('span', {style:{
                width:16,height:16,borderRadius:'50%',flex:'0 0 auto',
                display:'inline-flex',alignItems:'center',justifyContent:'center',
                background: active ? 'var(--accent)' : 'transparent',
                border: active ? 'none' : '1.5px solid rgba(255,255,255,.25)',
                color:'#fff',fontSize:10,fontWeight:700
              }}, active ? '✓' : ''),
              h('div', {style:{flex:1,minWidth:0}},
                h('div', {style:{
                  fontSize:13,fontWeight:active?700:600,color:'var(--ink-0)',letterSpacing:'-0.01em',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
                }}, name),
                active && h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:1}}, 'actif')
              )
            );
          })
        ),
        // Bouton ajouter variante libre (picker)
        h('button', {
          className:'press-row',
          onClick: () => { setPickerOpen(true); },
          style:{
            width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:8,
            padding:'10px 12px',borderRadius:10,marginBottom:16,
            background:'rgba(255,255,255,.03)',
            border:'1px dashed rgba(255,255,255,.12)',
            color:'var(--ink-2)',fontSize:12,fontWeight:500
          }
        },
          h('span', {style:{fontSize:14,color:'var(--ink-2)'}}, '＋'),
          h('span', {style:{flex:1}}, 'Ajouter une variante (biblio)'),
          h('span', {style:{color:'var(--ink-3)'}}, '›')
        )
      ),

      // Section SÉANCE (liste exos de la séance)
      h('div', {className:'label', style:{marginBottom:8}}, 'Séance — exercices'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:4,marginBottom:16}},
        session.exercises.map((ex, i) => {
          const done = (ex.sets||[]).filter(s => s._confirmed && isValidSet(s)).length;
          const total = (ex.sets||[]).length;
          const isCurrent = i === session.currentExoIdx;
          const allDone = total > 0 && done === total;
          return h('button', {
            key: ex.id,
            className:'press-row',
            onClick: () => { switchExo(i); setExoSheetOpen(false); },
            style:{
              display:'flex',alignItems:'center',gap:10,
              padding:'10px 12px',borderRadius:10,textAlign:'left',width:'100%',
              background: isCurrent ? 'rgba(252,76,2,.08)' : 'var(--bg-2)',
              border: isCurrent ? '1px solid rgba(252,76,2,.3)' : '1px solid var(--line)'
            }
          },
            h('span', {style:{
              fontFamily:'var(--f-mono)',fontSize:10,fontWeight:700,flex:'0 0 auto',
              color: isCurrent ? 'var(--accent)' : 'var(--ink-3)',
              padding:'3px 6px',borderRadius:4,
              background: isCurrent ? 'rgba(252,76,2,.15)' : 'var(--bg-3)'
            }}, pad2(i+1)),
            h('span', {style:{
              flex:1,fontSize:13,fontWeight:isCurrent?700:600,color:'var(--ink-0)',
              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
            }}, ex.exName),
            h('span', {style:{
              fontSize:11,fontWeight:700,flex:'0 0 auto',
              color: allDone ? 'var(--success)' : (isCurrent ? 'var(--accent)' : 'var(--ink-3)'),
              fontVariantNumeric:'tabular-nums'
            }}, done+'/'+total)
          );
        })
      )

      // Annuler la séance est maintenant dans le header, plus besoin de doublon ici
    ),

    // ============================================================
    // PICKER SHEET — ajout de variante libre (filtré par muscle group)
    // ============================================================
    h(PickerSheet, {
      open: pickerOpen, onClose: () => setPickerOpen(false),
      title: "Choisir un exo — " + (currentExo.muscleGroup || ''), search: true,
      options: exerciseLib
        .filter(l => l.muscleGroup === currentExo.muscleGroup && l.id !== currentExo.exId)
        .map(l => ({
          value: l.id, label: l.name,
          sub: (l.subGroup ? l.subGroup + ' · ' : '') + (l.compound ? 'poly' : 'iso')
        })),
      onPick: (id) => {
        const newLibEx = exerciseLib.find(l => l.id === id);
        if (!newLibEx) return;
        // Cherche une cible existante pour cette variante, dans l'ordre :
        //  1. modelTargets programmés dans le programme (poids du 1er modèle avec cible)
        //  2. choices[].weight programmé (ancien système, fallback)
        //  3. dernière perf loggée sur cet exo (top set)
        //  4. rien (vide) si aucune donnée
        const findTargetForVariant = () => {
          if (currentProgram) {
            const progSession = currentProgram.sessions?.find(s => s.id === session.sessionId);
            const matchEx = progSession?.exercises?.find(pe => pe.choices?.some(c => c.exId === id));
            if (matchEx) {
              const mt = (matchEx.modelTargets || []).find(t => t.weight);
              if (mt?.weight) return parseFloat(mt.weight);
              const ch = (matchEx.choices || []).find(c => c.exId === id && c.weight);
              if (ch?.weight) return parseFloat(ch.weight);
            }
          }
          // Dernière perf loggée sur cet exo (top set)
          const tl = exoTimeline(journalLogs, 'lib:' + id, 'all');
          if (tl.length > 0) {
            const last = tl[tl.length - 1];
            if (last?.weight) return parseFloat(last.weight);
          }
          return '';
        };
        const variantTarget = findTargetForVariant();
        // Ajoute la variante au currentExo (en plus des planifiées) + switche dessus
        updateExo(session.currentExoIdx, ex => {
          const variants = [...(ex.variants||[])];
          const newIdx = variants.length;
          variants.push({exId: newLibEx.id, name: newLibEx.name, weight: variantTarget});
          return {
            ...ex,
            variants,
            activeVariant: newIdx,
            exId: newLibEx.id,
            exName: newLibEx.name,
            muscleGroup: newLibEx.muscleGroup,
            subGroup: newLibEx.subGroup || null,
            isCompound: !!newLibEx.compound,
            // Recharger modèles + réglage de la variante choisie
            libModels: newLibEx.models || [],
            setting: newLibEx.setting || '',
            modelTargets: [], // pas programmé, l'user pourra choisir parmi les modèles dispo
            activeModelId: null,
            targetWeight: variantTarget, // cible propre à la variante (vide si aucune donnée)
            sets: ex.sets.map(s => s._confirmed ? s : ({...s, weight:''}))
          };
        });
        setPickerOpen(false);
        setExoSheetOpen(false);
        haptic('medium');
      }
    }),

    h(ConfirmSheet, {
      open: discardOpen, onClose: ()=>setDiscardOpen(false),
      onConfirm: onDiscard, title: 'Annuler la séance en cours ?',
      message: 'Les séries saisies seront perdues. Utilise le bouton retour pour juste mettre en pause.'
    }),

    /* Switch variante avec séries confirmées */
    h(ConfirmSheet, {
      open: !!switchVariantConfirm,
      onClose: () => setSwitchVariantConfirm(null),
      onConfirm: () => {
        switchVariantConfirm?.doSwitch();
        setSwitchVariantConfirm(null);
      },
      title: 'Changer de variante ?',
      message: switchVariantConfirm
        ? 'Tu as ' + switchVariantConfirm.count + ' série' + (switchVariantConfirm.count>1?'s':'') + ' déjà validée' + (switchVariantConfirm.count>1?'s':'') + '. Switcher vers « ' + switchVariantConfirm.name + ' » va les effacer.'
        : '',
      confirmLabel: 'Effacer et switcher'
    }),

    /* Popup dépassement poids cible */
    h(ConfirmSheet, {
      open: !!updateTargetOpen,
      onClose: () => setUpdateTargetOpen(null),
      onConfirm: () => {
        if (!updateTargetOpen) return;
        const {exIdx, newWeight, targetModelId, exId} = updateTargetOpen;
        const ex = session.exercises[exIdx];
        // Update live session : cible du modèle actif (modelTargets) ou targetWeight générique
        updateExo(exIdx, e => {
          if (targetModelId) {
            const mt = (e.modelTargets || []).map(t =>
              t.modelId === targetModelId ? {...t, weight: newWeight} : t);
            if (!mt.find(t => t.modelId === targetModelId)) {
              mt.push({modelId: targetModelId, weight: newWeight});
            }
            return {...e, modelTargets: mt, targetWeight: newWeight};
          }
          return {...e, targetWeight: newWeight};
        });
        // Update le programme pour que la cible persiste à la prochaine séance.
        // IMPORTANT : la séance lit les cibles depuis modelTargets quand un modèle est
        // actif, donc c'est là qu'il faut écrire (pas dans choices[].weight qui n'est
        // plus lu). Sinon la cible resterait inchangée la fois suivante = le bug.
        if (session.programId && ex.progId) {
          state.setPrograms(state.programs.map(p => {
            if (p.id !== session.programId) return p;
            const sessions = (p.sessions||[]).map(ss => {
              if (ss.id !== session.sessionId) return ss;
              const exercises = (ss.exercises||[]).map(pex => {
                if (pex.id !== ex.progId) return pex;
                if (targetModelId) {
                  // Écrit dans modelTargets (le bon endroit)
                  const mts = [...(pex.modelTargets || [])];
                  const existing = mts.find(t => t.modelId === targetModelId);
                  if (existing) {
                    existing.weight = newWeight;
                  } else {
                    mts.push({modelId: targetModelId, weight: newWeight});
                  }
                  return {...pex, modelTargets: mts};
                } else {
                  // Pas de modèle actif : ancien système choices[].weight
                  const choices = (pex.choices||[]).map(c => c.exId === exId ? {...c, weight: newWeight} : c);
                  return {...pex, choices};
                }
              });
              return {...ss, exercises};
            });
            return {...p, sessions};
          }));
        }
        setUpdateTargetOpen(null);
        haptic('success');
      },
      title: 'Tu as dépassé la cible ',
      message: updateTargetOpen
        ? `${updateTargetOpen.newWeight} kg > cible ${updateTargetOpen.oldTarget} kg. Mettre à jour la cible du programme pour la prochaine fois ?`
        : ''
    }),

    /* Popup "Impossible de terminer la séance" — explains exactly what's missing.
       Two cases: (a) pending sets to resolve, (b) no exo at all has a validated set. */
    h(Sheet, {
      open: !!finishBlocked,
      onClose: () => setFinishBlocked(null),
      title: 'Séance incomplète'
    },
      finishBlocked && h('div', null,
        h('p', {className:'body', style:{marginTop:0,marginBottom:14,color:'var(--ink-1)'}},
          finishBlocked.pending.length > 0
            ? 'Pour chaque série en cours, tu dois soit la valider avec ✓, soit la supprimer avec la corbeille. Un exo dont toutes les séries sont supprimées sera ignoré.'
            : 'Aucune série validée. Ajoute au moins une série sur un exercice, ou annule la séance si tu ne veux rien enregistrer.'),

        finishBlocked.pending.length > 0 && h('div', {style:{marginBottom:14}},
          h('div', {className:'label', style:{marginBottom:8}}, 'Séries à valider ou supprimer'),
          h('div', {style:{display:'flex',flexDirection:'column',gap:4}},
            finishBlocked.pending.map((p, i) => h('div', {key:i,
              style:{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg-3)',borderRadius:8,fontSize:13}},
              h('span', {style:{color:'var(--ink-1)',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:10}}, p.exName),
              h('span', {style:{color:'var(--accent)',fontWeight:800,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}},
                p.pendingCount + ' série' + (p.pendingCount>1?'s':'')))))),

        h('button', {className:'btn btn-primary btn-full press-btn',
          onClick: () => setFinishBlocked(null)},
          'Compris')
      )
    )
  );
}

function SetRow({set, idx, confirmed, active, locked, targetWeight, repRange, onChange, onConfirm, onUnconfirm, onRemove}) {
  const prevConfirmed = useRef(confirmed);
  const [justDone, setJustDone] = useState(false);
  useEffect(() => {
    if (confirmed && !prevConfirmed.current) {
      setJustDone(true);
      const t = setTimeout(() => setJustDone(false), 450);
      return () => clearTimeout(t);
    }
    prevConfirmed.current = confirmed;
  }, [confirmed]);
  useEffect(() => { prevConfirmed.current = confirmed; });

  const rowClass = 'set-row'
    + (confirmed?' done':'')
    + (active && !confirmed && !locked?' active':'')
    + (justDone?' just-done':'')
    + (locked?' locked':'');

  // Stepper helpers.
  //  - Poids: ±2.5 kg (standard plate increment)
  //  - Reps / RIR: ±1
  //  - If the current value is empty, start from a sensible base:
  //      weight → targetWeight (or 0), reps → 10, rir → 1
  //  - Clamp to 0 (no negative values make sense). Weight keeps one decimal precision.
  const clampNonNeg = (n) => n < 0 ? 0 : n;
  const stepWeight = (dir) => {
    if (locked) return;
    const cur = parseFloat(set.weight);
    const base = isNaN(cur) ? (parseFloat(targetWeight) || 0) : cur;
    const next = clampNonNeg(Math.round((base + dir * 2.5) * 10) / 10);
    onChange('weight', String(next));
    haptic('light');
  };
  const stepReps = (dir) => {
    if (locked) return;
    const cur = parseInt(set.reps);
    const base = isNaN(cur) ? 10 : cur;
    const next = clampNonNeg(base + dir);
    onChange('reps', String(next));
    haptic('light');
  };
  const stepRir = (dir) => {
    if (locked) return;
    const cur = parseInt(set.rir);
    const base = isNaN(cur) ? 1 : cur;
    const next = clampNonNeg(base + dir);
    onChange('rir', String(next));
    haptic('light');
  };

  // Shared chevron SVGs for the steppers — thin, matches the visual weight of existing
  // chevrons in the app (see ICONS.chevDown).
  const chevUp = h('svg', {width:10, height:10, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:3, strokeLinecap:'round', strokeLinejoin:'round'},
    h('polyline', {points:'6 15 12 9 18 15'}));
  const chevDn = h('svg', {width:10, height:10, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:3, strokeLinecap:'round', strokeLinejoin:'round'},
    h('polyline', {points:'6 9 12 15 18 9'}));

  // Renders the stepper column + input as a flex row. Stepper is a compact 16px column
  // on the LEFT with two buttons stacked vertically, then the input takes the rest of
  // the width. We put the stepper on the left (not the right) so it visually belongs
  // to ITS field rather than looking like it belongs to the next field over.
  const fieldWithStepper = (input, onUp, onDown) => {
    if (confirmed) return input;
    return h('div', {style:{display:'flex',alignItems:'center',gap:3,minWidth:0}},
      h('div', {style:{display:'flex', flexDirection:'column', flex:'0 0 16px', gap:1}},
        h('button', {
          className:'stp-btn', onClick: onUp, disabled: locked,
          'aria-label':'Augmenter',
          style:{
            width:16, height:14, padding:0, display:'flex', alignItems:'center', justifyContent:'center',
            color: locked ? 'var(--ink-4)' : 'var(--ink-2)',
            background:'rgba(255,255,255,.04)', borderRadius:4, border:0,
            cursor: locked ? 'not-allowed' : 'pointer'
          }
        }, chevUp),
        h('button', {
          className:'stp-btn', onClick: onDown, disabled: locked,
          'aria-label':'Diminuer',
          style:{
            width:16, height:14, padding:0, display:'flex', alignItems:'center', justifyContent:'center',
            color: locked ? 'var(--ink-4)' : 'var(--ink-2)',
            background:'rgba(255,255,255,.04)', borderRadius:4, border:0,
            cursor: locked ? 'not-allowed' : 'pointer'
          }
        }, chevDn)
      ),
      h('div', {style:{flex:1, minWidth:0}}, input)
    );
  };

  const poidsInput = confirmed
    ? h('div', {className:'fval'}, set.weight, h('span',{className:'sfx'},' kg'))
    : h('input', {type:'number', step:'0.5', inputMode:'decimal', className:'ghost',
        placeholder: targetWeight ? targetWeight+'' : '—',
        disabled: locked,
        value: set.weight, onChange: e => onChange('weight', e.target.value)});

  const repsInput = confirmed
    ? h('div', {className:'fval'}, set.reps)
    : h('input', {type:'number', inputMode:'numeric', className:'ghost',
        placeholder: repRange ? repRange.join('-') : '—',
        disabled: locked,
        value: set.reps, onChange: e => onChange('reps', e.target.value)});

  const rirInput = confirmed
    ? h('div', {className:'fval', style:{fontSize:14}}, set.rir!==''&&set.rir!==null&&set.rir!==undefined?set.rir:'—')
    : h('input', {type:'number', inputMode:'numeric', className:'ghost', style:{fontSize:15},
        placeholder:'—',
        disabled: locked,
        value: set.rir===null||set.rir===undefined?'':set.rir,
        onChange: e => onChange('rir', e.target.value)});

  return h('div', {className: rowClass},
    h('span', {className:'idx'}, pad2(idx+1)),
    h('div', {style:{minWidth:0}},
      h('div', {className:'flab'}, 'Poids'),
      fieldWithStepper(poidsInput, () => stepWeight(+1), () => stepWeight(-1))),
    h('div', {style:{minWidth:0}},
      h('div', {className:'flab'}, 'Reps'),
      fieldWithStepper(repsInput, () => stepReps(+1), () => stepReps(-1))),
    h('div', {style:{minWidth:0}},
      h('div', {className:'flab'}, 'RIR'),
      fieldWithStepper(rirInput, () => stepRir(+1), () => stepRir(-1))),
    h('div', {style:{display:'flex',gap:6,alignItems:'center',justifyContent:'space-between',width:'100%'}},
      !confirmed
        ? h('button', {
            className:'press-icon',
            onClick: onRemove,
            title: 'Supprimer la série',
            style:{color:'var(--ink-3)',padding:4,display:'inline-flex',flex:'0 0 auto'}
          }, ICONS.trash)
        : h('span', {style:{width:28,display:'inline-block',flex:'0 0 auto'}}),
      confirmed
        ? h('button', {className:'check pressable', onClick: onUnconfirm, title:'Défaire',
            style:{flex:'0 0 30px'}}, ICONS.x)
        : h('button', {
            className:'check pressable',
            onClick: locked ? null : onConfirm,
            disabled: locked,
            title: locked ? 'Valide la série précédente d\'abord' : 'Valider',
            style:{flex:'0 0 30px'}
          }, ICONS.check)
    )
  );
}


/* ==========================================================================
   PROGRESSION — liste exos + détail avec graph surcharge progressive
   ========================================================================== */

function Progression({state}) {
  const {journalLogs, exerciseLib} = state;
  const [period, setPeriod] = useState(() => LS.get('prog_period', '90'));
  const [detailKey, setDetailKey] = useState(null);
  const [detailMuscle, setDetailMuscle] = useState(null);
  const [view, setView] = useState(() => LS.get('prog_view', 'exos'));

  useEffect(() => LS.set('prog_period', period), [period]);
  useEffect(() => LS.set('prog_view', view), [view]);

  // One-shot entrance animation, same pattern as Dashboard
  const [animIn, setAnimIn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimIn(false), 1400);
    return () => clearTimeout(t);
  }, []);

  const periodDays = period === 'all' ? 99999 : parseInt(period);

  // All exo keys ever seen — clé sans modèle pour avoir une entrée unique par exo
  const allKeys = useMemo(() => {
    const keys = new Set();
    journalLogs.forEach(s => (s.exercises||[]).forEach(ex => keys.add(exoKeyNoModel(ex))));
    return [...keys];
  }, [journalLogs]);

  // Summary all time (or period)
  const summary = useMemo(() => progressionSummary(journalLogs, exerciseLib, periodDays), [journalLogs, exerciseLib, periodDays]);

  // Global tonnage timeline
  const tonnagePts = useMemo(() => {
    const cutIso = iso(daysAgo(periodDays));
    const pts = [];
    const byDate = {};
    journalLogs.forEach(s => {
      if (s.date < cutIso) return;
      byDate[s.date] = (byDate[s.date]||0) + tonnageSession(s);
    });
    Object.keys(byDate).sort().forEach(date => pts.push({ date, value: byDate[date] }));
    return pts;
  }, [journalLogs, periodDays]);

  const totalTonnage = tonnagePts.reduce((a,p)=>a+p.value,0);

  // Tonnage période précédente de même longueur, pour calculer delta
  const prevTonnage = useMemo(() => {
    if (periodDays >= 99999) return null;
    const cutEnd = iso(daysAgo(periodDays));
    const cutStart = iso(daysAgo(periodDays * 2));
    return journalLogs
      .filter(s => s.date >= cutStart && s.date < cutEnd)
      .reduce((a,s) => a + tonnageSession(s), 0);
  }, [journalLogs, periodDays]);

  const tonnageDeltaPct = (prevTonnage !== null && prevTonnage > 0)
    ? (totalTonnage - prevTonnage) / prevTonnage * 100
    : null;

  const periodLabel = (() => {
    if (period === '7') return '7 jours';
    if (period === '30') return '30 jours';
    if (period === '90') return '90 jours';
    if (period === '365') return '1 an';
    return 'tout l\'historique';
  })();

  // Heatmap retirée — le useMemo et les helpers associés ne sont plus utilisés

  if (detailKey) {
    return h(ExoDetail, {
      state, keyId: detailKey, onBack: () => setDetailKey(null)
    });
  }

  if (detailMuscle) {
    return h(MuscleDetail, {
      state, muscleGroup: detailMuscle, periodDays, periodLabel,
      onBack: () => setDetailMuscle(null),
      onOpenExo: (key) => { setDetailMuscle(null); setDetailKey(key); }
    });
  }

  return h('div', {className:'app-body'},
    h(Header, {
      kicker: period === 'all' ? 'Tout l\'historique' : 'Derniers ' + periodDays + ' jours',
      title: 'Progression.'
    }),

    h(Segment, {
      value: period, onChange: setPeriod,
      options: [
        {value:'7', label:'7J'},
        {value:'30', label:'30J'},
        {value:'90', label:'90J'},
        {value:'365', label:'1A'},
        {value:'all', label:'Tout'}
      ]
    }),

    /* Tonnage card */
    h('div', {
      className: 'card' + (animIn ? ' mv-card-in' : ''),
      style: {marginBottom:10, ...(animIn ? {'--mv-d':'80ms'} : {})}
    },
      h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}},
        h('div', null,
          h('div', {className:'card-label'}, 'Tonnage cumulé · ' + periodLabel),
          h('div', {style:{display:'flex',alignItems:'baseline',gap:8,marginTop:4}},
            h('span', {
              className: 'kpi-lg' + (animIn ? ' mv-kpi-in' : ''),
              style: animIn ? {'--mv-d':'200ms'} : undefined
            }, formatNum(totalTonnage/1000,1), h('span',{className:'unit'}, 't'))
          ),
          tonnageDeltaPct !== null && h('div', {style:{marginTop:4,fontSize:11,fontWeight:700,
            color: tonnageDeltaPct > 0 ? 'var(--success)' : tonnageDeltaPct < 0 ? 'var(--ink-3)' : 'var(--ink-3)'}},
            (tonnageDeltaPct>0?'▲ +':tonnageDeltaPct<0?'▼ ':'') + Math.abs(tonnageDeltaPct).toFixed(0) + '% vs période précédente')
        )
      ),
      tonnagePts.length > 0 ? h(TonnageChart, {
        points: tonnagePts,
        period: periodDays,
        dataSig: periodDays + ':' + tonnagePts.length + ':' + tonnagePts.map(p => Math.round(p.value)).join(',')
      }) :
        h('div', {className:'empty-state', style:{padding:20}},
          h('div', {className:'sub'}, 'Aucune séance sur cette période'))
    ),

    /* Heatmap retirée — non pertinente pour un pattern muscu 3-5 séances/sem */

    /* Surcharge progressive — segment exos/muscles */
    h('div', {className:'section-label'},
      h('span',{className:'bullet'}),
      'Surcharge progressive',
      h('span', {className:'right'}, summary.up + '/' + summary.total + ' en progression')
    ),

    h(Segment, {
      value: view, onChange: setView,
      options: [
        {value:'exos', label:'Par exercice'},
        {value:'muscles', label:'Par muscle'}
      ]
    }),

    h(ViewContainer, {activeTab: view, scrollToTopOnChange: true},
      view === 'muscles'
        ? (function(){
            const muscleProgs = muscleIndexSummary(journalLogs, exerciseLib, periodDays);
            if (muscleProgs.length === 0) {
              return h('div', {className:'empty-state'},
                h('div', {className:'icon'}, '💪'),
                h('div', {className:'title'}, 'Pas assez de données'),
                h('div', {className:'sub'}, 'Fais au moins 2 séances sur les mêmes exos par muscle.'));
            }
            const maxAbs = Math.max(...muscleProgs.map(m => Math.abs(m.deltaPct)), 1);
            return h('div', {style:{display:'flex',flexDirection:'column',gap:6}},
              muscleProgs.map(m => {
                const pos = m.deltaPct >= 0;
                const w = Math.min(100, Math.abs(m.deltaPct) / maxAbs * 100);
                return h('button', {key:m.muscleGroup,
                  className:'press-row',
                  onClick: () => setDetailMuscle(m.muscleGroup),
                  style:{padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',textAlign:'left',width:'100%',cursor:'pointer'}
                },
                  h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}},
                    h('div', null,
                      h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)'}}, m.muscleGroup),
                      h('div', {className:'meta', style:{marginTop:2}},
                        m.exoCount + ' exo' + (m.exoCount>1?'s':'') + ' · ',
                        m.positives + ' en hausse',
                        m.prs > 0 ? ' · ' + m.prs + ' PR' : '')),
                    h('div', {style:{textAlign:'right',display:'flex',alignItems:'center',gap:8}},
                      h('div', null,
                        h('span', {style:{fontSize:16,fontWeight:800,fontVariantNumeric:'tabular-nums',color:pos?'var(--success)':'var(--ink-3)'}},
                          (pos?'+':'') + m.deltaPct.toFixed(1) + '%'),
                        h('div', {className:'meta', style:{fontSize:9,marginTop:2}}, 'progression · ' + periodLabel)),
                      h('span', {style:{color:'var(--ink-3)',display:'inline-flex',flex:'0 0 auto'}}, ICONS.right))),
                  h('div', {style:{height:6,background:'var(--bg-3)',borderRadius:3,overflow:'hidden',position:'relative'}},
                    h('div', {style:{
                      height:'100%', width: w + '%',
                      background: pos ? 'linear-gradient(90deg, var(--success), #5fd48a)' : 'linear-gradient(90deg, #666, #888)',
                      borderRadius:3, transition:'width .3s'
                    }}))
                );
              })
            );
          })()
        : (function(){
            // Collecte tous les exos utilisés dans la période (≥ 1 séance)
            const cutIso = iso(daysAgo(periodDays));
            const usedKeys = new Set();
            const keyMeta = {};
            journalLogs.forEach(s => {
              if (s.date < cutIso) return;
              (s.exercises||[]).forEach(ex => {
                const k = exoKeyNoModel(ex);
                usedKeys.add(k);
                if (!keyMeta[k]) {
                  keyMeta[k] = {
                    name: ex.exName || (ex.choices?.[0]?.exId ? exerciseLib.find(l=>l.id===ex.choices[0].exId)?.name : '?') || '?',
                    muscleGroup: exoMuscleGroup(ex, exerciseLib),
                    count: 0, lastDate: ''
                  };
                }
                keyMeta[k].count++;
                if (!keyMeta[k].lastDate || s.date > keyMeta[k].lastDate) keyMeta[k].lastDate = s.date;
              });
            });
            const withDeltaKeys = new Set(summary.items.map(i => i.key));
            const noDelta = [...usedKeys].filter(k => !withDeltaKeys.has(k)).map(k => ({
              key: k, noDelta: true, ...keyMeta[k]
            }));

            if (summary.items.length === 0 && noDelta.length === 0) {
              return h('div', {className:'empty-state'},
                h('div', {className:'icon'}, '🏋️'),
                h('div', {className:'title'}, 'Pas de données'),
                h('div', {className:'sub'}, 'Aucun exercice travaillé sur cette période.'));
            }

            const renderRow = (it) => {
              if (it.noDelta) {
                return h('button', {
                  key: it.key, className:'press-row',
                  onClick: () => setDetailKey(it.key),
                  style:{
                    display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center',
                    padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--line)',
                    borderRadius:'var(--r-md)', marginBottom:6, textAlign:'left', width:'100%', opacity:0.65
                  }
                },
                  h('div', {style:{
                    width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    background:'var(--bg-3)', color:'var(--ink-3)'
                  }}, ICONS.dumbbell),
                  h('div', null,
                    h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, it.name),
                    h('div', {style:{fontSize:11,fontWeight:500,color:'var(--ink-3)',marginTop:2}},
                      (it.muscleGroup||'—') + ' · 1 séance')),
                  h('div', {style:{textAlign:'right'}},
                    h('span', {style:{fontSize:13,fontWeight:700,color:'var(--ink-3)'}}, '—'),
                    h('div', {className:'meta', style:{marginTop:2,fontSize:9}}, 'pas de delta'))
                );
              }
              return h('button', {
                key: it.key, className:'press-row',
                onClick: () => setDetailKey(it.key),
                style:{
                  display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center',
                  padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--line)',
                  borderRadius:'var(--r-md)', marginBottom:6, textAlign:'left', width:'100%'
                }
              },
                // Icône à gauche : étoile dorée si all-time PR, étoile orange si rep PR,
                // sinon flèche directionnelle ou haltère selon la tendance
                (function(){
                  if (it.hasAllTimePR) {
                    return h('div', {style:{
                      width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      background:'var(--pr-gold-wash)', color:'var(--pr-gold)'
                    }}, ICONS.trophy);
                  }
                  if (it.hasRepPRonly) {
                    return h('div', {style:{
                      width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      background:'var(--accent-wash)', color:'var(--accent-hi)'
                    }}, ICONS.trophy);
                  }
                  const isUp = it.kind === 'up', isDown = it.kind === 'down';
                  return h('div', {style:{
                    width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    background: isUp ? 'var(--success-wash)' : 'var(--bg-3)',
                    color: isUp ? 'var(--success)' : 'var(--ink-3)'
                  }}, isUp ? ICONS.up : isDown ? ICONS.chevDown : ICONS.dumbbell);
                })(),
                h('div', null,
                  h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, it.name),
                  h('div', {style:{fontSize:11,fontWeight:500,color:'var(--ink-3)',marginTop:2}},
                    it.muscleGroup, ' · ', it.count, ' séances · top ', it.lastWeight, ' × ', it.lastReps)),
                h('div', {style:{textAlign:'right'}},
                  h('span', {
                    style:{fontSize:13, fontWeight:800, fontVariantNumeric:'tabular-nums',
                      color: it.deltaPct > 0 ? 'var(--success)' : 'var(--ink-3)'}
                  }, (it.deltaPct>=0?'+':'') + it.deltaPct.toFixed(1) + '%'),
                  h('div', {className:'meta', style:{marginTop:2,fontSize:9}}, 'progression · ' + periodLabel))
              );
            };

            return h('div', null,
              summary.items.map(renderRow),
              noDelta.length > 0 && h('div', {className:'meta', style:{marginTop:12,marginBottom:6,fontSize:10,textTransform:'uppercase',letterSpacing:'.1em'}},
                'Exercices à 1 seule séance (pas de delta)'),
              noDelta.map(renderRow)
            );
          })()
    )
  );
}

/* ==========================================================================
   EXO DETAIL — graph e1RM, top sets timeline, PR history
   ========================================================================== */

function ExoDetailChart({mapped, smoothMapped, W, H, dataSig}) {
  const { progress, interpolate, commit } = useMorphProgress({
    dataSig,
    animIn: true,
    animateOnChange: true,
    animDelay: 120,
    animDuration: 800,
    mode: 'baseline'  // always grow-from-baseline — matches iOS Health / Revolut feel on every period change
  });

  const pts = interpolate(mapped, 'line');
  const smoothPts = interpolate(smoothMapped, 'smooth');

  useEffect(() => { commit(mapped, smoothMapped); }, [progress, dataSig]);

  const linePath = pts.map((m,i) => (i===0?'M':'L') + m.x.toFixed(1) + ',' + m.y.toFixed(1)).join(' ');
  const smoothPath = smoothPts.map((m,i) => (i===0?'M':'L') + m.x.toFixed(1) + ',' + m.y.toFixed(1)).join(' ');
  const areaPath = smoothPath + ` L${smoothPts[smoothPts.length-1].x},${H} L${smoothPts[0].x},${H} Z`;
  const dotsOpacity = progress > .85 ? (progress - .85) / .15 : 0;
  const CHART_HEIGHT = 140;

  // ============ SCRUBBER TACTILE (style Revolut/Apple Health) ============
  // Au touché/glisse, on affiche le point survolé + une barre verticale + un overlay info.
  // Le scrubber n'apparaît qu'après la fin de l'animation initiale (progress > .9).
  const containerRef = useRef(null);
  const [scrubIdx, setScrubIdx] = useState(null); // index du point ciblé
  const scrubReady = progress > .9 && mapped.length > 0;

  const handleMove = (clientX) => {
    if (!containerRef.current || !mapped.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width; // 0..1 dans l'élément
    // Convertir en x SVG
    const xSvg = ratio * W;
    // Trouver l'index le plus proche
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < mapped.length; i++) {
      const d = Math.abs(mapped[i].x - xSvg);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    setScrubIdx(bestI);
  };

  const onTouchStart = (e) => {
    if (!scrubReady) return;
    const t = e.touches[0]; if (!t) return;
    handleMove(t.clientX);
  };
  const onTouchMove = (e) => {
    if (!scrubReady) return;
    const t = e.touches[0]; if (!t) return;
    handleMove(t.clientX);
    e.preventDefault(); // empêche le scroll de la page pendant le scrub
  };
  const onTouchEnd = () => setScrubIdx(null);

  const onMouseDown = (e) => { if (scrubReady) { handleMove(e.clientX); } };
  const onMouseMove = (e) => {
    if (!scrubReady || e.buttons === 0) return;
    handleMove(e.clientX);
  };
  const onMouseLeave = () => setScrubIdx(null);

  // Point actuellement scrubbé (sur les données committed, pas interpolées)
  const activePt = (scrubIdx !== null && mapped[scrubIdx]) ? mapped[scrubIdx] : null;

  return h('div', {
    ref: containerRef,
    onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd,
    onMouseDown, onMouseMove, onMouseLeave, onMouseUp: () => setScrubIdx(null),
    style:{
      position:'relative', width:'100%', height: CHART_HEIGHT + 36, // +36 pour overlay info au-dessus
      paddingTop: 36, // place pour l'overlay
      touchAction: scrubReady ? 'pan-y' : 'auto', // permet le scrub horizontal
      cursor: scrubReady ? 'crosshair' : 'default',
      userSelect: 'none', WebkitUserSelect: 'none'
    }
  },
    // Overlay d'info — fixé en haut, visible au scrub
    activePt && h('div', {
      style:{
        position:'absolute', top: 0, left: 0, right: 0,
        display:'flex', alignItems:'baseline', gap: 8, padding:'2px 4px',
        fontVariantNumeric:'tabular-nums', pointerEvents:'none',
        animation: 'fadeIn .12s ease-out'
      }
    },
      h('span', {style:{fontSize:11, color:'var(--ink-3)', fontWeight:600, letterSpacing:'-0.01em', flex:'0 0 auto'}},
        fmtScrubDate(activePt.p.date)),
      h('span', {style:{fontSize:18, fontWeight:800, color:'var(--ink-0)', letterSpacing:'-0.02em'}},
        activePt.p.value.toFixed(1)),
      h('span', {style:{fontSize:10, color:'var(--ink-3)', fontWeight:600}}, 'kg e1RM'),
      activePt.p.weight !== undefined && h('span', {style:{fontSize:10, color:'var(--ink-2)', fontWeight:600, marginLeft:'auto'}},
        activePt.p.weight + '×' + activePt.p.reps),
      activePt.p.isPR && h('span', {style:{fontSize:9, fontWeight:800, color:'var(--pr-gold)', letterSpacing:'.05em'}}, '★ PR')
    ),

    h('svg', {
      viewBox: `0 0 ${W} ${H}`, preserveAspectRatio:'none',
      style:{width:'100%', height: CHART_HEIGHT, display:'block', pointerEvents:'none'}
    },
      h('defs', null,
        h('linearGradient', {id:'exo-grad', x1:0,y1:0,x2:0,y2:1},
          h('stop', {offset:'0%', stopColor:'#FC4C02', stopOpacity:.3}),
          h('stop', {offset:'100%', stopColor:'#FC4C02', stopOpacity:0}))),
      h('path', {d: areaPath, fill:'url(#exo-grad)', style:{opacity: Math.min(1, progress * 1.2)}}),
      h('path', {d: linePath, stroke:'#FC4C02', strokeWidth:1, fill:'none', strokeLinecap:'round', strokeLinejoin:'round', strokeOpacity:.3 * progress, vectorEffect:'non-scaling-stroke'}),
      h('path', {d: smoothPath, stroke:'#FC4C02', strokeWidth:2, fill:'none', strokeLinecap:'round', strokeLinejoin:'round', vectorEffect:'non-scaling-stroke'}),
      // Ligne verticale du scrubber
      activePt && h('line', {
        x1: activePt.x, x2: activePt.x, y1: 0, y2: H,
        stroke:'#FC4C02', strokeWidth: 1, strokeDasharray: '3 3', strokeOpacity: 0.5,
        vectorEffect:'non-scaling-stroke'
      })
    ),

    // HTML overlay for circular points + scrubber dot
    h('div', {style:{position:'absolute', left:0, right:0, top: 36, height: CHART_HEIGHT, pointerEvents:'none'}},
      pts.map((m,i) => {
        const isActive = activePt && scrubIdx === i;
        const size = isActive ? 12 : (m.p.isPR ? 8 : 6);
        const color = m.p.isPR ? '#FFC233' : m.p.kind==='up' ? '#FC4C02' : m.p.kind==='down' ? '#696980' : '#9CA0B5';
        return h('div', {
          key:i,
          style:{
            position:'absolute',
            left: `calc(${(m.x/W)*100}% - ${size/2}px)`,
            top: `calc(${(m.y/H)*100}% - ${size/2}px)`,
            width: size, height: size,
            borderRadius: '50%',
            background: color,
            border: isActive ? '2px solid #fff' : '1.5px solid #10101C',
            boxShadow: isActive
              ? '0 0 0 4px rgba(252,76,2,.25)'
              : (m.p.isPR ? '0 0 6px rgba(255,194,51,.5)' : 'none'),
            opacity: dotsOpacity,
            willChange: 'opacity, transform',
            transform: isActive ? 'scale(1.05)' : 'none',
            transition: 'box-shadow .12s, transform .12s, border-color .12s'
          }
        });
      })
    )
  );
}

function ExoDetail({state, keyId, onBack}) {
  const {journalLogs, exerciseLib} = state;
  const [period, setPeriod] = useState('90');
  // Filtre modèle : null = pas encore initialisé, 'all' = tous superposés, 'none' = sans modèle, '<id>' = ce modèle
  const [modelFilter, setModelFilter] = useState(null);

  // Récupère l'exo lib correspondant
  const baseKey = keyId.split('/m:')[0];
  const exId = baseKey.startsWith('lib:') ? baseKey.slice(4) : null;
  const libEx = exerciseLib.find(l => 'lib:'+l.id === baseKey);

  // Modèles dispo dans la lib pour cet exo + détection des modèles présents dans l'historique
  const libModels = libEx?.models || [];
  const usedModelIds = useMemo(() => {
    const used = new Set();
    journalLogs.forEach(s => (s.exercises||[]).forEach(ex => {
      if (exoKeyNoModel(ex) === baseKey && (ex.sets||[]).some(isValidSet)) {
        used.add(ex.modelId || 'none');
      }
    }));
    return used;
  }, [journalLogs, baseKey]);

  // Modèles affichables comme chips : ceux de la lib qui ont des données.
  // Si l'exo a au moins un modèle dans la lib → la sélection est obligatoire,
  // donc on ne montre PAS la catégorie "Sans modèle" (les logs orphelins restent invisibles ici,
  // mais la donnée n'est pas perdue — elle pourrait être réaffectée manuellement plus tard).
  const visibleModels = libModels.filter(m => usedModelIds.has(m.id));
  const hasUnmodeled = usedModelIds.has('none') && libModels.length === 0;
  const hasModelChoice = visibleModels.length > 0;

  // Init du filtre par défaut au premier rendu :
  //   - 1 seul modèle ou pas de modèle → ce modèle
  //   - Plusieurs modèles → 'all' (vue indice unifiée, plus informative au premier coup d'œil)
  useEffect(() => {
    if (modelFilter !== null) return;
    if (visibleModels.length > 1) setModelFilter('all');
    else if (visibleModels.length === 1) setModelFilter(visibleModels[0].id);
    else setModelFilter('all');
  }, [modelFilter, visibleModels]);

  // Timeline selon le filtre actif (ou full historique si pas encore init)
  const effectiveFilter = modelFilter || 'all';
  const timeline = useMemo(
    () => exoTimeline(journalLogs, baseKey, effectiveFilter),
    [journalLogs, baseKey, effectiveFilter]
  );

  // One-shot entrance, plays whenever user opens an exo detail. Since the whole component
  // remounts per keyId, the timer naturally resets on each open.
  const [animIn, setAnimIn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimIn(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // Map modelId → couleur (depuis la lib) pour la vue superposée
  const MODEL_COLOR_HEX = {
    coral: '#FC4C02', blue: '#378ADD', green: '#639922', purple: '#7F77DD',
    amber: '#EF9F27', pink: '#D4537E', teal: '#1D9E75'
  };
  const colorForModel = (mid) => {
    if (mid === null || mid === 'none') return '#9CA0B5';
    const m = libModels.find(x => x.id === mid);
    return MODEL_COLOR_HEX[m?.color || 'coral'] || '#FC4C02';
  };

  if (!timeline.length && !hasModelChoice) {
    return h('div', {className:'app-body'},
      h('button', {className:'pressable', onClick:onBack, style:{color:'var(--ink-2)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4,marginBottom:14}},
        ICONS.left, 'Progression'),
      h('div', {className:'empty-state'},
        h('div', {className:'title'}, 'Aucune donnée')));
  }

  const name = libEx?.name || timeline[0]?.exName || '?';
  const muscleGroup = libEx?.muscleGroup || 'Autre';

  // filter by period
  const periodDays = period === 'all' ? 99999 : parseInt(period);
  const cutIso = iso(daysAgo(periodDays));
  const filtered = timeline.filter(p => p.date >= cutIso);

  const current = timeline[timeline.length-1];
  const first = filtered[0] || current;
  const e1RMDelta = current ? (current.e1rm - (first?.e1rm || current.e1rm)) : 0;

  // PRs by rep range
  // Important : la timeline est déjà filtrée par modèle (effectiveFilter), donc les PRs
  // calculés ici sont automatiquement spécifiques au modèle sélectionné. On stocke modelId
  // pour pouvoir afficher quelle machine a établi le record.
  const prsByRep = {};
  timeline.forEach(p => {
    p.allSets.forEach(s => {
      if (!prsByRep[s.r] || s.w > prsByRep[s.r].w) {
        prsByRep[s.r] = { w: s.w, r: s.r, date: p.date, modelId: p.modelId };
      }
    });
  });
  const topRanges = [1,3,5,8,10,12,15].filter(r => prsByRep[r]).slice(0,4).map(r => prsByRep[r]);

  // Records de reps : pour chaque poids touché, le meilleur nombre de reps jamais réalisé.
  // Définition du Rep PR utilisateur : à un poids donné, plus de reps que jamais avant.
  // On scanne la timeline (déjà filtrée par modèle) chronologiquement et on garde le max
  // de reps par poids exact.
  const repPRsByWeight = {};
  timeline.forEach(p => {
    p.allSets.forEach(s => {
      const wKey = s.w.toFixed(2);
      if (!repPRsByWeight[wKey] || s.r > repPRsByWeight[wKey].r) {
        repPRsByWeight[wKey] = { w: s.w, r: s.r, date: p.date, modelId: p.modelId };
      }
    });
  });
  // Tri par poids décroissant + on garde uniquement les poids où on a fait au moins 2 reps
  // (sinon ce sont juste des séries one-rep, pas vraiment des rep PRs intéressants)
  const repPRList = Object.values(repPRsByWeight)
    .filter(pr => pr.r >= 2)
    .sort((a,b) => b.w - a.w);

  // Si vue 'all', on prépare les groupes par modèle pour superposition
  const filteredByModel = useMemo(() => {
    if (effectiveFilter !== 'all') return null;
    const groups = {};
    filtered.forEach(p => {
      const mid = p.modelId || 'none';
      if (!groups[mid]) groups[mid] = [];
      groups[mid].push(p);
    });
    return groups;
  }, [effectiveFilter, filtered]);

  // === Indice de progression cross-modèles (vue "Tout") ===
  // Même logique que muscleIndexTimeline mais à l'échelle exo : pour chaque modèle,
  // baseline = 1ère séance dans la période = 100. Moyenne des indices par date,
  // puis lissage moyenne mobile 7 séances. Permet une courbe unifiée propre même
  // quand l'utilisateur a alterné plusieurs machines pour le même exo.
  const indexTimeline = useMemo(() => {
    if (effectiveFilter !== 'all') return null;
    const indexByDate = {};
    let nWithDelta = 0, nPositives = 0;
    Object.values(filteredByModel || {}).forEach(arr => {
      const sorted = [...arr].sort((a,b) => a.date.localeCompare(b.date));
      const base = sorted[0]?.e1rm;
      if (!base || base <= 0) return;
      sorted.forEach(p => {
        const idx = p.e1rm / base * 100;
        if (!indexByDate[p.date]) indexByDate[p.date] = [];
        indexByDate[p.date].push(idx);
      });
      if (sorted.length >= 2) {
        nWithDelta += 1;
        if (sorted[sorted.length-1].e1rm > base) nPositives += 1;
      }
    });
    const dates = Object.keys(indexByDate).sort();
    const raw = dates.map(d => ({
      date: d,
      value: indexByDate[d].reduce((a,x)=>a+x,0) / indexByDate[d].length
    }));
    const SMOOTH = 7;
    const smooth = raw.map((p, i) => {
      const start = Math.max(0, i - SMOOTH + 1);
      const slice = raw.slice(start, i + 1);
      return { date: p.date, value: slice.reduce((a,x)=>a+x.value,0) / slice.length };
    });
    const finalIndex = smooth.length ? smooth[smooth.length-1].value : 100;
    return {
      raw, smooth, finalIndex,
      deltaPct: finalIndex - 100,
      modelsCount: Object.keys(filteredByModel || {}).length,
      modelsWithDelta: nWithDelta,
      modelsPositive: nPositives
    };
  }, [effectiveFilter, filteredByModel]);

  // Chart — données brutes si filtre simple, sinon en multi-séries
  // pts inclut weight/reps pour permettre l'affichage scrubber au touché
  const pts = filtered.map(p => ({
    date: p.date, value: p.e1rm, kind: p.kind, isPR: p.isPR, modelId: p.modelId,
    weight: p.weight, reps: p.reps
  }));
  const vals = pts.map(p => p.value);
  // Moyenne mobile 5-séances pour lisser la tendance
  const SMOOTH_WIN = 5;
  const smoothVals = vals.map((v, i) => {
    const w = Math.min(SMOOTH_WIN, i + 1);
    const slice = vals.slice(Math.max(0, i - w + 1), i + 1);
    return slice.reduce((a,x) => a + x, 0) / slice.length;
  });
  const allVals = [...vals, ...smoothVals];
  const vmin = allVals.length ? Math.min(...allVals) - 2 : 0;
  const vmax = allVals.length ? Math.max(...allVals) + 2 : 100;
  const range = (vmax - vmin) || 1;
  const W = 320, H = 160, PADX = 12, PADY = 12;
  const xStep = pts.length > 1 ? (W - 2*PADX) / (pts.length-1) : 0;
  const mapped = pts.map((p,i) => ({
    x: PADX + i*xStep,
    y: PADY + (H - 2*PADY) * (1 - (p.value-vmin)/range),
    p
  }));
  const smoothMapped = smoothVals.map((sv, i) => ({
    x: PADX + i*xStep,
    y: PADY + (H - 2*PADY) * (1 - (sv-vmin)/range)
  }));

  const linePath = mapped.map((m,i) => (i===0?'M':'L') + m.x.toFixed(1) + ',' + m.y.toFixed(1)).join(' ');
  const smoothPath = smoothMapped.map((m,i) => (i===0?'M':'L') + m.x.toFixed(1) + ',' + m.y.toFixed(1)).join(' ');
  const areaPath = smoothMapped.length ? (smoothPath + ` L${smoothMapped[smoothMapped.length-1].x},${H} L${smoothMapped[0].x},${H} Z`) : '';

  return h('div', {className:'app-body'},
    h('button', {className:'pressable', onClick:onBack, style:{color:'var(--ink-2)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4,marginBottom:14}},
      ICONS.left, 'Progression'),

    h('div', {style:{marginBottom:20}},
      h('span', {className:'chip', style:{marginBottom:10, background:'var(--bg-3)', color:'var(--accent-hi)', padding:'4px 10px', letterSpacing:'.12em', textTransform:'uppercase', fontSize:10, fontWeight:700}},
        muscleGroup),
      h('h1', {style:{margin:'6px 0 0',fontSize:28,fontWeight:800,letterSpacing:'-0.035em',lineHeight:1.05,color:'var(--ink-0)'}}, name)
    ),

    /* Chips de filtre par modèle.
       L'onglet "Tout" est toujours en premier quand il y a plusieurs modèles —
       cohérent avec la vue MuscleDetail et permet de basculer entre vue indice
       unifiée et vue kg par modèle d'un tap. */
    hasModelChoice && h('div', {style:{
      display:'flex', flexWrap:'wrap', gap:6, marginBottom:14
    }},
      // Chip 'Tout' en premier, visible dès qu'il y a plusieurs modèles
      visibleModels.length > 1 && h('button', {
        className:'pressable',
        onClick: () => setModelFilter('all'),
        style:{
          padding:'6px 12px', borderRadius:999,
          background: effectiveFilter === 'all' ? 'rgba(252,76,2,.15)' : 'var(--bg-3)',
          border: effectiveFilter === 'all' ? '1px solid rgba(252,76,2,.4)' : '1px solid transparent',
          color: effectiveFilter === 'all' ? 'var(--accent-hi)' : 'var(--ink-2)',
          fontSize:11, fontWeight:700
        }
      }, 'Tout'),
      // Un chip par modèle utilisé
      visibleModels.map(m => {
        const active = effectiveFilter === m.id;
        const hex = MODEL_COLOR_HEX[m.color || 'coral'] || '#FC4C02';
        return h('button', {
          key: m.id, className:'pressable',
          onClick: () => setModelFilter(m.id),
          style:{
            display:'inline-flex',alignItems:'center',gap:6,
            padding:'6px 10px', borderRadius:999,
            background: active ? hex+'22' : 'var(--bg-3)',
            border: active ? '1px solid '+hex : '1px solid transparent',
            color: active ? '#fff' : 'var(--ink-2)',
            fontSize: 11, fontWeight: 600,
            letterSpacing:'-0.01em'
          }
        },
          h('span', {style:{
            width:8,height:8,borderRadius:'50%',background:hex,flex:'0 0 auto'
          }}),
          m.name
        );
      })
    ),

    /* Hero card */
    h('div', {
      className: animIn ? 'mv-card-in' : '',
      style:{
        background:'radial-gradient(500px 160px at 100% 0%,rgba(252,76,2,.15),transparent 60%),var(--bg-2)',
        border:'1px solid var(--line)', borderRadius:'var(--r-lg)', padding:20, marginBottom:12,
        ...(animIn ? {'--mv-d':'80ms'} : {})
      }
    },
      // Hero label/value : indice % en mode 'Tout', e1RM kg sinon
      (effectiveFilter === 'all' && visibleModels.length > 1 && indexTimeline)
        ? h(React.Fragment, null,
            h('div', {className:'card-label'}, 'Progression · ', period==='all'?'tout l\'historique':periodDays+' jours'),
            h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:6,marginBottom:6}},
              h('div', {style:{display:'flex',alignItems:'baseline',gap:6}},
                h('span', {
                  className: 'hero-num' + (animIn ? ' mv-kpi-in' : ''),
                  style:{fontSize:48,
                    color: indexTimeline.smooth.length >= 2 ? (indexTimeline.deltaPct >= 0 ? 'var(--success)' : 'var(--ink-1)') : 'var(--ink-3)',
                    ...(animIn ? {'--mv-d':'200ms'} : {})}
                }, indexTimeline.smooth.length >= 2 ? (indexTimeline.deltaPct >= 0 ? '+' : '') + indexTimeline.deltaPct.toFixed(1) : '—'),
                h('span', {className:'unit', style:{fontSize:14,
                  color: indexTimeline.smooth.length >= 2 && indexTimeline.deltaPct >= 0 ? 'var(--success)' : 'var(--ink-2)'}}, '%')),
              indexTimeline.smooth.length >= 2 && h('span', {style:{fontSize:11, color:'var(--ink-3)', fontWeight:600}},
                'indice ' + indexTimeline.finalIndex.toFixed(1))
            )
          )
        : h(React.Fragment, null,
            h('div', {className:'card-label'}, 'e1RM · ', period==='all'?'tout l\'historique':periodDays+' jours'),
            h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:6,marginBottom:16}},
              h('div', {style:{display:'flex',alignItems:'baseline',gap:6}},
                h('span', {
                  className: 'hero-num' + (animIn ? ' mv-kpi-in' : ''),
                  style:{fontSize:48, ...(animIn ? {'--mv-d':'200ms'} : {})}
                }, (current?.e1rm ?? 0).toFixed(1)),
                h('span', {className:'unit', style:{fontSize:14}}, 'kg')),
              e1RMDelta !== 0 && h(Delta, {value: e1RMDelta, unit:'kg'})
            )
          ),

      /* Chart : 
         - Vue 'Tout' (multi-modèles) → courbe d'indice unifiée style PeseeChart
         - Vue par modèle (ou exo sans modèle) → courbe en kg scrubbable */
      (effectiveFilter === 'all' && visibleModels.length > 1)
        ? (indexTimeline && indexTimeline.smooth.length >= 2
            ? h(MuscleDetailChart, {
                raw: indexTimeline.raw, smooth: indexTimeline.smooth,
                dataSig: 'exoidx:' + period + ':' + indexTimeline.smooth.length + ':' + indexTimeline.smooth.map(p => p.value.toFixed(2)).join(',')
              })
            : h('div', {className:'empty-state', style:{padding:20}},
                h('div', {className:'sub'}, 'Pas assez de séances sur cette période (≥ 2 par modèle).')))
        : (pts.length > 1
            ? h(ExoDetailChart, {
                mapped, smoothMapped, W, H,
                dataSig: period + ':' + effectiveFilter + ':' + pts.length + ':' + pts.map(p => p.value.toFixed(1)).join(',')
              })
            : h('div', {className:'empty-state', style:{padding:20}},
                h('div', {className:'sub'}, 'Moins de 2 séances sur cette période.')))
    ),

    h(Segment, {
      value: period, onChange: setPeriod,
      options: [
        {value:'30', label:'30J'},
        {value:'90', label:'90J'},
        {value:'365', label:'1A'},
        {value:'all', label:'Tout'}
      ]
    }),

    /* Legend */
    h('div', {style:{display:'flex',gap:14,flexWrap:'wrap',padding:'4px 4px 16px',fontSize:10,color:'var(--ink-3)',fontWeight:600}},
      h('span', {style:{display:'flex',alignItems:'center',gap:5}},
        h('span',{style:{width:9,height:9,borderRadius:'50%',background:'#FFC233',boxShadow:'0 0 6px rgba(255,194,51,.5)'}}), 'Record'),
      h('span', {style:{display:'flex',alignItems:'center',gap:5}},
        h('span',{style:{width:9,height:9,borderRadius:'50%',background:'#FC4C02'}}), 'Progression'),
      h('span', {style:{display:'flex',alignItems:'center',gap:5}},
        h('span',{style:{width:9,height:9,borderRadius:'50%',background:'#9CA0B5'}}), 'Stable'),
      h('span', {style:{display:'flex',alignItems:'center',gap:5}},
        h('span',{style:{width:9,height:9,borderRadius:'50%',background:'#696980'}}), 'Régression')
    ),

    /* Best weight per rep count (classic "X RM" view) */
    topRanges.length > 0 && h('div', null,
      h('div', {className:'section-label'}, h('span',{className:'bullet'}), 'Meilleurs poids par reps'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:6}},
        topRanges.map(pr => {
          const prModelName = pr.modelId && libModels.length > 0
            ? libModels.find(m => m.id === pr.modelId)?.name
            : null;
          return h('div', {key:pr.r, style:{
            display:'grid',gridTemplateColumns:'auto 1fr auto',gap:12,alignItems:'center',
            padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)'
          }},
            h('div', {style:{
              width:32, height:32, borderRadius:10, display:'flex',alignItems:'center',justifyContent:'center',
              background:'var(--pr-gold-wash)', color:'var(--pr-gold)'
            }}, ICONS.trophy),
            h('div', {style:{minWidth:0}},
              h('div', {className:'label'}, pr.r + ' RM'),
              h('div', {className:'title-sm', style:{fontVariantNumeric:'tabular-nums'}}, pr.w + ' kg × ' + pr.r),
              prModelName && h('div', {style:{fontSize:10,color:'var(--ink-3)',fontWeight:600,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, prModelName)),
            h('span', {className:'meta', style:{flex:'0 0 auto'}}, formatRelative(pr.date))
          );
        })
      )
    ),

    /* Rep PRs : meilleur nombre de reps jamais fait à chaque poids */
    repPRList.length > 0 && h('div', null,
      h('div', {className:'section-label'}, h('span',{className:'bullet'}), 'Records de reps par poids'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:6}},
        repPRList.slice(0, 6).map(pr => {
          const prModelName = pr.modelId && libModels.length > 0
            ? libModels.find(m => m.id === pr.modelId)?.name
            : null;
          return h('div', {key: pr.w.toFixed(2), style:{
            display:'grid',gridTemplateColumns:'auto 1fr auto',gap:12,alignItems:'center',
            padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)'
          }},
            h('div', {style:{
              width:32, height:32, borderRadius:10, display:'flex',alignItems:'center',justifyContent:'center',
              background:'var(--accent-wash)', color:'var(--accent-hi)',
              fontSize:14, fontWeight:800, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em'
            }}, pr.r),
            h('div', {style:{minWidth:0}},
              h('div', {className:'label'}, pr.w + ' kg'),
              h('div', {className:'title-sm', style:{fontVariantNumeric:'tabular-nums'}}, pr.r + ' reps'),
              prModelName && h('div', {style:{fontSize:10,color:'var(--ink-3)',fontWeight:600,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, prModelName)),
            h('span', {className:'meta', style:{flex:'0 0 auto'}}, formatRelative(pr.date))
          );
        })
      )
    ),

    /* Last sessions */
    h('div', {className:'section-label'}, h('span',{className:'bullet'}), 'Dernières séances'),
    h('div', {style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',overflow:'hidden'}},
      timeline.slice(-5).reverse().map((p, i, arr) => {
        // Récupère le nom du modèle si présent
        const modelName = p.modelId && libModels.length > 0
          ? libModels.find(m => m.id === p.modelId)?.name
          : null;
        return h('div', {
          key:p.sessionId,
          style:{
            display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, padding:'14px 16px', alignItems:'center',
            borderBottom: i === arr.length-1 ? 'none' : '1px solid var(--line)'
          }
        },
          h('span', {style:{fontFamily:'var(--f-mono)',fontSize:10,color:'var(--ink-3)',fontWeight:700,letterSpacing:'.05em'}},
            DOW_FR_S[(new Date(p.date).getDay()+6)%7].toUpperCase()),
          h('div', {style:{minWidth:0}},
            h('div', {className:'title-sm', style:{fontSize:13,fontVariantNumeric:'tabular-nums'}},
              p.allSets.map((s, si) => h('span', {key:si, style:{
                color: (s.isAllTimePR || s.isRepPR) ? 'var(--pr-gold)' : 'inherit',
                fontWeight: (s.isAllTimePR || s.isRepPR) ? 800 : 'inherit'
              }},
                (si > 0 ? ' · ' : ''),
                s.w + '×' + s.r,
                s.isAllTimePR ? '★' : s.isRepPR ? '✦' : ''
              ))),
            h('div', {className:'body-sm', style:{fontSize:11,marginTop:2}},
              p.date, ' · e1RM ', p.e1rm.toFixed(1), ' kg',
              modelName ? ' · ' + modelName : '')),
          // Badge : All-Time prend la priorité visuelle (or fort), sinon Rep PR (or léger), sinon delta
          p.hasAllTimePR ? h('span', {className:'pr-badge'}, 'PR')
            : p.hasRepPR ? h('span', {className:'pr-badge', style:{background:'var(--accent-wash)',color:'var(--accent-hi)'}}, 'REP')
            : p.kind === 'up' ? h('span', {className:'delta up', style:{fontSize:11}}, '+' + p.delta.toFixed(1))
            : null
        );
      })
    )
  );
}


/* ==========================================================================
   MUSCLE DETAIL — e1RM moyen par muscle, avec une ligne par sous-muscle si dispo
   ========================================================================== */

/**
 * MuscleDetailChart — courbe d'indice de progression d'un muscle (ou sous-muscle).
 * Reçoit `raw` (indice brut par séance) et `smooth` (lissé 7j). Style PeseeChart :
 * raw en orange transparent à l'arrière, lissée en orange vif épaisse au-dessus,
 * area fillée sous la lissée, scrubber tactile pour drag-and-show, ligne 100 de baseline.
 */
function MuscleDetailChart({raw, smooth, dataSig}) {
  // Si une seule séance, pas de courbe affichable. Empty state géré côté parent.
  if (smooth.length < 2) return null;

  const W = 300, H = 100, PADX = 4, PADY_TOP = 6, PADY_BOT = 4;
  const allVals = [...raw.map(p => p.value), ...smooth.map(p => p.value), 100];
  const vmin = Math.min(...allVals) - 0.5;
  const vmax = Math.max(...allVals) + 0.5;
  const range = (vmax - vmin) || 1;
  const xStep = smooth.length > 1 ? (W - 2*PADX) / (smooth.length-1) : 0;

  const toXY = (i, v) => ({
    x: PADX + i * xStep,
    y: PADY_TOP + (H - PADY_TOP - PADY_BOT) * (1 - (v - vmin)/range)
  });

  const targetPts = smooth.map((p, i) => ({...toXY(i, p.value), p, raw: raw[i]?.value ?? p.value}));
  const rawTargetPts = raw.map((p, i) => ({...toXY(i, p.value), p}));

  const { progress, interpolate, commit } = useMorphProgress({
    dataSig,
    animIn: true,
    animateOnChange: true,
    animDelay: 120,
    animDuration: 800,
    mode: 'baseline'
  });

  const pts = interpolate(targetPts, 'line');
  const rawPts = interpolate(rawTargetPts, 'smooth');
  useEffect(() => { commit(targetPts, rawTargetPts); }, [progress, dataSig]);

  const line = pts.map((p,i) => (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const area = line + ` L${PADX + (pts.length-1)*xStep},${H} L${PADX},${H} Z`;
  const rawLine = rawPts.map((p,i) => (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const dotOpacity = progress > .85 ? (progress - .85) / .15 : 0;
  const CHART_HEIGHT = H;
  const lastPt = pts[pts.length-1];
  const baselineY = toXY(0, 100).y; // ligne pointillée à indice 100

  // Scrubber
  const scrubReady = progress > .9 && targetPts.length > 0;
  const { scrubIdx, activePt, handlers, containerRef } = useChartScrubber(targetPts, W, scrubReady);

  return h('div', {
    ref: containerRef, ...handlers,
    style:{
      position:'relative', width:'100%', height: CHART_HEIGHT + 36, marginTop: 8,
      paddingTop: 36,
      touchAction: scrubReady ? 'pan-y' : 'auto',
      userSelect:'none', WebkitUserSelect:'none',
      cursor: scrubReady ? 'crosshair' : 'default'
    }
  },
    activePt && h('div', {
      style:{
        position:'absolute', top:0, left:0, right:0,
        display:'flex', alignItems:'baseline', gap:8, padding:'2px 4px',
        fontVariantNumeric:'tabular-nums', pointerEvents:'none',
        animation: 'fadeIn .12s ease-out'
      }
    },
      h('span', {style:{fontSize:11, color:'var(--ink-3)', fontWeight:600}}, fmtScrubDate(activePt.p.date)),
      h('span', {style:{fontSize:18, fontWeight:800, color:'var(--ink-0)', letterSpacing:'-0.02em'}},
        (activePt.p.value - 100 >= 0 ? '+' : '') + (activePt.p.value - 100).toFixed(1) + '%'),
      h('span', {style:{fontSize:10, color:'var(--ink-3)', fontWeight:600}}, 'progression (moy. 7j)'),
      h('span', {style:{fontSize:10, color:'var(--ink-2)', fontWeight:600, marginLeft:'auto'}},
        'jour : ' + ((activePt.raw||100) - 100 >= 0 ? '+' : '') + ((activePt.raw||100) - 100).toFixed(1) + '%')
    ),
    h('svg', {
      viewBox:`0 0 ${W} ${H}`, preserveAspectRatio:'none',
      style:{width:'100%', height: CHART_HEIGHT, display:'block', pointerEvents:'none'}
    },
      h('defs', null,
        h('linearGradient', {id:'mus-grad', x1:0,y1:0,x2:0,y2:1},
          h('stop', {offset:'0%', stopColor:'#FC4C02', stopOpacity:.22}),
          h('stop', {offset:'100%', stopColor:'#FC4C02', stopOpacity:0}))),
      // Ligne baseline 100 (référence)
      h('line', {x1:PADX, x2:W-PADX, y1:baselineY, y2:baselineY,
        stroke:'rgba(255,255,255,.1)', strokeWidth:1, strokeDasharray:'2 4', vectorEffect:'non-scaling-stroke'}),
      // Raw line en arrière (semi-transparente)
      h('path', {d: rawLine, stroke:'rgba(252,76,2,.32)', strokeWidth:1, fill:'none', style:{opacity: progress}}),
      // Area sous la lissée
      h('path', {d: area, fill:'url(#mus-grad)', style:{opacity: Math.min(1, progress * 1.2)}}),
      // Courbe lissée vif au-dessus
      h('path', {d: line, stroke:'#FC4C02', strokeWidth:2.2, fill:'none', strokeLinecap:'round', strokeLinejoin:'round', vectorEffect:'non-scaling-stroke'}),
      activePt && h('line', {
        x1: activePt.x, x2: activePt.x, y1: 0, y2: H,
        stroke:'#FC4C02', strokeWidth:1, strokeDasharray:'3 3', strokeOpacity:0.5,
        vectorEffect:'non-scaling-stroke'
      })
    ),
    // Dot (last ou scrub)
    h('div', {style:{position:'absolute', left:0, right:0, top:36, height:CHART_HEIGHT, pointerEvents:'none'}},
      activePt
        ? h('div', {style:{
            position:'absolute',
            left: `calc(${(activePt.x/W)*100}% - 6px)`,
            top: `calc(${(activePt.y/H)*100}% - 6px)`,
            width:12, height:12, borderRadius:'50%',
            background:'#FC4C02', border:'2px solid #fff',
            boxShadow:'0 0 0 4px rgba(252,76,2,.25)'
          }})
        : h('div', {style:{
            position:'absolute',
            left: `calc(${(lastPt.x/W)*100}% - 4px)`,
            top: `calc(${(lastPt.y/H)*100}% - 4px)`,
            width:8, height:8, borderRadius:'50%',
            background:'#FC4C02', border:'1.5px solid #10101C',
            opacity: dotOpacity
          }})
    )
  );
}

function MuscleDetail({state, muscleGroup, periodDays, periodLabel, onBack, onOpenExo}) {
  const {journalLogs, exerciseLib, subGroups} = state;
  const [period, setPeriod] = useState(periodDays >= 99999 ? 'all' : String(periodDays));
  const periodDaysLocal = period === 'all' ? 99999 : parseInt(period);
  const cutIso = iso(daysAgo(periodDaysLocal));

  // One-shot entrance
  const [animIn, setAnimIn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setAnimIn(false), 1600); return () => clearTimeout(t); }, []);

  // Onglet sous-muscle actif : 'all' (Tout) ou un nom de sous-muscle
  const [activeSub, setActiveSub] = useState('all');

  // Identifie tous les exos×modèles touchés dans la période, avec leur sous-muscle
  const exoMetaInMuscle = useMemo(() => {
    const out = new Map(); // emKey -> {key, subGroup, name, modelId, modelName}
    journalLogs.forEach(s => {
      if (s.date < cutIso) return;
      (s.exercises||[]).forEach(ex => {
        if (exoMuscleGroup(ex, exerciseLib) !== muscleGroup) return;
        const k = exoKey(ex);
        if (out.has(k)) return;
        let sub = null;
        if (ex.exId) {
          const L = exerciseLib.find(l => l.id === ex.exId);
          if (L?.subGroup) sub = L.subGroup;
        }
        if (!sub) {
          const nm = norm(ex.exName || ex.name || '');
          const L = exerciseLib.find(l => norm(l.name) === nm);
          if (L?.subGroup) sub = L.subGroup;
        }
        // Nom du modèle si présent
        let modelName = null;
        if (ex.modelId && ex.exId) {
          const L = exerciseLib.find(l => l.id === ex.exId);
          const m = L?.models?.find(mm => mm.id === ex.modelId);
          if (m) modelName = m.name;
        }
        out.set(k, {key:k, subGroup: sub, name: ex.exName || ex.name || '?', modelId: ex.modelId || null, modelName});
      });
    });
    return [...out.values()];
  }, [journalLogs, exerciseLib, muscleGroup, cutIso]);

  // Liste des sous-muscles présents (avec des données dans la période)
  const availableSubs = useMemo(() => {
    const subs = new Set();
    exoMetaInMuscle.forEach(m => { if (m.subGroup) subs.add(m.subGroup); });
    // Respecte l'ordre canonique du muscle dans state.subGroups si dispo
    const canonical = subGroups?.[muscleGroup] || [];
    const ordered = canonical.filter(s => subs.has(s));
    const extra = [...subs].filter(s => !canonical.includes(s));
    return [...ordered, ...extra];
  }, [exoMetaInMuscle, subGroups, muscleGroup]);

  // Timeline d'indice pour le filtre actif (Tout ou un sous-muscle)
  const tl = useMemo(() => {
    const subFilter = activeSub === 'all' ? null : activeSub;
    return muscleIndexTimeline(journalLogs, exerciseLib, muscleGroup, cutIso, subFilter);
  }, [journalLogs, exerciseLib, muscleGroup, cutIso, activeSub]);

  const totalPRs = useMemo(() => {
    let n = 0;
    exoMetaInMuscle.forEach(m => {
      const expts = exoTimeline(journalLogs, m.key).filter(p => p.date >= cutIso);
      n += expts.filter(p => p.isPR).length;
    });
    return n;
  }, [exoMetaInMuscle, journalLogs, cutIso]);

  const dataSig = period + ':' + muscleGroup + ':' + activeSub + ':' + tl.smooth.length + ':' + tl.smooth.map(p => p.value.toFixed(2)).join(',');
  const hasData = tl.smooth.length >= 2;
  const deltaPct = tl.deltaPct;

  return h('div', {className:'app-body'},
    h('button', {className:'press-icon', onClick:onBack,
      style:{color:'var(--ink-2)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4,marginBottom:14}},
      ICONS.left, 'Progression'),

    h('div', {style:{marginBottom:20}},
      h('span', {className:'chip', style:{marginBottom:10, background:'var(--bg-3)', color:'var(--accent-hi)', padding:'4px 10px', letterSpacing:'.12em', textTransform:'uppercase', fontSize:10, fontWeight:700}},
        'Muscle'),
      h('h1', {style:{margin:'6px 0 0',fontSize:28,fontWeight:800,letterSpacing:'-0.035em',lineHeight:1.05,color:'var(--ink-0)'}}, muscleGroup)
    ),

    /* Onglets sous-muscles — chips comme dans ExoDetail pour les modèles */
    availableSubs.length > 0 && h('div', {
      style:{display:'flex',gap:6,marginBottom:12,overflowX:'auto',paddingBottom:2,scrollbarWidth:'none'}
    },
      h('button', {
        className: 'chip pressable' + (activeSub === 'all' ? ' primary' : ''),
        style:{flex:'0 0 auto', padding:'7px 14px', fontSize:12, fontWeight:700},
        onClick: () => setActiveSub('all')
      }, 'Tout'),
      availableSubs.map(sub => h('button', {
        key: sub,
        className: 'chip pressable' + (activeSub === sub ? ' primary' : ''),
        style:{flex:'0 0 auto', padding:'7px 14px', fontSize:12, fontWeight:700},
        onClick: () => setActiveSub(sub)
      }, sub))
    ),

    /* Hero card — progression % + courbe lissée */
    h('div', {
      className: animIn ? 'mv-card-in' : '',
      style:{
        background:'radial-gradient(500px 160px at 100% 0%,rgba(252,76,2,.15),transparent 60%),var(--bg-2)',
        border:'1px solid var(--line)', borderRadius:'var(--r-lg)', padding:20, marginBottom:12,
        ...(animIn ? {'--mv-d':'80ms'} : {})
      }
    },
      h('div', {className:'card-label'}, 'Progression · ', period==='all'?'tout l\'historique':periodDaysLocal+' jours'),
      h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:6,marginBottom:6}},
        h('div', {style:{display:'flex',alignItems:'baseline',gap:6}},
          h('span', {
            className: 'hero-num' + (animIn ? ' mv-kpi-in' : ''),
            style:{fontSize:48, color: hasData ? (deltaPct >= 0 ? 'var(--success)' : 'var(--ink-1)') : 'var(--ink-3)',
              ...(animIn ? {'--mv-d':'200ms'} : {})}
          }, hasData ? (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(1) : '—'),
          h('span', {className:'unit', style:{fontSize:14, color: hasData && deltaPct >= 0 ? 'var(--success)' : 'var(--ink-2)'}}, '%')),
        hasData && h('span', {style:{fontSize:11, color:'var(--ink-3)', fontWeight:600}},
          'indice ' + tl.finalIndex.toFixed(1))
      ),
      hasData
        ? h(MuscleDetailChart, {raw: tl.raw, smooth: tl.smooth, dataSig})
        : h('div', {className:'empty-state', style:{padding:20}},
            h('div', {className:'sub'},
              tl.raw.length === 0 ? 'Aucune séance sur cette période.' : 'Pas assez de séances sur les mêmes exos (≥ 2 par exo×modèle).'))
    ),

    h(Segment, {
      value: period, onChange: setPeriod,
      options: [
        {value:'30', label:'30J'},
        {value:'90', label:'90J'},
        {value:'365', label:'1A'},
        {value:'all', label:'Tout'}
      ]
    }),

    /* Summary stats */
    h('div', {style:{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:16}},
      [
        ['Exos × modèles', tl.exoCount],
        ['Records', totalPRs],
        ['En hausse', tl.positives]
      ].map(([l, v], i) => h('div', {key:i,
        style:{padding:'12px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)'}},
        h('div', {className:'label'}, l),
        h('div', {className:'kpi-md', style:{marginTop:4}}, v)
      ))
    ),

    /* Exos list — clickable to open exo detail (filtré par activeSub si pas 'all') */
    exoMetaInMuscle.length > 0 && h('div', null,
      h('div', {className:'section-label'}, h('span',{className:'bullet'}),
        activeSub === 'all' ? 'Exercices de ce muscle' : 'Exercices · ' + activeSub),
      h('div', {style:{display:'flex',flexDirection:'column',gap:6}},
        exoMetaInMuscle
          .filter(m => activeSub === 'all' || m.subGroup === activeSub)
          .map(m => {
            const expts = exoTimeline(journalLogs, m.key).filter(p => p.date >= cutIso);
            if (expts.length === 0) return null;
            const last = expts[expts.length-1];
            const first = expts[0];
            // Delta exo×modèle en kg (puisque c'est un exo précis avec un modèle précis, kg fait sens ici)
            const delta = expts.length > 1 ? last.e1rm - first.e1rm : 0;
            const hasPR = expts.some(p => p.isPR);
            return h('button', {
              key: m.key, className:'press-row',
              onClick: () => onOpenExo(m.key),
              style:{
                display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, alignItems:'center',
                padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--line)',
                borderRadius:'var(--r-md)', textAlign:'left', width:'100%'
              }
            },
              h('div', {style:{minWidth:0}},
                h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, m.name),
                h('div', {style:{fontSize:11,fontWeight:500,color:'var(--ink-3)',marginTop:2}},
                  (m.modelName ? m.modelName + ' · ' : '') +
                  (m.subGroup ? m.subGroup + ' · ' : '') +
                  expts.length + ' séance' + (expts.length>1?'s':''))),
              hasPR ? h('span', {className:'pr-badge'}, 'PR')
                : h('span', {style:{fontSize:13, fontWeight:800, fontVariantNumeric:'tabular-nums',
                    color: delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--ink-3)' : 'var(--ink-3)'}},
                  expts.length > 1 ? (delta>0?'+':'') + delta.toFixed(1) + ' kg' : '—'),
              h('span', {style:{color:'var(--ink-3)',display:'inline-flex'}}, ICONS.right)
            );
          })
      )
    )
  );
}


/* ==========================================================================
   PESÉE
   ========================================================================== */

function PeseeChart({movAvg, period, dataSig}) {
  const vs = movAvg.map(p => p.value);
  const min = Math.min(...vs) - .3, max = Math.max(...vs) + .3;
  const range = (max - min) || 1;
  const W = 300, H = 100;
  const targetPts = movAvg.map((p, i) => ({
    x: (i/(movAvg.length-1))*W,
    y: H - ((p.value - min)/range) * H * .9 - 5,
    p
  }));
  const rawTargetPts = movAvg.map((p, i) => ({
    x: (i/(movAvg.length-1))*W,
    y: H - ((p.raw - min)/range) * H * .9 - 5,
    p
  }));

  const { progress, interpolate, commit } = useMorphProgress({
    dataSig,
    animIn: true,
    animateOnChange: true,
    animDelay: 120,
    animDuration: 800,
    mode: 'baseline'
  });

  const pts = interpolate(targetPts, 'line');
  const rawPts = interpolate(rawTargetPts, 'smooth');
  useEffect(() => { commit(targetPts, rawTargetPts); }, [progress, dataSig]);

  const line = pts.map((p,i) => (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const area = line + ` L${W},${H} L0,${H} Z`;
  const rawLine = rawPts.map((p,i) => (i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const dotOpacity = progress > .85 ? (progress - .85) / .15 : 0;
  const CHART_HEIGHT = 90;
  const lastPt = pts[pts.length-1];

  // ============ SCRUBBER TACTILE ============
  const containerRef = useRef(null);
  const [scrubIdx, setScrubIdx] = useState(null);
  const scrubReady = progress > .9 && targetPts.length > 0;

  const handleMove = (clientX) => {
    if (!containerRef.current || !targetPts.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const xSvg = ratio * W;
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < targetPts.length; i++) {
      const d = Math.abs(targetPts[i].x - xSvg);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    setScrubIdx(bestI);
  };
  const onTouchStart = (e) => { if (!scrubReady) return; const t = e.touches[0]; if (t) handleMove(t.clientX); };
  const onTouchMove = (e) => { if (!scrubReady) return; const t = e.touches[0]; if (t) { handleMove(t.clientX); e.preventDefault(); } };
  const onTouchEnd = () => setScrubIdx(null);
  const onMouseDown = (e) => { if (scrubReady) handleMove(e.clientX); };
  const onMouseMove = (e) => { if (!scrubReady || e.buttons === 0) return; handleMove(e.clientX); };
  const onMouseLeave = () => setScrubIdx(null);

  const activePt = (scrubIdx !== null && targetPts[scrubIdx]) ? targetPts[scrubIdx] : null;

  return h('div', {
    ref: containerRef,
    onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd,
    onMouseDown, onMouseMove, onMouseLeave, onMouseUp: () => setScrubIdx(null),
    style:{
      position:'relative', width:'100%', height: CHART_HEIGHT + 36, marginTop: 14,
      paddingTop: 36, // place pour overlay info
      touchAction: scrubReady ? 'pan-y' : 'auto',
      userSelect:'none', WebkitUserSelect:'none',
      cursor: scrubReady ? 'crosshair' : 'default'
    }
  },
    // Overlay info — date + moyenne mobile + brut
    activePt && h('div', {
      style:{
        position:'absolute', top:0, left:0, right:0,
        display:'flex', alignItems:'baseline', gap:8, padding:'2px 4px',
        fontVariantNumeric:'tabular-nums', pointerEvents:'none',
        animation: 'fadeIn .12s ease-out'
      }
    },
      h('span', {style:{fontSize:11, color:'var(--ink-3)', fontWeight:600}}, fmtScrubDate(activePt.p.date)),
      h('span', {style:{fontSize:18, fontWeight:800, color:'var(--ink-0)', letterSpacing:'-0.02em'}},
        activePt.p.value.toFixed(2)),
      h('span', {style:{fontSize:10, color:'var(--ink-3)', fontWeight:600}}, 'kg moy. 7j'),
      h('span', {style:{fontSize:10, color:'var(--ink-2)', fontWeight:600, marginLeft:'auto'}},
        'pesée : ' + activePt.p.raw.toFixed(1) + ' kg')
    ),

    h('svg', {
      viewBox:'0 0 300 100', preserveAspectRatio:'none',
      style:{width:'100%', height: CHART_HEIGHT, display:'block', pointerEvents:'none'}
    },
      h('defs', null,
        h('linearGradient', {id:'pes-grad', x1:0,y1:0,x2:0,y2:1},
          h('stop', {offset:'0%', stopColor:'#FC4C02', stopOpacity:.25}),
          h('stop', {offset:'100%', stopColor:'#FC4C02', stopOpacity:0}))),
      h('path', {d: rawLine, stroke:'rgba(252,76,2,.3)', strokeWidth:1, fill:'none', style:{opacity: progress}}),
      h('path', {d: area, fill:'url(#pes-grad)', style:{opacity: Math.min(1, progress * 1.2)}}),
      h('path', {d: line, stroke:'#FC4C02', strokeWidth:2, fill:'none', strokeLinecap:'round', vectorEffect:'non-scaling-stroke'}),
      // Ligne verticale du scrubber
      activePt && h('line', {
        x1: activePt.x, x2: activePt.x, y1: 0, y2: H,
        stroke:'#FC4C02', strokeWidth:1, strokeDasharray:'3 3', strokeOpacity:0.5,
        vectorEffect:'non-scaling-stroke'
      })
    ),
    // Last-point dot OR scrubber dot
    h('div', {style:{position:'absolute', left:0, right:0, top:36, height:CHART_HEIGHT, pointerEvents:'none'}},
      activePt
        ? h('div', {style:{
            position:'absolute',
            left: `calc(${(activePt.x/W)*100}% - 6px)`,
            top: `calc(${(activePt.y/H)*100}% - 6px)`,
            width:12, height:12, borderRadius:'50%',
            background:'#FC4C02', border:'2px solid #fff',
            boxShadow:'0 0 0 4px rgba(252,76,2,.25)',
            transform:'scale(1.05)',
            transition:'box-shadow .12s, transform .12s'
          }})
        : h('div', {style:{
            position:'absolute',
            left: `calc(${(lastPt.x/W)*100}% - 4px)`,
            top: `calc(${(lastPt.y/H)*100}% - 4px)`,
            width:8, height:8, borderRadius:'50%',
            background:'#FC4C02', border:'1.5px solid #10101C',
            opacity: dotOpacity
          }})
    )
  );
}

function Pesee({state}) {
  const {weights, setWeights} = state;
  const [period, setPeriod] = useState(() => LS.get('pesee_period', '30'));
  const [addOpen, setAddOpen] = useState(false);
  const [addVal, setAddVal] = useState('');
  const [addFasted, setAddFasted] = useState(true);
  const [addDate, setAddDate] = useState(todayIso());
  const [delConfirm, setDelConfirm] = useState(null);

  useEffect(() => LS.set('pesee_period', period), [period]);

  // One-shot entrance animation
  const [animIn, setAnimIn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimIn(false), 1400);
    return () => clearTimeout(t);
  }, []);

  const periodDays = period === 'all' ? 99999 : parseInt(period);
  const cutIso = iso(daysAgo(periodDays));

  const sorted = useMemo(() => [...weights].sort((a,b)=>(b.date||'').localeCompare(a.date||'')), [weights]);
  const filtered = useMemo(() => sorted.filter(w => w.date >= cutIso), [sorted, periodDays]);
  const current = sorted[0];

  // Moving average (7 day window)
  const movAvg = useMemo(() => {
    const chrono = [...filtered].reverse(); // oldest first
    return chrono.map((w, i) => {
      const window = chrono.slice(Math.max(0, i-6), i+1);
      const avg = window.reduce((a,x)=>a+x.weight,0) / window.length;
      return { date: w.date, value: avg, raw: w.weight };
    });
  }, [filtered]);

  // Delta sur la période sélectionnée : compare la moyenne mobile
  // en fin de période à celle du début de période (premier point)
  const periodDelta = useMemo(() => {
    if (movAvg.length < 2) return null;
    const last = movAvg[movAvg.length-1].value;
    const first = movAvg[0].value;
    return last - first;
  }, [movAvg]);

  const periodLabel = (() => {
    if (period === '7') return '7 jours';
    if (period === '30') return '30 jours';
    if (period === '90') return '90 jours';
    if (period === '365') return '1 an';
    return 'tout l\'historique';
  })();

  // Min/max/avg stats
  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const values = filtered.map(w => w.weight);
    const avg = values.reduce((a,x)=>a+x,0) / values.length;
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg,
      avg7: filtered.slice(0,7).reduce((a,x)=>a+x.weight,0) / Math.min(filtered.length,7),
      avg30: filtered.slice(0,30).reduce((a,x)=>a+x.weight,0) / Math.min(filtered.length,30)
    };
  }, [filtered]);

  const save = () => {
    const val = parseFloat(addVal);
    if (!(val > 20 && val < 300)) { haptic('warning'); return; }
    const entry = { id: uid(), date: addDate, weight: val, createdAt: Date.now() };
    setWeights([...weights, entry]);
    setAddVal('');
    setAddFasted(true);
    setAddDate(todayIso());
    setAddOpen(false);
    haptic('success');
  };

  const removeEntry = (id) => setDelConfirm(weights.find(w => w.id === id));

  return h('div', {className:'app-body'},
    h(Header, {
      kicker: DOW_FR[(new Date().getDay()+6)%7] + ' ' + new Date().getDate() + ' ' + MONTHS_FR[new Date().getMonth()].toLowerCase(),
      title: 'Pesée.'
    }),

    /* Hero */
    h('div', {
      className: animIn ? 'mv-card-in' : '',
      style:{
        background:'radial-gradient(500px 180px at 0% 100%,rgba(252,76,2,.08),transparent 60%),var(--bg-2)',
        border:'1px solid var(--line)', borderRadius:'var(--r-lg)', padding:22, marginBottom:12,
        ...(animIn ? {'--mv-d':'60ms'} : {})
      }
    },
      h('div', {className:'card-label'}, 'Poids actuel'),
      current ? h('div', null,
        h('div', {style:{display:'flex',alignItems:'baseline',gap:10,marginTop:2}},
          h('span', {
            className: animIn ? 'mv-kpi-in' : '',
            style:{fontSize:58,fontWeight:900,letterSpacing:'-0.05em',color:'var(--ink-0)',lineHeight:.95,fontVariantNumeric:'tabular-nums',
              ...(animIn ? {'--mv-d':'180ms'} : {})}
          }, current.weight.toFixed(1)),
          h('span', {style:{color:'var(--ink-2)',fontSize:18,fontWeight:600}}, 'kg')),
        h('div', {style:{display:'flex',alignItems:'center',gap:10,marginTop:6}},
          periodDelta !== null && h(Delta, {value: periodDelta, unit:'kg'}),
          h('span', {className:'meta'}, 'sur ' + periodLabel + ' · moyenne mobile'))
      ) : h('div', {className:'empty-state', style:{padding:20,margin:'8px 0'}},
          h('div', {className:'sub'}, 'Aucune pesée enregistrée')),

      /* Chart — animated Revolut-style (grow from baseline, morph on period change) */
      movAvg.length > 1 && h(PeseeChart, {
        movAvg, period,
        dataSig: period + ':' + movAvg.length + ':' + movAvg.map(p => p.value.toFixed(2)).join(',')
      }),

      /* Stats */
      stats && h('div', {style:{display:'flex',gap:16,marginTop:14,paddingTop:14,borderTop:'1px solid var(--line)'}},
        [['Min', stats.min.toFixed(1)],['Max', stats.max.toFixed(1)],['Moy 7j', stats.avg7.toFixed(1)],['Moy 30j', stats.avg30.toFixed(1)]].map(([l,v],i) => h('div', {key:i, className: animIn ? 'mv-card-in' : '', style: animIn ? {'--mv-d': (400 + i*60) + 'ms'} : undefined},
          h('div', {className:'label', style:{fontSize:9}}, l),
          h('div', {style:{fontSize:15,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums',marginTop:2}}, v)
        ))
      )
    ),

    h(Segment, {value:period, onChange:setPeriod, options:[
      {value:'7', label:'7J'},{value:'30', label:'30J'},{value:'90', label:'90J'},
      {value:'365', label:'1A'},{value:'all', label:'Tout'}
    ]}),

    /* Entries list */
    filtered.length > 0 && h('div', {style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',overflow:'hidden',marginBottom:12}},
      filtered.slice(0, 50).map((w, i, arr) => {
        const prev = filtered[i+1];
        const delta = prev ? w.weight - prev.weight : null;
        return h('button', {
          key:w.id,
          className:'pressable',
          onClick: () => removeEntry(w.id),
          style:{
            display:'grid',gridTemplateColumns:'64px 1fr auto',gap:10,alignItems:'center',
            padding:'13px 16px', borderBottom: i===arr.length-1?'none':'1px solid var(--line)',
            textAlign:'left', width:'100%', background:'transparent'
          }
        },
          h('span', {style:{fontFamily:'var(--f-mono)',fontSize:10,color:'var(--ink-3)',fontWeight:700,letterSpacing:'.05em'}},
            w.date === todayIso() ? 'AUJ' : DOW_FR_S[(new Date(w.date).getDay()+6)%7].toUpperCase() + ' ' + w.date.split('-')[2]),
          h('span', {className:'title-sm', style:{fontVariantNumeric:'tabular-nums'}}, w.weight.toFixed(1) + ' kg'),
          delta !== null ? h('span', {
            className:'delta ' + (Math.abs(delta)<0.05?'flat':delta>0?'up':'down'),
            style:{fontSize:11}
          }, (delta>0?'+':'') + delta.toFixed(1)) : h('span')
        );
      })
    ),

    /* FAB */
    h('button', {
      className:'pressable',
      onClick:()=>setAddOpen(true),
      style:{
        position:'fixed',right:20,bottom:'calc(84px + var(--sa-b))',zIndex:50,
        width:56,height:56,borderRadius:'50%',
        background:'linear-gradient(180deg,var(--accent-hi),var(--accent))',
        color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow:'var(--shadow-accent)'
      }
    }, h('svg', {width:24,height:24,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2.5,strokeLinecap:'round'},
      h('line',{x1:12,y1:5,x2:12,y2:19}),h('line',{x1:5,y1:12,x2:19,y2:12}))),

    /* Add sheet */
    h(Sheet, {open:addOpen, onClose:()=>setAddOpen(false), title:'Nouvelle pesée'},
      h('div', {style:{display:'flex',flexDirection:'column',gap:12}},
        h('div', null,
          h('div', {className:'label', style:{marginBottom:6}}, 'Poids (kg)'),
          h('input', {
            className:'input', type:'number', step:'0.1', inputMode:'decimal',
            placeholder:'63.2',
            value: addVal, onChange: e=>setAddVal(e.target.value),
            autoFocus:true,
            onKeyDown: e => e.key==='Enter' && save()
          })),
        h('div', null,
          h('div', {className:'label', style:{marginBottom:6}}, 'Date'),
          h('input', {
            className:'input', type:'date',
            value: addDate, onChange: e=>setAddDate(e.target.value)
          })),
        h('button', {className:'btn btn-primary btn-full pressable', style:{marginTop:6}, onClick:save},
          ICONS.check, ' Enregistrer')
      )
    ),

    h(ConfirmSheet, {
      open: !!delConfirm, onClose:()=>setDelConfirm(null),
      onConfirm: () => { setWeights(weights.filter(w => w.id !== delConfirm.id)); setDelConfirm(null); },
      title: 'Supprimer cette pesée ?',
      message: delConfirm ? delConfirm.weight.toFixed(1) + ' kg du ' + delConfirm.date : ''
    })
  );
}


/* ==========================================================================
   PARAMS — programme (auto/manuel), cibles volume, exos, données
   ========================================================================== */

function Params({state}) {
  const [tab, setTab] = useState('programme');
  const {programs} = state;
  const hasPrograms = programs.length > 0;
  // Guard partagé au niveau App — on s'en sert aussi pour les sub-tabs
  const navGuardRef = state.navGuardRef;

  const setTabGuarded = (newTab) => {
    if (navGuardRef && navGuardRef.current) {
      const ok = navGuardRef.current(() => setTab(newTab));
      if (ok === false) return;
    }
    setTab(newTab);
  };

  // Onboarding if no program yet
  if (!hasPrograms) {
    return h('div', {className:'app-body'},
      h(ProgramOnboarding, {state})
    );
  }

  return h('div', {className:'app-body'},
    h(Header, {title:'Paramètres.'}),
    h(Segment, {
      value: tab, onChange: setTabGuarded,
      options:[
        {value:'programme', label:'Programme'},
        {value:'volume', label:'Cibles'},
        {value:'groupes', label:'Groupes'},
        {value:'exos', label:'Exos'},
        {value:'data', label:'Données'}
      ]
    }),
    // Sub-tab transition — same animation as main tabs, preserves each sub-tab's local state.
    // scrollToTopOnChange=true: unlike main tabs, sub-tabs have completely different content
    // so preserving scroll between them makes no sense.
    h(ViewContainer, {activeTab: tab, scrollToTopOnChange: true},
      tab==='programme' && h(ParamsProgram, {state}),
      tab==='volume' && h(ParamsVolume, {state}),
      tab==='groupes' && h(ParamsMuscleGroups, {state}),
      tab==='exos' && h(ParamsExos, {state}),
      tab==='data' && h(ParamsData, {state})
    )
  );
}

/* ==========================================================================
   ONBOARDING — when no program exists
   ========================================================================== */

function ProgramOnboarding({state}) {
  const [step, setStep] = useState('welcome'); // welcome | auto-config | manual
  const [gen, setGen] = useState({
    level: 'intermediaire',
    focus: 'hypertrophie',
    frequency: 4,
    priorities: []
  });
  const [name, setName] = useState('');
  // Import backup direct depuis l'onboarding — reproduit la logique de ParamsData
  // pour ne pas dépendre d'une navigation vers un onglet qui n'existait pas ('data'
  // n'est pas un tab principal).
  const [importPayload, setImportPayload] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const triggerRestore = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,application/octet-stream,.json';
    input.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.programs || !Array.isArray(data.programs)) {
          setImportError('Format invalide : le fichier ne contient pas de programmes.');
          return;
        }
        setImportPayload({
          data, filename: f.name,
          stats: {
            programs: (data.programs || []).length,
            exos: (data.exerciseLib || []).length,
            logs: (data.journalLogs || []).length,
            weights: (data.weights || []).length,
            muscles: (data.muscleGroups || []).length,
            subGroups: Object.keys(data.subGroups || {}).length,
            hasPrefs: !!data.preferences
          }
        });
      } catch (err) {
        setImportError('Erreur de lecture : ' + err.message);
      }
    };
    input.click();
  };

  const applyImport = () => {
    if (!importPayload) return;
    const data = importPayload.data;
    if (data.programs) state.setPrograms(data.programs);
    if (data.currentProgramId !== undefined) state.setCurrentProgramId(data.currentProgramId);
    if (data.exerciseLib) state.setExerciseLib(data.exerciseLib);
    if (data.weights) state.setWeights(data.weights);
    if (data.journalLogs) state.setJournalLogs(data.journalLogs);
    if (data.muscleGroups) state.setMuscleGroups(data.muscleGroups);
    if (data.subGroups) state.setSubGroups(data.subGroups);
    if (data.sessionNotes && typeof data.sessionNotes === 'object') LS.set('session_notes', data.sessionNotes);
    if (data.preferences && typeof data.preferences === 'object') {
      Object.entries(data.preferences).forEach(([k, v]) => {
        if (v !== undefined && v !== null) LS.set(k, v);
      });
    }
    setImportPayload(null);
    setImportSuccess(true);
    haptic('success');
    // Une fois l'import appliqué, l'onboarding va automatiquement disparaître
    // parce que state.programs.length > 0 (vérifié par le parent).
  };

  if (step === 'welcome') {
    return h('div', null,
      h('div', {style:{display:'flex',justifyContent:'center',marginTop:10,marginBottom:14}},
        h(Mascot, {size:140, float:true, glow:true})),
      h('h1', {style:{margin:0,fontSize:32,fontWeight:800,letterSpacing:'-0.04em',lineHeight:1.05,color:'var(--ink-0)',textAlign:'center'}},
        'Bienvenue sur MyLift.'),
      h('p', {className:'body', style:{textAlign:'center',color:'var(--ink-2)',margin:'10px auto 28px',maxWidth:360}},
        'Tu peux démarrer avec un programme généré sur mesure selon ton niveau et tes objectifs, ou en construire un de zéro.'),
      h('button', {className:'btn btn-primary btn-full pressable', style:{marginBottom:8}, onClick:()=>setStep('auto-config')},
        '🧠 Générer un programme'),
      h('div', {className:'meta', style:{textAlign:'center',marginBottom:14}},
        'basé sur Helms, Norton, Delavier'),
      h('button', {className:'btn btn-ghost btn-full pressable', onClick:()=>setStep('manual')},
        'Je construis moi-même'),
      h('div', {className:'divider', style:{margin:'24px 0 10px'}}),
      h('button', {className:'btn btn-ghost btn-full pressable', style:{fontSize:12,color:'var(--ink-3)'}, onClick: triggerRestore},
        'Restaurer depuis un backup'),
      // Confirmation visuelle de l'import
      h(ConfirmSheet, {
        open: !!importPayload, onClose: () => setImportPayload(null),
        onConfirm: applyImport,
        danger: false,
        title: 'Restaurer ce backup ?',
        message: importPayload
          ? 'Le contenu de « ' + importPayload.filename + ' » va être restauré :\n\n'
            + '• ' + importPayload.stats.programs + ' programme' + (importPayload.stats.programs>1?'s':'') + '\n'
            + '• ' + importPayload.stats.exos + ' exercices en biblio\n'
            + '• ' + importPayload.stats.logs + ' séance' + (importPayload.stats.logs>1?'s':'') + ' dans le journal\n'
            + '• ' + importPayload.stats.weights + ' pesée' + (importPayload.stats.weights>1?'s':'') + '\n'
          : '',
        confirmLabel: 'Restaurer'
      }),
      h(Sheet, {
        open: !!importError, onClose: () => setImportError(null),
        title: 'Import impossible'
      },
        h('p', {className:'body', style:{marginTop:0, marginBottom:16, color:'var(--ink-1)'}}, importError || ''),
        h('button', {className:'btn btn-primary btn-full pressable', onClick: () => setImportError(null)}, 'OK')
      ),
      h(Sheet, {
        open: importSuccess, onClose: () => setImportSuccess(false),
        title: 'Backup restauré'
      },
        h('p', {className:'body', style:{marginTop:0, marginBottom:16, color:'var(--ink-1)'}},
          'Toutes tes données ont été restaurées.'),
        h('button', {className:'btn btn-primary btn-full pressable', onClick: () => setImportSuccess(false)}, 'OK')
      )
    );
  }

  if (step === 'auto-config') {
    return h(GeneratorForm, {
      state, initial: gen, initialName: name,
      onBack: () => setStep('welcome'),
      onGenerate: (params, progName) => {
        const prog = generateProgram({...params, lib: state.exerciseLib, muscleGroups: state.muscleGroups, name: progName});
        state.setPrograms([...state.programs, prog]);
        state.setCurrentProgramId(prog.id);
        haptic('success');
      }
    });
  }

  if (step === 'manual') {
    return h(ManualProgramCreate, {
      state,
      onBack: () => setStep('welcome')
    });
  }
}

/**
 * SgSliderRow — premium slider for subgroup % split in the program creator.
 *
 * Design: thick (10px) track with an orange fill, large (28px) rounded thumb that
 * carries the % value as a badge, visible even at a glance. A native range input
 * overlays the whole row invisibly so drag/touch/keyboard/a11y still work through
 * the browser's native implementation. The row itself lights up (border + subtle
 * accent wash) while the user is actively interacting with it, like Revolut sliders.
 *
 * This replaces the previous plain `<input type=range accentColor=accent />` which
 * was barely visible against the dark background.
 */
function SgSliderRow({name, pct, series, onChange}) {
  const [active, setActive] = useState(false);
  const clampedPct = Math.max(0, Math.min(100, pct));
  return h('div', {className: 'sg-row' + (active ? ' is-active' : '')},
    h('div', {className:'sg-row-head'},
      h('div', {className:'sg-name'}, name),
      h('div', {className:'sg-val'},
        h('span', {className:'sg-pct'}, Math.round(clampedPct) + '%'),
        h('span', {className:'sg-sets'}, series + ' série' + (series>1?'s':''))
      )
    ),
    h('div', {className:'sg-slider' + (active ? ' is-active' : '')},
      h('div', {className:'sg-track'},
        h('div', {className:'sg-fill', style:{width: clampedPct + '%'}})
      ),
      // 5 subtle ticks at 0/25/50/75/100 for visual reference
      h('div', {className:'sg-ticks'},
        [0,1,2,3,4].map(i => h('div', {key:i, className:'sg-tick'}))
      ),
      h('div', {className:'sg-thumb', style:{left: clampedPct + '%'}},
        Math.round(clampedPct)
      ),
      h('input', {
        type: 'range', min: 0, max: 100, step: 1, value: Math.round(clampedPct),
        onChange: e => onChange(parseFloat(e.target.value)),
        onPointerDown: () => { setActive(true); haptic('light'); },
        onPointerUp: () => setActive(false),
        onPointerCancel: () => setActive(false),
        onBlur: () => setActive(false),
        'aria-label': name + ' — pourcentage du volume'
      })
    )
  );
}

/* ==========================================================================
   GENERATOR FORM (reused for new program + regenerate)
   ========================================================================== */

function GeneratorForm({state, initial, initialName='', onBack, onGenerate, title='Programme auto'}) {
  const [level, setLevel] = useState(initial?.level || 'intermediaire');
  const [frequency, setFrequency] = useState(initial?.frequency || 4);
  const [name, setName] = useState(initialName);
  // Init muscleStatus : défaut 'maintenance' pour tous — l'utilisateur choisit
  // intentionnellement les muscles à pousser (progression max 4 / focus max 3)
  const [muscleStatus, setMuscleStatus] = useState(() => {
    if (initial?.muscleStatus) return {...initial.muscleStatus};
    const out = {};
    state.muscleGroups.forEach(g => { out[g] = 'maintenance'; });
    // Legacy : si priorities anciennement, on les met en focus
    if (initial?.priorities) initial.priorities.forEach(g => { out[g] = 'focus'; });
    return out;
  });
  // Répartition % par sous-groupe (null = défaut auto)
  const [subSplit, setSubSplit] = useState(() => initial?.subGroupSplit ? {...initial.subGroupSplit} : {});
  const [expandedSub, setExpandedSub] = useState(null);

  // Assure qu'un groupe custom ajouté plus tard a un statut par défaut
  useEffect(() => {
    const missing = state.muscleGroups.filter(g => !(g in muscleStatus));
    if (missing.length) {
      const next = {...muscleStatus};
      missing.forEach(g => { next[g] = 'maintenance'; });
      setMuscleStatus(next);
    }
  }, [state.muscleGroups]);

  // Règles dures : max 3 focus, max 4 progression, le reste → maintenance
  const MAX_FOCUS = 3;
  const MAX_PROGRESSION = 4;
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(id);
  }, [flash]);

  const counts = useMemo(() => {
    const c = { focus: 0, progression: 0, maintenance: 0 };
    state.muscleGroups.forEach(g => {
      const v = muscleStatus[g] || 'progression';
      c[v] = (c[v] || 0) + 1;
    });
    return c;
  }, [muscleStatus, state.muscleGroups]);

  const setStatus = (g, val) => {
    const cur = muscleStatus[g] || 'maintenance';
    if (cur === val) return;
    // Bloque si le quota serait dépassé
    if (val === 'focus' && counts.focus >= MAX_FOCUS && cur !== 'focus') {
      setFlash({type:'warn', msg:`Max ${MAX_FOCUS} muscles en focus. Passe-en un autre en progression ou maintenance d'abord.`});
      haptic('warning');
      return;
    }
    if (val === 'progression' && counts.progression >= MAX_PROGRESSION && cur !== 'progression') {
      setFlash({type:'warn', msg:`Max ${MAX_PROGRESSION} muscles en progression. Passe-en un autre en maintenance d'abord.`});
      haptic('warning');
      return;
    }
    setMuscleStatus({...muscleStatus, [g]: val});
    haptic('light');
  };
  const bulkSet = (val) => {
    // Utile uniquement pour "tout → maintenance" (reset propre)
    const next = {};
    state.muscleGroups.forEach(g => { next[g] = val; });
    setMuscleStatus(next);
    haptic('light');
  };

  const targets = computeVolumeTargets({level, muscleStatus, muscleGroups: state.muscleGroups});
  const totalSets = Object.values(targets).reduce((a,v)=>a+v,0);
  const weeklyCap = frequency * MAX_SETS_PER_SESSION;

  const nameValid = name.trim().length > 0;
  const [nameError, setNameError] = useState(false);

  const go = () => {
    if (!nameValid) {
      setNameError(true);
      setFlash({type:'error', msg:'Donne un nom à ton programme.'});
      haptic('warning');
      return;
    }
    onGenerate({level, frequency, muscleStatus, subGroupSplit: subSplit}, name.trim());
  };

  const statusColor = (val) => val === 'focus' ? 'var(--accent)' : val === 'maintenance' ? 'var(--ink-3)' : 'var(--ink-1)';
  const statusBg = (val, active) => {
    if (!active) return 'var(--bg-3)';
    if (val === 'focus') return 'var(--accent-wash)';
    if (val === 'maintenance') return 'rgba(120,120,130,.15)';
    return 'rgba(52,199,89,.12)';
  };

  return h('div', null,
    h('button', {className:'pressable', onClick:onBack,
      style:{color:'var(--ink-2)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4,marginBottom:14}},
      ICONS.left, 'Retour'),
    h('h1', {style:{margin:0,fontSize:26,fontWeight:800,letterSpacing:'-0.035em',color:'var(--ink-0)',marginBottom:20}}, title),

    /* Flash toast */
    flash && h('div', {style:{
      padding:'10px 14px', marginBottom:14, borderRadius:10,
      background: flash.type==='error' ? 'rgba(255,59,72,.12)' : 'rgba(255,194,51,.12)',
      border: flash.type==='error' ? '1px solid rgba(255,59,72,.35)' : '1px solid rgba(255,194,51,.35)',
      color: flash.type==='error' ? 'var(--danger)' : 'var(--pr-gold)',
      fontSize:12, fontWeight:600, lineHeight:1.4,
      animation:'fade-in .2s ease'
    }}, flash.msg),

    /* NOM (obligatoire, en haut pour forcer la saisie) */
    h('div', {className:'label', style:{marginBottom:8}}, 'Nom du programme',
      h('span', {style:{color:'var(--danger)',marginLeft:4}}, '*')),
    h('input', {
      className:'input',
      style:{marginBottom:18, borderColor: nameError && !nameValid ? 'var(--danger)' : undefined},
      placeholder:'Ex: Lean bulk 4x/sem',
      value:name,
      onChange:e=>{ setName(e.target.value); if (e.target.value.trim()) setNameError(false); }
    }),

    /* NIVEAU */
    h('div', {className:'label', style:{marginBottom:8}}, 'Ton niveau'),
    h('div', {className:'seg', style:{marginBottom:14}},
      [['debutant','Débutant','< 1 an'],['intermediaire','Intermédiaire','1-3 ans'],['confirme','Confirmé','3 ans +']].map(([v,l,sub]) =>
        h('button', {key:v, className: level===v?'active':'', onClick:()=>{setLevel(v); haptic('light');},
          style:{flexDirection:'column',padding:'10px 4px',lineHeight:1.2}},
          h('div', null, l),
          h('div', {style:{fontSize:9,fontWeight:600,color:level===v?'var(--ink-2)':'var(--ink-3)',marginTop:2}}, sub)
        ))
    ),

    /* FREQUENCE */
    h('div', {className:'label', style:{marginBottom:8}}, 'Séances par semaine'),
    h('div', {className:'seg', style:{marginBottom:18}},
      [2,3,4,5,6].map(n => h('button', {key:n, className: frequency===n?'active':'', onClick:()=>{setFrequency(n); haptic('light');}},
        n + 'x'))
    ),

    /* STATUS PAR MUSCLE */
    h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}},
      h('div', {className:'label', style:{margin:0}}, 'Focus par muscle'),
      h('button', {className:'pressable', onClick:()=>bulkSet('maintenance'),
        style:{fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,background:'var(--bg-3)',color:'var(--ink-2)'}},
        'Reset → maintenance')
    ),
    h('p', {className:'meta', style:{marginTop:0,marginBottom:6}},
      h('span', {style:{color:'var(--accent)',fontWeight:700}}, '★ Focus'), ` +40% vol (max ${MAX_FOCUS}) · `,
      h('span', null, '↑ Progression'), ` baseline (max ${MAX_PROGRESSION}) · `,
      h('span', {style:{color:'var(--ink-3)'}}, '= Maintenance'), ' 50% vol'),
    h('p', {className:'meta', style:{marginTop:0,marginBottom:10,fontWeight:600}},
      h('span', {style:{color: counts.focus === MAX_FOCUS ? 'var(--accent)' : 'var(--ink-2)'}},
        `${counts.focus}/${MAX_FOCUS} focus`), ' · ',
      h('span', {style:{color: counts.progression === MAX_PROGRESSION ? 'var(--success)' : 'var(--ink-2)'}},
        `${counts.progression}/${MAX_PROGRESSION} progression`), ' · ',
      h('span', null, `${counts.maintenance} maintenance`)),

    /* Per-muscle picker rows */
    h('div', {style:{display:'flex',flexDirection:'column',gap:6,marginBottom:14}},
      state.muscleGroups.map(g => {
        const v = muscleStatus[g] || 'maintenance';
        const subs = (state.subGroups && state.subGroups[g]) || [];
        const hasSubGroups = subs.length > 0;          // le muscle a des sous-groupes
        // Le split sous-groupes est éditable pour tous les statuts — même en maintenance,
        // la répartition relative du volume réduit reste pertinente. Le seul cas où on ne
        // peut pas déplier, c'est si le muscle n'a pas de sous-groupes définis.
        const canExpand = hasSubGroups;
        const isOpen = expandedSub === g && canExpand;
        const targetG = targets[g] || 0;
        // Répartition actuelle : custom si défini, sinon défaut
        const curSplit = subSplit[g] || SUB_GROUP_DEFAULT_SPLIT[g] || {};
        // Normalise pour s'assurer que tous les sous-groupes sont présents
        const fullSplit = {};
        subs.forEach(s => { fullSplit[s] = curSplit[s] !== undefined ? curSplit[s] : (SUB_GROUP_DEFAULT_SPLIT[g]?.[s] || Math.round(100/subs.length)); });
        const splitTotal = Object.values(fullSplit).reduce((a,v)=>a+v,0);
        const previewSeries = splitVolumeBySubGroups(g, targetG, fullSplit, state.subGroups) || {};
        const isCustom = subSplit[g] !== undefined;

        return h('div', {key:g, style:{
          borderRadius:10, background:'var(--bg-2)', border:'1px solid var(--line)', overflow:'hidden'
        }},
          /* Ligne muscle : zone gauche dépliable (chevron+label) + zone droite boutons statut — séparées */
          h('div', {style:{
            display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center',
            padding:'10px 12px', gap:8
          }},
            /* Zone cliquable GAUCHE : chevron orange + label (déplie si hors maintenance) */
            hasSubGroups
              ? h('button', {
                  className: 'pressable',
                  type: 'button',
                  disabled: !canExpand,
                  onClick: () => canExpand && setExpandedSub(isOpen ? null : g),
                  style: {
                    display:'flex', alignItems:'center', gap:8, textAlign:'left',
                    background:'transparent', padding:0, minWidth:0,
                    cursor: canExpand ? 'pointer' : 'not-allowed',
                    opacity: canExpand ? 1 : 0.75
                  }
                },
                  h('span', {style:{
                    color:'var(--accent-hi)',
                    display:'inline-flex',
                    transform:isOpen?'rotate(180deg)':'',
                    transition:'transform .2s',
                    background:'var(--accent-wash)',
                    borderRadius:6,
                    padding:'4px 4px',
                    border:'1px solid rgba(252,76,2,.35)'
                  }},
                    ICONS.chevDown),
                  h('div', {style:{minWidth:0}},
                    h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)'}}, g,
                      isCustom && canExpand && h('span', {style:{marginLeft:6,fontSize:9,fontWeight:800,color:'var(--accent-hi)',textTransform:'uppercase',letterSpacing:'.08em'}}, 'custom')),
                    h('div', {className:'meta', style:{marginTop:2}}, targetG + ' séries/sem')))
              : h('div', {style:{minWidth:0}},
                  h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)'}}, g),
                  h('div', {className:'meta', style:{marginTop:2}}, targetG + ' séries/sem')),
            /* Zone DROITE : boutons statut, totalement isolée (pas d'onClick sur le parent) */
            h('div', {style:{display:'flex',gap:3}},
              [['maintenance','='],['progression','↑'],['focus','★']].map(([val,icon]) => {
                const active = v === val;
                const disabled = (val === 'focus' && counts.focus >= MAX_FOCUS && !active) ||
                                 (val === 'progression' && counts.progression >= MAX_PROGRESSION && !active);
                return h('button', {key:val, className:'pressable', onClick:()=>setStatus(g, val),
                  style:{
                    minWidth:34, padding:'6px 8px', borderRadius:8, fontSize:13, fontWeight:800,
                    background: statusBg(val, active),
                    color: active ? statusColor(val) : (disabled ? 'var(--ink-4)' : 'var(--ink-3)'),
                    border: active ? `1px solid ${statusColor(val)}40` : '1px solid transparent',
                    opacity: disabled ? .45 : 1
                  }}, icon);
              }))
          ),
          /* Panel sous-groupes dépliable */
          canExpand && isOpen && h('div', {style:{padding:'12px 12px 14px',background:'var(--bg-3)',borderTop:'1px solid var(--line)'}},
            h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}},
              h('div', {className:'label', style:{margin:0}}, 'Répartition sous-groupes'),
              (isCustom || splitTotal !== 100) && h('button', {
                className:'pressable',
                onClick:()=>{ const next = {...subSplit}; delete next[g]; setSubSplit(next); haptic('light'); },
                style:{fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,background:'var(--bg-2)',color:'var(--ink-2)'}
              }, '↺ Défaut')),
            h('div', {style:{display:'flex',flexDirection:'column',gap:8}},
              subs.map(sub => {
                const pct = fullSplit[sub] || 0;
                const series = previewSeries[sub] || 0;
                return h(SgSliderRow, {
                  key: sub,
                  name: sub,
                  pct,
                  series,
                  onChange: (newVal) => {
                    // Rebalance : on met la valeur du slider déplacé, et on répartit proportionnellement le reste sur les autres
                    const others = subs.filter(s => s !== sub);
                    const othersTotal = others.reduce((a,s) => a + (fullSplit[s]||0), 0);
                    const remaining = Math.max(0, 100 - newVal);
                    const next = {[sub]: newVal};
                    if (othersTotal > 0) {
                      others.forEach(s => { next[s] = (fullSplit[s]||0) * (remaining / othersTotal); });
                    } else {
                      others.forEach(s => { next[s] = remaining / others.length; });
                    }
                    setSubSplit({...subSplit, [g]: next});
                  }
                });
              })
            ),
            h('p', {className:'meta', style:{marginTop:10,fontSize:10.5,color:'var(--ink-3)',fontStyle:'italic'}},
              `Total ${Math.round(splitTotal)}% · ajuste un curseur, les autres se rééquilibrent automatiquement.`)
          )
        );
      })
    ),

    /* SUMMARY */
    h('div', {style:{padding:12,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10,marginBottom:18,display:'flex',justifyContent:'space-between'}},
      h('div', null,
        h('div', {className:'meta'}, 'Volume total'),
        h('div', {style:{fontSize:16,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums'}},
          totalSets + ' séries/sem')),
      h('div', {style:{textAlign:'right'}},
        h('div', {className:'meta'}, 'Capacité '+frequency+'x/sem'),
        h('div', {style:{fontSize:16,fontWeight:800,color: totalSets > weeklyCap ? 'var(--pr-gold)' : 'var(--success)',fontVariantNumeric:'tabular-nums'}},
          weeklyCap + ' séries')),
    ),
    totalSets > weeklyCap && h('p', {className:'meta', style:{marginTop:-14,marginBottom:18,fontSize:11,color:'var(--ink-3)',fontStyle:'italic'}},
      `Le volume sera réparti intelligemment sur les ${frequency} séances — certains muscles secondaires verront leur volume réduit si nécessaire.`),

    h('button', {className:'btn btn-primary btn-full pressable', onClick:go},
      ICONS.check, ' Générer le programme')
  );
}

/* ==========================================================================
   MANUAL PROGRAM CREATE
   ========================================================================== */

function ManualProgramCreate({state, onBack}) {
  const [name, setName] = useState('');
  const create = () => {
    if (!name.trim()) { haptic('warning'); return; }
    const p = { id:uid(), name:name.trim(), sessions:[], volumeTargets:{program:{}, sessions:{}}, auto:false };
    state.setPrograms([...state.programs, p]);
    state.setCurrentProgramId(p.id);
    haptic('success');
  };
  return h('div', null,
    h('button', {className:'pressable', onClick:onBack,
      style:{color:'var(--ink-2)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4,marginBottom:14}},
      ICONS.left, 'Retour'),
    h('h1', {style:{margin:0,fontSize:26,fontWeight:800,letterSpacing:'-0.035em',color:'var(--ink-0)'}}, 'Programme manuel'),
    h('p', {className:'body-sm', style:{color:'var(--ink-2)',marginTop:6,marginBottom:20}},
      'Tu pourras ajouter les séances et exercices ensuite.'),
    h('div', {className:'label', style:{marginBottom:8}}, 'Nom du programme'),
    h('input', {className:'input', style:{marginBottom:20}, value:name, onChange:e=>setName(e.target.value), autoFocus:true, placeholder:'Ex: Lean bulk 4x/sem', onKeyDown:e=>e.key==='Enter'&&create()}),
    h('button', {className:'btn btn-primary btn-full pressable', onClick:create},
      ICONS.check, ' Créer le programme')
  );
}

/* ==========================================================================
   PROGRAM EDITOR (existing program)
   ========================================================================== */

function ParamsProgram({state}) {
  const {programs, setPrograms, currentProgram, currentProgramId, setCurrentProgramId, exerciseLib, updateCurrentProgram, journalLogs} = state;
  const [expandedSession, setExpandedSession] = useState(null);
  const [renameSessionOpen, setRenameSessionOpen] = useState(null); // session object | null
  const [renameSessionVal, setRenameSessionVal] = useState('');
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('Séance');
  const [addExoTo, setAddExoTo] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMuscle, setPickerMuscle] = useState('');
  const [pickerQuery, setPickerQuery] = useState(''); // recherche dans le picker d'ajout d'exo
  const [muscleFilterOpen, setMuscleFilterOpen] = useState(false);
  const [deleteProgOpen, setDeleteProgOpen] = useState(false);
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(null);
  const [newProgMode, setNewProgMode] = useState(null); // null | 'menu' | 'generator' | 'manual'
  const [manualNameVal, setManualNameVal] = useState('');
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [editVariantsFor, setEditVariantsFor] = useState(null); // {sid, exIdx}
  // Confirmation de suppression d'un exo : on stocke l'identifiant de l'exo à supprimer + son nom pour le message
  const [delExoOpen, setDelExoOpen] = useState(null); // {sid, exIdx, exName} | null
  // Sheet "déplacer vers une autre séance" : on liste les autres sessions
  const [moveToSessionFor, setMoveToSessionFor] = useState(null); // {sid, exIdx, exName} | null
  // Animation de réordonnancement : on garde l'id de l'exo qui vient de bouger pour le highlight
  // (clé = ex.id pour persister à travers les renders, valeur = direction du dernier mouvement)
  const [recentlyMoved, setRecentlyMoved] = useState({id: null, dir: 0});

  // Volume per session currently computed for live feedback
  const pv = useMemo(() => programVolume(currentProgram, exerciseLib), [currentProgram, exerciseLib]);
  const targets = currentProgram?.volumeTargets?.program || {};

  const delProgram = () => {
    const others = programs.filter(p => p.id !== currentProgramId);
    setPrograms(others);
    setCurrentProgramId(others[0]?.id || null);
  };

  const dupProgram = () => {
    const copy = JSON.parse(JSON.stringify(currentProgram));
    copy.id = uid();
    copy.name = copy.name + ' (copie)';
    copy.sessions.forEach(s => {
      s.id = uid();
      s.exercises.forEach(ex => ex.id = uid());
    });
    setPrograms([...programs, copy]);
    setCurrentProgramId(copy.id);
    haptic('success');
  };

  const addSession = () => {
    if (!newSessionName.trim()) return;
    updateCurrentProgram(p => {
      p.sessions.push({id: uid(), name: newSessionName.trim(), exercises:[]});
    });
    setNewSessionName('Séance');
    setAddSessionOpen(false);
  };

  const addExoToSession = (libEx) => {
    updateCurrentProgram(p => {
      const s = p.sessions.find(x => x.id === addExoTo);
      if (!s) return;
      s.exercises.push({
        id: uid(), sets: 3,
        muscleGroup: libEx.muscleGroup,
        choices: [{exId: libEx.id, weight:'', machine:'', muscleGroup: libEx.muscleGroup}],
        isCompound: !!libEx.compound,
        history: []
      });
    });
    setAddExoTo(null);
    setPickerOpen(false);
    setPickerMuscle('');
    haptic('success');
  };

  const delExo = (sid, exIdx) => {
    updateCurrentProgram(p => {
      const s = p.sessions.find(x=>x.id===sid);
      if (s) s.exercises.splice(exIdx, 1);
    });
    haptic('light');
  };

  const updateExoSets = (sid, exIdx, sets) => {
    updateCurrentProgram(p => {
      const s = p.sessions.find(x=>x.id===sid);
      if (s && s.exercises[exIdx]) s.exercises[exIdx].sets = Math.max(1, parseInt(sets)||1);
    });
  };

  const updateExoWeight = (sid, exIdx, weight) => {
    updateCurrentProgram(p => {
      const s = p.sessions.find(x=>x.id===sid);
      if (s && s.exercises[exIdx]?.choices?.[0]) s.exercises[exIdx].choices[0].weight = weight;
    });
  };

  const updateChoiceWeight = (sid, exIdx, choiceIdx, weight) => {
    updateCurrentProgram(p => {
      const s = p.sessions.find(x=>x.id===sid);
      if (s && s.exercises[exIdx]?.choices?.[choiceIdx]) s.exercises[exIdx].choices[choiceIdx].weight = weight;
    });
  };

  /**
   * Toggle un modèle dans la liste programmée d'un exo, ou met à jour sa cible.
   * weight === null → retire le modèle de la liste programmée.
   * weight === '' (string vide) → ajoute le modèle s'il n'existe pas, ou conserve cible vide.
   * weight === '12.5' (string) → met à jour la cible.
   */
  const updateExoModelTarget = (sid, exIdx, modelId, weight) => {
    updateCurrentProgram(p => {
      const s = p.sessions.find(x=>x.id===sid);
      if (!s || !s.exercises[exIdx]) return;
      const ex = s.exercises[exIdx];
      const targets = ex.modelTargets || [];
      if (weight === null) {
        // remove
        ex.modelTargets = targets.filter(t => t.modelId !== modelId);
      } else {
        const existing = targets.find(t => t.modelId === modelId);
        const w = weight === '' ? '' : (parseFloat(weight) || '');
        if (existing) {
          existing.weight = w;
        } else {
          targets.push({modelId, weight: w});
          ex.modelTargets = targets;
        }
      }
    });
  };

  const moveExo = (sid, exIdx, dir) => {
    let movedId = null;
    updateCurrentProgram(p => {
      const s = p.sessions.find(x=>x.id===sid);
      if (!s) return;
      const ni = exIdx + dir;
      if (ni < 0 || ni >= s.exercises.length) return;
      [s.exercises[exIdx], s.exercises[ni]] = [s.exercises[ni], s.exercises[exIdx]];
      movedId = s.exercises[ni].id; // l'exo a maintenant l'index ni
    });
    if (movedId) {
      // Feedback visuel : on tag l'exo comme "récemment déplacé" pour déclencher l'animation
      // Le useEffect/timer ci-dessous remet à null après l'anim (~600ms)
      setRecentlyMoved({id: movedId, dir});
      haptic('light');
      setTimeout(() => setRecentlyMoved({id: null, dir: 0}), 600);
    }
  };

  /**
   * Déplace un exo d'une séance vers une autre du même programme.
   * L'exo est ajouté à la fin de la séance cible et retiré de la séance source.
   */
  const moveExoToSession = (sourceSid, exIdx, targetSid) => {
    if (sourceSid === targetSid) return;
    let movedId = null;
    updateCurrentProgram(p => {
      const src = p.sessions.find(x => x.id === sourceSid);
      const tgt = p.sessions.find(x => x.id === targetSid);
      if (!src || !tgt || !src.exercises[exIdx]) return;
      const [moved] = src.exercises.splice(exIdx, 1);
      tgt.exercises.push(moved);
      movedId = moved.id;
    });
    if (movedId) {
      // Highlight l'exo dans sa nouvelle séance ; ouvre la séance cible si pas encore expanded
      setRecentlyMoved({id: movedId, dir: 0});
      setExpandedSession(targetSid);
      haptic('success');
      setTimeout(() => setRecentlyMoved({id: null, dir: 0}), 800);
    }
    setMoveToSessionFor(null);
  };

  // Live volume display: actual program sets vs target, avec sous-groupes
  const renderVolumeWidget = () => {
    const groupsWithActivity = [...new Set([...Object.keys(targets), ...Object.keys(pv.total)])].filter(g => (pv.total[g]||0) > 0 || (targets[g]||0) > 0);
    if (groupsWithActivity.length === 0) return null;
    groupsWithActivity.sort((a,b) => (targets[b]||0) - (targets[a]||0));
    const subTargets = currentProgram?.volumeTargets?.subGroups || {};

    const totalProgramSets = Object.values(pv.total || {}).reduce((a, v) => a + (v || 0), 0);
    const totalProgramTarget = Object.values(targets || {}).reduce((a, v) => a + (parseInt(v) || 0), 0);

    return h('div', {style:{padding:14,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:12,marginBottom:14}},
      h('div', {className:'label', style:{marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'baseline'}},
        h('span', null, 'Volume programme'),
        h('span', {style:{textTransform:'none',letterSpacing:0,fontSize:11,color:'var(--ink-2)',fontWeight:700,fontVariantNumeric:'tabular-nums'}},
          h('span', {style:{color:'var(--ink-0)'}}, totalProgramSets),
          totalProgramTarget > 0 ? h('span', {style:{color:'var(--ink-3)',fontWeight:600}}, ' / ' + totalProgramTarget) : null,
          h('span', {style:{color:'var(--ink-3)',fontWeight:600}}, ' séries/sem')
        )
      ),
      h('div', {className:'volbar'},
        groupsWithActivity.map(g => {
          const subs = (state.subGroups && state.subGroups[g]) || SUB_GROUPS_DEFAULT[g] || [];
          const subActual = pv.totalSub?.[g] || {};
          const subTgt = subTargets[g] || (targets[g] ? splitVolumeBySubGroups(g, targets[g], null, state.subGroups) : null) || {};

          return h(React.Fragment, {key:g},
            h(VolumeBar, {label:g, actual: pv.total[g]||0, target: targets[g]||0}),
            // Sous-groupes en sous-liste, indentés, compact, opacité réduite pour hiérarchie
            subs.length > 0 && h('div', {style:{paddingLeft:16,marginTop:-3,marginBottom:3,display:'flex',flexDirection:'column',gap:4,borderLeft:'1px solid var(--line)',marginLeft:6}},
              subs.map(sg => h('div', {key:sg, style:{opacity:.78}},
                h(VolumeBar, {label: sg, actual: subActual[sg]||0, target: subTgt[sg]||0, compact: true})
              ))
            )
          );
        })
      )
    );
  };

  // === Inline generator flow (Nouveau programme → Générateur auto) ===
  if (newProgMode === 'generator') {
    return h(GeneratorForm, {
      state,
      onBack: ()=>setNewProgMode(null),
      title: 'Nouveau programme auto',
      onGenerate: (params, progName) => {
        const prog = generateProgram({...params, lib: state.exerciseLib, muscleGroups: state.muscleGroups, name: progName});
        setPrograms([...programs, prog]);
        setCurrentProgramId(prog.id);
        setNewProgMode(null);
        haptic('success');
      }
    });
  }

  return h('div', null,
    /* Program selector */
    h('div', {style:{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:4}},
      programs.map(p => h('button', {
        key:p.id, className:'pressable chip' + (p.id===currentProgramId?' primary':''),
        style:{flex:'0 0 auto', padding:'8px 14px', fontSize:13},
        onClick:()=>setCurrentProgramId(p.id)
      }, p.name)),
      h('button', {className:'chip pressable', style:{flex:'0 0 auto', padding:'8px 12px'},
        onClick:()=>{ setManualNameVal(''); setNewProgMode('menu'); }
      }, ICONS.plus)
    ),

    /* Program name + actions */
    h('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:14}},
      h('input', {className:'input', style:{flex:1, fontWeight:700, fontSize:16},
        defaultValue: currentProgram.name,
        onBlur: e => {
          const v = e.target.value.trim();
          if (v && v !== currentProgram.name) setPrograms(programs.map(p => p.id===currentProgramId?{...p,name:v}:p));
        }
      }),
      h('button', {className:'btn btn-ghost btn-sm pressable', onClick:dupProgram, title:'Dupliquer',
        style:{padding:'8px 10px',display:'inline-flex',alignItems:'center',gap:4}},
        h('svg', {width:14,height:14,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'},
          h('rect', {x:9,y:9,width:13,height:13,rx:2}),
          h('path', {d:'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1'}))
      ),
      h('button', {className:'btn btn-ghost btn-sm pressable', style:{color:'var(--danger)'}, onClick:()=>setDeleteProgOpen(true)}, ICONS.trash)
    ),

    /* Program meta chips + edit muscleStatus */
    currentProgram.auto && h('div', {style:{marginBottom:14}},
      h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}},
        h('div', {style:{display:'flex',flexWrap:'wrap',gap:4,flex:1,minWidth:0}},
          h('span', {className:'chip'}, currentProgram.level),
          h('span', {className:'chip'}, currentProgram.frequency + 'x/sem'),
          (currentProgram.muscleStatus
            ? Object.entries(currentProgram.muscleStatus).filter(([,v]) => v === 'focus').map(([g]) => g)
            : (currentProgram.priorities||[])
          ).map(p => h('span', {key:p, className:'chip primary'}, '★ ' + p))),
        h('button', {
          className:'btn btn-ghost btn-sm pressable',
          style:{fontSize:12,padding:'6px 10px',minHeight:32,flex:'0 0 auto'},
          onClick: () => setEditStatusOpen(true)
        }, '★ Focus muscles')
      )
    ),

    /* Live volume widget */
    renderVolumeWidget(),

    /* Sessions */
    (currentProgram.sessions||[]).map((s,si) => {
      const expanded = expandedSession === s.id;
      const sessionVol = pv.perSession[s.id] || {};
      const sessionVolTotal = Object.values(sessionVol).reduce((a,v)=>a+v,0);
      return h('div', {key:s.id, style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',marginBottom:8,overflow:'hidden'}},
        h('div', {
          className:'pressable',
          style:{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'},
          onClick: (e)=>{
            if (e.target.closest('[data-no-expand]')) return;
            setExpandedSession(expanded?null:s.id);
          }
        },
          h('span', {className: 'mv-chev' + (expanded?' open':''), style:{
            color:'var(--accent-hi)',
            background:'var(--accent-wash)',
            borderRadius:6, padding:'4px 4px',
            border:'1px solid rgba(252,76,2,.35)',
            flex:'0 0 auto'
          }}, ICONS.chevDown),
          h('span', {style:{flex:1, fontWeight:700, color:'var(--ink-0)', minWidth:0,
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
            s.name),
          h('span', {className:'meta', style:{flex:'0 0 auto'}}, sessionVolTotal + ' séries'),
          h('button', {'data-no-expand':true, className:'pressable', style:{color:'var(--ink-2)',padding:4},
            onClick:(e)=>{ e.stopPropagation(); setRenameSessionOpen(s); setRenameSessionVal(s.name); }},
            ICONS.edit),
          h('button', {'data-no-expand':true, className:'pressable', style:{color:'var(--danger)',padding:4},
            onClick:(e)=>{ e.stopPropagation(); setDeleteSessionOpen(s); }}, ICONS.trash)
        ),
        h('div', {className: 'mv-expand' + (expanded?' open':'')}, h('div', {className:'mv-expand-inner'}, h('div', {style:{padding:'0 14px 14px'}},
          /* Session volume mini-breakdown */
          Object.keys(sessionVol).length > 0 && h('div', {style:{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}},
            Object.entries(sessionVol).sort((a,b)=>b[1]-a[1]).map(([g,v]) =>
              h('span', {key:g, className:'chip', style:{fontSize:10, padding:'3px 8px'}},
                g + ' ' + v))),
          (s.exercises||[]).map((ex, ei) => {
            const c = ex.choices?.[0];
            const libEx = c?.exId ? exerciseLib.find(l=>l.id===c.exId) : null;
            const nVariants = (ex.choices||[]).length;
            const models = libEx?.models || [];
            // modelTargets[] est l'array de cibles par modèle programmé (peut être vide)
            const modelTargets = ex.modelTargets || [];
            const hasModels = models.length > 0;
            const setting = libEx?.setting; // réglage global de l'exo (si pas de modèles)
            // Animation iOS-style si l'exo vient d'être déplacé : highlight orange + lift
            const isJustMoved = recentlyMoved.id === ex.id;
            return h('div', {key:ex.id, style:{
              background: isJustMoved ? 'var(--accent-wash)' : 'var(--bg-3)',
              borderRadius:10, marginBottom:4, padding:'10px 12px',
              display:'flex', flexDirection:'column', gap:8,
              border: '1px solid ' + (isJustMoved ? 'rgba(252,76,2,.5)' : 'transparent'),
              boxShadow: isJustMoved
                ? '0 6px 18px -4px rgba(252,76,2,.5), 0 0 0 4px rgba(252,76,2,.18)'
                : 'none',
              transform: isJustMoved ? 'scale(1.015)' : 'scale(1)',
              transition: 'transform 320ms cubic-bezier(.22,1,.36,1), background-color 320ms cubic-bezier(.22,1,.36,1), box-shadow 320ms cubic-bezier(.22,1,.36,1), border-color 320ms cubic-bezier(.22,1,.36,1)',
              willChange: isJustMoved ? 'transform' : 'auto',
              position: 'relative',
              zIndex: isJustMoved ? 2 : 1
            }},
              // Ligne principale : nom (avec ellipsis) + actions à droite (taille fixe)
              h('div', {style:{
                display:'grid',
                gridTemplateColumns:'minmax(0, 1fr) auto',
                gap:8,alignItems:'flex-start'
              }},
                // Bloc gauche : nom + meta — tronqué
                h('div', {style:{minWidth:0}},
                  h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)',display:'flex',alignItems:'center',gap:6,minWidth:0}},
                    h('span', {style:{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0,flex:'0 1 auto'}},
                      libEx?.name || ex.exName || '?'),
                    libEx?.compound && h('span', {className:'chip', style:{padding:'1px 5px',fontSize:8,background:'var(--bg-hover)',flex:'0 0 auto'}}, 'poly')),
                  h('div', {style:{fontSize:11,color:'var(--ink-3)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
                    (libEx?.muscleGroup || ex.muscleGroup),
                    libEx?.subGroup ? ' · ' + libEx.subGroup : ''),
                  // Réglage global (lecture seule) — uniquement si pas de modèles
                  setting && !hasModels && h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:3,fontStyle:'italic',display:'flex',alignItems:'center'}},
                    ICONS.tune, setting)),
                // Bloc droite : actions verticales compact (≈ 96px fixe)
                h('div', {style:{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flex:'0 0 auto'}},
                  // Ligne 1 : déplacer dans la séance + suppression
                  h('div', {style:{display:'flex',gap:2}},
                    h('button', {className:'pressable', style:{color:'var(--ink-3)',padding:4}, onClick:()=>moveExo(s.id, ei, -1), disabled:ei===0},
                      h('span',{style:{transform:'rotate(180deg)',display:'inline-flex'}}, ICONS.chevDown)),
                    h('button', {className:'pressable', style:{color:'var(--ink-3)',padding:4}, onClick:()=>moveExo(s.id, ei, 1), disabled:ei===s.exercises.length-1},
                      ICONS.chevDown),
                    h('button', {className:'pressable', style:{color:'var(--danger)',padding:4},
                      onClick: () => setDelExoOpen({sid: s.id, exIdx: ei, exName: libEx?.name || ex.exName || 'cet exercice'})
                    }, ICONS.x)),
                  // Ligne 2 : déplacer vers une autre séance (visible si au moins 2 séances dans le programme)
                  (currentProgram.sessions||[]).length > 1 && h('button', {
                    className:'pressable',
                    onClick: () => setMoveToSessionFor({sid: s.id, exIdx: ei, exName: libEx?.name || ex.exName || 'cet exercice'}),
                    style:{
                      fontSize:9, fontWeight:700, letterSpacing:'.05em',
                      color:'var(--ink-3)', padding:'2px 6px',
                      borderRadius:6, background:'rgba(255,255,255,.04)',
                      border:'1px solid var(--line)',
                      display:'inline-flex',alignItems:'center',gap:3,whiteSpace:'nowrap'
                    }
                  }, '⇄ vers séance')
                )
              ),

              // Ligne séries + cible (uniforme entre exos)
              h('div', {style:{display:'grid',gridTemplateColumns:'auto 1fr',gap:8,alignItems:'center'}},
                // Stepper séries
                h('div', {style:{display:'inline-flex',alignItems:'center',gap:2,background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:8,padding:2,flex:'0 0 auto'}},
                  h('button', {className:'pressable', onClick:()=>updateExoSets(s.id, ei, (parseInt(ex.sets)||1)-1),
                    disabled: (parseInt(ex.sets)||1) <= 1,
                    style:{width:24,height:24,display:'inline-flex',alignItems:'center',justifyContent:'center',color:'var(--ink-2)',fontSize:16,fontWeight:700,opacity: (parseInt(ex.sets)||1)<=1?.3:1}
                  }, '−'),
                  h('div', {style:{minWidth:28,textAlign:'center',fontSize:13,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums'}},
                    (parseInt(ex.sets)||1) + '×'),
                  h('button', {className:'pressable', onClick:()=>updateExoSets(s.id, ei, (parseInt(ex.sets)||1)+1),
                    disabled: (parseInt(ex.sets)||1) >= 6,
                    style:{width:24,height:24,display:'inline-flex',alignItems:'center',justifyContent:'center',color:'var(--accent)',fontSize:16,fontWeight:700,opacity: (parseInt(ex.sets)||1)>=6?.3:1}
                  }, '+')),
                // Cible globale (variante principale uniquement) ou label modèles.
                // Les variantes secondaires et leurs poids sont gérés dans la popup variantes.
                !hasModels
                  ? h('input', {type:'number', step:'0.5', className:'input', style:{padding:'6px 8px',fontSize:12,textAlign:'center',width:'100%'},
                      placeholder:'kg cible', value: c?.weight || '',
                      onChange: e => updateExoWeight(s.id, ei, e.target.value)})
                  : h('div', {style:{fontSize:10,color:'var(--ink-3)',fontStyle:'italic',textAlign:'right'}},
                    models.length + ' modèle' + (models.length>1?'s':''))
              ),

              // Sous-bloc modèles : tous les modèles de la lib sont toujours présents,
              // chacun avec son input poids cible (vide ou rempli).
              hasModels && h('div', {style:{
                marginTop:2,paddingTop:8,borderTop:'1px solid rgba(255,255,255,.05)',
                display:'flex',flexDirection:'column',gap:4
              }},
                models.map(m => {
                  const programmed = modelTargets.find(t => t.modelId === m.id);
                  return h('div', {key:m.id, style:{display:'flex',alignItems:'center',gap:6,fontSize:11,minWidth:0}},
                    // Nom du modèle (tronqué)
                    h('span', {style:{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--ink-1)'}}, m.name),
                    // Input cible (toujours visible)
                    h('input', {type:'number', step:'0.5', className:'input', style:{padding:'4px 6px',fontSize:11,textAlign:'center',width:60,flex:'0 0 auto'},
                      placeholder:'kg', value: programmed?.weight ?? '',
                      onChange: e => updateExoModelTarget(s.id, ei, m.id, e.target.value)})
                  );
                })
              ),

              // Bouton ajouter une variante d'exo (autre exo de la lib)
              h('button', {className:'pressable',
                style:{display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:700,color:nVariants>1?'var(--accent-hi)':'var(--ink-3)',padding:'3px 0',alignSelf:'flex-start'},
                onClick: ()=>setEditVariantsFor({sid:s.id, exIdx:ei})},
                nVariants > 1 ? `${nVariants} variantes d'exo ▸` : '+ variante d\'exo')
            );
          }),
          h('button', {className:'btn btn-ghost btn-sm btn-full pressable', style:{marginTop:6},
            onClick:()=>{ setAddExoTo(s.id); setPickerOpen(true); setPickerMuscle(''); }},
            ICONS.plus, ' Exercice'))))
      );
    }),
    h('button', {className:'btn btn-ghost btn-full pressable', style:{marginTop:10}, onClick:()=>setAddSessionOpen(true)},
      ICONS.plus, ' Ajouter une séance'),

    /* NEW PROGRAM MENU */
    h(Sheet, {open: newProgMode === 'menu', onClose:()=>setNewProgMode(null), title:'Nouveau programme'},
      h('button', {className:'btn btn-primary btn-full pressable', style:{marginBottom:8}, onClick:()=>{
        haptic('medium');
        setNewProgMode('generator');
      }}, '🧠 Générateur auto'),
      h('button', {className:'btn btn-ghost btn-full pressable', onClick:()=>{
        haptic('light');
        setManualNameVal('');
        setNewProgMode('manual');
      }}, '✏️ Programme vide')
    ),

    /* MANUAL PROGRAM NAME */
    h(Sheet, {open: newProgMode === 'manual', onClose:()=>setNewProgMode(null), title:'Nom du programme'},
      h('div', {style:{display:'flex',flexDirection:'column',gap:10}},
        h('input', {className:'input', value:manualNameVal, onChange:e=>setManualNameVal(e.target.value),
          placeholder:'Ex: Mon programme', autoFocus:true,
          onKeyDown:e=>{ if (e.key==='Enter' && manualNameVal.trim()) {
            const p = { id:uid(), name:manualNameVal.trim(), sessions:[], volumeTargets:{program:{}, sessions:{}}, auto:false };
            setPrograms([...programs, p]);
            setCurrentProgramId(p.id);
            setNewProgMode(null);
            haptic('success');
          }}}),
        h('button', {className:'btn btn-primary btn-full pressable',
          disabled: !manualNameVal.trim(),
          onClick:()=>{
            const p = { id:uid(), name:manualNameVal.trim(), sessions:[], volumeTargets:{program:{}, sessions:{}}, auto:false };
            setPrograms([...programs, p]);
            setCurrentProgramId(p.id);
            setNewProgMode(null);
            haptic('success');
          }}, ICONS.check, ' Créer')
      )
    ),

    /* NEW SESSION */
    h(Sheet, {open:addSessionOpen, onClose:()=>setAddSessionOpen(false), title:'Nouvelle séance'},
      h('div', {style:{display:'flex',gap:8}},
        h('input', {className:'input', value:newSessionName, onChange:e=>setNewSessionName(e.target.value), autoFocus:true,
          onKeyDown:e=>e.key==='Enter'&&addSession()}),
        h('button', {className:'btn btn-primary', onClick:addSession}, 'Ajouter'))
    ),

    /* ADD EXO - Picker sheet with muscle filter + recherche par nom */
    h(Sheet, {open:pickerOpen, onClose:()=>{setPickerOpen(false); setAddExoTo(null); setPickerQuery('');}, title:'Ajouter un exercice'},
      h('div', {style:{display:'flex',flexDirection:'column',gap:10}},
        // Recherche par nom
        h('input', {
          className:'input',
          placeholder:'Rechercher…',
          value: pickerQuery,
          onChange: e => setPickerQuery(e.target.value),
          autoFocus: true
        }),
        // Filtre muscle
        h('button', {className:'pressable', onClick:()=>setMuscleFilterOpen(true),
          style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:10,background:'var(--bg-3)',border:'1px solid var(--line)',width:'100%',textAlign:'left'}
        },
          h('span', {style:{fontSize:13,color:pickerMuscle?'var(--ink-0)':'var(--ink-3)',fontWeight:600}},
            pickerMuscle || 'Tous les groupes'),
          h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
        // Liste filtrée
        (() => {
          const q = pickerQuery.trim().toLowerCase();
          const filtered = exerciseLib
            .filter(l => !pickerMuscle || l.muscleGroup === pickerMuscle)
            .filter(l => !q || l.name.toLowerCase().includes(q) || (l.subGroup||'').toLowerCase().includes(q))
            .sort((a,b) => a.muscleGroup.localeCompare(b.muscleGroup) || (b.priority||5)-(a.priority||5));
          if (filtered.length === 0) {
            return h('div', {className:'empty-state', style:{padding:24}},
              h('div', {className:'sub'}, q ? 'Aucun résultat pour « '+pickerQuery+' »' : 'Aucun exercice'));
          }
          return h('div', {style:{maxHeight:'45vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:4}},
            filtered.map(l => h('button', {key:l.id, className:'pressable', onClick:()=>{addExoToSession(l); setPickerQuery('');},
              style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:'var(--bg-3)',textAlign:'left',width:'100%'}
            },
              h('div', {style:{flex:1,minWidth:0}},
                // Ligne 1 : nom de l'exo
                h('div', {style:{fontSize:13,fontWeight:600,color:'var(--ink-0)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, l.name),
                // Ligne 2 : muscle + sous-groupe (si existe) + poly/iso
                h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
                  l.muscleGroup,
                  l.subGroup ? ' · ' + l.subGroup : '',
                  ' · ',
                  l.compound?'poly':'iso')),
              h('span', {style:{color:'var(--accent)',flex:'0 0 auto'}}, ICONS.plus)
            ))
          );
        })()
      )
    ),
    h(PickerSheet, {
      open: muscleFilterOpen, onClose:()=>setMuscleFilterOpen(false),
      title: 'Groupe musculaire',
      options: [{value:'', label:'Tous les groupes'}, ...state.muscleGroups.map(g => ({value:g, label:g}))],
      value: pickerMuscle,
      onPick: setPickerMuscle
    }),

    /* REGENERATE — removed per user request */

    h(ConfirmSheet, {
      open: deleteProgOpen, onClose:()=>setDeleteProgOpen(false),
      onConfirm: delProgram,
      title: 'Supprimer le programme ?',
      message: `"${currentProgram.name}" sera supprimé. Les séances déjà journalisées sont conservées.`
    }),
    h(ConfirmSheet, {
      open: !!deleteSessionOpen, onClose:()=>setDeleteSessionOpen(null),
      onConfirm: () => {
        updateCurrentProgram(p => { p.sessions = p.sessions.filter(ss => ss.id !== deleteSessionOpen.id); });
        setDeleteSessionOpen(null);
      },
      title: 'Supprimer la séance ?',
      message: deleteSessionOpen ? `"${deleteSessionOpen.name}" et ses exercices seront supprimés.` : ''
    }),

    /* Rename session sheet */
    h(Sheet, {
      open: !!renameSessionOpen,
      onClose: () => { setRenameSessionOpen(null); setRenameSessionVal(''); },
      title: 'Renommer la séance'
    },
      h('input', {
        className:'input', autoFocus:true, value: renameSessionVal,
        onChange: e => setRenameSessionVal(e.target.value),
        onKeyDown: e => {
          if (e.key === 'Enter' && renameSessionVal.trim()) {
            const n = renameSessionVal.trim();
            const id = renameSessionOpen.id;
            updateCurrentProgram(p => {
              const ss = p.sessions.find(x => x.id === id);
              if (ss) ss.name = n;
            });
            setRenameSessionOpen(null);
            setRenameSessionVal('');
            haptic('success');
          }
        },
        style:{marginBottom:10}
      }),
      h('button', {
        className:'btn btn-primary btn-full pressable',
        onClick: () => {
          const n = renameSessionVal.trim();
          if (!n || !renameSessionOpen) { haptic('warning'); return; }
          const id = renameSessionOpen.id;
          updateCurrentProgram(p => {
            const ss = p.sessions.find(x => x.id === id);
            if (ss) ss.name = n;
          });
          setRenameSessionOpen(null);
          setRenameSessionVal('');
          haptic('success');
        }
      }, ICONS.check, ' Enregistrer')
    ),

    /* Edit variants sheet */
    h(EditVariantsSheet, {
      open: !!editVariantsFor,
      onClose: () => setEditVariantsFor(null),
      target: editVariantsFor,
      program: currentProgram,
      state,
      onSave: (newChoices) => {
        if (!editVariantsFor) return;
        updateCurrentProgram(p => {
          const s = p.sessions.find(x => x.id === editVariantsFor.sid);
          if (!s) return;
          const ex = s.exercises[editVariantsFor.exIdx];
          if (!ex) return;
          ex.choices = newChoices;
          // Garder le muscleGroup / subGroup à jour à partir de la variante principale
          const principal = newChoices[0];
          if (principal) {
            ex.muscleGroup = principal.muscleGroup || ex.muscleGroup;
            ex.subGroup = principal.subGroup || ex.subGroup;
          }
        });
        setEditVariantsFor(null);
        haptic('success');
      }
    }),

    /* Confirmation suppression d'un exo */
    h(ConfirmSheet, {
      open: !!delExoOpen,
      onClose: () => setDelExoOpen(null),
      title: 'Supprimer l\'exercice',
      message: delExoOpen ? `Retirer « ${delExoOpen.exName} » de cette séance ? Les séries déjà enregistrées dans le journal ne sont pas affectées.` : '',
      confirmLabel: 'Supprimer',
      danger: true,
      onConfirm: () => {
        if (!delExoOpen) return;
        delExo(delExoOpen.sid, delExoOpen.exIdx);
        setDelExoOpen(null);
      }
    }),

    /* Sheet sélection de séance cible pour déplacer un exo */
    h(Sheet, {
      open: !!moveToSessionFor,
      onClose: () => setMoveToSessionFor(null),
      title: moveToSessionFor ? 'Déplacer vers…' : 'Déplacer vers…'
    },
      moveToSessionFor && h('div', null,
        h('p', {className:'body-sm', style:{margin:'0 0 12px 0', color:'var(--ink-2)'}},
          'Choisir la séance d\'accueil pour ',
          h('strong', {style:{color:'var(--ink-0)'}}, '« ' + moveToSessionFor.exName + ' »'),
          '. L\'exercice sera ajouté à la fin de la séance choisie.'),
        h('div', {style:{display:'flex',flexDirection:'column',gap:6}},
          (currentProgram.sessions||[])
            .filter(s => s.id !== moveToSessionFor.sid)
            .map(s => {
              const exoCount = (s.exercises||[]).length;
              return h('button', {
                key: s.id,
                className: 'press-row',
                onClick: () => moveExoToSession(moveToSessionFor.sid, moveToSessionFor.exIdx, s.id),
                style:{
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
                  padding:'14px 14px', borderRadius:12,
                  background:'var(--bg-3)', border:'1px solid var(--line)',
                  textAlign:'left', width:'100%', cursor:'pointer'
                }
              },
                h('div', {style:{flex:1, minWidth:0}},
                  h('div', {style:{fontSize:14, fontWeight:700, color:'var(--ink-0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}},
                    s.name),
                  h('div', {className:'meta', style:{marginTop:2}},
                    exoCount + ' exo' + (exoCount > 1 ? 's' : ''))
                ),
                h('span', {style:{color:'var(--accent-hi)', fontSize:18, flex:'0 0 auto', transform:'rotate(-90deg)'}}, ICONS.chevDown)
              );
            })
        )
      )
    ),

    /* Edit muscleStatus sheet — existing auto programs only */
    h(EditMuscleStatusSheet, {
      open: editStatusOpen, onClose:()=>setEditStatusOpen(false),
      program: currentProgram,
      state,
      onSave: (newStatus) => {
        const newTargets = computeVolumeTargets({
          level: currentProgram.level, muscleStatus: newStatus, muscleGroups: state.muscleGroups
        });
        updateCurrentProgram(p => {
          p.muscleStatus = newStatus;
          p.volumeTargets = p.volumeTargets || {program:{}, sessions:{}};
          p.volumeTargets.program = newTargets;
        });
        setEditStatusOpen(false);
        haptic('success');
      }
    })
  );
}

function EditVariantsSheet({open, onClose, target, program, state, onSave}) {
  const {exerciseLib} = state;
  const [choices, setChoices] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    const sess = program?.sessions?.find(s => s.id === target.sid);
    const ex = sess?.exercises?.[target.exIdx];
    // Nettoyage : on retire les `sets` divergents par variante (ancienne donnée),
    // le nb de séries est désormais uniforme et porté par ex.sets.
    const cleaned = (ex?.choices || []).map(c => {
      const {sets, ...rest} = c || {};
      return rest;
    });
    setChoices(cleaned);
  }, [open, target, program]);

  if (!open || !target) return null;
  const sess = program?.sessions?.find(s => s.id === target.sid);
  const ex = sess?.exercises?.[target.exIdx];
  const principalMuscle = choices[0]?.muscleGroup;

  // Pool d'exos compatibles (même muscleGroup que principal, exclut exos déjà dans choices)
  const usedIds = new Set(choices.map(c => c.exId).filter(Boolean));
  const pool = principalMuscle
    ? exerciseLib.filter(l => l.muscleGroup === principalMuscle && !usedIds.has(l.id))
    : exerciseLib.filter(l => !usedIds.has(l.id));

  const addVariant = (libEx) => {
    setChoices([...choices, {
      exId: libEx.id, weight:'', machine:'',
      muscleGroup: libEx.muscleGroup, subGroup: libEx.subGroup || null
    }]);
    setPickerOpen(false);
  };
  const updateWeight = (idx, w) => {
    const next = [...choices];
    next[idx] = {...next[idx], weight: w};
    setChoices(next);
  };
  const removeVariant = (idx) => {
    if (choices.length <= 1) { haptic('warning'); return; }
    const next = [...choices];
    next.splice(idx, 1);
    setChoices(next);
  };
  const setAsPrincipal = (idx) => {
    if (idx === 0) return;
    const next = [...choices];
    const [moved] = next.splice(idx, 1);
    next.unshift(moved);
    setChoices(next);
    haptic('light');
  };

  const updateModelTargetForChoice = (choiceIdx, modelId, weight) => {
    const next = [...choices];
    const ch = {...next[choiceIdx]};
    const targets = ch.modelTargets ? [...ch.modelTargets] : [];
    if (weight === null) {
      ch.modelTargets = targets.filter(t => t.modelId !== modelId);
    } else {
      const existing = targets.find(t => t.modelId === modelId);
      const w = weight === '' ? '' : (parseFloat(weight) || '');
      if (existing) existing.weight = w;
      else targets.push({modelId, weight: w});
      ch.modelTargets = targets;
    }
    next[choiceIdx] = ch;
    setChoices(next);
  };

  return h(React.Fragment, null,
    h(Sheet, {open, onClose, title:"Variantes de l'exercice"},
      h('p', {className:'body-sm', style:{marginTop:0,color:'var(--ink-2)',marginBottom:12}},
        'Variante 1 = principale par défaut. Pendant la séance, tu pourras switcher entre variantes.'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:8, maxHeight:'50vh', overflowY:'auto', marginBottom:10}},
        choices.map((ch, idx) => {
          const libEx = ch.exId ? exerciseLib.find(l => l.id === ch.exId) : null;
          const isPrincipal = idx === 0;
          const variantModels = libEx?.models || [];
          const variantTargets = ch.modelTargets || [];
          const hasModels = variantModels.length > 0;
          return h('div', {key:idx, style:{
            padding:'12px', background: isPrincipal?'var(--accent-wash)':'var(--bg-3)',
            border: isPrincipal?'1px solid rgba(252,76,2,.35)':'1px solid var(--line)',
            borderRadius:10
          }},
            h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:8}},
              h('div', {style:{flex:1,minWidth:0}},
                h('div', {style:{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:isPrincipal?'var(--accent)':'var(--ink-3)'}},
                  isPrincipal ? '★ Principale' : 'Variante ' + (idx+1)),
                h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
                  libEx?.name || ch.exName || '?'),
                libEx?.subGroup && h('div', {className:'meta', style:{marginTop:2}}, libEx.subGroup)),
              h('div', {style:{display:'flex',gap:4,flexShrink:0}},
                !isPrincipal && h('button', {className:'pressable',
                  style:{color:'var(--accent)',padding:4,fontSize:11,fontWeight:700},
                  onClick:()=>setAsPrincipal(idx), title:'Définir comme principale'}, '★'),
                choices.length > 1 && h('button', {className:'pressable',
                  style:{color:'var(--danger)',padding:4}, onClick:()=>removeVariant(idx)}, ICONS.x))),
            h('div', {style:{display:'grid',gridTemplateColumns: hasModels ? '1fr' : '1fr',gap:6}},
              // Pas d'input séries — le nb de séries est uniforme pour tout l'exo (édité dans le programme).
              // Si pas de modèles → cible globale unique. Sinon, modèles dans le sous-bloc ci-dessous.
              !hasModels && h('div', null,
                h('div', {className:'label', style:{marginBottom:3}}, 'Poids cible (kg)'),
                h('input', {type:'number', step:'0.5', className:'input', style:{padding:'6px 8px',fontSize:12,textAlign:'center'},
                  placeholder:'-', value: ch.weight || '',
                  onChange:e=>updateWeight(idx, e.target.value)}))
            ),
            // Sous-bloc modèles : si la variante a des modèles dans la lib
            hasModels && h('div', {style:{
              marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,.08)',
              display:'flex', flexDirection:'column', gap:6
            }},
              h('div', {className:'label', style:{margin:0}}, 'Modèles'),
              variantModels.map(m => {
                const programmed = variantTargets.find(t => t.modelId === m.id);
                return h('div', {key:m.id, style:{display:'flex',alignItems:'center',gap:6,fontSize:11}},
                  h('span', {style:{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--ink-1)'}},
                    m.name),
                  h('input', {type:'number', step:'0.5', className:'input', style:{padding:'4px 6px',fontSize:11,textAlign:'center',width:60,flex:'0 0 auto'},
                    placeholder:'kg', value: programmed?.weight ?? '',
                    onChange: e => updateModelTargetForChoice(idx, m.id, e.target.value)})
                );
              })
            )
          );
        })
      ),
      pool.length > 0 && h('button', {className:'btn btn-ghost btn-full pressable', onClick:()=>setPickerOpen(true), style:{marginBottom:10}},
        ICONS.plus, ' Ajouter une variante'),
      h('button', {className:'btn btn-primary btn-full pressable', onClick:()=>onSave(choices)},
        ICONS.check, ' Enregistrer')),
    h(PickerSheet, {
      open: pickerOpen, onClose:()=>setPickerOpen(false),
      title: 'Ajouter une variante', search: true,
      options: pool.map(l => ({
        value: l.id, label: l.name,
        sub: (l.subGroup ? l.subGroup + ' · ' : '') + (l.compound?'poly':'iso')
      })),
      onPick: (id) => addVariant(exerciseLib.find(l => l.id === id))
    })
  );
}

function EditMuscleStatusSheet({open, onClose, program, state, onSave}) {
  // Restore from muscleStatus if present, else from priorities (legacy), else default 'maintenance' for all
  const initStatus = () => {
    if (program?.muscleStatus) return {...program.muscleStatus};
    const out = {};
    state.muscleGroups.forEach(g => { out[g] = 'maintenance'; });
    (program?.priorities || []).forEach(g => { out[g] = 'focus'; });
    return out;
  };
  const [sel, setSel] = useState(initStatus);
  useEffect(() => { if (open) setSel(initStatus()); }, [open, program]);

  const validation = validateMuscleStatus({
    muscleStatus: sel, frequency: program?.frequency || 4,
    level: program?.level || 'intermediaire', muscleGroups: state.muscleGroups
  });

  const setStatus = (g, v) => { setSel({...sel, [g]: v}); haptic('light'); };
  const statusColor = (val) => val === 'focus' ? 'var(--accent)' : val === 'maintenance' ? 'var(--ink-3)' : 'var(--ink-1)';
  const statusBg = (val, active) => {
    if (!active) return 'var(--bg-3)';
    if (val === 'focus') return 'var(--accent-wash)';
    if (val === 'maintenance') return 'rgba(120,120,130,.15)';
    return 'rgba(52,199,89,.12)';
  };

  return h(Sheet, {open, onClose, title:'Statut par muscle'},
    h('p', {className:'body-sm', style:{marginTop:0, color:'var(--ink-2)', marginBottom:12}},
      h('span', {style:{color:'var(--accent)',fontWeight:700}}, '★ Focus'), ' +50% · ',
      h('span', null, '= Progression'), ' baseline · ',
      h('span', {style:{color:'var(--ink-3)'}}, '↓ Maintenance'), ' 60%'),

    h('div', {style:{display:'flex',flexDirection:'column',gap:4, maxHeight:'40vh', overflowY:'auto', marginBottom:10}},
      state.muscleGroups.map(g => {
        const v = sel[g] || 'progression';
        return h('div', {key:g, style:{
          display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center',
          padding:'8px 10px', borderRadius:8, background:'var(--bg-3)'
        }},
          h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)'}}, g),
          h('div', {style:{display:'flex',gap:3}},
            [['maintenance','='],['progression','↑'],['focus','★']].map(([val,icon]) => {
              const active = v === val;
              return h('button', {key:val, className:'pressable', onClick:()=>setStatus(g, val),
                style:{
                  minWidth:30, padding:'5px 7px', borderRadius:6, fontSize:12, fontWeight:800,
                  background: statusBg(val, active),
                  color: active ? statusColor(val) : 'var(--ink-3)',
                  border: active ? `1px solid ${statusColor(val)}40` : '1px solid transparent'
                }}, icon);
            }))
        );
      })
    ),

    validation.warnings.length > 0 && h('div', {style:{
      padding:10, background:'rgba(255,204,0,.1)', border:'1px solid rgba(255,204,0,.3)', borderRadius:8, marginBottom:10
    }},
      validation.warnings.map((w, i) => h('div', {key:i, style:{fontSize:11,color:'var(--ink-1)',lineHeight:1.4,marginBottom:i<validation.warnings.length-1?4:0}}, '⚠ '+w))),

    h('button', {className:'btn btn-primary btn-full pressable', onClick:()=>onSave(sel)},
      ICONS.check, ' Enregistrer')
  );
}

/* ==========================================================================
   VOLUME TARGETS EDITOR
   ========================================================================== */

function ParamsVolume({state}) {
  const {currentProgram, updateCurrentProgram, exerciseLib} = state;
  const navGuardRef = state.navGuardRef;
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [recomputeLevel, setRecomputeLevel] = useState(null);
  // Drafts locaux utilisés en mode édition — ne touchent au programme qu'au "Enregistrer"
  const [draftTargets, setDraftTargets] = useState(null);
  const [draftSubTargets, setDraftSubTargets] = useState(null);
  // Confirmation de sortie non enregistrée
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const pendingLeaveRef = useRef(null);

  if (!currentProgram) return h('div', {className:'empty-state'}, h('div', {className:'title'}, 'Crée un programme d\'abord'));

  const pv = programVolume(currentProgram, exerciseLib);
  const savedTargets = currentProgram.volumeTargets?.program || {};
  const savedSubTargets = currentProgram.volumeTargets?.subGroups || {};

  // Valeurs affichées : drafts en edit mode, persistées en lecture
  const targets = editMode && draftTargets ? draftTargets : savedTargets;
  const subTargets = editMode && draftSubTargets ? draftSubTargets : savedSubTargets;

  // Détecte si des modifs en attente existent
  const dirty = editMode && draftTargets && (
    JSON.stringify(draftTargets) !== JSON.stringify(savedTargets) ||
    JSON.stringify(draftSubTargets) !== JSON.stringify(savedSubTargets)
  );

  // Pose le guard de navigation si dirty
  useEffect(() => {
    if (!navGuardRef) return;
    if (dirty) {
      navGuardRef.current = (resumeNav) => {
        pendingLeaveRef.current = resumeNav;
        setLeaveConfirmOpen(true);
        return false; // bloqué, on gère nous-même
      };
    } else {
      navGuardRef.current = null;
    }
    return () => { if (navGuardRef) navGuardRef.current = null; };
  }, [dirty, navGuardRef]);

  // beforeunload au cas où l'utilisateur ferme/refresh la page avec des modifs en attente
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const enterEdit = () => {
    setDraftTargets({...savedTargets});
    setDraftSubTargets(JSON.parse(JSON.stringify(savedSubTargets)));
    setEditMode(true);
    haptic('light');
  };

  const saveEdit = () => {
    if (!draftTargets) { setEditMode(false); return; }
    updateCurrentProgram(p => {
      if (!p.volumeTargets) p.volumeTargets = {program:{}, sessions:{}, subGroups:{}};
      p.volumeTargets.program = {...draftTargets};
      p.volumeTargets.subGroups = JSON.parse(JSON.stringify(draftSubTargets || {}));
    });
    setDraftTargets(null);
    setDraftSubTargets(null);
    setEditMode(false);
    haptic('success');
  };

  const cancelEdit = () => {
    setDraftTargets(null);
    setDraftSubTargets(null);
    setEditMode(false);
    haptic('light');
  };

  const setTarget = (g, v) => {
    if (!editMode) return;
    const next = {...(draftTargets || savedTargets)};
    if (v === '' || v === null || v === undefined) delete next[g];
    else next[g] = parseInt(v) || 0;
    setDraftTargets(next);
  };

  const setSubTarget = (g, sub, v) => {
    if (!editMode) return;
    const next = JSON.parse(JSON.stringify(draftSubTargets || savedSubTargets));
    if (!next[g]) next[g] = {};
    if (v === '' || v === null || v === undefined) delete next[g][sub];
    else next[g][sub] = parseInt(v) || 0;
    setDraftSubTargets(next);
  };

  const resetSubTargetsForGroup = (g) => {
    if (!editMode) return;
    const curTarget = (draftTargets || savedTargets)[g] || 0;
    const split = splitVolumeBySubGroups(g, curTarget, null, state.subGroups);
    const next = JSON.parse(JSON.stringify(draftSubTargets || savedSubTargets));
    next[g] = split || {};
    setDraftSubTargets(next);
    haptic('light');
  };

  const applyRecompute = () => {
    const level = recomputeLevel || currentProgram.level || 'intermediaire';
    const newT = computeVolumeTargets({
      level,
      muscleStatus: currentProgram.muscleStatus,
      focus: currentProgram.focus,
      priorities: currentProgram.priorities || [],
      muscleGroups: state.muscleGroups
    });
    // Applique direct dans le programme (flush pending drafts) + set level
    updateCurrentProgram(p => {
      p.level = level;
      p.volumeTargets = p.volumeTargets || {};
      p.volumeTargets.program = newT;
      const sub = {};
      Object.entries(newT).forEach(([g, v]) => {
        const customPct = p.subGroupSplit?.[g] || null;
        const split = splitVolumeBySubGroups(g, v, customPct, state.subGroups);
        if (split) sub[g] = split;
      });
      p.volumeTargets.subGroups = sub;
    });
    setRecomputeOpen(false);
    setRecomputeLevel(null);
    // Ouvre en mode édition avec les valeurs calculées comme drafts,
    // pour laisser l'utilisateur ajuster avant d'enregistrer
    setDraftTargets({...newT});
    const sub = {};
    Object.entries(newT).forEach(([g, v]) => {
      const customPct = currentProgram.subGroupSplit?.[g] || null;
      const split = splitVolumeBySubGroups(g, v, customPct, state.subGroups);
      if (split) sub[g] = split;
    });
    setDraftSubTargets(sub);
    setEditMode(true);
    haptic('success');
  };

  // Handlers du dialog de sortie non enregistrée
  const leaveConfirmSave = () => {
    saveEdit();
    setLeaveConfirmOpen(false);
    const resume = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    if (resume) resume();
  };
  const leaveConfirmDiscard = () => {
    cancelEdit();
    setLeaveConfirmOpen(false);
    const resume = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    if (resume) resume();
  };
  const leaveConfirmStay = () => {
    setLeaveConfirmOpen(false);
    pendingLeaveRef.current = null;
  };

  const groupsSorted = state.muscleGroups.slice().sort((a,b) => {
    const va = pv.total[a]||0, vb = pv.total[b]||0;
    if (va===0 && vb===0) return a.localeCompare(b);
    if (va===0) return 1; if (vb===0) return -1;
    return vb - va;
  });

  const subsFor = (g) => (state.subGroups && state.subGroups[g]) || [];
  const levelLabel = {debutant:'Débutant', intermediaire:'Intermédiaire', confirme:'Confirmé'}[currentProgram.level] || '—';

  return h('div', null,
    /* Header : nom programme + niveau en lecture */
    h('div', {style:{marginBottom:12}},
      h('div', {style:{minWidth:0}},
        h('div', {className:'meta', style:{marginBottom:2}}, 'Programme'),
        h('div', {style:{fontSize:18,fontWeight:800,color:'var(--ink-0)',letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},
          currentProgram.name),
        h('div', {className:'meta', style:{marginTop:4}},
          'Niveau · ' + levelLabel + ' · ' + (currentProgram.frequency || '?') + 'x/sem'))
    ),

    /* Actions : Modifier/Enregistrer + Annuler (en edit) + Recalcul auto */
    h('div', {style:{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}},
      !editMode && h('button', {
        className:'btn btn-ghost btn-sm pressable',
        style:{flex:1,minWidth:120},
        onClick:enterEdit
      }, '✎ Modifier'),
      editMode && h('button', {
        className:'btn btn-primary btn-sm pressable',
        style:{flex:1,minWidth:120},
        onClick:saveEdit, disabled:!dirty,
        title: dirty ? '' : 'Aucune modification'
      }, '✓ Enregistrer' + (dirty ? '' : '')),
      editMode && h('button', {
        className:'btn btn-ghost btn-sm pressable',
        style:{flex:1,minWidth:100},
        onClick:cancelEdit
      }, '✗ Annuler'),
      currentProgram.auto && !editMode && h('button', {
        className:'btn btn-ghost btn-sm pressable',
        style:{flex:1,minWidth:120},
        onClick:()=>{ setRecomputeLevel(currentProgram.level || 'intermediaire'); setRecomputeOpen(true); }
      }, '↺ Recalcul auto')
    ),

    editMode && dirty && h('div', {style:{
      fontSize:11, fontWeight:600, color:'var(--accent-hi)',
      padding:'6px 10px', marginBottom:10, borderRadius:6,
      background:'var(--accent-wash)', border:'1px solid rgba(252,76,2,.3)',
      textAlign:'center'
    }}, 'Modifications non enregistrées'),

    /* Total séries planifiées vs total cibles — vue d'ensemble du programme */
    (() => {
      const totalPlanned = Object.values(pv.total || {}).reduce((a, v) => a + (v || 0), 0);
      const totalTarget = Object.values(targets || {}).reduce((a, v) => a + (parseInt(v) || 0), 0);
      if (totalPlanned === 0 && totalTarget === 0) return null;
      const pct = totalTarget > 0 ? Math.min(100, (totalPlanned / totalTarget) * 100) : 0;
      const overshoot = totalTarget > 0 ? Math.max(0, ((totalPlanned - totalTarget) / totalTarget) * 100) : 0;
      const col = totalPlanned >= totalTarget && totalTarget > 0
        ? (totalPlanned > totalTarget * 1.1 ? 'var(--pr-gold)' : 'var(--success)')
        : 'var(--accent)';
      return h('div', {style:{
        background:'var(--bg-2)', border:'1px solid var(--line)',
        borderRadius:10, padding:'12px 14px', marginBottom:10
      }},
        h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}},
          h('span', {style:{fontSize:11,fontWeight:700,color:'var(--ink-2)',textTransform:'uppercase',letterSpacing:'.08em'}},
            'Total séries hebdo'),
          h('span', {style:{fontSize:13,fontWeight:800,color:'var(--ink-0)',fontVariantNumeric:'tabular-nums'}},
            h('span', {style:{color: col}}, totalPlanned),
            totalTarget > 0 ? h('span', {style:{color:'var(--ink-3)',fontWeight:600}}, ' / ' + totalTarget) : null
          )
        ),
        totalTarget > 0 && h('div', {style:{height:6, background:'var(--bg-3)', borderRadius:3, overflow:'hidden', marginBottom:6}},
          h('div', {style:{height:'100%', width:pct+'%', background:col, borderRadius:3, transition:'width .35s var(--ease-ios)'}})
        ),
        totalTarget > 0 && h('div', {style:{fontSize:10,color:'var(--ink-3)',display:'flex',justifyContent:'space-between'}},
          h('span', null, totalPlanned >= totalTarget
            ? (overshoot > 10 ? `+${Math.round(overshoot)}% au-dessus de la cible` : 'Cible atteinte')
            : `Manque ${totalTarget - totalPlanned} série${totalTarget - totalPlanned > 1 ? 's' : ''}`),
          h('span', null, Math.round(pct) + '%')
        )
      );
    })(),

    /* Rangée par muscle */
    groupsSorted.map(g => {
      const subs = subsFor(g);
      const isExpanded = expanded === g;
      const hasSubs = subs.length > 0;
      const subTgtG = subTargets[g] || {};
      const subActG = pv.totalSub?.[g] || {};

      return h('div', {key:g, style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10,marginBottom:6,overflow:'hidden'}},
        h('div', {
          className: hasSubs ? 'pressable' : '',
          style:{display:'grid',gridTemplateColumns:(hasSubs?'auto ':'')+'1fr auto 72px',gap:10,alignItems:'center',
                 padding:'10px 12px',cursor: hasSubs?'pointer':'default'},
          onClick: hasSubs ? (e)=>{ if (e.target.closest('[data-no-expand]')) return; setExpanded(isExpanded?null:g); } : undefined
        },
          hasSubs && h('span', {className: 'mv-chev' + (isExpanded?' open':'')}, ICONS.chevDown),
          h('div', null,
            h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)'}}, g),
            h('div', {className:'meta', style:{marginTop:2}},
              'actuel ' + (pv.total[g]||0) + ' séries/sem')),
          (() => {
            const actual = pv.total[g]||0, target = targets[g]||0;
            if (!target) return h('span', {className:'meta'}, '—');
            const pct = Math.min(100, (actual/target)*100);
            const col = actual >= target ? 'var(--success)' : actual >= target*0.7 ? 'var(--accent)' : 'var(--ink-4)';
            return h('div', {style:{width:60, height:6, background:'var(--bg-3)', borderRadius:3, overflow:'hidden'}},
              h('div', {style:{height:'100%', width:pct+'%', background:col, borderRadius:3}}));
          })(),
          h('input', {'data-no-expand':true, className:'input', type:'number', min:'0',
            disabled: !editMode,
            style:{width:72, padding:'8px 10px', textAlign:'center', fontSize:13,
                   opacity: editMode ? 1 : 0.55, cursor: editMode ? 'text' : 'default'},
            value: targets[g]||'', placeholder:'—',
            onClick: e => e.stopPropagation(),
            onChange: e => setTarget(g, e.target.value)})
        ),
        hasSubs && h('div', {className: 'mv-expand' + (isExpanded?' open':'')}, h('div', {className:'mv-expand-inner'}, h('div', {style:{background:'var(--bg-3)',borderTop:'1px solid var(--line)',padding:'12px 12px 14px'}},
          h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}},
            h('div', {className:'label', style:{margin:0}}, 'Répartition sous-groupes'),
            editMode && h('button', {className:'pressable', onClick:()=>resetSubTargetsForGroup(g),
              style:{fontSize:10,fontWeight:700,padding:'4px 8px',borderRadius:6,background:'var(--bg-2)',color:'var(--ink-2)'}},
              '↺ Défaut')),
          (() => {
            // Calcule le % courant de chaque sous-groupe depuis les séries stockées.
            // Si total = 0 (cible globale non définie), tous à 0.
            const totalSub = subs.reduce((a, s) => a + (subTgtG[s] || 0), 0);
            const pctBySub = {};
            subs.forEach(s => {
              pctBySub[s] = totalSub > 0 ? ((subTgtG[s] || 0) / totalSub) * 100 : 0;
            });
            const splitTotal = Object.values(pctBySub).reduce((a, b) => a + b, 0);
            return h('div', null,
              h('div', {style:{display:'flex',flexDirection:'column',gap:8, opacity: editMode ? 1 : 0.6, pointerEvents: editMode ? 'auto' : 'none'}},
                subs.map(sub => h(SgSliderRow, {
                  key: sub,
                  name: sub,
                  pct: pctBySub[sub],
                  series: subTgtG[sub] || 0,
                  onChange: (newPct) => {
                    if (!editMode) return;
                    const totalCurG = (draftTargets || savedTargets)[g] || 0;
                    if (totalCurG <= 0) return; // pas de cible totale, rien à répartir
                    // Rebalance les autres proportionnellement pour garder somme = 100
                    const others = subs.filter(s => s !== sub);
                    const othersTotal = others.reduce((a,s) => a + (pctBySub[s] || 0), 0);
                    const remaining = Math.max(0, 100 - newPct);
                    const nextPct = {[sub]: newPct};
                    if (othersTotal > 0) {
                      others.forEach(s => { nextPct[s] = (pctBySub[s] || 0) * (remaining / othersTotal); });
                    } else {
                      others.forEach(s => { nextPct[s] = remaining / others.length; });
                    }
                    // Convertit les % en séries entières, ajuste le dernier pour matcher le total
                    const nextSeries = {};
                    let placed = 0;
                    const keys = subs.slice();
                    keys.forEach((s, i) => {
                      if (i === keys.length - 1) nextSeries[s] = Math.max(0, totalCurG - placed);
                      else { nextSeries[s] = Math.round((nextPct[s] / 100) * totalCurG); placed += nextSeries[s]; }
                    });
                    const next = JSON.parse(JSON.stringify(draftSubTargets || savedSubTargets));
                    next[g] = nextSeries;
                    setDraftSubTargets(next);
                  }
                }))),
              h('p', {className:'meta', style:{marginTop:10,fontSize:10.5,color:'var(--ink-3)',fontStyle:'italic'}},
                ((draftTargets || savedTargets)[g] || 0) > 0
                  ? `Total ${Math.round(splitTotal)}% · ajuste un curseur, les autres se rééquilibrent automatiquement.`
                  : 'Définis d\'abord une cible totale pour ce muscle pour répartir les sous-groupes.')
            );
          })()
        )))
      );
    }),

    /* Sheet Recalcul auto */
    h(Sheet, {open: recomputeOpen, onClose: ()=>{setRecomputeOpen(false); setRecomputeLevel(null);}, title:'Recalculer les cibles'},
      h('p', {className:'body-sm', style:{marginTop:0, marginBottom:14, color:'var(--ink-2)'}},
        'Choisis ton niveau. Après recalcul tu passeras en mode édition pour ajuster et enregistrer.'),
      h('div', {className:'label', style:{marginBottom:8}}, 'Niveau'),
      h('div', {className:'seg', style:{marginBottom:18}},
        [['debutant','Débutant','< 1 an'],['intermediaire','Intermédiaire','1-3 ans'],['confirme','Confirmé','3 ans +']].map(([v,l,sub]) =>
          h('button', {key:v, className: recomputeLevel===v?'active':'',
            onClick:()=>{setRecomputeLevel(v); haptic('light');},
            style:{flexDirection:'column',padding:'10px 4px',lineHeight:1.2}},
            h('div', null, l),
            h('div', {style:{fontSize:9,fontWeight:600,color:recomputeLevel===v?'var(--ink-2)':'var(--ink-3)',marginTop:2}}, sub)))),
      h('button', {className:'btn btn-primary btn-full pressable', onClick:applyRecompute,
        disabled: !recomputeLevel,
        style:{opacity: recomputeLevel ? 1 : 0.5}},
        ICONS.check, ' Recalculer')),

    /* Sheet Sortie non enregistrée */
    h(Sheet, {open: leaveConfirmOpen, onClose: leaveConfirmStay, title:'Modifications non enregistrées'},
      h('p', {className:'body-sm', style:{marginTop:0, marginBottom:16, color:'var(--ink-2)'}},
        'Tu as modifié des cibles sans les enregistrer. Que veux-tu faire ?'),
      h('div', {style:{display:'flex',flexDirection:'column',gap:8}},
        h('button', {className:'btn btn-primary btn-full pressable', onClick: leaveConfirmSave},
          'Enregistrer'),
        h('button', {className:'btn btn-ghost btn-full pressable', onClick: leaveConfirmDiscard,
          style:{color:'var(--danger)'}},
          'Abandonner'),
        h('button', {className:'btn btn-ghost btn-full pressable', onClick: leaveConfirmStay},
          'Continuer')))
  );
}

/* ==========================================================================
   MUSCLE GROUPS EDITOR
   ========================================================================== */

function ParamsMuscleGroups({state}) {
  const {muscleGroups, setMuscleGroups, exerciseLib, subGroups, setSubGroups} = state;
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(null);
  const [newName, setNewName] = useState('');
  const [renameVal, setRenameVal] = useState('');
  const [expanded, setExpanded] = useState(null); // groupName | null
  const [newSubFor, setNewSubFor] = useState(null); // groupName | null
  const [newSubVal, setNewSubVal] = useState('');
  const [renameSubOpen, setRenameSubOpen] = useState(null); // {group, sub} | null
  const [renameSubVal, setRenameSubVal] = useState('');

  const exoCountByGroup = useMemo(() => {
    const m = {};
    exerciseLib.forEach(l => { m[l.muscleGroup] = (m[l.muscleGroup]||0) + 1; });
    return m;
  }, [exerciseLib]);

  const subsFor = (g) => (subGroups && subGroups[g]) || [];

  const add = () => {
    const n = newName.trim();
    if (!n || muscleGroups.includes(n)) { haptic('warning'); return; }
    setMuscleGroups([...muscleGroups, n]);
    setNewName('');
    setAddOpen(false);
    haptic('success');
  };

  const rename = () => {
    const n = renameVal.trim();
    if (!n || muscleGroups.includes(n)) { haptic('warning'); return; }
    const old = renameOpen;
    setMuscleGroups(muscleGroups.map(g => g === old ? n : g));
    state.setExerciseLib(exerciseLib.map(l => l.muscleGroup === old ? {...l, muscleGroup:n} : l));
    // Déplace aussi les sous-groupes
    if (subGroups[old]) {
      const next = {...subGroups, [n]: subGroups[old]};
      delete next[old];
      setSubGroups(next);
    }
    setRenameOpen(null);
    setRenameVal('');
    haptic('success');
  };

  const del = () => {
    const g = deleteOpen;
    setMuscleGroups(muscleGroups.filter(x => x !== g));
    if (exerciseLib.some(l => l.muscleGroup === g)) {
      if (!muscleGroups.includes('Autre')) setMuscleGroups(muscleGroups.filter(x => x !== g).concat(['Autre']));
      state.setExerciseLib(exerciseLib.map(l => l.muscleGroup === g ? {...l, muscleGroup:'Autre'} : l));
    }
    if (subGroups[g]) {
      const next = {...subGroups};
      delete next[g];
      setSubGroups(next);
    }
    setDeleteOpen(null);
    haptic('success');
  };

  const addSubGroup = () => {
    const g = newSubFor, n = newSubVal.trim();
    if (!g || !n) { haptic('warning'); return; }
    const cur = subsFor(g);
    if (cur.includes(n)) { haptic('warning'); return; }
    setSubGroups({...subGroups, [g]: [...cur, n]});
    setNewSubFor(null);
    setNewSubVal('');
    haptic('success');
  };

  const renameSubGroup = () => {
    if (!renameSubOpen) return;
    const {group, sub} = renameSubOpen;
    const n = renameSubVal.trim();
    if (!n) { haptic('warning'); return; }
    const cur = subsFor(group);
    if (cur.includes(n) && n !== sub) { haptic('warning'); return; }
    setSubGroups({...subGroups, [group]: cur.map(s => s === sub ? n : s)});
    // Update exos lib
    state.setExerciseLib(exerciseLib.map(l =>
      (l.muscleGroup === group && l.subGroup === sub) ? {...l, subGroup: n} : l
    ));
    setRenameSubOpen(null);
    setRenameSubVal('');
    haptic('success');
  };

  const delSubGroup = (group, sub) => {
    setSubGroups({...subGroups, [group]: subsFor(group).filter(s => s !== sub)});
    // Déclasse les exos de ce sous-groupe (subGroup = null)
    state.setExerciseLib(exerciseLib.map(l =>
      (l.muscleGroup === group && l.subGroup === sub) ? {...l, subGroup: null} : l
    ));
    haptic('light');
  };

  return h('div', null,
    h('p', {className:'body-sm', style:{marginBottom:14, color:'var(--ink-2)'}},
      'Groupes musculaires et leurs sous-groupes. Clique sur une ligne pour voir et éditer les sous-groupes.'),
    h('div', {style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',overflow:'hidden',marginBottom:12}},
      muscleGroups.map((g, i) => {
        const isExpanded = expanded === g;
        const subs = subsFor(g);
        return h('div', {key:g, style:{borderBottom: i===muscleGroups.length-1?'none':'1px solid var(--line)'}},
          h('div', {
            className:'pressable',
            style:{display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:8, alignItems:'center',
                   padding:'12px 14px', cursor:'pointer'},
            onClick: (e)=>{
              if (e.target.closest('[data-no-expand]')) return;
              setExpanded(isExpanded ? null : g);
            }
          },
            h('span', {className: 'mv-chev' + (isExpanded?' open':''), style:{
              color:'var(--accent-hi)',
              background:'var(--accent-wash)',
              borderRadius:6, padding:'4px 4px',
              border:'1px solid rgba(252,76,2,.35)'
            }}, ICONS.chevDown),
            h('div', null,
              h('div', {style:{fontSize:13, fontWeight:700, color:'var(--ink-0)'}}, g),
              h('div', {className:'meta', style:{marginTop:2}},
                (exoCountByGroup[g]||0) + ' exo' + ((exoCountByGroup[g]||0)>1?'s':''),
                subs.length ? ' · ' + subs.length + ' sous-groupe' + (subs.length>1?'s':'') : '')),
            h('button', {'data-no-expand':true, className:'pressable', style:{color:'var(--ink-2)',padding:6},
              onClick:(e)=>{e.stopPropagation(); setRenameOpen(g); setRenameVal(g);}
            }, ICONS.edit),
            h('button', {'data-no-expand':true, className:'pressable', style:{color:'var(--danger)',padding:6},
              onClick:(e)=>{e.stopPropagation(); setDeleteOpen(g);}
            }, ICONS.trash)
          ),
          h('div', {className: 'mv-expand' + (isExpanded?' open':'')}, h('div', {className:'mv-expand-inner'}, h('div', {style:{padding:'0 14px 12px',background:'var(--bg-3)',borderTop:'1px solid var(--line)'}},
            h('div', {className:'label', style:{padding:'10px 0 6px'}}, 'Sous-groupes'),
            subs.length === 0 && h('div', {style:{fontSize:11,color:'var(--ink-3)',fontStyle:'italic',padding:'4px 0'}},
              'Aucun sous-groupe pour ce muscle.'),
            subs.map(sub => h('div', {key:sub, style:{
              display:'grid', gridTemplateColumns:'1fr auto auto', gap:6, alignItems:'center',
              padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, marginBottom:4
            }},
              h('div', {style:{fontSize:12,fontWeight:600,color:'var(--ink-1)'}}, sub),
              h('button', {className:'pressable', style:{color:'var(--ink-3)',padding:4},
                onClick:()=>{setRenameSubOpen({group:g, sub}); setRenameSubVal(sub);}
              }, ICONS.edit),
              h('button', {className:'pressable', style:{color:'var(--danger)',padding:4},
                onClick:()=>delSubGroup(g, sub)
              }, ICONS.trash)
            )),
            h('button', {className:'btn btn-ghost btn-sm btn-full pressable', style:{marginTop:6},
              onClick:()=>{ setNewSubFor(g); setNewSubVal(''); }
            }, ICONS.plus, ' Ajouter un sous-groupe')
          )))
        );
      })),
    h('button', {className:'btn btn-primary btn-full pressable', onClick:()=>setAddOpen(true)},
      ICONS.plus, ' Nouveau groupe'),

    h(Sheet, {open:addOpen, onClose:()=>{setAddOpen(false); setNewName('');}, title:'Nouveau groupe musculaire'},
      h('div', {style:{display:'flex',gap:8}},
        h('input', {className:'input', value:newName, onChange:e=>setNewName(e.target.value),
          placeholder:'Ex: Avant-bras', autoFocus:true, onKeyDown:e=>e.key==='Enter'&&add()}),
        h('button', {className:'btn btn-primary', onClick:add}, 'Ajouter'))),

    h(Sheet, {open:!!renameOpen, onClose:()=>{setRenameOpen(null); setRenameVal('');}, title:'Renommer le groupe'},
      h('p', {className:'body-sm', style:{marginTop:0,color:'var(--ink-2)',marginBottom:10}},
        renameOpen ? `Renomme "${renameOpen}". Tous les exercices et cibles seront mis à jour.` : ''),
      h('div', {style:{display:'flex',gap:8}},
        h('input', {className:'input', value:renameVal, onChange:e=>setRenameVal(e.target.value), autoFocus:true, onKeyDown:e=>e.key==='Enter'&&rename()}),
        h('button', {className:'btn btn-primary', onClick:rename}, 'OK'))),

    h(Sheet, {open:!!newSubFor, onClose:()=>{setNewSubFor(null); setNewSubVal('');},
      title: newSubFor ? `Sous-groupe de ${newSubFor}` : 'Sous-groupe'},
      h('div', {style:{display:'flex',gap:8}},
        h('input', {className:'input', value:newSubVal, onChange:e=>setNewSubVal(e.target.value),
          placeholder:'Ex: Trapèze supérieur', autoFocus:true, onKeyDown:e=>e.key==='Enter'&&addSubGroup()}),
        h('button', {className:'btn btn-primary', onClick:addSubGroup}, 'Ajouter'))),

    h(Sheet, {open:!!renameSubOpen, onClose:()=>{setRenameSubOpen(null); setRenameSubVal('');}, title:'Renommer le sous-groupe'},
      h('p', {className:'body-sm', style:{marginTop:0,color:'var(--ink-2)',marginBottom:10}},
        renameSubOpen ? `Renomme "${renameSubOpen.sub}". Les exercices seront mis à jour.` : ''),
      h('div', {style:{display:'flex',gap:8}},
        h('input', {className:'input', value:renameSubVal, onChange:e=>setRenameSubVal(e.target.value),
          autoFocus:true, onKeyDown:e=>e.key==='Enter'&&renameSubGroup()}),
        h('button', {className:'btn btn-primary', onClick:renameSubGroup}, 'OK'))),

    h(ConfirmSheet, {
      open: !!deleteOpen, onClose:()=>setDeleteOpen(null),
      onConfirm: del,
      title: 'Supprimer ce groupe ?',
      message: deleteOpen ? `"${deleteOpen}" sera supprimé. Les ${exoCountByGroup[deleteOpen]||0} exercices de ce groupe seront déplacés vers "Autre", et ses sous-groupes supprimés.` : ''
    })
  );
}

/* ==========================================================================
   EXERCISES LIBRARY
   ========================================================================== */

function ParamsExos({state}) {
  const {exerciseLib, setExerciseLib} = state;
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Pectoraux');
  const [newSubGroup, setNewSubGroup] = useState('');
  const [newGroupPickerOpen, setNewGroupPickerOpen] = useState(false);
  const [newSubPickerOpen, setNewSubPickerOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [newCompound, setNewCompound] = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [editExo, setEditExo] = useState(null); // {id, name, muscleGroup, subGroup, compound}

  const subGroupsFor = (g) => (state.subGroups && state.subGroups[g]) || SUB_GROUPS_DEFAULT[g] || [];

  const filtered = filter ? exerciseLib
    .filter(l => l.muscleGroup === filter)
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => a.name.localeCompare(b.name)) : [];

  const exoCountByGroup = useMemo(() => {
    const m = {};
    exerciseLib.forEach(l => { m[l.muscleGroup] = (m[l.muscleGroup]||0) + 1; });
    return m;
  }, [exerciseLib]);

  const add = () => {
    if (!newName.trim()) { haptic('warning'); return; }
    setExerciseLib([...exerciseLib, {id:uid(), name:newName.trim(), muscleGroup:newGroup, subGroup:newSubGroup||null, compound:newCompound, priority:5, setting:'', models:[]}]);
    setNewName(''); setNewCompound(false); setNewSubGroup('');
    setAddOpen(false);
    haptic('success');
  };

  const editSave = () => {
    if (!editExo || !editExo.name.trim()) { haptic('warning'); return; }
    const newName = editExo.name.trim();
    const newMuscle = editExo.muscleGroup;
    const newSubGroup = editExo.subGroup || null;
    const newCompound = !!editExo.compound;
    const exId = editExo.id;

    // Ancien nom (pour détecter si le nom a effectivement changé)
    const oldEx = exerciseLib.find(l => l.id === exId);
    const nameChanged = oldEx && oldEx.name !== newName;
    const muscleChanged = oldEx && oldEx.muscleGroup !== newMuscle;

    // 1) Patch exerciseLib (l'ID reste identique, donc toutes les refs par ID restent valides)
    //    On nettoie les modèles avec un nom vide (sécurité contre les "fantômes")
    const cleanModels = (editExo.models || []).filter(m => (m.name||'').trim()).map(m => ({
      id: m.id, name: m.name.trim(), setting: m.setting || '', color: m.color || 'coral'
    }));
    setExerciseLib(exerciseLib.map(l => l.id === exId ? {
      ...l, name: newName, muscleGroup: newMuscle, subGroup: newSubGroup, compound: newCompound,
      setting: editExo.setting || '',
      models: cleanModels
    } : l));

    // Si l'utilisateur a supprimé un modèle, retirer toutes les modelTargets correspondantes des programmes
    if (state.programs && state.setPrograms) {
      const oldModelIds = new Set((oldEx?.models || []).map(m => m.id));
      const newModelIds = new Set(cleanModels.map(m => m.id));
      const removedModelIds = [...oldModelIds].filter(id => !newModelIds.has(id));
      if (removedModelIds.length > 0) {
        state.setPrograms(state.programs.map(prog => ({
          ...prog,
          sessions: (prog.sessions || []).map(sess => ({
            ...sess,
            exercises: (sess.exercises || []).map(pex => {
              const c0 = pex.choices?.[0];
              if (c0?.exId !== exId) return pex;
              const targets = (pex.modelTargets || []).filter(t => !removedModelIds.includes(t.modelId));
              return {...pex, modelTargets: targets};
            })
          }))
        })));
      }
    }

    // 2) Propagation aux snapshots de nom pour cohérence visuelle (pas de perte de données,
    //    juste alignement des noms affichés dans l'historique, les programmes et la séance active)
    if (nameChanged || muscleChanged) {
      // Programs : les choices stockent parfois un `name` ou `exName` en snapshot
      if (state.programs && state.setPrograms) {
        state.setPrograms(state.programs.map(prog => ({
          ...prog,
          sessions: (prog.sessions || []).map(sess => ({
            ...sess,
            exercises: (sess.exercises || []).map(pex => {
              const choices = (pex.choices || []).map(c => {
                if (c.exId !== exId) return c;
                const out = {...c};
                if (nameChanged && c.name !== undefined) out.name = newName;
                return out;
              });
              return {...pex, choices};
            })
          }))
        })));
      }

      // JournalLogs : exName (snapshot du nom au moment du log) + muscleGroup
      if (state.journalLogs && state.setJournalLogs) {
        state.setJournalLogs(state.journalLogs.map(log => ({
          ...log,
          exercises: (log.exercises || []).map(e => {
            if (e.exId !== exId) return e;
            const out = {...e};
            if (nameChanged) out.exName = newName;
            if (muscleChanged) out.muscleGroup = newMuscle;
            return out;
          })
        })));
      }

      // Active session : exercises[].exName + variants[].name
      if (state.activeSession && state.setActiveSession) {
        const as = state.activeSession;
        if (as.exercises) {
          let asChanged = false;
          const exercises = as.exercises.map(e => {
            let patched = e;
            if (e.exId === exId) {
              patched = {...patched};
              if (nameChanged) { patched.exName = newName; asChanged = true; }
              if (muscleChanged) { patched.muscleGroup = newMuscle; asChanged = true; }
            }
            if (patched.variants && patched.variants.length) {
              const variants = patched.variants.map(v => {
                if (v.exId !== exId) return v;
                asChanged = true;
                return nameChanged ? {...v, name: newName} : v;
              });
              patched = {...patched, variants};
            }
            return patched;
          });
          if (asChanged) state.setActiveSession({...as, exercises});
        }
      }
    }

    setEditExo(null);
    haptic('success');
  };

  // Initial view: choose a muscle group
  if (!filter) {
    return h('div', null,
      h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}},
        h('p', {className:'body-sm', style:{margin:0,color:'var(--ink-2)'}}, 'Choisis un groupe musculaire pour voir ses exercices.'),
        h('button', {className:'btn btn-primary btn-sm pressable', onClick:()=>setAddOpen(true)},
          ICONS.plus, ' Nouvel exo')),
      h('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}},
        state.muscleGroups.map(g => {
          const subs = subGroupsFor(g);
          return h('button', {key:g, className:'pressable',
            style:{padding:'14px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',textAlign:'left'},
            onClick: () => setFilter(g)
          },
            h('div', {style:{fontSize:13,fontWeight:700,color:'var(--ink-0)',marginBottom:4}}, g),
            h('div', {className:'meta'}, (exoCountByGroup[g]||0) + ' exo' + ((exoCountByGroup[g]||0)>1?'s':'')),
            subs.length > 0 && h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:4,letterSpacing:'.02em'}},
              subs.join(' · '))
          );
        })
      ),

      /* Add exo sheet accessible from here too — avec picker sous-groupe */
      h(Sheet, {open:addOpen, onClose:()=>setAddOpen(false), title:'Nouvel exercice'},
        h('div', {style:{display:'flex',flexDirection:'column',gap:12}},
          h('input', {className:'input', value:newName, onChange:e=>setNewName(e.target.value), placeholder:"Nom de l'exercice", autoFocus:true}),
          h('button', {className:'pressable', onClick:()=>setNewGroupPickerOpen(true),
            style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderRadius:12,background:'var(--bg-3)',border:'1px solid var(--line)',textAlign:'left'}
          },
            h('span', {style:{fontSize:14,color:'var(--ink-0)',fontWeight:600}}, newGroup),
            h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
          subGroupsFor(newGroup).length > 0 && h('button', {className:'pressable', onClick:()=>setNewSubPickerOpen(true),
            style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderRadius:12,background:'var(--bg-3)',border:'1px solid var(--line)',textAlign:'left'}
          },
            h('span', {style:{fontSize:14,color:newSubGroup?'var(--ink-0)':'var(--ink-3)',fontWeight:600}},
              newSubGroup || 'Sous-groupe (optionnel)'),
            h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
          h('div', {className:'seg'},
            h('button', {className: !newCompound?'active':'', onClick:()=>setNewCompound(false)}, 'Isolation'),
            h('button', {className: newCompound?'active':'', onClick:()=>setNewCompound(true)}, 'Polyarticulaire')),
          h('p', {className:'meta', style:{margin:0}},
            newCompound
              ? 'Mouvement composé (DC, squat, traction, rowing…). Sera proposé en ouverture de session par le générateur.'
              : 'Mouvement d\'isolation (curl, extension, élévation…). Placé en accessoire.'),
          h('button', {className:'btn btn-primary btn-full pressable', onClick:add}, ICONS.check, ' Ajouter'))),
      h(PickerSheet, {
        open: newGroupPickerOpen, onClose:()=>setNewGroupPickerOpen(false),
        title: 'Groupe musculaire',
        options: state.muscleGroups.map(g => ({value:g, label:g})),
        value: newGroup, onPick: (g) => { setNewGroup(g); setNewSubGroup(''); }
      }),
      h(PickerSheet, {
        open: newSubPickerOpen, onClose:()=>setNewSubPickerOpen(false),
        title: 'Sous-groupe',
        options: [{value:'', label:'— aucun —'}, ...subGroupsFor(newGroup).map(sg => ({value:sg, label:sg}))],
        value: newSubGroup, onPick: setNewSubGroup
      })
    );
  }

  return h('div', null,
    /* back + search + add */
    h('div', {style:{display:'flex',gap:8,marginBottom:10,alignItems:'center'}},
      h('button', {className:'pressable', onClick:()=>setFilter(''),
        style:{color:'var(--ink-2)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:4,padding:8}
      }, ICONS.left, ' Groupes'),
      h('input', {className:'input', placeholder:'Rechercher…', value:search, onChange:e=>setSearch(e.target.value), style:{flex:1}}),
      h('button', {className:'btn btn-primary btn-sm pressable', onClick:()=>setAddOpen(true)}, ICONS.plus)),
    h('div', {style:{padding:'10px 14px',background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:10,marginBottom:10}},
      h('div', {style:{fontSize:11,color:'var(--ink-3)',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',marginBottom:2}}, 'Groupe'),
      h('div', {style:{fontSize:16,fontWeight:700,color:'var(--ink-0)'}}, filter)
    ),
    (() => {
      if (filtered.length === 0) {
        return h('div', {style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',overflow:'hidden'}},
          h('div', {className:'empty-state', style:{padding:30}},
            h('div', {className:'sub'}, 'Aucun exercice dans ce groupe'))
        );
      }
      // Regroupement par sous-groupe si le muscle en possède
      const subs = subGroupsFor(filter);
      if (subs.length === 0) {
        // Pas de sous-groupes définis → liste plate
        return h('div', {style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',overflow:'hidden'}},
          filtered.map((l, i, arr) => h('div', {key:l.id, style:{
            display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:8,alignItems:'center',
            padding:'12px 14px', borderBottom: i===arr.length-1?'none':'1px solid var(--line)'
          }},
            h('div', null,
              h('div', {style:{fontSize:13,fontWeight:600,color:'var(--ink-0)'}}, l.name),
              h('div', {className:'meta', style:{marginTop:2}}, l.compound?'polyarticulaire':'isolation')),
            l.compound && h('span', {className:'chip', style:{padding:'2px 7px', fontSize:9, background:'var(--bg-hover)'}}, 'Poly'),
            h('button', {className:'pressable', style:{color:'var(--ink-3)', padding:4},
              onClick:()=>setEditExo({id:l.id, name:l.name, muscleGroup:l.muscleGroup, subGroup:l.subGroup||"", compound:!!l.compound, setting:l.setting||"", models:(l.models||[]).map(m=>({...m}))})},
              ICONS.edit),
            h('button', {className:'pressable', style:{color:'var(--danger)', padding:4}, onClick:()=>setDelConfirm(l)}, ICONS.trash)
          ))
        );
      }
      // Groupé par sous-groupe + orphelins en fin
      const bySub = {};
      subs.forEach(sg => { bySub[sg] = []; });
      const orphans = [];
      filtered.forEach(l => {
        if (l.subGroup && bySub[l.subGroup]) bySub[l.subGroup].push(l);
        else orphans.push(l);
      });
      const sections = [
        ...subs.map(sg => ({label: sg, items: bySub[sg]})),
        ...(orphans.length ? [{label: 'Non classés', items: orphans}] : [])
      ].filter(sec => sec.items.length > 0);

      return h('div', {style:{display:'flex',flexDirection:'column',gap:10}},
        sections.map(sec => h('div', {key:sec.label, style:{background:'var(--bg-2)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',overflow:'hidden'}},
          h('div', {style:{padding:'8px 14px',background:'var(--bg-3)',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between',alignItems:'center'}},
            h('span', {style:{fontSize:11,color:'var(--ink-1)',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase'}}, sec.label),
            h('span', {style:{fontSize:11,color:'var(--ink-3)',fontWeight:600}}, sec.items.length + ' exo' + (sec.items.length>1?'s':''))
          ),
          sec.items.map((l, i, arr) => h('div', {key:l.id, style:{
            display:'grid',gridTemplateColumns:'1fr auto auto auto',gap:8,alignItems:'center',
            padding:'12px 14px', borderBottom: i===arr.length-1?'none':'1px solid var(--line)'
          }},
            h('div', null,
              h('div', {style:{fontSize:13,fontWeight:600,color:'var(--ink-0)'}}, l.name),
              h('div', {className:'meta', style:{marginTop:2}}, l.compound?'polyarticulaire':'isolation')),
            l.compound && h('span', {className:'chip', style:{padding:'2px 7px', fontSize:9, background:'var(--bg-hover)'}}, 'Poly'),
            h('button', {className:'pressable', style:{color:'var(--ink-3)', padding:4},
              onClick:()=>setEditExo({id:l.id, name:l.name, muscleGroup:l.muscleGroup, subGroup:l.subGroup||"", compound:!!l.compound, setting:l.setting||"", models:(l.models||[]).map(m=>({...m}))})},
              ICONS.edit),
            h('button', {className:'pressable', style:{color:'var(--danger)', padding:4}, onClick:()=>setDelConfirm(l)}, ICONS.trash)
          ))
        ))
      );
    })(),

    h(Sheet, {open:addOpen, onClose:()=>setAddOpen(false), title:'Nouvel exercice'},
      h('div', {style:{display:'flex',flexDirection:'column',gap:12}},
        h('input', {className:'input', value:newName, onChange:e=>setNewName(e.target.value), placeholder:"Nom de l'exercice", autoFocus:true}),
        h('button', {className:'pressable', onClick:()=>setNewGroupPickerOpen(true),
          style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderRadius:12,background:'var(--bg-3)',border:'1px solid var(--line)',textAlign:'left'}
        },
          h('span', {style:{fontSize:14,color:'var(--ink-0)',fontWeight:600}}, newGroup),
          h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
        subGroupsFor(newGroup).length > 0 && h('button', {className:'pressable', onClick:()=>setNewSubPickerOpen(true),
          style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderRadius:12,background:'var(--bg-3)',border:'1px solid var(--line)',textAlign:'left'}
        },
          h('span', {style:{fontSize:14,color:newSubGroup?'var(--ink-0)':'var(--ink-3)',fontWeight:600}},
            newSubGroup || 'Sous-groupe (optionnel)'),
          h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
        h('div', {className:'seg'},
          h('button', {className: !newCompound?'active':'', onClick:()=>setNewCompound(false)}, 'Isolation'),
          h('button', {className: newCompound?'active':'', onClick:()=>setNewCompound(true)}, 'Polyarticulaire')),
        h('p', {className:'meta', style:{margin:0}},
          newCompound
            ? 'Mouvement composé (DC, squat, traction, rowing…). Sera proposé en ouverture de session par le générateur.'
            : "Mouvement d'isolation (curl, extension, élévation…). Placé en accessoire."),
        h('button', {className:'btn btn-primary btn-full pressable', onClick:add}, ICONS.check, ' Ajouter'))
    ),
    h(PickerSheet, {
      open: newGroupPickerOpen, onClose:()=>setNewGroupPickerOpen(false),
      title: 'Groupe musculaire',
      options: state.muscleGroups.map(g => ({value:g, label:g})),
      value: newGroup, onPick: (g) => { setNewGroup(g); setNewSubGroup(''); }
    }),
    h(PickerSheet, {
      open: newSubPickerOpen, onClose:()=>setNewSubPickerOpen(false),
      title: 'Sous-groupe',
      options: [{value:'', label:'— aucun —'}, ...subGroupsFor(newGroup).map(sg => ({value:sg, label:sg}))],
      value: newSubGroup, onPick: setNewSubGroup
    }),

    /* EDIT EXO SHEET */
    h(EditExoSheet, {
      open: !!editExo, onClose:()=>setEditExo(null),
      exo: editExo, state, onChange: setEditExo, onSave: editSave,
      subGroupsFor
    }),

    h(ConfirmSheet, {
      open: !!delConfirm, onClose:()=>setDelConfirm(null),
      onConfirm: () => { setExerciseLib(exerciseLib.filter(l => l.id !== delConfirm.id)); setDelConfirm(null); },
      title: 'Supprimer cet exercice ?',
      message: delConfirm ? `"${delConfirm.name}" sera retiré de la bibliothèque. Les séances déjà journalisées restent intactes.` : ''
    })
  );
}

function EditExoSheet({open, onClose, exo, state, onChange, onSave, subGroupsFor}) {
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [subPickerOpen, setSubPickerOpen] = useState(false);
  if (!exo) return null;

  // Couleurs disponibles pour les modèles (palette restreinte cohérente avec le design system)
  const MODEL_COLORS = [
    {id: 'coral', label: 'Corail', hex: '#FC4C02'},
    {id: 'blue', label: 'Bleu', hex: '#378ADD'},
    {id: 'green', label: 'Vert', hex: '#639922'},
    {id: 'purple', label: 'Violet', hex: '#7F77DD'},
    {id: 'amber', label: 'Ambre', hex: '#EF9F27'},
    {id: 'pink', label: 'Rose', hex: '#D4537E'},
    {id: 'teal', label: 'Sarcelle', hex: '#1D9E75'}
  ];

  const models = exo.models || [];
  const usedColors = new Set(models.map(m => m.color).filter(Boolean));
  const nextFreeColor = () => MODEL_COLORS.find(c => !usedColors.has(c.id))?.id || 'coral';

  const addModel = () => {
    onChange({...exo, models: [...models, {
      id: 'mdl-' + Math.random().toString(36).slice(2, 9),
      name: '',
      setting: '',
      color: nextFreeColor()
    }]});
  };
  const updateModel = (mid, patch) => {
    onChange({...exo, models: models.map(m => m.id === mid ? {...m, ...patch} : m)});
  };
  const removeModel = (mid) => {
    onChange({...exo, models: models.filter(m => m.id !== mid)});
  };

  return h(React.Fragment, null,
    h(Sheet, {open, onClose, title:'Modifier l\'exercice'},
      h('div', {style:{display:'flex',flexDirection:'column',gap:12}},
        h('input', {className:'input', value:exo.name, placeholder:'Nom', onChange:e=>onChange({...exo, name:e.target.value}), autoFocus:true}),
        h('button', {className:'pressable', onClick:()=>setGroupPickerOpen(true),
          style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderRadius:12,background:'var(--bg-3)',border:'1px solid var(--line)',textAlign:'left'}
        },
          h('span', {style:{fontSize:14,color:'var(--ink-0)',fontWeight:600}}, exo.muscleGroup),
          h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
        subGroupsFor(exo.muscleGroup).length > 0 && h('button', {className:'pressable', onClick:()=>setSubPickerOpen(true),
          style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderRadius:12,background:'var(--bg-3)',border:'1px solid var(--line)',textAlign:'left'}
        },
          h('span', {style:{fontSize:14,color:exo.subGroup?'var(--ink-0)':'var(--ink-3)',fontWeight:600}},
            exo.subGroup || 'Sous-groupe (optionnel)'),
          h('span', {style:{color:'var(--ink-3)'}}, ICONS.chevDown)),
        h('div', {className:'seg'},
          h('button', {className: !exo.compound?'active':'', onClick:()=>onChange({...exo, compound:false})}, 'Isolation'),
          h('button', {className: exo.compound?'active':'', onClick:()=>onChange({...exo, compound:true})}, 'Polyarticulaire')),

        // Réglage global (utilisé si aucun modèle n'est défini)
        models.length === 0 && h('div', null,
          h('div', {className:'label', style:{marginBottom:6}}, 'Réglage (facultatif)'),
          h('input', {className:'input',
            placeholder: 'ex: siège 4, dossier 6',
            value: exo.setting || '',
            onChange: e => onChange({...exo, setting: e.target.value})
          }),
          h('div', {style:{fontSize:10,color:'var(--ink-3)',marginTop:4,lineHeight:1.4}},
            'Affiché en lecture seule pendant la séance.')),

        // Section MODÈLES / MARQUES
        h('div', null,
          h('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}},
            h('div', {className:'label'}, 'Modèles / marques'),
            h('span', {style:{fontSize:9,color:'var(--ink-3)'}}, 'facultatif')),
          h('div', {style:{fontSize:10,color:'var(--ink-3)',lineHeight:1.5,marginBottom:8}},
            'Si tu utilises plusieurs machines pour cet exo, ajoute-les ici. Chaque modèle aura sa propre cible et son propre PR.'),

          h('div', {style:{display:'flex',flexDirection:'column',gap:6,marginBottom:8}},
            models.map(m => h('div', {key:m.id, style:{
              padding:'10px 12px',background:'var(--bg-3)',border:'1px solid var(--line)',borderRadius:10,
              display:'flex',flexDirection:'column',gap:8
            }},
              // Nom + suppression
              h('div', {style:{display:'flex',alignItems:'center',gap:8}},
                h('input', {className:'input', placeholder:'Nom du modèle (ex: Hammer Strength)',
                  style:{flex:1,padding:'8px 10px',fontSize:13},
                  value: m.name,
                  onChange: e => updateModel(m.id, {name: e.target.value})}),
                h('button', {className:'pressable', style:{color:'var(--danger)',padding:6,flex:'0 0 auto'},
                  onClick: () => removeModel(m.id)}, ICONS.x)
              ),
              // Réglage du modèle
              h('input', {className:'input', placeholder:'Réglage (ex: siège 4, dossier 6)',
                style:{padding:'8px 10px',fontSize:12},
                value: m.setting || '',
                onChange: e => updateModel(m.id, {setting: e.target.value})}),
              // Sélecteur de couleur — 7 pastilles visibles, tap = preview immédiate
              h('div', {style:{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}},
                h('span', {style:{fontSize:10,color:'var(--ink-3)',fontWeight:500,marginRight:4}}, 'Couleur :'),
                MODEL_COLORS.map(c => {
                  const active = (m.color || 'coral') === c.id;
                  return h('button', {
                    key: c.id,
                    type: 'button',
                    className: 'pressable',
                    title: c.label,
                    onClick: () => updateModel(m.id, {color: c.id}),
                    style: {
                      width: 22, height: 22, borderRadius: '50%',
                      background: c.hex,
                      border: active ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: active ? '0 0 0 2px '+c.hex+'66' : 'none',
                      padding: 0, flex: '0 0 auto',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform .15s var(--ease-ios), box-shadow .15s var(--ease-ios), border-color .15s var(--ease-ios)'
                    }
                  });
                })
              )
            ))
          ),
          // Ajouter modèle
          h('button', {className:'pressable',
            onClick: addModel,
            style:{
              width:'100%',padding:'10px 12px',borderRadius:10,
              background:'rgba(255,255,255,.02)',
              border:'1px dashed rgba(255,255,255,.15)',
              color:'var(--ink-2)',fontSize:12,fontWeight:600,
              display:'flex',alignItems:'center',justifyContent:'center',gap:6
            }},
            '＋ Ajouter un modèle')
        ),

        h('button', {className:'btn btn-primary btn-full pressable', onClick:onSave}, ICONS.check, ' Enregistrer'))),
    h(PickerSheet, {
      open: groupPickerOpen, onClose:()=>setGroupPickerOpen(false),
      title: 'Groupe musculaire',
      options: state.muscleGroups.map(g => ({value:g, label:g})),
      value: exo.muscleGroup, onPick: (g) => onChange({...exo, muscleGroup: g, subGroup:''})
    }),
    h(PickerSheet, {
      open: subPickerOpen, onClose:()=>setSubPickerOpen(false),
      title: 'Sous-groupe',
      options: [{value:'', label:'— aucun —'}, ...subGroupsFor(exo.muscleGroup).map(sg => ({value:sg, label:sg}))],
      value: exo.subGroup || '', onPick: (sg) => onChange({...exo, subGroup: sg})
    })
  );
}

/* ==========================================================================
   DATA BACKUP
   ========================================================================== */

function ParamsData({state}) {
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => LS.get('last_backup', null));
  // Import backup : confirmation visuelle avant écrasement
  const [importPayload, setImportPayload] = useState(null); // {data, filename, stats}
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);
  // Export backup : récap visible après l'export pour confirmer le contenu
  const [exportRecap, setExportRecap] = useState(null);
  // Import pesées : sheet de choix de format puis preview avant import
  const [weightImportOpen, setWeightImportOpen] = useState(false);
  const [weightPreview, setWeightPreview] = useState(null); // {entries:[], source, duplicates, invalid}
  const [weightImportError, setWeightImportError] = useState(null);

  /**
   * Parse Apple Health export.xml — cherche les Records type=HKQuantityTypeIdentifierBodyMass.
   * Format Apple : <Record type="HKQuantityTypeIdentifierBodyMass" startDate="2025-04-12 08:14:00 +0200" value="63.2" unit="kg"/>
   * Convertit lb → kg si nécessaire (1 lb = 0.453592 kg).
   * Retourne array de {date: 'YYYY-MM-DD', weight: number, source: 'AppleHealth'}.
   */
  const parseAppleHealthXML = (xmlText) => {
    const entries = [];
    let invalid = 0;
    // Regex robuste : on évite DOMParser car le fichier peut être 50+ Mo et bloquer le navigateur
    // On cherche directement les Records BodyMass sans tout parser
    const recordRegex = /<Record[^>]*type="HKQuantityTypeIdentifierBodyMass"[^>]*\/?>/g;
    let m;
    while ((m = recordRegex.exec(xmlText)) !== null) {
      const tag = m[0];
      const dateMatch = tag.match(/startDate="([^"]+)"/);
      const valueMatch = tag.match(/value="([^"]+)"/);
      const unitMatch = tag.match(/unit="([^"]+)"/);
      if (!dateMatch || !valueMatch) { invalid++; continue; }
      // Date Apple : "YYYY-MM-DD HH:MM:SS +ZZZZ" — on garde juste YYYY-MM-DD
      const date = dateMatch[1].slice(0, 10);
      let weight = parseFloat(valueMatch[1]);
      const unit = (unitMatch?.[1] || 'kg').toLowerCase();
      if (unit === 'lb' || unit === 'lbs') weight = weight * 0.453592;
      if (!(weight > 20 && weight < 300)) { invalid++; continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { invalid++; continue; }
      entries.push({date, weight: Math.round(weight * 10) / 10});
    }
    return {entries, invalid};
  };

  /**
   * Parse CSV simple. Formats acceptés :
   *   date,weight
   *   date,weight,note
   *   date,weight,fasted
   *   date,kg
   * Headers optionnels (auto-détectés). Date YYYY-MM-DD ou DD/MM/YYYY.
   */
  const parseCSV = (text) => {
    const entries = [];
    let invalid = 0;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return {entries, invalid: 0};
    // Détecter header : si la 1ère ligne contient un mot non-numérique en col 2
    let startIdx = 0;
    const firstCols = lines[0].split(/[,;\t]/);
    if (firstCols.length >= 2 && isNaN(parseFloat(firstCols[1]))) startIdx = 1;
    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) { invalid++; continue; }
      let dateStr = cols[0];
      // Convertir DD/MM/YYYY en YYYY-MM-DD
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, mo, y] = dateStr.split('/');
        dateStr = `${y}-${mo}-${d}`;
      }
      // Garder juste la partie date si timestamp ISO
      if (dateStr.length > 10) dateStr = dateStr.slice(0, 10);
      const weight = parseFloat(cols[1].replace(',', '.'));
      if (!(weight > 20 && weight < 300)) { invalid++; continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) { invalid++; continue; }
      const note = cols[2] || null;
      const fasted = cols[2] && /jeun|fasted|true|1/i.test(cols[2]);
      entries.push({date: dateStr, weight: Math.round(weight * 10) / 10, note, fasted: !!fasted});
    }
    return {entries, invalid};
  };

  /** Lance le file picker pour Apple Health (XML ou ZIP) */
  const pickAppleHealth = () => {
    setWeightImportError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,application/xml,text/xml';
    input.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        if (f.size > 200 * 1024 * 1024) {
          setWeightImportError('Fichier trop volumineux (>200 Mo). Extrais export.xml du zip Apple Health avant de l\'envoyer.');
          return;
        }
        const text = await f.text();
        if (!text.includes('HKQuantityTypeIdentifierBodyMass')) {
          setWeightImportError('Aucune pesée trouvée dans ce fichier. Vérifie qu\'il s\'agit bien de export.xml depuis Apple Health.');
          return;
        }
        const {entries, invalid} = parseAppleHealthXML(text);
        if (!entries.length) {
          setWeightImportError('Aucune pesée valide trouvée.');
          return;
        }
        // Dédup par date : Apple Health peut avoir plusieurs pesées le même jour, on garde la plus récente
        const byDate = {};
        entries.forEach(e => { byDate[e.date] = e.weight; });
        const dedup = Object.entries(byDate).map(([date, weight]) => ({date, weight}));
        dedup.sort((a, b) => a.date.localeCompare(b.date));
        // Détection des doublons avec les pesées existantes
        const existingDates = new Set(state.weights.map(w => w.date));
        const duplicates = dedup.filter(e => existingDates.has(e.date)).length;
        setWeightPreview({entries: dedup, source: 'Apple Health', invalid, duplicates});
      } catch (err) {
        setWeightImportError('Erreur lecture fichier : ' + err.message);
      }
    };
    input.click();
  };

  /** Lance le file picker pour CSV */
  const pickCSV = () => {
    setWeightImportError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const text = await f.text();
        const {entries, invalid} = parseCSV(text);
        if (!entries.length) {
          setWeightImportError('Aucune pesée valide trouvée. Format attendu : date,poids (ex: 2025-04-15,63.2)');
          return;
        }
        entries.sort((a, b) => a.date.localeCompare(b.date));
        const existingDates = new Set(state.weights.map(w => w.date));
        const duplicates = entries.filter(e => existingDates.has(e.date)).length;
        setWeightPreview({entries, source: 'CSV', invalid, duplicates});
      } catch (err) {
        setWeightImportError('Erreur lecture fichier : ' + err.message);
      }
    };
    input.click();
  };

  /**
   * Confirme l'import : merge avec les pesées existantes.
   * Stratégie : pour chaque date importée, si elle existe déjà → on remplace (l'import est plus récent
   * et probablement plus précis qu'une saisie manuelle ancienne). Sinon on ajoute.
   */
  const confirmWeightImport = () => {
    if (!weightPreview) return;
    const existing = [...state.weights];
    const importedByDate = {};
    weightPreview.entries.forEach(e => { importedByDate[e.date] = e; });
    // 1) Remplacer les pesées existantes dont la date est dans l'import
    const merged = existing.map(w => {
      if (importedByDate[w.date]) {
        const imp = importedByDate[w.date];
        delete importedByDate[w.date]; // marqué comme traité
        return {...w, weight: imp.weight, fasted: imp.fasted ?? w.fasted, note: imp.note ?? w.note};
      }
      return w;
    });
    // 2) Ajouter les nouvelles pesées (celles dont la date n'existait pas)
    Object.values(importedByDate).forEach(imp => {
      merged.push({
        id: uid(),
        date: imp.date,
        weight: imp.weight,
        fasted: imp.fasted ?? true,
        note: imp.note ?? null,
        createdAt: Date.now(),
        importedFrom: weightPreview.source
      });
    });
    state.setWeights(merged);
    setWeightPreview(null);
    setWeightImportOpen(false);
    haptic('success');
  };

  const exportJson = () => {
    // Snapshot exhaustif : toutes les données utilisateur + toutes les préférences UI
    // persistées en LS. La version sert au futur pour gérer la rétro-compat.
    const data = {
      version: 3,
      createdAt: new Date().toISOString(),
      // === DATA ===
      programs: state.programs,
      currentProgramId: state.currentProgramId,
      exerciseLib: state.exerciseLib,
      weights: state.weights,
      journalLogs: state.journalLogs,
      muscleGroups: state.muscleGroups,
      subGroups: state.subGroups,
      // Notes de séance future attachées aux (programId, sessionId)
      sessionNotes: LS.get('session_notes', {}),
      // === Préférences UI persistées en LS ===
      preferences: {
        user_name: LS.get('user_name', ''),
        dash_hero: LS.get('dash_hero', 'surcharge'),
        prog_period: LS.get('prog_period', '30'),
        prog_view: LS.get('prog_view', 'exos'),
        pesee_period: LS.get('pesee_period', '30'),
        tab: LS.get('tab', 'dashboard')
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mylift-backup-' + todayIso() + '.json'; a.click();
    URL.revokeObjectURL(url);
    LS.set('last_backup', Date.now());
    setLastBackup(Date.now());
    haptic('success');
    // Affiche un récap de ce qui a été exporté
    setExportRecap({
      programs: (data.programs || []).length,
      exos: (data.exerciseLib || []).length,
      logs: (data.journalLogs || []).length,
      weights: (data.weights || []).length,
      muscles: (data.muscleGroups || []).length,
      subGroups: Object.keys(data.subGroups || {}).length,
      filename: 'mylift-backup-' + todayIso() + '.json'
    });
  };

  // Import : on parse d'abord puis on demande confirmation via ConfirmSheet propre.
  // Pas de confirm()/alert() natifs (souvent bloqués / moches sur iOS PWA).
  const importJson = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,application/octet-stream,.json';
    input.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.programs || !Array.isArray(data.programs)) {
          setImportError('Format invalide : le fichier ne contient pas de programmes.');
          return;
        }
        setImportPayload({
          data, filename: f.name,
          stats: {
            programs: (data.programs || []).length,
            exos: (data.exerciseLib || []).length,
            logs: (data.journalLogs || []).length,
            weights: (data.weights || []).length,
            muscles: (data.muscleGroups || []).length,
            subGroups: Object.keys(data.subGroups || {}).length,
            hasPrefs: !!data.preferences
          }
        });
      } catch (err) {
        setImportError('Erreur de lecture : ' + err.message);
      }
    };
    input.click();
  };

  const applyImport = () => {
    if (!importPayload) return;
    const data = importPayload.data;
    // Données principales
    if (data.programs) state.setPrograms(data.programs);
    if (data.currentProgramId !== undefined) state.setCurrentProgramId(data.currentProgramId);
    if (data.exerciseLib) state.setExerciseLib(data.exerciseLib);
    if (data.weights) state.setWeights(data.weights);
    if (data.journalLogs) state.setJournalLogs(data.journalLogs);
    if (data.muscleGroups) state.setMuscleGroups(data.muscleGroups);
    if (data.subGroups) state.setSubGroups(data.subGroups);
    if (data.sessionNotes && typeof data.sessionNotes === 'object') LS.set('session_notes', data.sessionNotes);
    // Préférences UI (non critique : si absent, on garde les actuelles)
    if (data.preferences && typeof data.preferences === 'object') {
      Object.entries(data.preferences).forEach(([k, v]) => {
        if (v !== undefined && v !== null) LS.set(k, v);
      });
    }
    setImportPayload(null);
    setImportSuccess(true);
    haptic('success');
  };

  const wipe = () => {
    Object.keys(localStorage).filter(k => k.startsWith('mylift_')).forEach(k => localStorage.removeItem(k));
    location.reload();
  };

  const seedDemo = () => {
    // 1) Patch la bibliothèque : ajoute des modèles à 4 exos emblématiques pour tester la feature
    const MODEL_SEEDS = {
      'Leg extension': [
        {name: 'Hammer Strength', setting: 'siège 4, dossier 6', color: 'coral'},
        {name: 'Technogym Selection', setting: 'siège 3, dossier 5', color: 'blue'}
      ],
      'Presse à cuisses': [
        {name: 'Hammer Iso Lat', setting: 'pieds bas, dossier 3', color: 'coral'},
        {name: 'Cybex Plate Loaded', setting: 'pieds milieu, dossier 5', color: 'green'}
      ],
      'Tirage poitrine': [
        {name: 'Life Fitness', setting: 'siège 5, butée 3', color: 'purple'},
        {name: 'Technogym', setting: 'siège 4, butée 2', color: 'blue'}
      ],
      'Développé couché à la Smith': [
        {name: 'Smith droit', setting: 'banc plat, repose 6', color: 'amber'},
        {name: 'Smith décalé', setting: 'banc plat, repose 5', color: 'pink'}
      ]
    };
    const patchedLib = state.exerciseLib.map(l => {
      if (!MODEL_SEEDS[l.name]) return l;
      // Idempotent : si déjà des modèles, on ne touche pas
      if ((l.models || []).length > 0) return l;
      return {
        ...l,
        models: MODEL_SEEDS[l.name].map((m, i) => ({
          id: 'mdl-seed-' + l.id + '-' + i,
          name: m.name,
          setting: m.setting,
          color: m.color
        }))
      };
    });
    state.setExerciseLib(patchedLib);

    const demo = generateDemoData(patchedLib);

    // 2) Patch les programmes générés : pour les exos qui ont des modèles, ajoute des modelTargets
    //    Ainsi en séance live l'utilisateur verra des modèles programmés avec cibles différentes
    const enrichedProgs = demo.programs.map(p => ({
      ...p,
      sessions: (p.sessions || []).map(sess => ({
        ...sess,
        exercises: (sess.exercises || []).map(pex => {
          const c0 = pex.choices?.[0];
          const libEx = c0?.exId ? patchedLib.find(l => l.id === c0.exId) : null;
          const models = libEx?.models || [];
          if (models.length === 0) return pex;
          // Programme tous les modèles avec une cible légèrement différente (basée sur c0.weight)
          const baseW = parseFloat(c0?.weight) || 50;
          const modelTargets = models.map((m, i) => ({
            modelId: m.id,
            // Premier modèle = poids de base, modèles suivants ±10%
            weight: Math.round((baseW * (i === 0 ? 1 : 0.9 + i * 0.05)) * 2) / 2
          }));
          return {...pex, modelTargets};
        })
      }))
    }));

    // 3) Patch les logs : pour les exos avec modèles, alterne aléatoirement entre les modèles
    //    Cela génère un historique réaliste avec PRs distincts par machine
    const enrichedLogs = demo.journalLogs.map(log => ({
      ...log,
      exercises: (log.exercises || []).map(ex => {
        const libEx = ex.exId ? patchedLib.find(l => l.id === ex.exId) : null;
        const models = libEx?.models || [];
        if (models.length === 0) return ex;
        // Choix pseudo-aléatoire stable basé sur la date pour cohérence
        const seed = (log.date + ex.exId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const idx = seed % models.length;
        return {...ex, modelId: models[idx].id};
      })
    }));

    // Ajoute les programmes (dédup si déjà présents par id)
    const existingIds = new Set(state.programs.map(p => p.id));
    const newProgs = enrichedProgs.filter(p => !existingIds.has(p.id));
    if (newProgs.length) state.setPrograms([...state.programs, ...newProgs]);
    state.setJournalLogs([...state.journalLogs, ...enrichedLogs]);
    state.setWeights([...state.weights, ...demo.weights]);
    // Sélectionne ON AIR comme programme actif si aucun programme avant
    if (state.programs.length === 0 && newProgs.length) {
      state.setCurrentProgramId(newProgs[0].id);
    }
    setSeedConfirm(false);
    haptic('success');
  };

  return h('div', null,
    h('p', {className:'body-sm', style:{marginBottom:16, color:'var(--ink-2)'}},
      'Sauvegarde et restauration de tes données (programmes, séances, pesées, exercices).'),
    lastBackup && h('div', {className:'meta', style:{marginBottom:10}},
      'Dernier backup : ' + formatRelative(iso(new Date(lastBackup)))),
    h('div', {style:{display:'flex',flexDirection:'column',gap:8}},
      h('button', {className:'btn btn-primary btn-full pressable', onClick:exportJson},
        '📥 Exporter un backup'),
      h('button', {className:'btn btn-ghost btn-full pressable', onClick:importJson},
        '📤 Importer un backup'),
      h('button', {className:'btn btn-ghost btn-full pressable', onClick:()=>{setWeightImportOpen(true); setWeightImportError(null); setWeightPreview(null);}},
        '⚖️ Importer des pesées'),
      h('div', {style:{marginTop:20, padding:14, background:'rgba(255,59,72,.08)', border:'1px solid rgba(255,59,72,.25)', borderRadius:12}},
        h('div', {className:'title-sm', style:{color:'var(--danger)', marginBottom:8}}, 'Zone dangereuse'),
        h('button', {className:'btn btn-danger btn-full pressable', onClick:()=>setWipeConfirm(true)},
          ICONS.trash, ' Tout effacer')),
      h('div', {style:{marginTop:20, padding:14, background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:12}},
        h('div', {className:'label', style:{marginBottom:10}}, 'Stats'),
        h('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,fontSize:13}},
          h('div', null, h('div', {className:'meta'}, 'Programmes'), h('div', {className:'title-sm'}, state.programs.length)),
          h('div', null, h('div', {className:'meta'}, 'Séances'), h('div', {className:'title-sm'}, state.journalLogs.length)),
          h('div', null, h('div', {className:'meta'}, 'Exercices'), h('div', {className:'title-sm'}, state.exerciseLib.length)),
          h('div', null, h('div', {className:'meta'}, 'Pesées'), h('div', {className:'title-sm'}, state.weights.length))
        ))
    ),
    h(ConfirmSheet, {
      open: wipeConfirm, onClose:()=>setWipeConfirm(false),
      onConfirm: wipe,
      title: 'Tout effacer ?',
      message: '⚠️ Toutes tes données (programmes, séances, pesées, config) seront définitivement supprimées. Cette action est irréversible.'
    }),
    // Confirmation visuelle de l'import — affiche les stats du backup avant écrasement
    h(ConfirmSheet, {
      open: !!importPayload, onClose: () => setImportPayload(null),
      onConfirm: applyImport,
      title: 'Importer ce backup ?',
      message: importPayload
        ? 'Toutes tes données actuelles seront ÉCRASÉES par le contenu de « ' + importPayload.filename + ' » :\n\n'
          + '• ' + importPayload.stats.programs + ' programme' + (importPayload.stats.programs>1?'s':'') + '\n'
          + '• ' + importPayload.stats.exos + ' exercices en biblio\n'
          + '• ' + importPayload.stats.logs + ' séance' + (importPayload.stats.logs>1?'s':'') + ' dans le journal\n'
          + '• ' + importPayload.stats.weights + ' pesée' + (importPayload.stats.weights>1?'s':'') + '\n'
          + '• ' + importPayload.stats.muscles + ' groupes musculaires\n'
          + '• ' + importPayload.stats.subGroups + ' familles de sous-muscles\n'
          + (importPayload.stats.hasPrefs ? '• tes préférences UI\n' : '')
          + '\nCette action ne peut pas être annulée. Pense à exporter d\'abord si tu n\'es pas sûr.'
        : '',
      confirmLabel: 'Écraser et importer'
    }),
    // Récap visible après export : confirme que TOUT a bien été exporté
    h(Sheet, {
      open: !!exportRecap, onClose: () => setExportRecap(null),
      title: 'Backup créé'
    },
      exportRecap && h('div', null,
        h('p', {className:'body', style:{marginTop:0, marginBottom:12, color:'var(--ink-1)'}},
          'Fichier téléchargé : ', h('strong', null, exportRecap.filename)),
        h('div', {style:{padding:14, background:'var(--bg-3)', borderRadius:10, marginBottom:16}},
          h('div', {className:'label', style:{marginBottom:8}}, 'Contenu sauvegardé'),
          h('div', {style:{display:'flex',flexDirection:'column',gap:4,fontSize:13,color:'var(--ink-1)'}},
            h('div', null, '• ', h('strong', null, exportRecap.programs), ' programme' + (exportRecap.programs>1?'s':'')),
            h('div', null, '• ', h('strong', null, exportRecap.exos), ' exercices en biblio'),
            h('div', null, '• ', h('strong', null, exportRecap.logs), ' séance' + (exportRecap.logs>1?'s':'') + ' du journal'),
            h('div', null, '• ', h('strong', null, exportRecap.weights), ' pesée' + (exportRecap.weights>1?'s':'')),
            h('div', null, '• ', h('strong', null, exportRecap.muscles), ' groupes musculaires'),
            h('div', null, '• ', h('strong', null, exportRecap.subGroups), ' familles de sous-muscles'),
            h('div', null, '• préférences UI (dashboard, filtres…)')
          )),
        h('button', {className:'btn btn-primary btn-full pressable', onClick: () => setExportRecap(null)}, 'OK')
      )
    ),
    // Erreur d'import (format invalide / parse error) — affichage simple via ConfirmSheet
    h(Sheet, {
      open: !!importError, onClose: () => setImportError(null),
      title: 'Import impossible'
    },
      h('p', {className:'body', style:{marginTop:0, marginBottom:16, color:'var(--ink-1)'}}, importError || ''),
      h('button', {className:'btn btn-primary btn-full pressable', onClick: () => setImportError(null)}, 'OK')
    ),
    // Succès d'import
    h(Sheet, {
      open: importSuccess, onClose: () => setImportSuccess(false),
      title: 'Import réussi'
    },
      h('p', {className:'body', style:{marginTop:0, marginBottom:16, color:'var(--ink-1)'}},
        'Toutes tes données ont été restaurées depuis le backup.'),
      h('button', {className:'btn btn-primary btn-full pressable', onClick: () => setImportSuccess(false)}, 'OK')
    ),

    // Sheet d'import des pesées (choix de source + preview + confirmation)
    h(Sheet, {
      open: weightImportOpen,
      onClose: () => { setWeightImportOpen(false); setWeightPreview(null); setWeightImportError(null); },
      title: weightPreview ? 'Aperçu de l\'import' : 'Importer des pesées'
    },
      // Étape 1 : choix de la source (visible tant qu'aucun preview)
      !weightPreview && h('div', {style:{display:'flex',flexDirection:'column',gap:10}},
        h('p', {className:'body-sm', style:{margin:'0 0 6px 0', color:'var(--ink-2)'}},
          'Importe ton historique de poids depuis Apple Health ou un fichier CSV. Les pesées existantes à la même date sont remplacées, les autres sont ajoutées.'),

        // Apple Health
        h('button', {
          className:'press-row',
          onClick: pickAppleHealth,
          style:{
            display:'flex',alignItems:'flex-start',gap:12,
            padding:'14px',borderRadius:12,
            background:'rgba(252,76,2,.06)',border:'1px solid rgba(252,76,2,.2)',
            textAlign:'left',width:'100%'
          }
        },
          h('span', {style:{fontSize:24,flex:'0 0 auto',lineHeight:1}}, '🍎'),
          h('div', {style:{flex:1}},
            h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',marginBottom:4}}, 'Apple Health (export.xml)'),
            h('div', {style:{fontSize:11,color:'var(--ink-2)',lineHeight:1.5}},
              'iPhone → Santé → ton profil → Exporter les données. Décompresse le zip et envoie le fichier export.xml.')
          )
        ),

        // CSV
        h('button', {
          className:'press-row',
          onClick: pickCSV,
          style:{
            display:'flex',alignItems:'flex-start',gap:12,
            padding:'14px',borderRadius:12,
            background:'var(--bg-2)',border:'1px solid var(--line)',
            textAlign:'left',width:'100%'
          }
        },
          h('span', {style:{fontSize:24,flex:'0 0 auto',lineHeight:1}}, '📄'),
          h('div', {style:{flex:1}},
            h('div', {style:{fontSize:14,fontWeight:700,color:'var(--ink-0)',marginBottom:4}}, 'CSV'),
            h('div', {style:{fontSize:11,color:'var(--ink-2)',lineHeight:1.5}},
              'Une ligne par pesée. Format : ',
              h('code', {style:{fontFamily:'var(--f-mono)',fontSize:10,background:'var(--bg-3)',padding:'1px 4px',borderRadius:3}}, 'date,poids'),
              ' — ex: ',
              h('code', {style:{fontFamily:'var(--f-mono)',fontSize:10,background:'var(--bg-3)',padding:'1px 4px',borderRadius:3}}, '2025-04-15,63.2'))
          )
        ),

        weightImportError && h('div', {style:{
          marginTop:6, padding:'10px 12px',borderRadius:10,
          background:'rgba(255,59,72,.08)',border:'1px solid rgba(255,59,72,.25)',
          color:'var(--danger)',fontSize:12,lineHeight:1.5
        }}, weightImportError)
      ),

      // Étape 2 : preview (visible quand weightPreview est set)
      weightPreview && h('div', {style:{display:'flex',flexDirection:'column',gap:12}},
        h('div', {style:{
          padding:'12px 14px',borderRadius:12,
          background:'var(--bg-2)',border:'1px solid var(--line)'
        }},
          h('div', {style:{display:'flex',justifyContent:'space-between',marginBottom:8}},
            h('span', {className:'meta'}, 'Source'),
            h('span', {style:{fontSize:12,fontWeight:700,color:'var(--ink-0)'}}, weightPreview.source)
          ),
          h('div', {style:{display:'flex',justifyContent:'space-between',marginBottom:8}},
            h('span', {className:'meta'}, 'Pesées valides'),
            h('span', {style:{fontSize:12,fontWeight:700,color:'var(--accent-hi)'}}, weightPreview.entries.length)
          ),
          weightPreview.duplicates > 0 && h('div', {style:{display:'flex',justifyContent:'space-between',marginBottom:8}},
            h('span', {className:'meta'}, 'Dates déjà présentes (seront remplacées)'),
            h('span', {style:{fontSize:12,fontWeight:700,color:'var(--pr-gold)'}}, weightPreview.duplicates)
          ),
          weightPreview.invalid > 0 && h('div', {style:{display:'flex',justifyContent:'space-between'}},
            h('span', {className:'meta'}, 'Lignes invalides ignorées'),
            h('span', {style:{fontSize:12,fontWeight:700,color:'var(--ink-3)'}}, weightPreview.invalid)
          )
        ),

        // Aperçu des 5 premières + 5 dernières
        h('div', {style:{
          padding:'10px 12px',borderRadius:10,background:'var(--bg-2)',border:'1px solid var(--line)',
          maxHeight:180,overflow:'auto'
        }},
          h('div', {className:'label', style:{marginBottom:6}}, 'Aperçu'),
          (weightPreview.entries.length <= 10 ? weightPreview.entries : [
            ...weightPreview.entries.slice(0, 5),
            null, // séparateur
            ...weightPreview.entries.slice(-5)
          ]).map((e, i) =>
            e === null
              ? h('div', {key:'sep', style:{textAlign:'center',color:'var(--ink-4)',fontSize:11,padding:'4px 0'}},
                  '… ' + (weightPreview.entries.length - 10) + ' pesées …')
              : h('div', {key:i, style:{
                  display:'flex',justifyContent:'space-between',padding:'3px 0',
                  fontSize:12,fontVariantNumeric:'tabular-nums',
                  borderBottom:i < weightPreview.entries.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none'
                }},
                  h('span', {style:{color:'var(--ink-2)'}}, e.date),
                  h('span', {style:{color:'var(--ink-0)',fontWeight:600}}, e.weight + ' kg')
                )
          )
        ),

        h('div', {style:{display:'flex',gap:8,marginTop:6}},
          h('button', {
            className:'btn btn-ghost pressable', style:{flex:1},
            onClick: () => setWeightPreview(null)
          }, 'Annuler'),
          h('button', {
            className:'btn btn-primary pressable', style:{flex:2},
            onClick: confirmWeightImport
          }, 'Importer ' + weightPreview.entries.length + ' pesée' + (weightPreview.entries.length > 1 ? 's' : ''))
        )
      )
    )
  );
}


/* ==========================================================================
   FAKE DATA — seed réaliste pour tester l'app
   1 an de séances, alternance de 2 programmes (ON AIR + Fitness Park),
   progression avec plateau, mini-deloads, ~300 pesées lean bulk
   ========================================================================== */

function generateDemoData(lib) {
  const findExo = (name) => lib.find(l => l.name === name);
  const pickAvail = (names) => names.map(findExo).filter(Boolean);

  // Programme ON AIR : Upper/Lower orienté barre libre + plate-loaded, 8 exos/séance
  // Chaque séance a un noyau fixe (compounds) + pool d'accessoires qui tournent
  const templateOnAir = [
    {name: 'Upper A · ON AIR',
      core: [
        {name: 'Développé couché barre', baseW: 60, baseReps: 8, sets: 4, rir: 2},
        {name: 'Traction', baseW: 0, baseReps: 8, sets: 3, rir: 1},
        {name: 'Développé militaire', baseW: 35, baseReps: 8, sets: 3, rir: 2},
      ],
      accessoryPool: [
        {name: 'Rowing barre', baseW: 50, baseReps: 10, sets: 3, rir: 2},
        {name: 'Rowing haltère', baseW: 22, baseReps: 10, sets: 3, rir: 2},
        {name: 'Écarté incliné haltères', baseW: 12, baseReps: 12, sets: 3, rir: 1},
        {name: 'Élévation latérale', baseW: 8, baseReps: 12, sets: 4, rir: 1},
        {name: 'Face pull', baseW: 20, baseReps: 15, sets: 3, rir: 1},
        {name: 'Curl barre', baseW: 20, baseReps: 10, sets: 3, rir: 1},
        {name: 'Curl incliné haltères', baseW: 10, baseReps: 12, sets: 3, rir: 1},
        {name: 'Curl marteau', baseW: 12, baseReps: 12, sets: 3, rir: 1},
        {name: 'Extension triceps poulie', baseW: 22, baseReps: 12, sets: 3, rir: 1},
        {name: 'Extension triceps nuque', baseW: 15, baseReps: 12, sets: 3, rir: 1},
        {name: 'Dips', baseW: 0, baseReps: 10, sets: 3, rir: 2}
      ],
      nAccessories: 5
    },
    {name: 'Lower A · ON AIR',
      core: [
        {name: 'Squat libre', baseW: 80, baseReps: 6, sets: 4, rir: 2},
        {name: 'Soulevé de terre roumain', baseW: 75, baseReps: 8, sets: 3, rir: 2},
      ],
      accessoryPool: [
        {name: 'Fentes haltères', baseW: 12, baseReps: 10, sets: 3, rir: 2},
        {name: 'Presse à cuisses', baseW: 130, baseReps: 10, sets: 3, rir: 2},
        {name: 'Leg extension', baseW: 40, baseReps: 12, sets: 3, rir: 1},
        {name: 'Leg curl allongé', baseW: 30, baseReps: 12, sets: 3, rir: 1},
        {name: 'Hip thrust', baseW: 65, baseReps: 10, sets: 3, rir: 2},
        {name: 'Mollets debout', baseW: 55, baseReps: 15, sets: 4, rir: 1},
        {name: 'Mollets assis', baseW: 45, baseReps: 15, sets: 3, rir: 1},
        {name: 'Crunch poulie', baseW: 30, baseReps: 15, sets: 3, rir: 1},
        {name: 'Relevé de jambes suspendu', baseW: 0, baseReps: 12, sets: 3, rir: 1}
      ],
      nAccessories: 5
    },
    {name: 'Upper B · ON AIR',
      core: [
        {name: 'Développé incliné haltères', baseW: 20, baseReps: 10, sets: 4, rir: 2},
        {name: 'Rowing haltère', baseW: 22, baseReps: 10, sets: 4, rir: 2},
        {name: 'Tirage poitrine', baseW: 50, baseReps: 10, sets: 3, rir: 2}
      ],
      accessoryPool: [
        {name: 'Développé couché barre', baseW: 55, baseReps: 10, sets: 3, rir: 2},
        {name: 'Écarté couché haltères', baseW: 12, baseReps: 12, sets: 3, rir: 1},
        {name: 'Élévation latérale', baseW: 8, baseReps: 12, sets: 4, rir: 1},
        {name: 'Oiseau haltères', baseW: 8, baseReps: 12, sets: 3, rir: 1},
        {name: 'Face pull', baseW: 20, baseReps: 15, sets: 3, rir: 1},
        {name: 'Curl barre', baseW: 20, baseReps: 10, sets: 3, rir: 1},
        {name: 'Curl marteau', baseW: 12, baseReps: 12, sets: 3, rir: 1},
        {name: 'Dips', baseW: 0, baseReps: 10, sets: 3, rir: 2},
        {name: 'Extension triceps poulie', baseW: 22, baseReps: 12, sets: 3, rir: 1}
      ],
      nAccessories: 5
    },
    {name: 'Lower B · ON AIR',
      core: [
        {name: 'Soulevé de terre', baseW: 90, baseReps: 5, sets: 3, rir: 2},
        {name: 'Squat libre', baseW: 70, baseReps: 10, sets: 3, rir: 2}
      ],
      accessoryPool: [
        {name: 'Presse à cuisses', baseW: 130, baseReps: 10, sets: 3, rir: 2},
        {name: 'Fentes haltères', baseW: 12, baseReps: 10, sets: 3, rir: 2},
        {name: 'Hip thrust', baseW: 65, baseReps: 10, sets: 3, rir: 2},
        {name: 'Leg curl allongé', baseW: 30, baseReps: 12, sets: 3, rir: 1},
        {name: 'Leg extension', baseW: 40, baseReps: 12, sets: 3, rir: 1},
        {name: 'Mollets debout', baseW: 55, baseReps: 15, sets: 4, rir: 1},
        {name: 'Mollets assis', baseW: 45, baseReps: 15, sets: 3, rir: 1},
        {name: 'Crunch poulie', baseW: 30, baseReps: 15, sets: 3, rir: 1}
      ],
      nAccessories: 5
    }
  ];

  // Programme Fitness Park : plus de machines guidées, mêmes compounds de base
  const templateFP = [
    {name: 'Upper A · FP',
      core: [
        {name: 'Développé couché barre', baseW: 60, baseReps: 8, sets: 4, rir: 2},
        {name: 'Tirage poitrine', baseW: 50, baseReps: 10, sets: 4, rir: 2},
        {name: 'Développé militaire', baseW: 32, baseReps: 10, sets: 3, rir: 2}
      ],
      accessoryPool: [
        {name: 'Rowing haltère', baseW: 20, baseReps: 10, sets: 3, rir: 2},
        {name: 'Écarté couché haltères', baseW: 10, baseReps: 12, sets: 3, rir: 1},
        {name: 'Élévation latérale', baseW: 8, baseReps: 12, sets: 4, rir: 1},
        {name: 'Face pull', baseW: 20, baseReps: 15, sets: 3, rir: 1},
        {name: 'Oiseau haltères', baseW: 7, baseReps: 12, sets: 3, rir: 1},
        {name: 'Curl incliné haltères', baseW: 9, baseReps: 12, sets: 3, rir: 1},
        {name: 'Curl marteau', baseW: 11, baseReps: 12, sets: 3, rir: 1},
        {name: 'Extension triceps poulie', baseW: 22, baseReps: 12, sets: 3, rir: 1},
        {name: 'Extension triceps nuque', baseW: 15, baseReps: 12, sets: 3, rir: 1}
      ],
      nAccessories: 5
    },
    {name: 'Lower A · FP',
      core: [
        {name: 'Presse à cuisses', baseW: 140, baseReps: 10, sets: 4, rir: 2},
        {name: 'Soulevé de terre roumain', baseW: 75, baseReps: 8, sets: 3, rir: 2}
      ],
      accessoryPool: [
        {name: 'Leg extension', baseW: 40, baseReps: 12, sets: 4, rir: 1},
        {name: 'Leg curl allongé', baseW: 30, baseReps: 12, sets: 4, rir: 1},
        {name: 'Hip thrust', baseW: 65, baseReps: 10, sets: 3, rir: 2},
        {name: 'Fentes haltères', baseW: 12, baseReps: 10, sets: 3, rir: 2},
        {name: 'Mollets debout', baseW: 55, baseReps: 15, sets: 4, rir: 1},
        {name: 'Mollets assis', baseW: 45, baseReps: 15, sets: 3, rir: 1},
        {name: 'Crunch poulie', baseW: 30, baseReps: 15, sets: 3, rir: 1},
        {name: 'Relevé de jambes suspendu', baseW: 0, baseReps: 12, sets: 3, rir: 1}
      ],
      nAccessories: 5
    },
    {name: 'Upper B · FP',
      core: [
        {name: 'Développé incliné haltères', baseW: 20, baseReps: 10, sets: 4, rir: 2},
        {name: 'Rowing barre', baseW: 50, baseReps: 10, sets: 4, rir: 2},
        {name: 'Dips', baseW: 0, baseReps: 10, sets: 3, rir: 2}
      ],
      accessoryPool: [
        {name: 'Traction', baseW: 0, baseReps: 8, sets: 3, rir: 1},
        {name: 'Écarté incliné haltères', baseW: 10, baseReps: 12, sets: 3, rir: 1},
        {name: 'Élévation latérale', baseW: 8, baseReps: 12, sets: 4, rir: 1},
        {name: 'Face pull', baseW: 20, baseReps: 15, sets: 3, rir: 1},
        {name: 'Curl barre', baseW: 20, baseReps: 10, sets: 3, rir: 1},
        {name: 'Curl marteau', baseW: 11, baseReps: 12, sets: 3, rir: 1},
        {name: 'Extension triceps poulie', baseW: 22, baseReps: 12, sets: 3, rir: 1}
      ],
      nAccessories: 5
    },
    {name: 'Lower B · FP',
      core: [
        {name: 'Squat libre', baseW: 80, baseReps: 6, sets: 4, rir: 2},
        {name: 'Hip thrust', baseW: 70, baseReps: 10, sets: 3, rir: 2}
      ],
      accessoryPool: [
        {name: 'Leg curl allongé', baseW: 30, baseReps: 12, sets: 3, rir: 1},
        {name: 'Leg extension', baseW: 40, baseReps: 12, sets: 3, rir: 1},
        {name: 'Fentes haltères', baseW: 12, baseReps: 10, sets: 3, rir: 2},
        {name: 'Presse à cuisses', baseW: 130, baseReps: 10, sets: 3, rir: 2},
        {name: 'Mollets debout', baseW: 55, baseReps: 15, sets: 4, rir: 1},
        {name: 'Mollets assis', baseW: 45, baseReps: 15, sets: 3, rir: 1},
        {name: 'Crunch poulie', baseW: 30, baseReps: 15, sets: 3, rir: 1}
      ],
      nAccessories: 5
    }
  ];

  // Rotation pseudo-aléatoire déterministe des accessoires par semaine
  const pickAccessories = (pool, n, weekSeed, sessionIdx) => {
    // Rotation basée sur la semaine + sessionIdx pour avoir une variété prévisible
    const out = [];
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const idx = (weekSeed * 7 + sessionIdx * 3 + i * 11) % pool.length;
      let realIdx = idx;
      let tries = 0;
      while (used.has(realIdx) && tries < pool.length) {
        realIdx = (realIdx + 1) % pool.length;
        tries++;
      }
      used.add(realIdx);
      out.push(pool[realIdx]);
    }
    return out;
  };

  // Construction des 2 programmes (snapshot à t0 avec accessoires de la semaine 0)
  const buildProgram = (id, name, template) => ({
    id, name, level: 'intermediaire', frequency: 4,
    muscleStatus: {
      Pectoraux:'progression', Dos:'progression', Quadriceps:'progression', Ischios:'progression',
      Épaules:'focus', Biceps:'progression', Triceps:'maintenance',
      Fessiers:'maintenance', Mollets:'maintenance', Adducteurs:'maintenance', Abdos:'maintenance'
    },
    priorities:[],
    sessions: template.map((s, si) => {
      const accessories = pickAccessories(s.accessoryPool, s.nAccessories, 0, si);
      const allExos = [...s.core, ...accessories];
      return {
        id: id + '-sess-' + si,
        name: s.name,
        exercises: allExos.map((ex, ei) => {
          const libEx = findExo(ex.name);
          if (!libEx) return null;
          return {
            id: id + '-ex-' + si + '-' + ei,
            sets: ex.sets,
            muscleGroup: libEx.muscleGroup,
            subGroup: libEx.subGroup || null,
            isCompound: libEx.compound,
            choices: [{exId: libEx.id, weight:'', machine:'', muscleGroup: libEx.muscleGroup, subGroup: libEx.subGroup || null}],
            repRange: libEx.compound ? [5,8] : [8,12],
            targetWeight: ex.baseW,
            targetSets: ex.sets,
            history: []
          };
        }).filter(Boolean)
      };
    }),
    createdAt: Date.now() - 365 * 86400000,
    auto: true,
    volumeTargets: { program: {}, subGroups: {}, sessions: {} }
  });

  const progOnAir = buildProgram('seed-prog-onair', 'Lean bulk · ON AIR', templateOnAir);
  const progFP = buildProgram('seed-prog-fp', 'Lean bulk · Fitness Park', templateFP);

  // 1 an = 52 semaines, alternance par bloc de 8 semaines
  const today = new Date();
  const WEEKS = 52;
  const journalLogs = [];
  const dayOffsets = [1, 3, 5, 6]; // Lun/Mer/Ven/Sam

  // Progression non-linéaire réaliste
  const progressionCurve = (w) => {
    if (w < 12) return w * 1.1;
    if (w < 24) return 13 + (w - 12) * 0.65;
    if (w === 26) return 20;
    if (w < 32) return 20 + (w - 24) * 0.3;
    if (w === 38) return 22;
    if (w < 44) return 22 + (w - 32) * 0.25;
    return 24 + (w - 44) * 0.15;
  };

  // Progression par exo : les exos font leur propre progression (compounds vite, accessoires lents)
  // On tracke la "vraie" progression par exo pour simuler une surcharge
  const exoProgressMap = {}; // name → kg accumulés sur l'année

  for (let w = 0; w < WEEKS; w++) {
    const useFP = Math.floor(w / 8) % 2 === 1;
    const template = useFP ? templateFP : templateOnAir;
    const program = useFP ? progFP : progOnAir;
    const progressionKg = progressionCurve(w);

    const mondayOfWeek = new Date(today);
    const dow = (today.getDay() + 6) % 7;
    mondayOfWeek.setDate(today.getDate() - dow - (WEEKS - 1 - w) * 7);

    template.forEach((sessTpl, si) => {
      if (Math.random() < 0.05) return; // 5% de skip (maladie, imprévu)
      const sessDate = new Date(mondayOfWeek);
      sessDate.setDate(mondayOfWeek.getDate() + dayOffsets[si]);
      if (sessDate > today) return;

      // Accessoires de la semaine : rotation pseudo-aléatoire
      const accessories = pickAccessories(sessTpl.accessoryPool, sessTpl.nAccessories, w, si);
      const allExos = [...sessTpl.core, ...accessories];

      const exercises = allExos.map((ex, ei) => {
        const libEx = findExo(ex.name);
        if (!libEx) return null;
        // Progression par exo : compounds gagnent plus vite que accessoires
        const progStep = libEx.compound ? progressionKg * 0.85 : progressionKg * 0.4;
        const curW = Math.max(0, ex.baseW + progStep);
        const repsNoise = (w + si + ei) % 4 === 0 ? 1 : (w + si) % 7 === 0 ? -1 : 0;
        const sets = [];
        for (let setI = 0; setI < ex.sets; setI++) {
          const setFatigue = setI > 0 && Math.random() < 0.35 ? -1 : 0;
          const weightPlate = Math.round(curW * 2) / 2;
          const reps = Math.max(1, ex.baseReps + repsNoise + setFatigue);
          sets.push({
            weight: String(weightPlate),
            reps: String(reps),
            rir: String(ex.rir),
            _confirmed: true
          });
        }
        return {
          id: 'seed-ex-' + w + '-' + si + '-' + ei,
          exId: libEx.id,
          exName: libEx.name,
          muscleGroup: libEx.muscleGroup,
          subGroup: libEx.subGroup || null,
          isCompound: libEx.compound,
          sets
        };
      }).filter(Boolean);

      journalLogs.push({
        id: 'seed-log-' + w + '-' + si,
        sessionId: program.sessions[si]?.id || ('seed-sess-' + si),
        programId: program.id,
        sessionName: sessTpl.name,
        programName: program.name,
        date: iso(sessDate),
        startedAt: sessDate.getTime(),
        endedAt: sessDate.getTime() + (70 + Math.floor(Math.random()*15)) * 60 * 1000,
        exercises
      });
    });
  }

  // Pesées : 365 jours, courbe lean bulk multi-phase
  const weights = [];
  for (let d = 364; d >= 0; d--) {
    const day = new Date(today);
    day.setDate(today.getDate() - d);
    if (Math.random() < 0.25) continue;
    const dayFromStart = 364 - d;
    let trend;
    if (dayFromStart < 60) trend = 62 + (dayFromStart / 60) * 2;
    else if (dayFromStart < 120) trend = 64 - ((dayFromStart - 60) / 60) * 1.5;
    else if (dayFromStart < 240) trend = 62.5 + ((dayFromStart - 120) / 120) * 3;
    else if (dayFromStart < 300) trend = 65.5 - ((dayFromStart - 240) / 60) * 1.5;
    else trend = 64 + ((dayFromStart - 300) / 65) * 1;
    const noise = (Math.random() - 0.5) * 0.8;
    const kg = Math.round((trend + noise) * 10) / 10;
    weights.push({
      id: 'seed-weight-' + d,
      date: iso(day),
      weight: kg
    });
  }

  return { programs: [progOnAir, progFP], journalLogs, weights };
}



/* ==========================================================================
   APP ROOT
   ========================================================================== */

function App() {
  // Core state, persisted in localStorage with mylift_ prefix
  const [tab, setTab] = useState(() => LS.get('tab', 'dashboard'));
  const [programs, setPrograms] = useState(() => LS.get('programs', []));
  const [currentProgramId, setCurrentProgramId] = useState(() => LS.get('currentProgramId', null));
  const [exerciseLib, setExerciseLib] = useState(() => LS.get('exerciseLib', SEED_LIB));
  const [weights, setWeights] = useState(() => LS.get('weights', []));
  const [journalLogs, setJournalLogs] = useState(() => LS.get('journalLogs', []));
  const [muscleGroups, setMuscleGroups] = useState(() => LS.get('muscleGroups', MUSCLE_GROUPS_DEFAULT));
  const [subGroups, setSubGroups] = useState(() => LS.get('subGroups', SUB_GROUPS_DEFAULT));
  const [activeSession, setActiveSession] = useState(() => LS.get('active_session', null));

  // Persist on change
  useEffect(() => LS.set('tab', tab), [tab]);
  useEffect(() => LS.set('programs', programs), [programs]);
  useEffect(() => LS.set('currentProgramId', currentProgramId), [currentProgramId]);
  useEffect(() => LS.set('exerciseLib', exerciseLib), [exerciseLib]);
  useEffect(() => LS.set('weights', weights), [weights]);
  useEffect(() => LS.set('journalLogs', journalLogs), [journalLogs]);
  useEffect(() => LS.set('muscleGroups', muscleGroups), [muscleGroups]);
  useEffect(() => LS.set('subGroups', subGroups), [subGroups]);

  // Migration one-shot : Lombaires était un groupe musculaire, maintenant sous-groupe de Dos
  // Au 1er chargement d'une version avec cette logique, on migre proprement :
  // 1) retirer "Lombaires" de muscleGroups, 2) l'ajouter aux sub-groupes de Dos, 3) reclasser les exos
  useEffect(() => {
    if (LS.get('migration_lombaires_v1', false)) return;
    let changed = false;

    // 1) retirer Lombaires des muscleGroups
    if (muscleGroups.includes('Lombaires')) {
      setMuscleGroups(muscleGroups.filter(g => g !== 'Lombaires'));
      changed = true;
    }

    // 2) ajouter Lombaires aux sous-groupes de Dos s'il n'y est pas
    const dosSubs = (subGroups && subGroups.Dos) || [];
    if (!dosSubs.includes('Lombaires')) {
      setSubGroups({...subGroups, Dos: [...dosSubs, 'Lombaires']});
      changed = true;
    }

    // 3) reclasser les exos qui étaient sur muscleGroup="Lombaires"
    const hasLombExos = exerciseLib.some(l => l.muscleGroup === 'Lombaires');
    if (hasLombExos) {
      setExerciseLib(exerciseLib.map(l =>
        l.muscleGroup === 'Lombaires' ? {...l, muscleGroup: 'Dos', subGroup: 'Lombaires'} : l
      ));
      changed = true;
    }

    // 4) nettoyer les cibles éventuelles sur "Lombaires" dans les programmes existants
    const needsProgClean = programs.some(p =>
      (p.volumeTargets?.program?.Lombaires !== undefined) ||
      (p.muscleStatus?.Lombaires !== undefined)
    );
    if (needsProgClean) {
      setPrograms(programs.map(p => {
        const np = {...p};
        if (np.volumeTargets?.program?.Lombaires !== undefined) {
          const {Lombaires, ...rest} = np.volumeTargets.program;
          np.volumeTargets = {...np.volumeTargets, program: rest};
        }
        if (np.muscleStatus?.Lombaires !== undefined) {
          const {Lombaires, ...rest} = np.muscleStatus;
          np.muscleStatus = rest;
        }
        return np;
      }));
      changed = true;
    }

    LS.set('migration_lombaires_v1', true);
    if (changed) console.log('[MyLift] Migration Lombaires → sous-groupe Dos effectuée.');
  }, []); // run once au mount

  // Migration one-shot : les pesées seed avaient `kg` au lieu de `weight`
  useEffect(() => {
    if (LS.get('migration_seed_weight_key_v1', false)) return;
    const brokenSeedWeights = weights.filter(w => w.id && w.id.startsWith('seed-weight-') && w.kg !== undefined && w.weight === undefined);
    if (brokenSeedWeights.length) {
      // Réécriture : convertit kg → weight
      setWeights(weights.map(w => {
        if (w.id && w.id.startsWith('seed-weight-') && w.kg !== undefined && w.weight === undefined) {
          return { ...w, weight: w.kg, kg: undefined };
        }
        return w;
      }));
      console.log('[MyLift] Migration: ' + brokenSeedWeights.length + ' pesées seed réparées (kg → weight).');
    }
    LS.set('migration_seed_weight_key_v1', true);
  }, []);

  // Migration one-shot : normalisation des noms d'exos Pectoraux (2026-04-20)
  // Avant : "CHEST PRESS INCLINE", "DC plat smith", "Fly poulie", etc.
  // Après : "Développé incliné machine", "Développé couché à la Smith", "Écarté poulie", etc.
  // On patch exerciseLib + tous les références dans programs + journalLogs + activeSession
  useEffect(() => {
    if (LS.get('migration_pec_rename_v1', false)) return;

    // Mapping ancien nom → nouveau nom (pour détecter les anciens seeds)
    const RENAME_MAP = {
      'Développé couché barre incliné': 'Développé incliné barre',
      'Développé couché haltères incliné': 'Développé incliné haltères',
      'CHEST PRESS INCLINE': 'Développé incliné machine',
      'CHEST PRESS FLAT': 'Développé couché machine',
      'CHEST PRESS DECLINE': 'Développé décliné machine',
      'Incline smith': 'Développé incliné à la Smith',
      'DC plat smith': 'Développé couché à la Smith',
      'Peck fly': 'Peck deck',
      'Peck fly décliné': 'Peck deck décliné',
      'Fly poulie': 'Écarté poulie',
      'Fly poulie haut': 'Écarté poulie haut',
      'Fly poulie bas': 'Écarté poulie bas'
    };
    // Mapping des IDs correspondants (pour mise à jour des refs dans programs/logs)
    const slug = (n) => 'seed-' + n.toLowerCase().replace(/[^a-z0-9]/g,'-');
    const ID_MAP = {};
    Object.entries(RENAME_MAP).forEach(([oldName, newName]) => {
      ID_MAP[slug(oldName)] = { newId: slug(newName), newName };
    });

    // 1) Patch exerciseLib
    let libChanged = false;
    const newLib = exerciseLib.map(ex => {
      const mig = ID_MAP[ex.id];
      if (mig) {
        libChanged = true;
        return { ...ex, id: mig.newId, name: mig.newName };
      }
      // Si c'est un exo custom avec exactement un ancien nom (peu probable mais safe)
      if (RENAME_MAP[ex.name]) {
        libChanged = true;
        return { ...ex, name: RENAME_MAP[ex.name] };
      }
      return ex;
    });
    if (libChanged) setExerciseLib(newLib);

    // 2) Patch programs (choices dans les exercises)
    let progsChanged = false;
    const newProgs = programs.map(prog => {
      const sessions = (prog.sessions || []).map(sess => {
        const exercises = (sess.exercises || []).map(pex => {
          const choices = (pex.choices || []).map(c => {
            if (c.exId && ID_MAP[c.exId]) {
              progsChanged = true;
              return { ...c, exId: ID_MAP[c.exId].newId };
            }
            return c;
          });
          return { ...pex, choices };
        });
        return { ...sess, exercises };
      });
      return { ...prog, sessions };
    });
    if (progsChanged) setPrograms(newProgs);

    // 3) Patch journalLogs (exId + exName dans chaque exo loggué)
    let logsChanged = false;
    const newLogs = journalLogs.map(log => {
      const exercises = (log.exercises || []).map(e => {
        let patched = e;
        if (e.exId && ID_MAP[e.exId]) {
          patched = { ...patched, exId: ID_MAP[e.exId].newId, exName: ID_MAP[e.exId].newName };
          logsChanged = true;
        } else if (e.exName && RENAME_MAP[e.exName]) {
          patched = { ...patched, exName: RENAME_MAP[e.exName] };
          logsChanged = true;
        }
        return patched;
      });
      return { ...log, exercises };
    });
    if (logsChanged) setJournalLogs(newLogs);

    // 4) Patch activeSession si présente
    if (activeSession && activeSession.exercises) {
      let asChanged = false;
      const exercises = activeSession.exercises.map(e => {
        let patched = e;
        if (e.exId && ID_MAP[e.exId]) {
          patched = { ...patched, exId: ID_MAP[e.exId].newId, exName: ID_MAP[e.exId].newName };
          asChanged = true;
        } else if (e.exName && RENAME_MAP[e.exName]) {
          patched = { ...patched, exName: RENAME_MAP[e.exName] };
          asChanged = true;
        }
        // Patch aussi les variantes planifiées
        if (patched.variants && patched.variants.length) {
          const variants = patched.variants.map(v => {
            if (v.exId && ID_MAP[v.exId]) {
              asChanged = true;
              return { ...v, exId: ID_MAP[v.exId].newId, name: ID_MAP[v.exId].newName };
            }
            if (v.name && RENAME_MAP[v.name]) {
              asChanged = true;
              return { ...v, name: RENAME_MAP[v.name] };
            }
            return v;
          });
          patched = { ...patched, variants };
        }
        return patched;
      });
      if (asChanged) setActiveSession({ ...activeSession, exercises });
    }

    LS.set('migration_pec_rename_v1', true);
    if (libChanged || progsChanged || logsChanged) {
      console.log('[MyLift] Migration: noms pectoraux normalisés.');
    }
  }, []); // one-shot au mount

  useEffect(() => LS.set('active_session', activeSession), [activeSession]);

  // Ensure current program id validity
  useEffect(() => {
    if (programs.length === 0) { if (currentProgramId) setCurrentProgramId(null); return; }
    if (!programs.find(p => p.id === currentProgramId)) setCurrentProgramId(programs[0].id);
  }, [programs, currentProgramId]);

  const currentProgram = programs.find(p => p.id === currentProgramId) || null;

  const updateCurrentProgram = (mutator) => {
    setPrograms(prev => prev.map(p => {
      if (p.id !== currentProgramId) return p;
      const copy = JSON.parse(JSON.stringify(p));
      mutator(copy);
      return copy;
    }));
  };

  // Guard de navigation global : n'importe quel composant peut poser une fonction
  // dans navGuardRef.current qui intercepte les changements de tab (principal et sub-tabs)
  const navGuardRef = useRef(null);
  const setTabGuarded = (newTab) => {
    // iOS-standard: tapping the already-active tab scrolls to top of that tab.
    // This is a conscious user action (same target, second tap), not a passive reset.
    if (newTab === tab) {
      if (typeof window !== 'undefined') {
        window.scrollTo({top:0, left:0, behavior:'smooth'});
      }
      return;
    }
    if (navGuardRef.current) {
      const ok = navGuardRef.current(() => setTab(newTab));
      if (ok === false) return; // bloqué, le guard gère son propre UI
    }
    setTab(newTab);
  };

  const state = {
    tab, setTab: setTabGuarded,
    navGuardRef,
    programs, setPrograms,
    currentProgramId, setCurrentProgramId,
    currentProgram, updateCurrentProgram,
    exerciseLib, setExerciseLib,
    weights, setWeights,
    journalLogs, setJournalLogs,
    muscleGroups, setMuscleGroups,
    subGroups, setSubGroups,
    activeSession, setActiveSession
  };

  // No programs -> onboarding in params
  const showParams = programs.length === 0 || tab === 'params';
  const activeTab = programs.length === 0 ? 'params' : tab;

  return h('div', {className:'app'},
    // Note: pas de StatusBarSpacer — le padding-top de .app-body gère déjà var(--sa-t).
    // Header persistant "Séance en cours" : visible sur tous les onglets sauf Journal
    // Animation d'entrée légère (slideDown + fade) quand il apparaît/disparaît
    activeSession && activeTab !== 'journal' && h('button', {
      className:'press-row',
      onClick:()=>setTabGuarded('journal'),
      style:{
        position:'sticky', top:'var(--sa-t)', zIndex:50,
        display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,
        padding:'10px 14px',
        background:'linear-gradient(180deg, var(--accent) 0%, var(--accent-lo) 100%)',
        color:'#fff',
        width:'100%', maxWidth:540, margin:'0 auto',
        borderBottomLeftRadius:14, borderBottomRightRadius:14,
        boxShadow:'0 6px 20px -6px rgba(252,76,2,.6)',
        textAlign:'left',
        animation:'mv-sticky-in 320ms var(--ease-out-std)'
      }
    },
      h('div', {style:{display:'flex',alignItems:'center',gap:10}},
        h('span', {style:{
          display:'inline-block',width:8,height:8,borderRadius:'50%',background:'#fff',
          boxShadow:'0 0 0 0 rgba(255,255,255,.6)',
          animation:'pulse-dot 1.4s ease-in-out infinite'
        }}),
        h('div', null,
          h('div', {style:{fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',opacity:.9}},
            'Séance en cours · ', h(SessionElapsed, {startedAt: activeSession.startedAt})),
          h('div', {style:{fontSize:14,fontWeight:700,marginTop:1}}, activeSession.sessionName || 'Séance'))
      ),
      h('span', {style:{fontSize:13,fontWeight:800}}, 'Reprendre →')
    ),
    // Lightweight view transition without remounting content (preserves local state like
    // expandedMonths, detailLog, etc.). We toggle a class .mv-view-tick on a static wrapper
    // that re-runs the enter animation each time `activeTab` changes. See mv-view-enter keyframes.
    h(ViewContainer, {activeTab},
      activeTab === 'dashboard' && h(Dashboard, {state}),
      activeTab === 'journal' && h(Journal, {state}),
      activeTab === 'progression' && h(Progression, {state}),
      activeTab === 'pesee' && h(Pesee, {state}),
      activeTab === 'params' && h(Params, {state})
    ),
    h(TabBar, {tab: activeTab, onTab: setTabGuarded})
  );
}

// (ReactDOM render removed — handled by default export)


/**
 * InstallGate — onboarding qui force l'installation PWA à la première visite.
 *
 * Comportement :
 *  - Détecte si l'app tourne déjà en mode standalone (PWA installée) → ne rend rien
 *  - Sinon, affiche un écran plein écran avec instructions adaptées à la plateforme :
 *    - iOS Safari : tutoriel visuel "Partager → Ajouter à l'écran d'accueil"
 *    - Android Chrome : bouton "Installer" qui déclenche beforeinstallprompt
 *    - Autres : message générique avec instructions
 *  - Bypass possible via "Continuer dans le navigateur" (stocké dans LS pour ne plus redemander)
 *  - Si l'user a bypassé puis réinstalle, on détecte et on bascule automatiquement
 */
function InstallGate({children}) {
  const isStandalone = () => {
    if (typeof window === 'undefined') return false;
    // iOS Safari (PWA homescreen)
    if (window.navigator.standalone === true) return true;
    // Android Chrome / desktop browsers (PWA installed)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    return false;
  };

  const detectPlatform = () => {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua);
    return { isIOS, isAndroid, isSafari, isChrome, ua };
  };

  const [installed, setInstalled] = useState(isStandalone);
  const [bypassed, setBypassed] = useState(() => {
    try { return localStorage.getItem('install_bypassed') === '1'; } catch { return false; }
  });
  const [installEvent, setInstallEvent] = useState(null);
  const platform = detectPlatform();

  // Détecter dynamiquement si l'app passe en standalone (l'user vient d'installer)
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const onChange = () => setInstalled(isStandalone());
    if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
    // Capturer beforeinstallprompt pour Android/Chrome
    const onBIP = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', onBIP);
    return () => {
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange);
      window.removeEventListener('beforeinstallprompt', onBIP);
    };
  }, []);

  const triggerInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      // L'app va se relancer en standalone, le matchMedia listener s'en chargera
    }
  };

  const bypass = () => {
    try { localStorage.setItem('install_bypassed', '1'); } catch {}
    setBypassed(true);
  };

  // App déjà installée OU user a bypass → rendre l'app normale
  if (installed || bypassed) return children;

  // Sinon : écran d'onboarding plein écran
  const SHARE_ICON = React.createElement('svg', {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
  },
    React.createElement('path', {d: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8'}),
    React.createElement('polyline', {points: '16 6 12 2 8 6'}),
    React.createElement('line', {x1: 12, y1: 2, x2: 12, y2: 15})
  );

  const PLUS_BOX = React.createElement('svg', {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'
  },
    React.createElement('rect', {x: 3, y: 3, width: 18, height: 18, rx: 4}),
    React.createElement('line', {x1: 12, y1: 8, x2: 12, y2: 16}),
    React.createElement('line', {x1: 8, y1: 12, x2: 16, y2: 12})
  );

  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #050509 0%, #1a0a04 100%)',
      color: '#E9E9F2',
      display: 'flex', flexDirection: 'column',
      padding: 'env(safe-area-inset-top, 24px) 24px env(safe-area-inset-bottom, 24px)',
      zIndex: 99999, overflow: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
    }
  },
    // Logo / icône
    React.createElement('div', {style: {textAlign: 'center', marginTop: 32, marginBottom: 24}},
      React.createElement('img', {
        src: 'icon-192.png',
        alt: 'MyLift',
        style: {
          width: 96, height: 96, borderRadius: 22,
          boxShadow: '0 12px 40px rgba(252, 76, 2, 0.4)'
        }
      })
    ),

    // Titre
    React.createElement('h1', {style: {
      fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em',
      textAlign: 'center', margin: '0 0 8px 0',
      background: 'linear-gradient(180deg, #FFC233 0%, #FC4C02 100%)',
      WebkitBackgroundClip: 'text', backgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    }}, 'Installer MyLift'),

    React.createElement('p', {style: {
      fontSize: 14, color: '#9CA0B5', textAlign: 'center',
      margin: '0 0 32px 0', lineHeight: 1.5, padding: '0 16px'
    }}, 'Pour profiter pleinement de MyLift en salle (offline, plein écran, sur ton home screen), installe l\'app maintenant.'),

    // Instructions plateforme-spécifiques
    platform.isIOS && platform.isSafari && React.createElement('div', {
      style: {
        background: 'rgba(252, 76, 2, 0.08)',
        border: '1px solid rgba(252, 76, 2, 0.25)',
        borderRadius: 16, padding: 20, marginBottom: 16
      }
    },
      React.createElement('div', {style: {fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#FC4C02', marginBottom: 14, textTransform: 'uppercase'}}, 'iPhone — 3 étapes'),
      // Étape 1
      React.createElement('div', {style: {display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start'}},
        React.createElement('div', {style: {
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(252, 76, 2, 0.15)',
          color: '#FC4C02', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, flex: '0 0 auto'
        }}, '1'),
        React.createElement('div', {style: {flex: 1, paddingTop: 2}},
          React.createElement('div', {style: {fontSize: 14, fontWeight: 600, marginBottom: 4}}, 'Tape sur l\'icône Partager'),
          React.createElement('div', {style: {
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', borderRadius: 8,
            padding: '6px 10px', fontSize: 12, color: '#C8CADD'
          }},
            React.createElement('span', {style: {color: '#FC4C02', display: 'inline-flex'}}, SHARE_ICON),
            React.createElement('span', null, 'en bas de Safari')
          )
        )
      ),
      // Étape 2
      React.createElement('div', {style: {display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start'}},
        React.createElement('div', {style: {
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(252, 76, 2, 0.15)',
          color: '#FC4C02', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, flex: '0 0 auto'
        }}, '2'),
        React.createElement('div', {style: {flex: 1, paddingTop: 2}},
          React.createElement('div', {style: {fontSize: 14, fontWeight: 600, marginBottom: 4}}, 'Choisis « Sur l\'écran d\'accueil »'),
          React.createElement('div', {style: {
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', borderRadius: 8,
            padding: '6px 10px', fontSize: 12, color: '#C8CADD'
          }},
            React.createElement('span', {style: {color: '#FC4C02', display: 'inline-flex'}}, PLUS_BOX),
            React.createElement('span', null, 'fais défiler si besoin')
          )
        )
      ),
      // Étape 3
      React.createElement('div', {style: {display: 'flex', gap: 14, alignItems: 'flex-start'}},
        React.createElement('div', {style: {
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(252, 76, 2, 0.15)',
          color: '#FC4C02', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, flex: '0 0 auto'
        }}, '3'),
        React.createElement('div', {style: {flex: 1, paddingTop: 2}},
          React.createElement('div', {style: {fontSize: 14, fontWeight: 600, marginBottom: 4}}, 'Lance MyLift depuis l\'icône'),
          React.createElement('div', {style: {fontSize: 12, color: '#9CA0B5'}}, 'L\'icône haltère orange apparaît sur ton écran d\'accueil')
        )
      )
    ),

    // Android Chrome — bouton install natif si dispo
    platform.isAndroid && installEvent && React.createElement('button', {
      onClick: triggerInstall,
      style: {
        background: '#FC4C02', color: '#fff', border: 'none',
        borderRadius: 14, padding: '16px 24px',
        fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em',
        marginBottom: 16, cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(252, 76, 2, 0.35)'
      }
    }, 'Installer maintenant'),

    // Android Chrome sans event capturé (rare) — instructions manuelles
    platform.isAndroid && !installEvent && React.createElement('div', {
      style: {
        background: 'rgba(252, 76, 2, 0.08)',
        border: '1px solid rgba(252, 76, 2, 0.25)',
        borderRadius: 16, padding: 20, marginBottom: 16
      }
    },
      React.createElement('div', {style: {fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#FC4C02', marginBottom: 12, textTransform: 'uppercase'}}, 'Android Chrome'),
      React.createElement('div', {style: {fontSize: 14, lineHeight: 1.6}},
        'Menu Chrome (3 points en haut à droite) → ',
        React.createElement('strong', null, 'Ajouter à l\'écran d\'accueil')
      )
    ),

    // Cas générique (desktop, autres navigateurs)
    !platform.isIOS && !platform.isAndroid && React.createElement('div', {
      style: {
        background: 'rgba(252, 76, 2, 0.08)',
        border: '1px solid rgba(252, 76, 2, 0.25)',
        borderRadius: 16, padding: 20, marginBottom: 16
      }
    },
      React.createElement('div', {style: {fontSize: 14, lineHeight: 1.6}},
        'MyLift est conçu pour mobile. Ouvre cette page sur ton iPhone (Safari) ou Android (Chrome) pour l\'installer comme une app.'
      )
    ),

    // Spacer
    React.createElement('div', {style: {flex: 1, minHeight: 16}}),

    // Bypass (caché un peu, pour pas inciter)
    React.createElement('button', {
      onClick: bypass,
      style: {
        background: 'transparent', border: 'none',
        color: '#5D6077', fontSize: 12, padding: 12,
        cursor: 'pointer', textAlign: 'center'
      }
    }, 'Continuer dans le navigateur')
  );
}

function MyLiftRoot() {
  useEffect(() => {
    const id = "mylift-inline-styles";
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = MYLIFT_CSS;
    document.head.appendChild(el);
  }, []);
  return React.createElement(InstallGate, null, React.createElement(App));
}

// mounted



ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MyLiftRoot));
