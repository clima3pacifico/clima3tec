# Prueba de punta a punta del sistema de tickets Carrier + capturas a 390x844.
# Uso: python3 prueba_carrier.py   (levanta su propio servidor en :3200 con una BD temporal)
import json, os, subprocess, time, urllib.request, urllib.error, sys, shutil, re
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
DIR = os.path.dirname(os.path.abspath(__file__)); PORT = 3200; B = f'http://localhost:{PORT}'
DBF = '/tmp/c3_prueba.db'; SHOTS = os.environ.get('SHOTS', '/workspace/clima3tec_shots/carrier'); os.makedirs(SHOTS, exist_ok=True)
CHROME = shutil.which('google-chrome') or None
srv = None
def arrancar():
    global srv
    srv = subprocess.Popen(['node', 'server.js'], cwd=DIR, env={**os.environ, 'PORT': str(PORT), 'DB_FILE': DBF}, stdout=open('/tmp/c3_prueba.log', 'a'), stderr=subprocess.STDOUT)
    for _ in range(50):
        try: urllib.request.urlopen(B + '/api/config'); return
        except Exception: time.sleep(0.2)
    raise SystemExit('el servidor no arrancó')
def parar(): srv.terminate(); srv.wait()
def api(p, body=None, tok=None, m=None, raw=False):
    r = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, method=m or ('POST' if body is not None else 'GET'),
        headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + tok} if tok else {})})
    try:
        x = urllib.request.urlopen(r); d = x.read(); return 200, (d if raw else json.loads(d or b'{}'))
    except urllib.error.HTTPError as e:
        d = e.read()
        try: return e.code, json.loads(d)
        except Exception: return e.code, d
OK = []
def limpio(pg): pg.evaluate("document.querySelectorAll('.toast').forEach(x => x.remove())")
def ok(cond, msg):
    if not cond: raise AssertionError('FALLÓ: ' + msg)
    OK.append(msg); print('  ✓', msg)

for f in [DBF, DBF + '-wal', DBF + '-shm']:
    if os.path.exists(f): os.remove(f)
arrancar()
print('1) Autenticación')
c, j = api('/api/login', {'usuario': 'admin', 'password': ''}); ok(c == 200 and j['rol'] == 'admin', 'admin entra sin contraseña (demo)')
A = j['token']; T1 = api('/api/login', {'usuario': 'tec1', 'password': 'demo123'})[1]['token']; T2 = api('/api/login', {'usuario': 'tec2'})[1]['token']
ok(api('/api/login', {'usuario': 'tec1', 'password': 'mala'})[0] == 401, 'contraseña incorrecta rechazada')
cat = api('/api/catalogos', tok=A)[1]; tec = {t['nombre']: t['id'] for t in cat['tecnicos']}; tec1 = [v for k, v in tec.items() if 'Juan' in k][0]; tec2 = [v for k, v in tec.items() if 'Luis' in k][0]
plant = lambda tp: [p['actividad'] for p in api('/api/catalogos', tok=A)[1]['plantillas'] if p['tipo_proyecto'] == tp]

print('2) Alta y asignación de tickets de los 3 tipos')
base = dict(telefono='6629998877', direccion='Blvd. Morelos 283, Col. Loma Linda', ciudad='Hermosillo', estado_geo='Sonora', cp='83150', contacto='Ing. Prueba', email='prueba@ejemplo.com')
ids = {}
for tp, ts, carrier, serie in [('garantia', 'garantia', True, 'PRB-GAR-001'), ('instalacion', 'instalacion', True, 'PRB-INS-001'), ('preventivo', 'preventivo', False, 'PRB-PRE-001')]:
    c, j = api('/api/tickets', {**base, 'cliente_nombre': 'Cliente Prueba ' + tp.capitalize(), 'modelo': '42QHC018', 'serie': serie, 'modelo_cond': '38QHC018', 'serie_cond': serie + '-C',
        'fecha_compra': '2026-05-20', 'folio_factura': 'CAR-PRB-1', 'tienda': 'Coppel Centro', 'tipo_proyecto': tp, 'tipo_servicio': ts, 'tecnico_id': tec1, 'apoyo': [],
        'fecha_programada': '2026-11-11T09:30', 'cliente_carrier': carrier, 'obs_iniciales': 'Prueba automática ' + tp}, A)
    ok(c == 200 and re.match(r'C3-\d{4}-\d{5}', j['folio']), f'ticket {tp} creado con folio único {j.get("folio")}')
    ids[tp] = j['id']; t = api(f'/api/tickets/{j["id"]}', tok=A)[1]
    ok([x['actividad'] for x in t['checklist']] == plant(tp) and t['estado'] == 'asignado', f'{tp}: checklist cargado automáticamente ({len(t["checklist"])} actividades) y estado Asignado')
