# Danis.Shooter v13 — Visual Direction

## Product goal
Make Danis.Shooter feel like a deliberately art-directed indie arcade title, not a generic AI-generated dashboard.

## Visual language
- Dark arcade / sci-fi command-deck foundation.
- One neutral system: deep navy surfaces, near-white text, muted steel borders.
- Two functional accents only: amber for primary action and cyan for system/online state.
- Pink/red is reserved for danger, boss, or destructive states.
- Avoid the previous pastel-card rainbow, thick cartoon outlines, excessive rounded corners, and stacked drop-shadows.

## Hierarchy
1. Gameplay / Start Mission is always the strongest action.
2. Player identity and current progression are visible but quiet.
3. Secondary systems are grouped under clear navigation sections.
4. Status information uses compact rails/chips instead of full cards.
5. Empty states explain the next action in one short line.

## Shape system
- Large containers: 18px radius.
- Controls: 10–14px radius.
- Status chips: pill only when the shape communicates status.
- Borders are 1px; active/primary controls may use 2px.
- Shadows are soft depth, never comic 3D offset shadows.

## Motion
- Screen transitions: 260–420ms, cubic-bezier easing.
- Buttons: 120–180ms press/hover feedback.
- Panels: subtle 4–8px translation, never excessive bounce.
- Decorative animation is slow and low-contrast.
- prefers-reduced-motion disables decorative loops.

## Responsive composition
- Mobile: single-column command deck, primary action first.
- Desktop: two-zone command deck; content max-width 1280px.
- Touch targets stay >= 44px.
- Safe-area insets remain respected.

## UX rules
- No redundant explanatory labels.
- No fake loading/progress language.
- Online/offline state must be visually explicit.
- Locked content explains the unlock requirement, not just “LOCKED”.
- Focus states are visible for keyboard users.


## v13 production pass
- The menu is treated as a title screen, not a dashboard: player identity, mission CTA, and secondary systems have distinct visual weights.
- Palette is constrained to midnight, steel, amber, and cyan; red is reserved for danger/system errors.
- Secondary controls use a quiet tool-rail treatment instead of colorful card competition.
- STORY is a first-class navigation destination; legacy CSS hiding it is overridden because the existing navigation handler remains active.
- CSS is contained inside the document head; no production styling is emitted after `</html>`.
- Primary actions have restrained sheen/press feedback rather than perpetual attention-seeking animation.
- Accessibility uses visible focus rings and a labelled primary mission control.
- Motion remains subordinate to gameplay and respects `prefers-reduced-motion`.

## v14 production feel pass
- Treat the title screen as a composition: left side establishes identity/progression; right side establishes action and systems.
- Secondary controls share one system accent instead of a rainbow of unrelated category colors.
- Decorative elements are subordinate to navigation and mission selection.
- Global Champion is informational, not a second CTA.
- Interaction feedback should feel tactile and expensive: short, quiet, directional.
- No new feature is added solely for visual density.


## v15 — Soul / Production Direction

v15 treats the interface as a cockpit rather than a collection of feature cards. The dominant surface language is midnight navy/black, cyan for system feedback, and amber for reward/progression. Secondary tiles are intentionally desaturated so the primary mission action owns attention.

### Principles
- One visual language across menu, progression, multiplayer, shop and gameplay HUD.
- Primary action gets the strongest contrast; secondary systems stay quiet.
- Motion communicates state, not decoration.
- Micro-interaction is optional on pointer-capable devices and never blocks touch.
- Reduced-motion users receive the same information without animation.
- Legacy functionality is preserved; v15 is a presentation and interaction refinement pass.

## V16 — Responsive Production Pass

- Chapter navigation is visible again; legacy hiding rule removed.
- Desktop main menu uses a stable two-column grid instead of absolute-positioned tiles.
- Mobile menu stacks content and keeps all secondary actions reachable by scrolling.
- Level selection uses 2 columns on desktop, 1 on mobile, and 3 on very wide displays.
- KP display uses compact idle-game notation: K, M, B, T, QD, QT, SX, SP, OC, NO, DC, UD, DD, TD, QAD, QID, SXD, SPD, OCD, NOD, VG.
- Player, enemy, and boss silhouettes were redrawn as authored spacecraft silhouettes rather than generic geometric blobs.
- CSS was audited for orphaned style text outside `<style>` blocks.


