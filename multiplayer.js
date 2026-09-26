(function(){
'use strict';

var db=null;
var firebaseInitPromise=null;
var cloudSaveTimer=null;
var firebaseReady=false;
var MAX_PLAYERS=6;
var CHAT_MAX_STORE=80;
var CHAT_MAX_SHOW=4;
var KF_MAX_ITEMS=5;
var KF_LIFE=4000;
var USER_SYNC_INTERVAL=8000;
var ROOM_STALE_MS=6*3600*1000;
var PLAYER_STALE_MS=30000;
var FORCE_RELOGIN_EPOCH='v104-full-reset-1';

var mp={
  roomCode:null,myId:null,hostId:null,isHost:false,playersCache:{},
  roomRef:null,playerRef:null,chatRef:null,emojiRef:null,kfRef:null,
  enemyRef:null,bossRef:null,
  pollInterval:null,gameUpdateTimer:0,userSyncTimer:null,userRef:null,
  selectedMode:1,startRequested:false,finalSent:false,gameEnded:false,ready:false,
  prevRoomState:'lobby',
  lobbyX:0.5,lobbyDragging:false,inGameDead:false,reviveCountdown:0,
  lastWrittenKp:null,sendModalOpen:false,sendBusy:false,
  pfCtx:null,pfCanvas:null,pfAnim:null,pfLastW:0,pfLastH:0,pfLastDPR:0,
  seenEmojis:{},seenKf:{},chatItems:[],kfItems:[],
  globalMode:false,globalRef:null,globalPlayerRef:null,
  globalKillfeedRef:null,globalChatRef:null,globalStatsRef:null,
  globalEnemyRef:null,globalBossRef:null,
  globalKillsTotal:0,globalPlayersOnline:0,globalPlayers:{},
  globalDead:false,globalReviveCountdown:0,globalStarting:false,
  isGlobalHost:false,hostCheckTimer:null,
  roomListLoading:false,
  waitingHostTimer:0,waitingHostWatchdogTimer:null,
  serverStartAt:0,serverEndAt:0,serverOffset:0,serverExpired:false,
  firebaseConnected:false,sharedCombat:false,remoteRender:{}
};

var MP_MODES=[
  {id:1,label:'MUDAH',level:1,brief:'FIRST CONTACT',objective:'Bangun ritme squad dan bertahan sampai ekstraksi.',target:18},
  {id:2,label:'SEDANG',level:2,brief:'HOLD THE LINE',objective:'Jaga formasi. Kill tim dihitung bersama.',target:30},
  {id:3,label:'SULIT',level:3,brief:'BREAK FORMATION',objective:'Hancurkan gelombang berat tanpa kehilangan squad.',target:45},
  {id:4,label:'AHLI',level:4,brief:'BLACKOUT',objective:'Komunikasi dan positioning menentukan siapa yang pulang.',target:60},
  {id:5,label:'NIGHTMARE',level:5,brief:'NO SAFE VECTOR',objective:'Bertahan dari tekanan tinggi dan bantu pilot yang jatuh.',target:80},
  {id:6,label:'IMPOSSIBLE',level:6,brief:'LAST SQUAD',objective:'Satu tim. Satu kesempatan. Buktikan kalian bisa keluar.',target:100}
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
function updateNetworkState(online){
  mp.firebaseConnected=!!online&&mp.firebaseConnected;
  var st=document.getElementById('cloudSyncStatus');
  if(st&&!online){st.textContent='CLOUD • OFFLINE (LOCAL AKTIF)';st.className='cloud-sync warn';}
  var rail=document.getElementById('v111MpPing');
  if(rail&&!online){rail.textContent='PING OFFLINE';rail.className='warn';}
}
var mpReconnectTimer=null;
function scheduleRoomReconnect(){
  if(mpReconnectTimer||!navigator.onLine||!mp.roomCode||!mp.myId||!db)return;
  mpReconnectTimer=setTimeout(function(){
    mpReconnectTimer=null;
    if(!navigator.onLine||!mp.roomCode||!mp.myId)return;
    try{
      var ref=db.ref('rooms/'+mp.roomCode+'/players/'+mp.myId);
      ref.update({lastSeen:firebase.database.ServerValue.TIMESTAMP,online:true});
      mp.firebaseConnected=true;
      updateNetworkState(true);
    }catch(e){}
  },1200);
}
window.addEventListener('online',function(){
  updateNetworkState(true);
  try{if(window.MP_forceCloudSync)window.MP_forceCloudSync();else syncCloudSave();}catch(e){}
  scheduleRoomReconnect();
});
window.addEventListener('offline',function(){
  if(mpReconnectTimer){clearTimeout(mpReconnectTimer);mpReconnectTimer=null;}
});

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
function updateAccountGate(){var gate=document.getElementById('accountGate');if(!gate)return;var u=currentAuthUser();gate.classList.toggle('on',!u);}
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
function startupLoading(message){
  var ov=document.getElementById('loadingOverlay');
  var tx=ov&&ov.querySelector('.lo-text');
  if(!ov)return;
  if(tx)tx.textContent=message||'MEMUAT';
  ov.classList.remove('hide');
}
function finishStartupLoading(){
  var ov=document.getElementById('loadingOverlay');
  if(!ov)return;
  var tx=ov.querySelector('.lo-text');
  if(tx)tx.textContent='SIAP';
  setTimeout(function(){ov.classList.add('hide');},160);
}
var startupFinished=false;
function enterGameAfterAuth(){
  if(startupFinished)return;
  startupFinished=true;
  // One identity only: the account username is also the in-game player name.
  // This removes the old second-name gate that could make the campaign look missing.
  var u=currentAuthUser();
  var identity=String(DS().save.playerName||'').trim().toUpperCase();
  if(identity.length<3&&u){
    var raw=(u.email||'').split('@')[0].replace(/[^a-z0-9_]/gi,'').slice(0,16);
    if(raw.length>=3){identity=raw.toUpperCase();DS().save.playerName=identity;}
  }
  if(identity.length<3)DS().save.playerName='PLAYER';
  DS().save.playerName=String(DS().save.playerName).toUpperCase().slice(0,16);
  DS().persist();
  refreshAccountUI();
  updateAccountGate();
  var box=document.getElementById('accountBox');if(box)box.classList.add('hidden');
  if(DS().onboarding&&DS().onboarding.hide)DS().onboarding.hide();
  DS().refreshAll();
  finishStartupLoading();
  try{syncUserProfile();}catch(e){}
}
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
    enterGameAfterAuth();
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
  // Stop room/global listeners before signing out so no stale multiplayer
  // session continues to update the UI after the account is gone.
  if(mp.roomRef||mp.globalMode||MPApi().active)leaveGroup();
  if(mp.userSyncTimer){clearInterval(mp.userSyncTimer);mp.userSyncTimer=null;}
    if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;}
  mp.userRef=null;
  firebase.auth().signOut().then(function(){startupFinished=false;DS().save.globalId='';DS().persist();refreshAccountUI();updateAccountGate();var ov=document.getElementById('loadingOverlay');if(ov)ov.classList.add('hide');var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.remove('hidden');DS().showToast('Akun keluar','info',2200);});
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
  // Global / multiplayer counters use the same compact notation as the main HUD.
  return compactChampionNumber(n);
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
    achievementCount:Object.keys(s.achievements||{}).filter(function(k){return !!s.achievements[k];}).length,
    itemCount:(s.ownedSkills||[]).length+Math.max(0,(s.ships||[]).length-1)+Math.max(0,(s.guns||[]).length-1)+Math.max(0,(s.shapes||[]).length-1)+Math.max(0,(s.pets||[]).length-1)+(s.startingUpgrades||[]).length,
    lastSeen:nowTs()
  };
}

