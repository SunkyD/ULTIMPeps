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
    // Admin : lire aussi les packs masqués pour qu'un ancien cache local ne les republie pas.
    // Visiteur : ne lire que les packs publiés.
    const query=sb.from("store_packs").select("id,data,published");
    const {data,error}=isAdmin?await query:await query.eq("published",true);
    if(error){console.warn("Packs partagés indisponibles:",error.message);return}
    const rows=data||[];
    const remote=rows.filter(r=>r.published&&r.data&&r.data.id!=null).map(r=>r.data);
    // Supabase est la source de vérité : ne jamais republier depuis le cache local
    // un pack absent ou masqué à distance (cela annulait les suppressions).
    applyingRemote=true;
    try{localStorage.setItem("up_pk",JSON.stringify(remote));if(typeof PK!=="undefined")PK.splice(0,PK.length,...remote)}
    finally{applyingRemote=false}
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
  async function pullCashbackAdjustments(){
    if(!isAdmin)return;
    const {data,error}=await sb.rpc("admin_store_cashback_adjustments");if(error)throw error;
    applyingRemote=true;try{localStorage.setItem("up_cba",JSON.stringify((data||[]).map(x=>({...x,email:String(x.customer_email||"").toLowerCase()}))));}finally{applyingRemote=false}
    try{if(typeof ulist==="function")ulist()}catch(e){}
  }
  async function pullClientsAndReferrals(){
    if(!isAdmin)return;
    const [customers,referrals]=await Promise.all([
      sb.rpc("admin_store_customers"),
      sb.rpc("admin_store_referrals")
    ]);
    if(customers.error)throw customers.error;
    if(referrals.error)throw referrals.error;
    let local=[];try{local=JSON.parse(localStorage.getItem("up_u")||"[]")}catch(e){}
    if(!Array.isArray(local))local=[];
    const users=new Map(local.filter(u=>u&&u.e).map(u=>[String(u.e).toLowerCase(),u]));
    for(const row of customers.data||[]){
      const email=String(row.email||"").toLowerCase();if(!email)continue;
      const d=row.data||{},prior=users.get(email)||{};
      users.set(email,{...prior,e:email,n:d.n||prior.n||"",s:prior.s||"",h:prior.h||"",kv:prior.kv||2,rc:d.rc||prior.rc||"",a:d.a||prior.a||"",z:d.z||prior.z||"",v:d.v||prior.v||"",t:prior.t||d.t||Date.parse(row.updated_at)||Date.now()});
    }
    applyingRemote=true;
    try{localStorage.setItem("up_u",JSON.stringify([...users.values()]));if(typeof uset==="function")uset()}finally{applyingRemote=false}
    let refs=[];try{refs=JSON.parse(localStorage.getItem("up_rf")||"[]")}catch(e){}
    if(!Array.isArray(refs))refs=[];
    const merged=new Map(refs.filter(x=>x&&x.fe).map(x=>[String(x.fe).toLowerCase(),x]));
    for(const x of referrals.data||[]){
      const fe=String(x.referred_email||"").toLowerCase(),re=String(x.referrer_email||"").toLowerCase();
      if(!fe||!re)continue;
      merged.set(fe,{rc:x.referral_code,re,fe,fn:x.referred_name||"Client",t:Date.parse(x.created_at)||Date.now()});
    }
    applyingRemote=true;
    try{localStorage.setItem("up_rf",JSON.stringify([...merged.values()]))}finally{applyingRemote=false}
    try{if(typeof ulist==="function")ulist();if(typeof rflist==="function")rflist()}catch(e){}
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
    refreshAdminData:pullClientsAndReferrals,
    addCashbackAdjustment:async(email,amount,direction,reason)=>{const {data,error}=await sb.rpc("admin_add_cashback_adjustment",{p_email:String(email||"").trim().toLowerCase(),p_amount:Number(amount),p_direction:direction,p_reason:String(reason||"").trim()});if(error)throw error;await pullCashbackAdjustments();return data;},
    deleteCustomer:async(email)=>{
      const {data,error}=await sb.rpc("admin_delete_store_customer",{p_email:String(email||"").trim().toLowerCase()});
      if(error)throw error;
      if(data!==true)throw new Error("Aucun compte Supabase correspondant n'a été supprimé.");
      let local=[];try{local=JSON.parse(localStorage.getItem("up_u")||"[]")}catch(e){}
      if(!Array.isArray(local))local=[];
      applyingRemote=true;try{localStorage.setItem("up_u",JSON.stringify(local.filter(u=>String(u.e||"").toLowerCase()!==String(email||"").trim().toLowerCase())))}finally{applyingRemote=false}
      if(typeof uset==="function")uset();
      if(typeof ulist==="function")ulist();
      return true;
    },
    submitOrder:async(order)=>{
      if(!order||!order.id||!order.cu||!order.cu.e)throw new Error("Commande invalide");
      const {data,error}=await sb.rpc("submit_store_order",{p_id:String(order.id),p_customer_email:String(order.cu.e),p_data:order});
      if(error)throw error;
      return data;
    },
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
    await pullCashbackAdjustments().catch(e=>console.warn("Chargement corrections cashback:",e.message));
    await pullClientsAndReferrals().catch(e=>console.warn("Chargement comptes/parrainages:",e.message));
    await pullPromos();
    if(isAdmin){await pushPromos().catch(e=>console.warn("Publication des codes promo impossible:",e.message))}
    sb.channel("ultim-admin-sync")
      .on("postgres_changes",{event:"*",schema:"public",table:"store_settings"},()=>pullSettings())
      .on("postgres_changes",{event:"*",schema:"public",table:"store_newsletter"},()=>pullNewsletter())
      .on("postgres_changes",{event:"*",schema:"public",table:"store_orders"},()=>pullOrders())
      .on("postgres_changes",{event:"*",schema:"public",table:"store_cashback_adjustments"},()=>pullCashbackAdjustments())
      .on("postgres_changes",{event:"*",schema:"public",table:"promo_codes"},()=>pullPromos())
      .subscribe();
  }
  sb.auth.onAuthStateChange(()=>{setTimeout(()=>{getSession().then(v=>{isAdmin=v;if(v){pullSettings();pullPacks();pullNewsletter();pullOrders();pullCashbackAdjustments().catch(console.warn);pullClientsAndReferrals().catch(console.warn);pushPromos().catch(console.warn)}})},0)});
  init().catch(e=>console.warn("Initialisation synchro admin:",e.message));
})();