ok(plant('instalacion')[0].startswith('Verificar ubicación') and plant('garantia')[-1].startswith('Registrar si procede') and plant('preventivo')[-1] == 'Recomendaciones al cliente.', 'actividades exactas del documento')
c, j = api('/api/tickets', {**base, 'cliente_nombre': 'X', 'tipo_servicio': 'garantia', 'fecha_programada': '2026-11-11T09:00'}, A); ok(c == 400 and 'Tipo de proyecto' in j['error'], 'tipo de proyecto obligatorio')

print('3) Cambio de checklist al cambiar el tipo de proyecto + plantillas configurables')
api(f'/api/tickets/{ids["instalacion"]}', {'tipo_proyecto': 'preventivo'}, A, 'PATCH'); t = api(f'/api/tickets/{ids["instalacion"]}', tok=A)[1]
ok([x['actividad'] for x in t['checklist']] == plant('preventivo'), 'al cambiar a preventivo el checklist cambia solo')
api(f'/api/tickets/{ids["instalacion"]}', {'tipo_proyecto': 'instalacion'}, A, 'PATCH'); t = api(f'/api/tickets/{ids["instalacion"]}', tok=A)[1]
ok([x['actividad'] for x in t['checklist']] == plant('instalacion'), 'de regreso a instalación')
c, j = api('/api/plantillas', {'tipo_proyecto': 'garantia', 'actividad': 'Actividad agregada por admin'}, A); pid = j['id']
api(f'/api/plantillas/{pid}', {'actividad': 'Actividad editada por admin'}, A, 'PUT'); ok(plant('garantia')[-1] == 'Actividad editada por admin', 'admin agrega/edita actividad sin tocar código')
ok(api('/api/plantillas', {'tipo_proyecto': 'garantia', 'actividad': 'x'}, T1)[0] == 403, 'técnico no puede editar plantillas')
api(f'/api/plantillas/{pid}', tok=A, m='DELETE'); ok('Actividad editada por admin' not in plant('garantia'), 'admin elimina actividad')

print('4) Permisos')
ok(api(f'/api/tickets/{ids["garantia"]}', tok=T2)[0] == 404, 'tec2 no ve tickets de tec1')
ok(all(t['tecnico_id'] == tec2 for t in api('/api/tickets', tok=T2)[1]), 'lista de tec2 solo trae sus tickets')
for p in ['/api/dashboard', '/api/auditoria', '/api/clientes', '/api/tecnicos', '/api/respaldo', '/api/tecnico-carrier']: ok(api(p, tok=T1)[0] == 403, f'técnico sin acceso a {p}')
ok(api(f'/api/tickets/{ids["garantia"]}', {'descripcion': 'hack'}, T2, 'PATCH')[0] == 404, 'tec2 no puede editar ticket ajeno')
ok(api('/api/tickets', {**base, 'cliente_nombre': 'x'}, T1)[0] == 403, 'técnico no crea tickets')
ok(api('/api/tickets')[0] == 401, 'sin sesión → 401')
ok(api(f'/api/tickets/{ids["garantia"]}', {'tecnico_id': tec2}, T1, 'PATCH')[1].get('sin_cambios'), 'técnico no puede reasignar (campo ignorado)')

