/* El Arte Gráfico Academy — capa de datos.
   SupabaseAPI: producción (Supabase Auth + REST + Storage, sin librerías).
   LocalAPI: modo de prueba en el navegador (sin servidor), mismas funciones. */
(function(){
"use strict";
const CFG=window.AG_CONFIG||{};
const uuid=()=>(crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)}));
const now=()=>new Date().toISOString();
const isPrem=p=>!!p&&!p.banned&&(p.role==="admin"||(p.premium_until&&new Date(p.premium_until)>new Date()));
const errMsg=j=>{const m=(j&&(j.error_description||j.msg||j.message||j.error))||"Error";
  const map={"Invalid login credentials":"Usuario, correo o contraseña incorrectos.","Email not confirmed":"Confirma tu correo antes de ingresar (revisa tu bandeja de entrada y spam).","User already registered":"Ese correo ya tiene una cuenta.","captcha protection: request disallowed (captcha-verification-process-failed)":"Verificación anti-bots fallida. Inténtalo de nuevo."};
  if(map[m])return map[m];
  if(/rate limit/i.test(m))return "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.";
  if(/invalid.*email|email.*invalid/i.test(m))return "Ese correo no es válido. Revísalo.";
  if(/password should be at least/i.test(m))return "La contraseña es muy corta.";
  if(/signups not allowed/i.test(m))return "Los registros están cerrados por ahora.";
  if(/failed to fetch|networkerror/i.test(m))return "Sin conexión con el servidor. Revisa tu internet.";
  return m};

