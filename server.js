// Clima 3 Tec - prototipo. Red cerrada: solo técnicos dados de alta por Clima 3.
const express = require('express'), Database = require('better-sqlite3'), bcrypt = require('bcryptjs');
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const app = express(); app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
const db = new Database(path.join(__dirname, 'clima3tec.db')); db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, usuario TEXT UNIQUE, pass TEXT, rol TEXT, nombre TEXT, telefono TEXT,
  especialidades TEXT DEFAULT '', zona TEXT DEFAULT '', activo INTEGER DEFAULT 1, demo INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sesiones(token TEXT PRIMARY KEY, user_id INTEGER);
CREATE TABLE IF NOT EXISTS trabajos(id INTEGER PRIMARY KEY, cliente TEXT, direccion TEXT, tipo TEXT, fecha TEXT, pago REAL, urgencia TEXT,
  notas TEXT, destino TEXT, destino_valor TEXT, tecnico_id INTEGER, estado TEXT DEFAULT 'publicado', creado TEXT DEFAULT CURRENT_TIMESTAMP,
  checklist TEXT, lecturas TEXT, materiales TEXT, firma TEXT, demo INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS eventos(id INTEGER PRIMARY KEY, trabajo_id INTEGER, estado TEXT, lat REAL, lng REAL, user_id INTEGER, ts TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS fotos(id INTEGER PRIMARY KEY, trabajo_id INTEGER, tipo TEXT, archivo TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP);`);

// ---- DEMO seed ----
if (!db.prepare('SELECT 1 FROM users').get()) {
  const ins = db.prepare('INSERT INTO users(usuario,pass,rol,nombre,telefono,especialidades,zona,demo) VALUES(?,?,?,?,?,?,?,1)');
  ins.run('admin', bcrypt.hashSync('demo123', 8), 'admin', 'Clima 3 Admin (DEMO)', '', '', '');
  ins.run('tec1', bcrypt.hashSync('demo123', 8), 'tecnico', 'Juan Pérez (DEMO)', '6620000001', 'minisplit,central', 'Norte');
  ins.run('tec2', bcrypt.hashSync('demo123', 8), 'tecnico', 'Luis Ramírez (DEMO)', '6620000002', 'chiller,refrigeracion', 'Centro');
  ins.run('tec3', bcrypt.hashSync('demo123', 8), 'tecnico', 'Ana Torres (DEMO)', '6620000003', 'minisplit,refrigeracion', 'Sur');
  const t = db.prepare(`INSERT INTO trabajos(cliente,direccion,tipo,fecha,pago,urgencia,notas,destino,destino_valor,demo) VALUES(?,?,?,?,?,?,?,?,?,1)`);
  t.run('Cliente DEMO Restaurante', 'Blvd. Kino 123, Hermosillo (DEMO)', 'minisplit', '2026-10-22T10:00', 800, 'normal', 'Mantenimiento 2 equipos 1.5 ton', 'todos', '');
  t.run('Cliente DEMO Oficinas', 'Calle Rosales 200, Hermosillo (DEMO)', 'central', '2026-10-23T11:00', 1500, 'normal', 'Mantenimiento preventivo unidad 5 ton', 'zona', 'Norte');
  t.run('Cliente DEMO Plaza', 'Av. Reforma 456, Hermosillo (DEMO)', 'chiller', '2026-10-22T08:00', 3500, 'urgente', 'Chiller 60 ton no enfría', 'especialidad', 'chiller');
}

// ---- auth ----
const auth = (rol) => (req, res, next) => {
  const tok = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  const u = tok && db.prepare('SELECT u.* FROM sesiones s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(tok);
  if (!u || !u.activo) return res.status(401).json({ error: 'No autorizado o cuenta suspendida' });
  if (rol && u.rol !== rol) return res.status(403).json({ error: 'Sin permiso' });
  req.user = u; next();
};
app.post('/api/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE usuario=?').get(String(req.body.usuario || '').trim().toLowerCase());
  const pw = String(req.body.password || '').trim(); if (!u || (pw && !bcrypt.compareSync(pw, u.pass))) return res.status(401).json({ error: 'Credenciales incorrectas' });
  if (!u.activo) return res.status(403).json({ error: 'Cuenta suspendida' });
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sesiones VALUES(?,?)').run(token, u.id);
  res.json({ token, rol: u.rol, nombre: u.nombre });
});

// ---- SSE ----
const clientes = new Set();
app.get('/api/eventos', auth(), (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.flushHeaders();
  const c = { res, user: req.user }; clientes.add(c); res.write('data: {"tipo":"hola"}\n\n');
  req.on('close', () => clientes.delete(c));
});
const avisar = (tipo, id) => clientes.forEach(c => c.res.write(`data: ${JSON.stringify({ tipo, id })}\n\n`));

// ---- admin: técnicos ----
const pub = (u) => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, telefono: u.telefono, especialidades: u.especialidades, zona: u.zona, activo: u.activo, demo: u.demo });
app.get('/api/tecnicos', auth('admin'), (req, res) => res.json(db.prepare("SELECT * FROM users WHERE rol='tecnico'").all().map(pub)));
app.post('/api/tecnicos', auth('admin'), (req, res) => {
  const b = req.body; if (!b.usuario || !b.password || !b.nombre) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const r = db.prepare("INSERT INTO users(usuario,pass,rol,nombre,telefono,especialidades,zona) VALUES(?,?,'tecnico',?,?,?,?)")
      .run(b.usuario, bcrypt.hashSync(b.password, 8), b.nombre, b.telefono || '', (b.especialidades || []).join(','), b.zona || '');
    res.json({ id: r.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: 'Usuario ya existe' }); }
});
app.patch('/api/tecnicos/:id', auth('admin'), (req, res) => {
  db.prepare("UPDATE users SET activo=? WHERE id=? AND rol='tecnico'").run(req.body.activo ? 1 : 0, req.params.id);
  if (!req.body.activo) db.prepare('DELETE FROM sesiones WHERE user_id=?').run(req.params.id);
  res.json({ ok: true });
});

// ---- trabajos ----
app.post('/api/trabajos', auth('admin'), (req, res) => {
  const b = req.body, destino = b.destino || 'todos';
  const r = db.prepare(`INSERT INTO trabajos(cliente,direccion,tipo,fecha,pago,urgencia,notas,destino,destino_valor,tecnico_id,estado) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .run(b.cliente, b.direccion, b.tipo, b.fecha, +b.pago || 0, b.urgencia || 'normal', b.notas || '', destino, b.destino_valor || '',
      destino === 'directo' ? +b.destino_valor : null, destino === 'directo' ? 'aceptado' : 'publicado');
  avisar('nuevo', r.lastInsertRowid); res.json({ id: r.lastInsertRowid });
});
const conTodo = (t) => t && ({ ...t, checklist: JSON.parse(t.checklist || '[]'), lecturas: JSON.parse(t.lecturas || '{}'), materiales: t.materiales || '',
  fotos: db.prepare('SELECT * FROM fotos WHERE trabajo_id=?').all(t.id), eventos: db.prepare('SELECT * FROM eventos WHERE trabajo_id=? ORDER BY id').all(t.id) });
