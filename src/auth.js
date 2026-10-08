'use strict';
/* Auth berbasis cookie session (httpOnly). JWT baru diperlukan kalau nanti ada aplikasi mobile. */
const { rowToUser } = require('./db');

function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'belum login' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'belum login' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'khusus admin' });
  }
  next();
}

/* Tempel data user segar ke req.user (dipakai route yang butuh saldo dll). */
function attachUser(db) {
  return (req, res, next) => {
    if (req.session && req.session.userId) {
      req.user = rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId)) || null;
      if (!req.user) { delete req.session.userId; delete req.session.role; }
    } else {
      req.user = null;
    }
    next();
  };
}

module.exports = { requireLogin, requireAdmin, attachUser };
