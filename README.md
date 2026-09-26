# Danis.Shooter v18 — Motion-Rich Lightweight Indie Build

V18 keeps the campaign visible and adds a lightweight motion language across menu, progression, HUD and interactions.

## Highlights
- BAB 1–5 campaign tabs and level renderer remain data-driven and guarded.
- Compact numbers for KP, XP, kills, level, badges and items: `1K`, `1,2M`, `1B`, `1T`, `1QD`, `1QT`, `1SX`, `1SP`, etc.
- Global Champion #1 uses the same compact notation.
- Motion-rich UI built primarily from transform/opacity for lower GPU cost.
- Desktop and mobile layouts tested at 1440×900 and 390×844.
- Reduced-motion support retained.
- No preview/test artifacts are included in the release package.

## v19 — Campaign Runtime Repair

- Campaign rendering no longer depends on the multiplayer module's `esc()` helper.
- Account username is the single player identity; the old second-name gate no longer blocks campaign access.
- Campaign renderer has a visible fallback instead of silently rendering an empty level area.
- Chapter 1–5 tabs and campaign cards are exercised at desktop and mobile viewport sizes.
- Compact number formatting is shared across KP/XP and Global/Multiplayer counters.
- Menu atmosphere particles are paused/hidden outside the menu to reduce runtime work and prevent visual leakage.
- Campaign surfaces use one dark material language.

## v20 — Gameplay Lifecycle Hardening
- Victory state now freezes the gameplay loop while the result modal is open.
- `LANJUT` advances to the next already-unlocked campaign mission; otherwise it returns to campaign selection.
- `PILIH TINGKAT` always returns to campaign selection.
- Challenge/Endless victories do not incorrectly auto-advance into campaign missions.
- Pause/resume state now uses an explicit `pauseReason` declaration and was runtime-tested on desktop and mobile.
- Pause freezes elapsed gameplay time and resume restores active gameplay.


## v21 — ENGINEERED ART DIRECTION
- Reworked player, enemy, and boss sprite construction around a consistent spacecraft/mechanical language.
- Player craft now uses fuselage, cockpit canopy, reactor, nacelles, and sparse panel lines.
- Enemy silhouettes use chassis profiles, sensor slits, and weapon hardpoints instead of cartoon eyes.
- Bosses have six distinct industrial silhouettes with command bridge/reactor/hardpoint language.
- Early campaign themes moved from pastel surfaces to dark technical arenas with restrained accent colors.
- Boss and enemy spawn clearance now respects the HUD safe area.
- Transition engine uses deterministic requestAnimationFrame phases with a safety deadline to prevent a stuck OUT phase.
- Browser regression pass: desktop 1440x900, laptop 1280x720, mobile 390x844, small mobile 360x800.


## v22 — Library Experiment / Engine Layer

- GSAP 3.15.0 is an optional animation layer for screen-entry and victory choreography; native CSS remains the fallback.
- Howler 2.2.4 is an optional SFX sprite layer using `audio/danis-sfx.wav`; the existing Web Audio synth remains the fallback.
- PixiJS 8.21.0 is loaded lazily when gameplay starts and, when available on a capable device, accelerates eligible particle FX through a transparent GPU canvas. Low-end devices keep the native particle renderer.
- `library-loader.js` is intentionally asynchronous and failure-tolerant: a CDN outage must not prevent the game from booting.
- The sandbox used for this build could not fetch external CDN packages, so the native fallback path was statically/syntactically verified; external-library execution must be verified in a normal browser with network access.


## v23 — Engineered visual consistency
- Unified gameplay, shop, pause and pet visual language around the command-center palette.
- Reworked pets into compact hardware/drone silhouettes with role accents, sensor slit and reactor details.
- Added restrained orbital particles around player and pets using the active level theme.
- Reworked shop preview from legacy sky/cream styling to the same dark technical showroom language.
- Reworked pause modal to match the game shell instead of the legacy white card.


