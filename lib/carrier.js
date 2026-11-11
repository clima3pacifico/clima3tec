// Clima 3 Tec · Sistema de tickets de servicio Carrier (Centro de Servicio Autorizado Carrier)
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const { generarPDF } = require('./pdf');

const TIPOS_PROY = {
  instalacion: 'Instalación básica de equipo de aire acondicionado',
  garantia: 'Validación de garantía',
  preventivo: 'Mantenimiento preventivo',
};
const TIPOS_SERV = { evaluacion: 'Evaluación', instalacion: 'Instalación', correctivo: 'Correctivo / Reparación', garantia: 'Garantía', preventivo: 'Mantenimiento preventivo', otro: 'Otro' };
const ESTADOS = {
  nuevo: 'Nuevo', asignado: 'Asignado', aceptado: 'Aceptado por técnico', traslado: 'En traslado', en_sitio: 'En sitio',
  ejecucion: 'En ejecución', suspendido: 'Suspendido', pend_autorizacion: 'Pendiente de autorización', terminado: 'Terminado',
  revision: 'En revisión administrativa', cerrado: 'Cerrado',
};
const CHECK_ESTADOS = { pendiente: 'Pendiente', realizado: 'Realizado', pospuesto: 'Pospuesto', atencion: 'Requiere atención' };
const ETAPAS = { antes: 'Antes del servicio', durante: 'Durante el servicio', despues: 'Después del servicio' };

const PLANTILLAS = {
  instalacion: ['Verificar ubicación y condiciones del área de instalación.', 'Verificar modelo y números de serie del equipo. (De evaporadora y condensadora)',
    'Verificar condiciones eléctricas. (tierra física)', 'Verificar capacidad y características de alimentación eléctrica. (voltaje)',
    'Revisar instalación de unidad interior y exterior.', 'Verificar soportes y anclajes.', 'Verificar aislamiento de tuberías.',
    'Revisar instalación de drenaje de condensados.', 'Verificar conexiones eléctricas.', 'Realizar vacío al sistema, cuando corresponda.',
    'Realizar arranque del equipo.', 'Verificar parámetros de operación.', 'Comprobar funcionamiento en modo frío.',
    'Comprobar funcionamiento en modo calor cuando aplique.', 'Revisar ausencia de ruidos y vibraciones anormales.', 'Entregar recomendaciones de uso al cliente.'],
  garantia: ['Verificar modelo del equipo.', 'Verificar números de serie del equipo. (De evaporadora y condensadora)', 'Revisar fecha y comprobante de compra.',
    'Revisar condiciones generales del equipo.', 'Verificar condiciones de instalación.', 'Inspeccionar conexiones eléctricas.', 'Revisar filtros y serpentines.',
    'Verificar drenaje.', 'Identificar posibles daños físicos.', 'Realizar pruebas de funcionamiento.', 'Registrar códigos de error, si existen.',
    'Identificar posibles causas de falla.', 'Documentar hallazgos técnicos.', 'Registrar evidencia fotográfica.', 'Emitir diagnóstico técnico.',
    'Registrar si procede o no procede la solicitud de garantía, sujeto a las políticas y autorización correspondientes.'],
  preventivo: ['Inspección general del equipo.', 'Limpieza de filtros.', 'Limpieza de serpentines.', 'Revisión de turbinas y ventiladores.',
    'Limpieza de charola de condensados.', 'Limpieza de líneas de drenaje.', 'Revisión de conexiones eléctricas.', 'Ajuste de conexiones, cuando corresponda.',
    'Revisión de aislamiento térmico.', 'Inspección de soportes y anclajes.', 'Revisión de condiciones del compresor.',
    'Verificación de presiones de operación, cuando aplique.', 'Medición de temperaturas.', 'Medición de voltaje.', 'Medición de amperaje.',
    'Prueba de funcionamiento.', 'Limpieza del área de trabajo.', 'Recomendaciones al cliente.'],
};
const PARAMS_DEF = [['Temperatura de suministro', '°C'], ['Temperatura de retorno', '°C'], ['Temperatura ambiente', '°C'], ['Voltaje', 'V'], ['Amperaje', 'A'],
  ['Presión de succión', 'psi'], ['Presión de descarga', 'psi'], ['Condiciones de operación', ''], ['Observaciones técnicas', '']];

// Campos del ticket (sección 4) y del reporte (sección 5)
const CAMPOS_ADMIN = ['fecha_programada', 'cliente_nombre', 'contacto', 'telefono', 'email', 'direccion', 'ciudad', 'estado_geo', 'cp', 'tienda', 'modelo', 'serie',
  'modelo_cond', 'serie_cond', 'fecha_compra', 'folio_factura', 'centro_servicio', 'tipo_proyecto', 'tipo_servicio', 'tipo_servicio_otro', 'tecnico_id', 'apoyo',
  'obs_iniciales', 'cliente_carrier'];
const CAMPOS_REPORTE = ['tipo_servicio', 'tipo_servicio_otro', 'descripcion', 'estado_equipo', 'recomendaciones', 'resultado', 'anexos', 'comentarios_cliente',
  'parametros', 'materiales', 'comentarios'];