app.get('/api/trabajos', auth('admin'), (req, res) =>
  res.json(db.prepare('SELECT t.*, u.nombre tecnico FROM trabajos t LEFT JOIN users u ON u.id=t.tecnico_id ORDER BY t.id DESC').all()));
app.get('/api/trabajos/:id', auth(), (req, res) => {
  const t = db.prepare('SELECT t.*, u.nombre tecnico FROM trabajos t LEFT JOIN users u ON u.id=t.tecnico_id WHERE t.id=?').get(req.params.id);
  if (!t || (req.user.rol === 'tecnico' && t.tecnico_id !== req.user.id)) return res.status(404).json({ error: 'No encontrado' });
  res.json(conTodo(t));
});
// bolsa: trabajos publicados visibles para este técnico
const visible = (t, u) => t.destino === 'todos' || (t.destino === 'especialidad' && u.especialidades.split(',').includes(t.destino_valor))
  || (t.destino === 'zona' && u.zona === t.destino_valor);
app.get('/api/bolsa', auth('tecnico'), (req, res) =>
  res.json(db.prepare("SELECT id,cliente,direccion,tipo,fecha,pago,urgencia,notas,destino,destino_valor FROM trabajos WHERE estado='publicado' ORDER BY urgencia='urgente' DESC, fecha").all().filter(t => visible(t, req.user))));
app.get('/api/mis-trabajos', auth('tecnico'), (req, res) =>
  res.json(db.prepare('SELECT * FROM trabajos WHERE tecnico_id=? ORDER BY id DESC').all(req.user.id)));
