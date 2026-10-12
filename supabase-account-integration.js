/* ULTIM'Peps — synchronisation des comptes clients multi-appareils */
(function(){
"use strict";
const sb=window.ULTIM_SUPABASE;if(!sb||!sb.auth||!sb.from)return;
const login=window.ulog,register=window.ureg,save=window.usave;let busy=false;
const users=()=>{try{let a=JSON.parse(localStorage.getItem("up_u")||"[]");return Array.isArray(a)?a:[]}catch(_){return[]}};
const user=()=>{const e=localStorage.getItem("up_se");return e?users().find(x=>x.e===e)||null:null};
const orders=()=>{try{let a=JSON.parse(localStorage.getItem("up_o")||"[]");return Array.isArray(a)?a:[]}catch(_){return[]}};
async function sess(){const r=await sb.auth.getSession();if(r.error)throw r.error;return r.data.session}
async function sync(){
 const s=await sess();if(!s||!s.user)return false;
 const id=s.user.id,email=s.user.email.toLowerCase();
 const q=await sb.from("customer_profiles").select("user_id,email,data,updated_at").eq("user_id",id).maybeSingle();if(q.error)throw q.error;
 let list=users(),u=list.find(x=>x.e===email),d=q.data&&q.data.data;
 if(d&&u){Object.assign(u,{n:d.n||u.n||"",a:d.a||u.a||"",z:d.z||u.z||"",v:d.v||u.v||"",rc:u.rc||d.rc||""});localStorage.setItem("up_u",JSON.stringify(list));if(typeof window.uset==="function")window.uset();}
 else if(d&&!u){u={e:email,n:d.n||"",s:"",h:"",kv:2,rc:d.rc||"",a:d.a||"",z:d.z||"",v:d.v||"",t:d.t||Date.now()};list.push(u);localStorage.setItem("up_u",JSON.stringify(list));if(typeof window.uset==="function")window.uset();}
 else if(u){d={n:u.n||"",a:u.a||"",z:u.z||"",v:u.v||"",rc:u.rc||"",t:u.t||Date.now()};}
 if(u&&d){const w=await sb.from("customer_profiles").upsert({user_id:id,email,data:d,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(w.error)throw w.error;}
 const r=await sb.from("store_orders").select("id,customer_email,data,updated_at").ilike("customer_email",email);if(r.error)throw r.error;
 const m=new Map(orders().map(o=>[String(o.id),o]));(r.data||[]).forEach(x=>{if(x&&x.id&&x.data)m.set(String(x.id),x.data)});
 localStorage.setItem("up_o",JSON.stringify([...m.values()]));if(typeof window.loadO==="function")window.loadO();if(typeof window.arender==="function")window.arender();return true;
}
async function auth(email,password,name){
 let r=await sb.auth.signInWithPassword({email,password});
 if(!r.error&&r.data&&r.data.session){await sync();return "ok";}
 r=await sb.auth.signUp({email,password,options:{data:{name:name||""}}});
 if(r.error)throw r.error;if(r.data&&r.data.session){await sync();return "ok";}return "confirm";
}
if(typeof login==="function")window.ulog=async function(e){
 const f=new FormData(e.target),email=String(f.get("e")||"").trim().toLowerCase(),password=String(f.get("p")||"");
 await login.apply(this,arguments);const u=user();if(!u||u.e!==email||!password)return;
 try{if(typeof window.hp==="function"&&await window.hp(password,u.s,u.kv)!==u.h)return;}catch(_){return;}
 try{const result=await auth(email,password,u.n);if(typeof window.toast==="function")window.toast(result==="ok"?"Compte synchronisé sur vos appareils ✔":"Confirmez l’e-mail reçu pour activer la synchronisation.");}
 catch(err){console.warn("Sync compte:",err.message);if(typeof window.toast==="function")window.toast("Connexion locale réussie, mais synchronisation distante indisponible.");}
};
if(typeof register==="function")window.ureg=async function(e){
 const f=new FormData(e.target),email=String(f.get("e")||"").trim().toLowerCase(),password=String(f.get("p")||""),name=String(f.get("n")||"").trim();
 if(users().some(x=>x.e===email))return register.apply(this,arguments);
 await register.apply(this,arguments);const u=user();if(!u||u.e!==email||!password)return;
 try{const result=await auth(email,password,name);if(typeof window.toast==="function")window.toast(result==="ok"?"Compte créé et synchronisé ✔":"Confirmez l’e-mail reçu pour synchroniser ce compte sur les autres appareils.");}
 catch(err){console.warn("Sync inscription:",err.message);if(typeof window.toast==="function")window.toast("Compte local créé ; synchronisation distante indisponible.");}
};
if(typeof save==="function")window.usave=async function(e){await save.apply(this,arguments);try{await sync();}catch(err){console.warn("Sync profil:",err.message);}};
sb.auth.onAuthStateChange((event,s)=>{if(busy||!s||!s.user)return;busy=true;setTimeout(()=>sync().catch(e=>console.warn("Sync client:",e.message)).finally(()=>busy=false),0);});
setTimeout(()=>sync().catch(e=>console.info("Sync client en attente:",e.message)),1800);
window.ULTIM_ACCOUNT_SYNC={refresh:sync};
})();