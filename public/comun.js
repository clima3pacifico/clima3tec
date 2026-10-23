const S={get t(){return localStorage.c3tok},set t(v){localStorage.c3tok=v}};
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.t},body:opt.body?JSON.stringify(opt.body):undefined});
 const j=await r.json().catch(()=>({}));if(r.status===401){localStorage.clear();location='/';}if(!r.ok)throw new Error(j.error||'Error');return j}
function toast(m){const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);setTimeout(()=>d.remove(),5000)}
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ESTADOS={publicado:'Publicado',aceptado:'Aceptado',en_camino:'En camino',en_sitio:'En sitio',terminado:'Terminado',aprobado:'Aprobado'};
const money=n=>'$'+(+n||0).toLocaleString('es-MX')+' MXN';
function vivo(cb){try{const es=new EventSource('/api/eventos?token='+S.t);es.onmessage=e=>cb(JSON.parse(e.data));es.onerror=()=>{};}catch(e){}setInterval(()=>cb({tipo:'poll'}),20000)}
function salir(){localStorage.clear();location='/'}
