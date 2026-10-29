/* =====================================================
   MONEY GRABBER  —  HTML + CSS + JS (online via PeerJS)
   ===================================================== */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const NAMES  = ['Azul','Verde','Amarelo','Vermelho'];
const COLORS = ['#00e5ff','#39ff88','#ffd400','#ff3d6e'];
const GAME_TIME = 45;          // segundos por partida
const VALUE = {coin:1, bill:3, bomb:-2};

/* ---------- utilitários ---------- */
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2500)}
function show(id){$$('.screen').forEach(e=>e.classList.toggle('on',e.id===id));$('#game').classList.toggle('on',id==='game');keepAwake(id==='game')}
/* mantém a tela do celular ligada durante a partida */
let wl=null;
async function keepAwake(on){try{if(on&&'wakeLock' in navigator){wl=await navigator.wakeLock.request('screen')}else if(wl){await wl.release();wl=null}}catch(e){}}
let ac;
function beep(f,d=.08,type='square',v=.05){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.value=v;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}

/* =====================================================
   MOTOR DO JOGO (roda no modo local ou no anfitrião)
   ===================================================== */
class Engine{
  constructor(n,emit){
    this.n=n; this.emit=emit; this.nextId=1; this.spawnT=0.3;
    this.s={time:GAME_TIME, scores:Array(4).fill(0), stun:Array(4).fill(0), items:[]};
  }
  tick(dt){
    const s=this.s;
    s.time-=dt;
    s.stun=s.stun.map(v=>Math.max(0,v-dt));
    s.items.forEach(i=>i.age+=dt);
    s.items=s.items.filter(i=>i.age<3.2);
    this.spawnT-=dt;
    if(this.spawnT<=0 && s.items.length<7){
      this.spawnT=0.45+Math.random()*0.5;
      const r=Math.random();
      s.items.push({
        id:this.nextId++, age:0,
        type: r<.58?'coin': r<.80?'bill':'bomb',
        x: 24+Math.random()*52, y: 34+Math.random()*32, r: Math.round(Math.random()*60-30)
      });
    }
    return s.time<=0;
  }
  grab(slot){
    const s=this.s;
    if(slot>=this.n || s.stun[slot]>0) return;
    if(!s.items.length){ s.stun[slot]=0.6; this.emit({k:'miss',slot}); return; }
    const idx=Math.floor(Math.random()*s.items.length);
    const it=s.items.splice(idx,1)[0];
    s.scores[slot]=Math.max(0,s.scores[slot]+VALUE[it.type]);
    this.emit({k:'grab',slot,id:it.id,type:it.type});
  }
  snapshot(){const s=this.s;return {time:s.time,scores:s.scores,stun:s.stun,items:s.items.map(i=>({id:i.id,type:i.type,x:i.x,y:i.y,r:i.r}))}}
}

/* =====================================================
   RENDERIZAÇÃO
   ===================================================== */
const pads=$$('.pad');
const itemEls=new Map();
let N=4, mySlot=-1, mode=null;   // mode: 'local' | 'host' | 'guest'

const BOMB_SVG='<svg viewBox="0 0 100 100"><path d="M50 10 94 86H6Z" fill="#2a0712" stroke="#ff3d6e" stroke-width="7" stroke-linejoin="round"/><path d="M50 38v22" stroke="#ff3d6e" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="73" r="5" fill="#ff3d6e"/></svg>';

