/* Supabase: catalogue partagé et authentification de l'administration. */
(function(){
  "use strict";
  const cfg=window.ULTIM_CONFIG||{};
  if(!window.supabase||!cfg.supabaseUrl||!cfg.supabaseAnonKey){
    console.error("Supabase non configuré : vérifie config.js et le chargement du SDK.");
    return;
  }
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  window.ULTIM_SUPABASE=sb;
  let session=null, syncing=Promise.resolve();
  const adminEmail=String(cfg.adminEmail||"").toLowerCase();
  const byId=id=>document.getElementById(id);
  const say=m=>{try{toast(m)}catch(e){console.log(m)}};
  const isImageData=s=>typeof s==="string"&&/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s);
  async function uploadImage(p){
    if(!isImageData(p.img))return p;
    const parts=p.img.split(",");
    const mime=(parts[0].match(/data:(.*?);base64/)||[])[1]||"image/webp";
    const bin=atob(parts[1]), bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const ext=mime.includes("png")?"png":mime.includes("jpeg")?"jpg":mime.includes("gif")?"gif":"webp";
    const path=String(p.id||Date.now())+"-"+Date.now()+"."+ext;
    const {error}=await sb.storage.from("product-images").upload(path,new Blob([bytes],{type:mime}),{upsert:true,contentType:mime,cacheControl:"3600"});
    if(error)throw error;
    p.img=sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    return p;
  }
  async function syncProducts(){
    if(!session||String(session.user?.email||"").toLowerCase()!==adminEmail)throw new Error("Connecte-toi avec le compte administrateur autorisé.");
    const copy=[];
    for(const original of P){
      const p=await uploadImage({...original});
      copy.push(p);
    }
    const rows=copy.map(p=>({
      id:Number.isSafeInteger(Number(p.id))?Number(p.id):undefined,
      name:String(p.n||"Produit"),
      price:Number(p.co?0:(Array.isArray(p.v)&&p.v.length?Math.min(...p.v.map(v=>Number(v.p)||0)):0)),
      image_url:typeof p.img==="string"&&!p.img.startsWith("data:")?p.img:null,
      stock:Number(p.stk)||0,
      description:String(p.d||""),
      published:true,
      data:p
    }));
    if(rows.some(r=>r.id===undefined))throw new Error("Un produit a un identifiant invalide.");
    const {error:upErr}=await sb.from("products").upsert(rows,{onConflict:"id"});
    if(upErr)throw upErr;
    const {data:remote,error:selErr}=await sb.from("products").select("id,data");
    if(selErr)throw selErr;
    const keep=new Set(copy.map(p=>String(p.id)));
    const stale=(remote||[]).filter(r=>r.data&&r.data.id!=null&&!keep.has(String(r.data.id))).map(r=>r.id);
    if(stale.length){const {error:delErr}=await sb.from("products").delete().in("id",stale);if(delErr)throw delErr;}
    // Garde les URL d'images nouvellement téléversées dans le stockage local aussi.
    P.splice(0,P.length,...copy);
    try{localStorage.setItem("up_p",JSON.stringify(P))}catch(e){}
  }
  function queueSync(){
    syncing=syncing.then(()=>syncProducts()).catch(e=>{console.error("Échec de synchronisation Supabase:",e);say("Produit enregistré sur cet appareil, mais synchronisation Supabase échouée : "+(e.message||"vérifie les règles SQL et le compte admin."));});
  }
  // store() reste synchrone pour ne pas casser les formulaires existants ; la synchro distante est mise en file.
  store=function(){
    try{localStorage.setItem("up_p",JSON.stringify(P));if(session)queueSync();return 1}
    catch(e){say("Stockage local indisponible.");return 0}
  };
  gate=function(mode){
    const lg=byId("lg"),ap=byId("ap");
    if(!lg||!ap)return;
    ap.style.display="none";lg.style.display="";
    lg.innerHTML='<h2 style="font-size:40px">Administration</h2><p class="sub" style="margin:0 0 14px">Connexion sécurisée Supabase pour '+adminEmail.replace(/&/g,"&amp;").replace(/</g,"&lt;")+'.</p><form id="sbLogin"><input id="pw" type="password" autocomplete="current-password" placeholder="Mot de passe Supabase" required><button class="btn" type="submit">Se connecter</button><p class="sub" id="sbErr" role="status"></p></form>';
    byId("sbLogin").addEventListener("submit",e=>{e.preventDefault();aok()});
  };
  aok=async function(){
    const pw=byId("pw");
    if(!pw||!pw.value)return say("Entre le mot de passe de ton compte Supabase.");
    const {data,error}=await sb.auth.signInWithPassword({email:adminEmail,password:pw.value});
    pw.value="";
    if(error){const err=byId("sbErr");if(err)err.textContent="Connexion refusée. Vérifie le mot de passe et que l'utilisateur existe dans Supabase Auth.";return;}
    session=data.session;
    if(String(session?.user?.email||"").toLowerCase()!==adminEmail){await sb.auth.signOut();session=null;return say("Ce compte n'est pas autorisé à administrer la boutique.");}
    // Fusionne d'abord le catalogue distant avec le catalogue local pour éviter d'écraser
    // les produits déjà publiés lors de la première connexion sur cet appareil.
    try{
      const {data:remote,error:readError}=await sb.from("products").select("data");
      if(readError)throw readError;
      const merged=new Map();
      for(const row of (remote||[])){const p=row.data;if(p&&p.id!=null)merged.set(String(p.id),p);}
      for(const p of P){if(p&&p.id!=null)merged.set(String(p.id),p);}
      P.splice(0,P.length,...merged.values());
      await syncProducts();
    }catch(e){console.error("Synchronisation initiale impossible:",e);say("Connexion réussie, mais synchronisation impossible : "+(e.message||"vérifie les politiques RLS et Storage."));}
    byId("ad").classList.add("on");byId("lg").style.display="none";byId("ap").style.display="";
    try{areset();alist();olist();tabs(tab);idle()}catch(e){console.error(e)}
    say("Administration connectée ✔");
  };
  adm=function(open){
    const panel=byId("ad");if(!panel)return;
    panel.classList.toggle("on",!!open);
    if(!open){clearTimeout(idleT);return;}
    if(session&&String(session.user?.email||"").toLowerCase()===adminEmail){
      byId("lg").style.display="none";byId("ap").style.display="";
      try{areset();alist();olist();tabs(tab);idle()}catch(e){}
    }else gate("login");
  };
  // Remplace le catalogue local par la version publique partagée quand elle est disponible.
  async function loadShared(){
    const {data,error}=await sb.from("products").select("data").eq("published",true);
    if(error){console.warn("Catalogue Supabase indisponible, conservation du catalogue local:",error.message);return;}
    const products=(data||[]).map(r=>r.data).filter(p=>p&&p.n&&p.c);
    if(products.length||!(P&&P.length)){
      P.splice(0,P.length,...products);
      try{localStorage.setItem("up_p",JSON.stringify(P))}catch(e){}
      W=W.filter(id=>P.some(p=>p.id==id));
      try{cats();render();prender();upd()}catch(e){console.error(e)}
    }
  }
  sb.auth.getSession().then(({data})=>{
    const s=data?.session;
    if(s&&String(s.user?.email||"").toLowerCase()===adminEmail)session=s;
    else if(s)sb.auth.signOut();
  }).catch(console.error);
  sb.auth.onAuthStateChange((_event,s)=>{
    session=s&&String(s.user?.email||"").toLowerCase()===adminEmail?s:null;
  });
  loadShared();
})();