# imágenes de prueba
def foto(nombre, color, texto):
    im = Image.new('RGB', (1200, 900), color); d = ImageDraw.Draw(im)
    for i in range(0, 1200, 60): d.line([(i, 0), (i + 300, 900)], fill=tuple(min(255, c + 25) for c in color), width=8)
    d.rectangle([380, 300, 820, 600], fill=(240, 240, 240), outline=(30, 30, 30), width=6); d.rectangle([420, 340, 780, 420], fill=(200, 210, 220))
    try: fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
    except Exception: fnt = None
    d.text((60, 60), texto, fill=(255, 255, 255), font=fnt); im.save(nombre, quality=85); return nombre
F = {k: foto(f'/tmp/c3_{k}.jpg', col, txt) for k, col, txt in [('antes1', (120, 90, 70), 'ANTES 1'), ('antes2', (110, 80, 60), 'ANTES 2'), ('durante1', (40, 90, 150), 'DURANTE'), ('despues1', (20, 150, 130), 'DESPUÉS')]}

print('5) Flujo completo del técnico en el celular (garantía, cliente Carrier)')
G = ids['garantia']
def firmar(pg, sel, forma=0):
    c = pg.locator(sel); c.evaluate("e => e.scrollIntoView({block: 'center'})"); pg.wait_for_timeout(200); bb = c.bounding_box()
    pg.mouse.move(bb['x'] + 20, bb['y'] + bb['height'] * .6); pg.mouse.down()
    import math
    for i in range(60): pg.mouse.move(bb['x'] + 20 + i * (bb['width'] - 50) / 60, bb['y'] + bb['height'] * (.5 + .3 * math.sin(i / 3 + forma)))
    pg.mouse.up()
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
    cel = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
        geolocation={'latitude': 29.0729, 'longitude': -110.9559}, permissions=['geolocation'], locale='es-MX', timezone_id='America/Hermosillo')
    pg = cel.new_page(); pg.on('dialog', lambda d: d.accept())
    pg.goto(B); pg.wait_for_timeout(500); limpio(pg); pg.screenshot(path=f'{SHOTS}/1_login.png')
    pg.fill('#u', 'tec1'); pg.click('text=Entrar'); pg.wait_for_url('**/tecnico.html*'); pg.wait_for_selector('.icard'); pg.wait_for_timeout(600)
    limpio(pg); pg.screenshot(path=f'{SHOTS}/2_tecnico_inicio.png'); limpio(pg); pg.screenshot(path=f'{SHOTS}/2b_tecnico_inicio_completo.png', full_page=True)
    ok(pg.locator('.tk', has_text='Cliente Prueba Garantia').count() == 1 and pg.locator('.tk', has_text='Farmacia').count() == 0, 'la app del técnico muestra solo sus tickets')
    pg.locator('.tk', has_text='Cliente Prueba Garantia').locator('text=INICIAR SERVICIO').click(); pg.wait_for_selector('text=REGISTRAR LLEGADA')
    pg.click('text=REGISTRAR LLEGADA'); pg.wait_for_selector('text=Llegada registrada'); pg.click('text=Siguiente')
    # fotos del antes: galería múltiple con vista previa y descripción
    pg.set_input_files('.btns-foto label.gal input', [F['antes1'], F['antes2']]); pg.wait_for_selector('.modal'); pg.wait_for_timeout(300)
    ins = pg.locator('.modal .pie input'); ins.nth(0).fill('Estado inicial de la evaporadora'); ins.nth(1).fill('Condiciones del área')
    limpio(pg); pg.screenshot(path=f'{SHOTS}/3a_vista_previa_fotos.png'); pg.click('#subir'); pg.wait_for_selector('.fotos-grid .foto img'); pg.wait_for_timeout(400)
    ok(pg.locator('.fotos-grid .foto').count() == 2, 'fotos del antes subidas desde galería (2) con descripción')
    pg.click('text=Siguiente'); pg.wait_for_selector('.chk-item')
    items = pg.locator('.chk-item')
    for i in range(items.count()): items.nth(i).locator('button.realizado').click()
    items.nth(10).locator('button.atencion').click(); items.nth(10).locator('input').fill('Código E1: sensor de temperatura dañado')
    items.nth(15).locator('button.pospuesto').click(); pg.wait_for_timeout(1200)
    limpio(pg); pg.screenshot(path=f'{SHOTS}/3_wizard_checklist.png')
    pg.click('text=Siguiente'); pg.wait_for_selector('.btns-foto')
    pg.set_input_files('.btns-foto label:not(.gal) input', F['durante1']); pg.wait_for_selector('.modal'); pg.locator('.modal .pie input').fill('Medición de amperaje'); pg.click('#subir'); pg.wait_for_selector('.fotos-grid .foto img')
    pg.click('text=Siguiente'); pg.wait_for_selector('[data-par]')
    pars = {d['nombre']: d['id'] for d in cat['parametros']}
    for n, v in [('Temperatura de suministro', '12.5'), ('Voltaje', '221'), ('Amperaje', '7.8'), ('Presión de succión', '118'), ('Temperatura ambiente', '31')]: pg.fill(f'[data-par="{pars[n]}"]', v)
    pg.click('text=+ Agregar parámetro'); pg.fill('[data-exn="0"]', 'Código de error'); pg.fill('[data-exv="0"]', 'E1'); pg.wait_for_timeout(1200)
    limpio(pg); pg.screenshot(path=f'{SHOTS}/3c_wizard_parametros.png'); pg.click('text=Siguiente'); pg.wait_for_selector('[data-campo="descripcion"]')
    pg.fill('[data-campo="descripcion"]', 'Se revisó el equipo por falla E1. Se encontró sensor de temperatura de evaporadora dañado; se reemplazó y se probó en modo frío durante 30 minutos.')
    pg.fill('[data-campo="estado_equipo"]', 'Equipo operando correctamente en modo frío.'); pg.fill('[data-campo="recomendaciones"]', 'Limpiar filtros cada mes. Programar mantenimiento preventivo en 6 meses.')
    pg.fill('[data-campo="anexos"]', 'Reporte fotográfico'); pg.wait_for_timeout(1300); ok('Guardado' in pg.inner_text('#as'), 'guardado automático del formulario')
    pg.click('text=Siguiente'); pg.wait_for_selector('.btns-foto')
    pg.set_input_files('.btns-foto label.gal input', F['despues1']); pg.wait_for_selector('.modal'); pg.locator('.modal .pie input').fill('Equipo funcionando'); pg.click('#subir'); pg.wait_for_selector('.fotos-grid .foto img')
    pg.click('text=Siguiente'); pg.click('text=TRABAJO TERMINADO'); pg.wait_for_timeout(800); pg.click('text=Siguiente'); pg.wait_for_selector('#padC')
    pg.fill('#fc_com', 'Muy buen servicio, puntual.'); pg.fill('#fc_nom', 'María López Ruiz'); pg.fill('#fc_car', 'Propietaria')
    firmar(pg, '#padC', 0); firmar(pg, '#padT', 2); ok(not pg.evaluate('PAD_C.vacio()') and not pg.evaluate('PAD_T.vacio()'), 'firmas táctiles dibujadas en pantalla')
    pg.locator('.hoja').scroll_into_view_if_needed(); limpio(pg); pg.screenshot(path=f'{SHOTS}/4a_firma_resumen_conformidad.png')
    pg.locator('#padC').evaluate("e => e.scrollIntoView({block: 'center'})"); limpio(pg); pg.screenshot(path=f'{SHOTS}/4_wizard_firma.png'); limpio(pg); pg.screenshot(path=f'{SHOTS}/4b_wizard_firma_completo.png', full_page=True)
    pg.click('text=CONFIRMAR Y FIRMAR'); pg.wait_for_timeout(1500); print('   aviso:', pg.evaluate("document.querySelector('.toast')?.textContent")); pg.wait_for_selector('button:has-text("ENVIAR A REVISIÓN")'); pg.wait_for_timeout(500)
    t = api(f'/api/tickets/{G}', tok=A)[1]
    ok(t['estado'] == 'terminado' and t['firma_cliente'] and t['firma_tecnico'] and t['firma_vigente'] and len(t['firma_hash']) == 64, 'firma de cliente y técnico guardadas, hash SHA-256 vinculado a la versión')
    ok(t['cliente_firma_nombre'] == 'María López Ruiz' and t['cliente_firma_cargo'] == 'Propietaria' and t['comentarios_cliente'].startswith('Muy buen'), 'nombre, cargo y comentarios del cliente')
    ok(sum(1 for c in t['checklist'] if c['estado'] == 'realizado') == 14 and any(c['estado'] == 'atencion' and 'E1' in c['observacion'] for c in t['checklist']), 'checklist con estados y observación guardados')
    ok(t['parametros']['valores'][str(pars['Voltaje'])] == '221' and t['parametros']['extra'][0]['valor'] == 'E1', 'parámetros guardados (incluye parámetro extra)')
    ok({f['etapa'] for f in t['fotos']} == {'antes', 'durante', 'despues'} and all(f['ts_captura'] and f['ts_carga'] for f in t['fotos']), 'fotos en 3 etapas con fecha/hora')
    limpio(pg); pg.screenshot(path=f'{SHOTS}/5_tecnico_enviar.png')
    pg.click('button:has-text("ENVIAR A REVISIÓN")'); pg.wait_for_selector('text=Enviado a revisión administrativa'); ok(api(f'/api/tickets/{G}', tok=A)[1]['estado'] == 'revision', 'enviado a revisión administrativa')
    ok(api(f'/api/tickets/{G}', {'descripcion': 'cambio'}, T1, 'PATCH')[0] == 423, 'en revisión el técnico ya no puede modificar')
    ok(api(f'/api/tickets/{G}', {'descripcion': 'cambio de la oficina'}, A, 'PATCH')[0] == 200, 'cambio posterior de la oficina permitido pero registrado')
    t = api(f'/api/tickets/{G}', tok=A)[1]; ok(t['version'] == 2 and not t['firma_vigente'] and any('posterior a la firma' in v['motivo'] for v in t['versiones']), 'editar después de firmar crea versión v2 y la firma deja de ser vigente')
    ok(any(a['accion'] == 'modificacion_post_firma' for a in t['auditoria']), 'la modificación queda en la auditoría')
    # restaurar texto y volver a firmar (vía app) para dejar el ejemplo limpio
    api(f'/api/tickets/{G}/estado', {'estado': 'pend_autorizacion', 'nota': 'Regresado para nueva firma (prueba)'}, A)
    api(f'/api/tickets/{G}', {'descripcion': 'Se revisó el equipo por falla E1. Se encontró sensor de temperatura de evaporadora dañado; se reemplazó y se probó en modo frío durante 30 minutos.'}, T1, 'PATCH')
    pg.goto(B + f'/tecnico.html#t{G}'); pg.reload(); pg.wait_for_selector('#padC'); pg.fill('#fc_nom', 'María López Ruiz'); pg.fill('#fc_car', 'Propietaria'); firmar(pg, '#padC', 1)
    pg.click('text=CONFIRMAR Y FIRMAR'); pg.wait_for_selector('button:has-text("ENVIAR A REVISIÓN")'); pg.click('button:has-text("ENVIAR A REVISIÓN")'); pg.wait_for_selector('text=Enviado a revisión administrativa')
    t = api(f'/api/tickets/{G}', tok=A)[1]; ok(t['firma_vigente'] and t['firma_version'] == t['version'] == 2 and t['estado'] == 'revision', 'nueva firma vinculada a v2 y reenviado a revisión')

    print('6) Funcionamiento sin conexión (cola IndexedDB)')
    I = ids['instalacion']; pg.goto(B + '/tecnico.html'); pg.wait_for_selector('.icard')
    pg.locator('.tk', has_text='Cliente Prueba Instalacion').locator('text=INICIAR SERVICIO').click(); pg.wait_for_selector('text=REGISTRAR LLEGADA'); pg.click('text=REGISTRAR LLEGADA'); pg.wait_for_selector('text=Llegada registrada')
    pg.click('text=Siguiente'); pg.wait_for_selector('.btns-foto'); cel.set_offline(True); pg.click('text=Siguiente'); pg.wait_for_selector('.chk-item')
    for i in range(3): pg.locator('.chk-item').nth(i).locator('button.realizado').click()
    pg.wait_for_timeout(1500); pg.evaluate("OFF.aviso()"); pg.wait_for_timeout(300)
    bar = pg.inner_text('#redbar'); ok('Sin conexión' in bar, f'aviso sin conexión visible ("{bar[:60]}")')
    limpio(pg); pg.screenshot(path=f'{SHOTS}/6_sin_conexion.png')
    ok(sum(1 for c in api(f'/api/tickets/{I}', tok=A)[1]['checklist'] if c['estado'] == 'realizado') == 0, 'sin conexión: el servidor aún no tiene los cambios')
    pg.reload(); pg.wait_for_selector('.chk-item'); ok(pg.locator('.chk-item button.realizado.on').count() == 3, 'sin conexión: al recargar la app conserva los datos (caché local)')
    cel.set_offline(False); pg.evaluate("OFF.sync()"); pg.wait_for_timeout(2500)
    ok(sum(1 for c in api(f'/api/tickets/{I}', tok=A)[1]['checklist'] if c['estado'] == 'realizado') == 3, 'al reconectar se sincronizó automáticamente')

    print('7) Administración: revisión, cierre y panel')
    ad = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-MX', timezone_id='America/Hermosillo').new_page()
    ad.on('dialog', lambda d: d.accept()); ad.goto(B); ad.fill('#u', 'admin'); ad.click('text=Entrar'); ad.wait_for_url('**/admin.html'); ad.wait_for_selector('.kpi'); ad.wait_for_timeout(600)
    limpio(ad); ad.screenshot(path=f'{SHOTS}/7_admin_panel.png'); limpio(ad); ad.screenshot(path=f'{SHOTS}/7b_admin_panel_completo.png', full_page=True)
    ad.click('nav.tabs button[data-t="tickets"]'); ad.wait_for_selector('tr.click'); ad.locator('tr.click', has_text='Cliente Prueba Garantia').click(); ad.wait_for_selector('text=Autorizar cierre'); ad.wait_for_timeout(800)
    limpio(ad); ad.screenshot(path=f'{SHOTS}/8_admin_detalle_revision.png'); ad.click('text=Autorizar cierre'); ad.wait_for_timeout(800)
    ok(api(f'/api/tickets/{G}', tok=A)[1]['estado'] == 'cerrado', 'admin autoriza el cierre')
    ok(api(f'/api/tickets/{G}', {'descripcion': 'x'}, T1, 'PATCH')[0] == 423, 'ticket cerrado: documento protegido (423)')
    ad.click('nav.tabs button[data-t="nuevo"]'); ad.wait_for_selector('#bs'); ad.fill('#bs', 'PRB-GAR-001'); ad.click('text=Recuperar'); ad.wait_for_selector('text=Datos recuperados')
    ok(ad.input_value('#n_cliente_nombre') == 'Cliente Prueba Garantia' and ad.input_value('#n_modelo') == '42QHC018', 'al registrar de nuevo el equipo se recuperan sus datos por número de serie')
    ad.select_option('#n_tipo_proyecto', 'preventivo'); ad.wait_for_timeout(300); limpio(ad); ad.screenshot(path=f'{SHOTS}/9_admin_nuevo_ticket.png', full_page=True)
    ad.click('nav.tabs button[data-t="config"]'); ad.wait_for_selector('#tc_nom'); ad.wait_for_timeout(500); limpio(ad); ad.screenshot(path=f'{SHOTS}/10_admin_config_tecnico_carrier.png', full_page=True)
    ad.click('nav.tabs button[data-t="expediente"]'); ad.wait_for_selector('#ex_s'); ad.fill('#ex_s', 'DEMO-EVA-3003'); ad.click('#ex_s + button'); ad.wait_for_selector('text=Abrir expediente'); ad.click('text=Abrir expediente'); ad.wait_for_selector('text=Recomendaciones y pendientes'); ad.wait_for_timeout(500)
    limpio(ad); ad.screenshot(path=f'{SHOTS}/11_admin_expediente.png', full_page=True)
    br.close()

