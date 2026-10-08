
/* ═══ data (seed) ═══ */
const STEPS = [
  ["#1E88E5","1. Timbang","Nasabah meletakkan sampah di atas timbangan."],
  ["#43A047","2. Deteksi AI","Kamera mengenali jenis sampah dari visual & berat."],
  ["#FB8C00","3. Tap NFC","Kartu ditempel untuk mengaitkan akun."],
  ["#8E24AA","4. Harga","Sistem mengambil harga per kategori."],
  ["#1E88E5","5. Konfirmasi","Nasabah setuju/batal di layar."],
  ["#E53935","6. Tersimpan","Data & saldo langsung diperbarui."],
  ["#00897B","7. Real-time","Admin memantau semua via peta."]
];
const rp = n => "Rp " + Number(n).toLocaleString("id-ID");

/* ═══ data: API backend (menggantikan localStorage) ═══ */
const SKA_CENTER = [-7.5680, 110.8250];
const API = new URLSearchParams(location.search).get("api") || "/nba/api";
let DB = null;   /* cermin in-memory dari server */
let ME = null;   /* user login dari /api/auth/me */

async function api(path, opts){
  opts = opts || {};
  const r = await fetch(API + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: opts.method || "GET",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try{ data = await r.json(); }catch(e){}
  if(!r.ok) throw new Error((data && data.error) || ("HTTP " + r.status));
  return data;
}
const apiGet = p => api(p);
const apiPost = (p, body) => api(p, { method: "POST", body: body });
const apiPut = (p, body) => api(p, { method: "PUT", body: body });
const apiDel = p => api(p, { method: "DELETE" });

/* --- mapping bentuk server -> bentuk aplikasi --- */
const mapStasiun = s => ({ id: s.id, nama: s.nama, lokasi: s.lokasi, status: s.status, alamat: s.alamat, jam: s.jam, lat: s.lat, lng: s.lng, trxHari: s.trx_hari || 0 });
function mapHarga(h){ const o = {}; for(const k of Object.keys(h || {})) o[k] = h[k].map(x => [x.item, x.harga, x.satuan]); return o; }
const mapBerita = b => ({ _id: b.id, tgl: b.tgl, judul: b.judul, isi: b.isi, warna: b.warna, icon: b.icon, gambar: b.gambar || "" });
const mapTrx = t => ({ id: t.id, tgl: t.tgl, userId: t.user_id, nama: t.nama, stasiun: t.stasiun_id, kategori: t.kategori, item: t.item, berat: t.berat, harga: t.harga, satuan: t.satuan, total: t.total, tipe: t.tipe, metode: t.metode, status: t.status });
const mapUser = u => ({ id: u.id, username: u.username, nama: u.nama, role: u.role, tel: u.tel, nfc: u.nfc, saldo: u.saldo || 0, totalKg: u.total_kg || 0, trx: u.trx_count || 0, sejak: u.sejak, aktif: !!u.aktif });

const CLIENT_KEY = "nba_client_v1";
function saveClientCache(){
  try{ localStorage.setItem(CLIENT_KEY, JSON.stringify({ notif: DB.notif, outbox: DB.outbox, offline: DB.offline })); }catch(e){}
}
function loadClientCache(){
  try{
    const c = JSON.parse(localStorage.getItem(CLIENT_KEY) || "null");
    if(c){ DB.notif = c.notif || []; DB.outbox = c.outbox || []; DB.offline = !!c.offline; }
  }catch(e){}
}
/* saveDB dipertahankan sebagai nama — kini hanya menyimpan cache lokal (notif/outbox/offline). */
function saveDB(){ if(DB) saveClientCache(); }

async function loadServerData(){
  const st = await apiGet("/stasiun");
  DB.stasiun = st.stasiun.map(mapStasiun);
  const hg = await apiGet("/harga");
  DB.harga = mapHarga(hg.harga);
  const br = await apiGet("/berita");
  DB.berita = br.berita.map(mapBerita);
  ME = null; DB.users = []; DB.transaksi = [];
  try{
    const me = await apiGet("/auth/me");
    ME = mapUser(me.user);
    const tx = await apiGet("/transaksi");
    DB.transaksi = tx.transaksi.map(mapTrx);
    if(ME.role === "admin"){
      const us = await apiGet("/users");
      DB.users = us.users.map(mapUser);
      const kas = await apiGet("/kas");
      DB.kas = { tunai: kas.kas.tunai };
      const hr = await apiGet("/harga/riwayat");
      DB.hargaHistory = hr.riwayat.map(h => ({ tgl: h.tgl, kategori: h.kategori, item: h.item, lama: h.harga_lama, baru: h.harga_baru, alasan: h.alasan }));
    } else {
      DB.users = [ME];
    }
  }catch(e){ /* belum login — landing tetap tampil */ }
}

async function bootAPI(){
  DB = { users: [], transaksi: [], stasiun: [], harga: {}, hargaHistory: [], berita: [],
         kas: { tunai: 0 }, notif: [], outbox: [], offline: false };
  loadClientCache();
  await loadServerData();
}
async function refreshData(){ await loadServerData(); renderNotifBadge(); }

function currentUser(){ return ME; }
function setUser(){ /* sesi dipegang cookie server */ }
function utangNasabah(){ return DB.users.reduce((a,u)=>a+(u.saldo||0),0); }
let _notifSeq = 1;
function addNotif(untuk, judul, isi){
  const now = new Date();
  const tgl = now.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}) + " · " + now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}).replace(":", ".");
  DB.notif.unshift({id:"N"+(_notifSeq++)+"-"+Date.now().toString(36), untuk:untuk, tgl:tgl, judul:judul, isi:isi, baca:false});
  saveDB(); renderNotifBadge();
}
let _trxSeq = 1;
function newTrxId(){ return "TRX-OFF-" + Date.now().toString(36).toUpperCase() + "-" + (_trxSeq++); }

function fmtTgl(){
  const now = new Date();
  return now.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}) + " \u00B7 " + now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}).replace(":",".");
}

