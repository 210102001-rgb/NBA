'use strict';
const express = require('express');
const crypto = require('crypto');
const { requireLogin, requireAdmin } = require('../auth');

function fmtTgl(d = new Date()) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

module.exports = function transaksiRoutes(db) {
  const r = express.Router();

  /* Nasabah hanya boleh lihat transaksinya sendiri; admin boleh filter. */
  r.get('/', requireLogin, (req, res) => {
    let rows;
    if (req.session.role === 'admin') {
      const { user_id, stasiun_id } = req.query;
      let sql = 'SELECT * FROM transaksi';
      const where = [], params = [];
      if (user_id) { where.push('user_id = ?'); params.push(user_id); }
      if (stasiun_id) { where.push('stasiun_id = ?'); params.push(stasiun_id); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' ORDER BY rowid DESC LIMIT 500';
      rows = db.prepare(sql).all(...params);
    } else {
      rows = db.prepare('SELECT * FROM transaksi WHERE user_id = ? ORDER BY rowid DESC LIMIT 200')
        .all(req.session.userId);
    }
    res.json({ transaksi: rows });
  });

  /* Setor sampah: {user_id, stasiun_id, kategori, item, berat}
     Tarik tunai:  {user_id, tipe:'tarik', jumlah} */
  r.post('/', requireLogin, (req, res) => {
    const b = req.body || {};
    const targetId = req.session.role === 'admin' ? (b.user_id || req.session.userId) : req.session.userId;
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND aktif = 1').get(targetId);
    if (!user) return res.status(404).json({ error: 'nasabah tidak ditemukan' });

    const id = 'TRX-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
    const tgl = fmtTgl();

    if (b.tipe === 'tarik') {
      const jumlah = b.jumlah;
      if (!Number.isInteger(jumlah) || jumlah <= 0) {
        return res.status(400).json({ error: 'jumlah harus bilangan bulat > 0' });
      }
      if (user.saldo < jumlah) {
        return res.status(400).json({ error: 'saldo tidak cukup', saldo: user.saldo });
      }
      db.prepare('UPDATE users SET saldo = saldo - ? WHERE id = ?').run(jumlah, user.id);
      db.prepare(`INSERT INTO transaksi(id, tgl, user_id, nama, tipe, total, status)
                  VALUES (?,?,?,?, 'tarik', ?, 'Selesai')`).run(id, tgl, user.id, user.nama, -jumlah);
      db.prepare('UPDATE kas SET tunai = tunai - ? WHERE id = 1').run(jumlah);
      return res.status(201).json({ ok: true, id, saldo_baru: user.saldo - jumlah });
    }

    // default: setor
    const { stasiun_id, kategori, item, berat } = b;
    if (!stasiun_id || !kategori || !item || berat === undefined) {
      return res.status(400).json({ error: 'stasiun_id, kategori, item, berat wajib' });
    }
    const beratNum = Number(berat);
    if (!Number.isFinite(beratNum) || beratNum <= 0) {
      return res.status(400).json({ error: 'berat harus angka > 0' });
    }
    const h = db.prepare('SELECT harga, satuan FROM harga WHERE kategori = ? AND item = ?').get(kategori, item);
    if (!h) return res.status(400).json({ error: 'kombinasi kategori/item tidak dikenal' });
    const st = db.prepare('SELECT id FROM stasiun WHERE id = ?').get(stasiun_id);
    if (!st) return res.status(400).json({ error: 'stasiun tidak dikenal' });
    const total = Math.round(beratNum * h.harga);
    db.prepare('UPDATE users SET saldo = saldo + ?, total_kg = total_kg + ?, trx_count = trx_count + 1 WHERE id = ?')
      .run(total, beratNum, user.id);
    db.prepare('UPDATE stasiun SET trx_hari = trx_hari + 1 WHERE id = ?').run(stasiun_id);
    db.prepare(`INSERT INTO transaksi(id, tgl, user_id, nama, stasiun_id, kategori, item, berat, harga, satuan, total, tipe, status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?, 'setor', 'Selesai')`)
      .run(id, tgl, user.id, user.nama, stasiun_id, kategori, item, beratNum, h.harga, h.satuan, total);
    res.status(201).json({ ok: true, id, total, saldo_baru: user.saldo + total });
  });

  return r;
};
