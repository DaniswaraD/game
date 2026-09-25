# Danis Shooter v11.5

## v11.5 — MEGA RECOVERY + RESPONSIVE POLISH
- Permanent helper/decorative copy was reduced so gameplay controls and important information have visual priority.
- Menu and multiplayer cards use touch-safe targets, responsive desktop/mobile layouts, safe-area spacing, and 16px input sizing to avoid mobile browser zoom.
- Gameplay canvas explicitly uses `touch-action:none` while non-game controls use `touch-action:manipulation`.
- The cinematic wipe transition was hardened: the base `#wipe` transform no longer uses CSS `!important`, so JavaScript can reliably drive both IN and OUT phases.

## Multiplayer / Global
- Musuh dan boss tidak lagi disinkronkan HP/damage per tembakan ke Firebase. Setiap pemain menjalankan simulasi combat lokal untuk mengurangi traffic dan lag.
- Player lain dirender sebagai kapal di arena, lengkap dengan nama dan HP bar.
- Statistik memisahkan `TEAM KILL` dari `KILL` pribadi agar angka tidak saling menimpa.
- Kill pribadi dicatat ke pemain yang benar; total kill tim tetap dihitung terpisah.
- Posisi/HP pemain disinkronkan berkala, bukan setiap frame.
- Kill feed dan chat tetap disinkronkan.
- UI multiplayer dioptimalkan agar panel statistik, level badge, boss bar, dan kill feed tidak bertumpuk pada layar kecil.

## Gameplay
- Kampanye terintegrasi ke level utama; menu terpisah Story Mode tidak dipakai sebagai mode gameplay kedua.
- Chapter 5 tersedia dengan dialog pembuka.
- Final boss muncul satu per satu.
- HP final boss berskala eksak: 1x, 10x, 100x, 1.000x, 10.000x, 100.000x dari basis boss pertama.
- Spawn boss dijaga tetap berada di atas zona pemain untuk mencegah spawn langsung menimpa pemain pada viewport pendek.

## Account
- Akun Firebase wajib sebelum masuk game.
- Username dipakai untuk identitas multiplayer/peringkat.

## UI / UX
- Menu desktop memakai layout dua kolom dengan panel pilihan di sisi kanan.
- Tombol menu memakai warna berbeda.
- Touch target multiplayer diperkecil/ditata ulang untuk layar kecil.
- Reduced-motion dihormati jika browser memintanya.

## Testing
- v11.1.1 menambahkan emergency low-HP vignette + warning SFX yang hanya dipicu saat masuk kondisi kritis.
- Tombol `PILIH TINGKAT` tidak lagi menjalankan `endGame()` dua kali.
- `game.js`, `multiplayer.js`, dan `addings.js` lolos `node --check`.
- Tidak ditemukan duplicate HTML id.
- Semua `getElementById()` yang dipakai ketiga file tersebut memiliki elemen HTML.
- Archive diuji dengan `unzip -t`.

Firebase Authentication Email/Password harus aktif dan `firebase-rules.json` perlu dipublish ke Realtime Database.


## Admin berbasis Firebase UID
1. Jalankan game dan login/daftar seperti biasa.
2. Pada kartu akun, UID Firebase sekarang ditampilkan dan dapat disalin dengan tombol `SALIN UID`.
3. Buka Firebase Console → Authentication → Users untuk memastikan UID akun tersebut.
4. Di Realtime Database, buat node `admins` lalu tambahkan: `admins/<UID_KAMU> = true`. Pengaturan ini dilakukan dari Firebase Console, bukan dari username di game.
5. Di game, masukkan kode panel `IMANADMINBRO404`. Game tetap mengecek `admins/<UID>` di Firebase sebelum membuka Admin Panel.
6. Kode panel hanya pintu UI; otorisasi sebenarnya berasal dari Firebase UID + Rules. Jangan menganggap kode tersebut sebagai pengganti Firebase Rules.

### Penting
- Password Firebase tidak pernah ditampilkan di Admin Panel.
- Client browser tidak dapat menghapus akun Authentication milik pemain lain; tombol admin hanya menghapus/menonaktifkan data game sesuai Firebase Rules.
- Untuk menjadikan admin, gunakan UID Firebase, bukan username.


## Cara membuat akun admin
1. Login ke game memakai akun yang ingin dijadikan admin.
2. Buka Firebase Console project game.
3. Masuk ke **Authentication → Users**.
4. Cari akun tersebut.
5. Salin **User UID** dari Firebase Console. UID tidak ditampilkan di website game.
6. Buka **Realtime Database → Data**.
7. Buat node `admins` jika belum ada.
8. Di dalamnya buat child dengan nama UID tadi dan nilai boolean `true`.
   Contoh: `admins / UID_FIREBASE_KAMU = true`
9. Deploy ulang/refresh game, lalu buka panel admin dengan kode yang sudah ditentukan.

**Catatan keamanan:** UID hanya identitas akun. Hak admin tetap diperiksa oleh Firebase Rules. Jangan menaruh password atau rahasia admin di JavaScript frontend.

## Multiplayer
Timer pertandingan private menggunakan `startAt`/`endAt` yang disimpan di Firebase dan disinkronkan dengan waktu server Firebase. Saat waktu habis, host masuk ke menu lobby untuk menentukan permainan berikutnya; pemain lain melihat **MENUNGGU HOST**.