/* ═══ render ═══ */
function go(v){
  ["landing","masuk","nasabah","admin"].forEach(k=>{
    document.getElementById("view-"+k).style.display = k===v ? "" : "none";
  });
  document.querySelectorAll(".nav-links a").forEach(a=>a.classList.remove("on"));
  if(v === "nasabah" && typeof showNp === "function") showNp("beranda");
  animateIn(document.getElementById("view-"+v), "anim-fade");
  window.scrollTo(0,0);
}
function goHarga(){ go("landing"); setTimeout(()=>{ const el=document.getElementById("harga"); if(el) el.scrollIntoView({behavior:"smooth"}); },80); }
function animateIn(el, cls){
  if(!el) return;
  el.classList.remove("anim-fade","anim-up","anim-pop");
  void el.offsetWidth;
  el.classList.add(cls || "anim-fade");
}
function loginAs(v){
  const l = document.getElementById("loader");
  l.style.display = "flex";
  requestAnimationFrame(()=>l.classList.add("show"));
  setTimeout(()=>{
    l.classList.remove("show");
    setTimeout(()=>{ l.style.display = "none"; go(v); }, 280);
  }, 1100);
}
function countUp(el, target){
  const dur = 900, t0 = performance.now();
  function f(t){
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = "Rp " + Math.round(target * e).toLocaleString("id-ID");
    if(p < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}
function showNp(k){
  ["beranda","setor","riwayat","harga","akun"].forEach(x=>{
    const p = document.getElementById("np-"+x);
    p.style.display = x===k ? "" : "none";
    if(x===k) animateIn(p, "anim-up");
  });
  document.querySelectorAll(".tabbar button").forEach(b=>b.classList.toggle("on", b.dataset.np===k));
  const ab = document.querySelector(".appbody");
  if(ab) ab.scrollTop = 0;
  if(k === "beranda"){
    const snum = document.querySelector(".snum");
    if(snum) countUp(snum, 125000);
  }
}
function renderSteps(){
  const h = STEPS.map(s=>
    `<div class="step" style="border-color:${s[0]}"><span class="n" style="background:${s[0]}">${s[1].split(".")[0]}</span><div class="b"><b>${s[1].slice(3)}</b>${s[2]}</div></div>`
  ).join("");
  document.getElementById("steps").innerHTML = h;
  const sa = document.getElementById("stepsApp");
  if(sa) sa.innerHTML = h;
}
function renderPriceTabs(){
  const cats = Object.keys(DB.harga);
  const mk = sfx => cats.map((c,i)=>
    `<button class="${i===0?"on":""}" onclick="renderPrices('${c}',this,'${sfx}')">${c}</button>`).join("");
  document.getElementById("priceTabs").innerHTML = mk("");
  const pta = document.getElementById("priceTabsApp");
  if(pta) pta.innerHTML = mk("App");
  renderPrices(cats[0], null, "");
  renderPrices(cats[0], null, "App");
}
function renderPrices(cat, btn, sfx){
  sfx = sfx || "";
  if(btn){ document.querySelectorAll("#priceTabs"+sfx+" button").forEach(b=>b.classList.remove("on")); btn.classList.add("on"); }
  const body = document.getElementById("priceBody"+sfx);
  if(!body || !DB.harga[cat]) return;
  if(sfx === "App"){
    body.innerHTML = DB.harga[cat].map(r=>`<tr><td data-label="Jenis">${r[0]}</td><td data-label="Harga/Kg" style="text-align:right"><b>${rp(r[1])}</b></td></tr>`).join("");
  } else {
    body.innerHTML = DB.harga[cat].map(r=>
      `<tr><td data-label="Jenis">${r[0]}</td><td data-label="Satuan">${r[2]}</td><td data-label="Harga" class="num">${rp(r[1])}</td></tr>`).join("");
  }
}
function trxRows(full){
  return DB.transaksi.slice(0, full?50:6).map(t=>{
    const st = t.status==="Selesai" ? '<span class="pill g">Selesai</span>' : '<span class="pill o">Menunggu</span>';
    const tipe = t.tipe==="tarik" ? "Tarik Tunai" : t.kategori;
    return `<tr onclick="showTrxDetail('${t.id}')" style="cursor:pointer"><td data-label="Waktu">${t.tgl.split(" · ")[1]||t.tgl}</td><td data-label="User">${t.nama}</td><td data-label="Stasiun">${t.stasiun}</td><td data-label="Kategori">${tipe}</td><td data-label="Berat">${String(t.berat).replace(".",",")} ${t.satuan||"Kg"}</td>${full?`<td data-label="Harga/Kg">${rp(t.harga)}</td>`:""}<td data-label="Total" style="text-align:right;font-weight:700">${t.tipe==="tarik"?"−":"+"}${rp(t.total)}</td>${full?`<td data-label="Status">${st}</td>`:""}</tr>`;
  }).join("");
}
function stDot(s){ return s==="Online"?"g":(s==="Offline"?"o":"b"); }
function renderStasiunRows(){
  document.getElementById("stasiunRows").innerHTML = DB.stasiun.map(s=>
    `<tr onclick="showStasiunDetail('${s.id}')" style="cursor:pointer"><td data-label="ID"><b>${s.id}</b></td><td data-label="Nama">${s.nama}</td><td data-label="Lokasi">${s.lokasi}</td><td data-label="Status"><span class="pill ${stDot(s.status)}">${s.status}</span></td><td data-label="Transaksi Hari Ini">${s.trxHari}</td><td data-label="Aksi" style="text-align:right;white-space:nowrap"><button class="linkbtn" onclick="event.stopPropagation();stasiunForm('${s.id}')">Ubah</button><button class="linkbtn danger" onclick="event.stopPropagation();delStasiun('${s.id}')">Hapus</button></td></tr>`).join("");
}
function renderHargaRows(){
  document.getElementById("hargaRows").innerHTML = Object.entries(DB.harga).flatMap(([k,arr])=>
    arr.map(r=>`<tr><td data-label="Kategori"><span class="pill ${k==="Plastik"?"b":k==="Kertas"?"o":"g"}">${k}</span></td><td data-label="Jenis">${r[0]}</td><td data-label="Harga/Kg" style="text-align:right;font-weight:700">${rp(r[1])}/${r[2]}</td><td data-label="Aksi"><button class="linkbtn" onclick="editHarga('${k}',\`${r[0].replace(/`/g,"")}\`)">Ubah</button> <button class="linkbtn danger" onclick="delHarga('${k}',\`${r[0].replace(/`/g,"")}\`)">Hapus</button></td></tr>`)).join("");
}
let leafMaps = {};
function pinColor(s){ return s==="Online" ? "#2E9E4F" : (s==="Offline" ? "#E53935" : "#F9A825"); }
function renderMapPins(){
  const ids = ["leafletMap", "leafletMapAdmin"];
  if(typeof L === "undefined"){
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el && !el.dataset.fb){ el.innerHTML = '<p class="fine" style="padding:40px;text-align:center">Peta membutuhkan koneksi internet.</p>'; el.dataset.fb = "1"; }
    });
    return;
  }
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    if(!leafMaps[id]){
      const m = L.map(id, { scrollWheelZoom: false }).setView(SKA_CENTER, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(m);
      leafMaps[id] = m;
    }
    const m = leafMaps[id];
    m.eachLayer(l=>{ if(l instanceof L.Marker) m.removeLayer(l); });
    DB.stasiun.forEach(s=>{
      if(s.lat === undefined) return;
      const mk = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: "", html: '<div class="lpin' + (s.status==="Online"?" pulse":"") + '" style="background:' + pinColor(s.status) + '">' + s.id.replace("ST-","") + '</div>', iconSize: [38,38], iconAnchor: [19,19] })
      }).addTo(m);
      mk.bindPopup("<b>" + s.id + " &middot; " + s.nama + "</b><br><span style='font-size:12px;color:#666'>" + (s.lokasi||"") + " &middot; " + s.status + "</span>");
      mk.on("popupopen", ()=>{ setTimeout(()=>showStasiunDetail(s.id), 350); });
    });
    setTimeout(()=>m.invalidateSize(), 300);
  });
}
function refreshAdminMap(){ const m = leafMaps["leafletMapAdmin"]; if(m) setTimeout(()=>m.invalidateSize(), 350); }
function renderBerita(){
  const el = document.querySelector("#berita .news");
  if(!el) return;
  el.innerHTML = DB.berita.map((b,i)=>
    `<div class="card" onclick="openBerita(${i})" style="cursor:pointer"><div class="thumb" style="background:${b.warna}">${b.gambar?`<img src="${b.gambar.replace(/"/g,"&quot;")}" style="width:100%;height:100%;object-fit:cover;display:block" alt="">`:b.icon}</div><div class="b"><span class="date">${b.tgl}</span><h3>${b.judul}</h3><p>${b.isi}</p></div></div>`).join("");
}