## v24 — Combat readability & lightweight effects
- Default `square` shape now renders as an actual square technical frame, matching the item identity.
- Pet chassis now shares the same square hardware language as player/enemy assets.
- HUD, pause, shop, and pet surfaces share one dark command-center material.
- Gameplay reserves adaptive top/bottom safe bands so HUD does not hide enemies on desktop/mobile.
- Projectile trails remain lightweight cached Canvas strokes; no per-particle DOM.
- Multiplayer remote-player placement and synced numeric stats are sanitized and kept inside the safe gameplay band.


## v26 — Engineered Combat / Hangar Pass
- Player silhouettes redesigned as top-down fighter jets with nose, swept wings, cockpit, twin nacelles and tailplane.
- Hangar preview is now an effect-driven live loadout bay with orbiting telemetry, exhaust, weapon test fire and drone orbit.
- Campaign dialogue rewritten into shorter radio-comms style.
- Combo HUD moved to the visual center of the combat field and made transient/readable.
- Multiplayer now syncs normalized `posY` as well as `posX`, with client-side interpolation and safe-area clamping.
- Multiplayer combat counters are normalized to finite non-negative integers before writes.
- All effects retain hard particle caps and low-end budgets.
- GSAP/Howler/Pixi remain optional enhancement layers with native fallbacks. External CDN execution could not be browser-verified in the isolated build environment.


## v26 — Multiplayer Command Bay
- Multiplayer entry screen redesigned from a vertical form into a responsive command bay.
- Desktop uses a 3-card action deck; tablet uses 2+1; mobile collapses to one-column without losing hierarchy.
- Create / Join / Global actions keep their existing DOM IDs and multiplayer logic.
- Public room directory uses a compact grid; invitations have their own incoming panel.
- Pet/drone chassis now use seven distinct silhouette families instead of one repeated rectangular chassis.
- No new runtime dependency was added for this pass: CSS Grid and cached Canvas sprites keep the change lightweight.
- Existing GSAP / Howler / PixiJS experiments remain optional through the library lab and native fallbacks.
## V27 — Adaptive Menu + Level Atmosphere
- Menu utama sekarang viewport-fit: tidak memakai page scroll dan seluruh blok utama tetap terlihat pada desktop/mobile.
- Layout memakai CSS Grid adaptif; parent mengikuti ruang child yang tersedia dengan ukuran/gap responsif berdasarkan lebar dan tinggi viewport.
- Toko tetap menjadi content browser yang boleh scroll karena item memang katalog.
- Background gameplay kini punya identitas visual per level: warna, pola, vignette, arah partikel, dan intensitas meningkat dari Tutorial sampai Final Collapse.
- `levelScreen` memiliki struktur HTML yang dibersihkan dari duplicate opener.
- V27 tetap tanpa library runtime baru; fokus pada CSS/canvas ringan.


## V28 — Menu Layout Revision
- Menu hierarchy revised to: Title → Player Profile → Global Champion #1 → MULAI → Other Actions.
- XP is contained inside the player profile instead of becoming a separate menu panel.
- Global Champion is intentionally smaller than the player profile while retaining name, #1 marker, KILL, LEVEL, LENCANA, ITEM, and SCORE.
- Menu is viewport-fit and does not scroll; secondary actions use a fixed responsive grid with adaptive sizing for short screens.
- Mission Control remains in the DOM for existing JavaScript hooks but is hidden from the main menu surface.
- V28 static QA: JavaScript syntax passed, CSS parser errors 0, duplicate IDs 0, HTML tag balance passed, ZIP integrity passed.

## V29 — Whole-Game Layout Overhaul
- Reworked the layout system across the full game, not only the main menu.
- Menu hierarchy is now: title → player profile (including XP) → smaller Global Champion #1 → primary START → secondary actions.
- Utility screens share a consistent content width, topbar rhythm, panel radius, spacing scale, and responsive breakpoints.
- Level Select uses a dashboard hierarchy with balanced mission cards and Daily Ops.
- Challenge, Friends, Achievements, Statistics, Help, Spin, Voucher, Hangar, Multiplayer entry, and Multiplayer lobby received dedicated responsive compositions.
- Gameplay HUD keeps clear reserved bands around the combat arena so enemies remain readable.
- Shop/Hangar remains scrollable because it is a catalogue/workbench; the main menu remains non-scrollable.
- XP was moved structurally inside the player profile while preserving the existing JavaScript hooks.
- No gameplay/stat/network logic was intentionally changed in this pass.
- Browser screenshot regression remains environment-limited; Chromium headless timed out in this sandbox, so no visual PASS is claimed from that unavailable run.