function makeItem(it){
  const el=document.createElement('div');
  el.className='item '+it.type;
  el.style.left=it.x+'%'; el.style.top=it.y+'%'; el.style.setProperty('--r',it.r+'deg');
  if(it.type==='coin') el.textContent='$';
  else if(it.type==='bill') el.innerHTML='<span>$</span>';
  else el.innerHTML=BOMB_SVG;
  $('#stage').insertBefore(el,$('#flash'));
  return el;
}
function render(st){
  $('#timer').textContent=Math.max(0,Math.ceil(st.time));
  $('#bar').style.transform='scaleX('+Math.max(0,Math.min(1,st.time/GAME_TIME))+')';
  $('#hud').classList.toggle('danger',st.time<=10&&st.time>0);
  pads.forEach((p,i)=>{
    p.classList.toggle('off',i>=N);
    p.classList.toggle('stun',(st.stun[i]||0)>0);
    p.classList.toggle('me',i===mySlot);
    p.querySelector('.score').textContent=st.scores[i]??0;
  });
  if(mySlot>=0) $('#pull').classList.toggle('stun',(st.stun[mySlot]||0)>0);
  const ids=new Set(st.items.map(i=>i.id));
  for(const [id,el] of itemEls) if(!ids.has(id)){el.remove();itemEls.delete(id)}
  for(const it of st.items) if(!itemEls.has(it.id)) itemEls.set(it.id,makeItem(it));
}
function clearItems(){itemEls.forEach(e=>e.remove());itemEls.clear()}