## V18 Motion Language
Motion is abundant but intentionally inexpensive: entrances, staggered cards, CTA breathing, icon float, XP shimmer, chapter/tab arrival, level-card arrival, HUD/boss feedback and tactile ripples rely primarily on `transform` and `opacity`. Expensive continuous blur/filter effects are avoided in the V18 motion layer. Mobile uses slower/softer ambient timing, and `prefers-reduced-motion` disables non-essential animation.

## V18 Number Language
Player-facing large values use compact notation consistently across KP, XP and Global Champion stats: K, M, B, T, QD, QT, SX, SP, OC, NO, DC, UD, DD, TD and further tiers. Indonesian decimal formatting uses a comma, e.g. `1,2M`.

## v19 Runtime UX Rules

1. Account username is the player identity. Do not create a second unexplained name gate.
2. Campaign cards must be visible after navigation; never leave the campaign area blank on a renderer error.
3. Menu-only atmosphere must not leak into gameplay or campaign screens.
4. KP/XP/global counters use compact notation consistently.
5. Motion can be rich, but continuous effects are paused when their screen is hidden.

## v20 Runtime UX Rules
- Victory modal is a hard gameplay boundary: simulation, spawning, damage, and timers stop while it is visible.
- Victory actions have distinct intent: `LANJUT` means next unlocked campaign mission when applicable; `PILIH TINGKAT` means campaign selection.
- Pause is a real simulation state, not a visual overlay. `appState='paused'` must freeze gameplay progression until resume.


## v21 ART + RUNTIME RULES
- Do not introduce random decorative shapes that do not communicate a gameplay role.
- Keep player/enemy/boss silhouettes readable before adding glow or particles.
- Reuse aerospace construction motifs: hull, cockpit/sensor, reactor, weapon hardpoints, propulsion.
- Early-game backgrounds must remain dark and technical; level identity comes from restrained accent colors.
- Reserve the HUD-safe band at the top of the playfield for UI; boss/enemy spawn positions must not overlap it.
- Transition state changes must have a deterministic animation path and a hard safety deadline.


## v22 ENGINEERING LIBRARY RULES

The project may use third-party libraries when they solve a concrete engineering problem. Current experiments:

1. **GSAP 3.15.0** — UI sequencing only; gameplay simulation never depends on it. If unavailable, the CSS motion layer remains active.
2. **Howler 2.2.4** — short-form SFX sprite playback only. If unavailable or the audio asset fails, Web Audio synthesis remains active.
3. **PixiJS 8.21.0** — optional GPU FX layer only. It is lazy-loaded, disabled on the existing low-end performance profile, and never owns gameplay state. If WebGL/CDN loading fails, the Canvas2D particle renderer remains authoritative.

This separation keeps the game playable offline while allowing a normal online deployment to benefit from specialized rendering/animation/audio tooling.


## v23 Visual Consistency Rules
1. Gameplay, shop, pause and profile surfaces use the same dark technical material system.
2. Player/pet/enemy/boss accents are functional signals, not random candy colors.
3. Particles are restrained orbital/technical indicators tied to the active level theme.
4. Shop previews must never revert to the legacy sky/cream palette.
5. Pause must read as a system hold state, not a separate cartoon modal.


## v24 visual rules
- `square` is a literal square-frame equipment silhouette, not an alias for another shape.
- Pet chassis uses the same square technical hardware language; role is expressed by internal core geometry and accent.
- Combat HUD controls occupy reserved edge bands; the central combat lane remains readable.
- Effects prefer cached sprites and short Canvas trails; GPU libraries remain optional.


## v25 Visual/Combat Rules
1. Player must read as a top-down fighter jet at a glance: nose, canopy, swept wings and twin exhausts are mandatory structural cues.
2. The Hangar is an effect bay, not a separate visual universe. Preview particles, exhaust, weapon fire and drone orbit use the same active ship accent and command-center palette.
3. Combo is a short-lived center-field combat signal, never a persistent HUD obstruction.
4. Multiplayer avatars use the same play-area coordinates as the local player; remote `posX`/`posY` are clamped and interpolated.
5. Particle, projectile and shockwave systems remain capped by the existing low-end performance budget.


### v26 Multiplayer Command Bay
Multiplayer entry is a command surface, not a form. Desktop composition is a three-card action deck, room discovery is a grid, and incoming invites are separated into an operational panel. Mobile collapses by hierarchy rather than simply stacking the old controls.