/* reveal on scroll */
(function(){
  const io = new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target);}}),{threshold:.12});
  const watch = ()=>document.querySelectorAll('.rv:not(.on)').forEach(el=>io.observe(el));
  watch();
  document.addEventListener('DOMContentLoaded', watch);
})();
function openBerita(i){
  const b = DB.berita[i];
  if(!b) return;
  openModal('<button class="art-x" onclick="closeModal()">\u00D7</button>'
    + '<div class="art-hero" style="background:' + b.warna + (b.gambar ? ';background-image:url(' + b.gambar.replace(/'/g,"") + ');background-size:cover;background-position:center' : '') + '">' + (b.gambar ? '' : '<span class="art-icon">' + b.icon + '</span>') + '<span class="art-date">\uD83D\uDCC5 ' + b.tgl + '</span></div>'
    + '<span class="art-kicker">Kabar NBA</span>'
    + '<h2 class="art-title">' + b.judul + '</h2>'
    + '<p class="art-lead">' + b.isi + '</p>'
    + '<p class="art-body">Program bank sampah digital NBA terus berjalan di Surakarta. Setiap setoran yang tercatat melalui perangkat S-cale — timbangan pintar dengan AI dan NFC — langsung menambah saldo tabungan nasabah secara transparan dan real-time.</p>'
    + '<div class="art-cta">📍 <span>Lihat titik bank sampah unit terdekat dari lokasimu.</span><button onclick="closeModal();document.getElementById(\'peta\').scrollIntoView({behavior:\'smooth\'})">Lihat Peta</button></div>');
}


function renderNasabah(){
  const u = currentUser();
  if(!u) return;
  document.querySelectorAll(".who").forEach(e=>e.textContent = u.nama);
  const snum = document.querySelector(".snum");
  if(snum) snum.textContent = rp(u.saldo);
  const q = (document.getElementById("riwayatCari")||{}).value || "";
  const qn = q.trim().toLowerCase();
  let rows = DB.transaksi.filter(t=>t.userId===u.id && t.tipe==="setor");
  if(qn) rows = rows.filter(t=>[t.tgl, t.kategori, String(t.berat), String(t.total)].join(" ").toLowerCase().includes(qn));
  else rows = rows.slice(0,8);
  const nr = document.getElementById("nasabahRows");
  if(nr) nr.innerHTML = rows.map(t=>`<tr onclick="showTrxDetail('${t.id}')" style="cursor:pointer"><td data-label="Tanggal">${t.tgl}</td><td data-label="Kategori">${t.kategori}</td><td data-label="Berat">${String(t.berat).replace(".",",")} ${t.satuan||"Kg"}</td><td data-label="Total" style="text-align:right;font-weight:700">${rp(t.total)}</td></tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--mut)">Belum ada setoran.</td></tr>`;
  document.querySelectorAll("[data-nfc-id]").forEach(e=>e.textContent = u.nfc);
  document.querySelectorAll("[data-user-id]").forEach(e=>e.textContent = u.id);
  document.querySelectorAll("[data-user-tel]").forEach(e=>e.textContent = u.tel.replace(/(\d{4})(\d+)(\d{4})/,"$1\u2022\u2022\u2022\u2022$3"));
  document.querySelectorAll("[data-user-sejak]").forEach(e=>e.textContent = u.sejak);
  document.querySelectorAll(".snum2").forEach(e=>e.textContent = rp(u.saldo));
  const av = document.querySelector(".avatar");
  if(av) av.textContent = u.nama.charAt(0).toUpperCase();
  const ph = document.querySelector(".profile-head b");
  if(ph) ph.textContent = u.nama;
  const ps = document.querySelector(".profile-head small");
  if(ps) ps.textContent = u.id;
  drawQR();
}
function renderKas(){
  const set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  set("kasTunai", rp(DB.kas.tunai));
  set("kasUtang", rp(utangNasabah()));
  const tglHari = new Date().toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
  const today = DB.transaksi.filter(t=>t.tgl.indexOf(tglHari)===0);
  set("kasMasuk", rp(today.filter(t=>t.tipe==="setor").reduce((a,t)=>a+t.total,0)));
  set("kasKeluar", rp(today.filter(t=>t.tipe==="tarik").reduce((a,t)=>a+t.total,0)));
  const ob = document.getElementById("offlineBadge");
  if(ob) ob.style.display = DB.offline ? "" : "none";
  const oc = document.getElementById("offlineCount");
  if(oc) oc.textContent = DB.outbox.length;
}
function renderAll(){
  renderSteps(); renderPriceTabs(); renderStasiunRows(); renderHargaRows(); renderMapPins(); renderBerita(); renderNasabah(); renderKas(); renderNotifBadge(); renderHistori(); renderBeritaRows(); fillStasiunFilter(); renderLaporan();
  document.getElementById("adminRows").innerHTML = trxRows(false);
  document.getElementById("adminRows2").innerHTML = trxRows(true);
  renderUserRows();
}
async function init(){
  const l = document.getElementById("loader");
  l.style.display = "flex"; requestAnimationFrame(()=>l.classList.add("show"));
  try{ await bootAPI(); }
  catch(e){
    l.classList.remove("show"); setTimeout(()=>{ l.style.display = "none"; }, 280);
    openModal(`<div style="text-align:center;padding:24px"><div style="font-size:52px">🚫</div><h2>Gagal memuat data</h2><p class="msub">Server tidak merespons (${e.message}). Periksa koneksi lalu muat ulang halaman.</p><div class="btnrow"><button class="btn btn-p" style="flex:1" onclick="location.reload()">Muat Ulang</button></div></div>`);
    return;
  }
  l.classList.remove("show"); setTimeout(()=>{ l.style.display = "none"; }, 280);
  renderAll(); renderBeritaRows(); fillStasiunFilter();
  const tgl = document.getElementById("offlineToggle");
  if(tgl) tgl.checked = DB.offline;
  document.getElementById("modalOv").addEventListener("click", e=>{ if(e.target.id==="modalOv") closeModal(); });
  document.querySelectorAll(".slink[data-ap]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".slink[data-ap]").forEach(x=>x.classList.remove("on")); b.classList.add("on");
    ["dash","peta","trx","nasabah","stasiun","harga","lap","berita"].forEach(k=>{
      const p = document.getElementById("ap-"+k);
      p.style.display = k===b.dataset.ap ? "" : "none";
      if(k===b.dataset.ap){ animateIn(p, "anim-up"); if(k==="peta") refreshAdminMap(); }
    });
  }));
}
/* ═══ fitur v2 · bagian 1: modal, notifikasi, detail, struk, QR ═══ */
function openModal(html){
  document.getElementById("modalBox").innerHTML = html;
  const ov = document.getElementById("modalOv");
  ov.style.display = "flex";
  requestAnimationFrame(()=>ov.classList.add("show"));
  animateIn(document.getElementById("modalBox"), "anim-pop");
}
function closeModal(){
  const ov = document.getElementById("modalOv");
  ov.classList.remove("show");
  setTimeout(()=>{ ov.style.display="none"; }, 250);
}
function findTrx(id){
  return DB.transaksi.find(t=>t.id===id) || DB.outbox.find(t=>t.id===id);
}
function isAdminView(){ return document.getElementById("view-admin").style.display !== "none"; }
function renderNotifBadge(){
  const u = currentUser();
  if(!u) return;
  const set = (id, list) => {
    const bdg = document.getElementById(id);
    if(!bdg) return;
    const n = list.filter(x=>!x.baca).length;
    bdg.style.display = n ? "" : "none";
    bdg.textContent = n;
  };
  set("bellBdg", DB.notif.filter(n=>n.untuk===u.id||n.untuk==="all"));
  set("bellBdgAdmin", DB.notif.filter(n=>n.untuk==="admin"));
}
function toggleNotif(open){
  const d = document.getElementById("notifDrawer");
  if(open){ renderNotifBody(); d.classList.add("show"); }
  else d.classList.remove("show");
}
function renderNotifBody(){
  const u = currentUser();
  if(!u) return;
  const list = DB.notif.filter(n=> isAdminView() ? (n.untuk==="admin") : (n.untuk===u.id||n.untuk==="all"));
  document.getElementById("notifBody").innerHTML = list.map(n=>
    `<div class="notif-item ${n.baca?"":"unread"}"><b>${n.judul}</b><p>${n.isi}</p><small>${n.tgl}</small></div>`
  ).join("") || `<p class="fine" style="text-align:center;padding:30px">Belum ada notifikasi.</p>`;
  list.forEach(n=>n.baca=true); saveDB();
  setTimeout(renderNotifBadge, 600);
}
function showTrxDetail(id){
  const t = findTrx(id);
  if(!t) return;
  const w8 = t.status!=="Selesai" ? ' <span class="pill o">Menunggu Sync</span>' : "";
  openModal(`
    <button class="mclose noprint" onclick="closeModal()">\u00D7</button>
    <h2>Detail Transaksi</h2><p class="msub">${t.id}${w8}</p>
    <div class="kv"><span>Tanggal</span><b>${t.tgl}</b></div>
    <div class="kv"><span>Nasabah</span><b>${t.nama}</b></div>
    <div class="kv"><span>Stasiun</span><b>${t.stasiun}</b></div>
    <div class="kv"><span>Jenis</span><b>${t.tipe==="tarik"?"Penarikan Tunai":t.kategori}</b></div>
    ${t.tipe==="setor"
      ? `<div class="kv"><span>Berat</span><b>${String(t.berat).replace(".",",")} ${t.satuan||"Kg"}</b></div>
         <div class="kv"><span>Harga/kg</span><b>${rp(t.harga)}</b></div>`
      : `<div class="kv"><span>Metode</span><b>${t.metode||"Tunai di BSU"}</b></div>`}
    <div class="kv"><span>Total</span><b style="font-size:20px;color:${t.tipe==="tarik"?"#C0392B":"var(--nba-d)"}">${t.tipe==="tarik"?"\u2212":"+"}${rp(t.total)}</b></div>
    <div class="btnrow noprint">
      <button class="btn btn-o" onclick="closeModal()">Tutup</button>
      ${t.status==="Selesai"?`<button class="btn btn-p" onclick="printReceipt('${t.id}')">\u{0001F5A8} Cetak Struk</button>`:""}
    </div>`);
}
function printReceipt(id){
  const t = findTrx(id);
  if(!t) return;
  const s = DB.stasiun.find(x=>x.id===t.stasiun);
  document.getElementById("printArea").innerHTML = `
    <div class="receipt" style="max-width:320px;margin:0 auto">
      <h3>NBA Bank Sampah</h3>
      <div class="rc">${s?s.nama:""}<br>${t.tgl}<br>No: ${t.id}</div>
      <div class="rrow"><span>Nasabah</span><span>${t.nama}</span></div>
      <div class="rrow"><span>Jenis</span><span>${t.tipe==="tarik"?"Penarikan":t.kategori}</span></div>
      ${t.tipe==="setor"?`<div class="rrow"><span>Berat</span><span>${String(t.berat).replace(".",",")} ${t.satuan||"Kg"}</span></div><div class="rrow"><span>Harga</span><span>${rp(t.harga)}/${t.satuan||"Kg"}</span></div>`:`<div class="rrow"><span>Metode</span><span>${t.metode||"Tunai"}</span></div>`}
      <div class="rtotal"><span>TOTAL</span><span>${t.tipe==="tarik"?"\u2212":"+"}${rp(t.total)}</span></div>
      <div class="rc" style="margin-top:14px">Terima kasih telah menabung sampah!<br>\u{0001F431} Moli</div>
    </div>`;
  const pa = document.getElementById("printArea");
  pa.style.display = "";
  closeModal();
  setTimeout(()=>{ window.print(); setTimeout(()=>pa.style.display="none", 400); }, 300);
}
function qrPattern(u){
  const N = 21;
  let h = 7;
  for(const ch of u.id) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const rnd = ()=>{ h = (h*1103515245 + 12345) >>> 0; return h / 4294967296; };
  const inF = (i,j)=> (i<7&&j<7)||(i<7&&j>=N-7)||(i>=N-7&&j<7);
  const cells = [];
  for(let i=0;i<N;i++) for(let j=0;j<N;j++)
    if(!inF(i,j) && rnd() > 0.52) cells.push([i,j]);
  return {N, cells};
}
function paintQR(canvas, mod){
  if(!canvas) return;
  const u = currentUser();
  const {N, cells} = qrPattern(u);
  canvas.width = N*mod; canvas.height = N*mod;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "#16442B";
  cells.forEach(([i,j])=>ctx.fillRect(i*mod, j*mod, mod, mod));
  const fin = (fx,fy)=>{
    ctx.fillStyle="#16442B"; ctx.fillRect(fx*mod,fy*mod,7*mod,7*mod);
    ctx.fillStyle="#fff"; ctx.fillRect((fx+1)*mod,(fy+1)*mod,5*mod,5*mod);
    ctx.fillStyle="#16442B"; ctx.fillRect((fx+2)*mod,(fy+2)*mod,3*mod,3*mod);
  };
  fin(0,0); fin(N-7,0); fin(0,N-7);
}
function drawQR(){ paintQR(document.getElementById("qrCanvas"), 12); }
function zoomQR(){
  const u = currentUser();
  openModal(`<h2>\uD83D\uDCF1 Kartu Anggota</h2><p class="msub">${u.nama} &middot; ${u.id}</p>`
    + `<div style="text-align:center;padding:8px 0 4px"><canvas id="qrZoom" style="width:min(72vw,300px);height:min(72vw,300px);image-rendering:pixelated;border:1px solid var(--line);border-radius:16px;background:#fff"></canvas></div>`
    + `<p class="fine" style="text-align:center">Tunjukkan QR ini ke operator sebagai pengganti kartu NFC.<br>ID kartu: <b>${u.nfc}</b></p>`);
  paintQR(document.getElementById("qrZoom"), 20);
}

