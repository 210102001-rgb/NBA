'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');

const VALID_STATUS = ['Online', 'Offline', 'Maintenance'];

module.exports = function stasiunRoutes(db) {
  const r = express.Router();

  r.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM stasiun ORDER BY id').all();
    res.json({ stasiun: rows });
  });

  r.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM stasiun WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'stasiun tidak ditemukan' });
    res.json({ stasiun: row });
  });

  r.post('/', requireAdmin, (req, res) => {
    const { id, nama, lokasi, status, alamat, jam, lat, lng } = req.body || {};
    if (!id || !nama) return res.status(400).json({ error: 'id & nama wajib' });
    if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'status tidak valid' });
    try {
      db.prepare(`INSERT INTO stasiun(id, nama, lokasi, status, alamat, jam, lat, lng)
                  VALUES (?,?,?,?,?,?,?,?)`)
        .run(id, nama, lokasi || '', status || 'Online', alamat || '', jam || '', lat ?? null, lng ?? null);
    } catch (e) {
      return res.status(409).json({ error: 'id stasiun sudah dipakai' });
    }
    res.status(201).json({ ok: true, stasiun: db.prepare('SELECT * FROM stasiun WHERE id = ?').get(id) });
  });

  r.put('/:id', requireAdmin, (req, res) => {
    const cur = db.prepare('SELECT * FROM stasiun WHERE id = ?').get(req.params.id);
    if (!cur) return res.status(404).json({ error: 'stasiun tidak ditemukan' });
    const b = req.body || {};
    if (b.status && !VALID_STATUS.includes(b.status)) return res.status(400).json({ error: 'status tidak valid' });
    const upd = {
      nama: b.nama ?? cur.nama, lokasi: b.lokasi ?? cur.lokasi, status: b.status ?? cur.status,
      alamat: b.alamat ?? cur.alamat, jam: b.jam ?? cur.jam,
      lat: b.lat ?? cur.lat, lng: b.lng ?? cur.lng, trx_hari: b.trx_hari ?? cur.trx_hari,
    };
    db.prepare(`UPDATE stasiun SET nama=?, lokasi=?, status=?, alamat=?, jam=?, lat=?, lng=?, trx_hari=?
                WHERE id=?`).run(upd.nama, upd.lokasi, upd.status, upd.alamat, upd.jam, upd.lat, upd.lng, upd.trx_hari, req.params.id);
    res.json({ ok: true, stasiun: db.prepare('SELECT * FROM stasiun WHERE id = ?').get(req.params.id) });
  });

  r.delete('/:id', requireAdmin, (req, res) => {
    const info = db.prepare('DELETE FROM stasiun WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'stasiun tidak ditemukan' });
    res.json({ ok: true });
  });

  return r;
};