Drone/pet silhouettes must vary by role while sharing the same material language. Avoid repeating a single rectangular chassis for every companion. Cached Canvas sprites remain preferred for low particle/object counts.
### V27 — Adaptive Menu / Difficulty Atmosphere
- Main menu adalah application surface non-scroll: semua komponen utama harus muat di viewport.
- Desktop memakai dua zona; mobile memakai komposisi grid dua kolom untuk header/profile, XP, champion, brand/CTA, command center, lalu tile actions.
- Ukuran tile, gap, typography, dan panel menggunakan `clamp()`/`minmax()` agar parent tidak memaksa overflow.
- Scroll dipertahankan hanya pada katalog/content browser seperti Shop dan Level Select.
- Setiap level memiliki theme metadata (`intensity`, `pattern`) untuk membedakan atmosfer gameplay tanpa menambah beban runtime besar.

## V29 Layout Contract
- Use one spacing rhythm: 6 / 10 / 14 / 18 / 24px.
- Use panel radii consistently: 9 / 12 / 16 / 20px.
- Utility screens use a max content width around 1120px and a consistent topbar.
- Desktop compositions may use multi-column layouts; mobile collapses intentionally instead of shrinking text into unreadable cards.
- Main menu is a fitted viewport surface and must not scroll.
- Catalogue/workbench screens such as Hangar may scroll.
- Gameplay must reserve HUD bands and preserve a readable combat arena.

## V31 UX Layout Rules
- Use generous spacing and clear hierarchy before adding density.
- Menu is a viewport composition, not a scrolling document.
- Content/catalogue screens may scroll when the content itself is the reason to browse.
- Minimum interactive target is 46px in the final UX layer.
- Desktop grids may use 3–5 columns; tablet collapses to 2; phone generally uses 1 for content-heavy cards and 3 for compact menu actions.
- Small phones and landscape phones get dedicated composition rules instead of simply shrinking desktop.
- Gameplay HUD occupies reserved edge bands; combat center stays visually clear.
- Modals are constrained by viewport height and may scroll internally.
- Focus-visible outlines are preserved for keyboard accessibility.


## V32 UX Balance Pass
- Rebalanced all major screens around narrower content columns and deliberate whitespace.
- Main menu uses a balanced 3×3 command grid on portrait/desktop; landscape phone uses a compact 5-column rail.
- Hangar remains scrollable as a catalogue; primary menus remain viewport-fit.
- Dashboard cards, multiplayer actions, level missions, and utility screens use screen-specific composition rather than one universal grid.
- Gameplay center remains visually quiet; UI stays in edge bands.


## V34 Story Archive
The Story destination is a dedicated archive/flight-log surface. It uses a two-column desktop composition and a single-column mobile composition. Lore is progressive: chapter cards expose short excerpts, while the existing dialogue system reveals full logs. Story does not hijack the main menu and does not add heavy runtime libraries.


## V35 — Admin Control + Final Story Epilogue
- Voucher admin `IMANADMINBRO404` now accepts long codes and only opens the panel after Firebase `/admins/<uid> == true` verification.
- Admin panel manages the full `/users` account list, not only active arena players.
- Admin can grant/take custom KP, reset gameplay progress while preserving UID/name, kick arena presence, and delete game data. Firebase Auth deletion is explicitly separate and requires a trusted backend/Admin SDK.
- Added admin audit entries under `system/adminAudit`.
- Added a final epilogue screen after FINAL COLLAPSE with a lore reveal and route to the final archive.


## V36 Story / Multiplayer
- Story cards expose lore fragments only after chapter unlock.
- Final ending uses an epilogue + next-signal hook instead of a generic victory message.
- Multiplayer mode cards use a three-level hierarchy: mode, brief, objective.
- Lobby exposes a Squad Contract so players know the team goal before readying.


## Audio Direction — V37
- Menu: restrained synth pulse.
- Story: slower, sparse investigative motif.
- Hangar: clean technical pulse.
- Multiplayer: squad/sector rhythm.
- Combat: layered bass + lead with intensity by level.
- Late/final levels: faster tempo and darker interval palette.
- Victory: short resolution motif.
- SFX: high-frequency spam is rate-limited; important events retain priority.
