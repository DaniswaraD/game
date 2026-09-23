(function(){
'use strict';

var db=null;
var MAX_PLAYERS=6;
var CHAT_MAX_STORE=80;
var CHAT_MAX_SHOW=60;
var KF_MAX_ITEMS=5;
var KF_LIFE=4000;

var mp={
  roomCode:null,
  myId:null,
  hostId:null,
  isHost:false,
  playersCache:{},
  roomRef:null,
  playerRef:null,
  chatRef:null,
  emojiRef:null,
  kfRef:null,
  pollInterval:null,
  gameUpdateTimer:0,
  selectedMode:1,
  startRequested:false,
  finalSent:false,
  gameEnded:false,
  lobbyX:0.5,
  lobbyDragging:false,
  miniTimers:{},
  inGameDead:false,
  reviveCountdown:0,
  lastWrittenKp:null,
  sendModalOpen:false,
  pfCtx:null,
  pfCanvas:null,
  pfAnim:null,
  pfLastW:0,
  pfLastH:0,
  pfLastDPR:0,
  seenEmojis:{},
  seenKf:{},
  chatItems:[],
  chatLoaded:false,
  chatCounter:0,
  kfItems:[]
};

var MP_MODES=[
  {id:1,label:'MUDAH',level:1},
  {id:2,label:'SEDANG',level:2},
  {id:3,label:'SULIT',level:3},
  {id:4,label:'AHLI',level:4},
  {id:5,label:'NIGHTMARE',level:5},
  {id:6,label:'IMPOSSIBLE',level:6}
];

function DS(){return window.DS;}
function MPApi(){return window.DS_MP;}
function PC(){return MPApi().playersCache;}

function initFirebase(){
  try{
    if(typeof firebase==='undefined')return false;
    var cfg=window.FIREBASE_CONFIG||{};
    if(!cfg.databaseURL)return false;
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    db=firebase.database();
    return true;
  }catch(e){return false;}
}

function genRoomCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s='';
  for(var i=0;i<6;i++)s+=chars[(Math.random()*chars.length)|0];
  return s;
}

function genPlayerId(){
  return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
}

function esc(s){
  return String(s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function fmtK(n){
  if(n===undefined||n===null)return '0';
  n=Number(n)||0;
  if(n>=1e12)return (n/1e12).toFixed(1)+'T';
  if(n>=1e9)return (n/1e9).toFixed(1)+'B';
  if(n>=1e6)return (n/1e6).toFixed(1)+'M';
  if(n>=1e3)return (n/1e3).toFixed(1)+'K';
  return String(n);
}

function clamp(v,a,b){return v<a?a:(v>b?b:v);}

function createGroup(){
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Nama minimal 3 karakter','error');return;}
  if(name.length>10){DS().showToast('Nama maksimal 10 karakter','error');return;}
  if(!db){DS().showToast('Database belum siap','error');return;}
  DS().save.playerName=name;DS().persist();
  var code=genRoomCode();
  var myId=genPlayerId();
  mp.myId=myId;
  mp.isHost=true;
  mp.roomCode=code;
  mp.selectedMode=1;
  mp.lastWrittenKp=null;
  mp.lobbyX=0.5;
  mp.gameEnded=false;
  var ref=db.ref('rooms/'+code);
  ref.once('value',function(snap){
    if(snap.exists()){createGroup();return;}
    var me={
      id:myId,
      name:name,
      ship:DS().save.selectedShip,
      shape:DS().save.selectedShape,
      gun:DS().save.selectedGun,
      skill:DS().save.selectedSkill||'',
      alive:true,
      kills:0,
      kp:DS().save.kills,
      level:DS().save.level,
      xp:DS().save.xp,
      joinedAt:Date.now(),
      lastSeen:Date.now(),
      lobbyX:0.5,
      posX:0.5,
      posHp:1
    };
    var data={
      code:code,
      hostId:myId,
      state:'lobby',
      mode:1,
      createdAt:Date.now(),
      startAt:0,
      players:{}
    };
    data.players[myId]=me;
    ref.set(data,function(err){
      if(err){DS().showToast('Gagal buat grup','error');return;}
      mp.hostId=myId;
      attachListeners(code,myId,true);
      DS().showScreen('mpLobby');
      document.getElementById('mpRoomCode').textContent=code;
      renderLobby();
      DS().sfxMP();
    });
  });
}

function joinGroup(){
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Nama minimal 3 karakter','error');return;}
  if(name.length>10){DS().showToast('Nama maksimal 10 karakter','error');return;}
  var code=(document.getElementById('mpCodeInput').value||'').trim().toUpperCase();
  if(code.length!==6){DS().showToast('Kode grup harus 6 karakter','error');return;}
  if(!db){DS().showToast('Database belum siap','error');return;}
  DS().save.playerName=name;DS().persist();
  var ref=db.ref('rooms/'+code);
  ref.once('value',function(snap){
    if(!snap.exists()){DS().showToast('Grup tidak ditemukan','error');return;}
    var data=snap.val();
    if(data.state&&data.state!=='lobby'){DS().showToast('Grup sudah mulai bermain','error');return;}
    var players=data.players||{};
    var names=[];
    var cnt=0;
    for(var k in players){names.push((players[k].name||'').toUpperCase());cnt++;}
    if(names.indexOf(name)>=0){DS().showToast('Nama sudah dipakai','error');return;}
    if(cnt>=MAX_PLAYERS){DS().showToast('Grup sudah penuh','error');return;}
    var myId=genPlayerId();
    mp.myId=myId;
    mp.isHost=false;
    mp.hostId=data.hostId||null;
    mp.roomCode=code;
    mp.selectedMode=data.mode||1;
    mp.lastWrittenKp=null;
    mp.lobbyX=0.5;
    mp.gameEnded=false;
    var me={
      id:myId,
      name:name,
      ship:DS().save.selectedShip,
      shape:DS().save.selectedShape,
      gun:DS().save.selectedGun,
      skill:DS().save.selectedSkill||'',
      alive:true,
      kills:0,
      kp:DS().save.kills,
      level:DS().save.level,
      xp:DS().save.xp,
      joinedAt:Date.now(),
      lastSeen:Date.now(),
      lobbyX:0.5,
      posX:0.5,
      posHp:1
    };
    ref.child('players/'+myId).set(me,function(err){
      if(err){DS().showToast('Gagal masuk grup','error');return;}
      attachListeners(code,myId,false);
      DS().showScreen('mpLobby');
      document.getElementById('mpRoomCode').textContent=code;
      renderLobby();
      DS().sfxMP();
    });
  });
}

function attachListeners(code,myId,isHost){
  mp.roomCode=code;
  mp.myId=myId;
  mp.isHost=isHost;
  MPApi().myId=myId;
  MPApi().isHost=isHost;
  detachAll();
  mp.roomRef=db.ref('rooms/'+code);
  mp.playerRef=db.ref('rooms/'+code+'/players/'+myId);
  MPApi().roomRef=mp.roomRef;
  MPApi().playerRef=mp.playerRef;
  mp.playerRef.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
  mp.playerRef.onDisconnect().remove();
  mp.roomRef.on('value',function(snap){
    var data=snap.val();
    if(!data){
      DS().showToast('Grup dibubarkan','error');
      leaveGroup();
      return;
    }
    var players=data.players||{};
    MPApi().playersCache=players;
    mp.hostId=data.hostId||null;
    if(data.mode!==undefined)mp.selectedMode=data.mode;
    if(!players[myId]){
      DS().showToast('Kamu dikeluarkan dari grup','error');
      leaveGroup();
      return;
    }
    var myData=players[myId];
    if(myData.kp!==undefined&&myData.kp!==mp.lastWrittenKp){
      DS().save.kills=myData.kp;
      mp.lastWrittenKp=myData.kp;
      DS().refreshHeaderKills();
      DS().refreshProfile();
      DS().updateMenuCard();
    }
    if(myData.level!==undefined&&myData.level!==DS().save.level){
      DS().save.level=myData.level;
    }
    if(myData.xp!==undefined&&myData.xp!==DS().save.xp){
      DS().save.xp=myData.xp;
      DS().updateMPLevelBadge();
      DS().updateMenuCard();
    }
    var st=DS().getAppState();
    if(data.state==='playing'&&st!=='playingMP'){
      if(!mp.startRequested){
        mp.startRequested=true;
        startGame();
      }
    }
    if(data.state==='ended'&&st==='playingMP'){
      if(!mp.finalSent){
        mp.finalSent=true;
        onRoomEnded();
      }
    }
    if(st==='mpLobbyMenu')renderLobby();
    if(st==='playingMP')updateTopStats();
  });
  mp.emojiRef=mp.roomRef.child('lastEmoji');
  mp.emojiRef.on('value',function(snap){
    var d=snap.val();
    if(d)handleRemoteEmoji(d);
  });
  mp.kfRef=mp.roomRef.child('killfeed');
  mp.kfRef.on('value',function(snap){
    var d=snap.val();
    if(d)handleRemoteKillFeed(d);
  });
  mp.chatRef=mp.roomRef.child('chat');
  mp.chatRef.limitToLast(CHAT_MAX_STORE).on('child_added',function(snap){
    var d=snap.val();
    if(!d)return;
    var key=snap.key;
    if(mp.seenEmojis['c_'+key])return;
    mp.seenEmojis['c_'+key]=true;
    addChatItem(d);
  });
  mp.pollInterval=setInterval(function(){
    if(mp.playerRef)mp.playerRef.child('lastSeen').set(Date.now());
  },5000);
}

function detachAll(){
  if(mp.pollInterval){clearInterval(mp.pollInterval);mp.pollInterval=null;}
  if(mp.roomRef){try{mp.roomRef.off();}catch(e){}mp.roomRef=null;}
  if(mp.emojiRef){try{mp.emojiRef.off();}catch(e){}mp.emojiRef=null;}
  if(mp.kfRef){try{mp.kfRef.off();}catch(e){}mp.kfRef=null;}
  if(mp.chatRef){try{mp.chatRef.off();}catch(e){}mp.chatRef=null;}
}

function leaveGroup(){
  if(mp.roomRef&&mp.myId&&mp.roomCode){
    try{db.ref('rooms/'+mp.roomCode+'/players/'+mp.myId).remove();}catch(e){}
  }
  detachAll();
  mp.roomCode=null;
  mp.myId=null;
  mp.hostId=null;
  mp.isHost=false;
  MPApi().playersCache={};
  mp.startRequested=false;
  mp.finalSent=false;
  mp.gameEnded=false;
  mp.selectedMode=1;
  mp.lastWrittenKp=null;
  mp.miniTimers={};
  mp.inGameDead=false;
  mp.reviveCountdown=0;
  mp.chatItems=[];
  mp.chatLoaded=false;
  mp.chatCounter=0;
  mp.kfItems=[];
  mp.seenEmojis={};
  mp.seenKf={};
  MPApi().active=false;
  MPApi().dead=false;
  MPApi().myId=null;
  MPApi().roomRef=null;
  MPApi().playerRef=null;
  MPApi().isHost=false;
  var mr=document.getElementById('mpMiniRow');
  if(mr){mr.innerHTML='';mr.removeAttribute('data-ids');}
  var mpl=document.getElementById('mpPlayers');
  if(mpl)mpl.innerHTML='';
  var em=document.getElementById('mpEmojiLayer');
  if(em)em.innerHTML='';
  var cel=document.getElementById('mpCelebration');
  if(cel)cel.classList.remove('on');
  var spb=document.getElementById('mpSendPointsBtn');
  if(spb)spb.classList.remove('on');
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.remove('on');
  var sm=document.getElementById('mpSendPointsModal');
  if(sm)sm.classList.remove('on');
  var cl=document.getElementById('mpChatList');
  if(cl)cl.innerHTML='<div class="mp-chat-empty">Belum ada pesan</div>';
  var cc=document.getElementById('mpChatCount');
  if(cc)cc.textContent='0';
  var kf=document.getElementById('killFeed');
  if(kf){kf.innerHTML='';kf.classList.remove('on');}
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.remove('on');
}

function renderLobby(){
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var hostId=mp.hostId;
  var host=null,members=[];
  for(var i=0;i<players.length;i++){
    if(players[i].id===hostId)host=players[i];
    else members.push(players[i]);
  }
  var ordered=[];
  if(host)ordered.push(host);
  for(var j=0;j<members.length;j++){
    if(j%2===0)ordered.unshift(members[j]);
    else ordered.push(members[j]);
  }
  var html='';
  for(var p=0;p<ordered.length;p++){
    var pl=ordered[p];
    var cls='mp-player';
    if(pl.id===hostId)cls+=' host';
    if(pl.id===mp.myId)cls+=' me';
    if(pl.alive===false)cls+=' dead';
    html+='<div class="'+cls+'" data-pid="'+pl.id+'">';
    if(mp.isHost&&pl.id!==mp.myId){
      html+='<button class="mp-kick-btn" data-kick="'+pl.id+'">X</button>';
    }
    html+='<canvas width="140" height="140"></canvas>';
    html+='<div class="mp-name">'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<div class="mp-role '+(pl.id===hostId?'host':'')+'">'+(pl.id===hostId?'HOST':'PLAYER')+'</div>';
    html+='<div class="mp-kills">KP <b>'+fmtK(pl.kp||0)+'</b></div>';
    html+='</div>';
  }
  var el=document.getElementById('mpPlayers');
  if(el)el.innerHTML=html;
  var canvases=el?el.querySelectorAll('canvas'):[];
  for(var c=0;c<canvases.length;c++){
    var card=canvases[c].parentNode;
    var pid=card.getAttribute('data-pid');
    var pl2=PC()[pid];
    if(pl2)drawCardShip(canvases[c],pl2);
  }
  var wait=document.getElementById('mpWaiting');
  if(wait){
    var total=ordered.length;
    if(total<2)wait.textContent='Menunggu pemain... ('+total+'/'+MAX_PLAYERS+') - Butuh minimal 2';
    else wait.textContent=total+' / '+MAX_PLAYERS+' pemain di grup';
  }
  var startBtn=document.getElementById('mpStartBtn');
  if(startBtn){
    var canStart=mp.isHost&&ordered.length>=2&&ordered.length<=MAX_PLAYERS;
    startBtn.disabled=!canStart;
    startBtn.textContent=mp.isHost?'START':'MENUNGGU HOST';
  }
  var mt=document.getElementById('mpModeTitle');
  if(mt)mt.textContent=mp.isHost?'PILIH MODE (HOST)':'MODE DIPILIH HOST';
  renderModeGrid();
  renderChat();
}

function renderModeGrid(){
  var grid=document.getElementById('mpModeGrid');
  if(!grid)return;
  var html='';
  for(var i=0;i<MP_MODES.length;i++){
    var m=MP_MODES[i];
    var on=m.id===mp.selectedMode?' on':'';
    var lk=!mp.isHost?' locked':'';
    html+='<button class="mp-mode-btn'+on+lk+'" data-mode="'+m.id+'"'+(mp.isHost?'':' disabled')+'>'+m.label+'</button>';
  }
  grid.innerHTML=html;
}

function drawCardShip(cv,pl){
  var ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  var ship=DS().findShip(pl.ship||'default');
  var shape=DS().findShape(pl.shape||'square');
  DS().drawShipCentered(ctx,ship,shape,cv.width,cv.height,{
    glow:true,
    glowAlpha:0.55,
    zoom:0.92,
    offsetY:0,
    alpha:pl.alive===false?0.4:1
  });
}

function initPlayfield(){
  var cv=document.getElementById('mpPlayfieldCanvas');
  if(!cv)return;
  mp.pfCanvas=cv;
  mp.pfCtx=cv.getContext('2d');
  mp.pfLastW=0;
  mp.pfLastH=0;
  mp.pfLastDPR=0;
  cv.addEventListener('touchstart',pfTouchStart,{passive:false});
  cv.addEventListener('touchmove',pfTouchMove,{passive:false});
  cv.addEventListener('touchend',function(){mp.lobbyDragging=false;});
  cv.addEventListener('touchcancel',function(){mp.lobbyDragging=false;});
  cv.addEventListener('mousedown',pfMouseDown);
  window.addEventListener('mousemove',pfMouseMove);
  window.addEventListener('mouseup',function(){mp.lobbyDragging=false;});
  if(!mp.pfAnim)mp.pfAnim=requestAnimationFrame(pfLoop);
}

function pfTouchStart(ev){
  ev.preventDefault();
  mp.lobbyDragging=true;
  pfUpdateFromX(ev.touches[0].clientX);
}

function pfTouchMove(ev){
  if(!mp.lobbyDragging)return;
  ev.preventDefault();
  pfUpdateFromX(ev.touches[0].clientX);
}

function pfMouseDown(ev){
  mp.lobbyDragging=true;
  pfUpdateFromX(ev.clientX);
}

function pfMouseMove(ev){
  if(!mp.lobbyDragging)return;
  pfUpdateFromX(ev.clientX);
}

function pfUpdateFromX(clientX){
  var cv=mp.pfCanvas;
  if(!cv)return;
  var rect=cv.getBoundingClientRect();
  if(rect.width<=0)return;
  var rel=(clientX-rect.left)/rect.width;
  mp.lobbyX=clamp(rel,0.05,0.95);
  if(mp.playerRef)mp.playerRef.child('lobbyX').set(mp.lobbyX);
}

function pfLoop(){
  mp.pfAnim=requestAnimationFrame(pfLoop);
  var cv=mp.pfCanvas,ctx=mp.pfCtx;
  if(!cv||!ctx)return;
  if(DS().getAppState()!=='mpLobbyMenu')return;
  var dpr=window.devicePixelRatio||1;
  var cw=cv.clientWidth;
  var ch=cv.clientHeight;
  if(cw<=0||ch<=0)return;
  var tw=Math.round(cw*dpr);
  var th=Math.round(ch*dpr);
  if(cv.width!==tw||cv.height!==th||mp.pfLastW!==cw||mp.pfLastH!==ch||mp.pfLastDPR!==dpr){
    cv.width=tw;
    cv.height=th;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    mp.pfLastW=cw;
    mp.pfLastH=ch;
    mp.pfLastDPR=dpr;
  }
  ctx.clearRect(0,0,cw,ch);
  var now=performance.now();
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var sz=Math.min(cw*0.20,ch*0.55);
  if(sz<34)sz=34;
  if(sz>74)sz=74;
  for(var i=0;i<players.length;i++){
    var pl=players[i];
    var x=(pl.lobbyX!==undefined&&pl.lobbyX!==null)?pl.lobbyX:0.5;
    if(pl.id===mp.myId)x=mp.lobbyX;
    var cx=x*cw;
    if(cx<sz*0.55)cx=sz*0.55;
    if(cx>cw-sz*0.55)cx=cw-sz*0.55;
    var cy=ch*0.52;
    var bob=Math.sin(now*0.003+i*1.3)*4;
    var isMe=pl.id===mp.myId;
    var alpha=pl.alive===false?0.35:1;
    if(isMe){
      ctx.save();
      ctx.strokeStyle='rgba(255,200,87,0.9)';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(cx,cy+bob,sz*0.78,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
    var ship=DS().findShip(pl.ship||'default');
    var shape=DS().findShape(pl.shape||'square');
    var key=ship.id+'_'+shape.id;
    var cache=DS().playerSpriteCache();
    var set=cache[key]||cache[ship.id+'_square']||cache['default_square'];
    if(!set)continue;
    var spr=set.normal.canvas;
    var scale=sz/spr.width;
    var dw=spr.width*scale,dh=spr.height*scale;
    var glow=DS().playerGlowCache()[ship.id];
    if(glow){
      ctx.save();
      ctx.globalAlpha=alpha*0.55;
      var gs=sz*1.5;
      ctx.drawImage(glow.normal.canvas,cx-gs/2,cy+bob-gs/2,gs,gs);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.drawImage(spr,cx-dw/2,cy+bob-dh/2,dw,dh);
    ctx.restore();
    ctx.save();
    ctx.font='bold 11px Fredoka,sans-serif';
    ctx.textAlign='center';
    ctx.lineWidth=3.5;
    ctx.strokeStyle='rgba(36,36,56,0.9)';
    ctx.fillStyle=isMe?'#ffc857':'#ffffff';
    var label=(pl.name||'-').toUpperCase();
    ctx.strokeText(label,cx,cy+bob+dh/2+16);
    ctx.fillText(label,cx,cy+bob+dh/2+16);
    ctx.restore();
  }
}

function addChatItem(d){
  mp.chatItems.push(d);
  if(mp.chatItems.length>CHAT_MAX_SHOW)mp.chatItems.shift();
  renderChat();
}

function renderChat(){
  var list=document.getElementById('mpChatList');
  if(!list)return;
  if(mp.chatItems.length===0){
    list.innerHTML='<div class="mp-chat-empty">Belum ada pesan</div>';
  }else{
    var html='';
    for(var i=0;i<mp.chatItems.length;i++){
      var c=mp.chatItems[i];
      var mine=c.id===mp.myId?' mine':'';
      html+='<div class="mp-chat-item'+mine+'">';
      html+='<div class="mp-chat-name">'+esc((c.name||'-').toUpperCase())+'</div>';
      html+='<div class="mp-chat-text">'+esc(c.text||'')+'</div>';
      html+='</div>';
    }
    list.innerHTML=html;
    list.scrollTop=list.scrollHeight;
  }
  var cnt=document.getElementById('mpChatCount');
  if(cnt)cnt.textContent=mp.chatItems.length;
}

function sendChat(){
  var input=document.getElementById('mpChatInput');
  if(!input||!mp.chatRef)return;
  var text=(input.value||'').trim();
  if(!text)return;
  if(text.length>100)text=text.slice(0,100);
  var msg={
    id:mp.myId,
    name:(DS().save.playerName||'PLAYER').toUpperCase(),
    text:text,
    ts:Date.now()
  };
  mp.chatRef.push(msg);
  input.value='';
  DS().sfxClick();
}

function showFlyingEmoji(emojiChar,posX){
  var layer=document.getElementById('mpEmojiLayer');
  if(!layer)return;
  var el=document.createElement('div');
  el.className='mp-fly-emoji';
  el.textContent=emojiChar;
  var W=window.innerWidth;
  var H=window.innerHeight;
  var x=clamp(posX*W,40,W-40);
  el.style.left=x+'px';
  el.style.top=(H*0.55)+'px';
  el.style.transform='translate(-50%,-50%)';
  layer.appendChild(el);
  setTimeout(function(){
    if(el.parentNode)el.parentNode.removeChild(el);
  },2300);
}

function sendEmoji(emojiChar){
  if(!mp.roomRef)return;
  var data={
    id:mp.myId,
    name:(DS().save.playerName||'PLAYER'),
    emoji:emojiChar,
    posX:mp.lobbyX,
    ts:Date.now(),
    nonce:Math.random().toString(36).slice(2,7)
  };
  mp.roomRef.child('lastEmoji').set(data);
  showFlyingEmoji(emojiChar,mp.lobbyX);
  DS().sfxEmoji();
}

function handleRemoteEmoji(d){
  if(!d)return;
  if(Date.now()-d.ts>8000)return;
  var key=(d.id||'')+'_'+(d.ts||0)+'_'+(d.nonce||'');
  if(mp.seenEmojis[key])return;
  mp.seenEmojis[key]=true;
  if(d.id===mp.myId)return;
  showFlyingEmoji(d.emoji,d.posX||0.5);
  DS().sfxEmoji();
}

function broadcastKill(targetName){
  if(!mp.roomRef||!MPApi().active)return;
  var me=PC()[mp.myId];
  var data={
    killerId:mp.myId,
    killerName:(me&&me.name)||(DS().save.playerName||'PLAYER'),
    targetName:targetName||'Musuh',
    ts:Date.now(),
    nonce:Math.random().toString(36).slice(2,7)
  };
  mp.roomRef.child('killfeed').set(data);
}

function handleRemoteKillFeed(d){
  if(!d)return;
  if(Date.now()-d.ts>6000)return;
  var key=(d.killerId||'')+'_'+(d.ts||0)+'_'+(d.nonce||'');
  if(mp.seenKf[key])return;
  mp.seenKf[key]=true;
  if(d.killerId===mp.myId)return;
  addKillFeed(d.killerName,d.targetName);
}

function addKillFeed(killer,target){
  var el=document.getElementById('killFeed');
  if(!el)return;
  var item=document.createElement('div');
  item.className='kf-item';
  item.innerHTML='<span class="kf-killer">'+esc((killer||'').toUpperCase())+'</span>'+
    '<span class="kf-icon">&gt;&gt;</span>'+
    '<span class="kf-target">'+esc(target||'')+'</span>';
  el.appendChild(item);
  mp.kfItems.push(item);
  while(el.children.length>KF_MAX_ITEMS){
    var old=el.firstChild;
    el.removeChild(old);
    if(mp.kfItems.length)mp.kfItems.shift();
  }
  setTimeout(function(){
    if(item.parentNode){
      item.style.transition='opacity .3s,transform .3s';
      item.style.opacity='0';
      item.style.transform='translateX(20px)';
      setTimeout(function(){
        if(item.parentNode)item.parentNode.removeChild(item);
        var idx=mp.kfItems.indexOf(item);
        if(idx>=0)mp.kfItems.splice(idx,1);
      },320);
    }
  },KF_LIFE);
}

function startGame(){
  if(!mp.roomRef)return;
  var lvl=DS().LEVELS[1];
  for(var i=0;i<MP_MODES.length;i++){
    if(MP_MODES[i].id===mp.selectedMode){lvl=DS().LEVELS[MP_MODES[i].level];break;}
  }
  MPApi().active=true;
  MPApi().dead=false;
  MPApi().myId=mp.myId;
  MPApi().roomRef=mp.roomRef;
  MPApi().playerRef=mp.playerRef;
  MPApi().isHost=mp.isHost;
  MPApi().myKills=0;
  MPApi().myKillCount=0;
  mp.startRequested=true;
  mp.gameUpdateTimer=0;
  mp.inGameDead=false;
  mp.reviveCountdown=0;
  mp.lastWrittenKp=DS().save.kills;
  mp.gameEnded=false;
  mp.finalSent=false;
  mp.kfItems=[];
  setupGameHooks();
  var roomRef=mp.roomRef;
  var players=PC();
  var startAt=Date.now()+600;
  var updates={};
  for(var pid in players){
    updates['players/'+pid+'/kills']=0;
    updates['players/'+pid+'/alive']=true;
    updates['players/'+pid+'/posHp']=1;
  }
  updates['mode']=mp.selectedMode;
  updates['startAt']=startAt;
  roomRef.update(updates,function(){
    roomRef.child('state').set('playing');
  });
  var kf=document.getElementById('killFeed');
  if(kf){
    kf.innerHTML='';
    kf.classList.add('on');
  }
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.add('on');
  var spb=document.getElementById('mpSendPointsBtn');
  if(spb)spb.classList.remove('on');
  var cel=document.getElementById('mpCelebration');
  if(cel)cel.classList.remove('on');
  var rb=document.getElementById('mpReviveBox');
  if(rb)rb.classList.remove('on');
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.add('on');
  setTimeout(function(){startMpLevel();},60);
  setTimeout(updateTopStats,700);
  setTimeout(updateTopStats,1800);
}

function startMpLevel(){
  var lvl=DS().LEVELS[1];
  for(var i=0;i<MP_MODES.length;i++){
    if(MP_MODES[i].id===mp.selectedMode){lvl=DS().LEVELS[MP_MODES[i].level];break;}
  }
  DS().startLevel(lvl,true);
  DS().updateMPLevelBadge();
}

function setupGameHooks(){
  MPApi().onPlayerDeath=onLocalDeath;
  MPApi().onGameEnd=onLocalWin;
  MPApi().onTickDead=tickDead;
  MPApi().drawOtherPlayers=drawOtherPlayersInGame;
  window.MP_broadcastKill=broadcastKill;
}

function onLocalDeath(){
  if(mp.inGameDead)return;
  if(mp.gameEnded)return;
  mp.inGameDead=true;
  MPApi().dead=true;
  mp.reviveCountdown=5;
  if(mp.playerRef)mp.playerRef.child('alive').set(false);
  var box=document.getElementById('mpReviveBox');
  var cnt=document.getElementById('mpReviveCount');
  if(box)box.classList.add('on');
  if(cnt)cnt.textContent='5';
  DS().sfxRevive();
}

function tickDead(dt){
  if(!mp.inGameDead)return;
  mp.reviveCountdown-=dt;
  var cnt=document.getElementById('mpReviveCount');
  if(cnt)cnt.textContent=String(Math.max(0,Math.ceil(mp.reviveCountdown)));
  if(mp.reviveCountdown<=0)reviveLocal();
}

function reviveLocal(){
  mp.inGameDead=false;
  MPApi().dead=false;
  mp.reviveCountdown=0;
  if(mp.playerRef)mp.playerRef.child('alive').set(true);
  var box=document.getElementById('mpReviveBox');
  if(box)box.classList.remove('on');
  var p=DS().getPlayer();
  if(p)p.hp=p.maxHp;
  DS().sfxRevive();
}

function onLocalWin(){
  if(mp.gameEnded)return;
  mp.gameEnded=true;
  if(mp.isHost&&mp.roomRef)mp.roomRef.child('state').set('ended');
  if(mp.playerRef)mp.playerRef.child('alive').set(true);
}

function onRoomEnded(){
  DS().setAppState('ended');
  MPApi().dead=false;
  mp.inGameDead=false;
  mp.reviveCountdown=0;
  var p=DS().getPlayer();
  if(p)p.hp=p.maxHp;
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.remove('on');
  var spBtn=document.getElementById('mpSendPointsBtn');
  if(spBtn)spBtn.classList.remove('on');
  var rb=document.getElementById('mpReviveBox');
  if(rb)rb.classList.remove('on');
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.remove('on');
  if(mp.playerRef)mp.playerRef.child('alive').set(true);
  var sorted=sortPlayersByKills();
  var myRank=0;
  for(var i=0;i<sorted.length;i++){
    if(sorted[i].id===mp.myId){myRank=i+1;break;}
  }
  var rewardText='';
  if(myRank===1){
    DS().save.trophies=(DS().save.trophies||0)+1;
    rewardText='JUARA 1 - Trophy Tournament Legend!';
    DS().showToast('Kamu dapat Trophy Tournament Legend!','success',3600);
  }else if(myRank===2){
    DS().grantKP(500);
    rewardText='Juara 2 - +500 KP';
    DS().showToast('Kamu dapat +500 KP (Juara 2)!','success',3200);
  }else if(myRank===3){
    DS().grantKP(250);
    rewardText='Juara 3 - +250 KP';
    DS().showToast('Kamu dapat +250 KP (Juara 3)!','success',3200);
  }else if(myRank>=4&&myRank<=6){
    DS().grantKP(100);
    rewardText='Juara '+myRank+' - +100 KP';
    DS().showToast('Kamu dapat +100 KP','success',2800);
  }
  DS().save.mpWins=(DS().save.mpWins||0)+1;
  DS().checkAchievements();
  DS().persist();
  var cel=document.getElementById('mpCelebration');
  var title=document.getElementById('mpCelebTitle');
  var sub=document.getElementById('mpCelebSub');
  var conf=document.getElementById('mpCelebConfetti');
  if(conf){
    conf.innerHTML='';
    var colors=['#ffc857','#ff6b4a','#3ddc97','#67c7f0','#9b6bff','#ff77a9','#ffffff'];
    for(var c=0;c<90;c++){
      var el=document.createElement('div');
      el.className='confetti';
      el.style.left=(Math.random()*100)+'%';
      el.style.background=colors[(Math.random()*colors.length)|0];
      el.style.animationDuration=(1.8+Math.random()*1.6)+'s';
      el.style.animationDelay=(Math.random()*0.6)+'s';
      el.style.width=(6+Math.random()*5)+'px';
      el.style.height=(10+Math.random()*8)+'px';
      el.style.borderRadius=Math.random()<0.3?'50%':'2px';
      conf.appendChild(el);
    }
  }
  if(title)title.textContent='SELESAI!';
  if(sub)sub.textContent=rewardText||'Semua pemain di-revive!';
  if(cel)cel.classList.add('on');
  DS().sfxVictory();
  setTimeout(function(){
    if(cel)cel.classList.remove('on');
    DS().showScreen('mpLobby');
    DS().setAppState('mpLobbyMenu');
    showMpResults(sorted,myRank);
    mp.startRequested=false;
    mp.finalSent=false;
    mp.gameEnded=false;
    MPApi().active=false;
    DS().refreshProfile();
    DS().updateMenuCard();
    renderLobby();
  },3600);
}

function sortPlayersByKills(){
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){
    var ka=a.kills||0,kb=b.kills||0;
    if(kb!==ka)return kb-ka;
    return (a.joinedAt||0)-(b.joinedAt||0);
  });
  return players;
}

function showMpResults(sorted,myRank){
  var maxKills=1;
  for(var m=0;m<sorted.length;m++)if((sorted[m].kills||0)>maxKills)maxKills=sorted[m].kills;
  var html='';
  for(var j=0;j<sorted.length;j++){
    var pl=sorted[j];
    var kp=pl.kills||0;
    var pct=Math.round(kp/maxKills*100);
    if(pct<4)pct=4;
    var rank=j+1;
    var color='#4a4a63';
    var icon='';
    if(rank===1){color='#ffc857';icon='1';}
    else if(rank===2){color='#b8c4cc';icon='2';}
    else if(rank===3){color='#d68a3c';icon='3';}
    else{color='#8a8aa3';icon=String(rank);}
    html+='<div class="mp-bar-row">';
    html+='<div class="mp-bar-place" style="color:'+color+';">#'+icon+'</div>';
    html+='<div class="mp-bar-name">'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<div class="mp-bar-track"><div class="mp-bar-fill" style="width:'+pct+'%"></div></div>';
    html+='<div class="mp-bar-info">'+kp+' kill</div>';
    html+='</div>';
  }
  var body=document.getElementById('mpEndBody');
  if(body)body.innerHTML=html;
  var stats=document.getElementById('mpEndStats');
  if(stats)stats.style.display='block';
}

function updateTopStats(){
  var el=document.getElementById('mpStatsBody');
  if(!el)return;
  var players=sortPlayersByKills();
  if(players.length===0){
    el.innerHTML='<div style="font-size:11px;color:#8a8aa3;">Menunggu data...</div>';
    return;
  }
  var maxKills=1;
  for(var m=0;m<players.length;m++)if((players[m].kills||0)>maxKills)maxKills=players[m].kills;
  var html='';
  for(var j=0;j<players.length;j++){
    var pl=players[j];
    var kp=pl.kills||0;
    var pct=Math.round(kp/maxKills*100);
    if(pct<4)pct=4;
    var isMe=pl.id===mp.myId?' style="font-weight:800;color:#ff6b4a;"':'';
    html+='<div class="mts-row">';
    html+='<div class="mts-name"'+isMe+'>'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<div class="mts-bar"><div class="mts-fill" style="width:'+pct+'%"></div></div>';
    html+='<div class="mts-kill">'+kp+'</div>';
    html+='</div>';
  }
  el.innerHTML=html;
}

function getGameCtx(){
  var cv=document.getElementById('game');
  if(!cv)return null;
  return cv.getContext('2d');
}

function drawOtherPlayersInGame(){
  if(!MPApi().active)return;
  var ctx=getGameCtx();
  if(!ctx)return;
  var W=DS().getW();
  var H=DS().getH();
  var BS=DS().BASE_SIZE;
  var border=DS().BORDER;
  for(var k in PC()){
    if(k===mp.myId)continue;
    var pl=PC()[k];
    if(pl.alive===false)continue;
    if(pl.posX===undefined||pl.posHp===undefined)continue;
    var ox=pl.posX*W-BS/2;
    var elL=DS().edgeLeft(),elR=DS().edgeRight();
    if(ox<elL)ox=elL;
    if(ox+BS>elR)ox=elR-BS;
    var oy=H-border-160;
    var ship=DS().findShip(pl.ship||'default');
    var shape=DS().findShape(pl.shape||'square');
    var key=ship.id+'_'+shape.id;
    var cache=DS().playerSpriteCache();
    var spr=cache[key]||cache[ship.id+'_square']||cache['default_square'];
    if(!spr)continue;
    var glow=DS().playerGlowCache()[ship.id];
    var cx=ox+BS/2,cy=oy+BS/2;
    var hpRatio=clamp(pl.posHp,0,1);
    ctx.save();
    ctx.globalAlpha=0.85;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillRect(ox-3,oy-26,BS+6,7);
    ctx.fillStyle='rgba(36,36,56,0.35)';
    ctx.fillRect(ox-2,oy-25,BS+4,5);
    ctx.fillStyle=hpRatio<0.35?'#ff6b4a':'#3ddc97';
    ctx.fillRect(ox,oy-24,BS*hpRatio,3);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=0.5;
    if(glow)ctx.drawImage(glow.normal.canvas,cx-glow.R,cy-glow.R);
    ctx.drawImage(spr.normal.canvas,ox-spr.pad,oy-spr.pad);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=0.7;
    ctx.font='bold 11px Fredoka,sans-serif';
    ctx.textAlign='center';
    ctx.lineWidth=3.5;
    ctx.strokeStyle='rgba(36,36,56,0.9)';
    var label=(pl.name||'-').toUpperCase();
    ctx.strokeText(label,cx,oy-32);
    ctx.fillStyle='#ffffff';
    ctx.fillText(label,cx,oy-32);
    ctx.restore();
  }
}

function gameSyncTick(dt){
  if(!MPApi().active||!mp.playerRef)return;
  mp.gameUpdateTimer-=dt;
  if(mp.gameUpdateTimer>0)return;
  mp.gameUpdateTimer=0.1;
  var p=DS().getPlayer();
  if(!p)return;
  mp.lastWrittenKp=DS().save.kills;
  mp.playerRef.update({
    posX:p.x/DS().getW(),
    posHp:Math.max(0,p.hp/p.maxHp),
    alive:!mp.inGameDead,
    kills:MPApi().myKillCount,
    kp:DS().save.kills,
    level:DS().save.level,
    xp:DS().save.xp,
    ship:DS().save.selectedShip,
    shape:DS().save.selectedShape,
    gun:DS().save.selectedGun,
    skill:DS().save.selectedSkill||'',
    lastSeen:Date.now()
  });
  DS().updateMPLevelBadge();
}

function openSendModal(){
  var modal=document.getElementById('mpSendPointsModal');
  if(!modal)return;
  if(DS().getAppState()!=='mpLobbyMenu')return;
  var bal=document.getElementById('mpSendBalance');
  if(bal)bal.textContent=fmtK(DS().save.kills);
  var list=document.getElementById('mpSendPlayerList');
  if(!list)return;
  var html='';
  var cnt=0;
  for(var k in PC()){
    if(k===mp.myId)continue;
    cnt++;
    var pl=PC()[k];
    html+='<div class="mp-send-player">';
    html+='<div class="mp-send-player-name">'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<input type="number" min="1" max="999999" placeholder="0" data-send-input="'+pl.id+'">';
    html+='<button data-send-to="'+pl.id+'">KIRIM</button>';
    html+='</div>';
  }
  if(!cnt)html='<div style="text-align:center;font-size:12px;color:#8a8aa3;padding:16px;">Tidak ada pemain lain</div>';
  list.innerHTML=html;
  modal.classList.add('on');
  mp.sendModalOpen=true;
}

function closeSendModal(){
  var modal=document.getElementById('mpSendPointsModal');
  if(modal)modal.classList.remove('on');
  mp.sendModalOpen=false;
}

function doSendKP(targetId){
  if(!mp.roomRef||!targetId)return;
  var input=document.querySelector('input[data-send-input="'+targetId+'"]');
  if(!input)return;
  var amt=parseInt(input.value,10);
  if(!amt||amt<=0){DS().showToast('Masukkan jumlah valid','error');return;}
  if(amt>DS().save.kills){DS().showToast('Poin kamu tidak cukup','error');return;}
  DS().save.kills-=amt;
  mp.lastWrittenKp=DS().save.kills;
  DS().persist();
  mp.roomRef.child('players/'+mp.myId+'/kp').set(DS().save.kills);
  mp.roomRef.child('players/'+targetId+'/kp').transaction(function(cur){
    return (cur||0)+amt;
  });
  DS().save.mpGifts=(DS().save.mpGifts||0)+1;
  DS().checkAchievements();
  DS().persist();
  var bal=document.getElementById('mpSendBalance');
  if(bal)bal.textContent=fmtK(DS().save.kills);
  input.value='';
  var tgt=PC()[targetId];
  DS().showToast('Kirim '+fmtK(amt)+' KP ke '+(tgt?(tgt.name||'-'):'-'),'success');
  DS().sfxGift();
  DS().refreshHeaderKills();
  DS().refreshProfile();
  DS().updateMenuCard();
}

function kickPlayer(targetId){
  if(!mp.isHost||!mp.roomRef)return;
  if(targetId===mp.myId)return;
  var tgt=PC()[targetId];
  DS().showConfirm('Kick '+(tgt?(tgt.name||'-'):'-')+' dari grup?',function(){
    mp.roomRef.child('players/'+targetId).remove();
    DS().sfxClick();
  });
}

function bindUI(){
  var createBtn=document.getElementById('mpCreateBtn');
  if(createBtn)createBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();createGroup();});
  var joinBtn=document.getElementById('mpJoinBtn');
  if(joinBtn)joinBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();joinGroup();});
  var nameIn=document.getElementById('mpNameInput');
  if(nameIn){
    nameIn.addEventListener('input',function(){
      this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,10);
      var sn=document.getElementById('mpSelfName');
      if(sn)sn.textContent=this.value||'-';
      if(DS().save.playerName!==this.value){
        DS().save.playerName=this.value;
      }
    });
  }
  var codeIn=document.getElementById('mpCodeInput');
  if(codeIn){
    codeIn.addEventListener('input',function(){
      this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    });
  }
  var back=document.getElementById('mpBack');
  if(back)back.addEventListener('click',function(){DS().initAudio();DS().sfxClick();DS().goScreen('menu','menu');});
  var lobBack=document.getElementById('mpLobbyBack');
  if(lobBack)lobBack.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();
    DS().showConfirm('Keluar dari grup?',function(){leaveGroup();DS().goScreen('menu','menu');});
  });
  var leave2=document.getElementById('mpLeaveBtn2');
  if(leave2)leave2.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();
    DS().showConfirm('Keluar dari grup?',function(){leaveGroup();DS().goScreen('menu','menu');});
  });
  var leaveB=document.getElementById('mpLeaveBtn');
  if(leaveB)leaveB.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();
    if(mp.playerRef)mp.playerRef.child('alive').set(false);
    leaveGroup();
    var ov=document.getElementById('overlay');
    if(ov)ov.classList.remove('on');
    DS().setAppState('menu');
    DS().showScreen('menu');
  });
  var startBtn=document.getElementById('mpStartBtn');
  if(startBtn)startBtn.addEventListener('click',function(){
    if(!mp.isHost)return;
    var cnt=0;
    for(var k in PC())cnt++;
    if(cnt<2){DS().showToast('Butuh minimal 2 pemain','error');return;}
    if(cnt>MAX_PLAYERS){DS().showToast('Maksimal '+MAX_PLAYERS+' pemain','error');return;}
    DS().initAudio();DS().sfxClick();
    if(mp.roomRef)mp.roomRef.child('mode').set(mp.selectedMode);
  });
  var mgrid=document.getElementById('mpModeGrid');
  if(mgrid){
    mgrid.addEventListener('click',function(ev){
      var t=ev.target;
      while(t&&t!==mgrid&&(!t.classList||!t.classList.contains('mp-mode-btn')))t=t.parentNode;
      if(!t||t===mgrid)return;
      if(!mp.isHost)return;
      var nm=Number(t.getAttribute('data-mode'));
      if(!nm||nm===mp.selectedMode)return;
      mp.selectedMode=nm;
      DS().sfxClick();
      if(mp.roomRef)mp.roomRef.child('mode').set(nm);
      renderModeGrid();
    });
  }
  var mplayers=document.getElementById('mpPlayers');
  if(mplayers){
    mplayers.addEventListener('click',function(ev){
      var t=ev.target;
      while(t&&t!==mplayers&&(!t.getAttribute||!t.getAttribute('data-kick')))t=t.parentNode;
      if(!t||t===mplayers)return;
      var kid=t.getAttribute('data-kick');
      if(kid)kickPlayer(kid);
    });
  }
  var ebar=document.getElementById('emojiBar');
  if(ebar){
    ebar.addEventListener('click',function(ev){
      var t=ev.target;
      while(t&&t!==ebar&&(!t.getAttribute||!t.getAttribute('data-emoji')))t=t.parentNode;
      if(!t||t===ebar)return;
      var e=t.getAttribute('data-emoji');
      if(!e)return;
      DS().initAudio();
      sendEmoji(e);
    });
  }
  var chatSend=document.getElementById('mpChatSend');
  if(chatSend)chatSend.addEventListener('click',function(){DS().initAudio();sendChat();});
  var chatInput=document.getElementById('mpChatInput');
  if(chatInput){
    chatInput.addEventListener('keydown',function(ev){
      ev.stopPropagation();
      if(ev.key==='Enter'||ev.keyCode===13){
        ev.preventDefault();
        DS().initAudio();
        sendChat();
      }
    });
  }
  var giftBtn=document.getElementById('mpLobbyGiftBtn');
  if(giftBtn)giftBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();openSendModal();});
  var spClose=document.getElementById('mpSendClose');
  if(spClose)spClose.addEventListener('click',function(){DS().sfxClick();closeSendModal();});
  var spModal=document.getElementById('mpSendPointsModal');
  if(spModal){
    spModal.addEventListener('click',function(ev){
      if(ev.target===spModal)closeSendModal();
    });
  }
  var spList=document.getElementById('mpSendPlayerList');
  if(spList){
    spList.addEventListener('click',function(ev){
      var t=ev.target;
      while(t&&t!==spList&&(!t.getAttribute||!t.getAttribute('data-send-to')))t=t.parentNode;
      if(!t||t===spList)return;
      var tid=t.getAttribute('data-send-to');
      if(tid)doSendKP(tid);
    });
  }
}