function handleEvent(ev){
  const pad=pads[ev.slot];
  if(ev.k==='grab'){
    const el=itemEls.get(ev.id);
    if(el){
      itemEls.delete(ev.id);
      const a=el.getBoundingClientRect(), b=pad.getBoundingClientRect();
      const dx=(b.left+b.width/2)-(a.left+a.width/2), dy=(b.top+b.height/2)-(a.top+a.height/2);
      el.style.animation='none';
      el.getBoundingClientRect();
      el.classList.add('fly');
      el.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(0deg) scale(.25)`;
      el.style.opacity='0';
      setTimeout(()=>el.remove(),420);
    }
    pad.classList.remove('pop');void pad.offsetWidth;pad.classList.add('pop');
    if(ev.type==='bomb'){
      const f=$('#flash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on');
      beep(110,.25,'sawtooth',.08);
    }else if(mode==='local'||ev.slot===mySlot){
      beep(ev.type==='bill'?880:660,.09);
    }
  }else if(ev.k==='miss'){
    pad.classList.remove('shake');void pad.offsetWidth;pad.classList.add('shake');
    if(mode==='local'||ev.slot===mySlot) beep(160,.12,'triangle');
  }
}

/* =====================================================
   CONTROLE DA PARTIDA
   ===================================================== */
let engine=null, loop=null, tickN=0, counting=false;

function setupGameUI(n,names){
  N=n; clearItems();
  pads.forEach((p,i)=>{
    p.querySelector('.tag').textContent = names ? ((names[i]||'—') + (i===mySlot?' ★':'')) : 'P'+(i+1);
  });
  render({time:GAME_TIME,scores:[0,0,0,0],stun:[0,0,0,0],items:[]});
  $('#tip').textContent = (mode==='local')
    ? 'Toque no PUXAR do seu painel (no PC: Q · P · Z · M)'
    : 'Toque no botão PUXAR, ou em qualquer lugar da tela (PC: ESPAÇO)';
  const online=(mode==='host'||mode==='guest');
  $('#game').classList.toggle('online',online);
  $('#stage').style.setProperty('--n',n);
  $('#pull').style.setProperty('--c',COLORS[Math.max(0,mySlot)]);
  show('game');
}
function countdown(cb){
  counting=true;$('#tip').classList.add('on');
  const c=$('#count');let n=3;c.classList.add('on');c.textContent=n;beep(500,.1);
  const iv=setInterval(()=>{
    n--;
    if(n>0){c.textContent=n;beep(500,.1)}
    else{clearInterval(iv);c.textContent='JÁ!';beep(900,.25);setTimeout(()=>{c.classList.remove('on');$('#tip').classList.remove('on');counting=false;cb&&cb()},450)}
  },1000);
}
function stopLoop(){clearInterval(loop);loop=null;engine=null}

function startEngine(onEnd){
  const dt=0.033;
  tickN=0;
  loop=setInterval(()=>{
    if(!engine) return;
    const ended=engine.tick(dt);
    const snap=engine.snapshot();
    render(snap);
    if(mode==='host'&&(++tickN%3===0)) broadcast({t:'state',s:snap});
    if(ended){const sc=engine.s.scores.slice(0,N);stopLoop();onEnd(sc)}
  },33);
}

/* ---------- modo local ---------- */
let lastLocalN=2;
function startLocal(n){
  lastLocalN=n; mode='local'; mySlot=-1;
  setupGameUI(n,null);
  countdown(()=>{
    engine=new Engine(n,handleEvent);
    startEngine(sc=>showResult(sc,null));
  });
}

/* ---------- resultado ---------- */
let lastNames=null;
function showResult(scores,names){
  lastNames=names;
  const order=scores.map((v,i)=>({i,v})).sort((a,b)=>b.v-a.v);
  const top=order[0].v, winners=order.filter(o=>o.v===top);
  $('#winner').textContent = winners.length>1 ? 'Empate!' : (names?names[winners[0].i]:NAMES[winners[0].i])+' venceu!';
  $('#rank').innerHTML=order.map((o,k)=>`<div><span>${k+1}º</span><i style="width:14px;height:14px;border-radius:50%;background:${COLORS[o.i]};box-shadow:0 0 10px ${COLORS[o.i]}"></i><span>${names?names[o.i]:NAMES[o.i]}</span><b>${o.v}</b></div>`).join('');
  $('#bAgain').textContent = mode==='guest' ? 'Aguardando anfitrião…' : (mode==='host'?'Voltar para a sala':'Jogar de novo');
  $('#bAgain').disabled = mode==='guest';
  show('result');
  beep(523,.12);setTimeout(()=>beep(659,.12),130);setTimeout(()=>beep(784,.25),260);
}

/* =====================================================
   ONLINE (PeerJS — salas por código, sem servidor próprio)
   ===================================================== */
let peer=null, conns=[], players=[], hostConn=null, roomCode='', playing=false;
const PREFIX='moneygrabber-';
/* Servidores ICE: STUN ajuda a conectar PC <-> celular (redes diferentes).
   O TURN abaixo é um relay público gratuito, bom para testes; se algumas conexões falharem
   (ex.: 4G/CGNAT, redes corporativas), troque por um TURN seu. */
const PEER_OPTS={debug:0,config:{iceServers:[
  {urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},{urls:'stun:global.stun.twilio.com:3478'},
  {urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}
]}};
function randCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ';let s='';for(let i=0;i<4;i++)s+=a[Math.floor(Math.random()*a.length)];return s}
function nick(){const n=($('#nick').value.trim()||'Jogador').slice(0,10);try{localStorage.setItem('mg_nick',n)}catch(e){}return n}
function broadcast(m){conns.forEach(c=>{try{c.open&&c.send(m)}catch(e){}})}

function closeOnline(){
  stopLoop(); playing=false;
  try{peer&&peer.destroy()}catch(e){}
  peer=null;conns=[];players=[];hostConn=null;roomCode='';mode=null;mySlot=-1;
}

/* --- anfitrião --- */
function createRoom(){
  if(typeof Peer==='undefined'){toast('Não foi possível carregar o PeerJS. Verifique sua internet.');return}
  closeOnline(); mode='host'; mySlot=0;
  const name=nick();
  const attempt=()=>{
    roomCode=randCode();
    peer=new Peer(PREFIX+roomCode,PEER_OPTS);
    peer.on('open',()=>{
      players=[{name,conn:null}];
      renderLobby(); show('lobby');
    });
    peer.on('error',e=>{
      if(e.type==='unavailable-id'){try{peer.destroy()}catch(_){};attempt()}
      else{toast('Erro de conexão: '+e.type);closeOnline();show('onlineMenu')}
    });
    peer.on('connection',onGuest);
  };
  attempt();
}
function onGuest(c){
  c.on('data',m=>{
    if(m.t==='join'){
      if(playing||players.length>=4){c.send({t:'full'});setTimeout(()=>c.close(),300);return}
      players.push({name:(m.name||'Jogador').slice(0,10),conn:c});
      conns.push(c);
      sendLobby();
    }else if(m.t==='grab'){
      const slot=players.findIndex(p=>p.conn===c);
      if(engine&&slot>=0&&!counting){engine.grab(slot);broadcast({t:'state',s:engine.snapshot()})}
    }
  });
  c.on('close',()=>{
    conns=conns.filter(x=>x!==c);
    if(!playing){players=players.filter(p=>p.conn!==c);sendLobby()}
    else toast('Um jogador saiu da partida');
  });
}
function sendLobby(){
  const names=players.map(p=>p.name);
  players.forEach((p,i)=>{if(p.conn&&p.conn.open)p.conn.send({t:'lobby',names,you:i,code:roomCode})});
  renderLobby();
}
function renderLobby(){
  $('#roomCode').textContent=roomCode;
  const names=players.map(p=>p.name);
  $('#plist').innerHTML=[0,1,2,3].map(i=>names[i]
    ?`<div class="pl"><i style="background:${COLORS[i]}"></i>${names[i].replace(/</g,'&lt;')}${i===mySlot?' (você)':''}${i===0?' ★':''}</div>`
    :`<div class="pl empty"><i style="background:${COLORS[i]};opacity:.4"></i>Aguardando jogador…</div>`).join('');
  const host=mode==='host';
  $('#bStart').style.display=host?'':'none';
  $('#bStart').disabled=players.length<2;
  $('#lobbyMsg').textContent=host
    ?(players.length<2?'Passe o código ou o link para seus amigos — vale PC, celular ou tablet (2 a 4 jogadores).':'Tudo pronto! Inicie quando quiser.')
    :'Aguardando o anfitrião iniciar…';
}
function hostStart(){
  if(players.length<2) return;
  playing=true; N=players.length;
  const names=players.map(p=>p.name);
  broadcast({t:'start',n:N,names});
  setupGameUI(N,names);
  countdown(()=>{
    engine=new Engine(N,ev=>{handleEvent(ev);broadcast({t:'ev',ev})});
    startEngine(sc=>{
      broadcast({t:'end',scores:sc,names});
      showResult(sc,names);
    });
  });
}

/* --- convidado --- */
function joinRoom(){
  const code=$('#roomIn').value.trim().toUpperCase();
  if(code.length!==4){toast('Digite o código de 4 letras da sala.');return}
  if(typeof Peer==='undefined'){toast('Não foi possível carregar o PeerJS. Verifique sua internet.');return}
  closeOnline(); mode='guest'; roomCode=code;
  const name=nick();
  let ok=false;
  peer=new Peer(undefined,PEER_OPTS);
  const fail=msg=>{if(ok)return;toast(msg);closeOnline();show('onlineMenu')};
  const to=setTimeout(()=>fail('Tempo esgotado. Sala não encontrada.'),12000);
  peer.on('error',e=>{clearTimeout(to);fail(e.type==='peer-unavailable'?'Sala não encontrada.':'Erro de conexão: '+e.type)});
  peer.on('open',()=>{
    hostConn=peer.connect(PREFIX+code,{reliable:true});
    hostConn.on('open',()=>hostConn.send({t:'join',name}));
    hostConn.on('data',onHostMsg);
    hostConn.on('close',()=>{
      if(mode==='guest'){toast('A sala foi encerrada.');closeOnline();show('menu')}
    });
    hostConn.on('open',()=>{ok=true;clearTimeout(to)});
  });
}
function onHostMsg(m){
  if(m.t==='full'){toast('Sala cheia ou partida em andamento.');closeOnline();show('onlineMenu')}
  else if(m.t==='lobby'){
    mySlot=m.you;roomCode=m.code;
    players=m.names.map(n=>({name:n}));
    renderLobby();
    if(!$('#lobby').classList.contains('on')&&!playing) show('lobby');
    if(playing&&$('#result').classList.contains('on')){playing=false;show('lobby')}
  }
  else if(m.t==='start'){
    playing=true;N=m.n;setupGameUI(N,m.names);countdown();
  }
  else if(m.t==='state'){ if(playing&&$('#game').classList.contains('on')) render(m.s) }
  else if(m.t==='ev'){ if(playing) handleEvent(m.ev) }
  else if(m.t==='end'){ playing=false;render({time:0,scores:m.scores,stun:[0,0,0,0],items:[]});clearItems();showResult(m.scores,m.names) }
}

/* =====================================================
   EVENTOS DE INTERFACE
   ===================================================== */
$('#bLocal').onclick=()=>show('localSel');
$('#bOnline').onclick=()=>show('onlineMenu');
$$('[data-back]').forEach(b=>b.onclick=()=>show('menu'));
$$('#localSel [data-n]').forEach(b=>b.onclick=()=>startLocal(+b.dataset.n));
$('#bCreate').onclick=createRoom;
$('#bJoin').onclick=joinRoom;
$('#roomIn').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,''));
$('#bStart').onclick=hostStart;
function roomLink(){return location.href.split('#')[0].split('?')[0]+'?sala='+roomCode}
$('#bShare').onclick=async()=>{
  const url=roomLink();
  if(navigator.share){try{await navigator.share({title:'Money Grabber',text:'Entre na minha sala! Código: '+roomCode,url});return}catch(e){if(e&&e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url);toast('Link copiado!')}catch(e){toast(url)}
};
$('#bLeave').onclick=()=>{closeOnline();show('menu')};
$('#bCopy').onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);toast('Código copiado!')}catch(e){toast('Código: '+roomCode)}};
$('#bMenu').onclick=()=>{closeOnline();show('menu')};
$('#bAgain').onclick=()=>{
  if(mode==='local') startLocal(lastLocalN);
  else if(mode==='host'){playing=false;sendLobby();show('lobby')}
};
$('#quit').onclick=e=>{
  e.stopPropagation();
  stopLoop();$('#count').classList.remove('on');counting=false;
  closeOnline();show('menu');
};

/* toques: local = cada canto; online = toque em qualquer lugar da tela */
function press(slot){
  if(counting) return;
  if(mode==='local'&&engine) engine.grab(slot);
}
pads.forEach((p,i)=>{
  p.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(mode==='local') press(i);
    else onlineTap();
  });
});
function onlineTap(){
  if(counting||!playing) return;
  const pb=$('#pull');pb.classList.remove('press');void pb.offsetWidth;pb.classList.add('press');
  if(mode==='host'&&engine){engine.grab(0);broadcast({t:'state',s:engine.snapshot()})}
  else if(mode==='guest'&&hostConn&&hostConn.open) hostConn.send({t:'grab'});
}
$('#pull').addEventListener('pointerdown',e=>{
  e.preventDefault();e.stopPropagation();
  if(mode==='host'||mode==='guest') onlineTap();
});
$('#game').addEventListener('pointerdown',e=>{
  if(e.target.closest('.pad')||e.target.closest('#quit')||e.target.closest('#pull')) return;
  if(mode==='host'||mode==='guest') onlineTap();
});

/* teclado (opcional, para testar no PC): Q W / A S ... */
const KEYS={q:0,p:1,z:2,m:3};
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(mode==='local'&&k in KEYS) press(KEYS[k]);
  else if((mode==='host'||mode==='guest')&&(k===' '||k==='enter')) onlineTap();
});
document.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- inicialização ---------- */
try{const n=localStorage.getItem('mg_nick');if(n)$('#nick').value=n}catch(e){}
(function(){
  const q=new URLSearchParams(location.search).get('sala');
  if(q&&/^[A-Za-z]{4}$/.test(q)){
    $('#roomIn').value=q.toUpperCase();
    show('onlineMenu');
    setTimeout(()=>toast('Digite seu nome e toque em "Entrar na sala"'),300);
  }
})();
