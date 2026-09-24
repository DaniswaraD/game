(function(){
'use strict';

var db=null;
var firebaseInitPromise=null;
var firebaseReady=false;
var MAX_PLAYERS=6;
var CHAT_MAX_STORE=80;
var CHAT_MAX_SHOW=60;
var KF_MAX_ITEMS=5;
var KF_LIFE=4000;
var USER_SYNC_INTERVAL=8000;
var ROOM_STALE_MS=6*3600*1000;
var PLAYER_STALE_MS=30000;

var mp={
  roomCode:null,myId:null,hostId:null,isHost:false,playersCache:{},
  roomRef:null,playerRef:null,chatRef:null,emojiRef:null,kfRef:null,
  enemyRef:null,bossRef:null,
  pollInterval:null,gameUpdateTimer:0,userSyncTimer:null,userRef:null,
  selectedMode:1,startRequested:false,finalSent:false,gameEnded:false,
  prevRoomState:'lobby',
  lobbyX:0.5,lobbyDragging:false,inGameDead:false,reviveCountdown:0,
  lastWrittenKp:null,sendModalOpen:false,
  pfCtx:null,pfCanvas:null,pfAnim:null,pfLastW:0,pfLastH:0,pfLastDPR:0,
  seenEmojis:{},seenKf:{},chatItems:[],kfItems:[],
  globalMode:false,globalRef:null,globalPlayerRef:null,
  globalKillfeedRef:null,globalChatRef:null,globalStatsRef:null,
  globalEnemyRef:null,globalBossRef:null,
  globalKillsTotal:0,globalPlayersOnline:0,globalPlayers:{},
  globalDead:false,globalReviveCountdown:0,globalStarting:false,
  isGlobalHost:false,hostCheckTimer:null,
  roomListLoading:false,
  waitingHostTimer:0,
  firebaseConnected:false
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
function modeLabel(id){
  for(var i=0;i<MP_MODES.length;i++)if(MP_MODES[i].id===id)return MP_MODES[i].label;
  return 'MUDAH';
}

function initFirebase(){
  if(firebaseInitPromise)return firebaseInitPromise;
  firebaseInitPromise=new Promise(function(resolve){
    try{
      if(typeof firebase==='undefined')return resolve(false);
      var cfg=window.FIREBASE_CONFIG||{};
      if(!cfg.databaseURL)return resolve(false);
      if(!firebase.apps.length)firebase.initializeApp(cfg);
      db=firebase.database();
      db.ref('.info/connected').on('value',function(snap){
        mp.firebaseConnected=!!snap.val();
      });
      firebaseReady=true;
      resolve(true);
    }catch(e){
      firebaseReady=false;
      mp.firebaseConnected=false;
      resolve(false);
    }
  });
  return firebaseInitPromise;
}

function normalizeUsername(v){
  return String(v||'').trim().toLowerCase();
}
function usernameEmail(username){
  return normalizeUsername(username)+'@danis-shooter.local';
}
function accountStatus(msg,error){
  var el=document.getElementById('accountStatus');
  if(el)el.textContent=msg||'';
  if(error)DS().showToast(msg,'error',4500);
}
function currentAuthUser(){
  return typeof firebase!=='undefined'&&firebase.auth?firebase.auth().currentUser:null;
}
function authErrorMessage(err,fallback){
  var code=err&&err.code?String(err.code):'';
  if(code==='auth/configuration-not-found')return 'Firebase Authentication belum dikonfigurasi. Aktifkan Authentication > Sign-in method > Email/Password di Firebase Console.';
  if(code==='auth/operation-not-allowed')return 'Login Email/Password belum diaktifkan di Firebase Authentication.';
  if(code==='auth/invalid-api-key')return 'Firebase API key tidak valid atau tidak cocok dengan project.';
  if(code==='auth/network-request-failed')return 'Koneksi ke Firebase gagal. Periksa internet dan Firebase project.';
  if(code==='auth/email-already-in-use')return 'Username sudah terdaftar.';
  if(code==='auth/invalid-credential')return 'Username atau password salah.';
  if(code==='auth/weak-password')return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
  return (err&&err.message)||fallback;
}
function requireAccount(){
  var u=currentAuthUser();
  if(u){
    DS().save.globalId=u.uid;
    DS().persist();
    return true;
  }
  DS().showToast('Masuk atau daftar akun terlebih dahulu','error',3500);
  var el=document.getElementById('accountUsername');
  if(el)el.focus();
  return false;
}
function refreshAccountUI(){
  var u=currentAuthUser();
  var box=document.getElementById('accountBox');
  var cur=document.getElementById('accountCurrent');
  var name=document.getElementById('accountCurrentName');
  var userInput=document.getElementById('accountUsername');
  var passInput=document.getElementById('accountPassword');
  var confirmInput=document.getElementById('accountPasswordConfirm');
  if(!box)return;
  if(u){
    var un=(DS().save.playerName||'PLAYER').toUpperCase();
    if(cur)cur.style.display='flex';
    if(name)name.textContent='LOGIN: '+un;
    if(userInput)userInput.style.display='none';
    if(passInput)passInput.style.display='none';
    if(confirmInput)confirmInput.style.display='none';
    var lb=document.getElementById('accountLoginBtn');if(lb)lb.style.display='none';
    var rb=document.getElementById('accountRegisterBtn');if(rb)rb.style.display='none';
    accountStatus('Akun aktif.');
  }else{
    if(cur)cur.style.display='none';
    if(userInput)userInput.style.display='block';
    if(passInput)passInput.style.display='block';
    if(confirmInput)confirmInput.style.display='block';
    var lb=document.getElementById('accountLoginBtn');if(lb)lb.style.display='block';
    var rb=document.getElementById('accountRegisterBtn');if(rb)rb.style.display='block';
    accountStatus('');
  }
}
function authReady(){return firebaseReady&&typeof firebase!=='undefined'&&!!firebase.auth;}
function authBusy(on){
  var a=document.getElementById('accountLoginBtn'),b=document.getElementById('accountRegisterBtn');
  if(a){a.disabled=!!on;a.style.opacity=on?'.65':'1';}
  if(b){b.disabled=!!on;b.style.opacity=on?'.65':'1';}
}
function authWithTimeout(action,ms){
  ms=ms||20000;
  var settled=false;
  return new Promise(function(resolve,reject){
    var timer=setTimeout(function(){
      if(settled)return;
      settled=true;
      reject({code:'auth/network-request-failed',message:'Koneksi Firebase terlalu lama. Coba lagi.'});
    },ms);
    Promise.resolve().then(action).then(function(value){
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      resolve(value);
    },function(err){
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      reject(err);
    });
  });
}
function accountLogin(){
  if(!authReady()){accountStatus('Firebase Authentication belum siap. Muat ulang halaman.',true);return;}
  var ui=document.getElementById('accountUsername'),pi=document.getElementById('accountPassword');
  var username=normalizeUsername(ui&&ui.value),password=pi&&pi.value||'';
  if(!/^[a-z0-9_]{3,16}$/.test(username)){accountStatus('Username: 3-16 karakter, hanya a-z, 0-9, underscore.',true);return;}
  if(password.length<6){accountStatus('Password minimal 6 karakter.',true);return;}
  authBusy(true);accountStatus('Masuk...');
  authWithTimeout(function(){return firebase.auth().signInWithEmailAndPassword(usernameEmail(username),password);}).then(function(result){
    DS().save.globalId=result.user.uid;DS().save.playerName=username.toUpperCase();DS().persist();
    accountStatus('Berhasil masuk.');refreshAccountUI();
    var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.add('hidden');
    return syncUserProfile();
  }).catch(function(err){accountStatus(authErrorMessage(err,'Login gagal.'),true);}).finally(function(){authBusy(false);});
}
function accountRegister(){
  if(!authReady()){accountStatus('Firebase Authentication belum siap. Muat ulang halaman.',true);return;}
  var ui=document.getElementById('accountUsername'),pi=document.getElementById('accountPassword'),ci=document.getElementById('accountPasswordConfirm');
  var username=normalizeUsername(ui&&ui.value),password=pi&&pi.value||'',confirm=ci&&ci.value||'';
  if(!/^[a-z0-9_]{3,16}$/.test(username)){accountStatus('Username: 3-16 karakter, hanya a-z, 0-9, underscore.',true);return;}
  if(password.length<6){accountStatus('Password minimal 6 karakter.',true);return;}
  if(password!==confirm){accountStatus('Konfirmasi password tidak sama.',true);return;}
  authBusy(true);accountStatus('Membuat akun...');
  var createdUser=null;
  authWithTimeout(function(){return firebase.auth().createUserWithEmailAndPassword(usernameEmail(username),password);}).then(function(result){
    createdUser=result.user;
    return db.ref('usernames/'+username).set(createdUser.uid).then(function(){return result;});
  }).then(function(result){
    DS().save.globalId=result.user.uid;DS().save.playerName=username.toUpperCase();DS().persist();
    return syncUserProfile();
  }).then(function(ok){
    if(ok===false)throw {code:'database/permission-denied',message:'Profil akun tidak dapat disimpan. Pastikan Firebase Rules terbaru sudah dipublish.'};
    accountStatus('Akun berhasil dibuat.');refreshAccountUI();
    var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.add('hidden');
  }).catch(function(err){
    if(createdUser&&err&&String(err.code||'').indexOf('database/')===0){
      db.ref('usernames/'+username).transaction(function(current){
        return current===createdUser.uid?null:current;
      }).catch(function(){});
      createdUser.delete().catch(function(){});
    }
    accountStatus(authErrorMessage(err,'Pendaftaran gagal.'),true);
  }).finally(function(){authBusy(false);});
}
function accountLogout(){
  if(!firebase.auth)return;
  firebase.auth().signOut().then(function(){DS().save.globalId='';DS().persist();refreshAccountUI();var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.remove('hidden');DS().showToast('Akun keluar','info',2200);});
}

function genRoomCode(){

  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',s='';
  for(var i=0;i<6;i++)s+=chars[(Math.random()*chars.length)|0];
  return s;
}
function genPlayerId(){return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);}
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
function nowTs(){return Date.now();}

function getUserProfile(){
  var s=DS().save;
  return {
    id:s.globalId,
    name:(s.playerName||'PLAYER').toUpperCase(),
    kills:s.kills||0,
    totalKills:s.totalKills||0,
    level:s.level||1,
    xp:s.xp||0,
    trophies:s.trophies||0,
    ship:s.selectedShip,
    shape:s.selectedShape,
    gun:s.selectedGun,
    pet:s.selectedPet||'',
    wins:s.mpWins||0,
    lastSeen:nowTs()
  };
}

function syncUserProfile(){
  var au=currentAuthUser();
  if(!db||!au)return Promise.resolve(false);
  var uid=au.uid;
  DS().save.globalId=uid;
  if(!mp.userRef||mp.userRef.key!==uid)mp.userRef=db.ref('users/'+uid);
  var profile=getUserProfile();profile.id=uid;
  var publicProfile={id:uid,name:profile.name,kills:profile.kills,totalKills:profile.totalKills,level:profile.level,xp:profile.xp,trophies:profile.trophies,wins:profile.wins,lastSeen:profile.lastSeen};
  return Promise.all([mp.userRef.update(profile),db.ref('leaderboard/'+uid).update(publicProfile)]).then(function(){
    mp.firebaseConnected=true;
    if(!mp.userSyncTimer){
      mp.userSyncTimer=setInterval(function(){
        var u=currentAuthUser();
        if(!db||!u)return;
        var p=getUserProfile();p.id=u.uid;
        var pub={id:u.uid,name:p.name,kills:p.kills,totalKills:p.totalKills,level:p.level,xp:p.xp,trophies:p.trophies,wins:p.wins,lastSeen:p.lastSeen};
        Promise.all([db.ref('users/'+u.uid).update(p),db.ref('leaderboard/'+u.uid).update(pub)]).catch(function(){mp.firebaseConnected=false;});
      },USER_SYNC_INTERVAL);
    }
    return true;
  }).catch(function(err){
    mp.firebaseConnected=false;
    var code=err&&err.code?String(err.code):'unknown';
    DS().showToast('Sinkronisasi profil gagal: '+code,'error',4200);
    return false;
  });
}

function getGlobalLevel(){
  var base=DS().LEVELS[1];
  return {
    id:'global_arena',
    name:'GLOBAL ARENA',
    chapter:99,
    unlockCost:0,
    cardClass:'endless',
    duration:Infinity,
    theme:base.theme,
    stageLength:base.stageLength,
    enemiesPerSecond:base.enemiesPerSecond,
    baseMaxActive:base.baseMaxActive,
    maxActiveGrowth:base.maxActiveGrowth,
    maxActiveCap:base.maxActiveCap,
    hpMult:base.hpMult*1.15,
    dmgMult:base.dmgMult*1.15,
    healFreqMult:base.healFreqMult,
    throttleRatio:99,
    bossInterval:22,
    isEndless:true,
    bossesCanStack:true,
    spawnRateMult:1.4
  };
}

function createGroup(){
  if(!requireAccount())return;
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Nama minimal 3 karakter','error');return;}
  if(name.length>10){DS().showToast('Nama maksimal 10 karakter','error');return;}
  if(!db){DS().showToast('Database belum siap','error');return;}
  DS().save.playerName=name;
  DS().persist();
  syncUserProfile();
  var code=genRoomCode();
  var myId=currentAuthUser().uid;
  mp.myId=myId;
  mp.isHost=true;
  mp.roomCode=code;
  mp.selectedMode=1;
  mp.lastWrittenKp=null;
  mp.lobbyX=0.5;
  mp.gameEnded=false;
  mp.globalMode=false;
  mp.prevRoomState='lobby';
  mp.startRequested=false;
  mp.finalSent=false;
  var ref=db.ref('rooms/'+code);
  ref.once('value',function(snap){
    if(snap.exists()){createGroup();return;}
    var me={
      id:myId,name:name,
      ship:DS().save.selectedShip,
      shape:DS().save.selectedShape,
      gun:DS().save.selectedGun,
      skill:DS().save.selectedSkill||'',
      pet:DS().save.selectedPet||'',
      alive:true,kills:0,
      kp:DS().save.kills,
      level:DS().save.level,
      xp:DS().save.xp,
      joinedAt:nowTs(),lastSeen:nowTs(),
      lobbyX:0.5,posX:0.5,posHp:1
    };
    var data={
      code:code,hostId:myId,
      state:'lobby',mode:1,
      createdAt:nowTs(),startAt:0,
      players:{}
    };
    data.players[myId]=me;
    ref.set(data,function(err){
      if(err){DS().showToast('Gagal buat grup','error');return;}
      mp.hostId=myId;
      attachListeners(code,myId,true);
      DS().showScreen('mpLobby');
      var codeEl=document.getElementById('mpRoomCode');
      if(codeEl)codeEl.textContent=code;
      renderLobby();
      DS().sfxMP();
    });
  });
}

function joinGroup(){
  if(!requireAccount())return;
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Nama minimal 3 karakter','error');return;}
  if(name.length>10){DS().showToast('Nama maksimal 10 karakter','error');return;}
  var code=(document.getElementById('mpCodeInput').value||'').trim().toUpperCase();
  if(code.length!==6){DS().showToast('Kode grup harus 6 karakter','error');return;}
  joinGroupByCode(code,name);
}

function joinGroupByCode(code,nameInput){
  if(!db){DS().showToast('Database belum siap','error');return;}
  var name=(nameInput||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Nama minimal 3 karakter','error');return;}
  if(name.length>10){DS().showToast('Nama maksimal 10 karakter','error');return;}
  DS().save.playerName=name;
  DS().persist();
  syncUserProfile();
  var ref=db.ref('rooms/'+code);
  ref.once('value',function(snap){
    if(!snap.exists()){DS().showToast('Grup tidak ditemukan','error');return;}
    var data=snap.val();
    if(!data){DS().showToast('Grup tidak valid','error');return;}
    if(data.state==='playing'){DS().showToast('Grup sedang bermain','error');return;}
    var players=data.players||{};
    var hostId=data.hostId;
    if(hostId&&!players[hostId]){
      DS().showToast('Host grup sudah keluar','error');
      ref.remove();
      return;
    }
    var names=[],cnt=0;
    for(var k in players){names.push((players[k].name||'').toUpperCase());cnt++;}
    if(names.indexOf(name)>=0){DS().showToast('Nama sudah dipakai','error');return;}
    if(cnt>=MAX_PLAYERS){DS().showToast('Grup sudah penuh','error');return;}
    var myId=currentAuthUser().uid;
    mp.myId=myId;
    mp.isHost=false;
    mp.hostId=hostId;
    mp.roomCode=code;
    mp.selectedMode=data.mode||1;
    mp.lastWrittenKp=null;
    mp.lobbyX=0.5;
    mp.gameEnded=false;
    mp.globalMode=false;
    mp.prevRoomState=data.state||'lobby';
    mp.startRequested=false;
    mp.finalSent=false;
    var me={
      id:myId,name:name,
      ship:DS().save.selectedShip,
      shape:DS().save.selectedShape,
      gun:DS().save.selectedGun,
      skill:DS().save.selectedSkill||'',
      pet:DS().save.selectedPet||'',
      alive:true,kills:0,
      kp:DS().save.kills,
      level:DS().save.level,
      xp:DS().save.xp,
      joinedAt:nowTs(),lastSeen:nowTs(),
      lobbyX:0.5,posX:0.5,posHp:1
    };
    var updates={};
    updates['players/'+myId]=me;
    if(data.state==='ended'||data.state==='lobby'){
      updates['state']='lobby';
      updates['startAt']=0;
      mp.prevRoomState='lobby';
    }
    ref.update(updates,function(err){
      if(err){DS().showToast('Gagal masuk grup','error');return;}
      attachListeners(code,myId,false);
      DS().showScreen('mpLobby');
      var codeEl=document.getElementById('mpRoomCode');
      if(codeEl)codeEl.textContent=code;
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
  MPApi().isGlobalHost=isHost;
  MPApi().globalMode=false;
  MPApi().networkMode=true;
  MPApi().roomCode=code;
  MPApi().active=false;
  MPApi().dead=false;
  MPApi().myKills=0;
  MPApi().myKillCount=0;
  detachAll();
  mp.roomRef=db.ref('rooms/'+code);
  mp.playerRef=db.ref('rooms/'+code+'/players/'+myId);
  MPApi().roomRef=mp.roomRef;
  MPApi().playerRef=mp.playerRef;
  mp.enemyRef=mp.roomRef.child('enemies');
  mp.bossRef=mp.roomRef.child('bosses');
  mp.playerRef.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
  mp.playerRef.onDisconnect().remove();
  if(isHost){
    mp.roomRef.onDisconnect().remove();
  }
  mp.roomRef.on('value',function(snap){
    var data=snap.val();
    if(!data){DS().showToast('Grup dibubarkan','error');leaveGroup();return;}
    var players=data.players||{};
    MPApi().playersCache=players;
    mp.hostId=data.hostId||null;
    MPApi().isHost=(data.hostId===myId);
    MPApi().isGlobalHost=(data.hostId===myId);
    if(data.mode!==undefined)mp.selectedMode=data.mode;
    if(!players[myId]){DS().showToast('Kamu dikeluarkan dari grup','error');leaveGroup();return;}
    if(data.hostId&&!players[data.hostId]){
      DS().showToast('Host keluar dari grup','error');
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
    var curState=data.state||'lobby';
    if(curState!==mp.prevRoomState){
      if(mp.prevRoomState==='lobby'&&curState==='playing'){
        mp.waitingHostTimer=0;
        if(!mp.startRequested){mp.startRequested=true;startGame();}
      }
      if(mp.prevRoomState==='playing'&&curState==='ended'){
        if(!mp.finalSent){mp.finalSent=true;onRoomEnded();}
      }
      mp.prevRoomState=curState;
    }
    var st=DS().getAppState();
    if(st==='mpLobbyMenu')renderLobby();
    if(st==='playingMP')updateTopStats();
  });
  mp.emojiRef=mp.roomRef.child('lastEmoji');
  mp.emojiRef.on('value',function(snap){var d=snap.val();if(d)handleRemoteEmoji(d);});
  mp.kfRef=mp.roomRef.child('killfeed');
  mp.kfRef.on('value',function(snap){var d=snap.val();if(d)handleRemoteKillFeed(d);});
  mp.chatRef=mp.roomRef.child('chat');
  mp.chatRef.limitToLast(CHAT_MAX_STORE).on('child_added',function(snap){
    var d=snap.val();
    if(!d)return;
    var key=snap.key;
    if(mp.seenEmojis['c_'+key])return;
    mp.seenEmojis['c_'+key]=true;
    addChatItem(d);
  });
  mp.enemyRef.on('value',function(snap){
    var d=snap.val()||{};
    if(window.DS_MP)window.DS_MP.globalEnemiesCache=d;
  });
  mp.bossRef.on('value',function(snap){
    var d=snap.val()||{};
    if(window.DS_MP)window.DS_MP.globalBossesCache=d;
  });
  mp.pollInterval=setInterval(function(){
    if(mp.playerRef)mp.playerRef.child('lastSeen').set(nowTs());
  },5000);
}

function detachAll(){
  if(mp.pollInterval){clearInterval(mp.pollInterval);mp.pollInterval=null;}
  if(mp.roomRef){try{mp.roomRef.off();}catch(e){}mp.roomRef=null;}
  if(mp.emojiRef){try{mp.emojiRef.off();}catch(e){}mp.emojiRef=null;}
  if(mp.kfRef){try{mp.kfRef.off();}catch(e){}mp.kfRef=null;}
  if(mp.chatRef){try{mp.chatRef.off();}catch(e){}mp.chatRef=null;}
  if(mp.enemyRef){try{mp.enemyRef.off();}catch(e){}mp.enemyRef=null;}
  if(mp.bossRef){try{mp.bossRef.off();}catch(e){}mp.bossRef=null;}
}

function detachGlobal(){
  if(mp.globalRef){try{mp.globalRef.off();}catch(e){}mp.globalRef=null;}
  if(mp.globalPlayerRef){try{mp.globalPlayerRef.off();}catch(e){}mp.globalPlayerRef=null;}
  if(mp.globalKillfeedRef){try{mp.globalKillfeedRef.off();}catch(e){}mp.globalKillfeedRef=null;}
  if(mp.globalChatRef){try{mp.globalChatRef.off();}catch(e){}mp.globalChatRef=null;}
  if(mp.globalStatsRef){try{mp.globalStatsRef.off();}catch(e){}mp.globalStatsRef=null;}
  if(mp.globalEnemyRef){try{mp.globalEnemyRef.off();}catch(e){}mp.globalEnemyRef=null;}
  if(mp.globalBossRef){try{mp.globalBossRef.off();}catch(e){}mp.globalBossRef=null;}
  if(mp.hostCheckTimer){clearInterval(mp.hostCheckTimer);mp.hostCheckTimer=null;}
  mp.globalKillsTotal=0;
  mp.globalPlayersOnline=0;
  mp.globalPlayers={};
}

function resetLobbyUI(){
  var mr=document.getElementById('mpMiniRow');if(mr)mr.innerHTML='';
  var mpl=document.getElementById('mpPlayers');if(mpl)mpl.innerHTML='';
  var em=document.getElementById('mpEmojiLayer');if(em)em.innerHTML='';
  var cel=document.getElementById('mpCelebration');if(cel)cel.classList.remove('on');
  var ts=document.getElementById('mpTopStats');if(ts)ts.classList.remove('on');
  var sm=document.getElementById('mpSendPointsModal');if(sm)sm.classList.remove('on');
  var cl=document.getElementById('mpChatList');
  if(cl)cl.innerHTML='<div class="mp-chat-empty">Belum ada pesan</div>';
  var cc=document.getElementById('mpChatCount');if(cc)cc.textContent='0';
  var kf=document.getElementById('killFeed');if(kf){kf.innerHTML='';kf.classList.remove('on');}
  var lb=document.getElementById('mpLevelBadge');if(lb)lb.classList.remove('on');
  var gs=document.getElementById('mpGlobalStats');if(gs)gs.classList.remove('on');
  var rb=document.getElementById('mpReviveBox');if(rb)rb.classList.remove('on');
}

function leaveGroup(){
  if(mp.globalMode){leaveGlobal();return;}
  if(mp.roomRef&&mp.myId&&mp.roomCode){
    try{
      if(mp.isHost){
        db.ref('rooms/'+mp.roomCode).remove();
      }else{
        db.ref('rooms/'+mp.roomCode+'/players/'+mp.myId).remove();
      }
    }catch(e){}
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
  mp.prevRoomState='lobby';
  mp.selectedMode=1;
  mp.lastWrittenKp=null;
  mp.inGameDead=false;
  mp.reviveCountdown=0;
  mp.chatItems=[];
  mp.kfItems=[];
  mp.seenEmojis={};
  mp.seenKf={};
  mp.waitingHostTimer=0;
  MPApi().active=false;
  MPApi().dead=false;
  MPApi().myId=null;
  MPApi().roomRef=null;
  MPApi().playerRef=null;
  MPApi().isHost=false;
  MPApi().isGlobalHost=false;
  MPApi().networkMode=false;
  if(window.DS_MP){
    window.DS_MP.globalEnemiesCache={};
    window.DS_MP.globalBossesCache={};
  }
  resetLobbyUI();
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
  MPApi().networkMode=false;
  MPApi().isGlobalHost=false;
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
  mp.globalStarting=false;
  mp.isGlobalHost=false;
  if(window.DS_MP){
    window.DS_MP.globalEnemiesCache={};
    window.DS_MP.globalBossesCache={};
  }
  resetLobbyUI();
}

function renderLobby(){
  if(mp.globalMode){renderGlobalLobby();return;}
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var hostId=mp.hostId,host=null,members=[];
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
    if(mp.isHost&&pl.id!==mp.myId)html+='<button class="mp-kick-btn" data-kick="'+pl.id+'">X</button>';
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
  DS().drawShipCentered(ctx,ship,shape,cv.width,cv.height,{glow:true,glowAlpha:0.55,zoom:0.92,offsetY:0,alpha:pl.alive===false?0.4:1});
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
function pfTouchStart(ev){ev.preventDefault();mp.lobbyDragging=true;pfUpdateFromX(ev.touches[0].clientX);}
function pfTouchMove(ev){if(!mp.lobbyDragging)return;ev.preventDefault();pfUpdateFromX(ev.touches[0].clientX);}
function pfMouseDown(ev){mp.lobbyDragging=true;pfUpdateFromX(ev.clientX);}
function pfMouseMove(ev){if(!mp.lobbyDragging)return;pfUpdateFromX(ev.clientX);}
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
  var st=DS().getAppState();
  if(st!=='mpLobbyMenu'&&st!=='globalLobby')return;
  var dpr=window.devicePixelRatio||1;
  var cw=cv.clientWidth,ch=cv.clientHeight;
  if(cw<=0||ch<=0)return;
  var tw=Math.round(cw*dpr),th=Math.round(ch*dpr);
  if(cv.width!==tw||cv.height!==th||mp.pfLastW!==cw||mp.pfLastH!==ch||mp.pfLastDPR!==dpr){
    cv.width=tw;cv.height=th;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    mp.pfLastW=cw;mp.pfLastH=ch;mp.pfLastDPR=dpr;
  }
  ctx.clearRect(0,0,cw,ch);
  var t=performance.now();
  var players=[];
  for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var sz=Math.min(cw*0.20,ch*0.55);
  if(sz<34)sz=34;
  if(sz>74)sz=74;
  var myId=mp.globalMode?DS().save.globalId:mp.myId;
  for(var i=0;i<players.length;i++){
    var pl=players[i];
    var x=(pl.lobbyX!==undefined&&pl.lobbyX!==null)?pl.lobbyX:0.5;
    var isMe=pl.id===myId;
    if(isMe)x=mp.lobbyX;
    var cx=x*cw;
    if(cx<sz*0.55)cx=sz*0.55;
    if(cx>cw-sz*0.55)cx=cw-sz*0.55;
    var cy=ch*0.52;
    var bob=Math.sin(t*0.003+i*1.3)*4;
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
    var myId=mp.globalMode?DS().save.globalId:mp.myId;
    for(var i=0;i<mp.chatItems.length;i++){
      var c=mp.chatItems[i];
      var mine=c.id===myId?' mine':'';
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
    ts:nowTs()
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
  var W=window.innerWidth,H=window.innerHeight;
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
    ts:nowTs(),
    nonce:Math.random().toString(36).slice(2,7)
  };
  if(mp.globalMode&&mp.globalRef)mp.globalRef.child('lastEmoji').set(data);
  else if(mp.roomRef)mp.roomRef.child('lastEmoji').set(data);
  showFlyingEmoji(emojiChar,mp.lobbyX);
  DS().sfxEmoji();
}
function handleRemoteEmoji(d){
  if(!d)return;
  if(nowTs()-d.ts>8000)return;
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
  var me=mp.globalMode?{name:DS().save.playerName||'PLAYER'}:PC()[mp.myId];
  var data={
    killerId:mp.globalMode?DS().save.globalId:mp.myId,
    killerName:(me&&me.name)||(DS().save.playerName||'PLAYER'),
    targetName:targetName||'Musuh',
    ts:nowTs(),
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
  if(nowTs()-d.ts>6000)return;
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

function spawnGlobalEnemy(e){
  if(!db||!e||!e.id)return;
  if(!MPApi().isGlobalHost)return;
  var base=mp.globalMode?'global_arena':('rooms/'+mp.roomCode);
  db.ref(base+'/enemies/'+e.id).set({
    id:e.id,
    type:e.type,
    x:e.x,
    startY:e.y,
    spawnTime:e.spawnTime||nowTs(),
    hp:e.hp,
    maxHp:e.maxHp,
    damage:e.damage,
    shape:e.shape||'square',
    isMiniBoss:!!e.isMiniBoss,
    speed:e.speed||0
  });
}
function spawnGlobalBoss(b){
  if(!db||!b||!b.id)return;
  if(!MPApi().isGlobalHost)return;
  var base=mp.globalMode?'global_arena':('rooms/'+mp.roomCode);
  db.ref(base+'/bosses/'+b.id).set({
    id:b.id,
    idx:b.idx,
    x:b.x,
    y:b.y,
    hp:b.hp,
    maxHp:b.maxHp,
    spawnTime:nowTs(),
    speed:b.speed||20,
    baseX:b.baseX,
    moveRange:b.moveRange,
    phase:b.phase||0
  });
}
function damageGlobalEnemy(id,dmg){
  if(!db||!id)return;
  var base=mp.globalMode?'global_arena':('rooms/'+mp.roomCode);
  db.ref(base+'/enemies/'+id+'/hp').transaction(function(cur){
    if(cur===null)return null;
    var nv=cur-dmg;
    if(nv<0)nv=0;
    return nv;
  });
}
function damageGlobalBoss(id,dmg){
  if(!db||!id)return;
  var base=mp.globalMode?'global_arena':('rooms/'+mp.roomCode);
  db.ref(base+'/bosses/'+id+'/hp').transaction(function(cur){
    if(cur===null)return null;
    var nv=cur-dmg;
    if(nv<0)nv=0;
    return nv;
  });
}
function killGlobalEnemy(id){
  if(!db||!id)return;
  var base=mp.globalMode?'global_arena':('rooms/'+mp.roomCode);
  db.ref(base+'/enemies/'+id).remove();
}

function enterGlobalMode(){
  if(!requireAccount())return;
  if(!db){
    if(firebaseInitPromise){
      DS().showToast('Menghubungkan ke server global...','info',2500);
      firebaseInitPromise.then(function(ok){
        if(ok)enterGlobalMode();
        else DS().showToast('Mode global gagal terhubung ke Firebase','error',4000);
      });
    }else{
      DS().showToast('Database belum siap','error');
    }
    return;
  }
  var name=(document.getElementById('mpNameInput').value||'').trim().toUpperCase();
  if(name.length<3){DS().showToast('Isi nama minimal 3 karakter dulu','error');return;}
  DS().save.playerName=name;
  DS().persist();
  syncUserProfile();
  var myId=currentAuthUser().uid;
  DS().save.globalId=myId;
  DS().persist();
  mp.globalMode=true;
  mp.myId=myId;
  mp.globalDead=false;
  mp.globalReviveCountdown=0;
  mp.gameEnded=false;
  mp.finalSent=false;
  mp.startRequested=true;
  mp.globalStarting=false;
  mp.globalRef=db.ref('global_arena');
  mp.globalPlayerRef=db.ref('global_arena/players/'+myId);
  mp.globalKillfeedRef=db.ref('global_arena/killfeed');
  mp.globalChatRef=db.ref('global_arena/chat');
  mp.globalStatsRef=db.ref('global_arena/stats');
  mp.globalEnemyRef=db.ref('global_arena/enemies');
  mp.globalBossRef=db.ref('global_arena/bosses');
  MPApi().active=true;
  MPApi().globalMode=true;
  MPApi().networkMode=true;
  MPApi().myId=myId;
  MPApi().isHost=false;
  MPApi().dead=false;
  MPApi().roomCode=null;
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
    joinedAt:nowTs(),
    lastSeen:nowTs(),
    lobbyX:0.5,
    posX:0.5,
    posHp:1
  };
  mp.globalPlayerRef.set(me,function(err){
    if(err){
      var code=err&&err.code?err.code:'UNKNOWN';
      var msg=err&&err.message?err.message:'Operasi database ditolak';
      DS().showToast('Global gagal: '+code+' '+msg,'error',6000);
      mp.globalMode=false;
      MPApi().globalMode=false;
      MPApi().networkMode=false;
      mp.globalPlayerRef=null;
      return;
    }
    attachGlobalListeners(myId);
    DS().showScreen('mpLobby');
    var codeEl=document.getElementById('mpRoomCode');
    if(codeEl)codeEl.textContent='GLOBAL';
    renderGlobalLobby();
    DS().sfxMP();
    DS().showToast('Masuk Mode Global! Semua pemain online bergabung.','success',3000);
  });
}

function checkGlobalHost(){
  var players=PC();
  var candidates=[];
  for(var k in players){
    if(nowTs()-(players[k].lastSeen||0)<PLAYER_STALE_MS){
      candidates.push({id:k,joined:players[k].joinedAt||0});
    }
  }
  candidates.sort(function(a,b){
    if(a.joined!==b.joined)return a.joined-b.joined;
    return a.id<b.id?-1:(a.id>b.id?1:0);
  });
  var hostId=candidates.length>0?candidates[0].id:null;
  var amHost=(hostId===DS().save.globalId);
  if(amHost!==mp.isGlobalHost){
    mp.isGlobalHost=amHost;
    MPApi().isGlobalHost=amHost;
  }
}

function attachGlobalListeners(myId){
  mp.globalRef.child('players').on('value',function(snap){
    var d=snap.val()||{};
    mp.globalPlayersOnline=0;
    var cache={};
    for(var k in d){
      if(nowTs()-(d[k].lastSeen||0)<PLAYER_STALE_MS){
        cache[k]=d[k];
        mp.globalPlayersOnline++;
      }
    }
    mp.globalPlayers=cache;
    MPApi().playersCache=cache;
    checkGlobalHost();
    var st=DS().getAppState();
    if(st==='mpLobbyMenu'||st==='globalLobby')renderGlobalLobby();
    if(st==='playingMP')updateTopStats();
    updateGlobalStatsBar();
  });
  mp.globalKillfeedRef.on('value',function(snap){
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
  mp.globalEnemyRef.on('value',function(snap){
    var d=snap.val()||{};
    if(window.DS_MP)window.DS_MP.globalEnemiesCache=d;
  });
  mp.globalBossRef.on('value',function(snap){
    var d=snap.val()||{};
    if(window.DS_MP)window.DS_MP.globalBossesCache=d;
  });
  mp.globalPlayerRef.onDisconnect().remove();
  if(mp.pollInterval){clearInterval(mp.pollInterval);}
  mp.pollInterval=setInterval(function(){
    if(mp.globalPlayerRef)mp.globalPlayerRef.child('lastSeen').set(nowTs());
  },5000);
  if(mp.hostCheckTimer)clearInterval(mp.hostCheckTimer);
  mp.hostCheckTimer=setInterval(checkGlobalHost,5000);
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
  var shown=0,maxShow=12;
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
    startBtn.disabled=!!mp.globalStarting;
    startBtn.textContent=mp.globalStarting?'MEMULAI...':'MULAI GLOBAL';
  }
  var mt=document.getElementById('mpModeTitle');
  if(mt)mt.textContent='MODE GLOBAL AKTIF';
  var mg=document.getElementById('mpModeGrid');
  if(mg)mg.innerHTML='<div style="grid-column:1/-1;text-align:center;font-size:11px;color:#4a4a63;padding:8px;">Semua pemain bermain bersamaan. Arena tanpa batas waktu.</div>';
  renderChat();
}

function startGame(){
  if(mp.globalMode){startGlobalGame();return;}
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
  MPApi().isGlobalHost=mp.isHost;
  MPApi().networkMode=true;
  MPApi().globalMode=false;
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
  if(window.DS_MP){
    window.DS_MP.globalEnemiesCache={};
    window.DS_MP.globalBossesCache={};
  }
  setupGameHooks();
  var roomRef=mp.roomRef;
  var players=PC();
  var updates={};
  for(var pid in players){
    updates['players/'+pid+'/kills']=0;
    updates['players/'+pid+'/alive']=true;
    updates['players/'+pid+'/posHp']=1;
  }
  updates['mode']=mp.selectedMode;
  updates['startAt']=nowTs()+600;
  roomRef.update(updates);
  var kf=document.getElementById('killFeed');
  if(kf){kf.innerHTML='';kf.classList.add('on');}
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.add('on');
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
  if(mp.globalStarting)return;
  mp.globalStarting=true;
  var lvl=getGlobalLevel();
  MPApi().active=true;
  MPApi().dead=false;
  MPApi().myId=DS().save.globalId;
  MPApi().globalMode=true;
  MPApi().networkMode=true;
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
  if(window.DS_MP){
    window.DS_MP.globalEnemiesCache={};
    window.DS_MP.globalBossesCache={};
  }
  setupGameHooks();
  var kf=document.getElementById('killFeed');
  if(kf){kf.innerHTML='';kf.classList.add('on');}
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.add('on');
  var ts=document.getElementById('mpTopStats');
  if(ts)ts.classList.add('on');
  setTimeout(function(){
    DS().startLevel(lvl,true);
    DS().updateMPLevelBadge();
    mp.globalStarting=false;
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
  window.MP_spawnGlobalEnemy=spawnGlobalEnemy;
  window.MP_spawnGlobalBoss=spawnGlobalBoss;
  window.MP_damageGlobalEnemy=damageGlobalEnemy;
  window.MP_damageGlobalBoss=damageGlobalBoss;
  window.MP_killGlobalEnemy=killGlobalEnemy;
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
  var ts=document.getElementById('mpTopStats');if(ts)ts.classList.remove('on');
  var rb=document.getElementById('mpReviveBox');if(rb)rb.classList.remove('on');
  var lb=document.getElementById('mpLevelBadge');if(lb)lb.classList.remove('on');
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
  var wasHost=mp.isHost;
  var roomRefRef=mp.roomRef;
  mp.startRequested=false;
  mp.finalSent=false;
  mp.gameEnded=false;
  mp.prevRoomState='lobby';
  setTimeout(function(){
    if(cel)cel.classList.remove('on');
    DS().showScreen('mpLobby');
    DS().setAppState('mpLobbyMenu');
    showMpResults(sorted,myRank);
    MPApi().active=false;
    if(wasHost&&roomRefRef){
      try{roomRefRef.update({state:'lobby',startAt:0});}catch(e){}
    }
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
    var rank=j+1,color='#4a4a63',icon='';
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
  var W=DS().getW(),H=DS().getH(),BS=DS().BASE_SIZE,border=DS().BORDER;
  var cache=mp.globalMode?mp.globalPlayers:PC();
  var myId=mp.globalMode?DS().save.globalId:mp.myId;
  for(var k in cache){
    if(k===myId)continue;
    var pl=cache[k];
    if(pl.alive===false)continue;
    if(pl.posX===undefined)continue;
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
    var glow=DS().playerGlowCache()[ship.id];
    var cx=ox+BS/2,cy=oy+BS/2;
    var hpRatio=clamp(pl.posHp===undefined?1:pl.posHp,0,1);
    ctx.save();ctx.globalAlpha=0.92;ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fillRect(ox-3,oy-26,BS+6,7);ctx.fillStyle='rgba(36,36,56,0.35)';ctx.fillRect(ox-2,oy-25,BS+4,5);ctx.fillStyle=hpRatio<0.35?'#ff6b4a':'#3ddc97';ctx.fillRect(ox,oy-24,BS*hpRatio,3);ctx.restore();
    if(glow&&glow.normal&&glow.normal.canvas){ctx.save();ctx.globalAlpha=0.28;ctx.drawImage(glow.normal.canvas,cx-glow.R,cy-glow.R);ctx.restore();}
    ctx.save();ctx.globalAlpha=0.98;
    if(spr&&spr.normal&&spr.normal.canvas){ctx.drawImage(spr.normal.canvas,ox-spr.pad,oy-spr.pad);}
    else{ctx.fillStyle=ship.body||'#67c7f0';ctx.strokeStyle=ship.edge||'#1a6a7a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,oy+4);ctx.lineTo(ox+BS-5,oy+BS-6);ctx.lineTo(ox+5,oy+BS-6);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=ship.cockpit||'#fff';ctx.beginPath();ctx.arc(cx,oy+BS*0.38,BS*0.13,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    ctx.save();ctx.globalAlpha=0.9;ctx.font='bold 11px Fredoka,sans-serif';ctx.textAlign='center';ctx.lineWidth=3.5;ctx.strokeStyle='rgba(36,36,56,0.9)';var label=(pl.name||'-').toUpperCase();ctx.strokeText(label,cx,oy-32);ctx.fillStyle='#fff';ctx.fillText(label,cx,oy-32);ctx.restore();
  }
}

function gameSyncTick(dt){
  if(!MPApi().active)return;
  var ref=mp.globalMode?mp.globalPlayerRef:mp.playerRef;
  if(!ref)return;
  mp.gameUpdateTimer-=dt;
  if(mp.gameUpdateTimer>0)return;
  mp.gameUpdateTimer=0.1;
  var p=DS().getPlayer();
  if(!p)return;
  mp.lastWrittenKp=DS().save.kills;
  ref.update({
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
    lastSeen:nowTs()
  });
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
  var html='',cnt=0;
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
  mp.roomRef.child('players/'+targetId+'/kp').transaction(function(cur){return (cur||0)+amt;});
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

window.MP_renderRoomList=function(){
  var el=document.getElementById('mpRoomList');
  if(!el)return;
  if(!db){el.innerHTML='<div class="mp-room-empty">Database belum siap</div>';return;}
  if(mp.roomListLoading)return;
  mp.roomListLoading=true;
  el.innerHTML='<div class="mp-room-empty">Memuat grup...</div>';
  var cutoff=nowTs()-ROOM_STALE_MS;
  db.ref('rooms').once('value').then(function(snap){
    mp.roomListLoading=false;
    var rooms=[];
    snap.forEach(function(child){
      var d=child.val();
      if(!d)return;
      var players=d.players||{};
      var pcount=0;
      var anyAlive=false;
      for(var k in players){
        pcount++;
        if(nowTs()-(players[k].lastSeen||0)<PLAYER_STALE_MS)anyAlive=true;
      }
      if(pcount===0)return;
      if(d.hostId&&!players[d.hostId])return;
      var created=d.createdAt||0;
      if(created&&created<cutoff)return;
      if(!anyAlive&&(nowTs()-created)>10*60*1000)return;
      rooms.push({
        code:child.key,
        state:d.state||'lobby',
        mode:d.mode||1,
        players:pcount,
        hostId:d.hostId||'',
        createdAt:created
      });
    });
    rooms.sort(function(a,b){return b.createdAt-a.createdAt;});
    if(rooms.length===0){
      el.innerHTML='<div class="mp-room-empty">Belum ada grup aktif. Buat grup baru dulu!</div>';
      return;
    }
    var html='';
    for(var i=0;i<rooms.length;i++){
      var r=rooms[i];
      var joinable=(r.state==='lobby'||r.state==='ended')&&r.players<MAX_PLAYERS;
      var label='';
      if(r.players>=MAX_PLAYERS)label='PENUH';
      else if(r.state==='playing')label='SIBUK';
      else label='GABUNG';
      var disabled=joinable?'':' disabled';
      html+='<div class="mp-room-row">';
      html+='<div class="mp-room-code">'+esc(r.code)+'</div>';
      html+='<div class="mp-room-info">';
      html+='<div class="mp-room-name">'+r.players+'/'+MAX_PLAYERS+' pemain · Mode '+modeLabel(r.mode)+'</div>';
      html+='<div class="mp-room-meta">'+(r.state==='lobby'?'Menunggu':(r.state==='playing'?'Sedang bermain':(r.state==='ended'?'Baru selesai':'Tersedia')))+'</div>';
      html+='</div>';
      html+='<button class="mp-room-join" data-join-room="'+esc(r.code)+'"'+disabled+'>'+label+'</button>';
      html+='</div>';
    }
    el.innerHTML=html;
    var btns=el.querySelectorAll('[data-join-room]');
    for(var b=0;b<btns.length;b++){
      btns[b].addEventListener('click',function(){
        var code=this.getAttribute('data-join-room');
        if(!code)return;
        DS().initAudio();
        DS().sfxClick();
        var nameIn=document.getElementById('mpNameInput');
        var nm=nameIn?(nameIn.value||'').trim().toUpperCase():'';
        if(nm.length<3){DS().showToast('Isi nama dulu di kolom atas','error');return;}
        joinGroupByCode(code,nm);
      });
    }
  }).catch(function(){
    mp.roomListLoading=false;
    el.innerHTML='<div class="mp-room-empty">Gagal memuat grup</div>';
  });
};

function renderLeaderboard(){
  var list=document.getElementById('leaderList');
  if(!list)return;
  var au=currentAuthUser();
  if(!au){
    list.innerHTML='<div style="text-align:center;padding:40px 22px;color:#8a8aa3;font-weight:600;font-size:12px;line-height:1.6;">HARUS LOGIN UNTUK LIHAT PERINGKAT</div>';
    return;
  }
  list.innerHTML='<div style="text-align:center;padding:40px;color:#8a8aa3;font-weight:600;font-size:12px;">Memuat peringkat...</div>';
  if(!db){
    list.innerHTML='<div style="text-align:center;padding:40px;color:#c93a3a;font-weight:600;font-size:12px;">Database belum siap</div>';
    return;
  }
  db.ref('leaderboard').once('value').then(function(snap){
    var users=[];
    snap.forEach(function(child){
      var d=child.val();
      if(!d)return;
      if(!d.id)d.id=child.key;
      if(!d.name||String(d.name).length<1)return;
      users.push(d);
    });
    users.sort(function(a,b){
      var ka=Number(a.kills)||0,kb=Number(b.kills)||0;
      return kb-ka;
    });
    users=users.slice(0,100);
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
        if(DS().save.friends[u.id])btnHtml='<button class="leader-friend-btn added" disabled>TEMAN</button>';
        else if(DS().save.friendSent[u.id])btnHtml='<button class="leader-friend-btn pending" disabled>PENDING</button>';
        else btnHtml='<button class="leader-friend-btn" data-add-friend="'+esc(u.id)+'" data-friend-name="'+esc(u.name||'')+'">+ TEMAN</button>';
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
    if(users.length===0){
      html='<div style="text-align:center;padding:40px;color:#8a8aa3;font-weight:600;font-size:12px;">Belum ada pemain terdaftar</div>';
    }
    list.innerHTML=html;
    bindFriendButtons(list);
  }).catch(function(err){
    var msg=err&&err.code==='PERMISSION_DENIED'?'Akses peringkat ditolak Firebase. Pastikan Rules terbaru sudah dipublish.':(err&&err.code==='NETWORK_ERROR'?'Koneksi Firebase terputus. Coba lagi.':'Gagal memuat peringkat');
    list.innerHTML='<div style="text-align:center;padding:40px;color:#c93a3a;font-weight:600;font-size:12px;line-height:1.6;">'+msg+'</div>';
  });
}

function bindFriendButtons(list){
  var btns=list.querySelectorAll('[data-add-friend]');
  for(var b=0;b<btns.length;b++){
    btns[b].addEventListener('click',function(ev){
      ev.stopPropagation();
      var uid=this.getAttribute('data-add-friend');
      var uname=this.getAttribute('data-friend-name');
      addFriend(uid,uname,this);
    });
  }
}

function addFriend(uid,uname,btn){
  if(!db||!uid)return;
  if(uid===DS().save.globalId){DS().showToast('Tidak bisa tambah diri sendiri','error');return;}
  if(DS().save.friends[uid]){DS().showToast('Sudah berteman','info');return;}
  if(DS().save.friendSent[uid]){DS().showToast('Permintaan sudah dikirim','info');return;}
  var myId=DS().save.globalId;
  var myName=(DS().save.playerName||'PLAYER').toUpperCase();
  var updates={};
  updates['friend_requests/'+uid+'/'+myId]={id:myId,name:myName,ts:nowTs()};
  updates['friend_sent/'+myId+'/'+uid]={id:uid,name:uname||'-',ts:nowTs()};
  db.ref().update(updates,function(err){
    if(err){DS().showToast('Gagal kirim permintaan','error');return;}
    DS().save.friendSent[uid]={id:uid,name:uname,ts:nowTs()};
    DS().persist();
    if(btn){btn.textContent='PENDING';btn.classList.add('pending');btn.disabled=true;}
    DS().showToast('Permintaan teman dikirim ke '+uname,'success');
    DS().sfxMP();
  });
}

function acceptFriend(uid,uname){
  if(!db||!uid)return;
  var myId=DS().save.globalId;
  var updates={};
  updates['friends/'+myId+'/'+uid]={id:uid,name:uname,ts:nowTs()};
  updates['friends/'+uid+'/'+myId]={id:myId,name:(DS().save.playerName||'PLAYER').toUpperCase(),ts:nowTs()};
  updates['friend_requests/'+myId+'/'+uid]=null;
  updates['friend_sent/'+uid+'/'+myId]=null;
  db.ref().update(updates,function(err){
    if(err){DS().showToast('Gagal terima teman','error');return;}
    DS().save.friends[uid]={id:uid,name:uname,ts:nowTs()};
    delete DS().save.friendRequests[uid];
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
  if(q.length<1){DS().showToast('Minimal 1 karakter','error');return;}
  if(!db)return;
  result.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Mencari...</div>';
  db.ref('users').once('value').then(function(snap){
    var allUsers=[];
    snap.forEach(function(child){
      var d=child.val();
      if(!d)return;
      if(!d.id)d.id=child.key;
      allUsers.push(d);
    });
    var users=[];
    for(var i=0;i<allUsers.length;i++){
      var u=allUsers[i];
      if(u.id===DS().save.globalId)continue;
      var nm=(u.name||'').toUpperCase();
      if(nm.indexOf(q)>=0)users.push(u);
      if(users.length>=30)break;
    }
    users.sort(function(a,b){
      var ka=Number(a.kills)||0,kb=Number(b.kills)||0;
      return kb-ka;
    });
    var html='';
    if(users.length===0){
      html='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Tidak ditemukan</div>';
    }else{
      for(var j=0;j<users.length;j++){
        var u2=users[j];
        var cls='leader-row';
        if(DS().save.friends[u2.id])cls+=' friend';
        var btnHtml='';
        if(DS().save.friends[u2.id])btnHtml='<button class="leader-friend-btn added" disabled>TEMAN</button>';
        else if(DS().save.friendSent[u2.id])btnHtml='<button class="leader-friend-btn pending" disabled>PENDING</button>';
        else btnHtml='<button class="leader-friend-btn" data-add-friend="'+esc(u2.id)+'" data-friend-name="'+esc(u2.name||'')+'">+ TEMAN</button>';
        html+='<div class="'+cls+'" data-uid="'+esc(u2.id)+'">';
        html+='<div class="leader-rank">-</div>';
        html+='<div class="leader-info">';
        html+='<div class="leader-name">'+esc((u2.name||'-').toUpperCase())+'</div>';
        html+='<div class="leader-meta">LV '+(u2.level||1)+' &middot; '+fmtK(u2.kills||0)+' KP</div>';
        html+='</div>';
        html+='<div class="leader-kp">'+fmtK(u2.totalKills||0)+'</div>';
        html+=btnHtml;
        html+='</div>';
      }
    }
    result.innerHTML=html;
    bindFriendButtons(result);
  }).catch(function(){
    result.innerHTML='<div style="text-align:center;padding:24px;color:#c93a3a;font-weight:600;font-size:12px;">Gagal mencari</div>';
  });
}

function renderFriends(){
  var reqList=document.getElementById('friendRequests');
  var friendList=document.getElementById('friendList');
  if(!db)return;
  if(reqList)reqList.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Memuat...</div>';
  var myId=DS().save.globalId;
  db.ref('friend_requests/'+myId).once('value').then(function(snap){
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
  if(friendList)friendList.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Memuat...</div>';
  db.ref('friends/'+myId).once('value').then(function(snap){
    var d=snap.val()||{};
    var fids=[];
    for(var k in d)fids.push(k);
    if(fids.length===0){
      if(friendList)friendList.innerHTML='<div style="text-align:center;padding:24px;color:#8a8aa3;font-weight:600;font-size:12px;">Belum ada teman</div>';
      return;
    }
    var loaded=0,rows=[];
    for(var i=0;i<fids.length;i++){
      (function(fid){
        db.ref('users/'+fid).once('value').then(function(us){
          var u=us.val();
          if(!u)u={id:fid,name:'-',kills:0,level:1,lastSeen:0};
          u.id=fid;
          DS().save.friends[fid]={id:fid,name:u.name,ts:nowTs()};
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
  rows.sort(function(a,b){
    var ka=Number(a.kills)||0,kb=Number(b.kills)||0;
    return kb-ka;
  });
  var html='';
  for(var i=0;i<rows.length;i++){
    var u=rows[i];
    var online=(nowTs()-(u.lastSeen||0))<60000;
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

function bindUI(){
  var createBtn=document.getElementById('mpCreateBtn');
  if(createBtn)createBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();createGroup();
  });
  var joinBtn=document.getElementById('mpJoinBtn');
  if(joinBtn)joinBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();joinGroup();
  });
  var globalBtn=document.getElementById('mpGlobalBtn');
  if(globalBtn)globalBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();enterGlobalMode();
  });
  var searchBtn=document.getElementById('mpSearchBtn');
  if(searchBtn)searchBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();MP_renderRoomList();
  });
  var refreshBtn=document.getElementById('mpRoomRefresh');
  if(refreshBtn)refreshBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();MP_renderRoomList();
  });
  var searchInput=document.getElementById('mpSearchInput');
  if(searchInput){
    searchInput.addEventListener('input',function(){
      this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    });
    searchInput.addEventListener('keydown',function(ev){
      ev.stopPropagation();
      if(ev.key==='Enter'||ev.keyCode===13){
        ev.preventDefault();
        DS().initAudio();
        MP_renderRoomList();
      }
    });
  }
  var nameIn=document.getElementById('mpNameInput');
  if(nameIn){
    nameIn.addEventListener('input',function(){
      this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,10);
      var sn=document.getElementById('mpSelfName');
      if(sn)sn.textContent=this.value||'-';
      if(DS().save.playerName!==this.value)DS().save.playerName=this.value;
    });
  }
  var codeIn=document.getElementById('mpCodeInput');
  if(codeIn){
    codeIn.addEventListener('input',function(){
      this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    });
  }
  var back=document.getElementById('mpBack');
  if(back)back.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();DS().goScreen('menu','menu');
  });
  var lobBack=document.getElementById('mpLobbyBack');
  if(lobBack)lobBack.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();
    DS().showConfirm('Keluar dari grup?',function(){
      leaveGroup();
      DS().goScreen('menu','menu');
    });
  });
  var leave2=document.getElementById('mpLeaveBtn2');
  if(leave2)leave2.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();
    DS().showConfirm('Keluar dari grup?',function(){
      leaveGroup();
      DS().goScreen('menu','menu');
    });
  });
  var leaveB=document.getElementById('mpLeaveBtn');
  if(leaveB)leaveB.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();
    if(!mp.globalMode&&mp.playerRef)mp.playerRef.child('alive').set(false);
    leaveGroup();
    var ov=document.getElementById('overlay');
    if(ov)ov.classList.remove('on');
    DS().setAppState('menu');
    DS().showScreen('menu');
  });
  var startBtn=document.getElementById('mpStartBtn');
  if(startBtn)startBtn.addEventListener('click',function(){
    if(mp.globalMode){
      DS().initAudio();
      DS().sfxClick();
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
      mp.roomRef.update({mode:mp.selectedMode,state:'playing'});
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
  if(chatSend)chatSend.addEventListener('click',function(){
    DS().initAudio();sendChat();
  });
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
  if(giftBtn)giftBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();openSendModal();
  });
  var spClose=document.getElementById('mpSendClose');
  if(spClose)spClose.addEventListener('click',function(){
    DS().sfxClick();closeSendModal();
  });
  var spModal=document.getElementById('mpSendPointsModal');
  if(spModal)spModal.addEventListener('click',function(ev){
    if(ev.target===spModal)closeSendModal();
  });
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
  var fsBtn=document.getElementById('friendSearchBtn');
  if(fsBtn)fsBtn.addEventListener('click',function(){
    DS().initAudio();DS().sfxClick();searchUsers();
  });
  var fsInput=document.getElementById('friendSearchInput');
  if(fsInput){
    fsInput.addEventListener('keydown',function(ev){
      ev.stopPropagation();
      if(ev.key==='Enter'||ev.keyCode===13){
        ev.preventDefault();
        DS().initAudio();
        searchUsers();
      }
    });
  }
}

function waitingHostWatchdog(){
  setInterval(function(){
    if(mp.globalMode){mp.waitingHostTimer=0;return;}
    if(!MPApi().active){mp.waitingHostTimer=0;return;}
    if(DS().getAppState()!=='waitingHost'){mp.waitingHostTimer=0;return;}
    mp.waitingHostTimer++;
    if(mp.waitingHostTimer>=30){
      mp.waitingHostTimer=0;
      DS().showToast('Host tidak merespons. Kembali ke lobby.','info',3000);
      DS().setAppState('mpLobbyMenu');
      DS().showScreen('mpLobby');
      MPApi().active=false;
      mp.startRequested=false;
      mp.prevRoomState='lobby';
      renderLobby();
    }
  },1000);
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
  DS().drawShipCentered(ctx,ship,shape,cv.width,cv.height,{glow:true,glowAlpha:0.6,zoom:0.92});
  var nm=document.getElementById('mpSelfName');
  if(nm)nm.textContent=(DS().save.playerName||'-').toUpperCase();
};

window.MP_broadcastKill=null;
window.MP_spawnGlobalEnemy=null;
window.MP_spawnGlobalBoss=null;
window.MP_damageGlobalEnemy=null;
window.MP_damageGlobalBoss=null;
window.MP_killGlobalEnemy=null;
window.LB_renderLeaderboard=renderLeaderboard;
window.FR_renderFriends=renderFriends;

function boot(){
  initFirebase().then(function(ok){
    if(ok&&firebase.auth){
      firebase.auth().onAuthStateChanged(function(user){
        if(user){
          DS().save.globalId=user.uid;
          if(DS().save.playerName)syncUserProfile();
        }
        refreshAccountUI();
        var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.toggle('hidden',!!user);
      });
    }
  });
  bindUI();
  var alb=document.getElementById('accountLoginBtn');if(alb)alb.addEventListener('click',function(){DS().initAudio();accountLogin();});
  var arb=document.getElementById('accountRegisterBtn');if(arb)arb.addEventListener('click',function(){DS().initAudio();accountRegister();});
  var aob=document.getElementById('accountLogoutBtn');if(aob)aob.addEventListener('click',function(){accountLogout();});
  initPlayfield();
  waitingHostWatchdog();
  var nameIn=document.getElementById('mpNameInput');
  if(nameIn&&DS().save.playerName)nameIn.value=DS().save.playerName;
  if(!DS().save.mpGifts)DS().save.mpGifts=0;
  if(!DS().save.trophies)DS().save.trophies=0;
  if(!DS().save.friends)DS().save.friends={};
  if(!DS().save.friendRequests)DS().save.friendRequests={};
  if(!DS().save.friendSent)DS().save.friendSent={};
  if(window.DS_MP){
    window.DS_MP.globalEnemiesCache={};
    window.DS_MP.globalBossesCache={};
    window.DS_MP.isGlobalHost=false;
    window.DS_MP.networkMode=false;
    window.DS_MP.globalMode=false;
  }
  if(currentAuthUser()&&DS().save.playerName&&DS().save.playerName.length>=3)syncUserProfile();
  requestAnimationFrame(mainLoop);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