/* ═══ fitur v2 · bagian 2: simulasi timbangan, withdrawal, registrasi ═══ */
let sim = null;
function openSimulasi(){
  sim = { step: 1, berat: 0, item: "", harga: 0, satuan: "Kg" };
  renderSimStep();
}
function renderSimStep(){
  const u = currentUser();
  const cats = Object.keys(DB.harga);
  const dots = [1,2,3,4].map(i=>`<span class="${sim.step>=i?"on":""}"></span>`).join("");
  let body = "";
  if(sim.step === 1){
    body = `<div class="scale-display"><div class="wval" id="wVal">0,00</div><small>KILOGRAM</small></div>
      <p class="fine" style="text-align:center">Letakkan sampah di atas timbangan, lalu kunci berat.</p>
      <div class="btnrow"><button class="btn btn-p" id="wBtn" onclick="simWeigh()">\u2696\uFE0F Mulai Timbang</button></div>`;
  } else if(sim.step === 2){
    body = `<div class="scanline"></div>
      <p class="fine" style="text-align:center" id="aiTxt">AI sedang memindai sampah&hellip;</p>
      <div id="aiResult" style="display:none">
        <div class="formrow"><label>Hasil deteksi AI <span style="font-weight:400">(bisa dikoreksi manual)</span></label>
          <select id="simCat" onchange="fillSimItems()">${cats.map(c=>`<option>${c}</option>`).join("")}</select></div>
        <div class="formrow"><label>Jenis sampah</label><select id="simItem"></select></div>
      </div>
      <div class="btnrow"><button class="btn btn-o" onclick="sim.step=1;renderSimStep()">\u2190 Ulangi</button>
      <button class="btn btn-p" id="aiNext" onclick="simNext()" disabled>Lanjut \u2192</button></div>`;
  } else if(sim.step === 3){
    body = `<div class="nfc-card" id="nfcTap" onclick="simTap()">
        <div class="nfc-ring"></div><div class="chip"></div>
        <small>Kartu NFC &middot; ${u.nama}</small><br><b>${u.nfc}</b>
        <p style="margin:12px 0 0;font-size:13px;color:#BFE3C6" id="tapTxt">Ketuk kartu untuk menempel \u{0001F446}</p>
      </div>
      <div class="btnrow"><button class="btn btn-o" onclick="sim.step=2;renderSimStep()">\u2190 Kembali</button></div>`;
  } else {
    const total = Math.round(sim.berat * sim.harga);
    body = `<div class="panel" style="margin-bottom:14px">
        <div class="kv"><span>Berat</span><b>${String(sim.berat.toFixed(2)).replace(".",",")} ${sim.satuan}</b></div>
        <div class="kv"><span>Jenis</span><b>${sim.item}</b></div>
        <div class="kv"><span>Harga</span><b>${rp(sim.harga)}/${sim.satuan}</b></div>
        <div class="kv"><span>Total diterima</span><b style="font-size:20px;color:var(--nba-d)">${rp(total)}</b></div>
      </div>
      ${DB.offline?'<div class="offline-bar">\u{0001F4F4} Mode offline: transaksi akan masuk antrean.</div>':""}
      <div class="btnrow"><button class="btn btn-o" onclick="sim.step=3;renderSimStep()">\u2190 Kembali</button>
      <button class="btn btn-p" onclick="simFinish()">\u2713 Konfirmasi & Simpan</button></div>`;
  }
  openModal(`<button class="mclose noprint" onclick="closeModal()">\u00D7</button>
    <h2>\u2696\uFE0F Simulasi Timbangan S-cale</h2><p class="msub">ST-01 &middot; Bank Sampah Gukub Rukun</p>
    <div class="wz-steps">${dots}</div>${body}`);
  if(sim.step === 2) setTimeout(simAI, 1800);
}
function simWeigh(){
  const btn = document.getElementById("wBtn");
  btn.disabled = true; btn.textContent = "Menimbang\u2026";
  const target = 0.5 + Math.random() * 4.5;
  const t0 = performance.now();
  (function f(t){
    const p = Math.min(1, (t - t0) / 1600);
    const w = target * (1 - Math.pow(1 - p, 2));
    const el = document.getElementById("wVal");
    if(!el) return;
    el.textContent = w.toFixed(2).replace(".", ",");
    if(p < 1) requestAnimationFrame(f);
    else{
      sim.berat = Math.round(target * 100) / 100;
      btn.disabled = false; btn.textContent = "Kunci & Lanjut \u2192";
      btn.onclick = ()=>{ sim.step = 2; renderSimStep(); };
    }
  })(t0);
}
function simAI(){
  if(!document.getElementById("aiResult")) return;
  const cats = Object.keys(DB.harga);
  const c = cats[Math.floor(Math.random() * cats.length)];
  const items = DB.harga[c];
  const it = items[Math.floor(Math.random() * items.length)];
  document.getElementById("aiTxt").innerHTML = "Terdeteksi: <b>" + it[0] + "</b> (" + c + ")";
  document.getElementById("aiResult").style.display = "";
  document.getElementById("simCat").value = c;
  fillSimItems(c, it[0]);
  document.getElementById("aiNext").disabled = false;
}
function fillSimItems(cat, sel){
  const c = cat || (document.getElementById("simCat") && document.getElementById("simCat").value) || Object.keys(DB.harga)[0];
  const items = DB.harga[c] || [];
  const el = document.getElementById("simItem");
  if(el) el.innerHTML = items.map(r=>`<option ${r[0]===sel?"selected":""} value="${r[0]}|${r[1]}|${r[2]}">${r[0]} \u2014 ${rp(r[1])}/${r[2]}</option>`).join("");
}
function simNext(){
  const v = document.getElementById("simItem").value.split("|");
  sim.item = v[0]; sim.harga = +v[1]; sim.satuan = v[2];
  sim.cat = document.getElementById("simCat").value;
  if(sim.satuan === "buah") sim.berat = Math.max(1, Math.round(sim.berat));
  sim.step = 3; renderSimStep();
}
function simTap(){
  const card = document.getElementById("nfcTap");
  if(!card || card.classList.contains("tapped")) return;
  card.classList.add("tapped");
  document.getElementById("tapTxt").textContent = "Kartu terbaca \u2713";
  setTimeout(()=>{ sim.step = 4; renderSimStep(); }, 1300);
}
async function simFinish(){
  const u = currentUser();
  if(!u){ alert("Sesi berakhir, silakan login ulang."); return; }
  let total = Math.round(sim.berat * sim.harga);
  const catEl = document.getElementById("simCat");
  const cat = sim.cat || (catEl && catEl.value) || Object.keys(DB.harga)[0];
  let savedId = null;
  if(DB.offline){
    const trx = { id: newTrxId(), tgl: fmtTgl(), userId: u.id, nama: u.nama, stasiun: "ST-01",
      kategori: cat, item: sim.item, berat: sim.berat, harga: sim.harga, satuan: sim.satuan,
      total: total, tipe: "setor", status: "Menunggu" };
    savedId = trx.id;
    DB.outbox.push(trx);
    addNotif(u.id, "Transaksi tersimpan offline", `${sim.item} ${String(sim.berat).replace(".",",")} ${sim.satuan} — menunggu sync ke server.`);
  } else {
    try{
      const res = await apiPost("/transaksi", { stasiun_id: "ST-01", kategori: cat, item: sim.item, berat: sim.berat });
      total = res.total; savedId = res.id;
      await refreshData();
    }catch(e){ alert("Gagal menyimpan setoran: " + e.message); return; }
    addNotif(u.id, "Setoran berhasil", `${sim.item} ${String(sim.berat).replace(".",",")} ${sim.satuan} — ${rp(total)} masuk ke saldo kamu.`);
    addNotif("admin", "Setoran baru", `${u.nama} menyetor ${sim.item} (${rp(total)}) di ST-01.`);
  }
  saveDB(); renderAll();
  openModal(`<div style="text-align:center;padding:8px">
    <div style="font-size:60px">✅</div>
    <h2>${DB.offline ? "Tersimpan di Antrean" : "Transaksi Berhasil!"}</h2>
    <p class="msub">${DB.offline ? "Akan disinkronkan saat online." : rp(total) + " masuk ke saldo " + u.nama + "."}</p>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Tutup</button>
    ${savedId ? `<button class="btn btn-p" onclick="printReceipt('${savedId}')">🖨 Cetak Struk</button>` : ""}</div>
  </div>`);
}
function doWithdraw(){
  const u = currentUser();
  const amt = Math.round(+document.getElementById("wdAmount").value || 0);
  const method = document.getElementById("wdMethod").value;
  if(!amt || amt < 10000){ alert("Minimal penarikan Rp 10.000."); return; }
  if(amt > u.saldo){ alert("Saldo tidak mencukupi."); return; }
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Konfirmasi Penarikan</h2><p class="msub">Periksa kembali sebelum dikonfirmasi.</p>
    <div class="kv"><span>Jumlah</span><b style="font-size:19px">${rp(amt)}</b></div>
    <div class="kv"><span>Metode</span><b>${method}</b></div>
    <div class="kv"><span>Sisa saldo</span><b>${rp(u.saldo - amt)}</b></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="doWithdrawExec(${amt},'${method}')">Konfirmasi</button></div>`);
}
async function doWithdrawExec(amt, method){
  const u = currentUser();
  if(!u){ alert("Sesi berakhir, silakan login ulang."); return; }
  if(DB.offline){
    const trx = { id: newTrxId(), tgl: fmtTgl(), userId: u.id, nama: u.nama, stasiun: "ST-01",
      kategori: "Penarikan", item: "", berat: 0, harga: 0, satuan: "", total: amt, tipe: "tarik",
      metode: method, status: "Menunggu" };
    DB.outbox.push(trx);
    addNotif(u.id, "Penarikan dijadwalkan", `${rp(amt)} via ${method}. Menunggu sync.`);
    addNotif("admin", "Penarikan saldo", `${u.nama} menarik ${rp(amt)} via ${method}.`);
    saveDB(); renderAll(); closeModal();
    document.getElementById("wdAmount").value = "";
    showTrxDetail(trx.id);
    return;
  }
  try{
    await apiPost("/transaksi", { tipe: "tarik", jumlah: amt, metode: method });
    await refreshData();
  }catch(e){ alert("Penarikan gagal: " + e.message); return; }
  addNotif(u.id, "Penarikan berhasil", `${rp(amt)} via ${method}.`);
  addNotif("admin", "Penarikan saldo", `${u.nama} menarik ${rp(amt)} via ${method}.`);
  saveDB(); renderAll(); closeModal();
  document.getElementById("wdAmount").value = "";
  const t = DB.transaksi.find(t => t.tipe === "tarik" && t.total === amt);
  if(t) showTrxDetail(t.id);
}
function openRegister(){
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Daftar Nasabah Baru</h2><p class="msub">Akun & kartu NFC dibuat otomatis.</p>
    <div class="formrow"><label>Nama lengkap</label><input id="rgNama" placeholder="cth: Dewi Lestari"></div>
    <div class="formrow"><label>No. HP / WhatsApp</label><input id="rgTel" inputmode="numeric" placeholder="cth: 081234567890"></div>
    <div class="formrow"><label>Alamat</label><input id="rgAlamat" placeholder="cth: Jl. Slamet Riyadi No. 10"></div>
    <div class="formrow"><label>Password</label><input id="rgPass" type="password" placeholder="min. 6 karakter" autocomplete="new-password"></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="doRegister()">Daftar</button></div>`);
}
async function doRegister(){
  const nama = document.getElementById("rgNama").value.trim();
  const tel = document.getElementById("rgTel").value.replace(/\D/g,"");
  const alamat = document.getElementById("rgAlamat").value.trim();
  const pass = document.getElementById("rgPass").value;
  if(!nama || tel.length < 10){ alert("Isi nama dan No. HP yang valid (min 10 digit)."); return; }
  if(!pass || pass.length < 6){ alert("Password minimal 6 karakter."); return; }
  try{
    const r = await apiPost("/auth/register", { nama: nama, tel: tel, alamat: alamat, password: pass });
    ME = mapUser(r.user);
    await loadServerData();
  }catch(e){ alert("Pendaftaran gagal: " + e.message); return; }
  addNotif(ME.id, "Selamat datang di NBA!", "Akun & kartu NFC kamu sudah aktif. Lakukan setoran pertamamu!");
  addNotif("admin", "Nasabah baru", `${ME.nama} (${ME.id}) baru saja mendaftar.`);
  saveDB(); closeModal();
  renderAll();
  loginAs("nasabah");
}
async function doLogin(){
  const u = document.getElementById("liUser").value.trim();
  const p = document.getElementById("liPass").value;
  if(!u || !p){ alert("Isi username & password."); return; }
  const l = document.getElementById("loader");
  l.style.display = "flex"; requestAnimationFrame(()=>l.classList.add("show"));
  try{
    const r = await apiPost("/auth/login", { username: u, password: p });
    ME = mapUser(r.user);
    await loadServerData();
    l.classList.remove("show"); setTimeout(()=>{ l.style.display = "none"; }, 280);
    renderAll();
    loginAs(ME.role === "admin" ? "admin" : "nasabah");
  }catch(e){
    l.classList.remove("show"); setTimeout(()=>{ l.style.display = "none"; }, 280);
    alert("Login gagal: " + e.message);
  }
}
async function logout(){
  try{ await apiPost("/auth/logout"); }catch(e){}
  ME = null; go("landing");
}
function renderUserRows(){
  const el = document.getElementById("userRows");
  if(!el) return;
  el.innerHTML = DB.users.map(u=>`<tr>
    <td data-label="ID" style="white-space:nowrap;font-weight:700">${u.id}</td>
    <td data-label="Nama">${u.nama}</td>
    <td data-label="No. HP" style="white-space:nowrap">${u.tel||"-"}</td>
    <td data-label="Saldo" style="white-space:nowrap">${rp(u.saldo)}</td>
    <td data-label="Total" style="white-space:nowrap">${String(u.totalKg).replace(".",",")} Kg</td>
    <td data-label="Status"><span class="pill ${u.aktif?"g":"o"}">${u.aktif?"Aktif":"Nonaktif"}</span></td>
    <td data-label="Aksi" style="text-align:right;white-space:nowrap"><button class="btn btn-o" style="padding:7px 12px" onclick="userForm('${u.id}')">Kelola</button></td>
  </tr>`).join("");
}
function userForm(id){
  const u = DB.users.find(x=>x.id===id);
  if(!u) return;
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Kelola Nasabah</h2><p class="msub">${u.id}</p>
    <div class="formrow"><label>Nama lengkap</label><input id="usNama" value="${u.nama.replace(/"/g,"&quot;")}"></div>
    <div class="formrow"><label>No. HP</label><input id="usTel" value="${u.tel||""}" inputmode="numeric"></div>
    <div class="formrow"><label>Status akun</label><select id="usAktif">
      <option value="1"${u.aktif?" selected":""}>Aktif</option>
      <option value="0"${u.aktif?"":" selected"}>Nonaktif — tidak bisa login</option>
    </select></div>
    <div class="formrow"><label>Password baru <span style="font-weight:400">(kosongkan jika tidak diubah)</span></label><input id="usPass" type="text" placeholder="min. 6 karakter" autocomplete="off"></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="saveUser('${u.id}')">Simpan</button></div>`);
}
async function saveUser(id){
  const pw = document.getElementById("usPass").value;
  const body = {
    nama: document.getElementById("usNama").value.trim(),
    tel: document.getElementById("usTel").value.replace(/\D/g,""),
    aktif: document.getElementById("usAktif").value === "1",
  };
  if(pw) body.password = pw;
  try{
    await apiPut("/users/" + id, body);
    await refreshData();
  }catch(e){ alert("Gagal menyimpan: " + e.message); return; }
  addNotif("admin", "Nasabah diperbarui", `${body.nama} (${id}) diubah.${pw ? " Password di-reset." : ""}`);
  renderAll(); closeModal();
}
function renderBeritaRows(){
  const el = document.getElementById("beritaRows");
  if(!el) return;
  el.innerHTML = DB.berita.map((b,i)=>
    `<tr><td data-label="Tanggal">${b.tgl}</td><td data-label="Judul"><a href="javascript:void(0)" onclick="openBerita(${i})" style="color:var(--nba-d);font-weight:600;text-decoration:underline dotted">${b.judul}</a></td><td data-label="Aksi" style="text-align:right;white-space:nowrap"><button class="linkbtn" onclick="beritaForm(${i})">Ubah</button><button class="linkbtn danger" onclick="delBerita(${i})">Hapus</button></td></tr>`).join("");
}
function renderLaporan(){
  const top = DB.users.slice().sort((a,b)=>b.totalKg-a.totalKg).slice(0,5);
  const el = document.getElementById("topNasabah");
  if(el) el.innerHTML = top.map((u,i)=>`<tr><td data-label="Peringkat">${i+1}</td><td data-label="Nama">${u.nama}</td><td data-label="Total Kg" style="text-align:right">${String(u.totalKg).replace(".",",")}</td></tr>`).join("");
  const komp = {};
  DB.transaksi.filter(t=>t.tipe==="setor").forEach(t=>{
    const cat = t.kategori || "Lainnya";
    komp[cat] = (komp[cat]||0) + (t.satuan==="Kg"?t.berat:0);
  });
  const el2 = document.getElementById("komposisi");
  if(el2) el2.innerHTML = Object.entries(komp).map(([k,v])=>`<div class="kv"><span>${k}</span><b>${String(Math.round(v*100)/100).replace(".",",")} Kg</b></div>`).join("") || '<p class="fine">Belum ada data.</p>';
}
function renderHistori(){
  const el = document.getElementById("historiBody");
  if(!el) return;
  el.innerHTML = DB.hargaHistory.slice(0,20).map(h=>
    `<div class="histitem"><b>${h.item}</b> <small>(${h.kategori})</small><br>${rp(h.lama)} \u2192 <b style="color:var(--nba-d)">${rp(h.baru)}</b><br><small>${h.tgl} \u00B7 ${h.alasan}</small></div>`).join("") || '<p class="fine">Belum ada perubahan harga.</p>';
}
function fillStasiunFilter(){
  const el = document.getElementById("fStasiun");
  if(!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">Semua Stasiun</option>' + DB.stasiun.map(s=>`<option value="${s.id}">${s.id} · ${s.nama}</option>`).join("");
  el.value = cur;
}
function stasiunForm(id){
  const s = id ? DB.stasiun.find(x=>x.id===id) : {id:"",nama:"",lokasi:"",alamat:"",jam:"07.00\u201316.00",status:"Online",trxHari:0};
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>${id?"Ubah":"Tambah"} Stasiun</h2><p class="msub">Data titik timbangan S-cale.</p>
    ${id?"":'<div class="formrow"><label>ID Stasiun</label><input id="stId" placeholder="cth: ST-07"></div>'}
    <div class="formrow"><label>Nama BSU</label><input id="stNama" value="${s.nama.replace(/"/g,"&quot;")}" placeholder="cth: BSU Sumber"></div>
    <div class="formrow"><label>Kecamatan</label><input id="stLokasi" value="${(s.lokasi||"").replace(/"/g,"&quot;")}"></div>
    <div class="formrow"><label>Alamat</label><input id="stAlamat" value="${(s.alamat||"").replace(/"/g,"&quot;")}"></div>
    <div class="formrow"><label>Jam operasional</label><input id="stJam" value="${(s.jam||"").replace(/"/g,"&quot;")}"></div>
    <div class="formrow"><label>Titik lokasi <span style="font-weight:400;color:var(--mut)">— klik peta untuk menandai</span></label><div id="stMapPick" style="height:230px;border-radius:12px;border:1px solid var(--line)"></div></div>
    <input type="hidden" id="stLat" value="${s.lat ?? ''}">
    <input type="hidden" id="stLng" value="${s.lng ?? ''}">
    <div class="formrow"><label>Status</label><select id="stStatus">${["Online","Offline","Maintenance"].map(x=>`<option ${x===s.status?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="saveStasiun('${id||""}')">Simpan</button></div>`);
  setTimeout(()=>initStasiunMapPick(id || null), 80);
}
let stPickMap = null, stPickMarker = null;
function initStasiunMapPick(id){
  const el = document.getElementById("stMapPick");
  if(!el || typeof L === "undefined") return;
  if(stPickMap){ stPickMap.remove(); stPickMap = null; stPickMarker = null; }
  const cur = id ? DB.stasiun.find(x=>x.id===id) : null;
  const lat = (cur && cur.lat != null) ? cur.lat : SKA_CENTER[0];
  const lng = (cur && cur.lng != null) ? cur.lng : SKA_CENTER[1];
  stPickMap = L.map("stMapPick", { scrollWheelZoom: false }).setView([lat, lng], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(stPickMap);
  DB.stasiun.forEach(o=>{
    if(o.lat == null || (cur && o.id === cur.id)) return;
    L.circleMarker([o.lat, o.lng], { radius: 5, color: "#888", weight: 1, fillOpacity: .5 }).addTo(stPickMap).bindTooltip(o.id);
  });
  const setLL = (la, ln)=>{
    document.getElementById("stLat").value = la.toFixed(6);
    document.getElementById("stLng").value = ln.toFixed(6);
    if(stPickMarker) stPickMarker.setLatLng([la, ln]);
    else stPickMarker = L.marker([la, ln]).addTo(stPickMap);
  };
  if(cur && cur.lat != null && cur.lng != null) setLL(cur.lat, cur.lng);
  stPickMap.on("click", e=>{ setLL(e.latlng.lat, e.latlng.lng); stPickMap.scrollWheelZoom.enable(); });
  setTimeout(()=>{ if(stPickMap) stPickMap.invalidateSize(); }, 150);
}
async function saveStasiun(id){
  const nama = document.getElementById("stNama").value.trim();
  if(!nama){ alert("Nama BSU wajib diisi."); return; }
  const data = { nama: nama,
    lokasi: document.getElementById("stLokasi").value.trim(),
    alamat: document.getElementById("stAlamat").value.trim(),
    jam: document.getElementById("stJam").value.trim(),
    status: document.getElementById("stStatus").value };
  const latV = parseFloat(document.getElementById("stLat").value);
  const lngV = parseFloat(document.getElementById("stLng").value);
  if(!isNaN(latV)) data.lat = latV;
  if(!isNaN(lngV)) data.lng = lngV;
  try{
    if(id){
      await apiPut("/stasiun/" + id, data);
      addNotif("admin","Stasiun diperbarui",`${nama} (${id}) diubah.`);
    } else {
      const nid = (document.getElementById("stId").value.trim().toUpperCase()) || ("ST-0"+(DB.stasiun.length+1));
      await apiPost("/stasiun", Object.assign({ id: nid }, data));
      addNotif("admin","Stasiun baru",`${nama} (${nid}) ditambahkan.`);
    }
    await refreshData();
  }catch(e){ alert("Gagal menyimpan stasiun: " + e.message); return; }
  renderAll(); fillStasiunFilter(); closeModal();
}
async function delStasiun(id){
  if(!confirm("Hapus stasiun "+id+"?")) return;
  try{ await apiDel("/stasiun/" + id); await refreshData(); }
  catch(e){ alert("Gagal menghapus: " + e.message); return; }
  renderAll(); fillStasiunFilter();
}
function showStasiunDetail(id){
  const s = DB.stasiun.find(x=>x.id===id);
  if(!s) return;
  const trx = DB.transaksi.filter(t=>t.stasiun===id).slice(0,5);
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>${s.id}</h2><p class="msub">${s.nama}</p>
    <div class="kv"><span>Status</span><span class="pill ${stDot(s.status)}">${s.status}</span></div>
    <div class="kv"><span>Lokasi</span><b>${s.lokasi||"-"}</b></div>
    <div class="kv"><span>Alamat</span><b>${s.alamat||"-"}</b></div>
    <div class="kv"><span>Jam</span><b>${s.jam||"-"}</b></div>
    <div class="kv"><span>Transaksi hari ini</span><b>${s.trxHari}</b></div>
    <h3 style="margin:16px 0 8px;font-size:15px">Transaksi terakhir</h3>
    ${trx.map(t=>`<div class="kv"><span>${t.tgl}</span><b>${t.nama} \u00B7 ${rp(t.total)}</b></div>`).join("") || '<p class="fine">Belum ada transaksi.</p>'}
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Tutup</button>
    ${isAdminView()?`<button class="btn btn-p" onclick="closeModal();setTimeout(()=>stasiunForm('${s.id}'),300)">Ubah Data</button>`:""}
    ${isAdminView()?`<button class="btn btn-o" style="color:#C0392B;border-color:#F0C9C2" onclick="closeModal();setTimeout(()=>delStasiun('${s.id}'),300)">Hapus</button>`:""}</div>`);
}
function hargaForm(){
  const cats = Object.keys(DB.harga);
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Tambah Harga</h2><p class="msub">Item baru per kategori sampah.</p>
    <div class="formrow"><label>Kategori</label><select id="hgCat">${cats.map(c=>`<option>${c}</option>`).join("")}<option value="__new">+ Kategori baru…</option></select></div>
    <div class="formrow" id="hgCatNew" style="display:none"><label>Nama kategori baru</label><input id="hgCatNewV" placeholder="cth: Elektronik"></div>
    <div class="formrow"><label>Nama item</label><input id="hgNama" placeholder="cth: Aki Bekas"></div>
    <div class="formrow"><label>Harga (Rp)</label><input id="hgHarga" type="number" min="0" placeholder="cth: 5000"></div>
    <div class="formrow"><label>Satuan</label><select id="hgSatuan"><option>Kg</option><option>buah</option></select></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="saveHarga()">Simpan</button></div>
    <script>document.getElementById("hgCat").onchange=e=>{document.getElementById("hgCatNew").style.display=e.target.value==="__new"?"":"none"}<\/script>`);
}
async function saveHarga(){
  let cat = document.getElementById("hgCat").value;
  if(cat === "__new"){
    cat = document.getElementById("hgCatNewV").value.trim();
    if(!cat){ alert("Isi nama kategori baru."); return; }
  }
  const nama = document.getElementById("hgNama").value.trim();
  const harga = Math.round(+document.getElementById("hgHarga").value || 0);
  const satuan = document.getElementById("hgSatuan").value;
  if(!nama || harga <= 0){ alert("Isi nama item dan harga yang valid."); return; }
  try{
    await apiPost("/harga", { kategori: cat, item: nama, harga: harga, satuan: satuan });
    await refreshData();
  }catch(e){ alert("Gagal menyimpan harga: " + e.message); return; }
  addNotif("admin","Harga baru",`${nama} (${cat}): ${rp(harga)}/${satuan}.`);
  renderAll(); closeModal();
}
function editHarga(cat, nama){
  const r = (DB.harga[cat]||[]).find(x=>x[0]===nama);
  if(!r) return;
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Ubah Harga</h2><p class="msub">${nama} <small>(${cat})</small></p>
    <div class="formrow"><label>Harga saat ini</label><input value="${rp(r[1])}/${r[2]}" disabled></div>
    <div class="formrow"><label>Harga baru (Rp)</label><input id="ehHarga" type="number" min="0" value="${r[1]}"></div>
    <div class="formrow"><label>Alasan perubahan <span style="font-weight:400">(dicatat di riwayat)</span></label><input id="ehAlasan" placeholder="cth: Mengikuti harga pengepul"></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="saveEditHarga('${cat.replace(/'/g,"\\'")}','${nama.replace(/'/g,"\\'")}')">Simpan</button></div>`);
}
async function saveEditHarga(cat, nama){
  const r = (DB.harga[cat]||[]).find(x=>x[0]===nama);
  const lama = r ? r[1] : 0;
  const baru = Math.round(+document.getElementById("ehHarga").value || 0);
  const alasan = document.getElementById("ehAlasan").value.trim() || "Penyesuaian harga";
  if(baru <= 0){ alert("Harga tidak valid."); return; }
  try{
    await apiPut("/harga", { kategori: cat, item: nama, harga_baru: baru, alasan: alasan });
    await refreshData();
  }catch(e){ alert("Gagal mengubah harga: " + e.message); return; }
  if(baru !== lama) addNotif("admin","Harga diubah",`${nama}: ${rp(lama)} → ${rp(baru)}. ${alasan}`);
  renderAll(); closeModal();
}
async function delHarga(cat, nama){
  if(!confirm(`Hapus "${nama}" dari kategori ${cat}?`)) return;
  try{
    await apiDel("/harga?kategori=" + encodeURIComponent(cat) + "&item=" + encodeURIComponent(nama));
    await refreshData();
  }catch(e){ alert("Gagal menghapus: " + e.message); return; }
  renderAll();
}
function gantiPassForm(){
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Ganti Password</h2><p class="msub">Password baru minimal 6 karakter.</p>
    <div class="formrow"><label>Password lama</label><input id="gpLama" type="password" autocomplete="current-password"></div>
    <div class="formrow"><label>Password baru</label><input id="gpBaru" type="password" autocomplete="new-password"></div>
    <div class="formrow"><label>Ulangi password baru</label><input id="gpBaru2" type="password" autocomplete="new-password"></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="saveGantiPass()">Simpan</button></div>`);
}
async function saveGantiPass(){
  const lama = document.getElementById("gpLama").value;
  const baru = document.getElementById("gpBaru").value;
  const baru2 = document.getElementById("gpBaru2").value;
  if(!lama || !baru){ alert("Isi password lama dan baru."); return; }
  if(baru !== baru2){ alert("Konfirmasi password baru tidak sama."); return; }
  try{ await apiPost("/auth/ganti-password", { lama, baru }); }
  catch(e){ alert("Gagal: " + e.message); return; }
  closeModal();
  alert("Password berhasil diganti.");
}
function beritaForm(i){
  const b = (i===undefined||i===null) ? {tgl:fmtTgl().split(" \u00B7 ")[0], judul:"", isi:"", warna:"linear-gradient(135deg,#2E9E4F,#7CB342)", icon:"\u{0001F4F0}"} : DB.berita[i];
  const palet = ["linear-gradient(135deg,#2E9E4F,#7CB342)","linear-gradient(135deg,#1E88E5,#64B5F6)","linear-gradient(135deg,#F59E0B,#F9A825)","linear-gradient(135deg,#8E24AA,#BA68C8)","linear-gradient(135deg,#E53935,#EF9A9A)"];
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>${i==null?"Tulis":"Ubah"} Berita</h2><p class="msub">Tampil di landing page.</p>
    <div class="formrow"><label>Judul</label><input id="brJudul" value="${b.judul.replace(/"/g,"&quot;")}"></div>
    <div class="formrow"><label>Isi</label><textarea id="brIsi" rows="3">${b.isi}</textarea></div>
    <div class="formrow"><label>Gambar <span style="font-weight:400">(link foto, opsional)</span></label><input id="brGambar" value="${(b.gambar||"").replace(/"/g,"&quot;")}" placeholder="https://…" oninput="document.getElementById('brPrev').src=this.value;document.getElementById('brPrev').style.display=this.value?'block':'none'"><img id="brPrev" src="${(b.gambar||"").replace(/"/g,"&quot;")}" style="display:${b.gambar?"block":"none"};width:100%;height:120px;object-fit:cover;border-radius:10px;margin-top:8px"></div>
    <div class="formrow"><label>Warna kartu</label><div class="swatches" id="brSwatches">${palet.map(p=>`<button type="button" class="sw${p===b.warna?" on":""}" data-w="${p}" style="background:${p}" onclick="pickWarna(this)" title="${p}"></button>`).join("")}</div><input type="hidden" id="brWarna" value="${b.warna}"></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="saveBerita(${i==null?"null":i})">Simpan</button></div>`);
}
function pickWarna(el){
  document.querySelectorAll("#brSwatches .sw").forEach(x=>x.classList.remove("on"));
  el.classList.add("on");
  document.getElementById("brWarna").value = el.dataset.w;
}
async function saveBerita(i){
  const judul = document.getElementById("brJudul").value.trim();
  const isi = document.getElementById("brIsi").value.trim();
  if(!judul || !isi){ alert("Judul dan isi wajib diisi."); return; }
  const b = { tgl: fmtTgl().split(" · ")[0], judul: judul, isi: isi,
    warna: document.getElementById("brWarna").value, icon: "\u{0001F4F0}",
    gambar: document.getElementById("brGambar").value.trim() };
  try{
    if(i == null) await apiPost("/berita", b);
    else await apiPut("/berita/" + DB.berita[i]._id, b);
    await refreshData();
  }catch(e){ alert("Gagal menyimpan berita: " + e.message); return; }
  renderAll(); closeModal();
}
function editBerita(i){ beritaForm(i); }
async function delBerita(i){
  if(!confirm("Hapus berita ini?")) return;
  try{ await apiDel("/berita/" + DB.berita[i]._id); await refreshData(); }
  catch(e){ alert("Gagal menghapus: " + e.message); return; }
  renderAll();
}
function setOffline(v){
  DB.offline = v; saveDB(); renderKas();
  addNotif("admin", v ? "Mode offline AKTIF" : "Kembali online", v ? "Transaksi baru masuk antrean lokal." : "Jaringan pulih.");
  const t = document.getElementById("offlineToggle");
  if(t) t.checked = v;
  if(!v && DB.outbox.length) syncOutbox();
}
async function syncOutbox(){
  if(!DB.outbox.length){ alert("Tidak ada antrean offline."); return; }
  const n = DB.outbox.length;
  const gagal = [];
  for(const t of DB.outbox){
    try{
      if(t.tipe === "setor"){
        await apiPost("/transaksi", { stasiun_id: t.stasiun, kategori: t.kategori, item: t.item, berat: t.berat });
      } else {
        await apiPost("/transaksi", { tipe: "tarik", jumlah: t.total, metode: t.metode });
      }
    }catch(e){ gagal.push(t); }
  }
  DB.outbox = gagal;
  await refreshData();
  addNotif("admin","Sync selesai",`${n - gagal.length} dari ${n} transaksi tersinkron.${gagal.length ? " " + gagal.length + " gagal, tetap di antrean." : ""}`);
  saveDB(); renderAll();
}
function kasTerima(){
  openModal(`<button class="mclose" onclick="closeModal()">\u00D7</button>
    <h2>Terima dari Pengepul</h2><p class="msub">Catat uang masuk hasil jual sampah ke pengepul.</p>
    <div class="formrow"><label>Nominal (Rp)</label><input id="kasNominal" type="number" min="0" placeholder="cth: 1500000"></div>
    <div class="formrow"><label>Keterangan</label><input id="kasKet" placeholder="cth: Jual plastik ke UD Maju"></div>
    <div class="btnrow"><button class="btn btn-o" onclick="closeModal()">Batal</button>
    <button class="btn btn-p" onclick="kasTerimaExec()">Simpan</button></div>`);
}
async function kasTerimaExec(){
  const n = Math.round(+document.getElementById("kasNominal").value || 0);
  if(n <= 0){ alert("Nominal tidak valid."); return; }
  const ket = document.getElementById("kasKet").value.trim() || "Pengepul";
  try{
    await apiPost("/kas/tambah", { jumlah: n, keterangan: ket });
    await refreshData();
  }catch(e){ alert("Gagal: " + e.message); return; }
  addNotif("admin","Kas bertambah",`${rp(n)} diterima (${ket}).`);
  saveDB(); renderKas(); closeModal();
}
function exportCSV(){
  const rows = [["ID","Tanggal","Nasabah","Stasiun","Jenis","Berat","Harga","Total","Tipe","Status"]];
  DB.transaksi.forEach(t=>rows.push([t.id, t.tgl, t.nama, t.stasiun, t.tipe==="tarik"?"Penarikan":t.kategori,
    (t.berat?String(t.berat).replace(".",",")+" "+(t.satuan||""):"-"), t.harga, t.total, t.tipe, t.status]));
  const csv = "\ufeff" + rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download = "nba-transaksi-" + new Date().toISOString().slice(0,10) + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  addNotif("admin","Export selesai","Data transaksi diunduh sebagai CSV.");
}
function exportLaporan(){
  window.print();
}
function filterTrx(){
  const q = (document.getElementById("fSearch").value||"").toLowerCase();
  const st = document.getElementById("fStasiun").value;
  const tp = document.getElementById("fTipe").value;
  const rows = DB.transaksi.filter(t =>
    (!q || (t.nama+" "+t.kategori+" "+t.id+" "+t.stasiun).toLowerCase().includes(q)) &&
    (!st || t.stasiun===st) && (!tp || t.tipe===tp));
  document.getElementById("adminRows2").innerHTML = rows.slice(0,50).map(t=>{
    const stt = t.status==="Selesai" ? '<span class="pill g">Selesai</span>' : '<span class="pill o">Menunggu</span>';
    return `<tr onclick="showTrxDetail('${t.id}')" style="cursor:pointer"><td data-label="Waktu">${t.tgl}</td><td data-label="User">${t.nama}</td><td data-label="Stasiun">${t.stasiun}</td><td data-label="Kategori">${t.tipe==="tarik"?"Tarik Tunai":t.kategori}</td><td data-label="Berat">${t.berat?String(t.berat).replace(".",",")+" "+(t.satuan||""):"-"}</td><td data-label="Harga/Kg">${t.harga?rp(t.harga):"-"}</td><td data-label="Total" style="text-align:right;font-weight:700">${t.tipe==="tarik"?"\u2212":"+"}${rp(t.total)}</td><td data-label="Status">${stt}</td></tr>`;
  }).join("") || `<tr><td colspan="8" style="text-align:center;color:var(--mut)">Tidak ada transaksi yang cocok.</td></tr>`;
}

