(() => {
  const config = window.KELE_CONFIG || {};
  const url = (config.supabaseUrl || '').replace(/\/$/, '');
  const key = config.supabaseKey || '';
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('kele-session')); } catch {}
  function storeSession(value) { if(value && !value.expires_at)value.expires_at=Math.floor(Date.now()/1000)+(value.expires_in||3600); session = value; if(value) sessionStorage.setItem('kele-session', JSON.stringify(value)); else sessionStorage.removeItem('kele-session'); }
  let refreshPromise;
  async function refresh() {
    if (!session || (session.expires_at || 0) > Date.now()/1000 + 60) return;
    if (!refreshPromise) refreshPromise = request('/auth/v1/token?grant_type=refresh_token', {method:'POST',body:{refresh_token:session.refresh_token}}, false).then(storeSession).catch(e=>{storeSession(null);throw e;}).finally(()=>{refreshPromise=null;});
    await refreshPromise;
  }
  async function request(path, options = {}, authenticated = true) {
    if(!url || !key) throw new Error('Supabase is not connected yet.');
    if(authenticated) await refresh();
    const headers={apikey:key,...options.headers};
    if(authenticated && session) headers.Authorization = `Bearer ${session.access_token}`;
    let body=options.body;
    if(body && !(body instanceof Blob)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
    const response=await fetch(url+path,{...options,headers,body});
    const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
    if(!response.ok)throw new Error(data?.message||data?.msg||data?.error_description||data?.error||`Request failed (${response.status}).`);
    return data;
  }
  window.KeleAPI={
    configured:!!(url&&key),
    async login(email,password){const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}},false);storeSession(data);try{if(!await this.isAdmin())throw new Error('This account does not have admin access.');}catch(e){storeSession(null);throw e;}return data;},
    async logout(){try{if(session)await request('/auth/v1/logout',{method:'POST'});}finally{storeSession(null);}},
    async isAdmin(){return !!(await request('/rest/v1/rpc/is_kele_admin',{method:'POST',body:{}}));},
    hasSession:()=>!!session,
    rows:(table,query='')=>request(`/rest/v1/${table}?${query}`),
    save:(table,data,id)=>request(`/rest/v1/${table}${id===undefined?'':`?id=eq.${encodeURIComponent(id)}`}`,{method:id===undefined?'POST':'PATCH',body:data,headers:{Prefer:'return=representation'}}),
    remove:(table,id)=>request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}),
    async upload(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP image.');if(file.size>6*1024*1024)throw new Error('Images must be smaller than 6 MB.');const ext={ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const name=crypto.randomUUID()+'.'+ext;await request('/storage/v1/object/kele-images/'+name,{method:'POST',body:file,headers:{'Content-Type':file.type,'x-upsert':'false'}});return url+'/storage/v1/object/public/kele-images/'+name;},
    async publicData(){const [settings,services,images,therapists]=await Promise.all([this.rows('kele_settings','id=eq.1&select=*'),this.rows('kele_services','active=eq.true&order=sort_order.asc'),this.rows('kele_images','active=eq.true&order=sort_order.asc'),this.rows('kele_therapists','active=eq.true&order=sort_order.asc')]);return {settings:settings[0],services,images,therapists};},
    async slots(therapist,date){const start=new Date(date+'T00:00:00+02:00').toISOString(),end=new Date(new Date(start).getTime()+86400000).toISOString();return this.rows('kele_slots',`therapist_id=eq.${encodeURIComponent(therapist)}&starts_at=gte.${encodeURIComponent(start)}&starts_at=lt.${encodeURIComponent(end)}&order=starts_at.asc`);}
  };
  window.KeleUtils={escape:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),imageURL:v=>{if(!v)return '';try{const u=new URL(v,location.origin+'/');return ['https:','http:','file:'].includes(u.protocol)?u.href:'';}catch{return '';}},money:v=>v==null?'Ask for price':new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(v),time:v=>new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit'}).format(new Date(v)),date:v=>new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v)),whatsappNumber:v=>String(v||'').replace(/\D/g,''),validWhatsApp:v=>/^[1-9]\d{7,14}$/.test(String(v||''))};
})();
