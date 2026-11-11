// Generación de reportes PDF: Reporte de servicio Clima 3, Formato Reporte Electrónico 1.1 (Carrier) y Reporte fotográfico
const PDFDocument = require('pdfkit'), fs = require('fs'), path = require('path');
const TZ = 'America/Hermosillo';
const NAVY = '#0b2545', TEAL = '#13a89e', GRIS = '#5b6b7b', LINEA = '#c9d4de';
const soloFecha = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
const fmt = (iso, hora = true) => {
  if (!iso) return '—'; if (soloFecha(iso)) { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
  const nv = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(:\d{2})?$/.exec(String(iso)); // fecha local sin zona (datetime-local)
  if (nv) return `${nv[3]}/${nv[2]}/${nv[1]}${hora ? `, ${nv[4]}:${nv[5]}` : ''}`; const d = new Date(iso); if (isNaN(d)) return String(iso);
  return d.toLocaleString('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', ...(hora ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) });
};
const dma = (iso) => { if (!iso) return null; if (soloFecha(iso)) return iso.split('-').reverse(); { const nv = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2})?$/.exec(String(iso)); if (nv) return [nv[3], nv[2], nv[1]]; } const d = new Date(iso); if (isNaN(d)) return null;
  const p = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d); const g = (t) => p.find(x => x.type === t).value;
  return [g('day'), g('month'), g('year')]; };
const v = (x) => (x === null || x === undefined || String(x).trim() === '') ? '' : String(x);

function generarPDF(d, { formato = 'completo' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 36, bottom: 46, left: 36, right: 36 }, bufferPages: true,
      info: { Title: `Reporte de servicio ${d.folio}`, Author: 'Clima 3 del Pacífico · Centro de Servicio Autorizado Carrier', Subject: 'Reporte de servicio técnico' } });
    const bufs = []; doc.on('data', b => bufs.push(b)); doc.on('end', () => resolve(Buffer.concat(bufs))); doc.on('error', reject);
    const ctx = { doc, d, img: (rel) => { if (!rel) return null; const f = path.join(d.up, rel); return fs.existsSync(f) && /\.(jpe?g|png)$/i.test(f) ? f : null; } };
    let primera = true; const nueva = () => { if (!primera) doc.addPage(); primera = false; };
    try {
      if (formato === 'carrier' || (formato === 'completo' && d.cliente_carrier)) { nueva(); paginaCarrier(ctx); }
      if (formato === 'completo' || formato === 'clima3') { nueva(); reporteClima3(ctx, false); }
      if (formato === 'fotos') { nueva(); reporteClima3(ctx, true); }
      // pie de página en todas las hojas del reporte Clima 3
      const r = doc.bufferedPageRange();
      for (let i = r.start; i < r.start + r.count; i++) {
        doc.switchToPage(i); if (doc._carrierPages && doc._carrierPages.has(i)) continue;
        doc.save().fontSize(7).fillColor(GRIS).font('Helvetica');
        const m = doc.page.margins.bottom; doc.page.margins.bottom = 0;
        doc.moveTo(36, 752).lineTo(576, 752).lineWidth(0.5).strokeColor(LINEA).stroke();
        doc.text(`Clima 3 del Pacífico, S.A. de C.V. · Centro de Servicio Autorizado Carrier · Hermosillo, Sonora`, 36, 758, { width: 400, lineBreak: false });
        doc.text(`Ticket ${d.folio} · v${d.version} · Página ${i + 1} de ${r.count}`, 376, 758, { width: 200, align: 'right', lineBreak: false });
        doc.page.margins.bottom = m; doc.restore();
      }
      doc.end();
    } catch (e) { reject(e); }
  });
}

