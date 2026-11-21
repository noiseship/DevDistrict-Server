import {lessons} from './lessons.js';
const runtime = window.DEV_DISTRICT_RUNTIME;
import {createClient} from '@supabase/supabase-js';
import {authLock} from './auth-lock.js';
import {resilientFetch} from './network.js';
const $=id=>document.getElementById(id), url=runtime?.url ? new URL(runtime.url, location.origin).href : '', key=runtime?.key || '';
const say=s=>{const el=active?$('notice'):$('auth-message');el.textContent=s;el.hidden=!s;};
const stations=[{x:140,y:110,name:'Заказы',kind:'work',icon:'💻',color:'#45b9e5',desc:'Решай задачи SQL и Python. Награда зависит от ПК.'},{x:660,y:110,name:'Обучение',kind:'learn',icon:'📚',color:'#b39aff',desc:'Уроки, подсказки и факты: +35 XP, −25 монет, −10 энергии'},{x:140,y:370,name:'Отдых',kind:'rest',icon:'☕',color:'#f6b96e',desc:'+35 энергии'},{x:660,y:370,name:'Апгрейд',kind:'upgrade',icon:'🛠',color:'#53d6a1',desc:'Улучшение ПК за 150 × текущий уровень'}];
let db,me,uid,players=new Map(),channel,timer,busy=false,goal=null,active=false,refreshing=false, pollTimer, pollFailures=0, mutationVersion=0;
const visualPositions=new Map(); let predicted=null; let lastFrame=performance.now();
const canvas=$('map'),ctx=canvas.getContext('2d'),keys=new Set();
function error(e){say(e?.message||String(e));}
let latency=null, realtimeStatus='', heartbeatPending=false, nextSync=0, syncFailures=0;
function connectionStatus(label){$('status').textContent=label+(latency===null?'':` · Последний запрос ${Math.round(latency)} ms`);}
async function rpc(name,args={}){const started=performance.now();const {data,error}=await db.rpc(name,args);const elapsed=performance.now()-started;if(error)throw error;latency=elapsed;if(name!=='join_world' && name!=='leave_world') mutationVersion++;if(active)connectionStatus(realtimeStatus || '● В сети');return data;}
function update(p){p=Array.isArray(p)?p[0]:p;if(!p?.id)return;players.set(p.id,p);if(p.id===uid)me=p;render();}
function online(p){return Date.now()-Date.parse(p.last_seen)<45000;}
function render(){if(!me)return;$('stats').innerHTML=`<span>💰 <b>${me.money}</b> монет</span><span>⭐ <b>${me.xp}</b> XP</span><span>⚡ <b>${me.energy}/100</b></span><span>💻 ПК <b>${me.equipment}</b></span><span>Уровень <b>${1+Math.floor(me.xp/100)}</b></span>`;$('online').textContent=`${[...players.values()].filter(online).length}/10 онлайн`;const rank=$('rank');rank.replaceChildren();[...players.values()].sort((a,b)=>b.xp-a.xp||b.money-a.money||String(a.id ?? '').localeCompare(String(b.id ?? ''))).slice(0,10).forEach((p,i)=>{const row=document.createElement('div');row.className='rankrow';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=`${i+1}. ${p.nickname}${p.id===uid?' (вы)':''}`;b.textContent=p.xp+' XP';row.append(a,b);rank.append(row);});const s=nearest();$('task').textContent=s?`${s.icon} ${s.name}: ${s.desc}`:'Подойдите к одной из четырёх станций.';}
function nearest(){return me&&stations.find(s=>Math.hypot(s.x-me.x,s.y-me.y)<=90);}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function text(t,x,y,c='#e5edf7',size=12){ctx.fillStyle=c;ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.fillText(t,x,y);}
function plant(x,y){rect(x-7,y,14,12,'#a86d49');for(const [dx,dy] of [[-6,-8],[4,-10],[0,-17]]){ctx.fillStyle='#419e76';ctx.beginPath();ctx.ellipse(x+dx,y+dy,7,10,dx/12,0,Math.PI*2);ctx.fill();}}
function desk(x,y){rect(x-38,y+5,76,28,'#684b47');rect(x-38,y+5,76,4,'#b48767');rect(x-22,y-15,44,25,'#101724');rect(x-19,y-12,38,18,'#287e8b');rect(x-13,y+14,26,5,'#a9bec7');rect(x-10,y+40,20,18,'#354758');}
function draw(){const now=performance.now(), dt=Math.min(100,now-lastFrame);lastFrame=now;if(!active){requestAnimationFrame(draw);return;}rect(0,0,800,480,'#192b39');for(let y=0;y<480;y+=24)for(let x=0;x<800;x+=24){rect(x,y,23,23,((x+y)/24)%2?'#243b48':'#29424e');}rect(15,15,770,450,'#101f2c');rect(20,20,760,440,'#304655');for(let y=20;y<460;y+=20)rect(20,y,760,1,'#3a5060');rect(350,20,100,440,'#425869');rect(20,202,760,76,'#425869');for(const s of stations){const x=s.x,y=s.y;rect(x-112,y-83,224,166,'#101a24');rect(x-108,y-79,216,158,s.kind==='rest'?'#665048':'#283a48');rect(x-108,y-79,216,6,s.color);rect(x-108,y+72,216,7,'#182733');text(s.name.toUpperCase(),x,y-53,s.color,14);if(s.kind==='work'){desk(x-48,y-8);desk(x+48,y-8);}else if(s.kind==='learn'){for(let i=0;i<3;i++){rect(x-88+i*63,y-27,47,58,'#4c3833');for(let j=0;j<4;j++)rect(x-84+i*63+j*10,y-22,7,42,['#d9a85b','#7599bc','#65b89d','#a080ce'][j]);}rect(x-40,y+38,80,18,'#9c7259');}else if(s.kind==='rest'){rect(x-80,y-20,55,58,'#b48372');rect(x-75,y-14,45,40,'#d1a18d');rect(x+25,y-20,55,58,'#b48372');rect(x+30,y-14,45,40,'#d1a18d');ctx.fillStyle='#c79b75';ctx.beginPath();ctx.arc(x,y+10,22,0,Math.PI*2);ctx.fill();text('☕',x,y+15,'#fff',18);}else{desk(x,y-10);rect(x-90,y-20,30,62,'#19232f');rect(x+60,y-20,30,62,'#19232f');for(let i=0;i<4;i++){rect(x-83,y-14+i*13,15,5,s.color);rect(x+67,y-14+i*13,15,5,s.color);}}plant(x-90,y+49);plant(x+90,y+49);}
text('DEV DISTRICT',400,48,'#c2e8e7',12);text('IT CAMPUS',400,62,'#a2b7c4',9);
for(const p of [...players.values()].sort((a,b)=>a.y-b.y)){if(!online(p)&&p.id!==uid)continue;const target=p.id===uid&&predicted?predicted:p;let v=visualPositions.get(p.id);if(!v){v={x:p.x,y:p.y};visualPositions.set(p.id,v);}const k=1-Math.exp(-dt/65);v.x+=(target.x-v.x)*k;v.y+=(target.y-v.y)*k;const x=v.x,y=v.y;ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(x,y+14,13,5,0,0,Math.PI*2);ctx.fill();rect(x-7,y+7,6,10,'#1c2634');rect(x+1,y+7,6,10,'#1c2634');rect(x-11,y-5,22,15,p.id===uid?'#5de2b7':'#82a9ff');rect(x-8,y-19,16,14,'#edbf9a');rect(x-8,y-21,16,5,'#423438');rect(x-5,y-12,2,2,'#19232f');rect(x+3,y-12,2,2,'#19232f');ctx.font='600 11px system-ui';const w=ctx.measureText(p.nickname).width+12;rect(x-w/2,y-37,w,16,'#0c1724');text(p.nickname,x,y-25,p.id===uid?'#5de2b7':'#fff',11);}requestAnimationFrame(draw);}
async function refresh(){
 if(!active||refreshing||!navigator.onLine)return;
 refreshing=true; const version=mutationVersion;
 try {
   const {data,error}=await db.from('players').select('*');
   if(error)throw error;
   if(!active)return;
   const previous=me;
   players=new Map((data || []).filter(p=>p?.id).map(p=>[p.id,p]));
   if(busy||version!==mutationVersion) {me=previous;if(me)players.set(uid,me);}
   else me=players.get(uid)||me;
   pollFailures=0;render();
 }catch(e){pollFailures++;connectionStatus('Связь прервана · повторяем подключение');errorNotice(e);}
 finally{refreshing=false;}
}
async function pollWorld(){
 await refresh();
 if(active)pollTimer=setTimeout(pollWorld,Math.min(15000,1500*2**Math.min(pollFailures,4)));
}
function errorNotice(e){error(e);}
async function enter(session, nickname){
  const player = await rpc('join_world', {p_name: nickname});
  me = Array.isArray(player) ? player[0] : player;
  if (!me?.id) throw Error('Сервер не вернул профиль игрока.');
  uid = session.user.id;
  active = true;
  update(me);
  $('login').hidden = true;
  $('game').hidden = false;
  connectionStatus('● В сети');
  say('');
  realtimeStatus = '● Онлайн';
  void pollWorld();
  timer = setInterval(async () => {
    if (!active || heartbeatPending || Date.now() < nextSync || !navigator.onLine) return;
    heartbeatPending = true;
    try {
      await rpc('join_world', {p_name: me.nickname});
      if (!active) return;
      syncFailures = 0;

    } catch (error) {
      nextSync = Date.now() + Math.min(30000, 5000 * 2 ** Math.min(syncFailures++, 3));
      connectionStatus('Связь прервана · повторяем подключение');
      errorNotice(error);
    } finally {
      heartbeatPending = false;
    }
  }, 15000);
  canvas.focus();
}
window.addEventListener('online', () => { nextSync = 0; if (active) void refresh(); });
window.addEventListener('offline', () => { if (active) connectionStatus('Нет подключения к интернету'); });
async function move(dx,dy){if(!active||busy||!me||$('activity').open)return;busy=true;const px=Math.max(20,Math.min(780,me.x+dx)),py=Math.max(20,Math.min(460,me.y+dy));predicted={x:px,y:py};try{update(await rpc('move_player',{px,py}));}catch(e){error(e);goal=null;keys.clear();busy=false;await refresh();}finally{predicted=null;busy=false;}}
let lessonIndex=0;
const modal=$('activity'), content=$('activity-content');
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function actionButton(text,fn){const b=node('button',text);b.type='button';b.onclick=fn;return b;}
function showPanel(title){$('activity-title').textContent=title;content.replaceChildren();goal=null;keys.clear();if(!modal.open)modal.showModal();}
$('close-activity').onclick=()=>modal.close();
modal.addEventListener('close',()=>{keys.clear();canvas.focus();});
function panelError(e){content.append(node('p',e?.message||String(e),'feedback'));}
function sourceLink(url){const a=node('a','Официальная документация ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function workPanel(){showPanel('Биржа заказов');content.append(node('p',`Выбери направление. Награда: ${40*me.equipment} монет и ${20+5*(me.equipment-1)} XP. Расход: 15 энергии.`));for(const lang of ['SQL','Python'])content.append(actionButton(lang+' · Начать заказ',()=>loadJob(lang)));}
async function loadJob(lang){if(busy)return;busy=true;content.replaceChildren(node('p','Получаем заказ…'));try{const q=await rpc('request_job',{p_language:lang});if(!modal.open)return;content.replaceChildren(node('span',q.language+' / НАЧАЛЬНЫЙ УРОВЕНЬ','eyebrow'),node('h3',q.prompt),node('pre',q.code));const choices=document.createElement('div');choices.className='choices';q.choices.forEach((answer,i)=>choices.append(actionButton(answer,()=>submitJob(q,i,choices))));content.append(choices,actionButton('Подсказка',()=>{if(!content.querySelector('.hint'))content.append(node('p',q.hint,'hint'));}));}catch(e){panelError(e);content.append(actionButton('Назад',workPanel));}finally{busy=false;}}
async function submitJob(q,i,choices){if(busy)return;busy=true;try{const result=await rpc('submit_job',{p_id:q.id,p_choice:i});update(result.player);if(!modal.open)return;content.replaceChildren(node('h3',result.correct?'Заказ выполнен!':'Ответ неверный'),node('p',result.fact),node('p',result.correct?'Награда начислена.':'Награда не начислена. Попробуй ещё раз.'),sourceLink(q.source),actionButton('Следующий заказ',workPanel));}catch(e){panelError(e);}finally{busy=false;}}
function lessonPanel(){showPanel('Академия разработчика');const l=lessons[lessonIndex%lessons.length];content.append(node('span',l.language+' / УРОК '+(lessonIndex%lessons.length+1),'eyebrow'),node('pre',l.code),node('h3','Подсказка'),node('p',l.hint),node('h3','Интересный факт'),node('p',l.fact),sourceLink(l.source),node('p','Урок можно читать бесплатно. Закрепление: 25 монет, 10 энергии, +35 XP.'),actionButton('Следующий факт',()=>{lessonIndex++;lessonPanel();}),actionButton('Закрепить знания',()=>stationAction('learn')));}
function upgradePanel(){showPanel('Магазин оборудования');const e=me.equipment;content.append(node('h3','Рабочая станция · уровень '+e),node('p',`Сейчас: ${40*e} монет и ${20+5*(e-1)} XP за правильный заказ.`));if(e<10)content.append(node('p',`После апгрейда: ${40*(e+1)} монет и ${20+5*e} XP. Цена: ${150*e} монет.`),actionButton('Купить улучшение',()=>stationAction('upgrade')));else content.append(node('p','Максимальный уровень.'));}
async function stationAction(kind){if(busy||!active)return;busy=true;try{update(await rpc('game_action',{kind}));say(kind==='rest'?'Отдых: +35 энергии (до 100).':kind==='learn'?'Обучение завершено: +35 XP.':'Компьютер улучшен!');if(kind==='upgrade'&&modal.open)upgradePanel();if(kind==='learn'&&modal.open)content.append(node('p','Опыт начислен.','feedback'));}catch(e){error(e);if(modal.open)panelError(e);}finally{busy=false;}}
async function act(){if(busy||!active||modal.open)return;const s=nearest();if(!s){say('Подойдите к станции.');return;}if(s.kind==='work')workPanel();else if(s.kind==='learn')lessonPanel();else if(s.kind==='upgrade')upgradePanel();else await stationAction('rest');}
const dirs={w:[0,-1],ц:[0,-1],arrowup:[0,-1],s:[0,1],ы:[0,1],arrowdown:[0,1],a:[-1,0],ф:[-1,0],arrowleft:[-1,0],d:[1,0],в:[1,0],arrowright:[1,0]};
window.addEventListener('keydown',e=>{if(!active||$('activity').open)return;const k=e.key.toLowerCase();if(dirs[k]){e.preventDefault();keys.add(k);goal=null;}if((k==='e'||k==='у')&&!e.repeat)act();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
setInterval(()=>{if(!active||!me||busy||$('activity').open)return;let x=0,y=0;for(const k of keys){x+=dirs[k][0];y+=dirs[k][1];}if(x||y)move(Math.sign(x)*24,Math.sign(y)*24);else if(goal){const dx=goal.x-me.x,dy=goal.y-me.y;if(Math.hypot(dx,dy)<5)goal=null;else move(Math.round(Math.max(-24,Math.min(24,dx))),Math.round(Math.max(-24,Math.min(24,dy))));}},150);
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();goal={x:Math.max(20,Math.min(780,(e.clientX-r.left)*800/r.width)),y:Math.max(20,Math.min(460,(e.clientY-r.top)*480/r.height))};});document.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>{goal=null;const [x,y]=b.dataset.dir.split(',').map(Number);move(x*32,y*32);});$('act').onclick=act;
$('logout').onclick=async()=>{
 active=false;clearInterval(timer);clearTimeout(pollTimer);keys.clear();goal=null;
 try{await rpc('leave_world');}catch{}
 try{await db.auth.signOut({scope:'local'});}catch{}
 location.reload();
};
let authMode='signin';
const form=$('auth-form');
function setMode(mode){authMode=mode;const guest=mode==='guest', signup=mode==='signup';$('nick-field').hidden=!(guest||signup);$('nick').required=guest||signup;$('nick').disabled=!(guest||signup);for(const id of ['email','password']){$(id+'-field').hidden=guest;$(id).required=!guest;$(id).disabled=guest;}$('password').autocomplete=signup?'new-password':'current-password';$('auth-title').textContent=guest?'Гостевой вход':signup?'Создай аккаунт':'С возвращением';$('auth-subtitle').textContent=guest?'Выбери никнейм для игры.':signup?'Начни карьеру разработчика.':'Войди, чтобы продолжить игру.';$('auth-submit').textContent=guest?'Начать игру →':signup?'Создать аккаунт →':'Войти в игру →';$('guest-mode').textContent=guest?'Вернуться ко входу':'Играть гостем';document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));say('');}
function authBusy(value) {
  busy = value;
  document.querySelectorAll('#login button:not(#reload-page)').forEach(button => button.disabled = value);
  if (!value) {
    $('auth-submit').textContent = authMode === 'guest' ? 'Начать игру →' :
      authMode === 'signup' ? 'Создать аккаунт →' : 'Войти в игру →';
  }
}

