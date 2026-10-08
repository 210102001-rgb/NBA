'use strict';
/* Test API end-to-end: node:test + fetch global, tanpa dependency tambahan. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createApp } = require('../src/app');

let base;
let server;
const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nba-test-')), 'test.sqlite');

async function req(method, p, { body, cookie } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  let data = null;
  try { data = await res.json(); } catch { /* kosong */ }
  return { status: res.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie };
}
const get = (p, o) => req('GET', p, o);
const post = (p, o) => req('POST', p, o);
const put = (p, o) => req('PUT', p, o);
const del = (p, o) => req('DELETE', p, o);

before(async () => {
  const { app } = createApp(tmpDb);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); });

test('kesehatan: GET /api/kesehatan', async () => {
  const r = await get('/api/kesehatan');
  assert.equal(r.status, 200);
  assert.equal(r.data.app, 'nba-backend');
});

test('auth: login salah -> 401, login admin -> 200 + cookie', async () => {
  const bad = await post('/api/auth/login', { body: { username: 'admin', password: 'salah' } });
  assert.equal(bad.status, 401);
  const ok = await post('/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
  assert.ok(ok.cookie, 'harus ada session cookie');
  globalThis.__admin = ok.cookie;
  const me = await get('/api/auth/me', { cookie: ok.cookie });
  assert.equal(me.data.user.username, 'admin');
});

test('auth guard: tanpa login -> 401, nasabah -> 403 di rute admin', async () => {
  const anon = await get('/api/users');
  assert.equal(anon.status, 401);
  const n = await post('/api/auth/login', { body: { username: 'NBA-2026-0042', password: 'nasabah123' } });
  assert.equal(n.status, 200);
  globalThis.__nasabah = n.cookie;
  const f = await get('/api/users', { cookie: n.cookie });
  assert.equal(f.status, 403);
});

test('stasiun: seed 12 titik + CRUD admin', async () => {
  const r = await get('/api/stasiun');
  assert.equal(r.status, 200);
  assert.equal(r.data.stasiun.length, 12);
  assert.ok(r.data.stasiun.some((s) => s.id === 'ST-12' && typeof s.lat === 'number'));

  const asNasabah = await post('/api/stasiun', { cookie: globalThis.__nasabah, body: { id: 'ST-99', nama: 'X' } });
  assert.equal(asNasabah.status, 403);

  const c = await post('/api/stasiun', { cookie: globalThis.__admin, body: { id: 'ST-13', nama: 'BSU Tes', lokasi: 'Tes', lat: -7.5, lng: 110.8 } });
  assert.equal(c.status, 201);
  const dupe = await post('/api/stasiun', { cookie: globalThis.__admin, body: { id: 'ST-13', nama: 'Dupe' } });
  assert.equal(dupe.status, 409);
  const badStatus = await put('/api/stasiun/ST-13', { cookie: globalThis.__admin, body: { status: 'Rusak' } });
  assert.equal(badStatus.status, 400);
  const upd = await put('/api/stasiun/ST-13', { cookie: globalThis.__admin, body: { status: 'Offline' } });
  assert.equal(upd.data.stasiun.status, 'Offline');
  const d = await del('/api/stasiun/ST-13', { cookie: globalThis.__admin });
  assert.equal(d.status, 200);
  const gone = await get('/api/stasiun/ST-13');
  assert.equal(gone.status, 404);
});

test('harga: baca + ubah admin tercatat di riwayat', async () => {
  const r = await get('/api/harga');
  assert.ok(r.data.harga.Plastik.length > 10);
  const kardus = r.data.harga.Kertas.find((x) => x.item === 'Kardus');
  assert.equal(kardus.harga, 1500);

  const asNasabah = await put('/api/harga', { cookie: globalThis.__nasabah, body: { kategori: 'Kertas', item: 'Kardus', harga_baru: 1600 } });
  assert.equal(asNasabah.status, 403);

  const u = await put('/api/harga', { cookie: globalThis.__admin, body: { kategori: 'Kertas', item: 'Kardus', harga_baru: 1600, alasan: 'test' } });
  assert.equal(u.status, 200);
  assert.equal(u.data.harga_lama, 1500);
  const rw = await get('/api/harga/riwayat');
  assert.ok(rw.data.riwayat.some((x) => x.item === 'Kardus' && x.harga_baru === 1600));
  const r2 = await get('/api/harga');
  assert.equal(r2.data.harga.Kertas.find((x) => x.item === 'Kardus').harga, 1600);
});

test('transaksi: setor nambah saldo, tarik kurang saldo + validasi', async () => {
  const nc = globalThis.__nasabah;
  // setor 2 Kg Kardus @1600 = 3200 ; saldo awal Andi 125000
  const s = await post('/api/transaksi', { cookie: nc, body: { stasiun_id: 'ST-01', kategori: 'Kertas', item: 'Kardus', berat: 2 } });
  assert.equal(s.status, 201);
  assert.equal(s.data.total, 3200);
  assert.equal(s.data.saldo_baru, 128200);

  const badItem = await post('/api/transaksi', { cookie: nc, body: { stasiun_id: 'ST-01', kategori: 'Kertas', item: 'TidakAda', berat: 1 } });
  assert.equal(badItem.status, 400);

  const w = await post('/api/transaksi', { cookie: nc, body: { tipe: 'tarik', jumlah: 10000 } });
  assert.equal(w.status, 201);
  assert.equal(w.data.saldo_baru, 118200);

  const over = await post('/api/transaksi', { cookie: nc, body: { tipe: 'tarik', jumlah: 999999999 } });
  assert.equal(over.status, 400);
  assert.equal(over.data.saldo, 118200);

  const list = await get('/api/transaksi', { cookie: nc });
  assert.ok(list.data.transaksi.length >= 2);
  assert.ok(list.data.transaksi.every((t) => t.user_id === 'NBA-2026-0042'), 'nasabah hanya lihat miliknya');
});

test('berita: CRUD admin, baca publik', async () => {
  const pub = await get('/api/berita');
  assert.equal(pub.data.berita.length, 3);
  const c = await post('/api/berita', { cookie: globalThis.__admin, body: { judul: 'Tes Berita', isi: 'isi' } });
  assert.equal(c.status, 201);
  const id = c.data.berita.id;
  const u = await put(`/api/berita/${id}`, { cookie: globalThis.__admin, body: { judul: 'Tes Berita 2' } });
  assert.equal(u.data.berita.judul, 'Tes Berita 2');
  const d = await del(`/api/berita/${id}`, { cookie: globalThis.__admin });
  assert.equal(d.status, 200);
});

test('kas: admin bisa baca, nasabah ditolak', async () => {
  const a = await get('/api/kas', { cookie: globalThis.__admin });
  assert.equal(a.status, 200);
  assert.ok(Number.isInteger(a.data.kas.tunai));
  const n = await get('/api/kas', { cookie: globalThis.__nasabah });
  assert.equal(n.status, 403);
});

test('logout: session hangus', async () => {
  const l = await post('/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const me1 = await get('/api/auth/me', { cookie: l.cookie });
  assert.equal(me1.status, 200);
  await post('/api/auth/logout', { cookie: l.cookie });
  const me2 = await get('/api/auth/me', { cookie: l.cookie });
  assert.equal(me2.status, 401);
});

test('register: nasabah baru langsung login', async () => {
  const bad = await post('/api/auth/register', { body: { nama: 'X', tel: '0812', password: '123456' } });
  assert.equal(bad.status, 400);
  const r = await post('/api/auth/register', { body: { nama: 'Dewi', tel: '081234567890', alamat: 'Solo', password: 'rahasia1' } });
  assert.equal(r.status, 201);
  assert.ok(r.data.user.id.startsWith('NBA-2026-'));
  assert.ok(r.cookie, 'register langsung login (cookie)');
  const me = await get('/api/auth/me', { cookie: r.cookie });
  assert.equal(me.data.user.nama, 'Dewi');
  const w = await post('/api/transaksi', { cookie: r.cookie, body: { tipe: 'tarik', jumlah: 1000, metode: 'Transfer Bank' } });
  assert.equal(w.status, 400); // saldo 0
});

test('harga: tambah & hapus item (admin)', async () => {
  const c = await post('/api/harga', { cookie: globalThis.__admin, body: { kategori: 'Logam', item: 'Aki Bekas', harga: 5000, satuan: 'buah' } });
  assert.equal(c.status, 201);
  const dupe = await post('/api/harga', { cookie: globalThis.__admin, body: { kategori: 'Logam', item: 'Aki Bekas', harga: 5000 } });
  assert.equal(dupe.status, 409);
  const r = await get('/api/harga');
  assert.ok(r.data.harga.Logam.some((x) => x.item === 'Aki Bekas' && x.satuan === 'buah'));
  const d = await del('/api/harga?kategori=Logam&item=Aki%20Bekas', { cookie: globalThis.__admin });
  assert.equal(d.status, 200);
  const gone = await del('/api/harga?kategori=Logam&item=Aki%20Bekas', { cookie: globalThis.__admin });
  assert.equal(gone.status, 404);
});

test('transaksi: metode tersimpan', async () => {
  const w = await post('/api/transaksi', { cookie: globalThis.__nasabah, body: { tipe: 'tarik', jumlah: 10000, metode: 'Tunai di BSU' } });
  assert.equal(w.status, 201);
  const list = await get('/api/transaksi', { cookie: globalThis.__nasabah });
  const t = list.data.transaksi.find((x) => x.id === w.data.id);
  assert.equal(t.metode, 'Tunai di BSU');
});
