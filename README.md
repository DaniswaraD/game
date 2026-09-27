# Danis Shooter v7

Update v7 menambahkan Story Mode dan Daily Quest di atas fitur v6.

## Konten baru
- Story Mode 5 bab dengan progres berbasis kemenangan stage.
- Reward story: poin, XP, dan trophy; reward tiap bab hanya dapat diklaim sekali.
- Daily Quest: 50 kill, 2 boss, dan 2 kemenangan per hari.
- Progress daily reset otomatis berdasarkan tanggal perangkat.
- Service worker cache dinaikkan ke v7 agar asset baru tidak tertahan cache lama.

## Deploy
Upload seluruh isi ZIP ke GitHub Pages. Firebase Rules dari v6 tetap dapat digunakan karena fitur baru ini memakai localStorage dan tidak menambah path Firebase.


V8: full Story/Daily Quest runtime audit; restored missing Story/Daily definitions and save migration/defaults.


## v10 cleanup
- Story Mode dan Daily Quest dihapus.
- Global Arena dihapus; multiplayer fokus grup privat.
- Login menjadi gerbang sebelum main menu.
- Top 1 Global tampil di bawah judul.
- Final Boss berurutan, satu boss aktif pada satu waktu.
- Bentuk musuh diperluas dan efek kapal meningkat mengikuti upgrade.
- social.txt yang tidak dimuat dihapus agar tidak ada duplikasi modul.
