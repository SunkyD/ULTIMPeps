/* Synchronisation des réglages publics et codes promo ULTIM'Peps. */
(function(){
  "use strict";
  const sb=window.ULTIM_SUPABASE;
  if(!sb)return;
  const ADMIN="logan.decupper1@gmail.com";
  const settingsKeys={
    up_ct:"storefront_content",
    up_s:"storefront_shipping",
    up_pay:"storefront_payment",
    up_pre:"storefront_prelaunch"
  };
  let isAdmin=false, applyingRemote=false, chain=Promise.resolve();
  const getSession=async()=>{
    const {data}=await sb.auth.getSession();
    return String(data?.session?.user?.email||"").toLowerCase()===ADMIN;
  };
  async function pushSetting(localKey, remoteKey, raw){
    if(!isAdmin||applyingRemote||raw==null)return;
    let value;try{value=JSON.parse(raw)}catch(e){return}
    const {error}=await sb.from("store_settings").upsert({key:remoteKey,value,updated_at:new Date().toISOString()},{onConflict:"key"});
    if(error)throw error;
  }
  async function pullSettings(){
    const {data,error}=await sb.from("store_settings").select("key,value").in("key",Object.values(settingsKeys));
    if(error){console.warn("Réglages partagés indisponibles:",error.message);return}
    // Si aucun réglage n'a encore été publié, initialise Supabase depuis le navigateur admin.
    // Les valeurs distantes existantes restent prioritaires et ne sont jamais écrasées au démarrage.
    if(isAdmin){
      const present=new Set((data||[]).map(row=>row.key));
      for(const localKey of Object.keys(settingsKeys)){
        const remoteKey=settingsKeys[localKey];
        if(present.has(remoteKey))continue;
        let raw=null;try{raw=localStorage.getItem(localKey)}catch(e){}
        if(raw==null)continue;
        try{
          const value=JSON.parse(raw);
          const {error:seedError}=await sb.from("store_settings").insert({key:remoteKey,value});
          if(seedError&&seedError.code!=="23505")console.warn("Publication initiale du réglage impossible:",remoteKey,seedError.message);
        }catch(e){}
      }
    }
    applyingRemote=true;
    try{
      for(const row of data||[]){
        const local=Object.keys(settingsKeys).find(k=>settingsKeys[k]===row.key);
        if(!local)continue;
        try{localStorage.setItem(local,JSON.stringify(row.value))}catch(e){}
      }
      try{if(typeof applyCT==="function")applyCT();if(typeof payLoad==="function")payLoad();if(typeof preApply==="function"){preApply();preTick&&preTick()}if(typeof sfill==="function")sfill()}catch(e){console.warn(e)}
    }finally{applyingRemote=false}
  }
  async function pushPromos(){
    if(!isAdmin)return;
    let promos=[];try{promos=JSON.parse(localStorage.getItem("up_k")||"[]")}catch(e){}
    if(!Array.isArray(promos))return;
    const rows=promos.filter(k=>k&&k.c).map(k=>({code:String(k.c).toUpperCase(),data:k,active:true,updated_at:new Date().toISOString()}));
    const {data:existing,error:readError}=await sb.from("promo_codes").select("code");
    if(readError)throw readError;
    if(rows.length){const {error}=await sb.from("promo_codes").upsert(rows,{onConflict:"code"});if(error)throw error}
    const keep=new Set(rows.map(r=>r.code));
    const stale=(existing||[]).map(r=>r.code).filter(c=>!keep.has(c));
    if(stale.length){const {error}=await sb.from("promo_codes").delete().in("code",stale);if(error)throw error}
  }
  async function pullPromos(){
    const {data,error}=await sb.from("promo_codes").select("data,code,active").eq("active",true);
    if(error){console.warn("Codes promo partagés indisponibles:",error.message);return}
    const remote=(data||[]).map(r=>r.data).filter(k=>k&&k.c);
    let local=[];try{local=JSON.parse(localStorage.getItem("up_k")||"[]")}catch(e){}
    if(!Array.isArray(local))local=[];
    // Les codes personnels/parrainage restent privés et ne sont jamais remplacés par les codes publics.
    const privateCodes=local.filter(k=>k&&(k.for||k.rw));
    const merged=[...remote,...privateCodes.filter(k=>!remote.some(r=>r.c===k.c))];
    applyingRemote=true;
    try{localStorage.setItem("up_k",JSON.stringify(merged))}catch(e){}finally{applyingRemote=false}
  }
  async function pullPacks(){
    const {data,error}=await sb.from("store_packs").select("id,data,published").eq("published",true);
    if(error){console.warn("Packs partagés indisponibles:",error.message);return}
    let local=[];try{local=JSON.parse(localStorage.getItem("up_pk")||"[]")}catch(e){}
    if(!Array.isArray(local))local=[];
    const remote=(data||[]).map(r=>r.data).filter(p=>p&&p.id!=null);
    if(isAdmin){
      const merged=new Map(remote.map(p=>[String(p.id),p]));
      for(const p of local)if(p&&p.id!=null&&!merged.has(String(p.id)))merged.set(String(p.id),p);
      const all=[...merged.values()];
      if(all.length){const rows=all.map(p=>({id:Number(p.id),data:p,published:true,updated_at:new Date().toISOString()}));const {error:e}=await sb.from("store_packs").upsert(rows,{onConflict:"id"});if(e)console.warn("Publication des packs impossible:",e.message)}
      applyingRemote=true;try{localStorage.setItem("up_pk",JSON.stringify(all));if(typeof PK!=="undefined")PK.splice(0,PK.length,...all)}finally{applyingRemote=false}
    }else if(remote.length){applyingRemote=true;try{localStorage.setItem("up_pk",JSON.stringify(remote));if(typeof PK!=="undefined")PK.splice(0,PK.length,...remote)}finally{applyingRemote=false}}
    try{if(typeof pklist==="function")pklist();if(typeof prender==="function")prender()}catch(e){}
  }
  async function pushPacks(){
    if(!isAdmin)return;
    let local=[];try{local=JSON.parse(localStorage.getItem("up_pk")||"[]")}catch(e){}
    if(!Array.isArray(local)||!local.length)return;
    const rows=local.filter(p=>p&&p.id!=null).map(p=>({id:Number(p.id),data:p,published:true,updated_at:new Date().toISOString()}));
    if(rows.length){const {error}=await sb.from("store_packs").upsert(rows,{onConflict:"id"});if(error)throw error}
  }
  async function pushOrders(){
    if(!isAdmin)return;
    let local=[];try{local=JSON.parse(localStorage.getItem("up_o")||"[]")}catch(e){}
    if(!Array.isArray(local)||!local.length)return;
    const rows=local.filter(o=>o&&o.id&&o.cu&&o.cu.e).map(o=>({id:String(o.id),customer_email:String(o.cu.e).trim().toLowerCase(),data:o,updated_at:new Date().toISOString()}));
    if(rows.length){const {error}=await sb.from("store_orders").upsert(rows,{onConflict:"id"});if(error)throw error}
  }
  async function pullOrders(){
    if(!isAdmin)return;
    const {data,error}=await sb.from("store_orders").select("id,customer_email,data,updated_at");
    if(error){console.warn("Commandes partagées indisponibles:",error.message);return}
    let local=[];try{local=JSON.parse(localStorage.getItem("up_o")||"[]")}catch(e){}
    if(!Array.isArray(local))local=[];
    const merged=new Map(local.filter(o=>o&&o.id).map(o=>[String(o.id),o]));
    for(const row of data||[])if(row.data&&row.id)merged.set(String(row.id),row.data);
    applyingRemote=true;
    try{localStorage.setItem("up_o",JSON.stringify([...merged.values()]))}finally{applyingRemote=false}
    try{if(typeof loadO==="function")loadO();if(typeof olist==="function")olist()}catch(e){}
    await pushOrders();
  }
  async function pushNewsletter(){
    if(!isAdmin)return;
    let local=[];try{local=JSON.parse(localStorage.getItem("up_n")||"[]")}catch(e){}
    if(!Array.isArray(local)||!local.length)return;
    const rows=local.filter(n=>n&&n.e).map(n=>({email:String(n.e).trim().toLowerCase(),data:{s:n.s||null,t:n.t||null}}));
    if(rows.length){const {error}=await sb.from("store_newsletter").upsert(rows,{onConflict:"email",ignoreDuplicates:true});if(error)throw error}
  }
  async function pullNewsletter(){
    if(!isAdmin)return;
    const {data,error}=await sb.from("store_newsletter").select("email,data,created_at");
    if(error){console.warn("Newsletter partagée indisponible:",error.message);return}
    let local=[];try{local=JSON.parse(localStorage.getItem("up_n")||"[]")}catch(e){}
    if(!Array.isArray(local))local=[];
    const merged=new Map(local.filter(n=>n&&n.e).map(n=>[String(n.e).toLowerCase(),n]));
    for(const r of data||[])if(r.email&&!merged.has(r.email.toLowerCase()))merged.set(r.email.toLowerCase(),{e:r.email,t:r.data?.t||Date.parse(r.created_at)||Date.now(),...(r.data?.s?{s:r.data.s}:{})});
    applyingRemote=true;try{localStorage.setItem("up_n",JSON.stringify([...merged.values()]))}finally{applyingRemote=false}
    try{if(typeof nlist==="function")nlist()}catch(e){}
    await pushNewsletter();
  }
  window.ULTIM_SYNC={
    subscribeNewsletter:async(email,source)=>{
      const {data,error}=await sb.rpc("newsletter_signup",{p_email:email,p_source:source||null});
      if(error)throw error;
      return data;
    }
  };
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    const result=originalSet.call(this,key,value);
    if(this===localStorage&&!applyingRemote){
      if(settingsKeys[key]){
        chain=chain.then(async()=>{isAdmin=await getSession();if(isAdmin)await pushSetting(key,settingsKeys[key],String(value))}).catch(e=>console.error("Sync réglage échouée:",e.message));
      }
      if(key==="up_pk"){chain=chain.then(async()=>{isAdmin=await getSession();if(isAdmin)await pushPacks()}).catch(e=>console.error("Sync packs échouée:",e.message));}
      if(key==="up_n"){chain=chain.then(async()=>{isAdmin=await getSession();if(isAdmin)await pushNewsletter()}).catch(e=>console.error("Sync newsletter échouée:",e.message));}
      if(key==="up_o"){chain=chain.then(async()=>{isAdmin=await getSession();if(isAdmin)await pushOrders()}).catch(e=>console.error("Sync commandes échouée:",e.message));}
      if(key==="up_k"){
        chain=chain.then(async()=>{isAdmin=await getSession();if(isAdmin)await pushPromos()}).catch(e=>console.error("Sync promos échouée:",e.message));
      }
    }
    return result;
  };
  async function init(){
    isAdmin=await getSession();
    await pullSettings();
    await pullPacks();
    await pullNewsletter();
    await pullOrders();
    await pullPromos();
    if(isAdmin){await pushPromos().catch(e=>console.warn("Publication des codes promo impossible:",e.message))}
    sb.channel("ultim-admin-sync")
      .on("postgres_changes",{event:"*",schema:"public",table:"store_settings"},()=>pullSettings())
      .on("postgres_changes",{event:"*",schema:"public",table:"store_newsletter"},()=>pullNewsletter())
      .on("postgres_changes",{event:"*",schema:"public",table:"store_orders"},()=>pullOrders())
      .on("postgres_changes",{event:"*",schema:"public",table:"promo_codes"},()=>pullPromos())
      .subscribe();
  }
  sb.auth.onAuthStateChange(()=>{setTimeout(()=>{getSession().then(v=>{isAdmin=v;if(v){pullSettings();pullPacks();pullNewsletter();pullOrders();pushPromos().catch(console.warn)}})},0)});
  init().catch(e=>console.warn("Initialisation synchro admin:",e.message));
})();