// ===================== FORMATO REPORTE ELECTRÓNICO 1.1 (Carrier) =====================
function paginaCarrier({ doc, d, img }) {
  doc._carrierPages = doc._carrierPages || new Set(); doc._carrierPages.add(doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1);
  const X0 = 30, W = 552, X1 = X0 + W, AZUL = '#c5d9f1', GR = '#d9dee6', K = '#000000';
  const c1 = X0 + W * 0.406, c2 = X0 + W * 0.607, c3 = X0 + W * 0.809, s1 = X0 + W * 0.15, s2 = X0 + W * 0.292, s3 = X0 + W * 0.468;
  const m0 = doc.page.margins.bottom; doc.page.margins.bottom = 0;
  doc.lineWidth(0.6).strokeColor(K);
  const fill = (x, y, w, h, c) => doc.save().rect(x, y, w, h).fill(c).restore();
  const hl = (x1, x2, y, lw = 0.6) => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(lw).strokeColor(K).stroke();
  const vl = (x, y1, y2, lw = 0.6) => doc.moveTo(x, y1).lineTo(x, y2).lineWidth(lw).strokeColor(K).stroke();
  const t = (s, x, y, o = {}) => doc.font(o.b ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.s || 5.6).fillColor(o.c || K).text(s, x, y, { lineBreak: false, width: o.w, align: o.a || 'left', ellipsis: !!o.w, height: o.h });
  const val = (s, x, y, w, o = {}) => t(v(s), x + 2, y, { s: o.s || 7.5, b: true, w: w - 4, a: o.a, c: '#10234a' });

  const YT = 30, YF = 760;
  // --- encabezado ---
  fill(X0 + W * 0.707, YT, X1 - (X0 + W * 0.707), 16, GR);
  hl(X0, X1, YT, 1); t('#TICKET', X0 + W * 0.707 + 3, YT + 5, { s: 6.5 }); t(d.folio, X0 + W * 0.707 + 38, YT + 4, { s: 9, b: true, w: X1 - (X0 + W * 0.707) - 42, a: 'right' });
  vl(X0 + W * 0.707, YT, YT + 16); hl(X0 + W * 0.707, X1, YT + 16);
  t('CLIMA 3 DEL PACÍFICO, S.A. DE C.V.', X0 + W * 0.25, YT + 4, { s: 9.5, w: W * 0.45, a: 'center' });
  t('REPORTE DE SERVICIO', X0 + W * 0.29, YT + 18, { s: 6.5 });
  const l3 = path.join(d.pub, 'logo_clima3.png'); if (fs.existsSync(l3)) doc.image(l3, X0 + 8, YT + 22, { width: 112 });
  const lc = path.join(d.pub, 'logo_carrier_experts.jpg'); if (fs.existsSync(lc)) doc.image(lc, X1 - 128, YT + 22, { fit: [124, 50], align: 'right' });
  const yH = 104; hl(X0, X1 - 6, yH); hl(X0, X1, 112);
  // --- cuadrícula de datos ---
  const r = 14, A = 112, B = A + r, C = B + r, D = C + r, E = D + r, F = E + r, G = F + r, H = G + r, I = H + r, J = I + 12, Y0 = J + 12;
  fill(c1, A, c3 - c1, r, AZUL); fill(c3, A, X1 - c3, r, AZUL); fill(c3, B, X1 - c3, 2 * r, GR); fill(c3, D, X1 - c3, r, AZUL); fill(c3, E, X1 - c3, r, GR);
  fill(s2, F, s3 - s2, 3 * r, GR);
  t('NOMBRE DEL CLIENTE', X0 + 2, A + 3); t('MODELO DEL EQUIPO', c1 + 2, A + 4, { s: 4.6 }); t('N° DE SERIE', c2, A + 4, { w: c3 - c2, a: 'center' }); t('FECHA DE TICKET DE COMPRA', c3 + 2, A + 4);
  t('DIRECCIÓN', X0 + 2, C + 3); t('TIENDA DEPARTAMENTAL', c3 + 2, D + 4);
  t('CIUDAD', X0 + 2, E + 2); t('ESTADO', s1 + 2, E + 2); t('C.P.', s2 + 2, E + 2);
  t('NÚMERO DE FOLIO FACTURACIÓN', s2, F + 3, { w: s3 - s2, a: 'center' }); t('CARRIER', s2, F + 10, { w: s3 - s2, a: 'center' });
  t('CENTRO DE SERVICIO', X0 + 2, H + 4); t('FECHA DEL SERVICIO', s1, H + 5, { w: s2 - s1, a: 'center' }); t('TIPO DE SERVICIO:', s3, H + 5, { w: c2 - s3 - 4, a: 'right' });
  t('EVALUACIÓN', c2 + 2, F + 4); t('CORRECTIVO', c2 + 2, G + 4); t('OTRO:', c2 + 2, H + 4); t('INSTALACIÓN', c3 + 2, F + 4); t('GARANTÍA', c3 + 2, G + 4);
  // valores
  val(d.cliente_nombre, X0, B + 1.5, c1 - X0); val(d.contacto && d.contacto !== d.cliente_nombre ? 'Contacto: ' + d.contacto + (d.telefono ? ' · Tel. ' + d.telefono : '') : (d.telefono ? 'Tel. ' + d.telefono : ''), X0, B + 10, c1 - X0, { s: 4.8 });
  val(d.modelo, c1, B + 4, c2 - c1); val(d.serie, c2, B + 4, c3 - c2, { a: 'center' });
  val(d.modelo_cond, c1, C + 4, c2 - c1); val(d.serie_cond, c2, C + 4, c3 - c2, { a: 'center' });
  if (d.modelo_cond || d.serie_cond) { t('EVAP.', c1 - 1, B + 9.5, { s: 3.8, c: GRIS, w: 18 }); t('COND.', c1 - 1, C + 9.5, { s: 3.8, c: GRIS, w: 18 }); }
  val(fmt(d.fecha_compra, false).replace('—', ''), c3, B + 10, X1 - c3, { a: 'center', s: 8.5 });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#10234a').text(v(d.direccion), X0 + 2, D + 1, { width: c1 - X0 - 4, height: 13, ellipsis: true, lineGap: -1 });
  val(d.tienda, c3, E + 3.5, X1 - c3, { a: 'center' });
  t(v(d.cp), s2 + 14, E + 2, { s: 7.5, b: true, c: '#10234a', w: s3 - s2 - 16 });
  val(d.ciudad, X0, F + 4, s1 - X0); val(d.estado_geo, s1, F + 4, s2 - s1);
  val(d.centro_servicio || 'Clima 3', X0, G + 4, s1 - X0); val(fmt(fechaServicio(d), false), s1, G + 4, s2 - s1, { a: 'center' });
  val(d.folio_factura, s2, G + 5, s3 - s2, { a: 'center', s: 8 });
  const ts = d.tipo_servicio, X = (x, y) => t('X', x, y, { s: 9, b: true, c: '#10234a' });
  if (ts === 'evaluacion') X(c3 - 14, F + 2.5); if (ts === 'correctivo') X(c3 - 14, G + 2.5); if (ts === 'instalacion') X(X1 - 14, F + 2.5); if (ts === 'garantia') X(X1 - 14, G + 2.5);
  const otro = ts === 'preventivo' ? 'Mantenimiento preventivo' : ts === 'otro' ? v(d.tipo_servicio_otro) : '';
  hl(c2 + 22, X0 + W * 0.95, H + 10, 0.4); if (otro) { t(otro, c2 + 24, H + 3, { s: 7, b: true, c: '#10234a', w: X0 + W * 0.95 - c2 - 26 }); X(X1 - 14, H + 2.5); }
  // líneas de la cuadrícula
  [A, B, D, E].forEach(y => hl(c1, X1, y)); hl(c1, c3, C); hl(X0, c1, C); hl(X0, X1, E); hl(X0, s2, F); hl(s3, X1, F); hl(X0, s2, G); hl(c2, X1, G); hl(X0, s2, H); hl(c2, X1, H);
  hl(X0, X1, I, 1); hl(X0, X1, J); hl(X0, X1, Y0, 1);
  vl(c1, A, F); vl(c2, A, I); vl(c3, A, H); vl(s1, E, I); vl(s2, E, I); vl(s3, F, I);
  t('REPORTE DE SERVICIO', X0, J + 3.5, { s: 6, w: W, a: 'center' });
  // --- secciones con renglones ---
  let y = Y0; let anexos = (d.fotos || []).length > 0;
  const seccion = (titulo, texto, n) => {
    hl(X0, X1, y); t(titulo, X0 + 3, y + 3.5, { s: 10.5 }); y += 16; hl(X0, X1, y, 0.9);
    const lineas = renglones(doc, texto, W - 8, 'Helvetica', 8);
    if (lineas.length > n) { anexos = true; lineas.length = n; lineas[n - 1] = recortar(doc, lineas[n - 1], W - 80, 'Helvetica', 8) + ' … (continúa en anexo)'; }
    for (let i = 0; i < n; i++) { if (lineas[i]) t(lineas[i], X0 + 4, y + 4, { s: 8, c: '#10234a' }); y += 14; hl(X0, X1, y, i === n - 1 ? 0.9 : 0.5); }
  };
  seccion('DESCRIPCIÓN DE LOS TRABAJOS', v(d.descripcion), 6);
  seccion('PARÁMETROS DE OPERACIÓN', textoParametros(d), 5);
  seccion('ESTADO EN QUE SE DEJA EL EQUIPO', v(d.estado_equipo), 4);
  seccion('RECOMENDACIONES', v(d.recomendaciones), 5);
  // --- resultado ---
  const yR = y; y += 30; hl(X0, X1, y, 1);
  const circ = (cx, cy, on) => { doc.circle(cx, cy, 4.2).lineWidth(0.8).strokeColor(K).stroke(); if (on) doc.circle(cx, cy, 2.6).fill('#10234a'); };
  t('TRABAJO', X0 + 2, yR + 9); t('TERMINADO', X0 + 2, yR + 17); circ(X0 + 52, yR + 15, d.resultado === 'terminado');
  t('TRABAJO', X0 + W * 0.145, yR + 9); t('SUSPENDIDO', X0 + W * 0.145, yR + 17); circ(X0 + W * 0.245, yR + 15, d.resultado === 'suspendido');
  t('ANEXOS', X0 + W * 0.39, yR + 12); circ(X0 + W * 0.47, yR + 15, anexos);
  if (anexos) t(`Reporte Clima 3 adjunto${d.fotos.length ? ` con ${d.fotos.length} fotografía(s)` : ''}`, X0 + W * 0.49, yR + 13, { s: 6, c: GRIS });
  // --- comentarios / técnico / autorización ---
  const yB = y, yE = YF - 9;
  fill(X0, yB, s2 - X0, 11, AZUL); hl(X0, s2, yB + 11); t('COMENTARIOS DEL CLIENTE', X0, yB + 3, { s: 6, w: s2 - X0, a: 'center' });
  vl(s2, yB, yE);
  doc.font('Helvetica').fontSize(7.5).fillColor('#10234a').text(v(d.comentarios_cliente), X0 + 4, yB + 15, { width: s2 - X0 - 8, height: yE - yB - 18, ellipsis: true });
  const xr = s2 + 2, xd = X0 + W * 0.6, wd = W * 0.13;
  const fechaLinea = (yy, fecha) => { hl(xd, xd + wd, yy, 0.5); const p = dma(fecha); t('DÍA   MES   AÑO', xd, yy + 2.5, { s: 6.5, w: wd, a: 'center' });
    if (p) t(`${p[0]}    ${p[1]}    ${p[2]}`, xd, yy - 9, { s: 8, b: true, c: '#10234a', w: wd, a: 'center' }); };
  const ct = d.carrierTec || {};
  t('TÉCNICO CARRIER', xr, yB + 2, { s: 7 });
  t('NOMBRE', xr, yB + 22, { s: 6.5 });
  if (ct.nombre_img) doc.image(ct.nombre_img.buf, xr + 36, yB + 13, { fit: [xd - xr - 44, 18], valign: 'center' }); else t(v(ct.nombre), xr + 38, yB + 20, { s: 9, b: true, c: '#10234a' });
  t('FIRMA', xr, yB + 46, { s: 6.5 });
  if (ct.firma_img) doc.image(ct.firma_img.buf, xr + 36, yB + 34, { fit: [xd - xr - 44, 22], valign: 'center' }); else hl(xr + 36, xd - 8, yB + 52, 0.4);
  fechaLinea(yB + 52, fechaServicio(d));
  hl(s2, X1, yB + 62);
  t('AUTORIZACIÓN DEL CLIENTE', s2 + 50, yB + 64, { s: 7 });
  t('NOMBRE', xr, yB + 80, { s: 6.5 }); { const wn = xd - xr - 44, nom = recortar(doc, v(d.cliente_firma_nombre), wn, 'Helvetica-Bold', 9); t(nom, xr + 38, yB + 78, { s: 9, b: true, c: '#10234a' });
    if (d.cliente_firma_cargo) { doc.font('Helvetica-Bold').fontSize(9); const x2 = xr + 38 + doc.widthOfString(nom) + 4; if (x2 < xd - 20) t(recortar(doc, `(${d.cliente_firma_cargo})`, xd - x2 - 4, 'Helvetica', 6.5), x2, yB + 80, { s: 6.5, c: GRIS }); } }
  t('FIRMA', xr, yB + 101, { s: 6.5 });
  const fc = img(d.firma_cliente); if (fc) doc.image(fc, xr + 36, yB + 86, { fit: [xd - xr - 44, 24], valign: 'center' });
  fechaLinea(yB + 106, d.cliente_firma_ts);
  t('ESTE DOCUMENTO AUTORIZA SU FACTURACIÓN', xr, yB + 112, { s: 6.5 });
  fill(X0, yE, W, YF - yE, AZUL); hl(X0, X1, yE);
  doc.rect(X0, YT, W, YF - YT).lineWidth(1).strokeColor(K).stroke();
  t(`Formato Reporte Electrónico 1.1 · Ticket ${d.folio} · versión ${d.version}${d.firma_version ? ` · firma del cliente vinculada a v${d.firma_version}` : ''}`, X0, YF + 4, { s: 5.5, c: GRIS, w: W, a: 'right' });
  doc.page.margins.bottom = m0;
}
const fechaServicio = (d) => d.fin_ts || d.llegada_ts || d.fecha_programada;
function textoParametros(d) {
  const p = d.parametros || {}, val = p.valores || {}, out = [];
  for (const def of d.defs || []) { const x = val[def.id]; if (v(x)) out.push(`${def.nombre}: ${x}${def.unidad && /^[\d.,\s-]+$/.test(x) ? ' ' + def.unidad : ''}`); }
  for (const e of p.extra || []) if (v(e.nombre) && v(e.valor)) out.push(`${e.nombre}: ${e.valor}`);
  return out.join(' · ');
}
function renglones(doc, texto, ancho, font, size) {
  doc.font(font).fontSize(size); const out = [];
  for (const parrafo of String(texto || '').split(/\n/)) {
    let l = ''; for (const w of parrafo.split(/\s+/).filter(Boolean)) { const c = l ? l + ' ' + w : w; if (doc.widthOfString(c) > ancho && l) { out.push(l); l = w; } else l = c; }
    if (l) out.push(l);
  }
  return out;
}
function recortar(doc, s, ancho, font, size) { doc.font(font).fontSize(size); while (s && doc.widthOfString(s) > ancho) s = s.slice(0, -1); return s; }