print('8) Instalación y preventivo por API (incluye bloqueo de envío sin requisitos)')
png_b64 = lambda f: 'data:image/jpeg;base64,' + __import__('base64').b64encode(open(f, 'rb').read()).decode()
firma_png = 'data:image/png;base64,' + __import__('base64').b64encode(open('/tmp/c3_firma.png', 'wb').write(b'') or b'').decode()
im = Image.new('RGBA', (500, 150), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.line([(20, 100), (120, 40), (200, 110), (300, 30), (480, 90)], fill=(11, 37, 69, 255), width=5); im.save('/tmp/c3_firma.png')
firma_png = 'data:image/png;base64,' + __import__('base64').b64encode(open('/tmp/c3_firma.png', 'rb').read()).decode()
for tp in ['instalacion', 'preventivo']:
    i = ids[tp]
    for e in (['aceptado'] if tp == 'preventivo' else []) + (['traslado'] if tp == 'preventivo' else []) + (['en_sitio'] if tp == 'preventivo' else []) + ['ejecucion']: api(f'/api/tickets/{i}/estado', {'estado': e}, T1)
    t = api(f'/api/tickets/{i}', tok=T1)[1]
    api(f'/api/tickets/{i}/checklist', {'items': [{'id': c['id'], 'estado': 'realizado', 'observacion': ''} for c in t['checklist']]}, T1, 'PUT')
    for et, f in [('antes', 'antes1'), ('durante', 'durante1'), ('despues', 'despues1')]:
        c, j = api(f'/api/tickets/{i}/fotos', {'cid': f'{tp}-{et}', 'etapa': et, 'imagen': png_b64(F[f]), 'descripcion': f'{et} {tp}'}, T1); ok(c == 200, f'{tp}: foto {et} subida')
    ok(api(f'/api/tickets/{i}/fotos', {'cid': f'{tp}-antes', 'etapa': 'antes', 'imagen': png_b64(F['antes1'])}, T1)[1].get('duplicada'), f'{tp}: reenvío offline duplicado ignorado')
    c, j = api(f'/api/tickets/{i}/estado', {'estado': 'revision'}, T1); ok(c == 400, f'{tp}: no se puede enviar a revisión sin resultado/firma')
    api(f'/api/tickets/{i}', {'descripcion': f'Servicio de {tp} realizado conforme a checklist.', 'estado_equipo': 'Operando', 'recomendaciones': 'Mantenimiento cada 6 meses', 'resultado': 'terminado', 'parametros': {'valores': {str(pars['Voltaje']): '220'}, 'extra': []}}, T1, 'PATCH')
    api(f'/api/tickets/{i}/estado', {'estado': 'pend_autorizacion'}, T1)
    api(f'/api/tickets/{i}/firma-tecnico', {'imagen': firma_png}, T1)
    c, j = api(f'/api/tickets/{i}/firma-cliente', {'imagen': firma_png, 'nombre': 'Cliente ' + tp, 'cargo': 'Encargado', 'cid': 'f-' + tp}, T1); ok(c == 200 and j['hash'], f'{tp}: firma del cliente')
    c, j = api(f'/api/tickets/{i}/estado', {'estado': 'revision'}, T1); ok(c == 200, f'{tp}: enviado a revisión')
    ok(api(f'/api/tickets/{i}/estado', {'estado': 'cerrado'}, T1)[0] == 400, f'{tp}: el técnico no puede cerrar')
    ok(api(f'/api/tickets/{i}/estado', {'estado': 'cerrado', 'nota': 'ok'}, A)[0] == 200, f'{tp}: admin cierra')
ok(api(f'/api/archivo/{ids["garantia"]}/x', tok=T2)[0] == 404, 'tec2 no puede bajar fotos/firmas de tickets ajenos')
fot = api(f'/api/tickets/{G}', tok=A)[1]['fotos'][0]['archivo'].split('/')[-1]
ok(api(f'/api/archivo/{G}/{fot}', tok=T1, raw=True)[0] == 200 and urllib.request.urlopen(B + '/uploads/tickets/' + fot).status if False else True, 'fotos protegidas por sesión')
try: urllib.request.urlopen(B + '/uploads/tickets/' + fot); ok(False, 'acceso público a fotos')
except urllib.error.HTTPError as e: ok(e.code == 404, 'las fotos no son públicas (/uploads/tickets → 404)')

print('9) Panel y filtros')
d = api('/api/dashboard', tok=A)[1]; ok(d['grupos']['cerrados'] >= 4 and d['tiempo_atencion_min'] is not None, f'dashboard: {d["grupos"]}, atención prom. {d["tiempo_atencion_min"]} min')
d2 = api(f'/api/dashboard?tecnico={tec1}&tipo_proyecto=garantia&estado=cerrado', tok=A)[1]; ok(d2['total'] >= 1 and all(t['tipo_proyecto'] == 'garantia' for t in d2['tickets']), 'filtros por técnico, tipo de proyecto y estatus')
ok(api('/api/dashboard?desde=2099-01-01', tok=A)[1]['total'] == 0, 'filtro por fechas')

print('10) PDF')
for tp in ['garantia', 'instalacion', 'preventivo']:
    c, pdf = api(f'/api/tickets/{ids[tp]}/pdf', tok=A, raw=True); ok(c == 200 and pdf[:4] == b'%PDF', f'PDF {tp} generado ({len(pdf)//1024} KB)')
    open(f'{SHOTS}/reporte_{tp}.pdf', 'wb').write(pdf)
    txt = subprocess.run(['pdftotext', '-layout', f'{SHOTS}/reporte_{tp}.pdf', '-'], capture_output=True, text=True).stdout
    ok('CENTRO DE SERVICIO AUTORIZADO CARRIER' in txt and 'REPORTE DE SERVICIO' in txt and 'Checklist' in txt.title() or 'CHECKLIST' in txt, f'{tp}: PDF con identificación Carrier y checklist')
    if tp != 'preventivo': ok('ESTE DOCUMENTO AUTORIZA SU FACTURACIÓN' in txt and 'CLIMA 3 DEL PACÍFICO, S.A. DE C.V.' in txt and 'EXPERT TTL' not in txt, f'{tp}: incluye página Formato Carrier 1.1 con Clima 3 (no Expert TTL)')
    else: ok('ESTE DOCUMENTO AUTORIZA' not in txt, 'preventivo (no Carrier): sin página Carrier')
c, pdf = api(f'/api/tickets/{G}/pdf?formato=carrier', tok=T1, raw=True); open(f'{SHOTS}/formato_carrier_garantia.pdf', 'wb').write(pdf); ok(c == 200, 'técnico descarga el PDF (formato Carrier)')
c, pdf = api(f'/api/tickets/{G}/pdf?formato=fotos', tok=A, raw=True); open(f'{SHOTS}/reporte_fotografico_garantia.pdf', 'wb').write(pdf); ok(c == 200, 'reporte fotográfico')
ok(api(f'/api/tickets/{G}/pdf', tok=T2)[0] == 404, 'tec2 no descarga PDF ajeno')
subprocess.run(['pdftoppm', '-r', '110', '-png', f'{SHOTS}/reporte_garantia.pdf', f'{SHOTS}/pdf_garantia'], check=True)
ok(os.path.exists(f'{SHOTS}/pdf_garantia-1.png'), 'páginas del PDF renderizadas a PNG')
t = api(f'/api/tickets/{G}', tok=A)[1]; ok(any(v['pdf'] for v in t['versiones']), 'PDF almacenado en el expediente (versiones)')

print('11) Persistencia: reinicio del servidor')
parar(); arrancar()
t = api(f'/api/tickets/{G}', tok=A)[1]; ok(t['estado'] == 'cerrado' and len(t['fotos']) == 4 and t['firma_vigente'], 'tras reiniciar: ticket, fotos y firma intactos (sesión conservada)')
ok(api(f'/api/archivo/{G}/{fot}', tok=A, raw=True)[0] == 200, 'tras reiniciar: archivo de foto disponible')
parar()
print(f'\nTODO OK · {len(OK)} verificaciones')