function mainLoop(ts){
  requestAnimationFrame(mainLoop);
  if(!mainLoop.last)mainLoop.last=ts;
  var dt=(ts-mainLoop.last)/1000;
  mainLoop.last=ts;
  if(dt>0.1)dt=0.1;
  if(MPApi().active&&DS().getAppState()==='playingMP')gameSyncTick(dt);
}

window.MP_refreshSelfPreview=function(){
  var cv=document.getElementById('mpSelfPreview');
  if(!cv)return;
  cv.width=160;
  cv.height=160;
  var ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  var ship=DS().findShip(DS().save.selectedShip);
  var shape=DS().findShape(DS().save.selectedShape);
  DS().drawShipCentered(ctx,ship,shape,cv.width,cv.height,{
    glow:true,
    glowAlpha:0.6,
    zoom:0.92
  });
  var nm=document.getElementById('mpSelfName');
  if(nm)nm.textContent=(DS().save.playerName||'-').toUpperCase();
};

window.MP_broadcastKill=null;

function boot(){
  initFirebase();
  bindUI();
  initPlayfield();
  var nameIn=document.getElementById('mpNameInput');
  if(nameIn&&DS().save.playerName)nameIn.value=DS().save.playerName;
  if(!DS().save.mpGifts)DS().save.mpGifts=0;
  if(!DS().save.trophies)DS().save.trophies=0;
  requestAnimationFrame(mainLoop);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
