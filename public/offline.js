// Funcionamiento sin conexión para técnicos: caché de lecturas + cola de envíos en IndexedDB que se sincroniza al recuperar conexión
const OFF=(()=>{let dbp;
 const idb=()=>dbp||(dbp=new Promise((ok,ko)=>{const r=indexedDB.open('c3tec',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('cola',{keyPath:'n',autoIncrement:true});d.createObjectStore('cache')};r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)}));
 const tx=async(st,mode,fn)=>{const d=await idb();return new Promise((ok,ko)=>{const t=d.transaction(st,mode),r=fn(t.objectStore(st));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>ko(t.error)})};
 const put=(k,v)=>tx('cache','readwrite',s=>s.put(v,k)),get=k=>tx('cache','readonly',s=>s.get(k));
 const encolar=it=>tx('cola','readwrite',s=>s.add({...it,ts:Date.now()})),cola=()=>tx('cola','readonly',s=>s.getAll()),borrar=n=>tx('cola','readwrite',s=>s.delete(n));
 async function req(url,method,body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.t},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({}));if(r.status===401){localStorage.removeItem('c3tok');location='/';}if(!r.ok){const e=new Error(j.error||'Error');e.status=r.status;throw e}return j}
 async function leer(url){try{const j=await req(url,'GET');put(url,j).catch(()=>{});return j}catch(e){if(e.status)throw e;const c=await get(url);if(c!==undefined){c.__offline=true;return c}throw new Error('Sin conexión y sin datos guardados en este equipo')}}
 async function enviar(url,method,body){
  if((await cola()).length){await encolar({url,method,body});aviso();sync();return{encolado:true}} // respeta el orden de lo pendiente
  try{return await req(url,method,body)}catch(e){if(e.status)throw e;await encolar({url,method,body});aviso();return{encolado:true}}}
 let corriendo=false;
 async function sync(){if(corriendo||!navigator.onLine)return;corriendo=true;let n=0;
  try{for(const it of await cola()){try{await req(it.url,it.method,it.body);await borrar(it.n);n++}catch(e){if(!e.status)break;await borrar(it.n);toast('No se pudo sincronizar un cambio: '+e.message)}}}
  finally{corriendo=false;aviso();if(n)document.dispatchEvent(new CustomEvent('sincronizado',{detail:n}))}}
 async function aviso(){const n=(await cola()).length;document.dispatchEvent(new CustomEvent('cola',{detail:{n,online:navigator.onLine}}))}
 addEventListener('online',()=>{aviso();sync()});addEventListener('offline',aviso);setInterval(sync,15000);
 return{leer,enviar,sync,put,get,cola,aviso}})();
