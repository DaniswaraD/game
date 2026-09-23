(function(){
'use strict';

var db=null;

var mp={
  roomCode:null,
  myId:null,
  hostId:null,
  isHost:false,
  playersCache:{},
  roomRef:null,
  playerRef:null,
  pollInterval:null,
  emojiRef:null,
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
  lastWrittenKills:null,
  sendModalOpen:false,
  pfCtx:null,
  pfCanvas:null,
  pfAnim:null,
  pfLastW:0,
  pfLastH:0,
  seenEmojis:{}
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
  mp.lastWrittenKills=null;
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
      kills:DS().save.kills,
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
    for(var k in players)names.push((players[k].name||'').toUpperCase());
    if(names.indexOf(name)>=0){DS().showToast('Nama sudah dipakai','error');return;}
    if(Object.keys(players).length>=5){DS().showToast('Grup sudah penuh','error');return;}
    var myId=genPlayerId();
    mp.myId=myId;
    mp.isHost=false;
    mp.hostId=data.hostId||null;
    mp.roomCode=code;
    mp.selectedMode=data.mode||1;
    mp.lastWrittenKills=null;
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
      kills:DS().save.kills,
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
  if(mp.pollInterval){clearInterval(mp.pollInterval);mp.pollInterval=null;}
  if(mp.roomRef){try{mp.roomRef.off();}catch(e){}}
  if(mp.emojiRef){try{mp.emojiRef.off();}catch(e){}}
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
    if(myData.kills!==undefined&&myData.kills!==mp.lastWrittenKills){
      DS().save.kills=myData.kills;
      mp.lastWrittenKills=myData.kills;
      DS().refreshHeaderKills();
      DS().refreshProfile();
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

  mp.pollInterval=setInterval(function(){
    if(mp.playerRef)mp.playerRef.child('lastSeen').set(Date.now());
  },5000);
}

function leaveGroup(){
  if(mp.roomRef&&mp.myId&&mp.roomCode){
    try{db.ref('rooms/'+mp.roomCode+'/players/'+mp.myId).remove();}catch(e){}
  }
  if(mp.pollInterval){clearInterval(mp.pollInterval);mp.pollInterval=null;}
  if(mp.roomRef){try{mp.roomRef.off();}catch(e){}mp.roomRef=null;}
  if(mp.emojiRef){try{mp.emojiRef.off();}catch(e){}mp.emojiRef=null;}
  mp.roomCode=null;
  mp.myId=null;
  mp.hostId=null;
  mp.isHost=false;
  MPApi().playersCache={};
  mp.startRequested=false;
  mp.finalSent=false;
  mp.gameEnded=false;
  mp.selectedMode=1;
  mp.lastWrittenKills=null;
  mp.miniTimers={};
  mp.inGameDead=false;
  mp.reviveCountdown=0;
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
    html+='<div class="mp-kills">KP <b>'+fmtK(pl.kills||0)+'</b></div>';
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
    if(ordered.length<2)wait.textContent='Menunggu pemain... ('+ordered.length+'/5) - Butuh minimal 2';
    else wait.textContent=ordered.length+' pemain di grup';
  }
  var startBtn=document.getElementById('mpStartBtn');
  if(startBtn){
    var canStart=mp.isHost&&ordered.length>=2&&ordered.length<=5;
    startBtn.disabled=!canStart;
    startBtn.textContent=mp.isHost?'START':'MENUNGGU HOST';
  }
  var mt=document.getElementById('mpModeTitle');
  if(mt)mt.textContent=mp.isHost?'PILIH MODE (HOST)':'MODE DIPILIH HOST';
  renderModeGrid();
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
  if(rel<0.05)rel=0.05;
  if(rel>0.95)rel=0.95;
  mp.lobbyX=rel;
  if(mp.playerRef)mp.playerRef.child('lobbyX').set(rel);
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

  var targetW=Math.round(cw*dpr);
  var targetH=Math.round(ch*dpr);
  if(cv.width!==targetW||cv.height!==targetH||mp.pfLastW!==cw||mp.pfLastH!==ch){
    cv.width=targetW;
    cv.height=targetH;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    mp.pfLastW=cw;
    mp.pfLastH=ch;
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
  mp.startRequested=true;
  mp.gameUpdateTimer=0;
  mp.inGameDead=false;
  mp.reviveCountdown=0;
  mp.lastWrittenKills=DS().save.kills;
  mp.gameEnded=false;
  mp.finalSent=false;
  mp.roomRef.child('state').set('playing');
  mp.roomRef.child('startAt').set(Date.now());
  mp.roomRef.child('mode').set(mp.selectedMode);
  setupGameHooks();
  DS().startLevel(lvl,true);
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.add('on');
  var spBtn=document.getElementById('mpSendPointsBtn');
  if(spBtn)spBtn.classList.add('on');
  var cel=document.getElementById('mpCelebration');
  if(cel)cel.classList.remove('on');
  var rb=document.getElementById('mpReviveBox');
  if(rb)rb.classList.remove('on');
  setTimeout(updateTopStats,600);
  setTimeout(updateTopStats,1600);
}

function setupGameHooks(){
  MPApi().onPlayerDeath=onLocalDeath;
  MPApi().onGameEnd=onLocalWin;
  MPApi().onTickDead=tickDead;
  MPApi().drawOtherPlayers=drawOtherPlayersInGame;
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
  if(mp.playerRef)mp.playerRef.child('alive').set(true);
  var cel=document.getElementById('mpCelebration');
  var title=document.getElementById('mpCelebTitle');
  var sub=document.getElementById('mpCelebSub');
  var conf=document.getElementById('mpCelebConfetti');
  if(conf){
    conf.innerHTML='';
    var colors=['#ffc857','#ff6b4a','#3ddc97','#67c7f0','#9b6bff','#ff77a9','#ffffff'];
    for(var i=0;i<80;i++){
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
  if(sub)sub.textContent='Semua pemain di-revive! Menampilkan hasil...';
  if(cel)cel.classList.add('on');
  DS().sfxVictory();
  setTimeout(function(){
    if(cel)cel.classList.remove('on');
    DS().save.mpWins=(DS().save.mpWins||0)+1;
    DS().checkAchievements();
    DS().persist();
    DS().showScreen('mpLobby');
    DS().setAppState('mpLobbyMenu');
    showMpResults();
    mp.startRequested=false;
    mp.finalSent=false;
    mp.gameEnded=false;
    MPApi().active=false;
    DS().refreshProfile();
    renderLobby();
  },3600);
}

function showMpResults(){
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){return (b.kills||0)-(a.kills||0);});
  var maxKills=1;
  for(var m=0;m<players.length;m++)if((players[m].kills||0)>maxKills)maxKills=players[m].kills;
  var html='';
  for(var j=0;j<players.length;j++){
    var pl=players[j];
    var kp=pl.kills||0;
    var pct=Math.round(kp/maxKills*100);
    if(pct<4)pct=4;
    html+='<div class="mp-bar-row">';
    html+='<div class="mp-bar-name">'+esc((pl.name||'-').toUpperCase())+'</div>';
    html+='<div class="mp-bar-track"><div class="mp-bar-fill" style="width:'+pct+'%"></div></div>';
    html+='<div class="mp-bar-info">'+fmtK(kp)+' KP</div>';
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
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  if(players.length===0){
    el.innerHTML='<div style="font-size:11px;color:#8a8aa3;">Menunggu data...</div>';
    return;
  }
  players.sort(function(a,b){return (b.kills||0)-(a.kills||0);});
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
    html+='<div class="mts-kill">'+fmtK(kp)+'</div>';
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
  var BASE_SIZE=DS().BASE_SIZE;
  var border=DS().BORDER;
  for(var k in PC()){
    if(k===mp.myId)continue;
    var pl=PC()[k];
    if(pl.alive===false)continue;
    if(pl.posX===undefined||pl.posHp===undefined)continue;
    var ox=pl.posX*W-BASE_SIZE/2;
    var elL=DS().edgeLeft(),elR=DS().edgeRight();
    if(ox<elL)ox=elL;
    if(ox+BASE_SIZE>elR)ox=elR-BASE_SIZE;
    var oy=H-border-160;
    var ship=DS().findShip(pl.ship||'default');
    var shape=DS().findShape(pl.shape||'square');
    var key=ship.id+'_'+shape.id;
    var cache=DS().playerSpriteCache();
    var spr=cache[key]||cache[ship.id+'_square']||cache['default_square'];
    if(!spr)continue;
    var glow=DS().playerGlowCache()[ship.id];
    var cx=ox+BASE_SIZE/2,cy=oy+BASE_SIZE/2;
    var hpRatio=pl.posHp;
    if(hpRatio<0)hpRatio=0;
    if(hpRatio>1)hpRatio=1;
    ctx.save();
    ctx.globalAlpha=0.85;
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillRect(ox-3,oy-26,BASE_SIZE+6,7);
    ctx.fillStyle='rgba(36,36,56,0.35)';
    ctx.fillRect(ox-2,oy-25,BASE_SIZE+4,5);
    ctx.fillStyle=hpRatio<0.35?'#ff6b4a':'#3ddc97';
    ctx.fillRect(ox,oy-24,BASE_SIZE*hpRatio,3);
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
  mp.lastWrittenKills=DS().save.kills;
  mp.playerRef.update({
    posX:p.x/DS().getW(),
    posHp:Math.max(0,p.hp/p.maxHp),
    alive:!mp.inGameDead,
    kills:DS().save.kills,
    ship:DS().save.selectedShip,
    shape:DS().save.selectedShape,
    gun:DS().save.selectedGun,
    skill:DS().save.selectedSkill||'',
    lastSeen:Date.now()
  });
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

function showFlyingEmoji(emojiChar,posX){
  var layer=document.getElementById('mpEmojiLayer');
  if(!layer)return;
  var el=document.createElement('div');
  el.className='mp-fly-emoji';
  el.textContent=emojiChar;
  var W=window.innerWidth;
  var H=window.innerHeight;
  var x=posX*W;
  if(x<40)x=40;
  if(x>W-40)x=W-40;
  el.style.left=x+'px';
  el.style.top=(H*0.55)+'px';
  el.style.transform='translate(-50%,-50%)';
  layer.appendChild(el);
  setTimeout(function(){
    if(el.parentNode)el.parentNode.removeChild(el);
  },2300);
}

function handleRemoteEmoji(emojiData){
  if(!emojiData)return;
  if(Date.now()-emojiData.ts>8000)return;
  var key=(emojiData.id||'')+'_'+(emojiData.ts||0)+'_'+(emojiData.nonce||'');
  if(mp.seenEmojis[key])return;
  mp.seenEmojis[key]=true;
  if(emojiData.id===mp.myId)return;
  showFlyingEmoji(emojiData.emoji,emojiData.posX||0.5);
  DS().sfxEmoji();
}

function openSendModal(){
  if(!MPApi().active)return;
  var modal=document.getElementById('mpSendPointsModal');
  if(!modal)return;
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
  var myRef=mp.roomRef.child('players/'+mp.myId+'/kills');
  var tgtRef=mp.roomRef.child('players/'+targetId+'/kills');
  DS().save.kills-=amt;
  mp.lastWrittenKills=DS().save.kills;
  DS().persist();
  myRef.set(DS().save.kills);
  tgtRef.transaction(function(cur){
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
    if(cnt>5){DS().showToast('Maksimal 5 pemain','error');return;}
    DS().initAudio();DS().sfxClick();
    if(mp.roomRef){
      mp.roomRef.child('mode').set(mp.selectedMode);
      mp.roomRef.child('state').set('playing');
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
  var spBtn=document.getElementById('mpSendPointsBtn');
  if(spBtn)spBtn.addEventListener('click',function(){DS().initAudio();DS().sfxClick();openSendModal();});
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

function boot(){
  initFirebase();
  bindUI();
  initPlayfield();
  var nameIn=document.getElementById('mpNameInput');
  if(nameIn&&DS().save.playerName)nameIn.value=DS().save.playerName;
  if(!DS().save.mpGifts)DS().save.mpGifts=0;
  requestAnimationFrame(mainLoop);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
