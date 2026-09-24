(function(){
'use strict';

var db=null;
var MAX_PLAYERS=6;
var CHAT_MAX_STORE=80;
var CHAT_MAX_SHOW=60;
var KF_MAX_ITEMS=5;
var KF_LIFE=4000;
var GLOBAL_SYNC_INTERVAL=0.12;
var USER_SYNC_INTERVAL=8000;

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
  kfItems:[],
  userRef:null,
  userSyncTimer:null,
  globalMode:false,
  globalRef:null,
  globalPlayerRef:null,
  globalPlayers:{},
  globalKillfeedRef:null,
  globalChatRef:null,
  globalStatsRef:null,
  globalKillsTotal:0,
  globalPlayersOnline:0,
  globalSyncTimer:0,
  globalDead:false,
  globalReviveCountdown:0,
  friendCache:{},
  searchResults:[],
  userSearchCache:{}
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

function getUserProfile(){
  var save=DS().save;
  return {
    id:save.globalId,
    name:(save.playerName||'PLAYER').toUpperCase(),
    kills:save.kills,
    totalKills:save.totalKills,
    level:save.level,
    xp:save.xp,
    trophies:save.trophies,
    ship:save.selectedShip,
    shape:save.selectedShape,
    gun:save.selectedGun,
    pet:save.selectedPet||'',
    wins:save.mpWins||0,
    lastSeen:Date.now()
  };
}

function syncUserProfile(){
  if(!db)return;
  var save=DS().save;
  if(!save.globalId){
    save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    DS().persist();
  }
  if(!mp.userRef)mp.userRef=db.ref('users/'+save.globalId);
  var profile=getUserProfile();
  mp.userRef.update(profile);
  if(!mp.userSyncTimer){
    mp.userSyncTimer=setInterval(function(){
      if(db&&DS().save.globalId){
        db.ref('users/'+DS().save.globalId).update({
          kills:DS().save.kills,
          totalKills:DS().save.totalKills,
          level:DS().save.level,
          xp:DS().save.xp,
          trophies:DS().save.trophies,
          ship:DS().save.selectedShip,
          shape:DS().save.selectedShape,
          gun:DS().save.selectedGun,
          pet:DS().save.selectedPet||'',
          lastSeen:Date.now()
        });
      }
    },USER_SYNC_INTERVAL);
  }
}

function createGroup(){
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Nama minimal 3 karakter','error');return;}
  if(name.length>10){DS().showToast('Nama maksimal 10 karakter','error');return;}
  if(!db){DS().showToast('Database belum siap','error');return;}
  DS().save.playerName=name;DS().persist();
  syncUserProfile();
  var code=genRoomCode();
  var myId=genPlayerId();
  mp.myId=myId;
  mp.isHost=true;
  mp.roomCode=code;
  mp.selectedMode=1;
  mp.lastWrittenKp=null;
  mp.lobbyX=0.5;
  mp.gameEnded=false;
  mp.globalMode=false;
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
      pet:DS().save.selectedPet||'',
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
  syncUserProfile();
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
    mp.globalMode=false;
    var me={
      id:myId,
      name:name,
      ship:DS().save.selectedShip,
      shape:DS().save.selectedShape,
      gun:DS().save.selectedGun,
      skill:DS().save.selectedSkill||'',
      pet:DS().save.selectedPet||'',
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

function detachGlobal(){
  if(mp.globalRef){try{mp.globalRef.off();}catch(e){}mp.globalRef=null;}
  if(mp.globalPlayerRef){try{mp.globalPlayerRef.off();}catch(e){}mp.globalPlayerRef=null;}
  if(mp.globalKillfeedRef){try{mp.globalKillfeedRef.off();}catch(e){}mp.globalKillfeedRef=null;}
  if(mp.globalChatRef){try{mp.globalChatRef.off();}catch(e){}mp.globalChatRef=null;}
  if(mp.globalStatsRef){try{mp.globalStatsRef.off();}catch(e){}mp.globalStatsRef=null;}
  mp.globalPlayers={};
  mp.globalKillsTotal=0;
  mp.globalPlayersOnline=0;
}

function leaveGroup(){
  if(mp.globalMode){
    leaveGlobal();
    return;
  }
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
  var gs=document.getElementById('mpGlobalStats');
  if(gs)gs.classList.remove('on');
}

function leaveGlobal(){
  if(mp.globalPlayerRef&&DS().save.globalId){
    try{db.ref('global_arena/players/'+DS().save.globalId).remove();}catch(e){}
  }
  detachGlobal();
  mp.globalMode=false;
  MPApi().active=false;
  MPApi().dead=false;
  MPApi().globalMode=false;
  MPApi().playersCache={};
  mp.chatItems=[];
  mp.kfItems=[];
  mp.seenEmojis={};
  mp.seenKf={};
  mp.startRequested=false;
  mp.gameEnded=false;
  mp.finalSent=false;
  mp.globalDead=false;
  mp.globalReviveCountdown=0;
  var kf=document.getElementById('killFeed');
  if(kf){kf.innerHTML='';kf.classList.remove('on');}
  var gs=document.getElementById('mpGlobalStats');
  if(gs)gs.classList.remove('on');
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.remove('on');
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.remove('on');
  var mr=document.getElementById('mpMiniRow');
  if(mr)mr.innerHTML='';
  var em=document.getElementById('mpEmojiLayer');
  if(em)em.innerHTML='';
}

function renderLobby(){
  if(mp.globalMode){renderGlobalLobby();return;}
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
  if(mp.globalMode&&mp.globalPlayerRef)mp.globalPlayerRef.child('lobbyX').set(mp.lobbyX);
  else if(mp.playerRef)mp.playerRef.child('lobbyX').set(mp.lobbyX);
}

function pfLoop(){
  mp.pfAnim=requestAnimationFrame(pfLoop);
  var cv=mp.pfCanvas,ctx=mp.pfCtx;
  if(!cv||!ctx)return;
  if(DS().getAppState()!=='mpLobbyMenu'&&DS().getAppState()!=='globalLobby')return;
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
  if(mp.globalMode){
    for(var gk in mp.globalPlayers)players.push(mp.globalPlayers[gk]);
  }else{
    for(var k in PC())players.push(PC()[k]);
  }
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var sz=Math.min(cw*0.20,ch*0.55);
  if(sz<34)sz=34;
  if(sz>74)sz=74;
  for(var i=0;i<players.length;i++){
    var pl=players[i];
    var x=(pl.lobbyX!==undefined&&pl.lobbyX!==null)?pl.lobbyX:0.5;
    var isMe=mp.globalMode?(pl.id===DS().save.globalId):(pl.id===mp.myId);
    if(isMe)x=mp.lobbyX;
    var cx=x*cw;
    if(cx<sz*0.55)cx=sz*0.55;
    if(cx>cw-sz*0.55)cx=cw-sz*0.55;
    var cy=ch*0.52;
    var bob=Math.sin(now*0.003+i*1.3)*4;
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
      var isMine=mp.globalMode?(c.id===DS().save.globalId):(c.id===mp.myId);
      var mine=isMine?' mine':'';
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
  if(!input)return;
  var text=(input.value||'').trim();
  if(!text)return;
  if(text.length>100)text=text.slice(0,100);
  var msg={
    id:mp.globalMode?DS().save.globalId:mp.myId,
    name:(DS().save.playerName||'PLAYER').toUpperCase(),
    text:text,
    ts:Date.now()
  };
  if(mp.globalMode&&mp.globalChatRef)mp.globalChatRef.push(msg);
  else if(mp.chatRef)mp.chatRef.push(msg);
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
  var data={
    id:mp.globalMode?DS().save.globalId:mp.myId,
    name:(DS().save.playerName||'PLAYER'),
    emoji:emojiChar,
    posX:mp.lobbyX,
    ts:Date.now(),
    nonce:Math.random().toString(36).slice(2,7)
  };
  if(mp.globalMode&&mp.globalRef)mp.globalRef.child('lastEmoji').set(data);
  else if(mp.roomRef)mp.roomRef.child('lastEmoji').set(data);
  showFlyingEmoji(emojiChar,mp.lobbyX);
  DS().sfxEmoji();
}

function handleRemoteEmoji(d){
  if(!d)return;
  if(Date.now()-d.ts>8000)return;
  var key=(d.id||'')+'_'+(d.ts||0)+'_'+(d.nonce||'');
  if(mp.seenEmojis[key])return;
  mp.seenEmojis[key]=true;
  var myId=mp.globalMode?DS().save.globalId:mp.myId;
  if(d.id===myId)return;
  showFlyingEmoji(d.emoji,d.posX||0.5);
  DS().sfxEmoji();
}

function broadcastKill(targetName){
  if(!MPApi().active)return;
  var me;
  if(mp.globalMode)me={name:DS().save.playerName||'PLAYER'};
  else me=PC()[mp.myId];
  var data={
    killerId:mp.globalMode?DS().save.globalId:mp.myId,
    killerName:(me&&me.name)||(DS().save.playerName||'PLAYER'),
    targetName:targetName||'Musuh',
    ts:Date.now(),
    nonce:Math.random().toString(36).slice(2,7)
  };
  if(mp.globalMode&&mp.globalKillfeedRef){
    mp.globalKillfeedRef.set(data);
    if(mp.globalStatsRef){
      mp.globalStatsRef.child('totalKills').transaction(function(cur){return (cur||0)+1;});
    }
  }else if(mp.roomRef){
    mp.roomRef.child('killfeed').set(data);
  }
}

function handleRemoteKillFeed(d){
  if(!d)return;
  if(Date.now()-d.ts>6000)return;
  var key=(d.killerId||'')+'_'+(d.ts||0)+'_'+(d.nonce||'');
  if(mp.seenKf[key])return;
  mp.seenKf[key]=true;
  var myId=mp.globalMode?DS().save.globalId:mp.myId;
  if(d.killerId===myId)return;
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

function enterGlobalMode(){
  if(!db){DS().showToast('Database belum siap','error');return;}
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Isi nama minimal 3 karakter dulu','error');return;}
  DS().save.playerName=name;DS().persist();
  syncUserProfile();
  var myId=DS().save.globalId;
  mp.globalMode=true;
  mp.myId=myId;
  mp.globalDead=false;
  mp.globalReviveCountdown=0;
  mp.gameEnded=false;
  mp.finalSent=false;
  mp.startRequested=true;
  mp.globalRef=db.ref('global_arena');
  mp.globalPlayerRef=db.ref('global_arena/players/'+myId);
  mp.globalKillfeedRef=db.ref('global_arena/killfeed');
  mp.globalChatRef=db.ref('global_arena/chat');
  mp.globalStatsRef=db.ref('global_arena/stats');
  MPApi().active=true;
  MPApi().globalMode=true;
  MPApi().myId=myId;
  MPApi().isHost=false;
  MPApi().dead=false;
  mp.lastWrittenKp=null;
  var me={
    id:myId,
    name:name,
    ship:DS().save.selectedShip,
    shape:DS().save.selectedShape,
    gun:DS().save.selectedGun,
    pet:DS().save.selectedPet||'',
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
  mp.globalPlayerRef.set(me,function(err){
    if(err){DS().showToast('Gagal masuk mode global','error');leaveGlobal();return;}
    attachGlobalListeners(myId);
    DS().showScreen('mpLobby');
    var codeEl=document.getElementById('mpRoomCode');
    if(codeEl)codeEl.textContent='GLOBAL';
    renderGlobalLobby();
    DS().sfxMP();
    DS().showToast('Masuk Mode Global! Semua pemain online bergabung.','success',3000);
  });
}

function attachGlobalListeners(myId){
  mp.globalRef.child('players').on('value',function(snap){
    var d=snap.val()||{};
    mp.globalPlayers=d;
    mp.globalPlayersOnline=0;
    var now=Date.now();
    var cache={};
    for(var k in d){
      if(now-(d[k].lastSeen||0)<30000){
        cache[k]=d[k];
        mp.globalPlayersOnline++;
      }
    }
    MPApi().playersCache=cache;
    var st=DS().getAppState();
    if(st==='mpLobbyMenu'||st==='globalLobby')renderGlobalLobby();
    if(st==='playingMP')updateTopStats();
    updateGlobalStatsBar();
  });
  mp.globalRef.child('killfeed').on('value',function(snap){
    var d=snap.val();
    if(d)handleRemoteKillFeed(d);
  });
  mp.globalRef.child('lastEmoji').on('value',function(snap){
    var d=snap.val();
    if(d)handleRemoteEmoji(d);
  });
  mp.globalChatRef.limitToLast(CHAT_MAX_STORE).on('child_added',function(snap){
    var d=snap.val();
    if(!d)return;
    var key=snap.key;
    if(mp.seenEmojis['gc_'+key])return;
    mp.seenEmojis['gc_'+key]=true;
    addChatItem(d);
  });
  mp.globalStatsRef.on('value',function(snap){
    var d=snap.val()||{};
    mp.globalKillsTotal=d.totalKills||0;
    updateGlobalStatsBar();
  });
  mp.globalPlayerRef.onDisconnect().remove();
  mp.pollInterval=setInterval(function(){
    if(mp.globalPlayerRef)mp.globalPlayerRef.child('lastSeen').set(Date.now());
  },5000);
}

function updateGlobalStatsBar(){
  var el=document.getElementById('mpGlobalStats');
  var killEl=document.getElementById('mpGlobalKills');
  var playerEl=document.getElementById('mpGlobalPlayers');
  if(killEl)killEl.textContent=fmtK(mp.globalKillsTotal);
  if(playerEl)playerEl.textContent=mp.globalPlayersOnline;
  if(el){
    if(mp.globalMode)el.classList.add('on');
    else el.classList.remove('on');
  }
}

function renderGlobalLobby(){
  var players=[];
  for(var k in mp.globalPlayers)players.push(mp.globalPlayers[k]);
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var html='';
  var maxShow=12;
  var shown=0;
  for(var p=0;p<players.length&&shown<maxShow;p++){
    var pl=players[p];
    var isMe=pl.id===DS().save.globalId;
    var cls='mp-player';
    if(isMe)cls+=' me';
    if(pl.alive===false)cls+=' dead';
    html+='<div class="'+cls+'" data-pid="'+pl.id+'">';
    html+='<canvas width="140" height="140"></canvas>';
    html+='<div class="mp-name">'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<div class="mp-role">GLOBAL</div>';
    html+='<div class="mp-kills">KP <b>'+fmtK(pl.kp||0)+'</b></div>';
    html+='</div>';
    shown++;
  }
  if(players.length>maxShow){
    html+='<div class="mp-waiting">+'+(players.length-maxShow)+' pemain lain online</div>';
  }
  var el=document.getElementById('mpPlayers');
  if(el)el.innerHTML=html;
  var canvases=el?el.querySelectorAll('canvas'):[];
  for(var c=0;c<canvases.length;c++){
    var card=canvases[c].parentNode;
    var pid=card.getAttribute('data-pid');
    var pl2=mp.globalPlayers[pid];
    if(pl2)drawCardShip(canvases[c],pl2);
  }
  var wait=document.getElementById('mpWaiting');
  if(wait)wait.textContent=mp.globalPlayersOnline+' pemain online di server global';
  var startBtn=document.getElementById('mpStartBtn');
  if(startBtn){
    startBtn.disabled=false;
    startBtn.textContent='MULAI GLOBAL';
  }
  var mt=document.getElementById('mpModeTitle');
  if(mt)mt.textContent='MODE GLOBAL AKTIF';
  var mg=document.getElementById('mpModeGrid');
  if(mg)mg.innerHTML='<div style="grid-column:1/-1;text-align:center;font-size:11px;color:#4a4a63;padding:8px;">Semua pemain bermain bersamaan. Kill & musuh dibagi global.</div>';
  renderChat();
}

function startGame(){
  if(mp.globalMode){
    startGlobalGame();
    return;
  }
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
  roomRef.update(updates);
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

function startGlobalGame(){
  var lvl=DS().LEVELS[1];
  MPApi().active=true;
  MPApi().dead=false;
  MPApi().myId=DS().save.globalId;
  MPApi().globalMode=true;
  MPApi().isHost=false;
  MPApi().myKills=0;
  MPApi().myKillCount=0;
  mp.startRequested=true;
  mp.gameUpdateTimer=0;
  mp.globalDead=false;
  mp.globalReviveCountdown=0;
  mp.lastWrittenKp=DS().save.kills;
  mp.gameEnded=false;
  mp.finalSent=false;
  mp.kfItems=[];
  setupGameHooks();
  var kf=document.getElementById('killFeed');
  if(kf){
    kf.innerHTML='';
    kf.classList.add('on');
  }
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.add('on');
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.add('on');
  setTimeout(function(){
    DS().startLevel(lvl,true);
    DS().updateMPLevelBadge();
  },60);
  setTimeout(updateTopStats,700);
  setTimeout(updateTopStats,1800);
  DS().showToast('Mode Global dimulai! Bertahan & kumpulkan kill.','success',3000);
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
  if(mp.globalMode){
    if(mp.globalDead)return;
    if(mp.gameEnded)return;
    mp.globalDead=true;
    MPApi().dead=true;
    mp.globalReviveCountdown=5;
    if(mp.globalPlayerRef)mp.globalPlayerRef.child('alive').set(false);
    var box=document.getElementById('mpReviveBox');
    var cnt=document.getElementById('mpReviveCount');
    if(box)box.classList.add('on');
    if(cnt)cnt.textContent='5';
    DS().sfxRevive();
    return;
  }
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
  if(mp.globalMode){
    if(!mp.globalDead)return;
    mp.globalReviveCountdown-=dt;
    var cnt=document.getElementById('mpReviveCount');
    if(cnt)cnt.textContent=String(Math.max(0,Math.ceil(mp.globalReviveCountdown)));
    if(mp.globalReviveCountdown<=0)reviveLocal();
    return;
  }
  if(!mp.inGameDead)return;
  mp.reviveCountdown-=dt;
  var cnt=document.getElementById('mpReviveCount');
  if(cnt)cnt.textContent=String(Math.max(0,Math.ceil(mp.reviveCountdown)));
  if(mp.reviveCountdown<=0)reviveLocal();
}

function reviveLocal(){
  if(mp.globalMode){
    mp.globalDead=false;
    MPApi().dead=false;
    mp.globalReviveCountdown=0;
    if(mp.globalPlayerRef)mp.globalPlayerRef.child('alive').set(true);
    var box=document.getElementById('mpReviveBox');
    if(box)box.classList.remove('on');
    var p=DS().getPlayer();
    if(p)p.hp=p.maxHp;
    DS().sfxRevive();
    return;
  }
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
  if(mp.globalMode){
    if(mp.globalPlayerRef)mp.globalPlayerRef.child('alive').set(true);
    return;
  }
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
  var cache=mp.globalMode?mp.globalPlayers:PC();
  for(var k in cache)players.push(cache[k]);
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
  var myId=mp.globalMode?DS().save.globalId:mp.myId;
  var limit=mp.globalMode?8:players.length;
  for(var j=0;j<players.length&&j<limit;j++){
    var pl=players[j];
    var kp=pl.kills||0;
    var pct=Math.round(kp/maxKills*100);
    if(pct<4)pct=4;
    var isMe=pl.id===myId?' style="font-weight:800;color:#ff6b4a;"':'';
    html+='<div class="mts-row">';
    html+='<div class="mts-name"'+isMe+'>'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<div class="mts-bar"><div class="mts-fill" style="width:'+pct+'%"></div></div>';
    html+='<div class="mts-kill">'+kp+'</div>';
    html+='</div>';
  }
  if(players.length>limit){
    html+='<div style="font-size:9px;color:#8a8aa3;text-align:center;margin-top:4px;">+'+(players.length-limit)+' pemain lain</div>';
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
  var cache=mp.globalMode?mp.globalPlayers:PC();
  var myId=mp.globalMode?DS().save.globalId:mp.myId;
  for(var k in cache){
    if(k===myId)continue;
    var pl=cache[k];
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
    var cacheSpr=DS().playerSpriteCache();
    var spr=cacheSpr[key]||cacheSpr[ship.id+'_square']||cacheSpr['default_square'];
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
  if(!MPApi().active)return;
  mp.gameUpdateTimer-=dt;
  if(mp.gameUpdateTimer>0)return;
  mp.gameUpdateTimer=GLOBAL_SYNC_INTERVAL;
  var p=DS().getPlayer();
  if(!p)return;
  mp.lastWrittenKp=DS().save.kills;
  var data={
    posX:p.x/DS().getW(),
    posHp:Math.max(0,p.hp/p.maxHp),
    alive:mp.globalMode?!mp.globalDead:!mp.inGameDead,
    kills:MPApi().myKillCount,
    kp:DS().save.kills,
    level:DS().save.level,
    xp:DS().save.xp,
    ship:DS().save.selectedShip,
    shape:DS().save.selectedShape,
    gun:DS().save.selectedGun,
    pet:DS().save.selectedPet||'',
    skill:DS().save.selectedSkill||'',
    lastSeen:Date.now()
  };
  var ref=mp.globalMode?mp.globalPlayerRef:mp.playerRef;
  if(ref)ref.update(data);
  DS().updateMPLevelBadge();
}

function openSendModal(){
  var modal=document.getElementById('mpSendPointsModal');
  if(!modal)return;
  if(DS().getAppState()!=='mpLobbyMenu')return;
  if(mp.globalMode){DS().showToast('Mode global tidak bisa kirim poin','error');return;}
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

function renderLeaderboard(){
  var list=document.getElementById('leaderList');
  if(!list)return;
  list.innerHTML='<div style="text-align:center;padding:40px;color:#8a8aa3;font-weight:600;font-size:12px;">Memuat peringkat...</div>';
  if(!db)return;
  db.ref('users').orderByChild('kills').limitToLast(100).once('value').then(function(snap){
    var users=[];
    snap.forEach(function(child){
      var d=child.val();
      if(!d)return;
      if(Date.now()-(d.lastSeen||0)>7*24*3600*1000)return;
      users.push(d);
    });
    users.sort(function(a,b){return (b.kills||0)-(a.kills||0);});
    var html='';
    var myId=DS().save.globalId;
    for(var i=0;i<users.length;i++){
      var u=users[i];
      var rank=i+1;
      var cls='leader-row';
      if(u.id===myId)cls+=' me';
      if(DS().save.friends[u.id])cls+=' friend';
      var rankCls='';
      if(rank===1)rankCls=' top1';
      else if(rank===2)rankCls=' top2';
      else if(rank===3)rankCls=' top3';
      var btnHtml='';
      if(u.id!==myId){
        if(DS().save.friends[u.id]){
          btnHtml='<button class="leader-friend-btn added" disabled>TEMAN</button>';
        }else if(DS().save.friendSent[u.id]){
          btnHtml='<button class="leader-friend-btn pending" disabled>PENDING</button>';
        }else{
          btnHtml='<button class="leader-friend-btn" data-add-friend="'+esc(u.id)+'" data-friend-name="'+esc(u.name||'')+'">+ TEMAN</button>';
        }
      }
      html+='<div class="'+cls+'" data-uid="'+esc(u.id)+'">';
      html+='<div class="leader-rank'+rankCls+'">#'+rank+'</div>';
      html+='<div class="leader-info">';
      html+='<div class="leader-name">'+esc((u.name||'-').toUpperCase())+'</div>';
      html+='<div class="leader-meta">LV '+(u.level||1)+' &middot; '+fmtK(u.totalKills||0)+' total kill</div>';
      html+='</div>';
      html+='<div class="leader-kp">'+fmtK(u.kills||0)+'</div>';
      html+=btnHtml;
      html+='</div>';
    }
    if(users.length===0)html='<div style="text-align:center;padding:40px;color:#8a8aa3;font-weight:600;font-size:12px;">Belum ada pemain terdaftar</div>';
    list.innerHTML=html;
    var btns=list.querySelectorAll('[data-add-friend]');
    for(var b=0;b<btns.length;b++){
      btns[b].addEventListener('click',function(ev){
        ev.stopPropagation();
        var uid=this.getAttribute('data-add-friend');
        var uname=this.getAttribute('data-friend-name');
        addFriend(uid,uname,this);
      });
    }
  }).catch(function(){
    list.innerHTML='<div style="text-align:center;padding:40px;color:#c93a3a;font-weight:600;font-size:12px;">Gagal memuat peringkat</div>';
  });
}

function addFriend(uid,uname,btn){
  if(!db||!uid)return;
  if(uid===DS().save.globalId){DS().showToast('Tidak bisa tambah diri sendiri','error');return;}
  if(DS().save.friends[uid]){DS().showToast('Sudah berteman','info');return;}
  if(DS().save.friendSent[uid]){DS().showToast('Permintaan sudah dikirim','info');return;}
  var myId=DS().save.globalId;
  var myName=(DS().save.playerName||'PLAYER').toUpperCase();
  var updates={};
  updates['friend_requests/'+uid+'/'+myId]={
    id:myId,
    name:myName,
    ts:Date.now()
  };
  updates['friend_sent/'+myId+'/'+uid]={
    id:uid,
    name:uname||'-',
    ts:Date.now()
  };
  db.ref().update(updates,function(err){
    if(err){DS().showToast('Gagal kirim permintaan','error');return;}
    DS().save.friendSent[uid]={id:uid,name:uname,ts:Date.now()};
    DS().persist();
    if(btn){
      btn.textContent='PENDING';
      btn.classList.add('pending');
      btn.disabled=true;
    }
    DS().showToast('Permintaan teman dikirim ke '+uname,'success');
    DS().sfxMP();
  });
}

function acceptFriend(uid,uname){
  if(!db||!uid)return;
  var myId=DS().save.globalId;
  var updates={};
  updates['friends/'+myId+'/'+uid]={id:uid,name:uname,ts:Date.now()};
  updates['friends/'+uid+'/'+myId]={id:myId,name:(DS().save.playerName||'PLAYER').toUpperCase(),ts:Date.now()};
  updates['friend_requests/'+myId+'/'+uid]=null;
  updates['friend_sent/'+uid+'/'+myId]=null;
  db.ref().update(updates,function(err){
    if(err){DS().showToast('Gagal terima teman','error');return;}
    DS().save.friends[uid]={id:uid,name:uname,ts:Date.now()};
    delete DS().save.friendRequests[uid];
    DS().save.friendSent[uid]=null;
    delete DS().save.friendSent[uid];
    DS().persist();
    DS().checkAchievements();
    DS().showToast('Berteman dengan '+uname+'!','success');
    DS().sfxMP();
    renderFriends();
  });
}

function rejectFriend(uid){
  if(!db)return;
  var myId=DS().save.globalId;
  db.ref('friend_requests/'+myId+'/'+uid).remove();
  delete DS().save.friendRequests[uid];
  DS().persist();
  DS().sfxClick();
  renderFriends();
}

function removeFriend(uid,uname){
  if(!db)return;
  DS().showConfirm('Hapus '+(uname||'-')+' dari teman?',function(){
    var myId=DS().save.globalId;
    var updates={};
    updates['friends/'+myId+'/'+uid]=null;
    updates['friends/'+uid+'/'+myId]=null;
    db.ref().update(updates);
    delete DS().save.friends[uid];
    DS().persist();
    DS().sfxClick();
    DS().showToast('Teman dihapus','info');
    renderFriends();
  });
}

function searchUsers(){
  var input=document.getElementById('friendSearchInput');
  var result=document.getElementById('friendSearchResult');
  if(!input||!result)return;
  var q=(input.value||'').trim().toUpperCase();
  if(q.length<2){DS().showToast('Minimal 2 karakter','error');return;}
  if(!db)return;
  result.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Mencari...</div>';
  db.ref('users').orderByChild('name').startAt(q).endAt(q+'\uf8ff').limitToFirst(20).once('value').then(function(snap){
    var users=[];
    snap.forEach(function(child){
      var d=child.val();
      if(!d)return;
      if(d.id===DS().save.globalId)return;
      users.push(d);
    });
    var html='';
    if(users.length===0){
      html='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Tidak ditemukan</div>';
    }else{
      for(var i=0;i<users.length;i++){
        var u=users[i];
        var cls='leader-row';
        if(DS().save.friends[u.id])cls+=' friend';
        var btnHtml='';
        if(DS().save.friends[u.id]){
          btnHtml='<button class="leader-friend-btn added" disabled>TEMAN</button>';
        }else if(DS().save.friendSent[u.id]){
          btnHtml='<button class="leader-friend-btn pending" disabled>PENDING</button>';
        }else{
          btnHtml='<button class="leader-friend-btn" data-add-friend="'+esc(u.id)+'" data-friend-name="'+esc(u.name||'')+'">+ TEMAN</button>';
        }
        html+='<div class="'+cls+'" data-uid="'+esc(u.id)+'">';
        html+='<div class="leader-rank">-</div>';
        html+='<div class="leader-info">';
        html+='<div class="leader-name">'+esc((u.name||'-').toUpperCase())+'</div>';
        html+='<div class="leader-meta">LV '+(u.level||1)+' &middot; '+fmtK(u.kills||0)+' KP</div>';
        html+='</div>';
        html+='<div class="leader-kp">'+fmtK(u.totalKills||0)+'</div>';
        html+=btnHtml;
        html+='</div>';
      }
    }
    result.innerHTML=html;
    var btns=result.querySelectorAll('[data-add-friend]');
    for(var b=0;b<btns.length;b++){
      btns[b].addEventListener('click',function(ev){
        ev.stopPropagation();
        var uid=this.getAttribute('data-add-friend');
        var uname=this.getAttribute('data-friend-name');
        addFriend(uid,uname,this);
      });
    }
  }).catch(function(){
    result.innerHTML='<div style="text-align:center;padding:24px;color:#c93a3a;font-weight:600;font-size:12px;">Gagal mencari</div>';
  });
}

function renderFriends(){
  var reqList=document.getElementById('friendRequests');
  var friendList=document.getElementById('friendList');
  if(!db)return;
  if(reqList){
    reqList.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Memuat...</div>';
  }
  db.ref('friend_requests/'+DS().save.globalId).once('value').then(function(snap){
    var d=snap.val()||{};
    var reqs=[];
    for(var k in d)reqs.push(d[k]);
    DS().save.friendRequests={};
    var html='';
    if(reqs.length===0){
      html='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Tidak ada permintaan</div>';
    }else{
      for(var i=0;i<reqs.length;i++){
        var r=reqs[i];
        DS().save.friendRequests[r.id]=r;
        html+='<div class="leader-row">';
        html+='<div class="leader-info">';
        html+='<div class="leader-name">'+esc((r.name||'-').toUpperCase())+'</div>';
        html+='<div class="leader-meta">Ingin berteman</div>';
        html+='</div>';
        html+='<button class="leader-friend-btn" data-accept="'+esc(r.id)+'" data-name="'+esc(r.name||'')+'" style="background:linear-gradient(180deg,#a8f0cd,#3ddc97);">TERIMA</button>';
        html+='<button class="leader-friend-btn pending" data-reject="'+esc(r.id)+'">TOLAK</button>';
        html+='</div>';
      }
    }
    if(reqList)reqList.innerHTML=html;
    var acc=reqList?reqList.querySelectorAll('[data-accept]'):[];
    for(var a=0;a<acc.length;a++){
      acc[a].addEventListener('click',function(){
        acceptFriend(this.getAttribute('data-accept'),this.getAttribute('data-name'));
      });
    }
    var rej=reqList?reqList.querySelectorAll('[data-reject]'):[];
    for(var rj=0;rj<rej.length;rj++){
      rej[rj].addEventListener('click',function(){
        rejectFriend(this.getAttribute('data-reject'));
      });
    }
  }).catch(function(){});
  if(friendList){
    friendList.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Memuat...</div>';
  }
  db.ref('friends/'+DS().save.globalId).once('value').then(function(snap){
    var d=snap.val()||{};
    var fids=[];
    for(var k in d)fids.push(k);
    if(fids.length===0){
      if(friendList)friendList.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Belum ada teman</div>';
      return;
    }
    var loaded=0;
    var rows=[];
    for(var i=0;i<fids.length;i++){
      (function(fid){
        db.ref('users/'+fid).once('value').then(function(us){
          var u=us.val();
          if(!u){u={id:fid,name:'-',kills:0,level:1,lastSeen:0};}
          u.id=fid;
          DS().save.friends[fid]={id:fid,name:u.name,ts:Date.now()};
          rows.push(u);
          loaded++;
          if(loaded===fids.length)renderFriendRows(rows,friendList);
        }).catch(function(){
          loaded++;
          if(loaded===fids.length)renderFriendRows(rows,friendList);
        });
      })(fids[i]);
    }
    DS().persist();
  }).catch(function(){});
}

function renderFriendRows(rows,list){
  if(!list)return;
  rows.sort(function(a,b){return (b.kills||0)-(a.kills||0);});
  var html='';
  for(var i=0;i<rows.length;i++){
    var u=rows[i];
    var online=(Date.now()-(u.lastSeen||0))<60000;
    html+='<div class="leader-row friend">';
    html+='<div class="leader-rank" style="color:'+(online?'#3ddc97':'#8a8aa3')+';font-size:20px;">&bull;</div>';
    html+='<div class="leader-info">';
    html+='<div class="leader-name">'+esc((u.name||'-').toUpperCase())+'</div>';
    html+='<div class="leader-meta">LV '+(u.level||1)+' &middot; '+(online?'ONLINE':'offline')+'</div>';
    html+='</div>';
    html+='<div class="leader-kp">'+fmtK(u.kills||0)+'</div>';
    html+='<button class="leader-friend-btn pending" data-remove-friend="'+esc(u.id)+'" data-name="'+esc(u.name||'')+'">HAPUS</button>';
    html+='</div>';
  }
  list.innerHTML=html;
  var btns=list.querySelectorAll('[data-remove-friend]');
  for(var b=0;b<btns.length;b++){
    btns[b].addEventListener('click',function(){
      removeFriend(this.getAttribute('data-remove-friend'),this.getAttribute('data-name'));
    });
  }
}

function launchChallenge(ch){
  if(!ch)return;
  var baseLevel=DS().LEVELS[1];
  if(ch==='bossrush')baseLevel=DS().LEVELS[12];
  else if(ch==='speed')baseLevel=DS().LEVELS[3];
  else if(ch==='nohit')baseLevel=DS().LEVELS[2];
  else if(ch==='pistol')baseLevel=DS().LEVELS[4];
  var clone={};
  for(var k in baseLevel)clone[k]=baseLevel[k];
  if(ch==='speed')clone.duration=Math.round(baseLevel.duration*0.8);
  if(ch==='bossrush'){clone.isFinal=true;clone.duration=180;}
  DS().save.__lastChallenge=ch;
  DS().startLevel(clone,false);
  DS().showToast('Tantangan: '+ch.toUpperCase(),'info',2500);
}

function bindUI(){
  var createBtn=document.getElementById('mpCreateBtn');
  if(createBtn)createBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();createGroup();});
  var joinBtn=document.getElementById('mpJoinBtn');
  if(joinBtn)joinBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();joinGroup();});
  var globalBtn=document.getElementById('mpGlobalBtn');
  if(globalBtn)globalBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();enterGlobalMode();});
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
    if(mp.globalMode){
      leaveGroup();
      var ov=document.getElementById('overlay');
      if(ov)ov.classList.remove('on');
      DS().setAppState('menu');
      DS().showScreen('menu');
      return;
    }
    if(mp.playerRef)mp.playerRef.child('alive').set(false);
    leaveGroup();
    var ov=document.getElementById('overlay');
    if(ov)ov.classList.remove('on');
    DS().setAppState('menu');
    DS().showScreen('menu');
  });
  var startBtn=document.getElementById('mpStartBtn');
  if(startBtn)startBtn.addEventListener('click',function(){
    if(mp.globalMode){
      DS().initAudio();DS().sfxClick();
      startGlobalGame();
      return;
    }
    if(!mp.isHost)return;
    var cnt=0;
    for(var k in PC())cnt++;
    if(cnt<2){DS().showToast('Butuh minimal 2 pemain','error');return;}
    if(cnt>MAX_PLAYERS){DS().showToast('Maksimal '+MAX_PLAYERS+' pemain','error');return;}
    DS().initAudio();DS().sfxClick();
    if(mp.roomRef){
      mp.roomRef.update({
        mode: mp.selectedMode,
        state: 'playing'
      });
      startBtn.disabled=true;
      startBtn.textContent='MEMULAI...';
    }
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
  var searchBtn=document.getElementById('friendSearchBtn');
  if(searchBtn)searchBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();searchUsers();});
  var searchInput=document.getElementById('friendSearchInput');
  if(searchInput){
    searchInput.addEventListener('keydown',function(ev){
      ev.stopPropagation();
      if(ev.key==='Enter'||ev.keyCode===13){
        ev.preventDefault();
        DS().initAudio();
        searchUsers();
      }
    });
  }
  var chRows=document.querySelectorAll('#challengeScreen .challenge-row');
  for(var ci=0;ci<chRows.length;ci++){
    chRows[ci].addEventListener('click',function(){
      DS().initAudio();DS().sfxClick();
      var ch=this.getAttribute('data-challenge');
      DS().goScreen('level','levelSelect');
      setTimeout(function(){launchChallenge(ch);},650);
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
window.LB_renderLeaderboard=renderLeaderboard;
window.FR_renderFriends=renderFriends;
window.CH_launchChallenge=launchChallenge;

function boot(){
  initFirebase();
  bindUI();
  initPlayfield();
  var nameIn=document.getElementById('mpNameInput');
  if(nameIn&&DS().save.playerName)nameIn.value=DS().save.playerName;
  if(!DS().save.mpGifts)DS().save.mpGifts=0;
  if(!DS().save.trophies)DS().save.trophies=0;
  if(!DS().save.globalId){
    DS().save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    DS().persist();
  }
  if(!DS().save.friends)DS().save.friends={};
  if(!DS().save.friendRequests)DS().save.friendRequests={};
  if(!DS().save.friendSent)DS().save.friendSent={};
  syncUserProfile();
  requestAnimationFrame(mainLoop);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