function safeChampionNumber(v,fallback){v=Number(v);return isFinite(v)?Math.max(0,v):fallback;}
function safeMPInt(v,fallback){v=Number(v);return isFinite(v)?Math.max(0,Math.floor(v)):fallback;}
function compactChampionNumber(value){
  var n=safeChampionNumber(value,0);
  if(n<1000)return Math.floor(n).toLocaleString('id-ID');
  var units=['K','M','B','T','QD','QT','SX','SP','OC','NO','DC','UD','DD','TD','QAD','QID','SXD','SPD','OCD','NOD','VG'];
  var tier=Math.floor(Math.log10(n)/3);
  if(tier<1)tier=1;
  if(tier>units.length)tier=units.length;
  var scaled=n/Math.pow(1000,tier);
  var decimals=scaled>=100?0:(scaled>=10?1:2);
  var out=scaled.toFixed(decimals).replace(/\.?0+$/,'');
  return out.replace('.',',')+units[tier-1];
}
function globalChampionScore(u,maxes){var k=safeChampionNumber(u&&((u.totalKills!=null)?u.totalKills:u.kills),0),l=Math.max(1,safeChampionNumber(u&&u.level,1)),a=safeChampionNumber(u&&u.achievementCount,0),i=safeChampionNumber(u&&u.itemCount,0);return ((maxes.kills>0?k/maxes.kills:0)*.40+(maxes.level>0?l/maxes.level:0)*.25+(maxes.ach>0?a/maxes.ach:0)*.20+(maxes.items>0?i/maxes.items:0)*.15)*100;}
function refreshGlobalChampion(){var card=document.getElementById('globalChampionCard');if(!card||!db)return;var now=Date.now();if(card._champBusy)return;if(card._champNext&&now<card._champNext)return;card._champBusy=true;card._champNext=now+20000;db.ref('leaderboard').once('value').then(function(snap){var raw=snap.val()||{},users=[];for(var id in raw)if(raw[id]&&typeof raw[id]==='object')users.push(raw[id]);var s=DS().save,mine={id:s.globalId,name:s.playerName||'PLAYER',totalKills:Number(s.totalKills||s.kills||0),level:Number(s.level||1),achievementCount:Object.keys(s.achievements||{}).filter(function(k){return !!s.achievements[k];}).length,itemCount:(s.ownedSkills||[]).length+Math.max(0,(s.ships||[]).length-1)+Math.max(0,(s.guns||[]).length-1)+Math.max(0,(s.shapes||[]).length-1)+Math.max(0,(s.pets||[]).length-1)+(s.startingUpgrades||[]).length};var found=false;for(var n=0;n<users.length;n++)if(users[n].id===mine.id){users[n]=Object.assign({},users[n],mine);found=true;break;}if(!found)users.push(mine);var mx={kills:1,level:1,ach:1,items:1};for(var q=0;q<users.length;q++){mx.kills=Math.max(mx.kills,safeChampionNumber(users[q].totalKills!=null?users[q].totalKills:users[q].kills,0));mx.level=Math.max(mx.level,Math.max(1,safeChampionNumber(users[q].level,1)));mx.ach=Math.max(mx.ach,safeChampionNumber(users[q].achievementCount,0));mx.items=Math.max(mx.items,safeChampionNumber(users[q].itemCount,0));}users.sort(function(a,b){var d=globalChampionScore(b,mx)-globalChampionScore(a,mx);if(Math.abs(d)>.0001)return d;d=Number(b.totalKills||b.kills||0)-Number(a.totalKills||a.kills||0);if(d)return d;d=Number(b.level||1)-Number(a.level||1);if(d)return d;return String(a.name||'').localeCompare(String(b.name||''));});var c=users[0]||mine;function set(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}set('globalChampionName',String(c.name||'PLAYER').toUpperCase());set('champKill',compactChampionNumber(c.totalKills!=null?c.totalKills:c.kills));set('champLevel',compactChampionNumber(Math.max(1,safeChampionNumber(c.level,1))));set('champAch',compactChampionNumber(safeChampionNumber(c.achievementCount,0)));set('champItems',compactChampionNumber(safeChampionNumber(c.itemCount,0)));set('champScore',globalChampionScore(c,mx).toFixed(1));}).catch(function(){var n=document.getElementById('globalChampionName');if(n)n.textContent='DATA OFFLINE';var sc=document.getElementById('champScore');if(sc)sc.textContent='—';}).then(function(){card._champBusy=false;});}
window.MP_refreshGlobalChampion=refreshGlobalChampion;

function cloudSavePayload(){
  var s=DS().save||{};
  return {
    schema:11, savedAt:nowTs(),
    kills:Number(s.kills||0), totalKills:Number(s.totalKills||0), totalXp:Number(s.totalXp||0), level:Number(s.level||1),
    trophies:Number(s.trophies||0), mpWins:Number(s.mpWins||0), bossKills:Number(s.bossKills||0), endlessBest:Number(s.endlessBest||0),
    achievements:Object.assign({},s.achievements||{}), ships:Array.isArray(s.ships)?s.ships.slice():[], shapes:Array.isArray(s.shapes)?s.shapes.slice():[],
    guns:Array.isArray(s.guns)?s.guns.slice():[], pets:Array.isArray(s.pets)?s.pets.slice():[], ownedSkills:Array.isArray(s.ownedSkills)?s.ownedSkills.slice():[],
    startingUpgrades:Array.isArray(s.startingUpgrades)?s.startingUpgrades.slice():[], bestKills:Object.assign({},s.bestKills||{}),
    challengeBests:Object.assign({},s.challengeBests||{}), storyClaimed:Object.assign({},s.storyClaimed||{})
  };
}
function mergeCloudSave(remote){
  if(!remote||typeof remote!=='object')return false;
  var s=DS().save||{}, changed=false;
  function maxNum(key){var a=Number(s[key]||0),b=Number(remote[key]||0);if(isFinite(b)&&b>a){s[key]=b;changed=true;}}
  ['kills','totalKills','totalXp','level','trophies','mpWins','bossKills','endlessBest'].forEach(maxNum);
  function union(key){var a=Array.isArray(s[key])?s[key]:[],b=Array.isArray(remote[key])?remote[key]:[],seen={},out=[];a.concat(b).forEach(function(v){if(typeof v!=='string'||!v||v.length>80)return;var k=v;if(!seen[k]){seen[k]=1;out.push(v);}});if(out.length!==a.length||out.some(function(v,i){return v!==a[i];})){s[key]=out;changed=true;}}
  ['ships','shapes','guns','pets','ownedSkills','startingUpgrades'].forEach(union);
  function mergeObj(key){var a=(s[key]&&typeof s[key]==='object')?s[key]:{},b=(remote[key]&&typeof remote[key]==='object')?remote[key]:{},o=Object.assign({},a);Object.keys(b).forEach(function(k){if(b[k]===true||Number(b[k]||0)>Number(o[k]||0))o[k]=b[k];});if(JSON.stringify(o)!==JSON.stringify(a)){s[key]=o;changed=true;}}
  ['achievements','bestKills','challengeBests','storyClaimed'].forEach(mergeObj);
  if(changed){try{DS().validateSave();}catch(e){}DS().persist();}
  return changed;
}
function syncCloudSave(){
  var au=currentAuthUser();if(!db||!au)return Promise.resolve(false);
  var ref=db.ref('save_snapshots/'+au.uid),payload=cloudSavePayload();
  return ref.once('value').then(function(snap){
    var remote=snap.val();
    if(remote)mergeCloudSave(remote);
    payload=cloudSavePayload();
    return ref.set(payload);
  }).then(function(){mp.firebaseConnected=true;var st=document.getElementById('cloudSyncStatus');if(st){st.textContent='CLOUD SYNC • TERHUBUNG';st.className='cloud-sync ok';}return true;})
  .catch(function(err){var st=document.getElementById('cloudSyncStatus');if(st){st.textContent='CLOUD • OFFLINE (LOCAL AKTIF)';st.className='cloud-sync warn';}mp.firebaseConnected=false;return false;});
}
function queueCloudSave(){
  if(cloudSaveTimer)clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(function(){cloudSaveTimer=null;syncCloudSave();},4500);
}
window.MP_queueCloudSave=queueCloudSave;