module.exports = function carrier(app, db, { auth, avisar, dir }) {
  const UP = path.join(dir, 'uploads'); fs.mkdirSync(path.join(UP, 'pdf'), { recursive: true }); fs.mkdirSync(path.join(UP, 'tickets'), { recursive: true });
  db.exec(`
  CREATE TABLE IF NOT EXISTS clientes(id INTEGER PRIMARY KEY, nombre TEXT, contacto TEXT, telefono TEXT, email TEXT, direccion TEXT, ciudad TEXT,
    estado_geo TEXT, cp TEXT, creado TEXT);
  CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY, folio TEXT UNIQUE, creado TEXT, creado_por INTEGER, fecha_programada TEXT,
    cliente_id INTEGER, cliente_nombre TEXT, contacto TEXT, telefono TEXT, email TEXT, direccion TEXT, ciudad TEXT, estado_geo TEXT, cp TEXT, tienda TEXT,
    modelo TEXT, serie TEXT, modelo_cond TEXT, serie_cond TEXT, fecha_compra TEXT, folio_factura TEXT, centro_servicio TEXT DEFAULT 'Clima 3',
    tipo_proyecto TEXT, tipo_servicio TEXT, tipo_servicio_otro TEXT, tecnico_id INTEGER, apoyo TEXT DEFAULT '', obs_iniciales TEXT,
    cliente_carrier INTEGER DEFAULT 1, estado TEXT DEFAULT 'nuevo', llegada_ts TEXT, llegada_lat REAL, llegada_lng REAL, inicio_ts TEXT, fin_ts TEXT, cerrado_ts TEXT,
    descripcion TEXT, estado_equipo TEXT, recomendaciones TEXT, resultado TEXT, anexos TEXT, comentarios_cliente TEXT, parametros TEXT DEFAULT '{}',
    materiales TEXT, comentarios TEXT, firma_tecnico TEXT, firma_tecnico_ts TEXT, firma_cliente TEXT, cliente_firma_nombre TEXT, cliente_firma_cargo TEXT,
    cliente_firma_ts TEXT, firma_hash TEXT, firma_version INTEGER, version INTEGER DEFAULT 1, demo INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS ticket_checklist(id INTEGER PRIMARY KEY, ticket_id INTEGER, orden INTEGER, actividad TEXT, estado TEXT DEFAULT 'pendiente',
    observacion TEXT DEFAULT '', ts TEXT);
  CREATE TABLE IF NOT EXISTS checklist_plantillas(id INTEGER PRIMARY KEY, tipo_proyecto TEXT, orden INTEGER, actividad TEXT);
  CREATE TABLE IF NOT EXISTS parametros_def(id INTEGER PRIMARY KEY, nombre TEXT, unidad TEXT, orden INTEGER);
  CREATE TABLE IF NOT EXISTS ticket_fotos(id INTEGER PRIMARY KEY, ticket_id INTEGER, etapa TEXT, archivo TEXT, descripcion TEXT, ts_captura TEXT, ts_carga TEXT,
    user_id INTEGER, cid TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS ticket_estados(id INTEGER PRIMARY KEY, ticket_id INTEGER, estado TEXT, ts TEXT, user_id INTEGER, nota TEXT, lat REAL, lng REAL);
  CREATE TABLE IF NOT EXISTS reporte_versiones(id INTEGER PRIMARY KEY, ticket_id INTEGER, version INTEGER, hash TEXT, motivo TEXT, ts TEXT, user_id INTEGER, pdf TEXT);
  CREATE TABLE IF NOT EXISTS auditoria(id INTEGER PRIMARY KEY, ts TEXT, user_id INTEGER, entidad TEXT, entidad_id INTEGER, accion TEXT, detalle TEXT);
  CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY, valor TEXT);
  CREATE INDEX IF NOT EXISTS ix_t_serie ON tickets(serie); CREATE INDEX IF NOT EXISTS ix_t_tec ON tickets(tecnico_id);`);

  const ahora = () => new Date().toISOString();
  const audit = (u, entidad, id, accion, detalle) => db.prepare('INSERT INTO auditoria(ts,user_id,entidad,entidad_id,accion,detalle) VALUES(?,?,?,?,?,?)')
    .run(ahora(), u ? u.id : null, entidad, id, accion, typeof detalle === 'string' ? detalle : JSON.stringify(detalle ?? ''));
  const cfg = (k, d) => (db.prepare('SELECT valor FROM config WHERE clave=?').get(k) || {}).valor ?? d;
  const setCfg = (k, v) => db.prepare('INSERT INTO config VALUES(?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor').run(k, v);

  // ---- seed de catálogos ----
  if (!db.prepare('SELECT 1 FROM checklist_plantillas').get()) {
    const ins = db.prepare('INSERT INTO checklist_plantillas(tipo_proyecto,orden,actividad) VALUES(?,?,?)');
    for (const [tp, acts] of Object.entries(PLANTILLAS)) acts.forEach((a, i) => ins.run(tp, i + 1, a));
  }
  if (!db.prepare('SELECT 1 FROM parametros_def').get()) {
    const ins = db.prepare('INSERT INTO parametros_def(nombre,unidad,orden) VALUES(?,?,?)'); PARAMS_DEF.forEach(([n, u], i) => ins.run(n, u, i + 1));
  }
  if (!cfg('color_primario')) { setCfg('color_primario', '#0b2545'); setCfg('color_secundario', '#13a89e'); }

  // ---- helpers ----
  const cargarChecklist = (tid, tipo) => {
    db.prepare('DELETE FROM ticket_checklist WHERE ticket_id=?').run(tid);
    const ins = db.prepare('INSERT INTO ticket_checklist(ticket_id,orden,actividad) VALUES(?,?,?)');
    db.prepare('SELECT * FROM checklist_plantillas WHERE tipo_proyecto=? ORDER BY orden,id').all(tipo).forEach(p => ins.run(tid, p.orden, p.actividad));
  };
  const historial = (tid, estado, u, nota, lat, lng) => db.prepare('INSERT INTO ticket_estados(ticket_id,estado,ts,user_id,nota,lat,lng) VALUES(?,?,?,?,?,?,?)')
    .run(tid, estado, ahora(), u ? u.id : null, nota || '', lat ?? null, lng ?? null);
  const apoyoIds = (t) => String(t.apoyo || '').split(',').filter(Boolean).map(Number);
  const puedeVer = (t, u) => u.rol === 'admin' || t.tecnico_id === u.id || apoyoIds(t).includes(u.id);
  const getT = (id) => db.prepare('SELECT * FROM tickets WHERE id=?').get(id);
  const nombreU = (id) => (db.prepare('SELECT nombre FROM users WHERE id=?').get(id) || {}).nombre || '';
  const completo = (t) => {
    if (!t) return t;
    const r = { ...t, parametros: JSON.parse(t.parametros || '{}'), apoyo_ids: apoyoIds(t) };
    r.tecnico = nombreU(t.tecnico_id); r.apoyo_nombres = r.apoyo_ids.map(nombreU);
    r.checklist = db.prepare('SELECT * FROM ticket_checklist WHERE ticket_id=? ORDER BY orden,id').all(t.id);
    r.fotos = db.prepare('SELECT * FROM ticket_fotos WHERE ticket_id=? ORDER BY id').all(t.id);
    r.historial = db.prepare('SELECT e.*, u.nombre usuario FROM ticket_estados e LEFT JOIN users u ON u.id=e.user_id WHERE ticket_id=? ORDER BY e.id').all(t.id);
    r.versiones = db.prepare('SELECT v.*, u.nombre usuario FROM reporte_versiones v LEFT JOIN users u ON u.id=v.user_id WHERE ticket_id=? ORDER BY v.id').all(t.id);
    r.firma_vigente = !!(t.firma_hash && t.firma_version === t.version && hashReporte(r) === t.firma_hash);
    r.estado_txt = ESTADOS[t.estado]; r.tipo_proyecto_txt = TIPOS_PROY[t.tipo_proyecto]; r.tipo_servicio_txt = TIPOS_SERV[t.tipo_servicio];
    return r;
  };
  // Hash del contenido del reporte (lo que el cliente autoriza)
  function hashReporte(r) {
    const c = {
      folio: r.folio, cliente: [r.cliente_nombre, r.direccion, r.ciudad, r.estado_geo, r.cp, r.tienda], equipo: [r.modelo, r.serie, r.modelo_cond, r.serie_cond, r.fecha_compra, r.folio_factura],
      tipo: [r.tipo_proyecto, r.tipo_servicio, r.tipo_servicio_otro], rep: CAMPOS_REPORTE.map(k => k === 'parametros' ? r.parametros : r[k] || ''),
      chk: (r.checklist || []).map(x => [x.actividad, x.estado, x.observacion || '']), fotos: (r.fotos || []).map(f => [f.id, f.etapa, f.descripcion || '']),
      firma: [r.cliente_firma_nombre, r.cliente_firma_cargo, r.cliente_firma_ts], img: r.firma_cliente ? sha(fs.existsSync(path.join(UP, r.firma_cliente)) ? fs.readFileSync(path.join(UP, r.firma_cliente)) : '') : '',
    };
    return sha(JSON.stringify(c));
  }
  const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
  // Cada modificación del reporte después de la firma genera una nueva versión y queda registrada
  const tocar = (t, u, motivo) => {
    if (u.rol !== 'admin' && t.estado === 'revision') { const e = new Error('El servicio está en revisión administrativa; solo la oficina puede modificarlo o devolverlo'); e.code = 423; throw e; }
    if (t.estado === 'cerrado') { const e = new Error('Ticket cerrado: el documento está protegido y no admite cambios'); e.code = 423; throw e; }
    if (t.firma_hash && t.version === t.firma_version) {
      db.prepare('UPDATE tickets SET version=version+1 WHERE id=?').run(t.id);
      db.prepare('INSERT INTO reporte_versiones(ticket_id,version,hash,motivo,ts,user_id) VALUES(?,?,?,?,?,?)').run(t.id, t.version + 1, null, 'Modificación posterior a la firma del cliente: ' + motivo, ahora(), u.id);
      audit(u, 'ticket', t.id, 'modificacion_post_firma', { version: t.version + 1, motivo });
      t.version++;
    }
  };
  const guardarImg = (dataUrl, nombre) => {
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(dataUrl || ''); if (!m) return null;
    const f = `${nombre}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    fs.writeFileSync(path.join(UP, 'tickets', f), Buffer.from(m[2], 'base64')); return 'tickets/' + f;
  };
  const err = (res, e) => res.status(e.code && e.code >= 400 ? e.code : 400).json({ error: e.message });
  const conT = (req, res) => {
    const t = getT(req.params.id);
    if (!t || !puedeVer(t, req.user)) { res.status(404).json({ error: 'Ticket no encontrado' }); return null; }
    return t;
  };
  const notificar = (t, tipo) => avisar(tipo, t.id, [t.tecnico_id, ...apoyoIds(t)]);
  const upsertCliente = (b) => {
    let c = b.cliente_id && db.prepare('SELECT * FROM clientes WHERE id=?').get(b.cliente_id);
    if (!c && b.cliente_nombre) c = db.prepare('SELECT * FROM clientes WHERE lower(nombre)=lower(?)').get(String(b.cliente_nombre).trim());
    const d = ['contacto', 'telefono', 'email', 'direccion', 'ciudad', 'estado_geo', 'cp'];
    if (c) { db.prepare(`UPDATE clientes SET ${d.map(k => `${k}=COALESCE(NULLIF(?,''),${k})`).join(',')} WHERE id=?`).run(...d.map(k => b[k] || ''), c.id); return c.id; }
    return db.prepare(`INSERT INTO clientes(nombre,${d.join(',')},creado) VALUES(?,${d.map(() => '?').join(',')},?)`).run(String(b.cliente_nombre).trim(), ...d.map(k => b[k] || ''), ahora()).lastInsertRowid;
  };

  // ---- creación de tickets ----
  const REQ = { cliente_nombre: 'Nombre del cliente', telefono: 'Teléfono', direccion: 'Dirección del servicio', ciudad: 'Ciudad', fecha_programada: 'Fecha programada', tipo_proyecto: 'Tipo de proyecto', tipo_servicio: 'Tipo de servicio' };
  const crearTicket = db.transaction((b, u) => {
    for (const [k, n] of Object.entries(REQ)) if (!String(b[k] ?? '').trim()) throw new Error('Falta campo obligatorio: ' + n);
    if (!TIPOS_PROY[b.tipo_proyecto]) throw new Error('Tipo de proyecto inválido');
    if (!TIPOS_SERV[b.tipo_servicio]) throw new Error('Tipo de servicio inválido');
    if (b.tipo_servicio === 'otro' && !String(b.tipo_servicio_otro || '').trim()) throw new Error('Describe el tipo de servicio "Otro"');
    const cliente_id = upsertCliente(b), tec = b.tecnico_id ? +b.tecnico_id : null;
    if (tec && !db.prepare("SELECT 1 FROM users WHERE id=? AND rol='tecnico' AND activo=1").get(tec)) throw new Error('Técnico inválido');
    const apoyo = (Array.isArray(b.apoyo) ? b.apoyo : String(b.apoyo || '').split(',')).map(Number).filter(x => x && x !== tec);
    const estado = tec ? 'asignado' : 'nuevo';
    const carrierFlag = b.cliente_carrier === undefined ? 1 : (b.cliente_carrier ? 1 : 0);
    const cols = ['creado', 'creado_por', 'fecha_programada', 'cliente_id', 'cliente_nombre', 'contacto', 'telefono', 'email', 'direccion', 'ciudad', 'estado_geo', 'cp', 'tienda',
      'modelo', 'serie', 'modelo_cond', 'serie_cond', 'fecha_compra', 'folio_factura', 'centro_servicio', 'tipo_proyecto', 'tipo_servicio', 'tipo_servicio_otro',
      'tecnico_id', 'apoyo', 'obs_iniciales', 'cliente_carrier', 'estado', 'demo'];
    const v = { ...b, creado: b.creado || ahora(), creado_por: u.id, cliente_id, tecnico_id: tec, apoyo: apoyo.length ? ',' + apoyo.join(',') + ',' : '', estado,
      cliente_carrier: carrierFlag, centro_servicio: b.centro_servicio || 'Clima 3', demo: b.demo ? 1 : 0, serie: String(b.serie || '').trim().toUpperCase(), serie_cond: String(b.serie_cond || '').trim().toUpperCase() };
    const id = db.prepare(`INSERT INTO tickets(${cols.join(',')}) VALUES(${cols.map(() => '?').join(',')})`).run(...cols.map(k => v[k] ?? null)).lastInsertRowid;
    const folio = `C3-${new Date(v.creado).getFullYear()}-${String(id).padStart(5, '0')}`;
    db.prepare('UPDATE tickets SET folio=? WHERE id=?').run(folio, id);
    cargarChecklist(id, b.tipo_proyecto);
    historial(id, 'nuevo', u, 'Ticket creado');
    if (tec) historial(id, 'asignado', u, 'Asignado a ' + nombreU(tec));
    audit(u, 'ticket', id, 'crear', { folio, tipo_proyecto: b.tipo_proyecto, tecnico_id: tec });
    return id;
  });
  app.post('/api/tickets', auth('admin'), (req, res) => {
    try { const id = crearTicket(req.body, req.user); const t = getT(id); notificar(t, 'ticket_asignado'); res.json({ id, folio: t.folio }); } catch (e) { err(res, e); }
  });

  // ---- consulta ----
  const filtros = (q) => {
    const w = [], p = [];
    if (q.desde) { w.push('substr(t.creado,1,10)>=?'); p.push(q.desde); }
    if (q.hasta) { w.push('substr(t.creado,1,10)<=?'); p.push(q.hasta); }
    if (q.tecnico) { w.push("(t.tecnico_id=? OR t.apoyo LIKE ?)"); p.push(+q.tecnico, `%,${+q.tecnico},%`); }
    if (q.cliente) { w.push('(t.cliente_id=? OR lower(t.cliente_nombre) LIKE lower(?))'); p.push(+q.cliente || -1, `%${q.cliente}%`); }
    if (q.tipo_proyecto) { w.push('t.tipo_proyecto=?'); p.push(q.tipo_proyecto); }
    if (q.estado) { const es = String(q.estado).split(','); w.push(`t.estado IN (${es.map(() => '?').join(',')})`); p.push(...es); }
    if (q.q) { w.push('(t.folio LIKE ? OR lower(t.cliente_nombre) LIKE lower(?) OR t.serie LIKE ? OR t.serie_cond LIKE ?)'); p.push(...Array(4).fill(`%${q.q}%`)); }
    return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
  };
  const RESUMEN = `SELECT t.id,t.folio,t.creado,t.fecha_programada,t.cliente_id,t.cliente_nombre,t.direccion,t.ciudad,t.estado_geo,t.modelo,t.serie,t.tipo_proyecto,
    t.tipo_servicio,t.tipo_servicio_otro,t.tecnico_id,t.apoyo,t.estado,t.cliente_carrier,t.llegada_ts,t.fin_ts,t.cerrado_ts,t.version,u.nombre tecnico,
    (SELECT COUNT(*) FROM ticket_checklist c WHERE c.ticket_id=t.id) chk_total, (SELECT COUNT(*) FROM ticket_checklist c WHERE c.ticket_id=t.id AND c.estado!='pendiente') chk_hechas,
    (SELECT COUNT(*) FROM ticket_fotos f WHERE f.ticket_id=t.id) fotos FROM tickets t LEFT JOIN users u ON u.id=t.tecnico_id`;
  app.get('/api/tickets', auth(), (req, res) => {
    const f = filtros(req.user.rol === 'admin' ? req.query : { estado: req.query.estado });
    let sql = `${RESUMEN} ${f.where}`;
    if (req.user.rol !== 'admin') { sql += (f.where ? ' AND' : ' WHERE') + ' (t.tecnico_id=? OR t.apoyo LIKE ?)'; f.p.push(req.user.id, `%,${req.user.id},%`); }
    res.json(db.prepare(sql + ' ORDER BY t.fecha_programada DESC, t.id DESC').all(...f.p).map(t => ({ ...t, estado_txt: ESTADOS[t.estado], tipo_proyecto_txt: TIPOS_PROY[t.tipo_proyecto] })));
  });
  app.get('/api/tickets/:id', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const r = completo(t); if (req.user.rol === 'admin') r.auditoria = db.prepare("SELECT a.*, u.nombre usuario FROM auditoria a LEFT JOIN users u ON u.id=a.user_id WHERE entidad='ticket' AND entidad_id=? ORDER BY a.id DESC").all(t.id);
    res.json(r);
  });

  // ---- edición ----
  app.patch('/api/tickets/:id', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    try {
      const b = req.body, admin = req.user.rol === 'admin';
      const permitidos = admin ? [...new Set([...CAMPOS_ADMIN, ...CAMPOS_REPORTE])] : CAMPOS_REPORTE;
      const cambios = {};
      for (const k of permitidos) if (b[k] !== undefined) {
        let v = b[k];
        if (k === 'parametros') v = JSON.stringify(v || {});
        else if (k === 'apoyo') v = (Array.isArray(v) ? v : String(v).split(',')).map(Number).filter(Boolean); 
        else if (k === 'cliente_carrier') v = v ? 1 : 0;
        else if (k === 'tecnico_id') v = v ? +v : null;
        else if (k === 'serie' || k === 'serie_cond') v = String(v || '').trim().toUpperCase();
        else v = v === null ? null : String(v);
        if (k === 'apoyo') v = v.length ? ',' + v.join(',') + ',' : '';
        if (k === 'resultado' && v && !['terminado', 'suspendido'].includes(v)) throw new Error('Resultado inválido');
        if (k === 'tipo_proyecto' && !TIPOS_PROY[v]) throw new Error('Tipo de proyecto inválido');
        if (k === 'tipo_servicio' && v && !TIPOS_SERV[v]) throw new Error('Tipo de servicio inválido');
        if (String(t[k] ?? '') !== String(v ?? '')) cambios[k] = v;
      }
      if (!Object.keys(cambios).length) return res.json({ ok: true, sin_cambios: true });
      const reporte = Object.keys(cambios).some(k => !['tecnico_id', 'apoyo', 'fecha_programada', 'obs_iniciales', 'cliente_carrier', 'contacto', 'telefono', 'email'].includes(k));
      db.transaction(() => {
        if (reporte) tocar(t, req.user, Object.keys(cambios).join(', '));
        db.prepare(`UPDATE tickets SET ${Object.keys(cambios).map(k => k + '=?').join(',')} WHERE id=?`).run(...Object.values(cambios), t.id);
        if (cambios.tipo_proyecto) { cargarChecklist(t.id, cambios.tipo_proyecto); audit(req.user, 'ticket', t.id, 'cambio_checklist', `${t.tipo_proyecto} → ${cambios.tipo_proyecto}`); }
        if ('tecnico_id' in cambios && cambios.tecnico_id && t.estado === 'nuevo') { db.prepare("UPDATE tickets SET estado='asignado' WHERE id=?").run(t.id); historial(t.id, 'asignado', req.user, 'Asignado a ' + nombreU(cambios.tecnico_id)); }
        else if ('tecnico_id' in cambios) historial(t.id, getT(t.id).estado, req.user, 'Técnico responsable: ' + (nombreU(cambios.tecnico_id) || 'sin asignar'));
        audit(req.user, 'ticket', t.id, 'editar', Object.fromEntries(Object.entries(cambios).map(([k, v]) => [k, { antes: k === 'parametros' ? '…' : t[k], despues: k === 'parametros' ? '…' : v }])));
      })();
      const n = getT(t.id); if ('tecnico_id' in cambios) notificar(n, 'ticket_asignado'); else notificar(n, 'ticket');
      res.json({ ok: true, version: n.version });
    } catch (e) { err(res, e); }
  });
  app.put('/api/tickets/:id/checklist', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const cur = Object.fromEntries(db.prepare('SELECT * FROM ticket_checklist WHERE ticket_id=?').all(t.id).map(x => [x.id, x]));
      const cambia = items.filter(i => cur[i.id] && (cur[i.id].estado !== i.estado || (cur[i.id].observacion || '') !== (i.observacion || '')));
      for (const i of cambia) if (!CHECK_ESTADOS[i.estado]) throw new Error('Estado de actividad inválido');
      if (!cambia.length) return res.json({ ok: true, sin_cambios: true });
      db.transaction(() => {
        tocar(t, req.user, 'checklist');
        const up = db.prepare('UPDATE ticket_checklist SET estado=?, observacion=?, ts=? WHERE id=? AND ticket_id=?');
        cambia.forEach(i => up.run(i.estado, String(i.observacion || ''), ahora(), i.id, t.id));
        audit(req.user, 'ticket', t.id, 'checklist', cambia.map(i => `${cur[i.id].actividad.slice(0, 40)}: ${cur[i.id].estado}→${i.estado}`).join(' | '));
      })();
      notificar(t, 'ticket'); res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  // ---- flujo de estados ----
  const FLUJO_TEC = {
    asignado: ['aceptado'], aceptado: ['traslado', 'en_sitio'], traslado: ['en_sitio'], en_sitio: ['ejecucion'], ejecucion: ['pend_autorizacion', 'suspendido'],
    pend_autorizacion: ['ejecucion'], suspendido: ['ejecucion', 'revision'], terminado: ['revision'],
  };
  app.post('/api/tickets/:id/estado', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const b = req.body, nuevo = b.estado, admin = req.user.rol === 'admin';
    if (!ESTADOS[nuevo]) return res.status(400).json({ error: 'Estado inválido' });
    if (t.estado === nuevo) return res.json({ ok: true, sin_cambios: true }); // idempotente (re-sincronización offline)
    if (!admin && !(FLUJO_TEC[t.estado] || []).includes(nuevo)) return res.status(400).json({ error: `No se puede pasar de "${ESTADOS[t.estado]}" a "${ESTADOS[nuevo]}"` });
    if (t.estado === 'cerrado' && !admin) return res.status(423).json({ error: 'Ticket cerrado' });
    if (nuevo === 'pend_autorizacion' && !t.resultado) return res.status(400).json({ error: 'Selecciona trabajo terminado o suspendido' });
    if (nuevo === 'revision') {
      const faltan = [];
      if (!t.firma_cliente) faltan.push('firma del cliente'); if (!t.firma_tecnico) faltan.push('firma del técnico');
      const etapas = db.prepare('SELECT DISTINCT etapa FROM ticket_fotos WHERE ticket_id=?').all(t.id).map(x => x.etapa);
      for (const e of (t.resultado === 'suspendido' ? ['antes'] : ['antes', 'durante', 'despues'])) if (!etapas.includes(e)) faltan.push('fotos ' + ETAPAS[e].toLowerCase());
      if (!t.descripcion) faltan.push('descripción de los trabajos');
      if (t.firma_hash && t.firma_version !== t.version) faltan.push('nueva firma del cliente (el reporte cambió después de firmar)');
      if (faltan.length) return res.status(400).json({ error: 'Falta: ' + faltan.join(', ') });
    }
    if (nuevo === 'cerrado' && !['revision', 'terminado', 'suspendido'].includes(t.estado)) return res.status(400).json({ error: 'Solo se cierran tickets enviados a revisión' });
    const set = { estado: nuevo };
    if (nuevo === 'en_sitio') Object.assign(set, { llegada_ts: ahora(), llegada_lat: b.lat ?? null, llegada_lng: b.lng ?? null });
    if (nuevo === 'ejecucion' && !t.inicio_ts) set.inicio_ts = ahora();
    if (nuevo === 'cerrado') set.cerrado_ts = ahora();
    if (nuevo === 'aceptado' && !t.tecnico_id) set.tecnico_id = req.user.id;
    db.transaction(() => {
      db.prepare(`UPDATE tickets SET ${Object.keys(set).map(k => k + '=?').join(',')} WHERE id=?`).run(...Object.values(set), t.id);
      historial(t.id, nuevo, req.user, b.nota, b.lat, b.lng);
      audit(req.user, 'ticket', t.id, 'estado', `${t.estado} → ${nuevo}${b.nota ? ' · ' + b.nota : ''}`);
    })();
    if (nuevo === 'revision' || nuevo === 'cerrado') { try { guardarPDF(getT(t.id), req.user, nuevo === 'cerrado' ? 'Cierre autorizado' : 'Enviado a revisión'); } catch (e) { console.error(e); } }
    notificar(t, 'ticket'); res.json({ ok: true });
  });

  // ---- fotografías ----
  app.post('/api/tickets/:id/fotos', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const b = req.body;
    if (!ETAPAS[b.etapa]) return res.status(400).json({ error: 'Etapa inválida' });
    if (b.cid) { const ya = db.prepare('SELECT id FROM ticket_fotos WHERE cid=?').get(String(b.cid)); if (ya) return res.json({ id: ya.id, duplicada: true }); }
    try {
      tocar(t, req.user, 'foto agregada');
      const f = guardarImg(b.imagen, `foto-${t.id}-${b.etapa}`); if (!f) return res.status(400).json({ error: 'Imagen inválida (usa JPG, PNG o WEBP)' });
      const id = db.prepare('INSERT INTO ticket_fotos(ticket_id,etapa,archivo,descripcion,ts_captura,ts_carga,user_id,cid) VALUES(?,?,?,?,?,?,?,?)')
        .run(t.id, b.etapa, f, String(b.descripcion || ''), b.ts_captura || ahora(), ahora(), req.user.id, b.cid ? String(b.cid) : null).lastInsertRowid;
      audit(req.user, 'ticket', t.id, 'foto', `${b.etapa}: ${f}`); notificar(t, 'ticket'); res.json({ id, archivo: f });
    } catch (e) { err(res, e); }
  });
  app.patch('/api/tickets/:id/fotos/:fid', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const f = db.prepare('SELECT * FROM ticket_fotos WHERE id=? AND ticket_id=?').get(req.params.fid, t.id); if (!f) return res.status(404).json({ error: 'Foto no encontrada' });
    try { if ((f.descripcion || '') === String(req.body.descripcion || '')) return res.json({ ok: true }); tocar(t, req.user, 'descripción de foto');
      db.prepare('UPDATE ticket_fotos SET descripcion=? WHERE id=?').run(String(req.body.descripcion || ''), f.id); audit(req.user, 'ticket', t.id, 'foto_desc', f.archivo); res.json({ ok: true }); } catch (e) { err(res, e); }
  });
  app.delete('/api/tickets/:id/fotos/:fid', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const f = db.prepare('SELECT * FROM ticket_fotos WHERE id=? AND ticket_id=?').get(req.params.fid, t.id); if (!f) return res.status(404).json({ error: 'Foto no encontrada' });
    try { tocar(t, req.user, 'foto eliminada'); db.prepare('DELETE FROM ticket_fotos WHERE id=?').run(f.id); audit(req.user, 'ticket', t.id, 'foto_eliminada', f.archivo); res.json({ ok: true }); } catch (e) { err(res, e); }
  });

  // ---- firmas ----
  app.post('/api/tickets/:id/firma-tecnico', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    if (req.user.rol !== 'admin' && t.tecnico_id !== req.user.id) return res.status(403).json({ error: 'Solo el técnico responsable firma' });
    if (t.estado === 'cerrado') return res.status(423).json({ error: 'Ticket cerrado' });
    const f = guardarImg(req.body.imagen, `firma-tec-${t.id}`); if (!f) return res.status(400).json({ error: 'Firma inválida' });
    db.prepare('UPDATE tickets SET firma_tecnico=?, firma_tecnico_ts=? WHERE id=?').run(f, ahora(), t.id);
    audit(req.user, 'ticket', t.id, 'firma_tecnico', f); res.json({ ok: true });
  });
  app.post('/api/tickets/:id/firma-cliente', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const b = req.body;
    if (b.cid && t.firma_cliente && cfg('firma_cid_' + t.id) === String(b.cid)) return res.json({ ok: true, duplicada: true });
    if (!['pend_autorizacion', 'terminado', 'suspendido'].includes(t.estado)) return res.status(400).json({ error: 'El cliente firma después de marcar el trabajo como terminado o suspendido' });
    if (!t.resultado) return res.status(400).json({ error: 'Falta el resultado del servicio' });
    if (!String(b.nombre || '').trim()) return res.status(400).json({ error: 'Falta el nombre de quien autoriza' });
    const f = guardarImg(b.imagen, `firma-cli-${t.id}`); if (!f) return res.status(400).json({ error: 'Firma inválida' });
    db.transaction(() => {
      const re = !!t.firma_cliente;
      if (b.comentarios_cliente !== undefined && b.comentarios_cliente !== t.comentarios_cliente) db.prepare('UPDATE tickets SET comentarios_cliente=? WHERE id=?').run(String(b.comentarios_cliente), t.id);
      const ts = ahora(), nuevoEstado = t.resultado === 'suspendido' ? 'suspendido' : 'terminado';
      db.prepare('UPDATE tickets SET firma_cliente=?, cliente_firma_nombre=?, cliente_firma_cargo=?, cliente_firma_ts=?, estado=?, fin_ts=COALESCE(fin_ts,?) WHERE id=?')
        .run(f, String(b.nombre).trim(), String(b.cargo || ''), ts, nuevoEstado, ts, t.id);
      const r = completo(getT(t.id)), h = hashReporte(r);
      db.prepare('UPDATE tickets SET firma_hash=?, firma_version=version WHERE id=?').run(h, t.id);
      db.prepare('INSERT INTO reporte_versiones(ticket_id,version,hash,motivo,ts,user_id) VALUES(?,?,?,?,?,?)').run(t.id, r.version, h, re ? 'Nueva firma del cliente' : 'Firma del cliente', ts, req.user.id);
      if (t.estado !== nuevoEstado) historial(t.id, nuevoEstado, req.user, 'Firmado por ' + String(b.nombre).trim());
      audit(req.user, 'ticket', t.id, re ? 'refirma_cliente' : 'firma_cliente', { version: r.version, hash: h, nombre: b.nombre });
      if (b.cid) setCfg('firma_cid_' + t.id, String(b.cid));
    })();
    const n = getT(t.id); try { guardarPDF(n, req.user, 'Reporte firmado'); } catch (e) { console.error(e); }
    notificar(n, 'ticket'); res.json({ ok: true, version: n.version, hash: n.firma_hash });
  });

  // archivos protegidos (fotos y firmas): solo usuarios con acceso al ticket
  app.get('/api/archivo/:id/:nombre', auth(), (req, res) => {
    const t = conT(req, res); if (!t) return;
    const n = path.basename(req.params.nombre);
    if (!n.includes(`-${t.id}-`)) return res.status(404).end();
    res.sendFile(path.join(UP, 'tickets', n), (e) => e && !res.headersSent && res.status(404).end());
  });
  // ---- Técnico Carrier autorizado (bloque TÉCNICO CARRIER del formato Carrier) ----
  // Las imágenes NO se guardan en el repositorio (es público): se toman de la configuración (BD), de variables de entorno
  // CARRIER_TEC_NOMBRE_B64 / CARRIER_TEC_FIRMA_B64 (PNG en base64) o de la carpeta privado/ (ignorada por git).
  if (!cfg('carrier_tec_nombre')) setCfg('carrier_tec_nombre', 'Andrés Páez Félix');
  const imgCarrier = (clave, archivo, env) => {
    const d = cfg(clave); const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(d || '');
    if (m) return { buf: Buffer.from(m[2], 'base64'), origen: 'subida por administrador' };
    if (process.env[env]) return { buf: Buffer.from(process.env[env].replace(/^data:image\/\w+;base64,/, ''), 'base64'), origen: 'variable de entorno' };
    const f = path.join(dir, 'privado', archivo); if (fs.existsSync(f)) return { buf: fs.readFileSync(f), origen: 'archivo inicial' };
    return null;
  };
  const tecCarrier = () => ({ nombre: cfg('carrier_tec_nombre', 'Andrés Páez Félix'),
    nombre_img: imgCarrier('carrier_tec_nombre_img', 'carrier_tec_nombre.png', 'CARRIER_TEC_NOMBRE_B64'),
    firma_img: imgCarrier('carrier_tec_firma_img', 'carrier_tec_firma.png', 'CARRIER_TEC_FIRMA_B64') });
  app.get('/api/tecnico-carrier', auth('admin'), (req, res) => {
    const t = tecCarrier(), url = (x) => x ? 'data:image/png;base64,' + x.buf.toString('base64') : null;
    res.json({ nombre: t.nombre, nombre_img: url(t.nombre_img), firma_img: url(t.firma_img), nombre_origen: t.nombre_img?.origen || null, firma_origen: t.firma_img?.origen || null });
  });
  app.put('/api/tecnico-carrier', auth('admin'), (req, res) => {
    const b = req.body, ok = (x) => /^data:image\/(png|jpe?g);base64,/.test(x);
    if (b.nombre !== undefined) { if (!String(b.nombre).trim()) return res.status(400).json({ error: 'Falta el nombre' }); setCfg('carrier_tec_nombre', String(b.nombre).trim()); }
    for (const k of ['nombre_img', 'firma_img']) if (b[k] !== undefined) {
      if (b[k] === null) db.prepare('DELETE FROM config WHERE clave=?').run('carrier_tec_' + k);
      else if (!ok(b[k])) return res.status(400).json({ error: 'Imagen inválida (PNG o JPG)' }); else setCfg('carrier_tec_' + k, b[k]);
    }
    audit(req.user, 'config', null, 'tecnico_carrier', { nombre: b.nombre, nombre_img: b.nombre_img === undefined ? undefined : (b.nombre_img ? 'nueva imagen' : 'restablecida'), firma_img: b.firma_img === undefined ? undefined : (b.firma_img ? 'nueva imagen' : 'restablecida') });
    res.json({ ok: true });
  });
  // ---- PDF ----
  const datosPDF = (t) => ({ ...completo(t), TIPOS_PROY, TIPOS_SERV, ESTADOS, CHECK_ESTADOS, ETAPAS, defs: db.prepare('SELECT * FROM parametros_def ORDER BY orden,id').all(), up: UP, pub: path.join(dir, 'public'), carrierTec: tecCarrier() });
  function guardarPDF(t, u, motivo) {
    return generarPDF(datosPDF(t), {}).then(buf => {
      const f = `pdf/${t.folio}-v${t.version}.pdf`; fs.writeFileSync(path.join(UP, f), buf);
      const v = db.prepare('SELECT id FROM reporte_versiones WHERE ticket_id=? AND version=? ORDER BY id DESC').get(t.id, t.version);
      if (v) db.prepare('UPDATE reporte_versiones SET pdf=? WHERE id=?').run(f, v.id);
      else db.prepare('INSERT INTO reporte_versiones(ticket_id,version,hash,motivo,ts,user_id,pdf) VALUES(?,?,?,?,?,?,?)').run(t.id, t.version, null, motivo, ahora(), u.id, f);
    }).catch(e => console.error('PDF', e));
  }
  app.get('/api/tickets/:id/pdf', auth(), async (req, res) => {
    const t = conT(req, res); if (!t) return;
    try {
      const formato = ['carrier', 'clima3', 'fotos'].includes(req.query.formato) ? req.query.formato : 'completo';
      const buf = await generarPDF(datosPDF(t), { formato });
      const nombre = `${t.folio}${formato === 'carrier' ? '-formato-carrier' : formato === 'fotos' ? '-reporte-fotografico' : ''}-v${t.version}.pdf`;
      audit(req.user, 'ticket', t.id, 'pdf_descarga', formato);
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.descargar ? 'attachment' : 'inline'}; filename="${nombre}"` }).send(buf);
    } catch (e) { console.error(e); res.status(500).json({ error: 'No se pudo generar el PDF: ' + e.message }); }
  });

  // ---- catálogos / configuración ----
  app.get('/api/catalogos', auth(), (req, res) => res.json({
    TIPOS_PROY, TIPOS_SERV, ESTADOS, CHECK_ESTADOS, ETAPAS,
    tecnicos: db.prepare("SELECT id,nombre,activo FROM users WHERE rol='tecnico' ORDER BY nombre").all(),
    parametros: db.prepare('SELECT * FROM parametros_def ORDER BY orden,id').all(),
    plantillas: db.prepare('SELECT * FROM checklist_plantillas ORDER BY tipo_proyecto,orden,id').all(),
  }));
  app.get('/api/config', (req, res) => res.json({ color_primario: cfg('color_primario'), color_secundario: cfg('color_secundario') }));
  app.put('/api/config', auth('admin'), (req, res) => {
    const ok = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
    for (const k of ['color_primario', 'color_secundario']) if (req.body[k] !== undefined) { if (!ok(req.body[k])) return res.status(400).json({ error: 'Color inválido' }); setCfg(k, req.body[k]); }
    audit(req.user, 'config', null, 'colores', req.body); res.json({ ok: true });
  });
  // plantillas de checklist (configurables sin tocar código)
  app.post('/api/plantillas', auth('admin'), (req, res) => {
    const b = req.body; if (!TIPOS_PROY[b.tipo_proyecto] || !String(b.actividad || '').trim()) return res.status(400).json({ error: 'Faltan datos' });
    const o = (db.prepare('SELECT MAX(orden) m FROM checklist_plantillas WHERE tipo_proyecto=?').get(b.tipo_proyecto).m || 0) + 1;
    const id = db.prepare('INSERT INTO checklist_plantillas(tipo_proyecto,orden,actividad) VALUES(?,?,?)').run(b.tipo_proyecto, o, String(b.actividad).trim()).lastInsertRowid;
    audit(req.user, 'plantilla', id, 'agregar', b); res.json({ id });
  });
  app.put('/api/plantillas/:id', auth('admin'), (req, res) => {
    const p = db.prepare('SELECT * FROM checklist_plantillas WHERE id=?').get(req.params.id); if (!p) return res.status(404).json({ error: 'No encontrada' });
    if (req.body.mover) { // intercambia con la vecina
      const v = db.prepare(`SELECT * FROM checklist_plantillas WHERE tipo_proyecto=? AND orden ${req.body.mover < 0 ? '<' : '>'} ? ORDER BY orden ${req.body.mover < 0 ? 'DESC' : 'ASC'} LIMIT 1`).get(p.tipo_proyecto, p.orden);
      if (v) { db.prepare('UPDATE checklist_plantillas SET orden=? WHERE id=?').run(v.orden, p.id); db.prepare('UPDATE checklist_plantillas SET orden=? WHERE id=?').run(p.orden, v.id); }
    }
    if (req.body.actividad !== undefined) { if (!String(req.body.actividad).trim()) return res.status(400).json({ error: 'Actividad vacía' }); db.prepare('UPDATE checklist_plantillas SET actividad=? WHERE id=?').run(String(req.body.actividad).trim(), p.id); }
    audit(req.user, 'plantilla', p.id, 'editar', { antes: p.actividad, ...req.body }); res.json({ ok: true });
  });
  app.delete('/api/plantillas/:id', auth('admin'), (req, res) => {
    const p = db.prepare('SELECT * FROM checklist_plantillas WHERE id=?').get(req.params.id); if (!p) return res.status(404).json({ error: 'No encontrada' });
    db.prepare('DELETE FROM checklist_plantillas WHERE id=?').run(p.id); audit(req.user, 'plantilla', p.id, 'eliminar', p.actividad); res.json({ ok: true });
  });
  // parámetros de operación configurables
  app.post('/api/parametros-def', auth('admin'), (req, res) => {
    if (!String(req.body.nombre || '').trim()) return res.status(400).json({ error: 'Falta nombre' });
    const o = (db.prepare('SELECT MAX(orden) m FROM parametros_def').get().m || 0) + 1;
    const id = db.prepare('INSERT INTO parametros_def(nombre,unidad,orden) VALUES(?,?,?)').run(String(req.body.nombre).trim(), String(req.body.unidad || ''), o).lastInsertRowid;
    audit(req.user, 'parametro', id, 'agregar', req.body); res.json({ id });
  });
  app.put('/api/parametros-def/:id', auth('admin'), (req, res) => {
    db.prepare('UPDATE parametros_def SET nombre=COALESCE(?,nombre), unidad=COALESCE(?,unidad) WHERE id=?').run(req.body.nombre ?? null, req.body.unidad ?? null, req.params.id);
    audit(req.user, 'parametro', +req.params.id, 'editar', req.body); res.json({ ok: true });
  });
  app.delete('/api/parametros-def/:id', auth('admin'), (req, res) => {
    db.prepare('DELETE FROM parametros_def WHERE id=?').run(req.params.id); audit(req.user, 'parametro', +req.params.id, 'eliminar', ''); res.json({ ok: true });
  });

  // ---- clientes / expediente ----
  app.get('/api/clientes', auth('admin'), (req, res) => {
    const q = `%${req.query.q || ''}%`;
    res.json(db.prepare(`SELECT c.*, COUNT(t.id) tickets, MAX(t.fecha_programada) ultimo FROM clientes c LEFT JOIN tickets t ON t.cliente_id=c.id
      WHERE lower(c.nombre) LIKE lower(?) OR c.id IN (SELECT cliente_id FROM tickets WHERE serie LIKE ? OR serie_cond LIKE ?) GROUP BY c.id ORDER BY c.nombre`).all(q, q, q));
  });
  app.put('/api/clientes/:id', auth('admin'), (req, res) => {
    const d = ['nombre', 'contacto', 'telefono', 'email', 'direccion', 'ciudad', 'estado_geo', 'cp'];
    db.prepare(`UPDATE clientes SET ${d.map(k => `${k}=COALESCE(?,${k})`).join(',')} WHERE id=?`).run(...d.map(k => req.body[k] ?? null), req.params.id);
    audit(req.user, 'cliente', +req.params.id, 'editar', req.body); res.json({ ok: true });
  });
  app.get('/api/expediente/:id', auth('admin'), (req, res) => {
    const c = db.prepare('SELECT * FROM clientes WHERE id=?').get(req.params.id); if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
    const tickets = db.prepare('SELECT * FROM tickets WHERE cliente_id=? ORDER BY fecha_programada DESC, id DESC').all(c.id).map(completo);
    const equipos = {};
    for (const t of tickets) for (const [m, s, tipo] of [[t.modelo, t.serie, 'Evaporadora / equipo'], [t.modelo_cond, t.serie_cond, 'Condensadora']]) if (s) {
      equipos[s] = equipos[s] || { serie: s, modelo: m, tipo, fecha_compra: t.fecha_compra, tienda: t.tienda, servicios: [] };
      equipos[s].servicios.push({ folio: t.folio, id: t.id, fecha: t.fecha_programada, tipo_proyecto: TIPOS_PROY[t.tipo_proyecto], estado: ESTADOS[t.estado] });
    }
    const pendientes = [];
    for (const t of tickets) {
      if (t.recomendaciones) pendientes.push({ folio: t.folio, id: t.id, fecha: t.fecha_programada, texto: t.recomendaciones });
      for (const x of t.checklist) if (['atencion', 'pospuesto'].includes(x.estado)) pendientes.push({ folio: t.folio, id: t.id, fecha: t.fecha_programada, texto: `${CHECK_ESTADOS[x.estado]}: ${x.actividad}${x.observacion ? ' — ' + x.observacion : ''}` });
    }
    res.json({ cliente: c, equipos: Object.values(equipos), tickets, pendientes });
  });
  // recuperar datos de un equipo por número de serie
  app.get('/api/equipos/buscar', auth(), (req, res) => {
    const s = String(req.query.serie || '').trim().toUpperCase(); if (s.length < 3) return res.json({ encontrado: false, servicios: [] });
    let rows = db.prepare('SELECT * FROM tickets WHERE serie=? OR serie_cond=? ORDER BY id DESC').all(s, s);
    if (req.user.rol !== 'admin') rows = rows.filter(t => puedeVer(t, req.user));
    if (!rows.length) return res.json({ encontrado: false, servicios: [] });
    const u = rows[0];
    res.json({ encontrado: true, equipo: { modelo: u.modelo, serie: u.serie, modelo_cond: u.modelo_cond, serie_cond: u.serie_cond, fecha_compra: u.fecha_compra, tienda: u.tienda, folio_factura: u.folio_factura },
      cliente: { cliente_id: u.cliente_id, cliente_nombre: u.cliente_nombre, contacto: u.contacto, telefono: u.telefono, email: u.email, direccion: u.direccion, ciudad: u.ciudad, estado_geo: u.estado_geo, cp: u.cp },
      servicios: rows.map(t => ({ id: t.id, folio: t.folio, fecha: t.fecha_programada, tipo_proyecto: TIPOS_PROY[t.tipo_proyecto], estado: ESTADOS[t.estado], recomendaciones: t.recomendaciones, descripcion: t.descripcion })) });
  });

  // ---- dashboard ----
  app.get('/api/dashboard', auth('admin'), (req, res) => {
    const f = filtros(req.query);
    const rows = db.prepare(`${RESUMEN} ${f.where} ORDER BY t.id DESC`).all(...f.p);
    const cuenta = (key) => { const m = {}; rows.forEach(r => { const k = key(r) || '—'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })); };
    const por_estado = Object.fromEntries(Object.keys(ESTADOS).map(e => [e, rows.filter(r => r.estado === e).length]));
    const dur = rows.filter(r => r.llegada_ts && r.fin_ts).map(r => (new Date(r.fin_ts) - new Date(r.llegada_ts)) / 60000);
    const resp = rows.filter(r => r.llegada_ts).map(r => (new Date(r.llegada_ts) - new Date(r.creado)) / 60000);
    const cierre = rows.filter(r => r.cerrado_ts).map(r => (new Date(r.cerrado_ts) - new Date(r.creado)) / 60000);
    const prom = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    res.json({
      total: rows.length, por_estado,
      grupos: { pendientes: por_estado.nuevo, asignados: por_estado.asignado + por_estado.aceptado, ejecucion: por_estado.traslado + por_estado.en_sitio + por_estado.ejecucion + por_estado.pend_autorizacion,
        suspendidos: por_estado.suspendido, terminados: por_estado.terminado, revision: por_estado.revision, cerrados: por_estado.cerrado },
      por_tecnico: cuenta(r => r.tecnico || 'Sin asignar'), por_tipo_proyecto: cuenta(r => TIPOS_PROY[r.tipo_proyecto]), por_tipo_servicio: cuenta(r => TIPOS_SERV[r.tipo_servicio]),
      por_cliente: cuenta(r => r.cliente_nombre).slice(0, 15),
      tiempo_atencion_min: prom(dur), tiempo_respuesta_min: prom(resp), tiempo_cierre_min: prom(cierre),
      tickets: rows.map(t => ({ ...t, estado_txt: ESTADOS[t.estado], tipo_proyecto_txt: TIPOS_PROY[t.tipo_proyecto] })),
    });
  });
  app.get('/api/auditoria', auth('admin'), (req, res) => res.json(db.prepare(`SELECT a.*, u.nombre usuario, t.folio FROM auditoria a LEFT JOIN users u ON u.id=a.user_id
    LEFT JOIN tickets t ON a.entidad='ticket' AND t.id=a.entidad_id ${req.query.ticket ? 'WHERE a.entidad=\'ticket\' AND a.entidad_id=?' : ''} ORDER BY a.id DESC LIMIT 500`).all(...(req.query.ticket ? [+req.query.ticket] : []))));
  // respaldo de información (copia consistente de la base de datos)
  app.get('/api/respaldo', auth('admin'), async (req, res) => {
    const f = path.join(require('os').tmpdir(), `clima3tec-respaldo-${Date.now()}.db`);
    try { await db.backup(f); audit(req.user, 'sistema', null, 'respaldo', ''); res.download(f, `clima3tec-respaldo-${ahora().slice(0, 10)}.db`, () => fs.unlink(f, () => {})); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ---- datos DEMO ----
  if (!db.prepare('SELECT 1 FROM tickets').get()) {
    const adm = db.prepare("SELECT * FROM users WHERE usuario='admin'").get(), t1 = db.prepare("SELECT id FROM users WHERE usuario='tec1'").get(), t2 = db.prepare("SELECT id FROM users WHERE usuario='tec2'").get();
    const d = (dias, h = 10) => { const x = new Date(); x.setDate(x.getDate() + dias); const z = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}T${z(h)}:00`; };
    const base = { telefono: '6621234567', ciudad: 'Hermosillo', estado_geo: 'Sonora', demo: 1 };
    const S = [
      { cliente_nombre: 'Laura Gómez (DEMO)', contacto: 'Laura Gómez', email: 'laura.demo@ejemplo.com', direccion: 'Calle Yáñez 145, Col. Centro', cp: '83000', tienda: 'Liverpool Galerías', modelo: '38CVURA18', serie: 'DEMO-EVA-1001', modelo_cond: '38CVURA18-C', serie_cond: 'DEMO-CON-1001', fecha_compra: '2026-10-01', tipo_proyecto: 'instalacion', tipo_servicio: 'instalacion', tecnico_id: t1.id, fecha_programada: d(1, 9), obs_iniciales: 'Instalar minisplit inverter 1.5 ton en recámara principal.' },
      { cliente_nombre: 'Farmacia San Benito (DEMO)', contacto: 'Ing. Ramón Ruiz', direccion: 'Blvd. Kino 820, Col. Pitic', cp: '83150', modelo: '50TCQA06', serie: 'DEMO-PAQ-2002', tipo_proyecto: 'instalacion', tipo_servicio: 'instalacion', tecnico_id: t2.id, fecha_programada: d(2, 11), obs_iniciales: 'Paquete 5 ton en azotea, grúa confirmada.' },
      { cliente_nombre: 'Laura Gómez (DEMO)', contacto: 'Laura Gómez', direccion: 'Calle Yáñez 145, Col. Centro', cp: '83000', tienda: 'Liverpool Galerías', modelo: '42QHC012', serie: 'DEMO-EVA-3003', modelo_cond: '38QHC012', serie_cond: 'DEMO-CON-3003', fecha_compra: '2025-06-15', folio_factura: 'CAR-DEMO-7781', tipo_proyecto: 'garantia', tipo_servicio: 'garantia', tecnico_id: t1.id, fecha_programada: d(0, 16), obs_iniciales: 'Cliente reporta que no enfría y marca código E1.' },
      { cliente_nombre: 'Héctor Valenzuela (DEMO)', direccion: 'Av. Rosales 77, Col. Modelo', cp: '83190', tienda: 'Home Depot Solidaridad', modelo: '42KHC018', serie: 'DEMO-EVA-4004', fecha_compra: '2026-03-02', folio_factura: 'CAR-DEMO-7790', tipo_proyecto: 'garantia', tipo_servicio: 'garantia', tecnico_id: t2.id, fecha_programada: d(3, 10), obs_iniciales: 'Gotea agua por la evaporadora.' },
      { cliente_nombre: 'Restaurante El Sahuaro (DEMO)', contacto: 'Gerente Sofía Mendoza', direccion: 'Blvd. Navarrete 300, Col. Valle Hermoso', cp: '83209', modelo: '40MAQB24', serie: 'DEMO-EVA-5005', tipo_proyecto: 'preventivo', tipo_servicio: 'preventivo', tecnico_id: t1.id, fecha_programada: d(4, 8), obs_iniciales: 'Mantenimiento semestral a 3 minisplits del comedor.', cliente_carrier: 0 },
      { cliente_nombre: 'Oficinas Grupo Pitic (DEMO)', direccion: 'Calle Reforma 15, Col. Centro Norte', cp: '83010', modelo: '50TC-D08', serie: 'DEMO-PAQ-6006', tipo_proyecto: 'preventivo', tipo_servicio: 'preventivo', fecha_programada: d(5, 9), obs_iniciales: 'Pendiente de asignar técnico.', cliente_carrier: 0 },
    ];
    for (const s of S) crearTicket({ ...base, cliente_carrier: s.cliente_carrier ?? (s.tipo_proyecto === 'garantia' ? 1 : 1), ...s }, adm);
    // un servicio histórico cerrado para el expediente (mismo equipo DEMO-EVA-3003)
    const hid = crearTicket({ ...base, cliente_nombre: 'Laura Gómez (DEMO)', contacto: 'Laura Gómez', direccion: 'Calle Yáñez 145, Col. Centro', cp: '83000', tienda: 'Liverpool Galerías',
      modelo: '42QHC012', serie: 'DEMO-EVA-3003', modelo_cond: '38QHC012', serie_cond: 'DEMO-CON-3003', fecha_compra: '2025-06-15', tipo_proyecto: 'preventivo', tipo_servicio: 'preventivo',
      tecnico_id: t1.id, fecha_programada: d(-120, 10), creado: new Date(Date.now() - 125 * 864e5).toISOString(), obs_iniciales: 'Mantenimiento anual.' }, adm);
    db.prepare(`UPDATE tickets SET estado='cerrado', llegada_ts=?, inicio_ts=?, fin_ts=?, cerrado_ts=?, resultado='terminado', descripcion='Limpieza de filtros y serpentines, revisión eléctrica y prueba de funcionamiento.',
      estado_equipo='Operando correctamente.', recomendaciones='Revisar drenaje en el próximo servicio; se observó ligera acumulación de sarro.' WHERE id=?`)
      .run(new Date(Date.now() - 120 * 864e5).toISOString(), new Date(Date.now() - 120 * 864e5 + 6e5).toISOString(), new Date(Date.now() - 120 * 864e5 + 72e5).toISOString(), new Date(Date.now() - 119 * 864e5).toISOString(), hid);
    db.prepare("UPDATE ticket_checklist SET estado='realizado' WHERE ticket_id=?").run(hid);
    db.prepare("UPDATE ticket_checklist SET estado='atencion', observacion='Drenaje con sarro' WHERE ticket_id=? AND actividad LIKE 'Limpieza de líneas%'").run(hid);
    historial(hid, 'cerrado', adm, 'Servicio histórico DEMO');
  }
  return { ESTADOS };
};