document.addEventListener("DOMContentLoaded", init);
/* PWA: daftarkan service worker agar bisa di-install */
/* PWA: banner install — tampil saat browser menawarkan instalasi */
let deferredPrompt = null;
function isStandalone(){
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
}
function maybeShowPwa(){
  const b = document.getElementById("pwaBanner");
  if(!b) return;
  if(isStandalone()){ b.style.display = "none"; return; }
  try{ if(localStorage.getItem("pwa_dismiss")) return; }catch(e){}
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if(isIOS){
    document.getElementById("pwaSub").textContent = "Ketuk tombol Share lalu \u201CAdd to Home Screen\u201D.";
    document.getElementById("pwaBtn").style.display = "none";
  }
  b.style.display = "flex";
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  maybeShowPwa();
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  const b = document.getElementById("pwaBanner");
  if(b) b.style.display = "none";
});
async function installPWA(){
  if(deferredPrompt){
    deferredPrompt.prompt();
    try{ await deferredPrompt.userChoice; }catch(e){}
    deferredPrompt = null;
    document.getElementById("pwaBanner").style.display = "none";
    return;
  }
  alert("Untuk memasang aplikasi NBA:\n\n\u2022 Chrome Android: ketuk \u22EE \u2192 \u201CInstall app\u201D / \u201CTambahkan ke Layar utama\u201D\n\u2022 iPhone: ketuk Share \u2192 \u201CAdd to Home Screen\u201D\n\u2022 Buka lewat browser Chrome/Safari, bukan dari dalam aplikasi chat.");
}
function dismissPWA(){
  document.getElementById("pwaBanner").style.display = "none";
  try{ localStorage.setItem("pwa_dismiss", "1"); }catch(e){}
}
document.addEventListener("DOMContentLoaded", maybeShowPwa);
if("serviceWorker" in navigator && location.protocol.indexOf("http") === 0){
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}
