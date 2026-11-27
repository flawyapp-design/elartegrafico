/* © El Arte Gráfico. Todos los derechos reservados. Prohibida su copia o distribución sin autorización. */
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
  let oauthOk=false,oauthErr=null;
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
      /* vuelta desde Discord con error (#error=... o ?error=...) */
      {const q=new URLSearchParams(location.search),hp=new URLSearchParams(h.slice(1)),ed=hp.get("error_description")||q.get("error_description");
        if(ed||((hp.get("error")||q.get("error"))&&!q.get("state"))){oauthErr=/cancel|denied/i.test((hp.get("error")||q.get("error")||"")+ed)?"Cancelaste el ingreso con Discord.":"No se pudo ingresar con Discord: "+(ed||"inténtalo otra vez").replace(/\+/g," ");
          history.replaceState(null,"",location.pathname+"#entrar")}}
      if(h.includes("access_token=")){const p=new URLSearchParams(h.slice(1));const pt=p.get("provider_token");if(pt){oauthOk=true;this._dcTok=pt}
        saveSess({access_token:p.get("access_token"),refresh_token:p.get("refresh_token"),expires_at:Math.floor(Date.now()/1000)+(+p.get("expires_in")||3600),user:null});
        recovery=p.get("type")==="recovery";history.replaceState(null,"",location.pathname+(recovery?"#nueva-clave":"#inicio"))}
      if(SHARED){const rt=ckGet();
        if(!rt&&sess)saveSess(null);                       // cerró sesión en el otro sitio
        else if(rt&&(!sess||sess.refresh_token!==rt)){sess={refresh_token:rt};if(!(await refresh()))saveSess(null)}}
      if(sess){try{const u=await req("/auth/v1/user");sess.user=u;saveSess(sess);await this.loadProfile()}catch(e){saveSess(null)}}
      /* entró con Discord: conecta su Discord (rol de miembro y lo agrega al servidor) sin hacer nada más */
      if(this._dcTok&&sess&&sess.user){const t=this._dcTok;this._dcTok=null;this.discord("link-token",{token:t}).catch(()=>{})}
      return{recovery};
    },
    oauthDone(){return oauthOk},oauthError(){return oauthErr},
    async discordLogin(back){let on=true;try{const r=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key}});if(r.ok){const j=await r.json();on=!!(j.external&&j.external.discord)}}catch(e){}
      if(!on){window.AGTOAST&&window.AGTOAST("El ingreso con Discord se activará muy pronto. Por ahora usa tu correo.");return false}
      location.href=`${url}/auth/v1/authorize?`+new URLSearchParams({provider:"discord",redirect_to:back||location.origin+"/",scopes:"identify email guilds.join"});return true},
    shareSession(){if(sess&&sess.refresh_token)ckSet(sess.refresh_token);return SHARED?!!ckGet():true},
    user(){return sess&&sess.user?{id:sess.user.id,email:sess.user.email}:null},
    profile(){return prof},
    async loadProfile(){if(!sess||!sess.user){prof=null;return null}const r=await sel("profiles",`&id=eq.${sess.user.id}`);prof=r&&r[0]||null;if(prof)prof.email=sess.user.email;return prof},
    isPremium(){return isPrem(prof)},isAdmin(){return !!prof&&prof.role==="admin"&&!prof.banned},
    /* token de la sesión (para que el servidor confirme que eres admin, p. ej. al conectar cTrader) */
    async accessToken(){if(sess&&sess.expires_at&&sess.expires_at*1000<Date.now()+60000)await refresh();return sess&&sess.access_token||null},
    /* EAG Charts: dibujos y diseño guardados en la cuenta */
    async chartState(){if(!sess||!sess.user)return null;const r=await sel("chart_state",`&user_id=eq.${sess.user.id}`);return r&&r[0]||null},
    async saveChartState(data){if(!sess||!sess.user)return null;return ups("chart_state",{user_id:sess.user.id,data,updated_at:new Date().toISOString()})},
    async chartAlerts(){if(!sess||!sess.user)return[];return sel("chart_alerts",`&user_id=eq.${sess.user.id}&order=created_at.desc`)},
    async saveChartAlert(a){if(!sess||!sess.user)throw new Error("Inicia sesión");return ups("chart_alerts",Object.assign({},a,{user_id:sess.user.id}))},
    async deleteChartAlert(id){return del("chart_alerts",id)},
    async chartTrial(){const r=await rpc("chart_trial");return Array.isArray(r)?r[0]:r},
    async chartFeedback(rating,text){return rpc("chart_feedback",{p_rating:rating,p_text:text})},
    async adminChartFeedback(){return rpc("admin_chart_feedback")},
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
    /* EAG Charts · Modo Clase y Zonas del profe */
    rt:{url:url.replace(/^http/,"ws")+"/realtime/v1/websocket?apikey="+encodeURIComponent(key)+"&vsn=1.0.0"},
    async liveGet(){const r=await sel("live_class","&id=eq.1");return(r&&r[0])||null},
    liveSet(o){return req("/rest/v1/live_class?id=eq.1",{method:"PATCH",body:Object.assign({},o,{updated_at:new Date().toISOString()}),headers:{Prefer:"return=minimal"}})},
    zonesList(){return sel("teacher_zones","&order=updated_at.desc")},
    zoneSet(o){return ups("teacher_zones",Object.assign({},o,{updated_at:new Date().toISOString()}))},
    zoneDel(sym){return del("teacher_zones",sym,"sym")},
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
    adminReset(user,what,fb,demo){return rpc("admin_reset_progress",{p_user:user||null,p_what:what,p_feedback:!!fb,p_demo:!!demo})},
    setUser(id,patch){return req(`/rest/v1/profiles?id=eq.${id}`,{method:"PATCH",body:patch,headers:{Prefer:"return=minimal"}})},
    /* funciones sueltas con vencimiento (supabase/funciones_usuario.sql) */
    async myFeatures(){if(!sess||!sess.user)return[];try{return await req(`/rest/v1/user_features?select=feature,until&user_id=eq.${sess.user.id}&until=gt.${encodeURIComponent(new Date().toISOString())}`)}catch(e){return[]}},
    adminFeatures(uid){return req(`/rest/v1/user_features?select=feature,until&user_id=eq.${uid}`)},
    /* todas las pruebas dadas, con el nombre del alumno y de quién la dio */
    async adminAllFeatures(onlyActive){const q=onlyActive?`&until=gt.${encodeURIComponent(new Date().toISOString())}`:"";const L=await req(`/rest/v1/user_features?select=user_id,feature,until,granted_by,updated_at${q}&order=until.desc&limit=2000`)||[];
      const ids=[...new Set(L.flatMap(x=>[x.user_id,x.granted_by]).filter(Boolean))];let P=[];if(ids.length)P=await req(`/rest/v1/profiles?select=id,username,avatar_url,plan,premium_until&id=in.(${ids.join(",")})`)||[];
      const m={};P.forEach(p=>m[p.id]=p);return L.map(x=>Object.assign({},x,{username:(m[x.user_id]||{}).username||"",avatar_url:(m[x.user_id]||{}).avatar_url||null,plan:(m[x.user_id]||{}).plan||"",premium_until:(m[x.user_id]||{}).premium_until||null,by:(m[x.granted_by]||{}).username||""}))},
    adminSetFeature(uid,feature,until){if(!until)return req(`/rest/v1/user_features?user_id=eq.${uid}&feature=eq.${feature}`,{method:"DELETE",headers:{Prefer:"return=minimal"}});
      return req("/rest/v1/user_features?on_conflict=user_id,feature",{method:"POST",body:{user_id:uid,feature,until,updated_at:new Date().toISOString()},headers:{Prefer:"resolution=merge-duplicates,return=minimal"}})},
    async adminUserBrief(id){const r=await sel("profiles",`&id=eq.${id}`);const p=r&&r[0];return p?{id:p.id,username:p.username,plan:p.plan||"",premium_until:p.premium_until,role:p.role,banned:p.banned}:null},
    async upload(file){const name=Date.now()+"-"+file.name.toLowerCase().replace(/[^a-z0-9.]+/g,"-");
      await req(`/storage/v1/object/media/${name}`,{method:"POST",body:file,isFile:true,headers:{"Content-Type":file.type||"application/octet-stream","x-upsert":"true"}});
      return `${url}/storage/v1/object/public/media/${name}`},
    async uploadAvatar(blob){if(!sess||!sess.user)throw new Error("Inicia sesión");const name=`${sess.user.id}/a-${Date.now()}.webp`;
      await req(`/storage/v1/object/avatars/${name}`,{method:"POST",body:blob,isFile:true,headers:{"Content-Type":blob.type||"image/webp","x-upsert":"true"}});
      return `${url}/storage/v1/object/public/avatars/${name}`},
    async pushKey(){let k=null;try{k=await rpc("push_public_key")}catch(e){}if(k)return k;
      const r=await raw("/functions/v1/send-push",{method:"POST",body:{action:"setup"}});if(r.ok&&r.j&&r.j.publicKey)return r.j.publicKey;
      throw new Error("Las notificaciones aún no están activadas en el servidor.")},
    savePushSub(sub,ua){const j=sub.toJSON();return rpc("save_push_sub",{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_ua:ua||""})},
    async delPushSub(endpoint){if(!sess||!sess.user)return;try{await req(`/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`,{method:"DELETE"})}catch(e){}},
    adminPushStats(){return rpc("admin_push_stats").then(r=>r&&r[0]||{total:0,premium:0,gratis:0})},
    myNotifs(){return rpc("my_notifs",{p_limit:40})},
    async sendPush(o){const r=await raw("/functions/v1/send-push",{method:"POST",body:o});
      if(!r.ok)throw new Error((r.j&&(r.j.error||r.j.message))||(r.status===404?"Falta publicar la función send-push en Supabase.":"No se pudo enviar ("+r.status+")"));return r.j},
    async discord(action,o){const r=await raw("/functions/v1/discord",{method:"POST",body:Object.assign({action},o||{})});
      if(!r.ok)throw new Error((r.j&&(r.j.error||r.j.message))||(r.status===404?"Falta publicar la función discord en Supabase.":"No se pudo conectar con Discord ("+r.status+")"));
      if(action!=="config")await this.loadProfile().catch(()=>{});return r.j},
    dmMemberStart(){return rpc("dm_member_start")},
    adminDiscordHooks(){return rpc("admin_discord_hooks").then(r=>Array.isArray(r)?r[0]||{}:r||{})},
    adminSetDiscordHooks(g,m,p){return rpc("admin_set_discord_hooks",{p_general:g,p_miembros:m,p_premium:p})},
    async discordTest(){const r=await raw("/functions/v1/send-push",{method:"POST",body:{action:"discord-test"}});if(!r.ok)throw new Error((r.j&&r.j.error)||"No se pudo probar ("+r.status+")");return r.j},
    adminDiscordStats(){return rpc("admin_discord_stats").then(r=>Array.isArray(r)?r[0]:r)},
    /* EAG Charts en vivo: quién los está usando ahora */
    chartPing(o){if(!sess||!sess.user)return Promise.resolve(null);return rpc("chart_ping",{p_symbol:o.symbol||null,p_name:o.name||null,p_tf:o.tf||null,p_layout:o.layout||null,p_device:o.device||null,p_profile:o.profile||null,p_panes:o.panes||null})},
    chartBye(){if(!sess||!sess.user||!sess.access_token)return;try{fetch(url+"/rest/v1/rpc/chart_bye",{method:"POST",keepalive:true,headers:{apikey:key,Authorization:"Bearer "+sess.access_token,"Content-Type":"application/json"},body:"{}"})}catch(e){}},
    adminChartOnline(){return rpc("admin_chart_online")},
    sitePing(place,device){if(!sess||!sess.user)return Promise.resolve(null);return rpc("site_ping",{p_place:place||null,p_device:device||null})},
    adminOnline(){return rpc("admin_online_users")},
    /* EAG Charts · chat interno (privado y grupo), conectados */
    chatSend(room,body,kind,payload){return rpc("chat_send",{p_room:room,p_body:body||"",p_kind:kind||"text",p_payload:payload||null})},
    chatHistory(room,before){return rpc("chat_history",{p_room:room,p_before:before||null,p_limit:50})},
    chatThreads(){return rpc("chat_threads")},
    chatPeople(){return rpc("chat_people")},
    chatFind(q){return rpc("chat_find",{p_q:q})},
    chatRead(room,last){return rpc("chat_read",{p_room:room,p_last:last||0})},
    chatGroupReads(min,room){return room&&room!=="g:general"?rpc("chat_group_reads",{p_min:min||0,p_room:room}):rpc("chat_group_reads",{p_min:min||0})},
    chatGroups(){return rpc("chat_groups")},chatGroupSave(g){return rpc("chat_group_save",{p:g})},chatGroupDelete(id){return rpc("chat_group_delete",{p_id:id})},chatGroupPeople(id){return rpc("chat_group_people",{p_id:id})},
    chatMyMentions(){return rpc("chat_my_mentions")},chatMentionsSeen(){return rpc("chat_mentions_seen")},
    chatDelete(id){return rpc("chat_delete",{p_id:id})},
    chatReact(id,emoji){return rpc("chat_react",{p_id:id,p_emoji:emoji})},
    chatHide(room){return rpc("chat_hide",{p_room:room})},
    chatCleanup(){return rpc("chat_cleanup")},
    async chartChatUpload(blob){if(!sess||!sess.user)throw new Error("Inicia sesión");const ty=String(blob.type||"").split(";")[0],ext=/audio\/(mp4|aac|x-m4a)/.test(ty)?"m4a":ty==="audio/mpeg"?"mp3":ty==="audio/ogg"?"ogg":/^audio\/webm/.test(ty)?"webm":"webp";const name=`${sess.user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}.${ext}`;
      await req(`/storage/v1/object/chartchat/${name}`,{method:"POST",body:blob,isFile:true,headers:{"Content-Type":ty||"image/webp"}});return `${url}/storage/v1/object/public/chartchat/${name}`},
    async chartChatImgDel(u){const m=String(u||"").match(/\/storage\/v1\/object\/public\/chartchat\/(.+)$/);if(!m)return;try{await req("/storage/v1/object/chartchat",{method:"DELETE",body:{prefixes:[decodeURIComponent(m[1])]}})}catch(e){}},
    async chartChatImgClean(days){let L=[];try{L=await rpc("chartchat_img_old",{p_days:days||60})||[]}catch(e){return 0}L=L.map(x=>typeof x==="string"?x:(x&&x.chartchat_img_old)||"").filter(Boolean);
      for(let i=0;i<L.length;i+=100){try{await req("/storage/v1/object/chartchat",{method:"DELETE",body:{prefixes:L.slice(i,i+100)}})}catch(e){}}return L.length},
    chatHidden(on){return rpc("chat_set_hidden",{p_on:!!on})},
    chatBlock(user,on){return rpc("chat_block",{p_user:user,p_on:!!on})},
    adminFunnel(days){return rpc("admin_funnel",{p_days:days||0})},
    adminReminderCfg(o){o=o||{};return rpc("admin_reminder_cfg",{p_enabled:o.enabled==null?null:!!o.enabled,p_day1:o.day1||null,p_day2:o.day2==null?null:o.day2})},
    adminReminderSend(ids){return rpc("admin_reminder_send",{p_users:ids})},
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
    async payRequest(o){const body={method:["breb","airtm"].includes(o.method)?o.method:"binance",plan:o.plan||"",days:o.days||30,amount:o.amount||"",order_id:o.order_id,note:o.note||""};if(o.course_id)body.course_id=o.course_id;const r=await req("/rest/v1/payment_requests",{method:"POST",body,headers:{Prefer:"return=representation"}});return r&&r[0]},
    // cursos, planes y Sala Oro
    courses(){return sel("courses","&order=sort.asc,created_at.asc")},
    myCourses(){if(!sess||!sess.user)return Promise.resolve([]);return req(`/rest/v1/user_courses?select=course_id,created_at&user_id=eq.${sess.user.id}`)},
    async giiCupo(){try{const r=await rpc("gii_cupo");return +r||0}catch(e){return null}},
    spinRoulette(){return rpc("spin_roulette")},
    mySpins(){if(!sess||!sess.user)return Promise.resolve([]);return sel("roulette_spins",`&user_id=eq.${sess.user.id}&order=created_at.desc&limit=60`)},
    saveCourse(c){return ups("courses",c)},delCourse(id){return del("courses",id)},
    /* MT5 (EA EAG Bridge) — solo admin */
    mt5Poll(acc){return rpc("mt5_panel_poll",{p_account:acc||null})},mt5Cmd(p){return rpc("mt5_panel_command",{p})},mt5NewToken(){return rpc("mt5_new_token",{})},
    /* Biblioteca de clases */
    libSections(){return req("/rest/v1/lib_sections?select=*&order=sort.asc,created_at.asc").catch(()=>[])},
    libSecSave(o){return rpc("lib_sec_save",{p:o})},libSecDelete(id){return rpc("lib_sec_delete",{p_id:id})},
    libItems(){return req("/rest/v1/lib_items?select=id,title,descr,section,section_id,minutes,sort,status,free_preview,created_at&status=eq.publicado&order=sort.asc,created_at.asc")},
    async libItem(id){const r=await rpc("lib_item",{p_id:id});return r&&r[0]||null},
    libOverview(){return rpc("lib_overview")},
    libWatch(item,secs,pos,dur){return rpc("lib_add_watch",{p_item:item,p_secs:Math.round(secs||0),p_pos:Math.round(pos||0),p_dur:Math.round(dur||0)}).catch(()=>{})},
    libMark(item,done){return rpc("lib_mark",{p_item:item,p_done:done!==false})},
    libRate(item,stars,note){return rpc("lib_rate",{p_item:item,p_stars:stars,p_note:note||""})},
    libQs(item){return rpc("lib_qs",{p_item:item})},
    libAsk(item,body,minute){return rpc("lib_ask",{p_item:item,p_body:body,p_minute:minute==null?null:minute})},
    libQDel(id){return rpc("lib_q_delete",{p_id:id})},
    libPct(){return rpc("lib_pct",{})},
    async libMyClass(){if(!sess||!sess.user)return null;const r=await req(`/rest/v1/lib_class_req?select=*&user_id=eq.${sess.user.id}`);return r&&r[0]||null},
    libRequestClass(av,topics,contact){return rpc("lib_request_class",{p_availability:av||"",p_topics:topics||"",p_contact:contact||""})},
    libAdminList(){return rpc("lib_admin_list")},libSave(o){return rpc("lib_save",{p:o})},libDelete(id){return rpc("lib_delete",{p_id:id})},
    libAdminItems(){return rpc("lib_admin_items")},libAdminUsers(){return rpc("lib_admin_users")},libAdminQuestions(open){return rpc("lib_admin_questions",{p_open:open!==false})},
    libAnswer(id,a){return rpc("lib_answer",{p_id:id,p_answer:a||""})},libAdminClasses(){return rpc("lib_admin_classes")},libClassSet(id,st,at,note){return rpc("lib_class_set",{p_id:id,p_status:st,p_at:at||null,p_note:note||""})},
    async adminGrantCourse(uid,cid,on){if(on)await req("/rest/v1/user_courses",{method:"POST",body:{user_id:uid,course_id:cid,source:"admin"},headers:{Prefer:"resolution=ignore-duplicates,return=minimal"}});else await req(`/rest/v1/user_courses?user_id=eq.${uid}&course_id=eq.${cid}`,{method:"DELETE"})},
    myPayments(){if(!sess||!sess.user)return Promise.resolve([]);return sel("payment_requests",`&user_id=eq.${sess.user.id}&order=created_at.desc`)},
    adminPayments(){return rpc("admin_payments")},
    myFeedback(){if(!sess||!sess.user)return Promise.resolve([]);return req(`/rest/v1/module_feedback?select=module_id&user_id=eq.${sess.user.id}`)},
    async sendFeedback(o){await req("/rest/v1/module_feedback",{method:"POST",body:{module_id:o.module_id,rating:o.rating,liked:o.liked,improve:o.improve}})},
    adminFeedback(){return rpc("admin_module_feedback")},
    /* retos, puntos, afiliados y canjes */
    challengesFeed(){return rpc("challenges_feed")},
    submitChallenge(id,answer){return rpc("submit_challenge",{p_id:id,p_answer:answer})},
    challengeWinners(id){return rpc("challenge_winners",{p_id:id})},
    rewardsBoard(period){return rpc("rewards_board",{p_period:period||"mes"})},
    progressBoard(){return rpc("progress_board")},
    myRewards(){if(!sess||!sess.user)return Promise.resolve(null);return rpc("my_rewards")},
    requestRedemption(points,method,account){return rpc("request_redemption",{p_points:points,p_method:method,p_account:account})},
    requestAffiliate(deriv){return rpc("request_affiliate",{p_deriv:deriv})},
    adminChallenges(){return sel("challenges","&order=starts_at.desc&limit=200")},
    async challengeKey(id){const r=await sel("challenge_keys",`&challenge_id=eq.${id}`);return r&&r[0]||null},
    async saveChallenge(c,key){const r=await ups("challenges",c);await ups("challenge_keys",Object.assign({challenge_id:r.id},key));return r},
    delChallenge(id){return del("challenges",id)},
    adminChallengeEntries(id){return rpc("admin_challenge_entries",{p_id:id})},
    adminAffiliates(){return rpc("admin_affiliates")},
    reviewAffiliate(uid,ok,note){return rpc("review_affiliate",{p_user:uid,p_ok:!!ok,p_note:note||""})},
    adminMemberGet(u){return rpc("admin_member_get",{p_user:u})},adminMemberSet(u,on,deriv,note){return rpc("admin_member_set",{p_user:u,p_on:!!on,p_deriv:deriv||null,p_note:note||""})},
    publicProfile(u){return rpc("public_profile",{p_username:u})},
    adminAttention(){return rpc("admin_attention")},claimCertificate(c){return rpc("claim_certificate",{p_course:c})},myCertificates(){return rpc("my_certificates")},verifyCertificate(code){return rpc("verify_certificate",{p_code:code})},
    tryExercise(){return rpc("try_exercise")},async tryGrade(id){const r=await rpc("try_grade",{ex:id});if(r&&r.error)throw new Error(r.error);return r},
    roomFeed(since){return rpc("room_feed",{p_since:since||null})},roomSend(b,img){return rpc("room_send",{p_body:b||"",p_image:img||null})},roomAlive(ids){return rpc("room_alive",{p_ids:ids})},
    async roomDelete(id){const img=await rpc("room_delete",{p_id:id});const k=typeof img==="string"&&img.split("/storage/v1/object/public/sala/")[1];if(k)try{await req(`/storage/v1/object/sala/${k}`,{method:"DELETE"})}catch(e){}},
    roomReport(id){return rpc("room_report",{p_id:id})},roomMute(id,h){return rpc("room_mute",{p_message:id,p_hours:h})},
    /* fotos del chat de soporte: van al almacenamiento de archivos (carpeta "chat"), no a la base de datos */
    async uploadChat(blob){if(!sess||!sess.user)throw new Error("Inicia sesión");const name=`${sess.user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}.webp`;
      await req(`/storage/v1/object/chat/${name}`,{method:"POST",body:blob,isFile:true,headers:{"Content-Type":blob.type||"image/webp"}});return `${url}/storage/v1/object/public/chat/${name}`},
    async chatImgClean(user){let L=[];try{L=await rpc("chat_img_old",{p_user:user||null})||[]}catch(e){return 0}L=L.map(x=>typeof x==="string"?x:(x&&x.chat_img_old)||"").filter(Boolean);
      for(let i=0;i<L.length;i+=100){try{await req("/storage/v1/object/chat",{method:"DELETE",body:{prefixes:L.slice(i,i+100)}})}catch(e){}}return L.length},
    async uploadRoom(blob){if(!sess||!sess.user)throw new Error("Inicia sesión");const name=`${sess.user.id}/s-${Date.now()}.webp`;
      await req(`/storage/v1/object/sala/${name}`,{method:"POST",body:blob,isFile:true,headers:{"Content-Type":blob.type||"image/webp"}});return `${url}/storage/v1/object/public/sala/${name}`},
    dmSend(body,user,topic){return rpc("dm_send",{p_body:body,p_user:user||null,p_topic:topic||null})},dmMine(){return rpc("dm_mine")},dmBadge(){return rpc("dm_badge")},
    adminDmThreads(){return rpc("admin_dm_threads")},adminDmThread(u){return rpc("admin_dm_thread",{p_user:u})},adminDmClose(u){return rpc("admin_dm_close",{p_user:u})},
    adminPartnerImport(ids,monthly,tier){return rpc("admin_partner_import",{p_ids:ids,p_monthly:!!monthly,p_tier:tier==="antiguo"?"antiguo":"activo"})},adminPartnerApproveOld(){return rpc("admin_partner_approve_old")},adminPartnerInfo(){return rpc("admin_partner_info")},
    adminRedemptions(){return rpc("admin_redemptions")},
    myWallet(){return rpc("my_wallet")},
    requestUsdWithdrawal(usd,account,method){return rpc("request_usd_withdrawal",{p_usd:usd,p_account:account,p_method:method||"binance"})},
    adminUsdWithdrawals(){return rpc("admin_usd_withdrawals")},
    adminReviewUsd(id,status,note){return rpc("admin_review_usd_withdrawal",{p_id:id,p_status:status,p_note:note||""})},
    adminAdjustUsd(u,v,r){return rpc("admin_adjust_usd",{p_username:u,p_usd:v,p_reason:r||""})},
    adminUsdLog(){return rpc("admin_usd_log")},
    adminPointsTop(per,n){return rpc("admin_points_top",{p_period:per||"mes",p_limit:n||10})},
    adminAdjustPoints(u,p,r){return rpc("admin_adjust_points",{p_username:u,p_points:p,p_reason:r||""})},
    adminPointsLog(){return rpc("admin_points_log")},
    reviewRedemption(id,paid,note){return rpc("review_redemption",{p_id:id,p_paid:!!paid,p_note:note||""})},
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
  const reload=()=>{try{const d=JSON.parse(localStorage.getItem(KEY));if(d)db=d}catch(e){}};
  /* MT5 (modo local): un MT5 simulado que ejecuta al instante, para probar el panel */
  const _mt5Local=()=>{const M={tok:null,pos:[],ord:[],cmds:[],n:1000,syms:{},hist:[]};const toH=(x,v)=>M.hist.push({deal:++M.n,position:x.ticket,symbol:x.symbol,type:x.type,volume:v,price:x.current_price,profit:x.profit,time:Math.floor(Date.now()/1000),open_price:x.open_price,open_time:x.time,commission:0,swap:0});let px={};
    const sym=s=>{if(!M.syms[s]){const b=/boom|crash/i.test(s)?9150:/volatility/i.test(s)?1200:100;px[s]=b;M.syms[s]={symbol:s,bid:b,ask:b+0.5,digits:4,point:0.0001,tick_size:0.0001,tick_value:0.0001,vol_min:0.2,vol_max:50,vol_step:0.01}}return M.syms[s]};
    const fin=(c,ok,msg,extra)=>{c.status=ok?"done":"error";c.result=Object.assign({id:c.id,ok,msg},extra||{});c.finishedAt=Date.now()};
    const exec=c=>{const p=c.params;if(c.action==="watch"){if(/^x/i.test(p.symbol))return fin(c,false,"Símbolo no encontrado en MT5: "+p.symbol);sym(p.symbol);return fin(c,true,"Símbolo activo")}
      if(c.action==="open_market"){const i=sym(p.symbol),t=++M.n;M.pos.push({ticket:t,symbol:p.symbol,type:p.otype,volume:+p.volume,open_price:p.otype==="buy"?i.ask:i.bid,current_price:i.bid,sl:+p.sl||0,tp:+p.tp||0,profit:0,swap:0,time:Math.floor(Date.now()/1000),digits:4});return fin(c,true,"Abierta #"+t,{ticket:t})}
      if(c.action==="open_pending"){const t=++M.n;M.ord.push({ticket:t,symbol:p.symbol,type:p.otype,volume:+p.volume,price:+p.price,sl:+p.sl||0,tp:+p.tp||0,time:Math.floor(Date.now()/1000),digits:4});return fin(c,true,"Orden #"+t,{ticket:t})}
      if(c.action==="modify_position"){const x=M.pos.find(y=>String(y.ticket)===p.ticket);if(!x)return fin(c,false,"No existe");if(p.sl!=null)x.sl=+p.sl;if(p.tp!=null)x.tp=+p.tp;return fin(c,true,"Modificada")}
      if(c.action==="modify_order"){const x=M.ord.find(y=>String(y.ticket)===p.ticket);if(!x)return fin(c,false,"No existe");["sl","tp","price"].forEach(k=>{if(p[k]!=null)x[k]=+p[k]});return fin(c,true,"Modificada")}
      if(c.action==="close_position"){const x=M.pos.find(y=>String(y.ticket)===p.ticket);if(!x)return fin(c,false,"No existe");if(p.volume&&+p.volume<x.volume){toH(x,+p.volume);x.volume=+(x.volume-p.volume).toFixed(2);return fin(c,true,"Cierre parcial")}toH(x,x.volume);M.pos=M.pos.filter(y=>y!==x);return fin(c,true,"Cerrada")}
      if(c.action==="cancel_order"){M.ord=M.ord.filter(y=>String(y.ticket)!==p.ticket);return fin(c,true,"Cancelada")}
      if(c.action==="close_all"){M.pos=M.pos.filter(y=>p.otype==="profit"?y.profit<0:p.otype==="loss"?y.profit>=0:false);return fin(c,true,"Cerradas")}
      if(c.action==="cancel_all"){M.ord=[];return fin(c,true,"Canceladas")}fin(c,false,"Acción desconocida")};
    const tick=()=>{Object.values(M.syms).forEach(i=>{const d=(Math.random()-.5)*2;i.bid=+(i.bid+d).toFixed(4);i.ask=+(i.bid+0.5).toFixed(4)});
      M.pos.forEach(x=>{const i=M.syms[x.symbol];if(!i)return;x.current_price=i.bid;x.profit=+(((x.type==="buy"?i.bid-x.open_price:x.open_price-i.ask))*x.volume).toFixed(2)})};
    return{
    async mt5Poll(){need();tick();M.cmds.filter(c=>c.status==="queued").forEach(c=>{c.status="sent";exec(c)});const fl=M.pos.reduce((a,x)=>a+x.profit,0);
      return{accounts:M.tok?[{login:"5551234",name:"Demo",server:"Deriv-Demo",trade_mode:"demo",online:true}]:[],token:{has:!!M.tok,at:M.tok?new Date().toISOString():null},
        state:M.tok?{login:"5551234",online:true,account:{login:5551234,name:"Demo",server:"Deriv-Demo",currency:"USD",balance:10000,equity:10000+fl,profit:+fl.toFixed(2),margin:M.pos.length?50:0,free_margin:9950,margin_level:M.pos.length?20000:0,trade_mode:"demo",algo_trading:true},
          positions:JSON.parse(JSON.stringify(M.pos)),orders:JSON.parse(JSON.stringify(M.ord)),symbols:Object.values(M.syms),today:{pnl:12.5,trades:3},history:M.hist.slice()}:null,commands:M.cmds.slice(-60)}},
    async mt5Cmd(p){need();if(!M.tok)return{ok:false,error:"MT5 no está conectado"};const c={id:"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),account:"5551234",action:p.action,
        params:{symbol:p.symbol,otype:p.side||p.order_type||p.filter,volume:p.volume,price:p.price,sl:p.sl,tp:p.tp,ticket:p.ticket},status:"queued",createdAt:Date.now()};M.cmds.push(c);return{ok:true,command:c}},
    async mt5NewToken(){need();M.tok="eag_"+Math.random().toString(36).slice(2);return M.tok}}};
  /* biblioteca de clases (modo local, para probar) */
  const _libLocal=()=>{const LC=()=>{db.courses=db.courses||[];let c=db.courses.find(x=>x.kind==="biblioteca");if(!c){c={id:"crs-lib",title:"Biblioteca de clases",descr:"Clases grabadas, grupales y personalizadas, donde explico cómo opero.",color:"#1f4fd6",icon:"📚",price:"50 USD",status:"publicado",sort:90,kind:"biblioteca"};db.courses.push(c);save()}return c};
    const ok=()=>adm()||(db.ucourses||[]).some(x=>x.user_id===uid&&x.course_id===LC().id);const it=()=>(db.libItems=db.libItems||[]);const W=()=>(db.libW=db.libW||[]),R=()=>(db.libR=db.libR||[]),Q=()=>(db.libQ=db.libQ||[]),C=()=>(db.libC=db.libC||[]);
    const pub=()=>it().filter(i=>i.status==="publicado").sort(by("sort"));const pct=u=>{const P=pub();if(!P.length)return 0;return Math.round(100*P.filter(i=>W().some(w=>w.user_id===u&&w.item_id===i.id&&w.done)).length/P.length)};
    const strip=i=>{const o=Object.assign({},i);delete o.video_url;return o};
    return{
    async libItems(){reload();LC();return pub().map(strip)},
    async libSections(){reload();return(db.libS=db.libS||[]).slice().sort(by("sort"))},
    async libSecSave(o){need();reload();const L=(db.libS=db.libS||[]);if(o.id){const x=L.find(y=>y.id===o.id);Object.assign(x,{title:o.title,descr:o.descr||"",sort:o.sort!=null&&o.sort!==""?+o.sort:x.sort});it().forEach(i=>{if(i.section_id===o.id)i.section=o.title});save();return o.id}
      const id="ls-"+Math.random().toString(36).slice(2,9);L.push({id,title:o.title,descr:o.descr||"",sort:o.sort!=null&&o.sort!==""?+o.sort:L.reduce((a,x)=>Math.max(a,x.sort||0),0)+1});save();return id},
    async libSecDelete(id){need();reload();if(it().some(i=>i.section_id===id))throw new Error("La sección tiene videos. Muévelos o bórralos primero.");db.libS=(db.libS||[]).filter(x=>x.id!==id);save()},
    async libItem(id){reload();const i=it().find(x=>x.id===id);if(!i||(i.status!=="publicado"&&!adm()))return null;return ok()||(i.free_preview&&uid)?i:null},
    async libOverview(){reload();return pub().map(i=>{const w=W().find(x=>x.user_id===uid&&x.item_id===i.id)||{},rs=R().filter(r=>r.item_id===i.id),r=rs.find(x=>x.user_id===uid);
      return{item_id:i.id,my_seconds:w.seconds||0,my_done:!!w.done,my_pos:w.last_pos||0,my_stars:r?r.stars:null,avg_stars:rs.length?Math.round(10*rs.reduce((a,x)=>a+x.stars,0)/rs.length)/10:null,n_ratings:rs.length,n_questions:Q().filter(q=>q.item_id===i.id).length}})},
    async libWatch(item,secs,pos,dur){reload();if(!uid)return;let w=W().find(x=>x.user_id===uid&&x.item_id===item);if(!w){w={user_id:uid,item_id:item,seconds:0,last_pos:0,done:false};W().push(w)}const i=it().find(x=>x.id===item)||{};if(!i.minutes&&dur>30)i.minutes=Math.max(1,Math.round(dur/60));
      w.seconds+=Math.min(180,Math.round(secs||0));if(pos>0)w.last_pos=Math.round(pos);w.updated_at=now();if(i.minutes&&w.seconds>=i.minutes*60*.8)w.done=true;save()},
    async libMark(item,done){reload();if(!ok())return;const i=it().find(x=>x.id===item)||{};let w=W().find(x=>x.user_id===uid&&x.item_id===item);if(done!==false&&!adm()&&i.minutes&&((w&&w.seconds)||0)<i.minutes*30)throw new Error("Mira al menos la mitad del video para marcarlo como visto.");
      if(!w){w={user_id:uid,item_id:item,seconds:0,last_pos:0};W().push(w)}w.done=done!==false;w.updated_at=now();save()},
    async libRate(item,stars,note){reload();if(!ok())throw new Error("Necesitas la biblioteca para calificar.");const r=R().find(x=>x.user_id===uid&&x.item_id===item);if(r){r.stars=stars;r.note=note||""}else R().push({user_id:uid,item_id:item,stars,note:note||""});save()},
    async libQs(item){reload();if(!ok())return[];return Q().filter(q=>q.item_id===item).slice().reverse().map(q=>{const p=db.profiles.find(x=>x.id===q.user_id)||{};return Object.assign({},q,{username:p.username,avatar_url:p.avatar_url||null})})},
    async libAsk(item,body,minute){reload();if(!ok())throw new Error("Necesitas la biblioteca para preguntar.");db.libQs=(db.libQs||0)+1;const q={id:db.libQs,item_id:item,user_id:uid,body:String(body).trim(),minute:minute==null?null:minute,answer:null,answered_at:null,created_at:now()};Q().push(q);save();return q.id},
    async libQDel(id){reload();db.libQ=Q().filter(q=>!(q.id===id&&(q.user_id===uid||adm())));save()},
    async libPct(){reload();return pct(uid)},
    async libMyClass(){reload();return C().find(c=>c.user_id===uid)||null},
    async libRequestClass(av,topics,contact){reload();if(!ok())throw new Error("La clase personalizada es para quien tiene la biblioteca.");const need=+(((db.site||{}).lib||{}).minPct)||80;const pc=pct(uid);
      if(pc<need&&!adm())throw new Error(`Primero mira al menos el ${need}% de la biblioteca (llevas ${pc}%).`);let c=C().find(x=>x.user_id===uid);
      if(c&&!["pendiente","cancelada"].includes(c.status))return;if(!c){db.libCs=(db.libCs||0)+1;c={id:db.libCs,user_id:uid,status:"pendiente",created_at:now()};C().push(c)}Object.assign(c,{availability:av||"",topics:topics||"",contact:contact||"",pct:pc,updated_at:now()});save()},
    async libAdminList(){need();reload();return it().slice().sort(by("sort"))},
    async libSave(o){need();reload();const v=Object.assign({},o,{minutes:o.minutes?+o.minutes:null,sort:+o.sort||1});if(v.section_id){const x=(db.libS||[]).find(y=>y.id===v.section_id);if(x)v.section=x.title}if(v.id){const i=it().find(x=>x.id===v.id);Object.assign(i,v);save();return v.id}v.id="lib-"+Math.random().toString(36).slice(2,9);v.created_at=now();it().push(v);save();return v.id},
    async libDelete(id){need();reload();db.libItems=it().filter(i=>i.id!==id);save()},
    async libAdminItems(){need();reload();return it().slice().sort(by("sort")).map(i=>{const ws=W().filter(w=>w.item_id===i.id),rs=R().filter(r=>r.item_id===i.id),qs=Q().filter(q=>q.item_id===i.id);
      return{item_id:i.id,title:i.title,section:i.section,status:i.status,minutes:i.minutes,viewers:ws.filter(w=>w.seconds>30).length,done:ws.filter(w=>w.done).length,hours:Math.round(ws.reduce((a,w)=>a+w.seconds,0)/360)/10,
        avg_stars:rs.length?Math.round(10*rs.reduce((a,x)=>a+x.stars,0)/rs.length)/10:null,n_ratings:rs.length,n_questions:qs.length,open_questions:qs.filter(q=>!q.answer).length}})},
    async libAdminUsers(){need();reload();return(db.ucourses||[]).filter(x=>x.course_id===LC().id).map(x=>{const p=db.profiles.find(y=>y.id===x.user_id)||{},ws=W().filter(w=>w.user_id===x.user_id),c=C().find(z=>z.user_id===x.user_id);
      return{user_id:x.user_id,username:p.username,avatar_url:p.avatar_url||null,since:x.created_at||null,hours:Math.round(ws.reduce((a,w)=>a+w.seconds,0)/360)/10,done:ws.filter(w=>w.done).length,total:pub().length,pct:pct(x.user_id),last_at:ws.map(w=>w.updated_at).sort().pop()||null,class_status:c?c.status:null}})},
    async libAdminQuestions(open){need();reload();return Q().filter(q=>open===false||!q.answer).slice().reverse().map(q=>{const p=db.profiles.find(x=>x.id===q.user_id)||{},i=it().find(x=>x.id===q.item_id)||{};return Object.assign({},q,{username:p.username,item_title:i.title})})},
    async libAnswer(id,a){need();reload();const q=Q().find(x=>x.id===id);if(q){q.answer=String(a||"").trim()||null;q.answered_at=q.answer?now():null;save()}},
    async libAdminClasses(){need();reload();return C().map(c=>{const p=db.profiles.find(x=>x.id===c.user_id)||{};return Object.assign({},c,{username:p.username,avatar_url:p.avatar_url||null,pct:pct(c.user_id)})})},
    async libClassSet(id,st,at,note){need();reload();const c=C().find(x=>x.id===id);if(c){c.status=st||c.status;c.scheduled_at=at||null;c.admin_note=note||"";save()}}}};
  const _chatLocal=()=>{
    const gOk=(u,r)=>{if(r==="g:general")return true;const p=db.profiles.find(x=>x.id===u)||{};if(p.role==="admin")return true;const g=(db.cgroups||[]).find(x=>x.id===r);if(!g)return false;
      return(g.members||[]).includes(u)||g.who==="all"||(g.who==="plan"&&p.premium_until&&new Date(p.premium_until)>Date.now()&&(g.plans||[]).includes(String(p.plan||"").toLowerCase()))||(g.who==="verified"&&!!p.affiliate)};
    const mine=r=>r==="g:general"||(r.startsWith("g:")&&gOk(uid,r))||(r.startsWith("dm:")&&r.split(":").slice(1).includes(uid));
    const pf=id=>db.profiles.find(x=>x.id===id)||{};const on=id=>{const x=(db.presence||{})[id];return!!x&&Date.now()-new Date(x.last_seen).getTime()<9e4};
    const amA=()=>pf(uid).role==="admin";const vf=p=>amA()?!!p.affiliate:null;const pl=p=>amA()&&p.premium_until&&new Date(p.premium_until)>Date.now()?String(p.plan||"").toLowerCase()||null:null;
    const row=m=>{const p=pf(m.sender);return Object.assign({},m,{username:p.username,avatar_url:p.avatar_url||null,is_admin:p.role==="admin",verified:vf(p)})};
    return{
    async chatSend(room,body,kind,payload){reload();if(!uid)throw new Error("Ingresa con tu cuenta.");if(!mine(room))throw new Error("Sala inválida.");
      {const g=(db.cgroups||[]).find(x=>x.id===room);if(g&&g.only_admin&&(db.profiles.find(x=>x.id===uid)||{}).role!=="admin")throw new Error("En este grupo solo escribe el profe.")}
      body=String(body||"").trim().slice(0,1000);kind=kind||"text";if(kind==="text"&&!body)throw new Error("Mensaje vacío.");
      db.cmsgs=db.cmsgs||[];db.cseq=(db.cseq||0)+1;const m={id:db.cseq,room,sender:uid,body,kind,payload:payload||null,created_at:new Date().toISOString()};db.cmsgs.push(m);
      db.creads=db.creads||{};db.creads[uid+"|"+room]=m.id;save();return m},
    async chatHistory(room,before){reload();if(!mine(room))return[];const R=db.creacts||[];const hid=(db.chid||{})[uid+"|"+room]||0;return(db.cmsgs||[]).filter(m=>m.room===room&&m.id>hid&&(!before||m.id<before)).slice(-50).reverse().map(m=>{const r=row(m);const rx={};R.filter(x=>x.msg_id===m.id).forEach(x=>(rx[x.emoji]=rx[x.emoji]||[]).push(x.user_id));r.reacts=Object.keys(rx).length?rx:null;return r})},
    async chatThreads(){reload();const M=db.cmsgs||[],R=db.creads||{};const rooms=["g:general"].concat((db.cgroups||[]).filter(g=>gOk(uid,g.id)).map(g=>g.id)).concat([...new Set(M.filter(m=>m.room.startsWith("dm:")&&mine(m.room)).map(m=>m.room))]);
      return rooms.map(r=>{const L=M.filter(m=>m.room===r),l=L[L.length-1]||{},o=r.startsWith("dm:")?r.split(":").slice(1).find(x=>x!==uid):null,p=o?pf(o):{};
        return{room:r,other:o,username:p.username||null,avatar_url:p.avatar_url||null,is_admin:p.role==="admin",online:o?on(o):false,last_id:l.id||null,last_body:l.body||null,last_kind:l.kind||null,last_sender:l.sender||null,last_at:l.created_at||null,
          unread:L.filter(m=>m.sender!==uid&&m.id>Math.max(R[uid+"|"+r]||0,(db.chid||{})[uid+"|"+r]||0)).length,other_read:o?(R[o+"|"+r]||0):null,verified:o?vf(p):null,plan:o?pl(p):null,__hid:!r.startsWith("g:")&&(l.id||0)<=((db.chid||{})[uid+"|"+r]||0)}}).filter(t=>!t.__hid).sort((a,b)=>(b.last_id||0)-(a.last_id||0))},
    async chatPeople(){reload();return Object.keys(db.presence||{}).filter(on).map(id=>{const p=pf(id),x=db.presence[id];return{id,username:p.username,avatar_url:p.avatar_url||null,is_admin:p.role==="admin",symbol:x.symbol,symbol_name:x.name,tf:x.tf,hidden:!!p.chat_hidden,verified:vf(p),plan:pl(p)}}).filter(x=>!x.hidden||x.id===uid)},
    async chatFind(q){reload();q=String(q||"").toLowerCase();return q.length<2?[]:db.profiles.filter(p=>!p.banned&&String(p.username||"").toLowerCase().includes(q)).slice(0,15).map(p=>({id:p.id,username:p.username,avatar_url:p.avatar_url||null,is_admin:p.role==="admin",verified:vf(p),plan:pl(p)}))},
    async chatMyMentions(){reload();if(!uid)return[];const me=(db.profiles.find(x=>x.id===uid)||{}).username||"";if(!me)return[];db.cment=db.cment||{};
      const all=m=>(db.profiles.find(x=>x.id===m.sender)||{}).role==="admin"&&/(^|\s)@(todos|todas|everyone)\b/i.test(m.body||"");
      return(db.cmsgs||[]).filter(m=>m.room.startsWith("g:")&&mine(m.room)&&m.sender!==uid&&!db.cment[uid+"|"+m.id]&&(all(m)||new RegExp("@"+me.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i").test(m.body||""))).slice(-20).reverse()
        .map(m=>({id:m.id,msg_id:m.id,sender:m.sender,username:(db.profiles.find(x=>x.id===m.sender)||{}).username,body:m.body,created_at:m.created_at,room:m.room,everyone:all(m)}))},
    async chatMentionsSeen(){reload();db.cment=db.cment||{};(db.cmsgs||[]).forEach(m=>{if(m.room.startsWith("g:"))db.cment[uid+"|"+m.id]=1});save()},
    async chatGroups(){reload();const am=(db.profiles.find(x=>x.id===uid)||{}).role==="admin";return(db.cgroups||[]).filter(g=>gOk(uid,g.id)).map(g=>Object.assign({},g,{n_members:am?db.profiles.filter(p=>!p.banned&&gOk(p.id,g.id)).length:null}))},
    async chatGroupSave(g){reload();if((db.profiles.find(x=>x.id===uid)||{}).role!=="admin")throw new Error("Solo el admin.");db.cgroups=db.cgroups||[];const id=g.id||("g:"+String(g.name||"grupo").toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,20).replace(/-+$/,"")+"-"+Math.random().toString(36).slice(2,6));
      const o={id,name:g.name,emoji:g.emoji||"👥",descr:g.descr||"",who:g.who||"all",plans:g.plans||[],members:g.members||[],only_admin:!!g.only_admin,sort:0};const i=db.cgroups.findIndex(x=>x.id===id);if(i>=0)db.cgroups[i]=o;else db.cgroups.push(o);save();return id},
    async chatGroupDelete(id){reload();db.cgroups=(db.cgroups||[]).filter(g=>g.id!==id);db.cmsgs=(db.cmsgs||[]).filter(m=>m.room!==id);save()},
    async chatGroupPeople(id){reload();return db.profiles.filter(p=>!p.banned).map(p=>({id:p.id,username:p.username,avatar_url:p.avatar_url||null,plan:p.premium_until&&new Date(p.premium_until)>Date.now()?String(p.plan||"").toLowerCase():null,verified:!!p.affiliate,ok:gOk(p.id,id)})).sort((a,b)=>(b.ok-a.ok))},
    async chatGroupReads(min,rm){rm=rm||"g:general";reload();const R=db.creads||{},out=[];Object.keys(R).forEach(k=>{const [u,room]=k.split("|");if(room!==rm||R[k]<(min||0))return;const p=db.profiles.find(x=>x.id===u)||{};out.push({user_id:u,username:p.username,avatar_url:p.avatar_url,last_id:R[k]})});return out},
    async chatRead(room,last){reload();db.creads=db.creads||{};const k=uid+"|"+room;db.creads[k]=Math.max(db.creads[k]||0,last||0);save()},
    async chatCleanup(){reload();const lim=Date.now()-10*864e5;db.cmsgs=(db.cmsgs||[]).filter(m=>new Date(m.created_at).getTime()>=lim);save()},
    async chatHide(room){reload();db.chid=db.chid||{};const mx=Math.max(0,...(db.cmsgs||[]).filter(m=>m.room===room).map(m=>m.id));db.chid[uid+"|"+room]=mx;db.creads=db.creads||{};db.creads[uid+"|"+room]=Math.max(db.creads[uid+"|"+room]||0,mx);save()},
    async chartChatUpload(blob){return await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(blob)})},async chartChatImgDel(){},async chartChatImgClean(){return 0},
    async chatReact(id,e){reload();db.creacts=db.creacts||[];const i=db.creacts.findIndex(r=>r.msg_id===id&&r.user_id===uid&&r.emoji===e);if(i>=0){db.creacts.splice(i,1);save();return false}
      const m=(db.cmsgs||[]).find(x=>x.id===id);if(!m)throw new Error("Mensaje no disponible.");db.creacts.push({msg_id:id,user_id:uid,emoji:e,room:m.room});save();return true},
    async chatDelete(id){reload();db.cmsgs=(db.cmsgs||[]).filter(m=>!(m.id===id&&(m.sender===uid||(pf(uid).role==="admin"))));save()},
    async chatHidden(v){reload();const p=pf(uid);p.chat_hidden=!!v;save()},
    async chatBlock(u,v){reload();const p=pf(u);p.chat_blocked=!!v;save()}}};
  load();
  let uid=null;try{uid=sessionStorage.getItem("ag_local_uid_tab")||localStorage.getItem("ag_local_uid")}catch(e){}
  const me=()=>db.profiles.find(p=>p.id===uid)||null;
  const adm=()=>{const p=me();return!!p&&p.role==="admin"};
  const need=()=>{if(!adm())throw new Error("Solo el administrador")};
  const up=(arr,o)=>{if(!o.id)o.id=uuid();const i=arr.findIndex(x=>x.id===o.id);if(i>=0)arr[i]=Object.assign({},arr[i],o);else arr.push(Object.assign({created_at:now()},o));save();return Promise.resolve(arr.find(x=>x.id===o.id))};
  const rm=(k,id)=>{db[k]=db[k].filter(x=>x.id!==id);save();return Promise.resolve()};
  const by=k=>(a,b)=>(a[k]??0)-(b[k]??0);
  const trialMod=mid=>{const p=me();if(!p)return false;const d=(db.site||{}).trialDays;const days=d==null||d===""?7:+d;const c=new Date(p.created_at||Date.now()).getTime();const m=db.modules.find(x=>x.id===mid);return !!(m&&m.free&&Date.now()<c+days*864e5)};
  const trialLes=lid=>{const l=db.lessons.find(x=>x.id===lid);return !!(l&&trialMod(l.module_id))};
  const lessonOk=l=>{const m=db.modules.find(x=>x.id===l.module_id);return adm()||(l.status==="publicado"&&m&&m.status==="publicado")};
  return{
    mode:"local",
    async init(){return{recovery:false}},
    user(){const u=db.users.find(x=>x.id===uid);return u?{id:u.id,email:u.email}:null},
    profile(){const p=me();if(p){const u=db.users.find(x=>x.id===uid);p.email=u&&u.email}return p},
    async loadProfile(){return this.profile()},
    isPremium(){return isPrem(me())},isAdmin(){return adm()},async accessToken(){return null},
    async chartState(){return null},async saveChartState(){return null},
    async chartAlerts(){return(db.calerts||[]).filter(x=>x.user_id===uid)},
    async saveChartAlert(a){db.calerts=db.calerts||[];const r=Object.assign({id:a.id||uuid(),created_at:now(),active:true},a,{user_id:uid});db.calerts=db.calerts.filter(x=>x.id!==r.id).concat(r);save();return r},
    async deleteChartAlert(id){db.calerts=(db.calerts||[]).filter(x=>x.id!==id);save()},
    async chartTrial(){db.ctrial=db.ctrial||{};let t=db.ctrial[uid];if(!t){t=db.ctrial[uid]={started_at:now()};save()}return{started_at:t.started_at,ends_at:new Date(new Date(t.started_at).getTime()+3*864e5).toISOString(),has_feedback:!!t.feedback_at}},
    async chartFeedback(rating,text){db.ctrial=db.ctrial||{};const t=db.ctrial[uid]=db.ctrial[uid]||{started_at:now()};Object.assign(t,{rating,feedback:text,feedback_at:now()});save()},
    async adminChartFeedback(){return Object.entries(db.ctrial||{}).map(([u,t])=>{const p=db.profiles.find(x=>x.id===u)||{};return Object.assign({username:p.username,country:p.country,premium:false},t)})},
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
    async site(){reload();return db.site||{}},
    rt:null,
    async liveGet(){return db.live||null},
    async liveSet(o){db.live=Object.assign({id:1},db.live,o,{updated_at:now()});save();try{window.dispatchEvent(new CustomEvent("ag-local-live"))}catch(e){}},
    async zonesList(){return Object.values(db.zones||{}).sort((a,b)=>String(b.updated_at).localeCompare(a.updated_at))},
    async zoneSet(o){db.zones=db.zones||{};db.zones[o.sym]=Object.assign({},o,{updated_at:now()});save();return db.zones[o.sym]},
    async zoneDel(sym){if(db.zones)delete db.zones[sym];save()},
    async slides(place){return db.slides.filter(s=>s.place===place&&(s.active||adm())).sort(by("sort"))},
    async modules(){return db.modules.filter(m=>m.status==="publicado"||adm()).sort(by("sort"))},
    async lessonIndex(){return db.lessons.filter(lessonOk).sort(by("sort")).map(l=>({id:l.id,module_id:l.module_id,title:l.title,sort:l.sort,has_video:!!l.video_url}))},
    async lesson(id){const l=db.lessons.find(x=>x.id===id);if(!this.isPremium()&&!(l&&trialMod(l.module_id)))return null;return l&&lessonOk(l)?l:null},
    async lessons(){return this.isPremium()?db.lessons.filter(lessonOk).sort(by("sort")):[]},
    async exercises(f){const ok=e=>e.is_demo||this.isPremium()||(e.lesson_id&&trialLes(e.lesson_id));return db.exercises.filter(e=>ok(e)&&(f.demo?e.is_demo:f.practice?(!e.lesson_id&&!e.is_demo):e.lesson_id===f.lessonId)).sort(by("sort"))},
    async allExercises(){need();return db.exercises.slice().sort(by("sort"))},
    async grade(id){const p=me();if(!p)throw new Error("login");const e=db.exercises.find(x=>x.id===id);if(!e)throw new Error("no_existe");
      const prem=this.isPremium()||(!!e.lesson_id&&trialLes(e.lesson_id));if(!prem){if(!e.is_demo)throw new Error("premium");if(p.demo_used>=5)throw new Error("demo_agotado");p.demo_used++;save()}
      const a=db.answers.find(x=>x.exercise_id===id)||{};return{zone:a.zone??null,sl:a.sl??null,answer:a.answer||{},explain:a.explain||"",demo_left:prem?null:5-p.demo_used}},
    async progressGet(){return db.progress.find(x=>x.user_id===uid)||null},
    async progressSave(xp,data){const i=db.progress.findIndex(x=>x.user_id===uid);const o={user_id:uid,xp,data,updated_at:now()};if(i>=0)db.progress[i]=o;else db.progress.push(o);save()},
    async leaderboard(){return db.progress.map(g=>{const p=db.profiles.find(x=>x.id===g.user_id)||{};return{username:p.username||"alumno",avatar_url:p.avatar_url||null,country:p.country||"",xp:g.xp,lessons:Object.values((g.data||{}).done||{}).filter(d=>d.passed).length,is_me:g.user_id===uid,premium:!!(p.premium_until&&new Date(p.premium_until)>new Date()),_x:p.role==="admin"||p.banned}}).filter(x=>!x._x&&x.xp>0).sort((a,b)=>b.xp-a.xp).slice(0,100)},
    ..._libLocal(),..._mt5Local(),
    async courses(){db.courses=db.courses||[{id:"crs-boom",title:"Boom y Crash",descr:"El método completo de El Arte Gráfico para operar Boom y Crash.",color:"#e84c5c",icon:"🎯",price:"40 USD",status:"publicado",sort:1}];if(!db.courses.some(c=>c.kind==="intensivo"))db.courses.push({id:"crs-gii",title:"GII · Grupal Intensivo e Inmersivo",descr:"Clases en vivo conmigo, dentro de EAG Charts.",color:"#2962ff",icon:"🔴",price:"50 USD",status:"publicado",sort:80,kind:"intensivo"});if(!db.courses.some(c=>c.kind==="biblioteca"))db.courses.push({id:"crs-lib",title:"Biblioteca de clases",descr:"Clases grabadas, grupales y personalizadas, donde explico cómo opero.",color:"#1f4fd6",icon:"📚",price:"50 USD",status:"publicado",sort:90,kind:"biblioteca"});db.modules.forEach(m=>{if(!m.course_id)m.course_id=db.courses[0].id});return db.courses.filter(c=>c.status==="publicado"||adm())},
    async myCourses(){return(db.ucourses||[]).filter(x=>x.user_id===uid)},
    async giiCupo(){const c=(db.courses||[]).find(x=>x.kind==="intensivo");return c?(db.ucourses||[]).filter(x=>x.course_id===c.id).length:0},
    async spinRoulette(){const p=me();if(!p)throw new Error("Inicia sesión");const pr=adm()?4:({diamond:4,oro:3,plata:2,cobre:1})[p.plan]||0;if(!isPrem(p)&&!adm()||pr<4)throw new Error("La ruleta diaria es exclusiva del plan Diamond");
      const d=new Date(Date.now()-5*3600e3).toISOString().slice(0,10);db.spins=db.spins||[];if(db.spins.some(x=>x.user_id===uid&&x.day===d))throw new Error("Ya giraste hoy. Vuelve mañana");
      const x=Math.random();let r;if(x<.32)r={prize:"xp",amount:50,label:"+50 XP"};else if(x<.55)r={prize:"xp",amount:100,label:"+100 XP"};else if(x<.67)r={prize:"xp",amount:250,label:"+250 XP"};else if(x<.74)r={prize:"xp",amount:500,label:"+500 XP"};else if(x<.95)r={prize:"medalla",amount:0,label:["trebol","herradura","estrella","cometa","diamante"][Math.floor(Math.random()*5)]};else r={prize:"dia",amount:1,label:"+1 día de suscripción"};
      db.spins.push(Object.assign({user_id:uid,day:d,created_at:now()},r));save();return Object.assign({day:d},r)},
    async mySpins(){return(db.spins||[]).filter(x=>x.user_id===uid).slice().reverse()},
    async saveCourse(c){need();db.courses=db.courses||[];return up(db.courses,c)},async delCourse(id){need();db.courses=(db.courses||[]).filter(c=>c.id!==id);save()},
    async adminGrantCourse(u,cid,on){need();db.ucourses=(db.ucourses||[]).filter(x=>!(x.user_id===u&&x.course_id===cid));if(on)db.ucourses.push({user_id:u,course_id:cid,created_at:new Date().toISOString()});save()},
    async posts(){const rk=adm()?3:isPrem(me())?(({oro:3,plata:2,cobre:1})[(me()||{}).plan]||1):0;return db.posts.filter(p=>(!p.premium_only&&!p.min_plan)||rk>=Math.max(1,({oro:3,plata:2,cobre:1})[p.min_plan]||0)).sort((a,b)=>(b.pinned-a.pinned)||String(b.created_at).localeCompare(a.created_at))},
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
    async users(){need();return db.profiles.map(p=>{const u=db.users.find(x=>x.id===p.id)||{};const g=db.progress.find(x=>x.user_id===p.id);return Object.assign({},p,{email:u.email,xp:g?g.xp:0,courses:(db.ucourses||[]).filter(x=>x.user_id===p.id).map(x=>x.course_id)})})},
    async adminReset(user,what,fb,demo){need();let n=0;db.progress.forEach(g=>{if(user&&g.user_id!==user)return;n++;const rv=((g.data||{}).rv||0)+1;g.xp=0;
        g.data=what==="puntos"?Object.assign({},g.data,{xp:0,rv,px:[]}):{rv}});
      if(fb)db.feedback=(db.feedback||[]).filter(f=>user&&f.user_id!==user);
      if(demo)db.profiles.forEach(p=>{if(!user||p.id===user)p.demo_used=0});save();return n},
    async setUser(id,patch){need();const p=db.profiles.find(x=>x.id===id);Object.assign(p,patch);save()},
    async myFeatures(){if(!uid)return[];reload();return(db.ufeat||[]).filter(x=>x.user_id===uid&&new Date(x.until)>Date.now()).map(x=>({feature:x.feature,until:x.until}))},
    async adminFeatures(u){need();reload();return(db.ufeat||[]).filter(x=>x.user_id===u).map(x=>({feature:x.feature,until:x.until}))},
    async adminSetFeature(u,f,until){need();reload();db.ufeat=(db.ufeat||[]).filter(x=>!(x.user_id===u&&x.feature===f));if(until)db.ufeat.push({user_id:u,feature:f,until,granted_by:uid,updated_at:new Date().toISOString()});save()},
    async adminAllFeatures(onlyActive){need();reload();const pf=id=>db.profiles.find(p=>p.id===id)||{};return(db.ufeat||[]).filter(x=>!onlyActive||new Date(x.until)>Date.now()).sort((a,b)=>String(b.until).localeCompare(a.until)).map(x=>Object.assign({},x,{username:pf(x.user_id).username||"",avatar_url:pf(x.user_id).avatar_url||null,plan:pf(x.user_id).plan||"",premium_until:pf(x.user_id).premium_until||null,by:pf(x.granted_by).username||""}))},
    async adminUserBrief(id){need();reload();const p=db.profiles.find(x=>x.id===id);return p?{id:p.id,username:p.username,plan:p.plan||"",premium_until:p.premium_until,role:p.role,banned:p.banned}:null},
    async upload(file){need();if(file.size>3*1024*1024)throw new Error("En el modo de prueba solo se aceptan archivos de hasta 3 MB.");
      const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file)});db.files.unshift({name:file.name,url,size:file.size});save();return url},
    async files(){return db.files},
    async pushKey(){throw new Error("Las notificaciones solo funcionan en la web real (elartegrafico.com).")},
    async savePushSub(){},async delPushSub(){},
    async adminPushStats(){return{total:0,premium:0,gratis:0}},
    async sendPush(o){if(o&&o.title){db.notifs=db.notifs||[];db.notifs.unshift({id:Date.now(),created_at:new Date().toISOString(),title:o.title,body:o.body||"",url:o.url||"",tag:o.tag||"",personal:!!o.user_id,uid:o.user_id||null});save()}return{sent:0,local:true}},
    async myNotifs(){return(db.notifs||[]).filter(n=>!n.uid||n.uid===uid).slice(0,40)},
    async uploadAvatar(blob){return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(blob)})},
    async discord(action,o){const p=me();if(!p)throw new Error("Inicia sesión");if(action==="config")return{clientId:"local",ready:true};
      if(action==="link"){Object.assign(p,{discord_id:"local-"+p.id.slice(0,6),discord_name:p.username,discord_role:!!p.affiliate});save();return{ok:true,name:p.discord_name,result:p.affiliate?"rol-puesto":"rol-quitado",affiliate:!!p.affiliate}}
      if(action==="unlink"){Object.assign(p,{discord_id:null,discord_name:null,discord_role:false});save();return{ok:true}}
      if(action==="resync"){p.discord_role=!!p.affiliate;save();return{result:p.affiliate?"rol-puesto":"rol-quitado"}}
      if(action==="sync")return{ok:true,total:db.profiles.filter(x=>x.discord_id).length,out:{}}},
    discordLogin(){window.AGTOAST&&window.AGTOAST("En el modo de prueba no se puede ingresar con Discord. Pruébalo en la web real.")},
    async adminDiscordHooks(){const h=db.dchooks||{};return{general:!!h.g,miembros:!!h.m,premium:!!h.p,general_tail:(h.g||"").slice(-6),miembros_tail:(h.m||"").slice(-6),premium_tail:(h.p||"").slice(-6)}},
    async adminSetDiscordHooks(g,m,p){const h=db.dchooks=db.dchooks||{};const ok=/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;[["g",g],["m",m],["p",p]].forEach(([k,v])=>{if(v===null||v===undefined)return;if(v&&!ok.test(v))throw new Error("Ese enlace no es un webhook de Discord");h[k]=v||null});save()},
    async discordTest(){throw new Error("En el modo de prueba no se envían mensajes a Discord. Pruébalo en la web real.")},
    async dmMemberStart(){const p=me();if(!p)throw new Error("Inicia sesión");if(p.affiliate)throw new Error("Ya eres miembro verificado de la comunidad");db.dms=db.dms||{};const t=db.dms[uid]=db.dms[uid]||{open:true,topic:"",messages:[]};t.open=true;t.topic="Miembro verificado";t.messages=t.messages||[];t.last_at=now();
      t.messages.push({id:uuid(),from_admin:false,body:"Hola, quiero ser miembro verificado de la comunidad.",created_at:now()});t.messages.push({id:uuid(),from_admin:true,body:"¡Qué bueno que quieras ser parte de la comunidad! Así te haces miembro verificado:\n\n1. Abre tu cuenta de Deriv con el enlace de la comunidad: "+((db.site||{}).derivRefUrl||"(te lo enviamos en un momento)")+"\n2. Copia tu ID de cliente de Deriv y pégalo en el recuadro de arriba. Se verifica solo.",created_at:now()});save();return{ok:true}},
    async uploadChat(blob){return URL.createObjectURL(blob)},async chatImgClean(){return 0},
    async chartPing(o){db.presence=db.presence||{};const p=db.presence[uid]||{started_at:new Date().toISOString()};if(Date.now()-new Date(p.last_seen||0).getTime()>18e4)p.started_at=new Date().toISOString();Object.assign(p,o,{last_seen:new Date().toISOString()});db.presence[uid]=p;save();return null},
    chartBye(){},
    /* chat interno (modo local: se guarda en este navegador; sirve para probar con 2 pestañas) */
    ..._chatLocal(),
    async adminFunnel(days){const since=days?Date.now()-days*864e5:0,P=db.profiles.filter(p=>p.role!=="admin"&&!p.banned&&new Date(p.created_at||0).getTime()>=since);
      const row=p=>({id:p.id,username:p.username,email:(db.users.find(u=>u.id===p.id)||{}).email,country:p.country,created_at:p.created_at,last_sign_in_at:p.created_at,charts:!!(db.presence||{})[p.id],retos:false,aff_status:null,member_reminders:p.member_reminders||0,member_reminded_at:p.member_reminded_at||null});
      const prem=p=>p.premium_until&&new Date(p.premium_until)>Date.now();
      return{registrados:P.length,activos7:P.length,charts:P.filter(p=>(db.presence||{})[p.id]).length,retos:0,pendientes:0,miembros:P.filter(p=>p.affiliate).length,plan:P.filter(prem).length,
        sin_verificar:P.filter(p=>!p.affiliate&&!prem(p)).map(row),miembros_sin_plan:P.filter(p=>p.affiliate&&!prem(p)).map(row)}},
    async adminReminderCfg(o){db.remCfg=Object.assign({enabled:true,day1:2,day2:9},db.remCfg||{},Object.fromEntries(Object.entries(o||{}).filter(([k,v])=>v!=null)));save();return Object.assign({due:0,sent_7d:0,converted:0},db.remCfg)},
    async adminReminderSend(ids){ids.forEach(id=>{const p=db.profiles.find(x=>x.id===id);if(p){p.member_reminders=(p.member_reminders||0)+1;p.member_reminded_at=new Date().toISOString()}});save();return ids.length},
    async sitePing(place,device){if(!uid)return null;reload();db.sitePres=db.sitePres||{};db.sitePres[uid]={last_seen:new Date().toISOString(),place,device};save();return null},
    async adminOnline(){need();reload();const now=Date.now(),out={};const put=(id,ls,pl,dv)=>{const t=new Date(ls).getTime();if(now-t>36e5)return;if(!out[id]||new Date(out[id].last_seen).getTime()<t)out[id]={user_id:id,last_seen:ls,place:pl,device:dv,online:now-t<12e4}};
      Object.entries(db.sitePres||{}).forEach(([id,x])=>put(id,x.last_seen,x.place,x.device));Object.entries(db.presence||{}).forEach(([id,x])=>put(id,x.last_seen,"Charts"+(x.name?" · "+x.name:""),x.device));return Object.values(out)},
    async adminChartOnline(){const P=db.presence||{},now=Date.now();return Object.keys(P).map(id=>{const x=P[id],pr=db.profiles.find(q=>q.id===id)||{};return{user_id:id,username:pr.username,avatar_url:pr.avatar_url,country:pr.country,plan:pr.plan||"",premium:!!(pr.premium_until&&new Date(pr.premium_until)>now),affiliate:!!pr.affiliate,role:pr.role,online:now-new Date(x.last_seen).getTime()<12e4,started_at:x.started_at,last_seen:x.last_seen,symbol:x.symbol,symbol_name:x.name,tf:x.tf,layout:x.layout,device:x.device,profile:x.profile,panes:x.panes}}).filter(r=>now-new Date(r.last_seen).getTime()<864e5).sort((a,b)=>(b.online-a.online)||(new Date(b.last_seen)-new Date(a.last_seen)))},
    async adminDiscordStats(){return{conectados:db.profiles.filter(x=>x.discord_id).length,con_rol:db.profiles.filter(x=>x.discord_role).length,afiliados_sin_discord:db.profiles.filter(x=>x.affiliate&&!x.discord_id).length}},
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
    async payRequest(o){if(!uid)throw new Error("Inicia sesión");if(db.site&&db.site.paymentsOff&&!adm())throw new Error("Los pagos están pausados por ahora. Te avisaremos cuando abran.");{const sl=(db.site&&db.site.sell)||{},lc=(db.courses||[]).find(c=>c.id===o.course_id),k=!o.course_id?"plans":lc&&lc.kind==="biblioteca"?"lib":"c:"+o.course_id;if(sl[k]===false&&!adm())throw new Error("Esto no está a la venta por ahora. Te avisaremos cuando abra.")}db.payments=db.payments||[];
      const oid=String(o.order_id||"").trim();if(oid.length<4)throw new Error("Escribe el ID de orden de Binance.");
      if(db.payments.some(x=>x.status!=="rechazado"&&x.order_id.toLowerCase()===oid.toLowerCase()))throw new Error("Ese ID de orden ya fue registrado.");
      if(db.payments.filter(x=>x.user_id===uid&&x.status==="pendiente").length>=3)throw new Error("Ya tienes 3 pagos por confirmar. Espera a que los revisemos.");
      const r={id:uuid(),user_id:uid,method:["breb","airtm"].includes(o.method)?o.method:"binance",plan:o.plan||"",days:o.days||30,amount:o.amount||"",order_id:oid,note:o.note||"",course_id:o.course_id||null,status:"pendiente",admin_note:"",created_at:now(),reviewed_at:null};db.payments.push(r);save();return r},
    async myFeedback(){return(db.feedback||[]).filter(x=>x.user_id===uid).map(x=>({module_id:x.module_id}))},
    async sendFeedback(o){if(!uid)throw new Error("Inicia sesión");db.feedback=db.feedback||[];if(db.feedback.some(x=>x.user_id===uid&&x.module_id===o.module_id))throw new Error("Ya dejaste tu reseña de este módulo");
      db.feedback.push({id:"f"+Date.now(),user_id:uid,module_id:o.module_id,rating:o.rating,liked:o.liked,improve:o.improve,created_at:new Date().toISOString()});save()},
    async adminFeedback(){need();return(db.feedback||[]).map(f=>{const p=db.profiles.find(x=>x.id===f.user_id)||{};const m=db.modules.find(x=>x.id===f.module_id)||{};
      return Object.assign({},f,{module_title:m.title||"",username:p.username||"",country:p.country||"",premium:!!(p.premium_until&&new Date(p.premium_until)>new Date())})}).sort((a,b)=>String(b.created_at).localeCompare(a.created_at))},
    /* retos (modo de prueba: misma lógica que el servidor) */
    _closeAt(c){const h=+(((db.site||{}).rewards||{}).revealHours)||3;return c.weekly?new Date(c.ends_at):new Date(new Date(c.starts_at).getTime()+h*36e5)},
    async challengesFeed(){const L=db.challenges||[],t=Date.now(),self=this;return L.filter(c=>c.status==="publicado"&&new Date(c.starts_at)<=t).sort((a,b)=>String(b.starts_at).localeCompare(a.starts_at)).map(c=>{
      const E=(db.centries||[]).filter(e=>e.challenge_id===c.id),w=E.filter(e=>e.place!=null).length,me=E.find(e=>e.user_id===uid),k=(db.ckeys||{})[c.id]||{};const cl=self._closeAt(c),closed=cl<=t,show=closed;
      return Object.assign({},c,{ends_at:cl.toISOString(),winners:show?w:null,players:E.length,closed,my_correct:me&&show?me.correct:null,my_place:me&&show?me.place:null,my_points:me&&show?me.points:null,answered:!!me,correct:show?k.correct:null,zone:show&&k.zone!=null?k.zone+(+c.off||0):null,tol:show?k.tol:null,explain:show?k.explain:null,after_bars:show?c.after_bars:null,chart_t:null,my_answer:me?me.answer:null})})},
    async submitChallenge(id,ans){if(!uid)throw new Error("Inicia sesión para participar");const cfg=(db.site||{}).rewards||{};if(!cfg.enabled)throw new Error("Los retos todavía no están activos");
      const c=(db.challenges||[]).find(x=>x.id===id);if(!c||c.status!=="publicado"||new Date(c.starts_at)>Date.now())throw new Error("Ese reto no está disponible");if(this._closeAt(c)<=Date.now())throw new Error("Este reto ya cerró");if(c.express&&cfg.expressOnlyMembers!==false&&!(me()||{}).affiliate)throw new Error("Los retos express son solo para miembros verificados de la comunidad");
      db.centries=db.centries||[];if(db.centries.some(e=>e.challenge_id===id&&e.user_id===uid))throw new Error("Ya respondiste este reto");
      const k=(db.ckeys||{})[id]||{},p=me();const ok=c.kind==="zona"?(k.zone!=null&&Math.abs(+ans.price-(+c.off||0)-k.zone)<=(k.tol||0)):(+ans.option===k.correct);
      const w=db.centries.filter(e=>e.challenge_id===id&&e.place!=null).length;let place=null,pts=0;
      if(ok&&w<c.max_winners){place=w+1;pts=(p.affiliate||cfg.halfIfNotAffiliate===false)?c.points:Math.ceil(c.points/2)}
      db.centries.push({id:uuid(),challenge_id:id,user_id:uid,answer:ans,correct:ok,place,points:pts,affiliate:!!p.affiliate,created_at:now()});save();
      {const r=await this.myRewards();const bb=cfg.streakBonus??50;if(bb>0&&r.streak>0&&r.streak%7===0){db.bonuses=db.bonuses||[];const ref=new Date(Date.now()-5*3600e3).toISOString().slice(0,10);if(!db.bonuses.some(b=>b.user_id===uid&&b.ref===ref)){db.bonuses.push({user_id:uid,kind:"racha7",ref,points:(p.affiliate||cfg.halfIfNotAffiliate===false)?bb:Math.ceil(bb/2),created_at:now()});save()}}}
      return{received:true,reveal_at:this._closeAt(c).toISOString()}},
    async challengeWinners(id){const c=(db.challenges||[]).find(x=>x.id===id);if(!c||this._closeAt(c)>Date.now())return[];return(db.centries||[]).filter(e=>e.challenge_id===id&&e.place!=null).sort(by("place")).map(e=>{const p=db.profiles.find(x=>x.id===e.user_id)||{};return{place:e.place,username:p.username,avatar_url:p.avatar_url,country:p.country,premium:!!(p.premium_until&&new Date(p.premium_until)>new Date()),affiliate:!!p.affiliate,points:e.points,at:e.created_at}})},
    async rewardsBoard(per){const m=new Date();m.setDate(1);m.setHours(0,0,0,0);const g={};(db.centries||[]).filter(e=>e.points>0&&(per==="total"||new Date(e.created_at)>=m)).forEach(e=>{g[e.user_id]=g[e.user_id]||{pts:0,w:0};g[e.user_id].pts+=e.points;g[e.user_id].w++});
      return Object.entries(g).map(([u,v])=>{const p=db.profiles.find(x=>x.id===u)||{};return{username:p.username,avatar_url:p.avatar_url,country:p.country,premium:!!(p.premium_until&&new Date(p.premium_until)>new Date()),affiliate:!!p.affiliate,points:v.pts,wins:v.w,is_me:u===uid,_r:p.role}}).filter(x=>x._r!=="admin").sort((a,b)=>b.points-a.points)},
    async progressBoard(){return db.progress.map(g=>{const p=db.profiles.find(x=>x.id===g.user_id)||{};return{username:p.username,avatar_url:p.avatar_url,country:p.country,premium:!!(p.premium_until&&new Date(p.premium_until)>new Date()),affiliate:!!p.affiliate,lessons:Object.values((g.data||{}).done||{}).filter(d=>d.passed).length,is_me:g.user_id===uid,_x:p.role==="admin"||p.banned}}).filter(x=>!x._x).sort((a,b)=>b.lessons-a.lessons)},
    async myRewards(){if(!uid)return null;const E=(db.centries||[]).filter(e=>e.user_id===uid),R=(db.redemptions||[]).filter(r=>r.user_id===uid),a=(db.affiliates||[]).find(x=>x.user_id===uid);const m=new Date();m.setDate(1);m.setHours(0,0,0,0);
      const B=(db.bonuses||[]).filter(b=>b.user_id===uid),dk=t=>new Date(new Date(t).getTime()-5*3600e3).toISOString().slice(0,10);
      const days=[...new Set(E.map(e=>dk(e.created_at)))].sort();let best=0,run=0,prev=null;days.forEach(d=>{run=prev&&(new Date(d)-new Date(prev))===864e5?run+1:1;best=Math.max(best,run);prev=d});
      const today=dk(Date.now()),yest=dk(Date.now()-864e5);const streak=prev&&(prev===today||prev===yest)?run:0;const C=id=>(db.challenges||[]).find(c=>c.id===id)||{};
      const earned=E.reduce((s,e)=>s+e.points,0)+B.reduce((s,b)=>s+b.points,0);return{balance:earned-R.filter(r=>r.status!=="rechazado").reduce((s,r)=>s+r.points,0),earned,month:E.filter(e=>new Date(e.created_at)>=m).reduce((s,e)=>s+e.points,0),wins:E.filter(e=>e.place!=null).length,played:E.length,
        correct:E.filter(e=>e.correct).length,firsts:E.filter(e=>e.place===1).length,podiums:E.filter(e=>e.place&&e.place<=3).length,weekly_wins:E.filter(e=>e.place&&C(e.challenge_id).weekly).length,kinds:new Set(E.filter(e=>e.correct).map(e=>C(e.challenge_id).kind)).size,
        streak,best_streak:best,played_today:prev===today,bonus:B.reduce((s,b)=>s+b.points,0),paid:R.filter(r=>r.status==="pagado").length,affiliate:a?a.status:"ninguno",deriv_id:a&&a.deriv_id,affiliate_note:a&&a.admin_note,redemptions:R.slice().reverse()}},
    async requestRedemption(points,method,account){const cfg=(db.site||{}).rewards||{};if(!cfg.enabled||!cfg.redeemOpen)throw new Error("Los canjes están cerrados por ahora. Tus puntos se siguen acumulando.");db.redemptions=db.redemptions||[];
      if(db.redemptions.some(r=>r.user_id===uid&&r.status==="pendiente"))throw new Error("Ya tienes un canje en revisión");const mn=cfg.minRedeem??500,bal=(await this.myRewards()).balance;
      if(!(points>=mn))throw new Error(`El mínimo para canjear es ${mn} puntos`);if(points>bal)throw new Error(`No tienes puntos suficientes (tienes ${bal})`);
      const r={id:uuid(),user_id:uid,points,usd:Math.round(points/(cfg.ptsPerUsd||100)*100)/100,method:method||"binance",account,status:"pendiente",admin_note:"",created_at:now()};db.redemptions.push(r);save();return r},
    async requestAffiliate(d){if(!uid)throw new Error("Inicia sesión");d=String(d||"").replace(/\s/g,"").toUpperCase();if(d.length<3)throw new Error("Escribe tu ID de cliente de Deriv (ej.: CR1234567)");db.affiliates=db.affiliates||[];
      if(db.affiliates.some(a=>a.deriv_id===d&&a.user_id!==uid&&a.status!=="rechazado"))throw new Error("Ese ID de Deriv ya está registrado por otra cuenta");
      const a=db.affiliates.find(x=>x.user_id===uid);if(a&&a.status==="verificado")throw new Error("Ya eres miembro verificado de la comunidad");
      const inl=(db.ptier||{})[d]==="activo",st=inl?"verificado":"pendiente",nt=inl?"Verificado automáticamente con la lista de socios":"";
      if(a)Object.assign(a,{deriv_id:d,status:st,admin_note:nt,created_at:now()});else db.affiliates.push({user_id:uid,deriv_id:d,status:st,admin_note:nt,created_at:now()});if(inl){const p=me();if(p)p.affiliate=true}save();return{status:st}},
    async adminPartnerImport(ids,monthly,tier){need();tier=tier==="antiguo"?"antiguo":"activo";const L=[...new Set((ids||[]).map(x=>String(x).replace(/\s/g,"").toUpperCase()).filter(x=>/^[A-Z]{1,5}[0-9]{3,12}$/.test(x)||/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(x)||/^D-[A-Z0-9]{5,10}$/.test(x)))];
      db.ptier=db.ptier||{};(db.partners||[]).forEach(x=>{if(!db.ptier[x])db.ptier[x]="activo"});delete db.partners;let moved=0,saved=0;
      if(tier==="activo"&&monthly)Object.keys(db.ptier).forEach(k=>{if(db.ptier[k]==="activo"&&!L.includes(k)){db.ptier[k]="antiguo";moved++}});
      L.forEach(x=>{if(tier==="activo"){db.ptier[x]="activo";saved++}else if(!db.ptier[x]){db.ptier[x]="antiguo";saved++}});
      let ok=0;(db.affiliates||[]).forEach(a=>{if((a.status==="pendiente"||a.status==="rechazado")&&db.ptier[String(a.deriv_id).toUpperCase()]==="activo"){Object.assign(a,{status:"verificado",admin_note:"Verificado automáticamente con la lista de socios activos",reviewed_at:now()});const p=db.profiles.find(x=>x.id===a.user_id);if(p)p.affiliate=true;ok++}});save();
      const v=Object.values(db.ptier);return{received:L.length,saved,moved_old:moved,approved:ok,active:v.filter(x=>x==="activo").length,old:v.filter(x=>x==="antiguo").length}},
    /* novedades (modo local) */
    async adminAttention(){need();const D=db.dms||{};return{payments:(db.payments||[]).filter(x=>x.status==="pendiente").length,affiliates:(db.affiliates||[]).filter(x=>x.status==="pendiente").length,affiliates_old:0,redemptions:(db.redemptions||[]).filter(x=>x.status==="pendiente").length,
      reviews:(db.reviews||[]).filter(x=>!x.approved).length,dms:Object.values(D).reduce((n,t)=>n+t.messages.filter(m=>!m.from_admin&&!m.read_at).length,0),reports:(db.room||[]).filter(m=>(m.rep||[]).length).length,
      retos_on:true,reto_live:(db.challenges||[]).some(c=>c.status==="publicado"&&new Date(c.starts_at)<=new Date()&&this._closeAt(c)>new Date()),reto_next:((db.challenges||[]).filter(c=>c.status==="publicado"&&new Date(c.starts_at)>new Date()).map(c=>c.starts_at).sort()[0])||null,
      reto_drafts:(db.challenges||[]).filter(c=>c.status!=="publicado").length,expiring:db.profiles.filter(p=>p.premium_until&&new Date(p.premium_until)>new Date()&&new Date(p.premium_until)<new Date(Date.now()+7*864e5)).length}},
    async claimCertificate(cid){const p=me();if(!p)throw new Error("Inicia sesión");db.certs=db.certs||[];let c=db.certs.find(x=>x.user_id===p.id&&x.course_id===cid);
      if(!c){const co=(db.courses||[]).find(x=>x.id===cid)||{title:"Boom y Crash"};c={code:"EAG-"+Math.random().toString(16).slice(2,6).toUpperCase()+"-"+Math.random().toString(16).slice(2,6).toUpperCase(),user_id:p.id,course_id:cid,username:p.username,course_title:co.title,lessons:(db.lessons||[]).length,issued_at:new Date().toISOString()};db.certs.push(c);save()}
      return c},
    async myCertificates(){const p=me();return(db.certs||[]).filter(x=>p&&x.user_id===p.id)},
    async verifyCertificate(code){const c=(db.certs||[]).find(x=>x.code===String(code||"").toUpperCase().trim());if(!c)return null;const p=db.profiles.find(x=>x.id===c.user_id)||{};const co=(db.courses||[]).find(x=>x.id===c.course_id)||{};
      return Object.assign({},c,{avatar_url:p.avatar_url,country:p.country,color:co.color,icon:co.icon})},
    async tryExercise(){const L=db.exercises.filter(e=>e.free_try);return(L[0]||db.exercises.filter(e=>e.is_demo&&(e.kind==="grafica"||e.kind==="no-operar")).sort(by("sort"))[0])||null},
    async tryGrade(id){const t=await this.tryExercise();if(!t||t.id!==id)throw new Error("no_existe");const a=db.answers.find(x=>x.exercise_id===id)||{};return{zone:a.zone,sl:a.sl,answer:a.answer||{},explain:a.explain||""}},
    /* sala Oro (modo local) */
    _room(){db.room=db.room||[];return db.room},
    async roomFeed(since){const p=me();const pr=adm()?4:({diamond:4,oro:3,plata:2,cobre:1})[p&&p.plan]||0;if(!p||(!adm()&&!(isPrem(p)&&pr>=3)))throw new Error("El chat es exclusivo de los planes Oro y Diamond");
      return this._room().filter(m=>!since||m.created_at>since).slice(-150).map(m=>{const q=db.profiles.find(x=>x.id===m.user_id)||{};return Object.assign({},m,{username:q.username,avatar_url:q.avatar_url,country:q.country,plan:isPrem(q)?q.plan:null,affiliate:!!q.affiliate,is_admin:q.role==="admin",mine:m.user_id===p.id,reports:adm()?(m.rep||[]).length:0,muted:false})})},
    async roomSend(b,img){const p=me();b=String(b||"").trim();if(!b&&!img)throw new Error("Escribe un mensaje");if(!adm()&&/(https?:\/\/|www\.|t\.me\/)/i.test(b))throw new Error("Los enlaces no están permitidos en el chat");
      const m={id:"r"+Date.now()+Math.random().toString(36).slice(2,6),user_id:p.id,body:b,image_url:img||null,created_at:new Date().toISOString()};this._room().push(m);save();return m},
    async roomAlive(ids){return this._room().filter(m=>ids.includes(m.id)).map(m=>m.id)},
    async roomDelete(id){db.room=this._room().filter(m=>m.id!==id);save()},
    async roomReport(id){const m=this._room().find(x=>x.id===id);if(m){m.rep=m.rep||[];if(!m.rep.includes(me().id))m.rep.push(me().id);save()}},
    async roomMute(){},
    async uploadRoom(blob){return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(blob)})},
    async publicProfile(u){const p=db.profiles.find(x=>(x.username||"").toLowerCase()===String(u||"").toLowerCase());if(!p||p.banned)return null;const g=db.progress.find(x=>x.user_id===p.id)||{xp:0,data:{}};
      const L=(db.lessons||[]).filter(l=>l.status==="publicado"),done=(g.data||{}).done||{},E=(db.centries||[]).filter(e=>e.user_id===p.id);const pr=p.premium_until&&new Date(p.premium_until)>new Date();
      return{username:p.username,avatar_url:p.avatar_url,country:p.country,since:p.created_at||new Date().toISOString(),is_admin:p.role==="admin",is_me:me()&&me().id===p.id,premium:!!pr,plan:pr?(p.plan||null):null,affiliate:!!p.affiliate,
        xp:g.xp||0,lessons:L.filter(l=>done[l.id]&&done[l.id].passed).length,lessons_total:L.length,courses:[],month_points:E.reduce((a,e)=>a+(e.points||0),0),month_pos:E.some(e=>e.points)?1:null,
        points:E.reduce((a,e)=>a+(e.points||0),0),wins:E.filter(e=>e.place).length,firsts:E.filter(e=>e.place===1).length,played:E.length,streak:0,best_streak:0}},
    /* chat privado (modo local) */
    async dmSend(body,user,topic){const p=me();if(!p)throw new Error("Inicia sesión");body=String(body||"").trim();if(!body)throw new Error("Escribe un mensaje");db.dms=db.dms||{};
      const a=adm()&&user&&user!==p.id,u=a?user:p.id;let t=db.dms[u];
      if(a){if(!t)t=db.dms[u]={open:true,topic:topic||"",created_at:new Date().toISOString(),messages:[]};t.open=true;if(topic)t.topic=topic}else if(!t||!t.open)throw new Error("Esta conversación ya terminó");
      const m={id:"m"+Date.now()+Math.random().toString(36).slice(2,6),from_admin:a,body,created_at:new Date().toISOString(),read_at:null};t.messages.push(m);t.last_at=m.created_at;save();return m},
    async dmMine(){const p=me();if(!p)return null;const t=(db.dms||{})[p.id];if(!t)return{exists:false};t.messages.forEach(m=>{if(m.from_admin&&!m.read_at)m.read_at=new Date().toISOString()});save();
      return{exists:true,open:t.open,topic:t.topic,days:10,messages:t.messages.map(m=>({id:m.id,mine:!m.from_admin,body:m.body,at:m.created_at,read:!!m.read_at}))}},
    async dmBadge(){const p=me();if(!p)return null;const D=db.dms||{};if(adm())return{admin:true,unread:Object.values(D).reduce((n,t)=>n+t.messages.filter(m=>!m.from_admin&&!m.read_at).length,0)};
      const t=D[p.id];return{exists:!!t,unread:t?t.messages.filter(m=>m.from_admin&&!m.read_at).length:0}},
    async adminDmThreads(){need();return Object.entries(db.dms||{}).map(([u,t])=>{const p=db.profiles.find(x=>x.id===u)||{},l=t.messages[t.messages.length-1]||{};
      return{user_id:u,username:p.username,avatar_url:p.avatar_url,country:p.country,open:t.open,topic:t.topic,last_at:t.last_at||t.created_at,last_body:l.body,last_from_admin:l.from_admin,unread:t.messages.filter(m=>!m.from_admin&&!m.read_at).length,total:t.messages.length}})
      .sort((a,b)=>(b.unread>0)-(a.unread>0)||new Date(b.last_at)-new Date(a.last_at))},
    async adminDmThread(u){need();const t=(db.dms||{})[u],p=db.profiles.find(x=>x.id===u)||{};if(t){t.messages.forEach(m=>{if(!m.from_admin&&!m.read_at)m.read_at=new Date().toISOString()});save()}
      return{exists:!!t,open:t?t.open:true,topic:t?t.topic:"",user:{id:u,username:p.username,avatar_url:p.avatar_url,country:p.country},messages:t?t.messages.map(m=>({id:m.id,mine:m.from_admin,body:m.body,at:m.created_at,read:!!m.read_at})):[]}},
    async adminDmClose(u){need();if(db.dms)delete db.dms[u];save()},
    async adminPartnerInfo(){need();const v=Object.values(db.ptier||{});return{total:v.length,active:v.filter(x=>x==="activo").length,old:v.filter(x=>x==="antiguo").length,updated:null}},
    async adminPartnerApproveOld(){need();let n=0;(db.affiliates||[]).forEach(a=>{if(a.status==="pendiente"&&(db.ptier||{})[String(a.deriv_id).toUpperCase()]==="antiguo"){Object.assign(a,{status:"verificado",admin_note:"Autorizado por el admin (lista antigua de socios)",reviewed_at:now()});const p=db.profiles.find(x=>x.id===a.user_id);if(p)p.affiliate=true;n++}});save();return n},
    async adminChallenges(){need();return(db.challenges||[]).slice().sort((a,b)=>String(b.starts_at).localeCompare(a.starts_at))},
    async challengeKey(id){return((db.ckeys||{})[id])||null},
    async saveChallenge(c,key){need();db.challenges=db.challenges||[];const r=await up(db.challenges,c);db.ckeys=db.ckeys||{};db.ckeys[r.id]=Object.assign({challenge_id:r.id},key);save();return r},
    async delChallenge(id){need();return rm("challenges",id)},
    async adminChallengeEntries(id){need();return(db.centries||[]).filter(e=>e.challenge_id===id).map(e=>{const p=db.profiles.find(x=>x.id===e.user_id)||{};return Object.assign({},e,{username:p.username,country:p.country})})},
    async adminAffiliates(){need();return(db.affiliates||[]).map(a=>{const p=db.profiles.find(x=>x.id===a.user_id)||{},u=db.users.find(x=>x.id===a.user_id)||{};return Object.assign({},a,{username:p.username,email:u.email,country:p.country,in_list:(db.ptier||{})[String(a.deriv_id).toUpperCase()]||null})})},
    async adminMemberGet(u){need();reload();const p=db.profiles.find(x=>x.id===u)||{},a=(db.affiliates||[]).find(x=>x.user_id===u)||{};return{member:!!p.affiliate,status:a.status||null,deriv_id:a.deriv_id||null,note:a.admin_note||null}},
    async adminMemberSet(u,on,deriv,note){need();reload();const p=db.profiles.find(x=>x.id===u);if(!p)throw new Error("Ese alumno no existe");const d=(deriv||"").replace(/\s/g,"").toUpperCase()||null;
      db.affiliates=db.affiliates||[];let a=db.affiliates.find(x=>x.user_id===u);
      if(on){if(!a){a={user_id:u,deriv_id:d||"MANUAL",created_at:now()};db.affiliates.push(a)}Object.assign(a,{deriv_id:d||a.deriv_id,status:"verificado",admin_note:note||"Verificado a mano por el admin",reviewed_at:now()})}
      else if(a)Object.assign(a,{status:"rechazado",admin_note:note||"Verificación quitada por el admin",reviewed_at:now()});
      p.affiliate=!!on;save();return this.adminMemberGet(u)},
    async reviewAffiliate(u,ok,note){need();const a=(db.affiliates||[]).find(x=>x.user_id===u);if(!a)throw new Error("Esa solicitud no existe");Object.assign(a,{status:ok?"verificado":"rechazado",admin_note:note||"",reviewed_at:now()});const p=db.profiles.find(x=>x.id===u);if(p)p.affiliate=!!ok;save()},
    async myWallet(){return null},
    async requestUsdWithdrawal(){throw new Error("Los retiros solo funcionan con la base de datos real.")},
    async adminUsdWithdrawals(){need();return []},
    async adminReviewUsd(){throw new Error("Solo con la base de datos real.")},
    async adminAdjustUsd(){throw new Error("Solo con la base de datos real.")},
    async adminUsdLog(){return []},
    async adminPointsTop(){need();return []},
    async adminAdjustPoints(){throw new Error("Ajustar puntos solo funciona con la base de datos real.")},
    async adminPointsLog(){need();return []},
    async adminRedemptions(){need();return(db.redemptions||[]).map(r=>{const p=db.profiles.find(x=>x.id===r.user_id)||{},u=db.users.find(x=>x.id===r.user_id)||{};return Object.assign({},r,{username:p.username,email:u.email,affiliate:!!p.affiliate})}).sort((a,b)=>((b.status==="pendiente")-(a.status==="pendiente"))||String(b.created_at).localeCompare(a.created_at))},
    async reviewRedemption(id,paid,note){need();const r=(db.redemptions||[]).find(x=>x.id===id);if(!r||r.status!=="pendiente")throw new Error("Ese canje ya fue revisado");Object.assign(r,{status:paid?"pagado":"rechazado",admin_note:note||"",reviewed_at:now()});save()},
    async myPayments(){return(db.payments||[]).filter(x=>x.user_id===uid).sort((a,b)=>String(b.created_at).localeCompare(a.created_at))},
    async adminPayments(){need();return(db.payments||[]).map(r=>{const p=db.profiles.find(x=>x.id===r.user_id)||{};const u=db.users.find(x=>x.id===r.user_id)||{};return Object.assign({},r,{username:p.username,email:u.email,premium_until:p.premium_until})}).sort((a,b)=>((b.status==="pendiente")-(a.status==="pendiente"))||String(b.created_at).localeCompare(a.created_at))},
    async reviewPayment(id,approve,days,note){need();const r=(db.payments||[]).find(x=>x.id===id);if(!r)throw new Error("El pago no existe");if(r.status!=="pendiente")throw new Error("Este pago ya fue revisado");
      let hasta=null;if(approve&&r.course_id){db.ucourses=db.ucourses||[];if(!db.ucourses.some(x=>x.user_id===r.user_id&&x.course_id===r.course_id))db.ucourses.push({user_id:r.user_id,course_id:r.course_id,created_at:new Date().toISOString()});approve="curso"}if(approve===true){const d=days||r.days;const pp=db.profiles.find(x=>x.id===r.user_id);const np=d>=300?"oro":d>=150?"plata":"cobre";const R={oro:3,plata:2,cobre:1};if(!(pp.premium_until&&new Date(pp.premium_until)>new Date()&&(R[pp.plan]||0)>R[np]))pp.plan=np;const p=db.profiles.find(x=>x.id===r.user_id);const base=Math.max(Date.now(),p.premium_until?new Date(p.premium_until).getTime():0);hasta=new Date(base+d*864e5).toISOString();p.premium_until=hasta;r.days=d}
      Object.assign(r,{status:approve?"aprobado":"rechazado",admin_note:note||"",reviewed_at:now()});save();return{status:r.status,premium_until:hasta}},
    resetLocal(){localStorage.removeItem(KEY);localStorage.removeItem("ag_local_uid");location.reload()},
  };
}

window.AGAPI=(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY)?SupabaseAPI(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):LocalAPI();
})();
