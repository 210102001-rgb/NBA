# NBA — Bank Sampah Digital (S-cale)

Full-stack **NBA (Next-Gen Barrier-free Automation) Bank Sampah Digital**:
smart waste-bank berbasis NFC + AI camera untuk lomba IEFC 2026.

- **`frontend/`** — SPA satu file (`index.html`, ±960 KB, Leaflet inline).
  Semua data via `fetch` ke API di bawah path yang sama (`/nba/api`,
  same-origin lewat nginx — tanpa CORS). Login pakai cookie session.
  Untuk tes lokal lawan backend lain: `index.html?api=http://127.0.0.1:3004/api`.
- **`src/`** — Backend API: Node.js + Express + SQLite
  (`node:sqlite` bawaan Node ≥ 22.5, tanpa native build).
  Stack dan pola deploy sama dengan `katalog-app` (Docker + nginx reverse proxy).

## Cara jalan (lokal)

```bash
npm install
npm start          # http://localhost:3004
npm test           # 12 test API end-to-end
```

Sajikan `frontend/index.html` lewat static server apa pun; API base default
`/nba/api` (atau pakai `?api=` untuk menunjuk backend lokal).

Env penting:

| Var | Default | Keterangan |
|---|---|---|
| `PORT` | `3004` | Port HTTP |
| `NBA_DB_PATH` | `./data/nba.sqlite` | Lokasi file SQLite |
| `SESSION_SECRET` | `ganti-di-produksi` | **Wajib diganti di produksi** |
| `ADMIN_PASSWORD` | `admin123` | Password akun `admin` saat seed pertama |
| `NASABAH_PASSWORD` | `nasabah123` | Password akun demo nasabah saat seed pertama |

Akun demo (seed otomatis saat DB kosong):

- `admin` / `admin123` → role admin
- `NBA-2026-0042` / `nasabah123` → Andi (nasabah)
- `NBA-2026-0038` / `nasabah123` → Siti (nasabah)
- `NBA-2026-0031` / `nasabah123` → Budi (nasabah)

## Docker (pola katalog-app)

```bash
docker compose up -d --build
```

API di `127.0.0.1:3004` (localhost only), data di volume `nba-data`.
Di VPS, block nginx `location /nba/api/` mem-proxy ke `127.0.0.1:3004/api/`
sedangkan `location /nba/` menyajikan `frontend/index.html` —
satu origin untuk web + API.

Live:

- Web: `https://filtrazon.solvianova.my.id/nba/`
- API: `https://filtrazon.solvianova.my.id/nba/api/kesehatan`

## Ringkasan endpoint

Semua di bawah `/api`. Auth = cookie session httpOnly (login via `POST /api/auth/login`).

- `GET /api/kesehatan` — health check (publik)
- `/api/auth` — `POST /login`, `POST /logout`, `GET /me`, `POST /register` (publik, nasabah baru langsung login)
- `/api/stasiun` — `GET` (publik, buat peta), CRUD khusus admin
- `/api/harga` — `GET` (publik); admin: `POST` item baru, `PUT` ubah (otomatis catat riwayat), `DELETE` item, `GET /riwayat`
- `/api/berita` — `GET` (publik), CRUD admin
- `/api/transaksi` — `GET` (nasabah: miliknya sendiri; admin: semua + filter),
  `POST` setor (`stasiun_id, kategori, item, berat`) atau tarik (`tipe:'tarik', jumlah, metode`)
- `/api/users` — admin: list + tambah nasabah
- `/api/kas` — admin: ringkas kas + tambah tunai

## Catatan produksi

- `express-session` memakai MemoryStore bawaan — ganti dengan session store
  persisten (mis. `connect-sqlite3`) sebelum go-live multi-proses.
- Backup: cukup copy file SQLite (`/data/nba.sqlite`), pola yang sama dengan
  `/var/backups/katalog`. Jalankan dengan mode WAL aktif (default di kode).
- Notifikasi dalam aplikasi + antrean offline disimpan di `localStorage`
  browser (`nba_client_v1`); seluruh data bisnis tinggal di server.
