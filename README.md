# nba-backend

Backend API untuk **NBA Bank Sampah Digital (S-cale)** — Node.js + Express + SQLite
(`node:sqlite` bawaan Node ≥ 22.5, tanpa native build).

Stack yang sama dengan `katalog-app`, pola deploy yang sama (Docker + nginx reverse proxy).

## Cara jalan (lokal)

```bash
npm install
npm start          # http://localhost:3003
npm test           # 9 test API end-to-end
```

Env penting:

| Var | Default | Keterangan |
|---|---|---|
| `PORT` | `3003` | Port HTTP |
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

API di `127.0.0.1:3003` (localhost only), data di volume `nba-data`.
Di VPS, tambahkan block `location /nba/api/` di nginx yang proxy ke `127.0.0.1:3003`
agar frontend dan API same-origin (tanpa CORS).

## Ringkasan endpoint

Semua di bawah `/api`. Auth = cookie session httpOnly (login via `POST /api/auth/login`).

- `GET /api/kesehatan` — health check (publik)
- `/api/auth` — `POST /login`, `POST /logout`, `GET /me`
- `/api/stasiun` — `GET` (publik, buat peta), CRUD khusus admin
- `/api/harga` — `GET` (publik), `PUT` admin (otomatis catat riwayat), `GET /riwayat`
- `/api/berita` — `GET` (publik), CRUD admin
- `/api/transaksi` — `GET` (nasabah: miliknya sendiri; admin: semua + filter),
  `POST` setor (`stasiun_id, kategori, item, berat`) atau tarik (`tipe:'tarik', jumlah`)
- `/api/users` — admin: list + tambah nasabah
- `/api/kas` — admin: ringkas kas + tambah tunai

## Catatan produksi

- `express-session` memakai MemoryStore bawaan — ganti dengan session store
  persisten (mis. `connect-sqlite3`) sebelum go-live multi-proses.
- Backup: cukup copy file SQLite (`/data/nba.sqlite`), pola yang sama dengan
  `/var/backups/katalog`. Jalankan dengan mode WAL aktif (default di kode).
- Frontend prototipe (`nba-proto-standalone.html`) masih baca `localStorage`;
  migrasi ke `fetch` API ini adalah langkah berikutnya.