### v10.15
- Startup auth check uses one loading flow; authenticated users proceed without a second loading screen.
- Account deletion button is wired to re-authentication and deletion flow.
- Logout clears profile-sync timers.
- PWA manifest includes 192x192 and 512x512 icons.
- Service worker network requests have a 3.5s timeout before cache fallback.
- Private-room hosts can kick/remove other players but cannot edit their player state.


## v10.15 — Transition safety
- Memperbaiki transisi wipe yang dapat berhenti di posisi tertutup jika proses membuka layar berikutnya mengalami JavaScript error.
- Fase OUT sekarang selalu dijadwalkan menggunakan `finally`, sehingga layar tidak terkunci oleh transisi.
- Cache Service Worker dinaikkan ke `danis-shooter-v10.9` agar GitHub Pages mengambil build terbaru.


### v10.10 — Stability & Indie UI
- Transition lock no longer leaves the application stuck in `transitioning` when another click arrives during an active wipe.
- Transition errors are contained and logged; the OUT phase has a watchdog fallback so the wipe cannot remain permanently closed.
- Main menu redesigned with responsive bento/asymmetric placement: settings at the top, Play as the primary action, and secondary actions distributed across the screen with varied card sizes.
- Mobile, small-phone, tablet, and desktop breakpoints use different spacing and touch-target sizing.
- Service worker cache bumped to v10.10 to prevent stale GitHub Pages assets.


### v10.12 — Runtime audit & transition hardening
- Multiplayer renderer fixed: the playfield canvas context is now exported through `DS().getGameCtx()` instead of calling a nonexistent `getGameCtx()` function.
- Wipe transitions now temporarily capture pointer input so taps cannot reach buttons underneath the transition.
- Wipe animation uses GPU-friendly `translate3d()` and always restores pointer input when the transition finishes or hits its watchdog.
- Spin animation is protected with `try/catch/finally` so an unexpected reward/render error cannot leave the Spin UI permanently disabled.
- Service worker cache bumped to `danis-shooter-v10.12`.


### v10.13 — Deep Runtime Fixes
- Fixed Quit-to-Menu routing from pause/end states.
- Fixed Spin result audio API export so rewards no longer report a false failure after being granted.
- Removed duplicate skill burst trigger that doubled visual particles/shockwaves.
- Cleared stale multiplayer room references when leaving global mode.
- Re-audited cross-file `DS()` API references; no missing exports remain.
- Service worker cache bumped to v10.13.


### v10.17 — Indie UX update
- Menu utama memakai Quick Resume untuk melanjutkan misi normal terakhir.
- Misi Harian kini benar-benar tampil dan dapat diklaim dari layar level.
- Ditambahkan indikator streak harian dan badge misi yang siap diklaim.
- Teks menu dipadatkan dengan mengganti kartu Cara Main menjadi Misi Harian; bantuan tetap tersimpan di aplikasi.
- Layout dan touch target lama dipertahankan agar tidak merusak responsivitas device.


## v10.17 Indie Polish
- Layered screen transitions and wipe effects
- UI entrance/stagger animations
- Click feedback particles and burst effects
- Responsive menu depth/hover feedback
- Reduced-motion fallback
- Service worker cache bumped to v10.17


## v10.21 Global Champion + Chapter Flow + Motion Polish
- Global leaderboard/people ranking UI removed.
- Removed ranking badge and leaderboard menu entry.
- Game-wide visual feedback expanded across combat, bosses, damage, victory/defeat, and screen transitions.
- Added layered depth, gloss, responsive motion, and reduced-motion-safe presentation.


### v10.21
- Global Champion card replaces the old ranking concept.
- Champion score combines normalized total kills, level, achievements, and collected items.
- Main play button always opens chapter/mission selection.
- Chapter tabs are functional and unlock as previous chapters are cleared.
- Last played mission is visually highlighted.
- Added eased chapter-enter motion and champion micro-animation.
- Service worker cache bumped to v10.21.


## v11.1.1 — MEGA UPDATE
- Cinematic transition engine: IN → COVER → OUT → DONE with watchdog fallback.
- Full menu/layout overhaul for desktop, tablet, and mobile.
- Multiplayer lobby redesigned as a control room with chat, ready state, mode picker, and sticky match controls.
- LocalStorage remains the instant offline save; Firebase now mirrors a cloud save snapshot and merges cumulative progress when the player logs in.
- Cloud save uses Firebase `save_snapshots/{uid}` and is protected by uid-based rules.
- All new systems were tested in isolated code paths before packaging.


## v11.5 — MEGA RECOVERY + RESPONSIVE POLISH
- Added pagehide/beforeunload local-save recovery hooks.
- Added online/offline cloud status handling and automatic sync retry when connectivity returns.
- Added explicit transition phase state and progress bar visuals for IN/COVER/OUT/DONE.
- Removed the remaining `#wipe` transform `!important` conflict so the production transition engine controls both directions.
- Added mobile/landscape HUD and multiplayer responsive hardening.
- Tests are performed in isolated production-code slices; no test files are shipped in the release ZIP.