## V31 — Final UX/Layout Composition Pass
- Full-game composition pass across menu, level select, challenge, friends, hangar, achievements, statistics, help, spin, voucher, multiplayer entry/lobby, gameplay HUD, and modals.
- Added final layout layer with consistent spacing, touch targets, content widths, responsive grids, safe-area handling, landscape-phone rules, and reduced-motion focus behavior.
- Menu remains non-scrollable and uses a calm hierarchy: title → profile → Global #1 → start → secondary actions.
- Catalogue/content screens retain scrolling where content volume makes it appropriate.
- Gameplay reserves edge bands for HUD so the central combat area remains readable.


## V32 UX Balance Pass
- Rebalanced all major screens around narrower content columns and deliberate whitespace.
- Main menu uses a balanced 3×3 command grid on portrait/desktop; landscape phone uses a compact 5-column rail.
- Hangar remains scrollable as a catalogue; primary menus remain viewport-fit.
- Dashboard cards, multiplayer actions, level missions, and utility screens use screen-specific composition rather than one universal grid.
- Gameplay center remains visually quiet; UI stays in edge bands.


## V33 — UX Stress Pass
- Production CSS layers moved inside `<head>`; no style tags after `</html>`.
- Small-phone menu preserves balanced 3×3 action grid down to 360px.
- Final structural/layout integrity audit completed.


## V34 — STORY ARCHIVE + UX/BUG PASS
- STORY is now a first-class Archive / Flight Log screen instead of routing to Level Select.
- Five campaign chapters expose unlock state, lore excerpts, chapter logs, and claimable archive rewards.
- Level briefings were rewritten to connect the mystery across the campaign without forcing long cutscenes.
- Transition engine duplicate state assignment was cleaned up.
- Story screen is responsive and keeps long-form lore inside a dedicated scrollable content area; the main menu remains non-scrollable.


## V35 — Admin Control + Final Story Epilogue
- Voucher admin `IMANADMINBRO404` now accepts long codes and only opens the panel after Firebase `/admins/<uid> == true` verification.
- Admin panel manages the full `/users` account list, not only active arena players.
- Admin can grant/take custom KP, reset gameplay progress while preserving UID/name, kick arena presence, and delete game data. Firebase Auth deletion is explicitly separate and requires a trusted backend/Admin SDK.
- Added admin audit entries under `system/adminAudit`.
- Added a final epilogue screen after FINAL COLLAPSE with a lore reveal and route to the final archive.

- Firebase validation for `/users/$uid` and `/leaderboard/$uid` now validates against the target `$uid`, allowing authorized admins to mutate another user without validation rejection.


## V36 — Story & Multiplayer Identity Pass
- Story Archive now reveals chapter-specific field fragments only after unlock.
- Story chapters gain tonal labels and deeper lore breadcrumbs.
- Final Collapse ending expanded into a proper epilogue/teaser sequence.
- Multiplayer modes now have squad contracts, objectives, and kill targets.
- Multiplayer lobby mode cards explain the purpose of each difficulty before readying.
- Multiplayer lobby includes a live Squad Contract briefing.
- Global lobby header now communicates an active sector event.
- No new heavy runtime dependency added.


## V37 Audio Pass
- Adaptive procedural soundtrack profiles for menu, story, hangar, multiplayer, combat, boss/final combat, and victory.
- Layered melody/bass/pad/arp voices with difficulty-aware tempo and energy.
- Shoot/hit SFX throttled to avoid machine-gun audio clutter.
- More varied fallback oscillator timbres and pitch movement.
- AudioContext resume handling added for browser autoplay/suspend behavior.
- No large new music assets added; soundtrack remains lightweight and generated at runtime.