/* ===================== SUPABASE ===================== */
function SupabaseAPI(url,key){
  url=url.replace(/\/$/,"");
  let sess=null;try{sess=JSON.parse(localStorage.getItem("ag_sess")||"null")}catch(e){}
  /* sesión compartida entre elartegrafico.com y academia.elartegrafico.com: el refresh token viaja en una cookie del dominio */
  const SHARED=/(^|\.)elartegrafico\.com$/.test(location.hostname);
  const ckGet=()=>{const m=document.cookie.match(/(?:^|; )ag_rt=([^;]*)/);return m?decodeURIComponent(m[1]):null};
  const ckSet=v=>{if(!SHARED)return;const b="; domain=.elartegrafico.com; path=/; secure; samesite=lax";document.cookie=v?`ag_rt=${encodeURIComponent(v)}; max-age=5184000${b}`:`ag_rt=; max-age=0${b}`};
  const saveSess=s=>{sess=s;try{s?localStorage.setItem("ag_sess",JSON.stringify(s)):localStorage.removeItem("ag_sess")}catch(e){}ckSet(s&&s.refresh_token)};
  let prof=null;
  async function raw(path,{method="GET",body,headers={},auth=true,isFile=false}={}){
    const h=Object.assign({apikey:key,Authorization:"Bearer "+((auth&&sess&&sess.access_token)||key)},headers);
    if(body!==undefined&&!isFile)h["Content-Type"]="application/json";
    const r=await fetch(url+path,{method,headers:h,body:isFile?body:(body!==undefined?JSON.stringify(body):undefined)});
    let j=null;const t=await r.text();try{j=t?JSON.parse(t):null}catch(e){j=t}
    return{ok:r.ok,status:r.status,j};
  }
  async function refresh(){const rt=(SHARED&&ckGet())||(sess&&sess.refresh_token);if(!rt)return false;
    const r=await raw("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:{refresh_token:rt},auth:false});
    if(r.ok){saveSess(r.j);return true}saveSess(null);return false}
  async function req(path,opt={}){
    if(sess&&sess.expires_at&&sess.expires_at*1000<Date.now()+60000)await refresh();
    let r=await raw(path,opt);
    if(r.status===401&&sess){if(await refresh())r=await raw(path,opt)}
    if(!r.ok)throw new Error(errMsg(r.j));
    return r.j;
  }
  const sel=(t,q="")=>req(`/rest/v1/${t}?select=*${q}`);
  const ups=(t,o)=>req(`/rest/v1/${t}`,{method:"POST",body:o,headers:{Prefer:"resolution=merge-duplicates,return=representation"}}).then(r=>r&&r[0]);
  const del=(t,id,col="id")=>req(`/rest/v1/${t}?${col}=eq.${encodeURIComponent(id)}`,{method:"DELETE"});
  const rpc=(f,a={})=>req(`/rest/v1/rpc/${f}`,{method:"POST",body:a});
  const cap=c=>c?{gotrue_meta_security:{captcha_token:c}}:{};
  return{
    mode:"supabase",
    async init(){
      // vuelta desde un correo (confirmación o recuperar contraseña): #access_token=...&type=...
      const h=location.hash;let recovery=false;
      if(h.includes("access_token=")){const p=new URLSearchParams(h.slice(1));
        saveSess({access_token:p.get("access_token"),refresh_token:p.get("refresh_token"),expires_at:Math.floor(Date.now()/1000)+(+p.get("expires_in")||3600),user:null});
        recovery=p.get("type")==="recovery";history.replaceState(null,"",location.pathname+(recovery?"#nueva-clave":"#inicio"))}
      if(SHARED){const rt=ckGet();
        if(!rt&&sess)saveSess(null);                       // cerró sesión en el otro sitio
        else if(rt&&(!sess||sess.refresh_token!==rt)){sess={refresh_token:rt};if(!(await refresh()))saveSess(null)}}
      if(sess){try{const u=await req("/auth/v1/user");sess.user=u;saveSess(sess);await this.loadProfile()}catch(e){saveSess(null)}}
      return{recovery};
    },
    shareSession(){if(sess&&sess.refresh_token)ckSet(sess.refresh_token);return SHARED?!!ckGet():true},
    user(){return sess&&sess.user?{id:sess.user.id,email:sess.user.email}:null},
    profile(){return prof},
    async loadProfile(){if(!sess||!sess.user){prof=null;return null}const r=await sel("profiles",`&id=eq.${sess.user.id}`);prof=r&&r[0]||null;if(prof)prof.email=sess.user.email;return prof},
    isPremium(){return isPrem(prof)},isAdmin(){return !!prof&&prof.role==="admin"&&!prof.banned},
    async usernameAvailable(u){return !!(await rpc("username_available",{u}))},
    async signUp({username,email,password,captcha}){
      const typo={"gmai.com":"gmail.com","gmial.com":"gmail.com","gmail.co":"gmail.com","gamil.com":"gmail.com","hotmial.com":"hotmail.com","hotmai.com":"hotmail.com","outlok.com":"outlook.com","yaho.com":"yahoo.com"};const dom=(email.split("@")[1]||"").toLowerCase();
      if(typo[dom])throw new Error("Revisa tu correo: ¿quisiste decir @"+typo[dom]+"?");
      if(!(await this.usernameAvailable(username)))throw new Error("Ese nombre de usuario ya existe.");
      const r=await raw("/auth/v1/signup",{method:"POST",auth:false,body:Object.assign({email,password,data:{username,accepted_terms_at:new Date().toISOString(),terms_version:"2026-11-09"}},cap(captcha))});
      if(!r.ok)throw new Error(errMsg(r.j));
      if(r.j&&r.j.access_token){saveSess(r.j);await this.loadProfile();return{confirm:false}}
      return{confirm:true};
    },
    async signIn({email,password,captcha}){
      if(!email.includes("@")){const r0=await raw("/rest/v1/rpc/login_email",{method:"POST",auth:false,body:{u:email,pw:password}});
        if(!r0.ok){if(r0.status===404)throw new Error("Ingresa con tu correo por ahora.");throw new Error(errMsg(r0.j))}
        if(!r0.j)throw new Error("Usuario o contraseña incorrectos.");email=r0.j}
      const r=await raw("/auth/v1/token?grant_type=password",{method:"POST",auth:false,body:Object.assign({email,password},cap(captcha))});
      if(!r.ok)throw new Error(errMsg(r.j));saveSess(r.j);await this.loadProfile();
      if(prof&&prof.banned){await this.signOut();throw new Error("Tu cuenta está suspendida. Contacta al equipo.")}
    },
    async signOut(){try{await raw("/auth/v1/logout",{method:"POST"})}catch(e){}saveSess(null);prof=null},
    async recover(email,captcha){const r=await raw("/auth/v1/recover",{method:"POST",auth:false,body:Object.assign({email},cap(captcha))});if(!r.ok)throw new Error(errMsg(r.j))},
    async updatePassword(password){await req("/auth/v1/user",{method:"PUT",body:{password}})},
    // contenido
    async site(){const r=await sel("site_settings","&id=eq.1");return(r&&r[0]&&r[0].data)||{}},
    slides(place){return sel("slides",`&place=eq.${place}&order=sort.asc`)},
    modules(){return sel("modules","&order=sort.asc")},
    lessonIndex(){return rpc("lesson_index")},
    async lesson(id){const r=await sel("lessons",`&id=eq.${id}`);return r&&r[0]||null},
    lessons(){return sel("lessons","&order=sort.asc")},
    exercises(f){return f.demo?sel("exercises","&is_demo=eq.true&order=sort.asc"):f.practice?sel("exercises","&lesson_id=is.null&is_demo=eq.false&order=sort.asc"):sel("exercises",`&lesson_id=eq.${f.lessonId}&order=sort.asc`)},
    allExercises(){return sel("exercises","&order=sort.asc")},
    async grade(id){const r=await rpc("grade_exercise",{ex:id});if(r&&r.error)throw new Error(r.error);if(prof&&r&&r.demo_left!=null)prof.demo_used=5-r.demo_left;return r},
    async progressGet(){if(!sess)return null;const r=await sel("progress",`&user_id=eq.${sess.user.id}`);return r&&r[0]||null},
    progressSave(xp,data){return ups("progress",{user_id:sess.user.id,xp,data,updated_at:now()})},
    leaderboard(){return rpc("leaderboard")},
    posts(){return sel("posts","&order=pinned.desc,created_at.desc")},
    async post(id){const r=await sel("posts",`&id=eq.${id}`);return r&&r[0]||null},
    comments(pid){return rpc("post_comments",{pid})},
    addComment(post_id,body){return req("/rest/v1/comments",{method:"POST",body:{post_id,body},headers:{Prefer:"return=minimal"}})},
    delComment(id){return del("comments",id)},
    // admin
    saveSite(data){return ups("site_settings",{id:1,data,updated_at:now()})},
    allSlides(){return sel("slides","&order=place.asc,sort.asc")},
    saveSlide(s){return ups("slides",s)},delSlide(id){return del("slides",id)},
    saveModule(m){return ups("modules",m)},delModule(id){return del("modules",id)},
    saveLesson(l){return ups("lessons",l)},delLesson(id){return del("lessons",id)},
    async exerciseAnswer(id){const r=await sel("exercise_answers",`&exercise_id=eq.${id}`);return r&&r[0]||null},
    async saveExercise(e,a){const x=await ups("exercises",e);await ups("exercise_answers",Object.assign({exercise_id:x.id},a));return x},
    delExercise(id){return del("exercises",id)},
    savePost(p){return ups("posts",p)},delPost(id){return del("posts",id)},
    users(){return rpc("admin_users")},
    setUser(id,patch){return req(`/rest/v1/profiles?id=eq.${id}`,{method:"PATCH",body:patch,headers:{Prefer:"return=minimal"}})},
    async upload(file){const name=Date.now()+"-"+file.name.toLowerCase().replace(/[^a-z0-9.]+/g,"-");
      await req(`/storage/v1/object/media/${name}`,{method:"POST",body:file,isFile:true,headers:{"Content-Type":file.type||"application/octet-stream","x-upsert":"true"}});
      return `${url}/storage/v1/object/public/media/${name}`},
    async uploadAvatar(blob){if(!sess||!sess.user)throw new Error("Inicia sesión");const name=`${sess.user.id}/a-${Date.now()}.webp`;
      await req(`/storage/v1/object/avatars/${name}`,{method:"POST",body:blob,isFile:true,headers:{"Content-Type":blob.type||"image/webp","x-upsert":"true"}});
      return `${url}/storage/v1/object/public/avatars/${name}`},
    async updateMyProfile(o){await rpc("update_my_profile",{p_avatar:o.avatar_url||"",p_bio:o.bio||"",p_country:o.country||""});await this.loadProfile()},
    publicStats(){return rpc("public_stats")},
    publicReviews(){return rpc("public_reviews")},
    async myReview(){if(!sess||!sess.user)return null;const r=await sel("reviews",`&user_id=eq.${sess.user.id}`);return r&&r[0]||null},
    async saveReview(rating,body){const m=await this.myReview();if(m)return req(`/rest/v1/reviews?id=eq.${m.id}`,{method:"PATCH",body:{rating,body,approved:false,updated_at:now()},headers:{Prefer:"return=minimal"}});
      return req("/rest/v1/reviews",{method:"POST",body:{rating,body},headers:{Prefer:"return=minimal"}})},
    logView(sid,path){return raw("/rest/v1/page_views",{method:"POST",body:{sid,path},headers:{Prefer:"return=minimal"}}).catch(()=>{})},
    addWatch(lesson,secs){return rpc("add_watch",{lesson,secs}).catch(()=>{})},
    adminStats(){return rpc("admin_stats")},
    adminReviews(){return rpc("admin_reviews")},
    setReview(id,patch){return req(`/rest/v1/reviews?id=eq.${id}`,{method:"PATCH",body:patch,headers:{Prefer:"return=minimal"}})},
    delReview(id){return del("reviews",id)},
    // pagos (Binance, semiautomático)
    async payRequest(o){const r=await req("/rest/v1/payment_requests",{method:"POST",body:{method:"binance",plan:o.plan||"",days:o.days||30,amount:o.amount||"",order_id:o.order_id,note:o.note||""},headers:{Prefer:"return=representation"}});return r&&r[0]},
    myPayments(){if(!sess||!sess.user)return Promise.resolve([]);return sel("payment_requests",`&user_id=eq.${sess.user.id}&order=created_at.desc`)},
    adminPayments(){return rpc("admin_payments")},
    reviewPayment(id,approve,days,note){return rpc("review_payment",{pid:id,approve,p_days:days==null?null:days,p_note:note||""})},
    async files(){const r=await req("/storage/v1/object/list/media",{method:"POST",body:{prefix:"",limit:200,sortBy:{column:"created_at",order:"desc"}}});return(r||[]).map(f=>({name:f.name,url:`${url}/storage/v1/object/public/media/${f.name}`,size:f.metadata&&f.metadata.size}))},
  };
}

/* ===================== LOCAL (prueba sin servidor) ===================== */
function LocalAPI(){
  const KEY="ag_local_db_v1";let db;
  const load=()=>{try{db=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){db=null}
    if(!db){const s=JSON.parse(JSON.stringify(window.AG_SEED||{}));db=Object.assign({users:[],profiles:[],site:{},slides:[],modules:[],lessons:[],exercises:[],answers:[],progress:[],posts:[],comments:[],files:[],reviews:[],views:[],watch:[]},s);
      const aid=uuid();db.users.push({id:aid,email:"admin@elartegrafico.com",password:"admin1234"});db.profiles.push({id:aid,username:"elartegrafico",role:"admin",premium_until:null,demo_used:0,banned:false,created_at:now()});save()}};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}};
  load();
  let uid=null;try{uid=localStorage.getItem("ag_local_uid")}catch(e){}
  const me=()=>db.profiles.find(p=>p.id===uid)||null;
  const adm=()=>{const p=me();return!!p&&p.role==="admin"};
  const need=()=>{if(!adm())throw new Error("Solo el administrador")};
  const up=(arr,o)=>{if(!o.id)o.id=uuid();const i=arr.findIndex(x=>x.id===o.id);if(i>=0)arr[i]=Object.assign({},arr[i],o);else arr.push(Object.assign({created_at:now()},o));save();return Promise.resolve(arr.find(x=>x.id===o.id))};
  const rm=(k,id)=>{db[k]=db[k].filter(x=>x.id!==id);save();return Promise.resolve()};
  const by=k=>(a,b)=>(a[k]??0)-(b[k]??0);
  const lessonOk=l=>{const m=db.modules.find(x=>x.id===l.module_id);return adm()||(l.status==="publicado"&&m&&m.status==="publicado")};
  return{
    mode:"local",
    async init(){return{recovery:false}},
    user(){const u=db.users.find(x=>x.id===uid);return u?{id:u.id,email:u.email}:null},
    profile(){const p=me();if(p){const u=db.users.find(x=>x.id===uid);p.email=u&&u.email}return p},
    async loadProfile(){return this.profile()},
    isPremium(){return isPrem(me())},isAdmin(){return adm()},
    async usernameAvailable(u){return !db.profiles.some(p=>p.username.toLowerCase()===u.toLowerCase())},
    async signUp({username,email,password}){
      if(db.users.some(u=>u.email.toLowerCase()===email.toLowerCase()))throw new Error("Ese correo ya tiene una cuenta.");
      if(!(await this.usernameAvailable(username)))throw new Error("Ese nombre de usuario ya existe.");
      const id=uuid();db.users.push({id,email,password});db.profiles.push({id,username,role:"user",premium_until:null,demo_used:0,banned:false,created_at:now()});save();
      uid=id;try{localStorage.setItem("ag_local_uid",id)}catch(e){}return{confirm:false};
    },
    async signIn({email,password}){const q=email.toLowerCase();const pr=db.profiles.find(x=>(x.username||"").toLowerCase()===q);
      const u=db.users.find(x=>(x.email.toLowerCase()===q||(pr&&x.id===pr.id))&&x.password===password);if(!u)throw new Error("Usuario, correo o contraseña incorrectos.");
      const p=db.profiles.find(x=>x.id===u.id);if(p&&p.banned)throw new Error("Tu cuenta está suspendida. Contacta al equipo.");uid=u.id;try{localStorage.setItem("ag_local_uid",uid)}catch(e){}},
    async signOut(){uid=null;try{localStorage.removeItem("ag_local_uid")}catch(e){}},
    async recover(){},
    async updatePassword(pw){const u=db.users.find(x=>x.id===uid);if(u){u.password=pw;save()}},
    async site(){return db.site||{}},
    async slides(place){return db.slides.filter(s=>s.place===place&&(s.active||adm())).sort(by("sort"))},
    async modules(){return db.modules.filter(m=>m.status==="publicado"||adm()).sort(by("sort"))},
    async lessonIndex(){return db.lessons.filter(lessonOk).sort(by("sort")).map(l=>({id:l.id,module_id:l.module_id,title:l.title,sort:l.sort,has_video:!!l.video_url}))},
    async lesson(id){if(!this.isPremium())return null;const l=db.lessons.find(x=>x.id===id);return l&&lessonOk(l)?l:null},
    async lessons(){return this.isPremium()?db.lessons.filter(lessonOk).sort(by("sort")):[]},
    async exercises(f){const ok=e=>e.is_demo||this.isPremium();return db.exercises.filter(e=>ok(e)&&(f.demo?e.is_demo:f.practice?(!e.lesson_id&&!e.is_demo):e.lesson_id===f.lessonId)).sort(by("sort"))},
    async allExercises(){need();return db.exercises.slice().sort(by("sort"))},
    async grade(id){const p=me();if(!p)throw new Error("login");const e=db.exercises.find(x=>x.id===id);if(!e)throw new Error("no_existe");
      const prem=this.isPremium();if(!prem){if(!e.is_demo)throw new Error("premium");if(p.demo_used>=5)throw new Error("demo_agotado");p.demo_used++;save()}
      const a=db.answers.find(x=>x.exercise_id===id)||{};return{zone:a.zone??null,sl:a.sl??null,answer:a.answer||{},explain:a.explain||"",demo_left:prem?null:5-p.demo_used}},
    async progressGet(){return db.progress.find(x=>x.user_id===uid)||null},
    async progressSave(xp,data){const i=db.progress.findIndex(x=>x.user_id===uid);const o={user_id:uid,xp,data,updated_at:now()};if(i>=0)db.progress[i]=o;else db.progress.push(o);save()},
    async leaderboard(){return db.progress.map(g=>{const p=db.profiles.find(x=>x.id===g.user_id)||{};return{username:p.username||"alumno",avatar_url:p.avatar_url||null,country:p.country||"",xp:g.xp,lessons:Object.values((g.data||{}).done||{}).filter(d=>d.passed).length,is_me:g.user_id===uid}}).sort((a,b)=>b.xp-a.xp).slice(0,50)},
    async posts(){return db.posts.filter(p=>!p.premium_only||this.isPremium()).sort((a,b)=>(b.pinned-a.pinned)||String(b.created_at).localeCompare(a.created_at))},
    async post(id){return(await this.posts()).find(p=>p.id===id)||null},
    async comments(pid){if(!uid)return[];return db.comments.filter(c=>c.post_id===pid).sort((a,b)=>String(a.created_at).localeCompare(b.created_at)).map(c=>{const p=db.profiles.find(x=>x.id===c.user_id)||{};return{id:c.id,body:c.body,created_at:c.created_at,username:p.username||"alumno",avatar_url:p.avatar_url||null,mine:c.user_id===uid,is_admin:p.role==="admin"}})},
    async addComment(post_id,body){if(!this.isPremium())throw new Error("Solo los alumnos premium pueden comentar.");db.comments.push({id:uuid(),post_id,user_id:uid,body,created_at:now()});save()},
    async delComment(id){const c=db.comments.find(x=>x.id===id);if(c&&(c.user_id===uid||adm()))rm("comments",id)},
    async saveSite(data){need();db.site=data;save()},
    async allSlides(){need();return db.slides.slice().sort((a,b)=>a.place.localeCompare(b.place)||a.sort-b.sort)},
    saveSlide(s){need();return up(db.slides,s)},delSlide(id){need();return rm("slides",id)},
    saveModule(m){need();return up(db.modules,m)},async delModule(id){need();const ls=db.lessons.filter(l=>l.module_id===id).map(l=>l.id);db.exercises=db.exercises.filter(e=>!ls.includes(e.lesson_id));db.lessons=db.lessons.filter(l=>l.module_id!==id);return rm("modules",id)},
    saveLesson(l){need();return up(db.lessons,l)},async delLesson(id){need();db.exercises=db.exercises.filter(e=>e.lesson_id!==id);return rm("lessons",id)},
    async exerciseAnswer(id){need();return db.answers.find(x=>x.exercise_id===id)||null},
    async saveExercise(e,a){need();const x=await up(db.exercises,e);const i=db.answers.findIndex(y=>y.exercise_id===x.id);const o=Object.assign({exercise_id:x.id},a);if(i>=0)db.answers[i]=o;else db.answers.push(o);save();return x},
    async delExercise(id){need();db.answers=db.answers.filter(a=>a.exercise_id!==id);return rm("exercises",id)},
    savePost(p){need();return up(db.posts,p)},delPost(id){need();db.comments=db.comments.filter(c=>c.post_id!==id);return rm("posts",id)},
    async users(){need();return db.profiles.map(p=>{const u=db.users.find(x=>x.id===p.id)||{};const g=db.progress.find(x=>x.user_id===p.id);return Object.assign({},p,{email:u.email,xp:g?g.xp:0})})},
    async setUser(id,patch){need();const p=db.profiles.find(x=>x.id===id);Object.assign(p,patch);save()},
    async upload(file){need();if(file.size>3*1024*1024)throw new Error("En el modo de prueba solo se aceptan archivos de hasta 3 MB.");
      const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)});db.files.unshift({name:file.name,url,size:file.size});save();return url},
    async files(){return db.files},
    async uploadAvatar(blob){return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(blob)})},
    async updateMyProfile(o){const p=me();if(!p)throw new Error("Inicia sesión");p.avatar_url=o.avatar_url||null;p.bio=String(o.bio||"").slice(0,160);p.country=String(o.country||"").slice(0,40);save()},
    async publicStats(){const ap=db.reviews.filter(r=>r.approved);return{students:db.profiles.length,lessons:db.lessons.filter(l=>l.status==="publicado").length,exercises:db.exercises.length,rating:ap.length?Math.round(10*ap.reduce((s,r)=>s+r.rating,0)/ap.length)/10:null,reviews:ap.length}},
    async publicReviews(){return db.reviews.filter(r=>r.approved).map(r=>{const p=db.profiles.find(x=>x.id===r.user_id)||{};return{id:r.id,rating:r.rating,body:r.body,created_at:r.created_at,username:p.username||"alumno",avatar_url:p.avatar_url||null,premium:isPrem(p)}}).sort((a,b)=>String(b.created_at).localeCompare(a.created_at))},
    async myReview(){return db.reviews.find(r=>r.user_id===uid)||null},
    async saveReview(rating,body){if(!uid)throw new Error("Inicia sesión");const m=db.reviews.find(r=>r.user_id===uid);if(m)Object.assign(m,{rating,body,approved:false,updated_at:now()});else db.reviews.push({id:uuid(),user_id:uid,rating,body,approved:false,created_at:now()});save()},
    async logView(sid,path){db.views.push({sid,path,user_id:uid,created_at:now()});if(db.views.length>5000)db.views.splice(0,1000);save()},
    async addWatch(lesson,secs){if(!uid)return;const w=db.watch.find(x=>x.user_id===uid&&x.lesson_id===lesson);if(w)w.seconds+=secs;else db.watch.push({user_id:uid,lesson_id:lesson,seconds:secs});save()},
    async adminStats(){need();const d=n=>Date.now()-n*864e5;const after=(a,n)=>a.filter(x=>new Date(x.created_at).getTime()>d(n));
      const days=[];for(let i=29;i>=0;i--){const k=new Date(Date.now()-i*864e5).toISOString().slice(0,10);const vs=db.views.filter(v=>v.created_at.slice(0,10)===k);days.push({d:k,views:vs.length,visitors:new Set(vs.map(v=>v.sid)).size,signups:db.profiles.filter(p=>String(p.created_at).slice(0,10)===k).length})}
      const pages={};after(db.views,30).forEach(v=>{const k=v.path.split("-")[0];pages[k]=(pages[k]||0)+1});
      const tl={};db.watch.forEach(w=>{const l=db.lessons.find(x=>x.id===w.lesson_id);if(l)tl[l.title]=(tl[l.title]||0)+w.seconds});
      const ap=db.reviews.filter(r=>r.approved);
      return{users:db.profiles.length,premium:db.profiles.filter(p=>p.premium_until&&new Date(p.premium_until)>new Date()).length,new7:after(db.profiles,7).length,new30:after(db.profiles,30).length,
        views7:after(db.views,7).length,views30:after(db.views,30).length,visitors30:new Set(after(db.views,30).map(v=>v.sid)).size,
        watch_hours:Math.round(db.watch.reduce((s,w)=>s+w.seconds,0)/360)/10,exercises_done:db.progress.reduce((s,g)=>s+(((g.data||{}).practice||{}).n||0),0),demo_done:db.profiles.reduce((s,p)=>s+(p.demo_used||0),0),
        rating:ap.length?Math.round(100*ap.reduce((s,r)=>s+r.rating,0)/ap.length)/100:null,reviews:db.reviews.length,reviews_pending:db.reviews.filter(r=>!r.approved).length,comments:db.comments.length,
        daily:days,pages:Object.entries(pages).map(([path,n])=>({path,n})).sort((a,b)=>b.n-a.n).slice(0,12),top_lessons:Object.entries(tl).map(([title,s])=>({title,hours:Math.round(s/360)/10})).sort((a,b)=>b.hours-a.hours)}},
    async adminReviews(){need();return db.reviews.map(r=>{const p=db.profiles.find(x=>x.id===r.user_id)||{};return Object.assign({},r,{username:p.username})}).sort((a,b)=>(a.approved-b.approved)||String(b.created_at).localeCompare(a.created_at))},
    async setReview(id,patch){need();Object.assign(db.reviews.find(r=>r.id===id)||{},patch);save()},
    async delReview(id){const r=db.reviews.find(x=>x.id===id);if(r&&(r.user_id===uid||adm()))rm("reviews",id)},
    async payRequest(o){if(!uid)throw new Error("Inicia sesión");db.payments=db.payments||[];
      const oid=String(o.order_id||"").trim();if(oid.length<4)throw new Error("Escribe el ID de orden de Binance.");
      if(db.payments.some(x=>x.status!=="rechazado"&&x.order_id.toLowerCase()===oid.toLowerCase()))throw new Error("Ese ID de orden ya fue registrado.");
      if(db.payments.filter(x=>x.user_id===uid&&x.status==="pendiente").length>=3)throw new Error("Ya tienes 3 pagos por confirmar. Espera a que los revisemos.");
      const r={id:uuid(),user_id:uid,method:"binance",plan:o.plan||"",days:o.days||30,amount:o.amount||"",order_id:oid,note:o.note||"",status:"pendiente",admin_note:"",created_at:now(),reviewed_at:null};db.payments.push(r);save();return r},
    async myPayments(){return(db.payments||[]).filter(x=>x.user_id===uid).sort((a,b)=>String(b.created_at).localeCompare(a.created_at))},
    async adminPayments(){need();return(db.payments||[]).map(r=>{const p=db.profiles.find(x=>x.id===r.user_id)||{};const u=db.users.find(x=>x.id===r.user_id)||{};return Object.assign({},r,{username:p.username,email:u.email,premium_until:p.premium_until})}).sort((a,b)=>((b.status==="pendiente")-(a.status==="pendiente"))||String(b.created_at).localeCompare(a.created_at))},
    async reviewPayment(id,approve,days,note){need();const r=(db.payments||[]).find(x=>x.id===id);if(!r)throw new Error("El pago no existe");if(r.status!=="pendiente")throw new Error("Este pago ya fue revisado");
      let hasta=null;if(approve){const d=days||r.days;const p=db.profiles.find(x=>x.id===r.user_id);const base=Math.max(Date.now(),p.premium_until?new Date(p.premium_until).getTime():0);hasta=new Date(base+d*864e5).toISOString();p.premium_until=hasta;r.days=d}
      Object.assign(r,{status:approve?"aprobado":"rechazado",admin_note:note||"",reviewed_at:now()});save();return{status:r.status,premium_until:hasta}},
    resetLocal(){localStorage.removeItem(KEY);localStorage.removeItem("ag_local_uid");location.reload()},
  };
}

window.AGAPI=(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY)?SupabaseAPI(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):LocalAPI();
})();
