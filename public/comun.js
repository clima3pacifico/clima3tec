const S={get t(){return localStorage.c3tok},set t(v){localStorage.c3tok=v}};
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.t},body:opt.body?JSON.stringify(opt.body):undefined});
 const j=await r.json().catch(()=>({}));if(r.status===401){localStorage.removeItem('c3tok');location='/';}if(!r.ok)throw new Error(j.error||'Error');return j}
function toast(m){document.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);setTimeout(()=>d.remove(),5000)}
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ESTADOS={publicado:'Publicado',aceptado:'Aceptado',en_camino:'En camino',en_sitio:'En sitio',terminado:'Terminado',aprobado:'Aprobado'};
const money=n=>'$'+(+n||0).toLocaleString('es-MX')+' MXN';
function vivo(cb){try{const es=new EventSource('/api/eventos?token='+S.t);es.onmessage=e=>cb(JSON.parse(e.data));es.onerror=()=>{};}catch(e){}setInterval(()=>cb({tipo:'poll'}),20000)}
function salir(){localStorage.removeItem('c3tok');localStorage.removeItem('c3nom');location='/'}
const _i=d=>`<svg class="ico" viewBox="0 0 24 24">${d}</svg>`;
const ICO={equipo:_i('<rect x="2" y="5" width="20" height="9" rx="2"/><path d="M6 10h12M7 18l-1 2M12 17v3M17 18l1 2"/>'),fecha:_i('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),ubic:_i('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),dinero:_i('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>')};
const fecha=f=>{if(!f)return'—';const d=new Date(f);return isNaN(d)?esc(f):d.toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};

// ---- Sistema de tickets Carrier: utilidades comunes ----
const fechaL=(f,hora=true)=>{if(!f)return'—';const m=/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(f);const naive=m&&!/Z|[+-]\d{2}:?\d{2}$/.test(f);
 const d=naive?new Date(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):new Date(f);if(isNaN(d))return esc(f);
 return d.toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',...(hora&&(!naive||m[4])?{hour:'2-digit',minute:'2-digit'}:{})})};
const imgUrl=(tid,a)=>!a?'':a.startsWith('data:')?a:`/api/archivo/${tid}/${a.split('/').pop()}?token=${S.t}`;
const pdfUrl=(tid,formato,descargar)=>`/api/tickets/${tid}/pdf?token=${S.t}${formato?'&formato='+formato:''}${descargar?'&descargar=1':''}`;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function comprimir(file,max=1600){return new Promise((ok,ko)=>{const img=new Image();img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);ok(c.toDataURL('image/jpeg',.82))};img.onerror=()=>ko(new Error('No se pudo leer la imagen'));img.src=URL.createObjectURL(file)})}
const EST_CLASE={nuevo:'e-nuevo',asignado:'e-asig',aceptado:'e-asig',traslado:'e-proc',en_sitio:'e-proc',ejecucion:'e-proc',suspendido:'e-susp',pend_autorizacion:'e-pend',terminado:'e-term',revision:'e-rev',cerrado:'e-cerr'};
const chipEstado=(e,txt)=>`<span class="estado ${EST_CLASE[e]||''}">${esc(txt||e)}</span>`;
// colores institucionales configurables
fetch('/api/config').then(r=>r.json()).then(c=>{const st=document.documentElement.style;if(c.color_primario)st.setProperty('--navy',c.color_primario);if(c.color_secundario){st.setProperty('--teal',c.color_secundario);st.setProperty('--teal2',c.color_secundario)}}).catch(()=>{});
// Pad de firma táctil
function PadFirma(c){let cx,dib=false,trazos=0;const init=()=>{const r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=Math.max(1,r.width*dpr);c.height=Math.max(1,r.height*dpr);cx=c.getContext('2d');cx.setTransform(dpr,0,0,dpr,0,0);cx.lineWidth=2.4;cx.lineCap='round';cx.lineJoin='round';cx.strokeStyle='#0b2545';trazos=0};init();
 const pt=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
 c.onpointerdown=e=>{e.preventDefault();dib=true;try{c.setPointerCapture(e.pointerId)}catch(_){}cx.beginPath();cx.moveTo(...pt(e));cx.lineTo(...pt(e));cx.stroke();trazos++};
 c.onpointermove=e=>{if(dib){cx.lineTo(...pt(e));cx.stroke()}};c.onpointerup=c.onpointercancel=()=>dib=false;
 return{limpiar:init,vacio:()=>trazos===0,png:()=>c.toDataURL('image/png')}}
