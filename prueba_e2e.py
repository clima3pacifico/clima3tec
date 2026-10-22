# Prueba de punta a punta + capturas. Uso: python3 prueba_e2e.py (servidor en :3000)
import json, urllib.request, concurrent.futures as cf, base64, struct, zlib
from playwright.sync_api import sync_playwright
B='http://localhost:3000'
def api(p,body=None,tok=None,m=None):
    r=urllib.request.Request(B+p,data=json.dumps(body).encode() if body is not None else None,method=m or ('POST' if body is not None else 'GET'),headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+tok} if tok else {})})
    try: return 200,json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return e.code,json.load(e)
tk=lambda u:api('/api/login',{'usuario':u,'password':'demo123'})[1]['token']
A,T1,T2,T3=tk('admin'),tk('tec1'),tk('tec2'),tk('tec3')
# 1) carrera: 3 técnicos aceptan el mismo trabajo a la vez
_,j=api('/api/trabajos',{'cliente':'DEMO Carrera','direccion':'Calle DEMO 1','tipo':'minisplit','fecha':'2026-10-23T09:00','pago':600,'destino':'todos'},A)
with cf.ThreadPoolExecutor(3) as ex: res=list(ex.map(lambda t:api(f"/api/trabajos/{j['id']}/aceptar",{},t)[0],[T1,T2,T3]))
print('Carrera (esperado un 200 y dos 409):',sorted(res)); assert sorted(res)==[200,409,409]
# 2) filtro por especialidad: chiller no visible para tec1
_,jc=api('/api/trabajos',{'cliente':'DEMO Hospital','direccion':'Blvd. Solidaridad DEMO','tipo':'chiller','fecha':'2026-10-23T07:00','pago':4200,'urgencia':'urgente','destino':'especialidad','destino_valor':'chiller'},A)
assert all(x['id']!=jc['id'] for x in api('/api/bolsa',tok=T1)[1]); assert any(x['id']==jc['id'] for x in api('/api/bolsa',tok=T2)[1]); print('Filtro por especialidad OK')
# 3) terminar sin firma -> rechazado
api('/api/trabajos',{'cliente':'DEMO Oficinas Centro','direccion':'Calle Rosales 200, Hermosillo (DEMO)','tipo':'central','fecha':'2026-10-23T11:00','pago':1500,'notas':'Mantenimiento preventivo unidad 5 ton','destino':'zona','destino_valor':'Norte'},A)
def png(w,h,rgb):
    raw=b''.join(b'\x00'+bytes(rgb)*w for _ in range(h)); ch=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d))
    return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b'')
open('/tmp/antes.png','wb').write(png(320,240,(150,110,80))); open('/tmp/despues.png','wb').write(png(320,240,(40,170,160)))
with sync_playwright() as p:
    b=p.chromium.launch(); 
    cel=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,geolocation={'latitude':29.0729,'longitude':-110.9559},permissions=['geolocation'],is_mobile=True,has_touch=True)
    pg=cel.new_page(); pg.goto(B); pg.fill('#u','tec1'); pg.fill('#p','demo123'); pg.click('text=Entrar'); pg.wait_for_url('**/tecnico.html'); pg.wait_for_timeout(800)
    pg.screenshot(path='capturas/tecnico-1-bolsa.png',full_page=True)
    pg.locator('.card',has_text='DEMO Oficinas Centro').locator('text=Aceptar trabajo').click(); pg.wait_for_selector('text=Voy en camino')
    pg.click('text=Voy en camino'); pg.wait_for_selector('text=Llegué al sitio'); pg.click('text=Llegué al sitio'); pg.wait_for_selector('text=Terminar trabajo')
    for c in pg.query_selector_all('.chk'): c.check()
    pg.fill('#l_p','125'); pg.fill('#l_a','14.2'); pg.fill('#l_t','12'); pg.fill('#mat','Gas R-410A 1 kg, filtro, limpiador de serpentín')
    pg.click('text=Guardar avances'); pg.wait_for_timeout(400)
    pg.set_input_files('input[onchange*=antes]','/tmp/antes.png'); pg.wait_for_timeout(900)
    pg.click('text=Terminar trabajo'); pg.wait_for_selector('text=Falta firma'); print('Bloqueo sin firma/foto OK')
    pg.set_input_files('input[onchange*=despues]','/tmp/despues.png'); pg.wait_for_timeout(900)
    pg.screenshot(path='capturas/tecnico-2-trabajo-en-curso.png',full_page=True)
    c=pg.locator('#firma'); c.scroll_into_view_if_needed(); bb=c.bounding_box()
    pg.mouse.move(bb['x']+30,bb['y']+120); pg.mouse.down()
    for i in range(40): pg.mouse.move(bb['x']+30+i*7,bb['y']+90+40*((-1)**i)*(i%5)/5)
    pg.mouse.up(); pg.wait_for_timeout(200); c.screenshot(path='capturas/tecnico-3-firma.png'); pg.screenshot(path='capturas/tecnico-3-firma-pantalla.png')
    pg.click('text=Guardar firma'); pg.wait_for_timeout(800); pg.click('text=Terminar trabajo'); pg.wait_for_selector('.estado:has-text("Terminado")'); print('Técnico terminó trabajo OK')
    ad=b.new_context(viewport={'width':1440,'height':900}).new_page(); ad.goto(B); ad.fill('#u','admin'); ad.fill('#p','demo123'); ad.click('text=Entrar'); ad.wait_for_url('**/admin.html'); ad.wait_for_timeout(800)
    ad.screenshot(path='capturas/admin-1-tablero.png',full_page=True)
    ad.click('.mini:has-text("DEMO Oficinas Centro")'); ad.wait_for_selector('text=Aprobar trabajo'); ad.wait_for_timeout(500)
    ad.screenshot(path='capturas/admin-2-evidencias.png',full_page=True)
    ad.click('text=Aprobar trabajo'); ad.wait_for_timeout(800); print('Aprobado por admin OK')
    ad.click('[data-t=tecnicos]'); ad.wait_for_timeout(500); ad.screenshot(path='capturas/admin-3-tecnicos.png',full_page=True)
    ad.click('[data-t=publicar]'); ad.screenshot(path='capturas/admin-4-publicar.png',full_page=True)
    ad.click('[data-t=pagos]'); ad.wait_for_timeout(500); ad.screenshot(path='capturas/admin-5-pagos.png',full_page=True)
    pg.click('[data-t=ganancias]'); pg.wait_for_timeout(500); pg.screenshot(path='capturas/tecnico-4-ganancias.png')
    b.close()
# 4) suspensión: técnico suspendido pierde acceso
tid=[t for t in api('/api/tecnicos',tok=A)[1] if t['usuario']=='tec3'][0]['id']
api(f'/api/tecnicos/{tid}',{'activo':0},A,'PATCH'); assert api('/api/bolsa',tok=T3)[0]==401; api(f'/api/tecnicos/{tid}',{'activo':1},A,'PATCH'); print('Suspensión OK')
print('Pagos:',api('/api/pagos',tok=A)[1]); print('TODO OK')