function authError(error) {
  const message = error?.message || String(error);
  const translations = {
    'Invalid login credentials': 'Неверная почта или пароль.',
    'Email not confirmed': 'Подтвердите почту по ссылке из письма.',
    'User already registered': 'Аккаунт уже существует. Войдите.',
    'Anonymous sign-ins are disabled': 'Гостевой вход отключён в Supabase.',
  };
  if (error?.isAcquireTimeout) {
    say('Сессия занята другой вкладкой. Закройте остальные вкладки DevDistrict и повторите вход.');
  } else if (error?.name === 'AuthRetryableFetchError' || /Failed to fetch|NetworkError|Load failed|AbortError|TimeoutError|aborted|не ответил за 15 секунд/i.test(message)) {
    say('Сервер временно недоступен. Дождитесь восстановления соединения и повторите вход.');
  } else if (/^PGRST20[245]$/.test(error?.code || '') || error?.code === '42501') {
    say('База DevDistrict не готова для игры. Сообщите владельцу код ' + error.code + '.');
  } else {
    say(translations[message] || message);
  }
  $('status').textContent = 'Ошибка входа';
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('guest-mode').onclick=()=>setMode(authMode==='guest'?'signin':'guest');
$('show-password').onclick=()=>{const visible=$('password').type==='password';$('password').type=visible?'text':'password';$('show-password').textContent=visible?'Скрыть':'Показать';$('show-password').setAttribute('aria-label',visible?'Скрыть пароль':'Показать пароль');};


async function enterSession(session, fallback) {
  $('auth-submit').textContent = 'Вход в игровой мир…';
  await enter(session, session.user.user_metadata?.nickname || fallback || 'Developer');
}

async function authenticate() {
  const nickname = $('nick').value.trim();
  const email = $('email').value.trim();
  const password = $('password').value;
  if (authMode !== 'signin' && nickname.length < 3) {
    throw Error('Никнейм должен содержать минимум 3 символа.');
  }
  let result;
  if (authMode === 'guest') {
    const existing = await db.auth.getSession();
    if (existing.error) throw existing.error;
    if (existing.data.session?.user.is_anonymous) {
      await enterSession(existing.data.session, nickname);
      return;
    }
    if (existing.data.session) {
      const {error} = await db.auth.signOut({scope: 'local'});
      if (error) throw error;
    }
    result = await db.auth.signInAnonymously({options: {data: {nickname}}});
  } else if (authMode === 'signup') {
    const redirect = new URL(location.href);
    redirect.search = '';
    redirect.hash = '';
    result = await db.auth.signUp({email, password, options: {
      data: {nickname},
      emailRedirectTo: redirect.href,
    }});
  } else {
    result = await db.auth.signInWithPassword({email, password});
  }
  if (result.error) throw result.error;
  if (!result.data.session) {
    setMode('signin');
    $('status').textContent = 'Подтвердите почту';
    say('Откройте письмо, подтвердите регистрацию и войдите в игру.');
    return;
  }
  await enterSession(result.data.session, nickname);
}

async function runAuth(label, action) {
  authBusy(true);
  $('auth-submit').textContent = label;
  say('');
  // Offer a reload if the browser or SDK stalls outside the HTTP timeout.
  const watchdog = setTimeout(() => {
    $('status').textContent = 'Подключение не завершилось';
    $('auth-submit').textContent = 'Вход приостановлен';
    say('Подключение занимает слишком много времени. Обновите страницу и попробуйте снова.');
    $('reload-page').hidden = false;
  }, 25000);
  try {
    await action();
    $('reload-page').hidden = true;
  } catch (error) {
    authError(error);
  } finally {
    clearTimeout(watchdog);
    authBusy(false);
  }
}

function init() {
  setMode('signin');
  if (!runtime || new URL(url).origin !== location.origin || !key.startsWith('sb_publishable_')) {
    say('Эту версию нужно запускать через сервер DevDistrict. Откройте адрес Web Service, указанный в инструкции, или запустите npm start.');
    $('status').textContent = 'Ошибка конфигурации';
    return;
  }
  const auth = navigator.locks ? {
    lock: authLock,
  } : {};
  db = createClient(url, key, {auth, global: {fetch: resilientFetch}});
  form.onsubmit = event => {
    event.preventDefault();
    if (!busy) void runAuth('Проверяем данные входа…', authenticate);
  };
  $('status').textContent = 'Готов к входу';
  return runAuth('Проверяем сохранённую сессию…', async () => {
    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    if (data.session) await enterSession(data.session);
  });
}

document.documentElement.dataset.appStarted = 'true';
draw();
Promise.resolve().then(init).catch(error => {
  authError(error);
  $('status').textContent = 'Ошибка запуска';
  $('reload-page').hidden = false;
});
