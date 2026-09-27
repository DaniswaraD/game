# Danis.Shooter v14

Perbaikan lanjutan dari v13 dengan mempertahankan login Firebase yang sudah ada. Tidak menambahkan sistem login baru.

## Multiplayer
- Enemy dan boss sekarang 100% lokal per pemain; tidak lagi disimpan/dibaca dari `rooms/.../enemies` atau `rooms/.../bosses`.
- Kill/statistik pemain tetap disinkronkan realtime melalui data player room.
- Setiap pemain memiliki simulasi enemy, boss, projectile, dan damage sendiri sehingga kill satu pemain tidak menghapus enemy pemain lain.

## Combat & visual
- Sprite enemy/boss mengikuti arah gerak; orientasi default musuh menghadap ke bawah.
- Projectile musuh tidak lagi berputar secara visual; lintasannya tetap mengikuti velocity/fisika.
- Laser hanya memberikan satu hit per laser, projectile hilang setelah hit, dan kontak boss tidak mengulang damage setiap frame selama masih menempel.
- Bentuk pet dibuat lebih variatif dan upgrade pet menambah orbit/partikel/ring visual.
- Bentuk kapal tetap fighter jet; profil sayap mengikuti shape yang dipilih dan upgrade kapal langsung memperbarui sprite serta FX.
- Projectile toko memiliki varian visual berbeda per item dan upgrade senjata menambah aura/ring visual.

## Menu
- Menu Peringkat terpisah dihapus.
- Kartu Top 1 Global di menu utama tetap dipertahankan.

## Audit
- `node --check` lulus untuk `game.js`, `multiplayer.js`, dan `addings.js`.
- Tidak ada duplicate function declaration.
- Tidak ada duplicate HTML id.
- JSON rules dan manifest valid.
- Login gate lama tidak diubah.


V17 stability revision: reverted the experimental lazy sprite-loading changes from v16. No new loading system or duplicate gameplay system was added. The existing v14 sprite initialization path is retained as the stable baseline.