function syncUserProfile(){
  var au=currentAuthUser();
  if(!db||!au)return Promise.resolve(false);
  var uid=au.uid;
  DS().save.globalId=uid;
  if(!mp.userRef||mp.userRef.key!==uid)mp.userRef=db.ref('users/'+uid);
  var profile=getUserProfile();profile.id=uid;
  var publicProfile={id:uid,name:profile.name,kills:profile.kills,totalKills:profile.totalKills,level:profile.level,xp:profile.xp,trophies:profile.trophies,wins:profile.wins,achievementCount:profile.achievementCount,itemCount:profile.itemCount,lastSeen:profile.lastSeen};
  return Promise.all([mp.userRef.update(profile),db.ref('leaderboard/'+uid).update(publicProfile)]).then(function(){
    mp.firebaseConnected=true;
    syncCloudSave();
    if(!mp.userSyncTimer){
      mp.userSyncTimer=setInterval(function(){
        var u=currentAuthUser();
        if(!db||!u)return;
        var p=getUserProfile();p.id=u.uid;
        var pub={id:u.uid,name:p.name,kills:p.kills,totalKills:p.totalKills,level:p.level,xp:p.xp,trophies:p.trophies,wins:p.wins,achievementCount:p.achievementCount,itemCount:p.itemCount,lastSeen:p.lastSeen};
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

function getServerNow(){
  var offset=mp.serverOffset||0;
  return Date.now()+offset;
}
function refreshServerOffset(){
  if(!db)return Promise.resolve();
  return db.ref('.info/serverTimeOffset').once('value').then(function(s){mp.serverOffset=Number(s.val()||0);return mp.serverOffset;}).catch(function(){return mp.serverOffset||0;});
}
function clearWaitingHostUI(){var el=document.getElementById('mpWaitingHostOverlay');if(el)el.classList.remove('on');}
function showWaitingHostUI(){var el=document.getElementById('mpWaitingHostOverlay');if(el)el.classList.add('on');}
function setRoomServerDeadline(){
  if(!mp.roomRef)return Promise.reject(new Error('room'));
  return refreshServerOffset().then(function(){
    var duration=60;
    var lvl=DS().LEVELS[1];
    for(var i=0;i<MP_MODES.length;i++)if(MP_MODES[i].id===mp.selectedMode){lvl=DS().LEVELS[MP_MODES[i].level];break;}
    if(isFinite(lvl.duration))duration=Math.max(5,Number(lvl.duration));
    var start=getServerNow()+2000, end=start+duration*1000;
    return mp.roomRef.update({startAt:start,endAt:end,state:'playing'}).then(function(){return {startAt:start,endAt:end,duration:duration};});
  });
}
function handleServerDeadline(){
  if(!mp.serverEndAt||mp.serverExpired)return;
  if(getServerNow()<mp.serverEndAt)return;
  mp.serverExpired=true;
  if(mp.isHost){
    if(mp.roomRef){mp.roomRef.update({state:'waiting_host',endedAt:firebase.database.ServerValue.TIMESTAMP});}
    mp.prevRoomState='waiting_host';
    MPApi().gameEnded=true;
    MPApi().active=false;
    DS().setAppState('mpLobbyMenu');
    clearWaitingHostUI();
    DS().showScreen('mpLobby');
    renderLobby();
  }else{
    mp.gameEnded=true;
    MPApi().dead=false;
    DS().setAppState('waitingHost');
    showWaitingHostUI();
  }
}

function createGroup(){
  if(!requireAccount())return;
  var name=currentUsername();
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
  mp.ready=true;
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
      lobbyX:0.5,posX:0.5,posHp:1,ready:true
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
  var name=currentUsername();
  var code=(document.getElementById('mpCodeInput').value||'').trim().toUpperCase();
  if(code.length!==6){DS().showToast('Kode grup harus 6 karakter','error');return;}
  joinGroupByCode(code,name);
}

function joinGroupByCode(code,nameInput){
  if(!db){DS().showToast('Database belum siap','error');return;}
  var name=currentUsername();
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
    mp.ready=false;
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
      lobbyX:0.5,posX:0.5,posHp:1,ready:false
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
  refreshServerOffset().then(function(off){mp.serverOffset=off;MPApi().serverOffset=off;});
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
    var curState=data.state||'lobby';
    if(data.mode!==undefined)mp.selectedMode=data.mode;
    if(data.startAt)mp.serverStartAt=Number(data.startAt)||0;
    if(data.endAt)mp.serverEndAt=Number(data.endAt)||0;
    MPApi().serverStartAt=mp.serverStartAt;
    MPApi().serverEndAt=mp.serverEndAt;
    MPApi().serverOffset=mp.serverOffset;
    if(curState==='waiting_host'){
      mp.serverExpired=true;
      if(mp.isHost){DS().setAppState('mpLobbyMenu');clearWaitingHostUI();DS().showScreen('mpLobby');renderLobby();}
      else{DS().setAppState('waitingHost');showWaitingHostUI();}
    }
    if(curState==='lobby'){mp.serverExpired=false;mp.serverStartAt=0;mp.serverEndAt=0;clearWaitingHostUI();}
    if(!players[myId]){DS().showToast('Kamu dikeluarkan dari grup','error');leaveGroup();return;}
    if(data.hostId&&!players[data.hostId]){
      DS().showToast('Host keluar dari grup','error');
      leaveGroup();
      return;
    }
    var myData=players[myId];
    mp.ready=myData.ready!==false;
    if(myData.kp!==undefined&&myData.kp!==mp.lastWrittenKp){
      DS().save.kills=myData.kp;
      mp.lastWrittenKp=myData.kp;
      DS().refreshHeaderKills();
      DS().refreshProfile();
      DS().updateMenuCard();
    }
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
  });
  mp.emojiRef=mp.roomRef.child('lastEmoji');
  mp.emojiRef.on('value',function(snap){var d=snap.val();if(d)handleRemoteEmoji(d);});
  mp.kfRef=mp.roomRef.child('killfeed');
  mp.kfRef.on('value',function(snap){var d=snap.val();if(d)handleRemoteKillFeed(d);});
  mp.roomRef.child('stats').on('value',function(snap){var d=snap.val()||{};mp.globalKillsTotal=d.teamKills||0;var pc=PC();for(var pk in pc){pc[pk].teamKills=mp.globalKillsTotal;}updateTopStats();});
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
    if(mp.playerRef)mp.playerRef.child('lastSeen').set(nowTs());
  },5000);
}

function detachAll(){
  clearWaitingHostUI();
  if(mp.waitingHostWatchdogTimer){clearInterval(mp.waitingHostWatchdogTimer);mp.waitingHostWatchdogTimer=null;}
  mp.serverStartAt=0;mp.serverEndAt=0;mp.serverExpired=false;
  if(mp.pollInterval){clearInterval(mp.pollInterval);mp.pollInterval=null;}
  if(mp.roomRef){try{mp.roomRef.off();}catch(e){}mp.roomRef=null;}
  if(mp.emojiRef){try{mp.emojiRef.off();}catch(e){}mp.emojiRef=null;}
  if(mp.kfRef){try{mp.kfRef.off();}catch(e){}mp.kfRef=null;}
  if(mp.chatRef){try{mp.chatRef.off();}catch(e){}mp.chatRef=null;}
  if(mp.enemyRef){try{mp.enemyRef.off();}catch(e){}mp.enemyRef=null;}
  if(mp.bossRef){try{mp.bossRef.off();}catch(e){}mp.bossRef=null;}
}

function detachGlobal(){
  if(mp.pollInterval){clearInterval(mp.pollInterval);mp.pollInterval=null;}
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
  mp.playerRef=null;
  mp.roomRef=null;
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
  mp.serverExpired=false;
  MPApi().serverStartAt=mp.serverStartAt;MPApi().serverEndAt=mp.serverEndAt;MPApi().serverOffset=mp.serverOffset;
  clearWaitingHostUI();
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
  var players=[];for(var k in PC())players.push(PC()[k]);
  players.sort(function(a,b){return (a.joinedAt||0)-(b.joinedAt||0);});
  var hostId=mp.hostId, readyCount=0;
  for(var ri=0;ri<players.length;ri++)if(players[ri].ready!==false)readyCount++;
  var html='<div class="global-stat-board"><div class="global-stat-head"><b>'+players.length+'/'+MAX_PLAYERS+'</b> PEMAIN <span>'+ (mp.isHost?'HOST':'ROOM') +'</span><em>'+readyCount+' READY</em></div>';
  for(var i=0;i<players.length;i++){
    var pl=players[i], isReady=pl.ready!==false;
    html+='<div class="global-stat-row mp-lobby-player-row'+(isReady?' ready':' waiting')+'"><span class="gs-rank mp-ready-dot">'+(isReady?'✓':'…')+'</span><span class="gs-name">'+esc((pl.name||'-').toUpperCase())+(pl.id===hostId?' ★':'')+'<small>'+(isReady?'SIAP':'BELUM SIAP')+'</small></span><span class="gs-kill">K '+fmtK(pl.kills||0)+'</span><span class="gs-kp">'+fmtK(pl.kp||0)+' KP</span>';
    if(mp.isHost&&pl.id!==mp.myId)html+='<button class="admin-user-actions" style="grid-column:2/-1;justify-self:end;padding:4px 7px;border:1.5px solid #242438;border-radius:7px;background:#fff" data-kick="'+pl.id+'">KICK</button>';
    html+='</div>';
  }
  if(!players.length)html+='<div class="mp-room-empty">Belum ada pemain.</div>';
  html+='</div>';
  var el=document.getElementById('mpPlayers');if(el)el.innerHTML=html;
  if(el){el.querySelectorAll('[data-kick]').forEach(function(btn){btn.addEventListener('click',function(){kickPlayer(this.getAttribute('data-kick'));});});}
  var wait=document.getElementById('mpWaiting');
  if(wait){var total=players.length;var allReady=total>0&&readyCount===total;wait.textContent=total<2?'Menunggu pemain... ('+total+'/'+MAX_PLAYERS+') - Butuh minimal 2':(allReady?'Semua pemain SIAP — host dapat memulai':'Siap '+readyCount+'/'+total+' pemain');}
  var startBtn=document.getElementById('mpStartBtn'),readyBtn=document.getElementById('mpReadyBtn');
  if(startBtn){var canStart=mp.isHost&&players.length>=2&&players.length<=MAX_PLAYERS&&readyCount===players.length;startBtn.disabled=!canStart;startBtn.textContent=canStart?'MULAI MATCH':'MENUNGGU SIAP';}
  if(readyBtn){readyBtn.disabled=false;readyBtn.classList.toggle('is-ready',!!mp.ready);readyBtn.textContent=mp.ready?'✓ SIAP — KLIK UNTUK BATAL':'SIAP';}
  var mt=document.getElementById('mpModeTitle');if(mt)mt.textContent=mp.isHost?'PILIH MODE (HOST)':'MODE DIPILIH HOST';
  renderModeGrid();
  var brief=document.getElementById('mpMissionBrief');
  if(brief){var selected=null;for(var bi=0;bi<MP_MODES.length;bi++)if(MP_MODES[bi].id===mp.selectedMode){selected=MP_MODES[bi];break;}selected=selected||MP_MODES[0];brief.innerHTML='<span class="mp-brief-kicker">SQUAD CONTRACT // '+esc(selected.brief||'OPS')+'</span><b>'+esc(selected.objective||'Jalankan operasi bersama.')+'</b><small>TARGET TIM • '+fmtK(selected.target||0)+' KILL • MIN 2 PILOT</small>';}
  renderLobbyInviteFriends();renderChat();updateLobbyConnectionUI();
}

function updateLobbyConnectionUI(){
  var el=document.getElementById('mpConnectionStatus');
  if(!el)return;
  var ok=!!mp.firebaseConnected;
  el.className='mp-connection '+(ok?'online':'offline');
  el.textContent=ok?'ONLINE • TERHUBUNG':'OFFLINE • MENUNGGU KONEKSI';
}

function toggleReady(){
  if(mp.globalMode||!mp.playerRef||mp.gameEnded)return;
  var next=!mp.ready;
  mp.ready=next;
  mp.playerRef.child('ready').set(next).then(function(){DS().sfxClick();renderLobby();}).catch(function(){mp.ready=!next;renderLobby();DS().showToast('Status siap gagal dikirim','error');});
}

function copyRoomCode(){
  var code=String(mp.roomCode||'');if(!code)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(code).then(function(){DS().showToast('Kode '+code+' disalin','success');}).catch(function(){DS().showToast('Kode grup: '+code,'success');});}
  else DS().showToast('Kode grup: '+code,'success');
}

function renderModeGrid(){
  var grid=document.getElementById('mpModeGrid');
  if(!grid)return;
  var html='';
  for(var i=0;i<MP_MODES.length;i++){
    var m=MP_MODES[i];
    var on=m.id===mp.selectedMode?' on':'';
    var lk=!mp.isHost?' locked':'';
    html+='<button title="'+esc(m.label)+' • '+esc(m.objective||'')+'" class="mp-mode-btn'+on+lk+'" data-mode="'+m.id+'"'+(mp.isHost?'':' disabled')+'><b>'+m.label+'</b><small>LV '+m.level+' • '+esc(m.brief||'SQUAD OPS')+'</small><em>'+esc(m.objective||'Jalankan operasi bersama.')+'</em></button>';
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
  var data={killerId:mp.globalMode?DS().save.globalId:mp.myId,killerName:(me&&me.name)||(DS().save.playerName||'PLAYER'),targetName:targetName||'Musuh',ts:nowTs(),nonce:Math.random().toString(36).slice(2,7)};
  var statsRef=mp.globalMode?mp.globalStatsRef:(mp.roomRef?mp.roomRef.child('stats'):null);
  if(statsRef){
    statsRef.child('teamKills').transaction(function(cur){return (cur||0)+1;});
    statsRef.child('lastKill').set(data);
  }
  var killerRef=mp.globalMode&&mp.globalRef ? mp.globalRef.child('players/'+data.killerId+'/kills') : (mp.roomRef ? mp.roomRef.child('players/'+data.killerId+'/kills') : null);
  if(killerRef){killerRef.transaction(function(cur){return (cur||0)+1;});}
  if(mp.globalMode&&mp.globalKillfeedRef)mp.globalKillfeedRef.set(data);else if(mp.roomRef)mp.roomRef.child('killfeed').set(data);
  DS().save.mpPersonalKills=(DS().save.mpPersonalKills||0)+1;
  DS().save.mpTeamKills=(DS().save.mpTeamKills||0)+1;
  DS().persist();
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

function spawnGlobalEnemy(e){ if(!mp.sharedCombat)return; }
function spawnGlobalBoss(b){ if(!mp.sharedCombat)return; }
function damageGlobalEnemy(id,dmg){ if(!mp.sharedCombat)return; }
function damageGlobalBoss(id,dmg){ if(!mp.sharedCombat)return; }
function killGlobalEnemy(id){ if(!mp.sharedCombat)return; }
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
  var name=currentUsername();
  DS().save.playerName=name;
  DS().persist();
  syncUserProfile();
  var myId=currentAuthUser().uid;
  DS().save.globalId=myId;
  DS().persist();
  mp.globalMode=true;
  mp.sharedCombat=false;
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
    teamKills:0,
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
    for(var pk in cache){cache[pk].teamKills=mp.globalKillsTotal||0;}
    mp.globalPlayers=cache;
    MPApi().playersCache=cache;
    checkGlobalHost();
    var st=DS().getAppState();
    if(st==='mpLobbyMenu'||st==='globalLobby')renderGlobalLobby();
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
    mp.globalKillsTotal=d.teamKills||d.totalKills||0;
    updateGlobalStatsBar();
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
  var players=[];for(var k in mp.globalPlayers)players.push(mp.globalPlayers[k]);
  var lobby=document.getElementById('mpPlayers');
  if(!lobby)return;
  var html='<div class="global-stat-board"><div class="global-stat-head"><b>'+players.length+'</b> ONLINE <span>SECTOR EVENT <b>LIVE</b></span><em>TEAM KILL '+fmtK(mp.globalKillsTotal||0)+'</em></div>';
  for(var i=0;i<Math.min(players.length,12);i++){var p=players[i];html+='<div class="global-stat-row"><span class="gs-name">'+esc((p.name||'-').toUpperCase())+'</span><span class="gs-kill">'+fmtK(p.kills||0)+' KILL</span><span class="gs-kp">ONLINE</span></div>';}
  if(!players.length)html+='<div class="mp-room-empty">Belum ada pemain aktif.</div>';
  html+='</div>';lobby.innerHTML=html;
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
  MPApi().sharedCombat=false;
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
  roomRef.update(updates);
  var kf=document.getElementById('killFeed');
  if(kf){kf.innerHTML='';kf.classList.add('on');}
  var lb=document.getElementById('mpLevelBadge');
  if(lb)lb.classList.add('on');
  var cel=document.getElementById('mpCelebration');
  if(cel)cel.classList.remove('on');
  var rb=document.getElementById('mpReviveBox');
  if(rb)rb.classList.remove('on');
  setTimeout(function(){startMpLevel();},60);
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
  MPApi().sharedCombat=false;
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
  setTimeout(function(){
    DS().startLevel(lvl,true);
    DS().updateMPLevelBadge();
    mp.globalStarting=false;
  },60);
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
  MPApi().sharedCombat=false;
  MPApi().onPlayerDeath=onLocalDeath;
  MPApi().onGameEnd=onLocalWin;
  MPApi().onServerTimeExpired=handleServerDeadline;
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
  if(mp.serverExpired && mp.prevRoomState==='waiting_host'){
    MPApi().active=false;
    MPApi().networkMode=false;
    MPApi().dead=false;
    if(mp.isHost){
      clearWaitingHostUI();
      DS().setAppState('mpLobbyMenu');
      DS().showScreen('mpLobby');
      renderLobby();
    }else{
      DS().setAppState('waitingHost');
      showWaitingHostUI();
    }
    return;
  }
  DS().setAppState('ended');
  MPApi().dead=false;
  mp.inGameDead=false;
  mp.reviveCountdown=0;
  var p=DS().getPlayer();
  if(p)p.hp=p.maxHp;
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

function drawOtherPlayersInGame(){
  if(!MPApi().active)return;var ctx=DS().getGameCtx();if(!ctx)return;
  var W=DS().getW(),H=DS().getH(),BS=DS().BASE_SIZE,cache=mp.globalMode?mp.globalPlayers:PC(),myId=mp.globalMode?DS().save.globalId:mp.myId,pa=DS().playArea();
  var ids=[];for(var k in cache)if(k!==myId&&cache[k]&&cache[k].alive!==false)ids.push(k);
  var now=performance.now();
  for(var ii=0;ii<ids.length;ii++){
    var pl=cache[ids[ii]];if(pl.posX===undefined)continue;
    var tx=clamp(Number(pl.posX)||.5,0,1)*W,ty;
    if(pl.posY!==undefined)ty=pa.top+clamp(Number(pl.posY)||.5,0,1)*(pa.bottom-pa.top);
    else ty=pa.bottom-92;
    var rp=mp.remoteRender[ids[ii]]||{x:tx,y:ty,last:now};
    var alpha=Math.min(1,Math.max(.10,(now-rp.last)/180));rp.x+=(tx-rp.x)*alpha;rp.y+=(ty-rp.y)*alpha;rp.last=now;mp.remoteRender[ids[ii]]=rp;
    var ox=rp.x-BS/2,oy=rp.y-BS/2,elL=DS().edgeLeft(),elR=DS().edgeRight();
    if(ox<elL)ox=elL;if(ox+BS>elR)ox=elR-BS;if(oy<pa.top)oy=pa.top;if(oy+BS>pa.bottom)oy=pa.bottom-BS;
    var ship=DS().findShip(pl.ship||'default'),shape=DS().findShape(pl.shape||'square'),key=ship.id+'_'+shape.id,cacheSpr=DS().playerSpriteCache(),spr=cacheSpr[key]||cacheSpr[ship.id+'_square']||cacheSpr['default_square'],glow=DS().playerGlowCache()[ship.id],cx=ox+BS/2,cy=oy+BS/2,hpRatio=clamp(pl.posHp===undefined?1:pl.posHp,0,1);
    ctx.save();ctx.globalAlpha=.92;ctx.fillStyle='rgba(7,13,21,.78)';ctx.fillRect(ox-3,oy-25,BS+6,6);ctx.fillStyle=hpRatio<.35?'#ff6175':'#59d6a0';ctx.fillRect(ox,oy-23,BS*hpRatio,3);ctx.restore();
    if(glow&&glow.normal&&glow.normal.canvas){ctx.save();ctx.globalAlpha=.16;ctx.drawImage(glow.normal.canvas,cx-glow.R,cy-glow.R);ctx.restore();}
    ctx.save();ctx.globalAlpha=.98;if(spr&&spr.normal&&spr.normal.canvas)ctx.drawImage(spr.normal.canvas,ox-spr.pad,oy-spr.pad);ctx.restore();
    ctx.save();ctx.globalAlpha=.9;ctx.font='700 9px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(3,7,13,.92)';ctx.strokeText((pl.name||'-').toUpperCase(),cx,oy-31);ctx.fillStyle='#eef4fb';ctx.fillText((pl.name||'-').toUpperCase(),cx,oy-31);ctx.restore();
  }
  for(var stale in mp.remoteRender)if(ids.indexOf(stale)<0)delete mp.remoteRender[stale];
}

function gameSyncTick(dt){
  if(!MPApi().active)return;
  if(!mp.globalMode)handleServerDeadline();
  if(mp.serverExpired)return;
  var ref=mp.globalMode?mp.globalPlayerRef:mp.playerRef;
  if(!ref)return;
  mp.gameUpdateTimer-=dt;
  if(mp.gameUpdateTimer>0)return;
  mp.gameUpdateTimer=0.25;
  var p=DS().getPlayer();
  if(!p)return;
  mp.lastWrittenKp=DS().save.kills;
  ref.update({
    posX:clamp(p.x/DS().getW(),0,1),
    posY:(function(){var a=DS().playArea();return a.bottom>a.top?clamp((p.y-a.top)/(a.bottom-a.top),0,1):.5;})(),
    posHp:Math.max(0,p.hp/p.maxHp),
    alive:mp.globalMode?!mp.globalDead:!mp.inGameDead,
    kills:safeMPInt(MPApi().myKillCount,0),
    teamKills:safeMPInt(mp.globalKillsTotal,0),
    kp:safeMPInt(DS().save.kills,0),
    level:Math.max(1,safeMPInt(DS().save.level,1)),
    xp:safeMPInt(DS().save.xp,0),
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
    if(cnt>=5)break;
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
  if(!mp.roomRef||!targetId||mp.sendBusy)return;
  mp.sendBusy=true;
  var releaseSendLock=function(){mp.sendBusy=false;};
  try{
    var input=document.querySelector('input[data-send-input="'+targetId+'"]');
    if(!input){releaseSendLock();return;}
    var amt=parseInt(input.value,10);
    if(!amt||amt<=0){DS().showToast('Masukkan jumlah valid','error');releaseSendLock();return;}
    var oldKills=Number(DS().save.kills)||0;
    if(amt>oldKills){DS().showToast('Poin kamu tidak cukup','error');releaseSendLock();return;}

    // Use one multi-location update with Firebase's server-side increment so
    // sender and recipient change together. This avoids the old race where a
    // recipient transaction could commit while the sender write failed.
    var updates={};
    updates['players/'+mp.myId+'/kp']=firebase.database.ServerValue.increment(-amt);
    updates['players/'+targetId+'/kp']=firebase.database.ServerValue.increment(amt);
    mp.roomRef.update(updates).then(function(){
      DS().save.kills=oldKills-amt;
      mp.lastWrittenKp=DS().save.kills;
      DS().save.mpGifts=(DS().save.mpGifts||0)+1;
      try{DS().checkAchievements();}catch(e){}
      try{DS().persist();}catch(e){}
      var bal=document.getElementById('mpSendBalance');
      if(bal)bal.textContent=fmtK(DS().save.kills);
      input.value='';
      var tgt=PC()[targetId];
      DS().showToast('Kirim '+fmtK(amt)+' KP ke '+(tgt?(tgt.name||'-'):'-'),'success');
      DS().sfxGift();
      DS().refreshHeaderKills();
      DS().refreshProfile();
      DS().updateMenuCard();
      releaseSendLock();
    }).catch(function(err){
      console.error('send KP transaction error',err);
      DS().showToast('Pengiriman gagal; KP tidak berubah.','error',3200);
      releaseSendLock();
    });
  }catch(e){
    console.error('send KP error',e);
    releaseSendLock();
    DS().showToast('Transfer gagal. Coba lagi.','error',3200);
  }
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
  if(!currentAuthUser()){
    el.innerHTML='<div class="mp-room-empty">Login dulu untuk melihat grup tersedia.</div>';
    return;
  }
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
    if(rooms.length>6)rooms=rooms.slice(0,6);
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
  }).catch(function(err){
    mp.roomListLoading=false;
    console.error('MP_renderRoomList',err);
    var msg=err&&err.code==='PERMISSION_DENIED'?'Akses daftar grup ditolak Firebase.':'Gagal memuat grup. Coba REFRESH DAFTAR GRUP.';
    el.innerHTML='<div class="mp-room-empty">'+msg+'</div>';
  });
};

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
  var myName=(DS().save.playerName||'PLAYER').toUpperCase();
  if(uid===myId)return;
  var friendDataA={id:uid,name:uname||'-',ts:nowTs()};
  var friendDataB={id:myId,name:myName,ts:nowTs()};
  // Do the reciprocal friendship first. Keeping the request alive during this
  // step also satisfies the Firebase rule that protects the sender's record.
  var friends={};
  friends['friends/'+myId+'/'+uid]=friendDataA;
  friends['friends/'+uid+'/'+myId]=friendDataB;
  db.ref().update(friends).then(function(){
    var cleanup={};
    cleanup['friend_requests/'+myId+'/'+uid]=null;
    cleanup['friend_sent/'+uid+'/'+myId]=null;
    return db.ref().update(cleanup);
  }).then(function(){
    DS().save.friends[uid]=friendDataA;
    delete DS().save.friendRequests[uid];
    delete DS().save.friendSent[uid];
    DS().persist();
    DS().checkAchievements();
    DS().showToast('Berteman dengan '+(uname||'-')+'!','success');
    DS().sfxMP();
    renderFriends();
    syncFriendSentState();
  }).catch(function(err){
    console.error('acceptFriend',err);
    DS().showToast('Gagal terima teman: '+((err&&err.code)||'Firebase error'),'error');
  });
}

function rejectFriend(uid){
  if(!db||!uid)return;
  var myId=DS().save.globalId;
  var updates={};
  updates['friend_requests/'+myId+'/'+uid]=null;
  // Also clear the sender's pending flag so their button becomes + TEMAN.
  updates['friend_sent/'+uid+'/'+myId]=null;
  db.ref().update(updates).then(function(){
    delete DS().save.friendRequests[uid];
    DS().persist();
    DS().sfxClick();
    renderFriends();
    syncFriendSentState(function(){
    });
  }).catch(function(err){
    console.error('rejectFriend',err);
    DS().showToast('Gagal menolak permintaan. Coba lagi.','error');
  });
}

function syncFriendSentState(done){
  if(!db||!DS().save.globalId){if(done)done();return;}
  db.ref('friend_sent/'+DS().save.globalId).once('value').then(function(snap){
    DS().save.friendSent=snap.val()||{};
    DS().persist();
    if(done)done();
  }).catch(function(){if(done)done();});
}

function bindFriendSentWatcher(){
  if(!db||!DS().save.globalId)return;
  var ref=db.ref('friend_sent/'+DS().save.globalId);
  ref.off();
  ref.on('value',function(snap){
    DS().save.friendSent=snap.val()||{};
    DS().persist();
    var active=document.getElementById('friendsScreen');
    if(active&&active.classList.contains('on'))renderFriends();
  });
}

function bindFriendsWatcher(){
  if(!db||!DS().save.globalId)return;
  var ref=db.ref('friends/'+DS().save.globalId);
  ref.off();
  ref.on('value',function(snap){
    DS().save.friends=snap.val()||{};
    DS().persist();
    if(DS().checkAchievements)DS().checkAchievements();
    var active=document.getElementById('friendsScreen');
    if(active&&active.classList.contains('on'))renderFriends();
  });
}

function bindFriendRequestWatcher(){
  if(!db||!DS().save.globalId)return;
  var ref=db.ref('friend_requests/'+DS().save.globalId);
  ref.off();
  ref.on('value',function(snap){
    DS().save.friendRequests=snap.val()||{};
    DS().persist();
    var active=document.getElementById('friendsScreen');
    if(active&&active.classList.contains('on'))renderFriends();
    updateRoomInviteList();
  });
}

function sendGroupInvite(targetId,targetName){
  if(!db||!mp.roomCode||!mp.myId||!targetId)return;
  if(!mp.isHost){DS().showToast('Hanya host yang mengundang teman','info');return;}
  if(targetId===mp.myId)return;
  var pl=PC()[targetId];
  if(pl){DS().showToast((targetName||'Teman')+' sudah ada di grup','info');return;}
  var roomData={room:mp.roomCode,code:mp.roomCode,fromId:mp.myId,fromName:(DS().save.playerName||'HOST').toUpperCase(),ts:nowTs()};
  db.ref('room_invites/'+targetId+'/'+mp.roomCode).set(roomData).then(function(){
    DS().showToast('Undangan dikirim ke '+(targetName||'teman'),'success');
    DS().sfxMP();
    renderLobby();
  }).catch(function(err){
    console.error('sendGroupInvite',err);
    DS().showToast('Gagal mengundang teman','error');
  });
}

function renderGroupInvites(){
  var el=document.getElementById('mpInviteList');
  if(!el)return;
  if(!db||!DS().save.globalId){el.innerHTML='<div class="mp-invite-empty">Login untuk melihat undangan</div>';return;}
  db.ref('room_invites/'+DS().save.globalId).once('value').then(function(snap){
    var data=snap.val()||{},keys=Object.keys(data),html='';
    if(!keys.length){el.innerHTML='<div class="mp-invite-empty">Belum ada undangan grup</div>';return;}
    keys.sort(function(a,b){return (data[b].ts||0)-(data[a].ts||0);});
    for(var i=0;i<keys.length;i++){
      var inv=data[keys[i]]||{};
      html+='<div class="mp-invite-row">';
      html+='<div class="mp-invite-info"><b>'+esc((inv.fromName||'HOST').toUpperCase())+'</b><span>Mengundang kamu ke grup <strong>'+esc(inv.code||keys[i])+'</strong></span></div>';
      html+='<div class="mp-invite-actions"><button class="mp-invite-accept" data-accept-invite="'+esc(keys[i])+'">GABUNG</button><button class="mp-invite-reject" data-reject-invite="'+esc(keys[i])+'">TOLAK</button></div>';
      html+='</div>';
    }
    el.innerHTML=html;
    var acc=el.querySelectorAll('[data-accept-invite]');
    for(var a=0;a<acc.length;a++)acc[a].addEventListener('click',function(){
      var code=this.getAttribute('data-accept-invite');
      db.ref('room_invites/'+DS().save.globalId+'/'+code).once('value').then(function(ss){
        var inv=ss.val();
        if(!inv){renderGroupInvites();return;}
        var name=(DS().save.playerName||'').trim().toUpperCase();
        if(name.length<3){DS().showToast('Isi nama multiplayer dulu','error');return;}
        joinGroupByCode(inv.code||code,name);
        db.ref('room_invites/'+DS().save.globalId+'/'+code).remove();
      });
    });
    var rej=el.querySelectorAll('[data-reject-invite]');
    for(var j=0;j<rej.length;j++)rej[j].addEventListener('click',function(){
      var code=this.getAttribute('data-reject-invite');
      db.ref('room_invites/'+DS().save.globalId+'/'+code).remove().then(renderGroupInvites);
    });
  }).catch(function(){el.innerHTML='<div class="mp-invite-empty">Gagal memuat undangan</div>';});
}

var roomInviteWatchRef=null;
function bindRoomInviteWatcher(){
  if(roomInviteWatchRef){try{roomInviteWatchRef.off();}catch(e){}roomInviteWatchRef=null;}
  if(!db||!DS().save.globalId)return;
  roomInviteWatchRef=db.ref('room_invites/'+DS().save.globalId);
  roomInviteWatchRef.on('child_added',function(snap){
    var inv=snap.val();
    if(!inv)return;
    DS().showToast((inv.fromName||'HOST')+' mengundangmu ke grup '+(inv.code||snap.key),'info',4500);
    renderGroupInvites();
  });
  roomInviteWatchRef.on('child_removed',function(){renderGroupInvites();});
}
function updateRoomInviteList(){renderGroupInvites();}

function renderLobbyInviteFriends(){
  var el=document.getElementById('mpLobbyInviteList');
  if(!el)return;
  if(!mp.isHost){el.innerHTML='<div class="mp-invite-empty">Host yang mengundang teman.</div>';return;}
  var friends=DS().save.friends||{},ids=Object.keys(friends),html='';
  if(!ids.length){el.innerHTML='<div class="mp-invite-empty">Belum punya teman untuk diundang.</div>';return;}
  for(var i=0;i<ids.length;i++){
    var fid=ids[i],f=friends[fid]||{};
    var already=!!PC()[fid];
    html+='<div class="mp-lobby-friend"><div><b>'+esc((f.name||'-').toUpperCase())+'</b><span>'+(already?'Sudah di grup':'Teman')+'</span></div>';
    html+='<button class="mp-lobby-invite-btn" data-invite-friend="'+esc(fid)+'" data-invite-name="'+esc(f.name||'-')+'"'+(already?' disabled':'')+'>'+(already?'ADA':'UNDANG')+'</button></div>';
  }
  el.innerHTML=html;
  var btns=el.querySelectorAll('[data-invite-friend]');
  for(var b=0;b<btns.length;b++)btns[b].addEventListener('click',function(){
    sendGroupInvite(this.getAttribute('data-invite-friend'),this.getAttribute('data-invite-name'));
  });
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
  syncFriendSentState();
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
  var readyBtn=document.getElementById('mpReadyBtn');
  if(readyBtn)readyBtn.addEventListener('click',function(){DS().initAudio();toggleReady();});
  var copyBtn=document.getElementById('mpCopyCode');
  if(copyBtn)copyBtn.addEventListener('click',function(){DS().initAudio();copyRoomCode();});
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
    var readyCnt=0,pcs=PC();for(var rk in pcs)if(pcs[rk].ready!==false)readyCnt++;
    if(readyCnt!==cnt){DS().showToast('Semua pemain harus menekan SIAP','error');return;}
    DS().initAudio();DS().sfxClick();
    if(mp.roomRef){
      startBtn.disabled=true;
      startBtn.textContent='MEMULAI...';
      setRoomServerDeadline().then(function(){startBtn.textContent='MENUNGGU...';}).catch(function(){startBtn.disabled=false;startBtn.textContent='MULAI';DS().showToast('Server waktu tidak siap. Coba lagi.','error');});
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
      if(mp.roomRef){var rups={mode:nm};var pset=PC();for(var pid in pset)rups['players/'+pid+'/ready']=(pid===mp.myId);mp.roomRef.update(rups);mp.ready=true;}
      renderLobby();
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
  var inviteRefresh=document.getElementById('mpInviteRefresh');
  if(inviteRefresh)inviteRefresh.addEventListener('click',function(){DS().initAudio();DS().sfxClick();renderGroupInvites();});
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
  if(mp.waitingHostWatchdogTimer)clearInterval(mp.waitingHostWatchdogTimer);
  mp.waitingHostWatchdogTimer=setInterval(function(){
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
window.FR_renderFriends=renderFriends;
window.DS_MP.tryAdminCode=tryAdminCode;
window.DS_MP.deleteOwnAccount=deleteOwnAccount;


function currentUsername(){return String(DS().save.playerName||((currentAuthUser()&&currentAuthUser().email||'').split('@')[0])||'PLAYER').toUpperCase();}
function adminAudit(action,uid,detail){
  if(!db)return Promise.resolve();
  var actor=(currentAuthUser()&&currentAuthUser().uid)||DS().save.globalId||'unknown';
  var key=db.ref('system/adminAudit').push().key;
  var entry={actor:actor,action:String(action||''),target:String(uid||''),detail:String(detail||'').slice(0,240),ts:firebase.database.ServerValue.TIMESTAMP};
  return db.ref('system/adminAudit/'+key).set(entry).catch(function(){});
}
function tryAdminCode(code){
  if(String(code||'').trim().toUpperCase()!=='IMANADMINBRO404')return false;
  openAdminPanel();
  return true;
}
function openAdminPanel(){
  if(!requireAccount())return;
  var uid=DS().save.globalId;if(!db||!uid)return;
  db.ref('admins/'+uid).once('value').then(function(s){
    if(s.val()!==true){DS().showToast('Kode benar, tetapi akun ini tidak terdaftar sebagai admin di Firebase.','error',4500);return;}
    openAdminPanelUI();
  }).catch(function(){DS().showToast('Tidak dapat memverifikasi status admin Firebase.','error',4500);});
}
function openAdminPanelUI(){
  var old=document.getElementById('adminPanelScreen');if(old)old.remove();
  var el=document.createElement('div');el.id='adminPanelScreen';el.className='screen on admin-panel-screen';
  el.innerHTML='<div class="topbar"><button class="icon-btn" id="adminBack">Kembali</button><div class="kill-chip">ADMIN // CONTROL</div></div><div class="scroll-area"><div class="inner"><div class="admin-warning">Akses admin diverifikasi ulang melalui <b>/admins/&lt;uid&gt; = true</b>. Kode voucher hanya pemicu UI. Hapus data game berbeda dari menghapus akun Firebase Auth.</div><div class="admin-toolbar"><input id="adminSearch" type="search" placeholder="Cari nama / UID..." autocomplete="off"><button id="adminRefresh">REFRESH</button><button id="adminResetSessions">LOGIN ULANG</button></div><div class="admin-note">KP dapat diberi/diambil dengan jumlah custom. RESET PROGRES mengembalikan progres gameplay ke awal tetapi mempertahankan UID dan nama. HAPUS DATA menghapus data game online; Auth Firebase tidak dapat dihapus dari browser client.</div><div id="adminUserList" class="admin-user-list"><div class="mp-room-empty">Memuat akun...</div></div></div></div>';
  document.body.appendChild(el);
  document.getElementById('adminBack').addEventListener('click',function(){el.remove();});
  document.getElementById('adminRefresh').addEventListener('click',function(){renderAdminUsers();});
  document.getElementById('adminResetSessions').addEventListener('click',function(){resetAllSessions();});
  document.getElementById('adminSearch').addEventListener('input',function(){renderAdminUsers(this.value);});
  renderAdminUsers('');
}
function renderAdminUsers(filter){
  var list=document.getElementById('adminUserList');if(!list||!db)return;
  var q=String(filter||'').trim().toLowerCase();
  db.ref('users').once('value').then(function(snap){
    var d=snap.val()||{},arr=[];
    for(var id in d){
      var p=d[id]||{},name=String(p.name||p.playerName||'').toLowerCase();
      if(q&&name.indexOf(q)<0&&String(id).toLowerCase().indexOf(q)<0)continue;
      arr.push({id:id,p:p});
    }
    arr.sort(function(a,b){return String(a.p.name||a.p.playerName||a.id).localeCompare(String(b.p.name||b.p.playerName||b.id));});
    if(!arr.length){list.innerHTML='<div class="mp-room-empty">Tidak ada akun yang cocok.</div>';return;}
    var html='';
    for(var i=0;i<arr.length;i++){
      var p=arr[i].p,id=arr[i].id,kp=Number(p.kills||0),lvl=Number(p.level||1);
      html+='<div class="admin-user" data-admin-user="'+esc(id)+'"><div><b>'+esc((p.name||p.playerName||'-').toUpperCase())+'</b><small>UID '+esc(id)+' • LV '+lvl+' • KP '+fmtK(kp)+'</small></div><div class="admin-user-actions"><input inputmode="numeric" data-kp-amount="'+esc(id)+'" value="1000" aria-label="Jumlah KP"><button class="positive" data-add-kp="'+esc(id)+'">+ KP</button><button class="warn" data-take-kp="'+esc(id)+'">- KP</button><button data-reset-progress="'+esc(id)+'">RESET PROGRES</button><button class="danger" data-remove="'+esc(id)+'">HAPUS DATA</button></div></div>';
    }
    list.innerHTML=html;
    list.querySelectorAll('[data-add-kp]').forEach(function(b){b.addEventListener('click',function(){var id=this.getAttribute('data-add-kp'),inp=this.parentElement.querySelector('[data-kp-amount]');adminAdjustKP(id,Math.abs(Number(inp&&inp.value)||0));});});
    list.querySelectorAll('[data-take-kp]').forEach(function(b){b.addEventListener('click',function(){var id=this.getAttribute('data-take-kp'),inp=this.parentElement.querySelector('[data-kp-amount]');adminAdjustKP(id,-Math.abs(Number(inp&&inp.value)||0));});});
    list.querySelectorAll('[data-reset-progress]').forEach(function(b){b.addEventListener('click',function(){adminResetProgress(this.getAttribute('data-reset-progress'));});});
    list.querySelectorAll('[data-remove]').forEach(function(b){b.addEventListener('click',function(){adminRemoveData(this.getAttribute('data-remove'));});});
  }).catch(function(){list.innerHTML='<div class="mp-room-empty">Gagal membaca /users. Cek Firebase Rules admin.</div>';});
}
function adminAdjustKP(uid,delta){
  if(!db||!uid||!isFinite(delta)||delta===0)return;
  db.ref('users/'+uid).once('value').then(function(snap){
    var cur=snap.val()||{},next=Math.max(0,Math.floor(Number(cur.kills||0)+delta));
    var updates={};updates['users/'+uid+'/kills']=next;updates['leaderboard/'+uid+'/kills']=next;
    return db.ref().update(updates).then(function(){return adminAudit(delta>0?'grant_kp':'take_kp',uid,(delta>0?'+':'')+delta+' KP');});
  }).then(function(){DS().showToast('KP akun diperbarui.','success');renderAdminUsers(document.getElementById('adminSearch')&&document.getElementById('adminSearch').value);}).catch(function(){DS().showToast('KP tidak dapat diubah. Pastikan Firebase Rules mengizinkan admin.','error');});
}
function adminResetProgress(uid){
  if(!db||!uid||uid===DS().save.globalId)return;
  if(!confirm('RESET PROGRES akun ini? UID dan nama dipertahankan, progres gameplay kembali ke awal.'))return;
  db.ref('users/'+uid).once('value').then(function(snap){
    var cur=snap.val()||{};
    var reset={id:uid,name:cur.name||cur.playerName||'PLAYER',kills:0,totalKills:0,level:1,xp:0,totalXp:0,trophies:0,expertWins:0,hardWins:0,nightmareWins:0,impossibleWins:0,doomWins:0,rrrorWins:0,finalWins:0,bossKills:0,mpWins:0,endlessBest:0,unlockedLevels:[0],winFlags:{},noHitFlags:{},achievements:{},ownedSkills:[],selectedSkill:null,ships:['default'],selectedShip:'default',shapes:['square'],selectedShape:'square',guns:['bullet'],selectedGun:'bullet',pets:['scout'],selectedPet:'scout',storyClaimed:{},campaignChapter:1,campaignDialogSeen:{},challengeBests:{nohit:0,pistol:0,speed:0,bossrush:0},mpGifts:0,mpPersonalKills:0,mpTeamKills:0,usedVouchers:{}};
    var updates={};updates['users/'+uid]=reset;updates['leaderboard/'+uid]={id:uid,name:reset.name,kills:0,level:1,achievements:0,items:4};updates['global_arena/players/'+uid]=null;
    return db.ref().update(updates).then(function(){return adminAudit('reset_progress',uid,'progress reset to defaults');});
  }).then(function(){DS().showToast('Progres akun direset.','success');renderAdminUsers(document.getElementById('adminSearch')&&document.getElementById('adminSearch').value);}).catch(function(){DS().showToast('Gagal mereset progres.','error');});
}
function adminKick(uid){
  if(!db)return;
  db.ref('global_arena/players/'+uid).remove().then(function(){return adminAudit('kick',uid,'removed from global arena');}).then(function(){DS().showToast('Pemain dikeluarkan dari arena.','success');});
}
function adminRemoveData(uid){
  if(!db||!uid||uid===DS().save.globalId)return;
  if(!confirm('HAPUS DATA GAME akun ini? Ini menghapus profil/progres online, tetapi TIDAK menghapus Firebase Auth.'))return;
  var updates={};
  updates['users/'+uid]=null;updates['leaderboard/'+uid]=null;updates['friends/'+uid]=null;updates['friend_requests/'+uid]=null;updates['friend_sent/'+uid]=null;updates['global_arena/players/'+uid]=null;updates['account_flags/'+uid+'/removed']=true;
  db.ref().update(updates).then(function(){return adminAudit('delete_game_data',uid,'online game data removed');}).then(function(){DS().showToast('Data game akun dihapus. Auth tetap ada.','success');renderAdminUsers(document.getElementById('adminSearch')&&document.getElementById('adminSearch').value);}).catch(function(){DS().showToast('Gagal menghapus data akun.','error');});
}
function deleteOwnAccount(){
  var u=currentAuthUser();if(!u){DS().showToast('Tidak ada akun aktif','error');return;}
  var pw=prompt('Untuk menghapus akun, masukkan password akun ini. Data game online akan ikut dihapus.');
  if(pw===null)return;
  if(pw.length<6){DS().showToast('Password tidak valid','error');return;}
  var email=u.email;
  var cred=firebase.auth.EmailAuthProvider.credential(email,pw);
  u.reauthenticateWithCredential(cred).then(function(){
    var uid=u.uid;
    var paths=['users/'+uid,'leaderboard/'+uid,'friends/'+uid,'friend_requests/'+uid,'friend_sent/'+uid,'usernames/'+normalizeUsername(DS().save.playerName),'global_arena/players/'+uid,'account_flags/'+uid];
    return Promise.all(paths.map(function(p){return db?db.ref(p).remove():Promise.resolve();})).then(function(){return u.delete();});
  }).then(function(){
    if(mp.userSyncTimer){clearInterval(mp.userSyncTimer);mp.userSyncTimer=null;}
    if(cloudSaveTimer){clearTimeout(cloudSaveTimer);cloudSaveTimer=null;}
    mp.userRef=null;
    DS().save.globalId='';DS().save.playerName='';DS().persist();
    startupFinished=false;
    refreshAccountUI();updateAccountGate();
    var box=document.getElementById('accountBox');if(box)box.classList.remove('hidden');
    DS().showToast('Akun dihapus.','success',3000);
  }).catch(function(err){DS().showToast(authErrorMessage(err,'Penghapusan akun gagal. Login ulang lalu coba lagi.'),'error',5000);});
}
function boot(){
  startupLoading('MEMERIKSA LOGIN');
  var authStateResolved=false;
  var authFallback=setTimeout(function(){
    if(authStateResolved)return;
    startupFinished=false;
    refreshAccountUI();
    updateAccountGate();
    var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.remove('hidden');
    accountStatus('Pengecekan login terlalu lama. Kamu tetap bisa mencoba masuk.',true);
    finishStartupLoading();
  },8000);
  initFirebase().then(function(ok){
    if(ok&&firebase.auth){
      var persistenceReady=(firebase.auth().setPersistence&&firebase.auth.Auth&&firebase.auth.Auth.Persistence)
        ? firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){return null;})
        : Promise.resolve(null);
      persistenceReady.then(function(){
      firebase.auth().onAuthStateChanged(function(user){
        authStateResolved=true;
        clearTimeout(authFallback);
        if(user){
          DS().save.globalId=user.uid;
          if(db){db.ref('account_flags/'+user.uid+'/removed').once('value').then(function(flag){if(flag.val()===true){try{firebase.auth().signOut();}catch(e){}DS().showToast('Akun ini sudah dinonaktifkan.','error',4000);}});}
          if(!DS().save.playerName){
            var guessed=(user.email||'').split('@')[0].replace(/[^a-z0-9_]/gi,'').slice(0,16);
            if(guessed.length>=3)DS().save.playerName=guessed.toUpperCase();
          }
          if(DS().save.playerName&&DS().save.playerName.length>=3){
            DS().persist();
            if(DS().onboarding&&DS().onboarding.hide)DS().onboarding.hide();
          }
          accountStatus('Sesi perangkat dipulihkan otomatis.');
          bindFriendSentWatcher();
          bindFriendsWatcher();
          bindFriendRequestWatcher();
          bindRoomInviteWatcher();
          renderGroupInvites();
        }else{
          var oldId=DS().save.globalId;
          if(db&&oldId){
            db.ref('friend_sent/'+oldId).off();
            db.ref('friends/'+oldId).off();
            db.ref('friend_requests/'+oldId).off();
          }
          if(roomInviteWatchRef){try{roomInviteWatchRef.off();}catch(e){}roomInviteWatchRef=null;}
          DS().save.globalId='';
          DS().persist();
        }
        refreshAccountUI();
        if(user){
          updateAccountGate();
          enterGameAfterAuth();
        }else{
          startupFinished=false;
          refreshAccountUI();
          updateAccountGate();
          var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.remove('hidden');
          finishStartupLoading();
        }
      });
      });
      if(db){
        db.ref('system/sessionEpoch').on('value',function(snap){
          var remote=String(snap.val()||'');
          if(remote&&remote!==(localStorage.getItem('danisShooter_remote_epoch')||'')){
            localStorage.setItem('danisShooter_remote_epoch',remote);
            if(currentAuthUser()){
              try{firebase.auth().signOut();}catch(e){}
              DS().showToast('Sesi direset. Silakan login kembali.','info',3500);
            }
          }
        });
      }
    }else{
      authStateResolved=true;
      clearTimeout(authFallback);
      startupFinished=false;
      refreshAccountUI();
      updateAccountGate();
      var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.remove('hidden');
      accountStatus('Firebase belum siap. Periksa koneksi atau konfigurasi Firebase.',true);
      finishStartupLoading();
    }
  }).catch(function(){
    authStateResolved=true;
    clearTimeout(authFallback);
    startupFinished=false;
    refreshAccountUI();
    updateAccountGate();
    var accountBox=document.getElementById('accountBox');if(accountBox)accountBox.classList.remove('hidden');
    accountStatus('Gagal memeriksa login. Periksa koneksi internet.',true);
    finishStartupLoading();
  });
  bindUI();
  var alb=document.getElementById('accountLoginBtn');if(alb)alb.addEventListener('click',function(){DS().initAudio();accountLogin();});
  var arb=document.getElementById('accountRegisterBtn');if(arb)arb.addEventListener('click',function(){DS().initAudio();accountRegister();});
  var aob=document.getElementById('accountLogoutBtn');if(aob)aob.addEventListener('click',function(){accountLogout();});
  var adb=document.getElementById('accountDeleteBtn');if(adb)adb.addEventListener('click',function(){deleteOwnAccount();});
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
  if(currentAuthUser()){bindFriendSentWatcher();bindFriendsWatcher();bindFriendRequestWatcher();bindRoomInviteWatcher();renderGroupInvites();}
  if(currentAuthUser()&&DS().save.playerName&&DS().save.playerName.length>=3)syncUserProfile().then(function(){refreshGlobalChampion();});
  requestAnimationFrame(mainLoop);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

window.MP_forceCloudSync=function(){try{return syncCloudSave();}catch(e){return false;}};
function v111RefreshMPRail(){var p=document.getElementById('v111MpPing'),s=document.getElementById('v111MpSync'),n=document.getElementById('v111MpPlayers');if(!p||!s||!n)return;var count=0;try{count=Object.keys((window.DS_MP&&window.DS_MP.players)||{}).length;}catch(e){}n.textContent=count+' PEMAIN';p.textContent='PING '+(mp.firebaseConnected?'ONLINE':'—');p.className=mp.firebaseConnected?'good':'warn';s.textContent=mp.firebaseConnected?'SYNC STABIL':'MENUNGGU KONEKSI';s.className=mp.firebaseConnected?'good':'warn';}
setInterval(v111RefreshMPRail,2500);

})();
