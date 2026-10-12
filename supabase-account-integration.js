/* ULTIM'Peps — synchronisation des comptes clients multi-appareils */
(function(){
  "use strict";
  const sb=window.ULTIM_SUPABASE;
  if(!sb || !sb.auth || !sb.from) return;
  const originalLogin=window.ulog;
  const originalRegister=window.ureg;
  const originalSave=window.usave;
  const ADMIN="logan.decupper1@gmail.com";
  let syncing=false;

  const readUsers=()=>{try{const v=JSON.parse(localStorage.getItem("up_u")||"[]");return Array.isArray(v)?v:[]}catch(_){return[]}};
  const readOrders=()=>{try{const v=JSON.parse(localStorage.getItem("up_o")||"[]");return Array.isArray(v)?v:[]}catch(_){return[]}};
  const writeUsers=v=>{try{localStorage.setItem("up_u",JSON.stringify(v));return true}catch(_){return false}};
  const mergeOrders=rows=>{
    const local=readOrders(), byId=new Map(local.map(o=>[String(o.id),o]));
    for(const row of rows||[]){if(row&&row.data&&row.id)byId.set(String(row.id),row.data);}
    try{localStorage.setItem("up_o",JSON.stringify([...byId.values()]));if(typeof window.loadO==="function")window.loadO();if(typeof window.arender==="function")window.arender();}catch(e){console.warn("Synchronisation des commandes:",e.message);}
  };
  async function session(){const {data,error}=await sb.auth.getSession();if(error)throw error;return data.session;}
  async function saveProfile(user){
    if(!user||!user.id||!user.email)return;
    const email=user.email.toLowerCase();
    const {data:remote,error}=await sb.from("customer_profiles").select("user_id,email,data,updated_at").eq("user_id",user.id).maybeSingle();
    if(error)throw error;
    const users=readUsers(),local=users.find(x=>x.e===email);
    if(remote&&remote.data&&local){
      const d=remote.data;
      Object.assign(local,{n:d.n||local.n||"",a:d.a||local.a||"",z:d.z||local.z||"",v:d.v||local.v||"",rc:local.rc||d.rc||""});
      writeUsers(users);
      if(typeof window.uset==="function")window.uset();
    }else if(!remote&&local){
      const data={n:local.n||"",a:local.a||"",z:local.z||"",v:local.v||"",rc:local.rc||"",t:local.t||Date.now()};
      const {error:upErr}=await sb.from("customer_profiles").upsert({user_id:user.id,email,data,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      if(upErr)throw upErr;
    }else if(remote&&!local){
      const d=remote.data||{};
      users.push({e:email,n:d.n||"",s:"",h:"",kv:2,rc:d.rc||"",a:d.a||"",z:d.z||"",v:d.v||"",t:d.t||Date.now()});
      writeUsers(users);
      if(typeof window.uset==="function")window.uset();
    }
  }
  async function pushProfile(){
    const s=await session();if(!s||!s.user||!s.user.email)return;
    const email=s.user.email.toLowerCase(),u=readUsers().find(x=>x.e===email);
    if(!u)return;
    const data={n:u.n||"",a:u.a||"",z:u.z||"",v:u.v||"",rc:u.rc||"",t:u.t||Date.now()};
    const {error}=await sb.from("customer_profiles").upsert({user_id:s.user.id,email,data,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(error)throw error;
  }
  async function pullOrders(){
    const s=await session();if(!s||!s.user||!s.user.email)return;
    const {data,error}=await sb.from("store_orders").select("id,customer_email,data,updated_at").ilike("customer_email",s.user.email);
    if(error)throw error;
    mergeOrders(data||[]);
  }
  async function afterAuth(){
    const s=await session();if(!s||!s.user)return false;
    await saveProfile(s.user);
    await pushProfile();
    await pullOrders();
    return true;
  }
  async function provision(email,password,name){
    let res=await sb.auth.signInWithPassword({email,password});
    if(!res.error&&res.data&&res.data.session){await afterAuth();return {ok:true,created:false};}
    const signed=await sb.auth.signUp({email,password,options:{data:{name:name||""}}});
    if(signed.error){
      // An existing account with an incorrect Supabase password must not be silently replaced.
      return {ok:false,confirmation:false,error:signed.error};
    }
    if(signed.data&&signed.data.session){
      await afterAuth();return {ok:true,created:true};
    }
    return {ok:false,confirmation:true};
  }

  if(typeof originalLogin==="function")window.ulog=async function(e){
    const f=e&&e.target?new FormData(e.target):null;
    const email=f&&f.get("e")?String(f.get("e")).trim().toLowerCase():"";
    const password=f&&f.get("p")?String(f.get("p")):"";
    await originalLogin.apply(this,arguments);
    const current=window.U;
    if(!current||current.e!==email||!password)return;
    try{
      const result=await provision(email,password,current.n||"");
      if(result.ok){if(typeof window.toast==="function")window.toast("Compte synchronisé sur vos appareils ✔");}
      else if(result.confirmation){if(typeof window.toast==="function")window.toast("Vérifiez votre e-mail pour activer la synchronisation du compte.");}
      else {console.warn("Compte distant non synchronisé:",result.error&&result.error.message);if(typeof window.toast==="function")window.toast("Connexion locale réussie, mais synchronisation distante impossible. Vérifiez votre e-mail ou réinitialisez votre mot de passe.");}
    }catch(err){console.warn("Synchronisation du compte:",err.message);if(typeof window.toast==="function")window.toast("Connexion locale réussie ; synchronisation distante indisponible pour le moment.");}
  };

  if(typeof originalRegister==="function")window.ureg=async function(e){
    const f=e&&e.target?new FormData(e.target):null;
    const email=f&&f.get("e")?String(f.get("e")).trim().toLowerCase():"";
    const password=f&&f.get("p")?String(f.get("p")):"";
    const name=f&&f.get("n")?String(f.get("n")).trim():"";
    await originalRegister.apply(this,arguments);
    if(!window.U||window.U.e!==email||!password)return;
    try{
      const result=await provision(email,password,name);
      if(result.ok){if(typeof window.toast==="function")window.toast("Compte créé et synchronisé ✔");}
      else if(result.confirmation){if(typeof window.toast==="function")window.toast("Compte créé sur cet appareil. Confirmez l’e-mail reçu pour activer la synchronisation sur les autres appareils.");}
      else {console.warn("Création du compte distant:",result.error&&result.error.message);if(typeof window.toast==="function")window.toast("Compte local créé, mais la synchronisation distante n’a pas abouti. Essayez de vous connecter ou de réinitialiser le mot de passe.");}
    }catch(err){console.warn("Synchronisation du compte:",err.message);if(typeof window.toast==="function")window.toast("Compte local créé ; synchronisation distante indisponible pour le moment.");}
  };

  if(typeof originalSave==="function")window.usave=async function(e){
    await originalSave.apply(this,arguments);
    try{if(window.U&&window.U.e)await pushProfile();}catch(err){console.warn("Enregistrement du profil distant:",err.message);if(typeof window.toast==="function")window.toast("Infos enregistrées ici, mais la synchronisation distante a échoué.");}
  };

  sb.auth.onAuthStateChange((event,session)=>{
    if(syncing||!session||!session.user)return;
    syncing=true;
    setTimeout(()=>afterAuth().catch(e=>console.warn("Synchronisation client:",e.message)).finally(()=>{syncing=false;}),0);
  });
  setTimeout(()=>afterAuth().catch(e=>console.info("Synchronisation client en attente:",e.message)),1500);
  window.ULTIM_ACCOUNT_SYNC={refresh:afterAuth};
})();