// aceptar: transacción atómica, el primero gana
const aceptar = db.transaction((id, u) => {
  const t = db.prepare('SELECT * FROM trabajos WHERE id=?').get(id);
  if (!t || !visible(t, u)) return 'no_visible';
  const r = db.prepare("UPDATE trabajos SET estado='aceptado', tecnico_id=? WHERE id=? AND estado='publicado' AND tecnico_id IS NULL").run(u.id, id);
  return r.changes === 1 ? 'ok' : 'tomado';
});
app.post('/api/trabajos/:id/aceptar', auth('tecnico'), (req, res) => {
  const r = aceptar(+req.params.id, req.user);
  if (r !== 'ok') return res.status(409).json({ error: r === 'tomado' ? 'Otro técnico ya tomó este trabajo' : 'No disponible' });
  db.prepare('INSERT INTO eventos(trabajo_id,estado,lat,lng,user_id) VALUES(?,?,?,?,?)').run(req.params.id, 'aceptado', req.body.lat, req.body.lng, req.user.id);
  avisar('tomado', +req.params.id); res.json({ ok: true });
});
const FLUJO = { aceptado: 'en_camino', en_camino: 'en_sitio', en_sitio: 'terminado' };
app.post('/api/trabajos/:id/estado', auth('tecnico'), (req, res) => {
  const t = db.prepare('SELECT * FROM trabajos WHERE id=? AND tecnico_id=?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'No encontrado' });
  const nuevo = req.body.estado;
  if (FLUJO[t.estado] !== nuevo) return res.status(400).json({ error: `No se puede pasar de ${t.estado} a ${nuevo}` });
  if (nuevo === 'terminado' && (!t.firma || !db.prepare("SELECT 1 FROM fotos WHERE trabajo_id=? AND tipo='despues'").get(t.id)))
    return res.status(400).json({ error: 'Falta firma del cliente o foto de después' });
  db.prepare('UPDATE trabajos SET estado=? WHERE id=?').run(nuevo, t.id);
  db.prepare('INSERT INTO eventos(trabajo_id,estado,lat,lng,user_id) VALUES(?,?,?,?,?)').run(t.id, nuevo, req.body.lat, req.body.lng, req.user.id);
  avisar('estado', t.id); res.json({ ok: true });
});
const guardarImg = (dataUrl, nombre) => {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUrl || ''); if (!m) return null;
  const f = `${nombre}-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(__dirname, 'uploads', f), Buffer.from(m[2], 'base64')); return f;
};
app.post('/api/trabajos/:id/evidencia', auth('tecnico'), (req, res) => {
  const t = db.prepare('SELECT * FROM trabajos WHERE id=? AND tecnico_id=?').get(req.params.id, req.user.id);
  if (!t || !['en_sitio', 'en_camino', 'aceptado'].includes(t.estado)) return res.status(400).json({ error: 'No editable' });
  const b = req.body;
  if (b.checklist) db.prepare('UPDATE trabajos SET checklist=? WHERE id=?').run(JSON.stringify(b.checklist), t.id);
  if (b.lecturas) db.prepare('UPDATE trabajos SET lecturas=? WHERE id=?').run(JSON.stringify(b.lecturas), t.id);
  if (b.materiales !== undefined) db.prepare('UPDATE trabajos SET materiales=? WHERE id=?').run(b.materiales, t.id);
  if (b.firma) { const f = guardarImg(b.firma, `firma-${t.id}`); if (f) db.prepare('UPDATE trabajos SET firma=? WHERE id=?').run(f, t.id); }
  if (b.foto) { const f = guardarImg(b.foto, `${b.fotoTipo}-${t.id}`); if (f) db.prepare('INSERT INTO fotos(trabajo_id,tipo,archivo) VALUES(?,?,?)').run(t.id, b.fotoTipo === 'antes' ? 'antes' : 'despues', f); }
  avisar('evidencia', t.id); res.json({ ok: true });
});
app.post('/api/trabajos/:id/aprobar', auth('admin'), (req, res) => {
  const r = db.prepare("UPDATE trabajos SET estado='aprobado' WHERE id=? AND estado='terminado'").run(req.params.id);
  if (!r.changes) return res.status(400).json({ error: 'Solo se aprueban trabajos terminados' });
  db.prepare('INSERT INTO eventos(trabajo_id,estado,user_id) VALUES(?,?,?)').run(req.params.id, 'aprobado', req.user.id);
  avisar('estado', +req.params.id); res.json({ ok: true });
});
app.get('/api/pagos', auth('admin'), (req, res) => res.json(db.prepare(`SELECT u.id,u.nombre,
  SUM(CASE WHEN t.estado='aprobado' THEN t.pago ELSE 0 END) aprobado, SUM(CASE WHEN t.estado IN('aceptado','en_camino','en_sitio','terminado') THEN t.pago ELSE 0 END) pendiente,
  SUM(CASE WHEN t.estado='aprobado' THEN 1 ELSE 0 END) trabajos FROM users u LEFT JOIN trabajos t ON t.tecnico_id=u.id WHERE u.rol='tecnico' GROUP BY u.id`).all()));
app.get('/api/ganancias', auth('tecnico'), (req, res) => res.json(db.prepare(`SELECT
  COALESCE(SUM(CASE WHEN estado='aprobado' THEN pago END),0) aprobado, COALESCE(SUM(CASE WHEN estado IN('aceptado','en_camino','en_sitio','terminado') THEN pago END),0) pendiente,
  COUNT(CASE WHEN estado='aprobado' THEN 1 END) trabajos FROM trabajos WHERE tecnico_id=?`).get(req.user.id)));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Clima 3 Tec en http://localhost:' + PORT));
