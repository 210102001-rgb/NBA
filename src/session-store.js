'use strict';
/* Session store persisten untuk express-session di atas node:sqlite (DatabaseSync).
   Session disimpan di tabel `sessions` pada DB aplikasi, sehingga login bertahan
   melewati restart container — MemoryStore bawaan express-session menguap tiap restart. */
const { Store } = require('express-session');

const DDL = `CREATE TABLE IF NOT EXISTS sessions(
  sid TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);`;

const DEFAULT_MAX_AGE = 12 * 60 * 60 * 1000; // sama dengan cookie maxAge di app.js

function expiresOf(sess) {
  if (sess && sess.cookie && sess.cookie.expires) {
    const t = new Date(sess.cookie.expires).getTime();
    if (Number.isFinite(t)) return t;
  }
  return Date.now() + DEFAULT_MAX_AGE;
}

class SqliteSessionStore extends Store {
  constructor(db, { pruneIntervalMs = 15 * 60 * 1000 } = {}) {
    super();
    db.exec(DDL);
    this.db = db;
    this._get = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
    this._set = db.prepare(
      'INSERT INTO sessions(sid, expires, data) VALUES (?, ?, ?) ' +
      'ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data'
    );
    this._del = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._all = db.prepare('SELECT sid, data FROM sessions WHERE expires >= ?');
    this._len = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires >= ?');
    this._clr = db.prepare('DELETE FROM sessions');
    this._tch = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this._prn = db.prepare('DELETE FROM sessions WHERE expires < ?');
    this._timer = setInterval(() => { try { this._prn.run(Date.now()); } catch { /* abaikan */ } }, pruneIntervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  get(sid, cb) {
    try {
      const row = this._get.get(sid);
      if (!row || row.expires < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.data));
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      this._set.run(sid, expiresOf(sess), JSON.stringify(sess));
      if (cb) cb(null);
    } catch (e) { if (cb) cb(e); }
  }

  destroy(sid, cb) {
    try { this._del.run(sid); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }

  touch(sid, sess, cb) {
    try { this._tch.run(expiresOf(sess), sid); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }

  all(cb) {
    try {
      const out = {};
      for (const r of this._all.iterate(Date.now())) out[r.sid] = JSON.parse(r.data);
      cb(null, out);
    } catch (e) { cb(e); }
  }

  length(cb) {
    try { cb(null, this._len.get(Date.now()).n); }
    catch (e) { cb(e); }
  }

  clear(cb) {
    try { this._clr.run(); if (cb) cb(null); }
    catch (e) { if (cb) cb(e); }
  }

  /* Untuk test/teardown: hentikan timer prune. */
  close() { clearInterval(this._timer); }
}

module.exports = { SqliteSessionStore };
