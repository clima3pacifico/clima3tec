const S={get t(){return localStorage.c3tok},set t(v){localStorage.c3tok=v}};
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.t},body:opt.body?JSON.stringify(opt.body):undefined});
 const j=await r.json().catch(()=>({}));if(r.status===401){localStorage.clear();location='/';}if(!r.ok)throw new Error(j.error||'Error');return j}
function toast(m){document.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);setTimeout(()=>d.remove(),5000)}
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ESTADOS={publicado:'Publicado',aceptado:'Aceptado',en_camino:'En camino',en_sitio:'En sitio',terminado:'Terminado',aprobado:'Aprobado'};
const money=n=>'$'+(+n||0).toLocaleString('es-MX')+' MXN';
function vivo(cb){try{const es=new EventSource('/api/eventos?token='+S.t);es.onmessage=e=>cb(JSON.parse(e.data));es.onerror=()=>{};}catch(e){}setInterval(()=>cb({tipo:'poll'}),20000)}
function salir(){localStorage.clear();location='/'}
const _i=d=>`<svg class="ico" viewBox="0 0 24 24">${d}</svg>`;
const ICO={equipo:_i('<rect x="2" y="5" width="20" height="9" rx="2"/><path d="M6 10h12M7 18l-1 2M12 17v3M17 18l1 2"/>'),fecha:_i('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),ubic:_i('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),dinero:_i('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>')};
const fecha=f=>{if(!f)return'—';const d=new Date(f);return isNaN(d)?esc(f):d.toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