// ===================== REPORTE DE SERVICIO CLIMA 3 =====================
function reporteClima3({ doc, d, img }, soloFotos) {
  const L = 36, R = 576, W = R - L, LIM = 740;
  const encabezado = () => {
    const l3 = path.join(d.pub, 'logo_clima3.png'), lc = path.join(d.pub, 'logo_carrier.png');
    if (fs.existsSync(l3)) doc.image(l3, L, 30, { width: 150 });
    if (fs.existsSync(lc)) doc.image(lc, R - 92, 26, { width: 92 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(soloFotos ? 'REPORTE FOTOGRÁFICO' : 'REPORTE DE SERVICIO', L + 160, 30, { width: W - 260, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(TEAL).text('CENTRO DE SERVICIO AUTORIZADO CARRIER', L + 160, 47, { width: W - 260, align: 'center' });
    doc.font('Helvetica').fontSize(7).fillColor(GRIS).text('Formato Reporte Electrónico 1.1 · Clima 3 del Pacífico, S.A. de C.V.', L + 160, 58, { width: W - 260, align: 'center' });
    doc.save().rect(L, 72, W, 22).fill(NAVY).restore();
    doc.save().rect(L, 94, W, 2.5).fill(TEAL).restore();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff').text(`TICKET ${d.folio}`, L + 10, 78, { lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).text(`Fecha del servicio: ${fmt(fechaServicio(d))}   ·   Estado: ${d.estado_txt}`, L + 200, 79.5, { width: W - 210, align: 'right', lineBreak: false });
    doc.x = L; doc.y = 106;
  };
  const espacio = (h) => { if (doc.y + h > LIM) { doc.addPage(); encabezado(); } };
  const seccion = (titulo) => { espacio(40); const y = doc.y + 4; doc.save().roundedRect(L, y, W, 16, 3).fill('#e8f0f7').restore(); doc.save().rect(L, y, 4, 16).fill(TEAL).restore();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(titulo.toUpperCase(), L + 10, y + 4.5, { lineBreak: false }); doc.x = L; doc.y = y + 22; };
  const campos = (lista, cols = 3) => { // [label, valor, span]
    const cw = W / cols, filas = []; let f = [], n = 0;
    for (const c of lista) { const sp = Math.min(c[2] || 1, cols); if (n + sp > cols) { filas.push(f); f = []; n = 0; } f.push(c); n += sp; }
    if (f.length) filas.push(f);
    for (const fila of filas) {
      doc.font('Helvetica-Bold').fontSize(8.5);
      const h = Math.max(...fila.map(([, val, sp]) => doc.heightOfString(v(val) || '—', { width: cw * (sp || 1) - 10 }))) + 15;
      espacio(h); const y = doc.y; let x = L;
      for (const [lab, val, sp] of fila) {
        const w = cw * (sp || 1);
        doc.save().roundedRect(x + 1, y, w - 2, h - 2, 3).lineWidth(0.5).strokeColor(LINEA).stroke().restore();
        doc.font('Helvetica').fontSize(6.3).fillColor(GRIS).text(lab.toUpperCase(), x + 5, y + 3, { width: w - 10, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1b2a3a').text(v(val) || '—', x + 5, y + 11, { width: w - 10 });
        x += w;
      }
      doc.x = L; doc.y = y + h;
    }
  };
  const parrafo = (lab, texto) => { doc.font('Helvetica').fontSize(9); const h = doc.heightOfString(v(texto) || '—', { width: W - 12 }) + 18; espacio(Math.min(h, 200));
    doc.font('Helvetica-Bold').fontSize(7).fillColor(GRIS).text(lab.toUpperCase(), L + 2, doc.y); doc.font('Helvetica').fontSize(9).fillColor('#1b2a3a').text(v(texto) || '—', L + 2, doc.y + 2, { width: W - 12 }); doc.y += 6; doc.x = L; };
  const marca = (x, y, on, txt) => { doc.save().rect(x, y, 8, 8).lineWidth(0.8).strokeColor(NAVY).stroke(); if (on) doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text('X', x + 1.4, y + 0.6, { lineBreak: false }); doc.restore();
    doc.font('Helvetica').fontSize(8.5).fillColor('#1b2a3a').text(txt, x + 12, y, { lineBreak: false }); };

  encabezado();
  if (!soloFotos) {
    seccion('Encabezado · datos del servicio');
    campos([['Número de ticket', d.folio], ['Fecha de creación', fmt(d.creado)], ['Fecha programada', fmt(d.fecha_programada)],
      ['Nombre del cliente', d.cliente_nombre], ['Contacto', d.contacto], ['Teléfono / correo', [d.telefono, d.email].filter(Boolean).join(' · ')],
      ['Dirección', d.direccion, 2], ['Ciudad', d.ciudad], ['Estado', d.estado_geo], ['Código postal', d.cp], ['Tienda departamental', d.tienda],
      ['Modelo del equipo (evaporadora)', d.modelo], ['Número de serie (evaporadora)', d.serie], ['Fecha del ticket de compra', fmt(d.fecha_compra, false)],
      ['Modelo condensadora', d.modelo_cond], ['Serie condensadora', d.serie_cond], ['Folio de facturación', d.folio_factura],
      ['Centro de Servicio Carrier', d.centro_servicio || 'Clima 3'], ['Tipo de proyecto', d.TIPOS_PROY[d.tipo_proyecto]], ['Cliente Carrier', d.cliente_carrier ? 'Sí' : 'No'],
      ['Técnico responsable', d.tecnico], ['Técnicos de apoyo', (d.apoyo_nombres || []).join(', ')], ['Llegada al sitio', fmt(d.llegada_ts)]]);
    // tipo de servicio (hoja de conformidad)
    espacio(34); doc.font('Helvetica-Bold').fontSize(7).fillColor(GRIS).text('TIPO DE SERVICIO', L + 2, doc.y + 2); let y = doc.y + 4;
    const ts = d.tipo_servicio;
    [['garantia', 'Validación de Garantía'], ['instalacion', 'Instalación'], ['correctivo', 'Reparación'], ['preventivo', 'Mantenimiento preventivo']].forEach(([k, txt], i) => marca(L + 2 + i * 118, y, ts === k, txt));
    marca(L + 2, y + 14, ts === 'otro' || ts === 'evaluacion', 'Otro: ' + (ts === 'evaluacion' ? 'Evaluación' : ts === 'otro' ? v(d.tipo_servicio_otro) : '________________'));
    doc.x = L; doc.y = y + 30;
    if (d.obs_iniciales) parrafo('Observaciones iniciales', d.obs_iniciales);

    seccion('Reporte de servicio');
    parrafo('Descripción de los trabajos realizados', d.descripcion);
    parrafo('Estado en que se deja el equipo', d.estado_equipo);
    parrafo('Recomendaciones', d.recomendaciones);
    if (d.materiales) parrafo('Materiales utilizados', d.materiales);
    if (d.comentarios) parrafo('Comentarios del técnico', d.comentarios);

    seccion(`Checklist · ${d.TIPOS_PROY[d.tipo_proyecto]}`);
    const cols = [22, 250, 82, W - 354]; const head = ['#', 'Actividad', 'Estado', 'Observación'];
    const fila = (cells, opts = {}) => {
      doc.font(opts.b ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.8);
      const h = Math.max(...cells.map((c, i) => doc.heightOfString(v(c) || ' ', { width: cols[i] - 8 }))) + 7; espacio(h);
      const y = doc.y; if (opts.bg) doc.save().rect(L, y, W, h).fill(opts.bg).restore();
      let x = L; cells.forEach((c, i) => { doc.font(opts.b || i === 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.8).fillColor(opts.b ? '#fff' : i === 2 ? (opts.color || '#1b2a3a') : '#1b2a3a')
        .text(v(c), x + 4, y + 3.5, { width: cols[i] - 8 }); x += cols[i]; });
      doc.moveTo(L, y + h).lineTo(R, y + h).lineWidth(0.4).strokeColor(LINEA).stroke(); doc.x = L; doc.y = y + h;
    };
    const COL = { realizado: '#0f8f5f', pendiente: '#8a6d00', pospuesto: '#b85c00', atencion: '#c0262d' };
    fila(head, { b: true, bg: NAVY });
    (d.checklist || []).forEach((c, i) => fila([i + 1, c.actividad, d.CHECK_ESTADOS[c.estado], c.observacion], { color: COL[c.estado], bg: i % 2 ? '#f7fafc' : null }));
    const tot = (d.checklist || []).length, hechas = (d.checklist || []).filter(c => c.estado === 'realizado').length;
    doc.font('Helvetica').fontSize(7.5).fillColor(GRIS).text(`Realizadas ${hechas} de ${tot} actividades.`, L, doc.y + 3); doc.y += 4;

    seccion('Parámetros de operación');
    const p = d.parametros || {}, valores = p.valores || {};
    const lp = (d.defs || []).filter(x => v(valores[x.id])).map(x => [x.nombre + (x.unidad ? ` (${x.unidad})` : ''), valores[x.id]]).concat((p.extra || []).filter(e => v(e.nombre) && v(e.valor)).map(e => [e.nombre, e.valor]));
    if (lp.length) campos(lp, 3); else { doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(GRIS).text('No se registraron parámetros para este equipo / intervención.', L + 2); doc.y += 4; }

    seccion('Resultado del servicio');
    y = doc.y; marca(L + 2, y, d.resultado === 'terminado', 'Trabajo terminado'); marca(L + 140, y, d.resultado === 'suspendido', 'Trabajo suspendido');
    marca(L + 290, y, (d.fotos || []).length > 0 || !!d.anexos, 'Anexos' + (d.anexos ? ': ' + d.anexos : (d.fotos || []).length ? `: ${(d.fotos || []).length} fotografías` : '')); doc.x = L; doc.y = y + 16;
    parrafo('Comentarios del cliente', d.comentarios_cliente);
  }

  // evidencia fotográfica
  seccion('Evidencia fotográfica');
  for (const [et, nombre] of Object.entries(d.ETAPAS)) {
    const fotos = (d.fotos || []).filter(f => f.etapa === et);
    espacio(fotos.length ? 128 + 56 : 30); doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEAL).text(`${nombre.toUpperCase()}  (${fotos.length})`, L + 2, doc.y + 2); doc.y += 4;
    if (!fotos.length) { doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRIS).text('Sin fotografías en esta etapa.', L + 2); doc.y += 6; continue; }
    const cw = (W - 16) / 3, ih = 128;
    for (let i = 0; i < fotos.length; i += 3) {
      espacio(ih + 34); const y = doc.y;
      fotos.slice(i, i + 3).forEach((f, j) => {
        const x = L + j * (cw + 8), file = img(f.archivo);
        doc.save().roundedRect(x, y, cw, ih + 28, 4).lineWidth(0.5).strokeColor(LINEA).stroke().restore();
        if (file) { try { doc.image(file, x + 4, y + 4, { fit: [cw - 8, ih - 4], align: 'center', valign: 'center' }); } catch (e) { doc.fontSize(7).text('(imagen no disponible)', x + 6, y + 50); } }
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#1b2a3a').text(v(f.descripcion) || 'Sin descripción', x + 5, y + ih + 2, { width: cw - 10, height: 16, ellipsis: true });
        doc.font('Helvetica').fontSize(6.3).fillColor(GRIS).text(`Captura: ${fmt(f.ts_captura)} · Carga: ${fmt(f.ts_carga)}`, x + 5, y + ih + 18, { width: cw - 10, lineBreak: false });
      });
      doc.x = L; doc.y = y + ih + 36;
    }
  }

  // firmas
  seccion('Datos del técnico Carrier y autorización del cliente');
  espacio(140); const y = doc.y, bw = (W - 12) / 2;
  const caja = (x, titulo, filas, firma) => {
    doc.save().roundedRect(x, y, bw, 132, 4).lineWidth(0.6).strokeColor(LINEA).stroke().restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY).text(titulo, x + 8, y + 7);
    const f = img(firma); if (f) doc.image(f, x + 8, y + 22, { fit: [bw - 16, 60], align: 'center', valign: 'center' });
    else doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRIS).text('Sin firma', x + 8, y + 48, { width: bw - 16, align: 'center' });
    doc.moveTo(x + 20, y + 84).lineTo(x + bw - 20, y + 84).lineWidth(0.5).strokeColor('#8a99a8').stroke();
    filas.forEach(([l, val], i) => { doc.font('Helvetica').fontSize(6.5).fillColor(GRIS).text(l.toUpperCase(), x + 8, y + 89 + i * 14, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1b2a3a').text(v(val) || '—', x + 104, y + 88 + i * 14, { width: bw - 112, lineBreak: false, ellipsis: true }); });
  };
  caja(L, 'DATOS DEL TÉCNICO CARRIER', [['Nombre', d.tecnico], ['Firma', d.firma_tecnico ? 'Firmado electrónicamente' : 'Pendiente'], ['Fecha de realización', fmt(d.firma_tecnico_ts || fechaServicio(d))]], d.firma_tecnico);
  caja(L + bw + 12, 'AUTORIZACIÓN DEL CLIENTE', [['Nombre', d.cliente_firma_nombre], ['Cargo', d.cliente_firma_cargo], ['Fecha de autorización', fmt(d.cliente_firma_ts)]], d.firma_cliente);
  doc.x = L; doc.y = y + 140;
  // control de versiones
  espacio(50);
  const vigente = d.firma_vigente;
  doc.font('Helvetica').fontSize(7).fillColor(GRIS).text(`Versión del reporte: v${d.version}.  ${d.firma_hash ? `Firma del cliente vinculada a la versión v${d.firma_version} · huella SHA-256: ${d.firma_hash}` : 'El cliente aún no ha firmado este reporte.'}`, L, doc.y, { width: W });
  if (d.firma_hash && !vigente) doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#c0262d').text(`ATENCIÓN: el reporte se modificó después de la firma del cliente (versión actual v${d.version}). La firma corresponde a la versión v${d.firma_version}; el cambio quedó registrado en el historial.`, L, doc.y + 2, { width: W });
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(`La información de este reporte se guardó automáticamente y está vinculada al número de ticket ${d.folio}.`, L, doc.y, { width: W, align: 'center' });
}

module.exports = { generarPDF };
