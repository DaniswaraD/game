(function(){
'use strict';
var canvas=document.getElementById('game');
var ctx=canvas.getContext('2d',{alpha:false});
var W=0,H=0,elapsedTotal=0;
var BORDER=20,BASE_SIZE=46;
var BASE_MAX_HP=100;
var HEAL_BUBBLE_SPEED=120,BOOST_BUBBLE_SPEED=120,HEAL_RECOVER_RATIO=0.2;
var BOMB_DAMAGE=20;
var PLAYER_PROJ_SPEED=680,CONTACT_DAMAGE_FLAT=25,SPAWN_ANIM=0.25;
var MAX_PARTICLES=220,MAX_ENEMY_PROJECTILES=250,MAX_PLAYER_PROJECTILES=140;
var MAX_SHOCKWAVES=20,MAX_AMBIENT_FAR=18,MAX_AMBIENT_NEAR=12;
var EDGE_PAD=4;
var TIER_SECONDS=10;
var BOSS_HP_MULT=15;
var MAX_UPGRADE_LEVEL=5;
var MAX_LEVEL=999;
var SIDE_LASER_DAMAGE=35;
var SIDE_LASER_START_TIME=30;

var STREAK_LABELS=[
  {n:2,label:'DOUBLE KILL'},{n:3,label:'TRIPEL KILL'},{n:5,label:'ENEMY HUNTER'},
  {n:10,label:'ENEMY DESTROYER'},{n:15,label:'ENEMY EVAPORIZER'},{n:20,label:'LIVING MACHINE'},
  {n:25,label:'HUNTER GOD'},{n:30,label:'DESTROYER GOD'},{n:35,label:'KILLING MACHINE'},
  {n:40,label:'MAXIMUM OVERDRIVE'},{n:45,label:'NOT A HUMAN'}
];

var VOUCHERS={
  'DANIS':5000,'PLSKP':1000,'IYN10':10000,'BHMA5':50000,'BMIYN':15000,
  'DAMNN':100000,'TMOTY':50000,'BIM40':40000,'IY400':40000,'LOLSZ':10000000000,'ITZME':100000000000000000000000000000000000
};

var SAVE_KEY='danisShooter_save_v5';
var SAVE_KEY_LEGACY='danisShooter_save_v4';
var SAVE_KEY_LEGACY2='danisShooter_save_v3';
var SAVE_KEY_LEGACY3='danisShooter_save_v2';
var storageAvailable=false,storageError='';

function checkStorage(){
  try{var k='__ds_test__';localStorage.setItem(k,'1');localStorage.removeItem(k);storageAvailable=true;storageError='';return true;}
  catch(e){storageAvailable=false;storageError=e&&e.message?e.message:String(e);return false;}
}

var DEFAULT_ITEMS={gun:['bullet'],ship:['default'],pet:['scout']};
function isDefaultItem(type,id){var l=DEFAULT_ITEMS[type];return l&&l.indexOf(id)>=0;}

var PLAYER_TIERS=[
  {dmg:2,rof:1},{dmg:3,rof:2},{dmg:5,rof:4},{dmg:8,rof:7},{dmg:12,rof:10},
  {dmg:17,rof:13},{dmg:23,rof:16},{dmg:30,rof:19},{dmg:38,rof:22},{dmg:47,rof:25},
  {dmg:58,rof:28},{dmg:72,rof:32},{dmg:88,rof:36},{dmg:108,rof:40},{dmg:132,rof:45}
];

var save={
  kills:0,totalKills:0,level:1,xp:0,totalXp:0,trophies:0,mpGifts:0,
  ownedSkills:[],selectedSkill:null,
  ships:['default'],selectedShip:'default',
  shapes:['square'],selectedShape:'square',
  guns:['bullet'],selectedGun:'bullet',
  achievements:{},
  expertWins:0,hardWins:0,nightmareWins:0,impossibleWins:0,doomWins:0,rrrorWins:0,finalWins:0,bossKills:0,
  winFlags:{},noHitFlags:{},comboMax:0,startingUpgrades:[],
  soundVol:80,bgmVol:50,bgmOn:true,shakeAmt:100,
  gunUpgrades:{},shipUpgrades:{},skillUpgrades:{},bestKills:{},
  unlockedLevels:[0],usedVouchers:{},playerName:'',mpWins:0,
  pets:['scout'],selectedPet:'scout',petUpgrades:{},
  endlessBest:0,challengeBests:{nohit:0,pistol:0,speed:0,bossrush:0},
  globalId:'',friends:{},friendRequests:{},friendSent:{}
};

var killDirty=false,lastPersistTime=0;

function loadSave(){
  var loaded=false;
  try{
    var raw=localStorage.getItem(SAVE_KEY)||localStorage.getItem(SAVE_KEY_LEGACY)||localStorage.getItem(SAVE_KEY_LEGACY2)||localStorage.getItem(SAVE_KEY_LEGACY3);
    if(!raw)return;
    var s=JSON.parse(raw);
    if(!s)return;
    for(var k in save){if(s[k]!==undefined)save[k]=s[k];}
    loaded=true;
  }catch(e){storageError='Load error: '+(e&&e.message?e.message:'unknown');}
  validateSave();
  if(loaded)updateStorageStatus('Data tersimpan dimuat',true);
  return loaded;
}

function validateSave(){
  if(save.ships.indexOf('default')<0)save.ships.unshift('default');
  if(save.ships.indexOf(save.selectedShip)<0)save.selectedShip='default';
  if(!Array.isArray(save.shapes))save.shapes=['square'];
  if(save.shapes.indexOf('square')<0)save.shapes.unshift('square');
  if(save.shapes.indexOf(save.selectedShape)<0)save.selectedShape='square';
  if(save.guns.indexOf('bullet')<0)save.guns.unshift('bullet');
  if(save.guns.indexOf(save.selectedGun)<0)save.selectedGun='bullet';
  if(!Array.isArray(save.pets))save.pets=['scout'];
  if(save.pets.indexOf('scout')<0)save.pets.unshift('scout');
  if(save.pets.indexOf(save.selectedPet)<0)save.selectedPet='scout';
  if(save.selectedSkill&&save.ownedSkills.indexOf(save.selectedSkill)<0)save.selectedSkill=null;
  if(save.unlockedLevels.indexOf(0)<0)save.unlockedLevels.push(0);
  if(typeof save.kills!=='number'||!isFinite(save.kills))save.kills=0;
  if(!save.usedVouchers||typeof save.usedVouchers!=='object')save.usedVouchers={};
  if(typeof save.level!=='number'||!isFinite(save.level)||save.level<1)save.level=1;
  if(save.level>MAX_LEVEL)save.level=MAX_LEVEL;
  if(typeof save.xp!=='number'||!isFinite(save.xp)||save.xp<0)save.xp=0;
  if(typeof save.totalXp!=='number'||!isFinite(save.totalXp)||save.totalXp<0)save.totalXp=0;
  if(typeof save.trophies!=='number'||!isFinite(save.trophies)||save.trophies<0)save.trophies=0;
  if(typeof save.mpGifts!=='number'||!isFinite(save.mpGifts)||save.mpGifts<0)save.mpGifts=0;
  if(typeof save.endlessBest!=='number'||!isFinite(save.endlessBest))save.endlessBest=0;
  if(!save.challengeBests||typeof save.challengeBests!=='object')save.challengeBests={nohit:0,pistol:0,speed:0,bossrush:0};
  if(!save.friends||typeof save.friends!=='object')save.friends={};
  if(!save.friendRequests||typeof save.friendRequests!=='object')save.friendRequests={};
  if(!save.friendSent||typeof save.friendSent!=='object')save.friendSent={};
  if(!save.globalId)save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  if(typeof save.playerName!=='string')save.playerName='';
}

function persist(){
  if(!storageAvailable){if(!checkStorage()){updateStorageStatus('LocalStorage tidak tersedia',false);return false;}}
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify(save));
    localStorage.removeItem(SAVE_KEY_LEGACY);
    localStorage.removeItem(SAVE_KEY_LEGACY2);
    localStorage.removeItem(SAVE_KEY_LEGACY3);
    lastPersistTime=Date.now();killDirty=false;
    updateStorageStatus('Tersimpan '+new Date(lastPersistTime).toLocaleTimeString('id-ID'),true);
    return true;
  }catch(e){storageError='Save error: '+(e&&e.message?e.message:'unknown');updateStorageStatus('Gagal menyimpan',false);return false;}
}

function updateStorageStatus(msg,ok){
  var el=document.getElementById('storageStatus'),dsc=document.getElementById('storageDesc');
  if(el)el.textContent=msg;
  if(dsc){
    if(!ok&&storageError)dsc.textContent=storageError;
    else dsc.textContent='Auto-save aktif. Data tersimpan di browser.';
  }
}

function xpNeededForLevel(lv){
  if(lv>=MAX_LEVEL)return 0;
  if(lv===1)return 10;
  if(lv===2)return 20;
  if(lv===3)return 40;
  if(lv===4)return 80;
  if(lv===5)return 125;
  if(lv===6)return 175;
  return 175+(lv-6)*60;
}

function addXP(amount){
  if(!amount||amount<=0)return 0;
  save.xp+=amount;save.totalXp+=amount;
  var leveled=0;
  while(save.level<MAX_LEVEL&&save.xp>=xpNeededForLevel(save.level)){
    save.xp-=xpNeededForLevel(save.level);
    save.level++;leveled++;
  }
  if(leveled>0){sfxUpg();showToast('Naik ke Level '+save.level+'!','success',2800);}
  killDirty=true;
  updateMenuCard();updateMPLevelBadge();
  return leveled;
}

function grantKP(amount){
  if(!amount||amount<=0)return;
  save.kills+=amount;save.totalKills+=amount;
  addXP(amount);
  killDirty=true;
  refreshHeaderKills();refreshProfile();
}

function isLevelUnlocked(i){return save.unlockedLevels.indexOf(i)>=0;}
function unlockLevel(i){if(save.unlockedLevels.indexOf(i)<0){save.unlockedLevels.push(i);persist();}}

function chapterComplete(ch){
  var list=LEVELS.filter(function(L){return L.chapter===ch&&!L.isEndless;});
  for(var i=0;i<list.length;i++){if(!save.winFlags[list[i].id])return false;}
  return true;
}

function isChapterUnlocked(ch){
  if(ch===1)return true;
  if(ch===2)return chapterComplete(1);
  if(ch===3)return chapterComplete(2);
  if(ch===4)return chapterComplete(3);
  if(ch===5)return chapterComplete(4);
  return false;
}

function showToast(msg,type,duration){
  type=type||'info';duration=duration||2400;
  var c=document.getElementById('toastContainer');if(!c)return;
  var el=document.createElement('div');
  el.className='toast '+type;
  el.textContent=msg;
  c.appendChild(el);
  void el.offsetWidth;
  el.classList.add('on');
  setTimeout(function(){el.classList.remove('on');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},400);},duration);
}

var confirmCallbackYes=null,confirmCallbackNo=null;
function showConfirm(msg,onYes,onNo){
  confirmCallbackYes=onYes||null;
  confirmCallbackNo=onNo||null;
  var msgEl=document.getElementById('confirmMsg'),modal=document.getElementById('confirmModal');
  if(!msgEl||!modal)return;
  msgEl.textContent=msg;
  modal.classList.add('on');
}
function hideConfirm(yes){
  var modal=document.getElementById('confirmModal');if(!modal)return;
  modal.classList.remove('on');
  var cb=yes?confirmCallbackYes:confirmCallbackNo;
  confirmCallbackYes=null;confirmCallbackNo=null;
  if(cb)setTimeout(function(){try{cb();}catch(e){}},50);
}

function getUpgradeLevel(type,id){
  if(type==='gun')return save.gunUpgrades[id]||0;
  if(type==='ship')return save.shipUpgrades[id]||0;
  if(type==='skill')return save.skillUpgrades[id]||0;
  if(type==='pet')return save.petUpgrades[id]||0;
  return 0;
}
function setUpgradeLevel(type,id,lv){
  if(type==='gun')save.gunUpgrades[id]=lv;
  else if(type==='ship')save.shipUpgrades[id]=lv;
  else if(type==='skill')save.skillUpgrades[id]=lv;
  else if(type==='pet')save.petUpgrades[id]=lv;
}
function nextUpgradeCost(baseCost,lv){return Math.round(baseCost*(2+1.5*lv));}
function getShipPassive(){var s=findShip(save.selectedShip);return s.passive||{};}
function getShapePassive(){var s=findShape(save.selectedShape);return s.passive||{};}
function getGunUpgradeBonus(id){
  var lv=getUpgradeLevel('gun',id);
  return {lv:lv,dmgMult:1+0.35*lv,rofMult:1+0.15*lv,speedMult:1+0.10*lv,sizeMult:1+0.08*lv};
}

function canBuyByChapter(ch){
  if(ch===null||ch===undefined)return true;
  if(ch===1)return true;
  if(ch===2)return chapterComplete(1);
  if(ch===3)return chapterComplete(2);
  if(ch===4)return chapterComplete(3);
  if(ch===5)return chapterComplete(4);
  return true;
}

var audioCtx=null;
var bgmPlaying=false,bgmTimer=null;
function initAudio(){if(audioCtx)return;try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){audioCtx=null;}}
function beep(freq,dur,type,vol,slide){
  if(!audioCtx)return;
  var gain=(save.soundVol/100)*(vol||0.04);
  if(gain<=0.0005)return;
  try{
    var t=audioCtx.currentTime;
    var o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type||'square';
    o.frequency.setValueAtTime(freq,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
    g.gain.setValueAtTime(gain,t);
    g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    o.connect(g);g.connect(audioCtx.destination);
    o.start(t);o.stop(t+dur+0.02);
  }catch(e){}
}
function sfxShoot(){beep(900,0.04,'square',0.015,500);}
function sfxLaser(){beep(1400,0.06,'sawtooth',0.02,700);}
function sfxHit(){beep(260,0.05,'square',0.03,140);}
function sfxDeath(){beep(180,0.14,'sawtooth',0.04,60);}
function sfxHeal(){beep(660,0.14,'sine',0.05,1320);}
function sfxRoar(){beep(80,0.55,'sawtooth',0.08,36);setTimeout(function(){beep(120,0.5,'square',0.06,55);},90);}
function sfxWave(){beep(400,0.16,'triangle',0.045,900);}
function sfxClick(){beep(650,0.035,'square',0.025);}
function sfxBuy(){beep(880,0.08,'sine',0.05,1320);}
function sfxUpg(){beep(500,0.08,'square',0.05,900);setTimeout(function(){beep(1000,0.12,'sine',0.05,1500);},80);setTimeout(function(){beep(1400,0.15,'sine',0.05,1800);},160);}
function sfxBossDie(){beep(220,0.35,'sawtooth',0.07,60);setTimeout(function(){beep(400,0.3,'square',0.06,100);},150);setTimeout(function(){beep(660,0.5,'sine',0.06,1200);},300);}
function sfxAch(){beep(660,0.1,'sine',0.05);setTimeout(function(){beep(880,0.1,'sine',0.05);},100);setTimeout(function(){beep(1320,0.22,'sine',0.055);},200);}
function sfxPower(){beep(500,0.08,'square',0.05,900);setTimeout(function(){beep(900,0.12,'sine',0.05,1400);},70);}
function sfxStreak(){beep(780,0.06,'square',0.05,1400);setTimeout(function(){beep(1040,0.08,'sine',0.05,1600);},60);}
function sfxPoison(){beep(320,0.08,'sine',0.04,180);}
function sfxBomb(){beep(120,0.3,'sawtooth',0.08,40);setTimeout(function(){beep(200,0.2,'square',0.06,60);},80);}
function sfxUnlock(){beep(700,0.1,'sine',0.06);setTimeout(function(){beep(1000,0.15,'sine',0.06);},100);setTimeout(function(){beep(1500,0.2,'sine',0.06);},220);}
function sfxVoucherOk(){beep(660,0.1,'sine',0.06);setTimeout(function(){beep(880,0.1,'sine',0.06);},100);setTimeout(function(){beep(1320,0.18,'sine',0.06);},200);setTimeout(function(){beep(1760,0.25,'sine',0.06);},320);}
function sfxVoucherBad(){beep(200,0.15,'square',0.06,100);setTimeout(function(){beep(150,0.2,'square',0.06,80);},120);}
function sfxSecret(){beep(500,0.05,'square',0.05);setTimeout(function(){beep(700,0.05,'square',0.05);},60);setTimeout(function(){beep(900,0.05,'square',0.05);},120);setTimeout(function(){beep(1200,0.15,'sine',0.06);},180);}
function sfxMP(){beep(700,0.08,'sine',0.05);setTimeout(function(){beep(1100,0.12,'sine',0.05);},70);}
function sfxRevive(){beep(500,0.1,'sine',0.06);setTimeout(function(){beep(800,0.12,'sine',0.06);},90);setTimeout(function(){beep(1200,0.18,'sine',0.06);},180);}
function sfxEmoji(){beep(900,0.05,'sine',0.04);setTimeout(function(){beep(1300,0.08,'sine',0.04);},50);}
function sfxGift(){beep(600,0.06,'sine',0.05);setTimeout(function(){beep(900,0.06,'sine',0.05);},60);setTimeout(function(){beep(1200,0.06,'sine',0.05);},120);setTimeout(function(){beep(1600,0.14,'sine',0.05);},180);}
function sfxVictory(){beep(660,0.12,'sine',0.06);setTimeout(function(){beep(880,0.12,'sine',0.06);},110);setTimeout(function(){beep(1100,0.14,'sine',0.06);},220);setTimeout(function(){beep(1320,0.28,'sine',0.06);},340);}
function sfxSpin(){beep(600,0.05,'square',0.04);setTimeout(function(){beep(800,0.05,'square',0.04);},50);setTimeout(function(){beep(1000,0.05,'square',0.04);},100);setTimeout(function(){beep(1300,0.1,'sine',0.05);},150);}

function startBGM(){
  if(!audioCtx||!save.bgmOn||bgmPlaying)return;
  bgmPlaying=true;
  var bpm=110,beatDur=60/bpm;
  var seq=[220,277,330,277,220,277,330,392,349,277,220,196];
  var step=0;
  function scheduleNext(){
    if(!bgmPlaying||!audioCtx||!save.bgmOn)return;
    var t=audioCtx.currentTime;
    var g=audioCtx.createGain();
    var vol=(save.bgmVol/100)*0.03;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vol,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001,t+beatDur*0.85);
    g.connect(audioCtx.destination);
    var o=audioCtx.createOscillator();
    o.type='triangle';
    o.frequency.value=seq[step%seq.length];
    o.connect(g);o.start(t);o.stop(t+beatDur*0.9);
    var o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    g2.gain.setValueAtTime(0.0001,t);
    g2.gain.linearRampToValueAtTime(vol*0.7,t+0.05);
    g2.gain.exponentialRampToValueAtTime(0.0001,t+beatDur*0.5);
    g2.connect(audioCtx.destination);
    o2.type='sine';o2.frequency.value=seq[step%seq.length]/2;
    o2.connect(g2);o2.start(t);o2.stop(t+beatDur*0.55);
    step++;
    bgmTimer=setTimeout(scheduleNext,beatDur*1000);
  }
  scheduleNext();
}
function stopBGM(){bgmPlaying=false;if(bgmTimer){clearTimeout(bgmTimer);bgmTimer=null;}}

var ICONS={
  skull:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.03 2 3 6.03 3 11c0 2.4 1 4.6 2.5 6.2V21c0 .55.45 1 1 1h11c.55 0 1-.45 1-1v-3.8C20 15.6 21 13.4 21 11c0-4.97-4.03-9-9-9zM8.5 13c-.83 0-1.5-.67-1.5-1.5S7.67 10 8.5 10 10 10.67 10 11.5 9.33 13 8.5 13zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 14l-1.5 3h3L12 14z"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  spike:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 5h-2v4h-2V7H9l3-5zm0 20l-3-5h2v-4h2v4h2l-3 5zM2 12l5 3v-2h4v-2H7V9l-5 3zm20 0l-5-3v2h-4v2h4v2l5-3z"/></svg>',
  magnet:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8c0-2.2 1.8-4 4-4h2v6H8c-1.1 0-2 .9-2 2s.9 2 2 2h2v6H8c-2.2 0-4-1.8-4-4V8zm8-4h2c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4h-2v-6h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2V4z"/></svg>',
  bullets:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h3v9H7V3zm7 0h3v9h-3V3zM7 15h3v6H7v-6zm7 0h3v6h-3v-6z"/></svg>',
  snow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2v6.17l-2.59-2.58L7 7l4 4-4 4 1.41 1.41L11 13.83V20h2v-6.17l2.59 2.58L17 15l-4-4 4-4-1.41-1.41L13 8.17V2h-2z"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h14v3h3v3c0 3.3-2.7 6-6 6h-1c-.5 2.4-2.5 4.3-5 4.9V21h4v2H6v-2h4v-1.1C7.5 19.3 5.5 17.4 5 15H4c-3.3 0-6-2.7-6-6V6h3V3z"/></svg>',
  boss:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 4 5-1-2 5 3 3-3 3 2 5-5-1-3 4-3-4-5 1 2-5-3-3 3-3-2-5 5 1z"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.5l-6.3 4.3 2.3-7.2-6-4.4h7.6z"/></svg>',
  combo:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 21l-1-8H6l7-12v9h4l-6 11z"/></svg>',
  leaf:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.2 3.8 17.4c-.3.2-.5.3-.6.5l.6.1c2.1-.3 3.1-1 4.7-1.8C9 15.4 9.2 14 11 14c2 0 3 1 5 1 0-1.5-.5-2.5-1.5-3.5C15 10.5 16 9.5 17 8z"/></svg>',
  bullet:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8v12h-4V10z"/></svg>',
  heavy:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
  laser:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v20h-2z"/></svg>',
  zigzag:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v4l3 2-3 2 3 2-3 2 3 2-3 2v4h-2v-4l-3-2 3-2-3-2 3-2-3-2 3-2z"/></svg>',
  spread:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 6h-4l2-6zm-5 8l2 6h-4l2-6zm10 0l2 6h-4l2-6zM12 14l3 8h-6l3-8z"/></svg>',
  shotgun:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v6h-2zM8 10h2v4H8zm6 0h2v4h-2zM5 16h2v4H5zm4 0h2v4H9zm4 0h2v4h-2zm4 0h2v4h-2z"/></svg>',
  homing:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 5 5 5 9c0 3 2 5 4 6v7h6v-7c2-1 4-3 4-6 0-4-3-7-7-7zm0 10c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/></svg>',
  machinegun:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3h4v5h-4zM10 10h4v5h-4zM10 17h4v5h-4zM4 10h4v5H4zM16 10h4v5h-4z"/></svg>',
  rocket:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2 4 3 7 3 10l-3 4-3-4c0-3 1-6 3-10zM6 20l2-2 4 2 4-2 2 2-6 2z"/></svg>',
  plasma:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>',
  sniper:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.5 8h-3zm-5 6h10l-1 3H8zm2 5h6l-1 9h-4z"/></svg>',
  triple:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2h2v6h-2zm-5 4h2v6H6zm10 0h2v6h-2zM11 10h2v12h-2zm-5 2h2v10H6zm10 0h2v10h-2z"/></svg>',
  wave:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0v3c-2-3-4-3-6 0s-4 3-6 0-4-3-6 0z"/></svg>',
  flame:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c2 4 4 6 4 10a4 4 0 11-8 0c0-2 1-3 2-4 0 1 .5 2 1.5 2C12 8 11 5 12 2z"/></svg>',
  ice:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 4-2 2 4 2-4 2 2 2-2 4-2-4 2-2-4-2 4-2-2-2z"/></svg>',
  lightning:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L5 14h5l-2 8 9-13h-5z"/></svg>',
  deathray:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 100 12 6 6 0 000-12zm0 18h-2v2h4v-2h-2z"/></svg>',
  bomb:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="11" cy="14" r="7"/><path d="M17 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/></svg>',
  slow:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.4l4 2.3-1 1.7-5-3V7z"/></svg>',
  leech:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7 2 4 6 4 11c0 6 8 11 8 11s8-5 8-11c0-5-3-9-8-9zm0 12c-1.5 0-3-1-3-3s1.5-3 3-3 3 1 3 3-1.5 3-3 3z"/></svg>',
  rage:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7v8l10-12h-7z"/></svg>',
  mirror:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6z"/></svg>',
  chain:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 6a5 5 0 015 5v2a3 3 0 006 0v-2h2v2a5 5 0 01-10 0v-2a3 3 0 00-6 0v2H2v-2a5 5 0 015-5z"/></svg>',
  voidbeam:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z"/></svg>',
  crit:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 7h7l-6 4 3 9-6-5-6 5 3-9-6-4h7z"/></svg>',
  dodge:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z"/></svg>',
  armor:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 6v6c0 6 5 10 10 10s10-4 10-10V6z"/></svg>',
  vampiric:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-4 3-8 5-8 10a8 8 0 1016 0c0-5-4-7-8-10zm0 14a4 4 0 110-8 4 4 0 010 8z"/></svg>',
  ricochet:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4l6 6-3 3 6 6h7v-3l-5-5 3-3z"/></svg>',
  greedy:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 2-4 5 1 7-6-3-6 3 1-7-4-5 6-2z"/></svg>',
  precision:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>',
  poison:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v2h-1v3h2l1 4-2 1 1 2-2 8H10l-2-8 1-2-2-1 1-4h2V4H9z"/></svg>',
  square:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  triangle:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,3 22,20 2,20"/></svg>',
  circleShape:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>',
  hexagon:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/></svg>',
  diamondShape:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 22,12 12,22 2,12"/></svg>',
  complexShape:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15,9 22,9 16,13 19,21 12,16 5,21 8,13 2,9 9,9"/></svg>',
  pentagon:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 22,9 18,21 6,21 2,9"/></svg>',
  octagon:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8"/></svg>',
  cross:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>',
  arrow:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 22,12 16,12 16,22 8,22 8,12 2,12"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 3h3l1 3 3 1v3l-3 1-1 3h-3l-2 3-2-3H7l-1-3-3-1v-3l3-1 1-3h3zm0 6a4 4 0 100 8 4 4 0 000-8z"/></svg>',
  crystal:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 20,9 16,22 8,22 4,9"/></svg>',
  shieldShape:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z"/></svg>',
  scout:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/><path d="M2 12l4-3v6zM22 12l-4-3v6z"/></svg>',
  guardian:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6z"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>',
  medic:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="3" width="6" height="18" rx="2"/><rect x="3" y="9" width="18" height="6" rx="2"/></svg>',
  ammo:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 4h3v8H8zm5 0h3v8h-3zM8 14h3v6H8zm5 0h3v6h-3z"/></svg>',
  swift:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 12l6-6v4h10v4H10v4z"/></svg>',
  magnetPet:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8c0-2.2 1.8-4 4-4h2v6H8c-1.1 0-2 .9-2 2s.9 2 2 2h2v6H8c-2.2 0-4-1.8-4-4V8zm8-4h2c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4h-2v-6h2c1.1 0 2-.9 2-2s-.9-2-2-2h-2V4z"/></svg>',
  barrier:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.5"/><circle cx="12" cy="12" r="6"/></svg>',
  voidPet:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4" fill="#fff"/></svg>'
};

var PETS=[
  {id:'scout',name:'SCOUT DRONE',desc:'Menembak musuh terdekat secara otomatis',cost:800,icon:'scout',type:'attacker',tagLabel:'ATTACKER',chapter:1,baseDmg:8,rof:0.8,range:300},
  {id:'guardian',name:'GUARDIAN ORB',desc:'Serap sebagian damage yang kamu terima',cost:1500,icon:'guardian',type:'tank',tagLabel:'TANK',chapter:2,armor:0.10},
  {id:'medic',name:'MEDIC BOT',desc:'Pulihkan HP secara berkala',cost:2200,icon:'medic',type:'helper',tagLabel:'HELPER',chapter:2,heal:5,interval:6},
  {id:'ammo',name:'AMMO BOOSTER',desc:'Tingkatkan damage senjata',cost:2800,icon:'ammo',type:'buffer',tagLabel:'BUFFER',chapter:3,dmgMult:1.10},
  {id:'swift',name:'SWIFT WING',desc:'Tingkatkan rate of fire',cost:3400,icon:'swift',type:'buffer',tagLabel:'BUFFER',chapter:3,rofMult:1.08},
  {id:'magnetPet',name:'MAGNET CORE',desc:'Tarik item & power-up di sekitar',cost:3800,icon:'magnetPet',type:'helper',tagLabel:'HELPER',chapter:3,radius:180},
  {id:'barrier',name:'BARRIER SPHERE',desc:'Berikan shield berkala saat bertarung',cost:4800,icon:'barrier',type:'tank',tagLabel:'TANK',chapter:4,shieldDuration:2.5,interval:14},
  {id:'voidPet',name:'VOID COMPANION',desc:'Rantai petir otomatis ke musuh',cost:6500,icon:'voidPet',type:'mage',tagLabel:'MAGE',chapter:4,chainDmg:22,chainInterval:1.3}
];

var SKILLS=[
  {id:'health',name:'PEMULIHAN',desc:'Pulihkan 50 HP seketika',cost:120,cooldown:10,duration:0,icon:'heart',chapter:1},
  {id:'spikes',name:'DURI BALIK',desc:'Pantulkan 35% damage ke musuh',cost:180,cooldown:10,duration:5,icon:'spike',chapter:1},
  {id:'magnet',name:'MAGNET',desc:'Tarik semua item di layar',cost:360,cooldown:12,duration:8,icon:'magnet',chapter:1},
  {id:'gatling',name:'TEMBAK CEPAT',desc:'Rate of fire naik 250%',cost:540,cooldown:10,duration:3,icon:'bullets',chapter:1},
  {id:'freeze',name:'BEKUKAN',desc:'Semua musuh berhenti',cost:660,cooldown:14,duration:4,icon:'snow',chapter:2},
  {id:'invincible',name:'KEBAL',desc:'Tidak bisa diserang',cost:780,cooldown:15,duration:5,icon:'shield',chapter:2},
  {id:'wipeout',name:'PEMBASMI',desc:'Satu tembakan langsung membunuh',cost:1200,cooldown:15,duration:10,icon:'skull',chapter:2},
  {id:'bomb',name:'BOM NUKLIR',desc:'Damage besar ke semua musuh',cost:1500,cooldown:18,duration:0,icon:'bomb',chapter:2},
  {id:'slow',name:'PELAMBAT',desc:'Musuh bergerak 60% lebih lambat',cost:1800,cooldown:16,duration:6,icon:'slow',chapter:3},
  {id:'leech',name:'SEDOT DARAH',desc:'Pulihkan HP setiap kill',cost:2200,cooldown:14,duration:10,icon:'leech',chapter:3},
  {id:'rage',name:'AMARAH',desc:'Damage 2x lipat',cost:2700,cooldown:15,duration:8,icon:'rage',chapter:3},
  {id:'mirror',name:'CERMIN',desc:'Pantulkan 100% damage ke musuh',cost:3300,cooldown:18,duration:6,icon:'mirror',chapter:3},
  {id:'chain',name:'PETIR RANTAI',desc:'Auto serang musuh terdekat tiap 0.4s',cost:4000,cooldown:16,duration:8,icon:'chain',chapter:3},
  {id:'voidbeam',name:'SINAR KOSONG',desc:'Tembakan beam cepat otomatis',cost:5000,cooldown:20,duration:5,icon:'voidbeam',chapter:4}
];

var SHIPS=[
  {id:'default',name:'RANGER',cost:0,body:'#5cc27a',edge:'#2a5c3a',glowA:'rgba(92,194,122,0.5)',glowB:'rgba(92,194,122,0)',cockpit:'#d4f0ff',passiveDesc:'Seimbang (default)',passive:{},fx:'default',chapter:1},
  {id:'azure',name:'AZURE',cost:90,body:'#5aa6e8',edge:'#1e3a5c',glowA:'rgba(120,190,255,0.55)',glowB:'rgba(120,190,255,0)',cockpit:'#e0f2ff',passiveDesc:'+5% Damage',passive:{dmgMult:1.05},fx:'ripple',chapter:1},
  {id:'emerald',name:'EMERALD',cost:180,body:'#4dd89a',edge:'#1e5a3a',glowA:'rgba(120,255,180,0.55)',glowB:'rgba(120,255,180,0)',cockpit:'#d8ffe8',passiveDesc:'+8% Max HP',passive:{hpMult:1.08},fx:'leaf',chapter:1},
  {id:'royal',name:'ROYAL',cost:270,body:'#e8c552',edge:'#6a4e14',glowA:'rgba(255,220,100,0.55)',glowB:'rgba(255,220,100,0)',cockpit:'#fff4d0',passiveDesc:'+15% Poin kill',passive:{goldMult:1.15},fx:'sparkle',chapter:1},
  {id:'obsidian',name:'OBSIDIAN',cost:375,body:'#4a4a5c',edge:'#1a1a2a',glowA:'rgba(160,160,210,0.55)',glowB:'rgba(160,160,210,0)',cockpit:'#d0d0ff',passiveDesc:'-10% damage diterima',passive:{armorMult:0.9},fx:'smoke',chapter:2},
  {id:'void',name:'VOID',cost:510,body:'#a55ae8',edge:'#4a206a',glowA:'rgba(210,140,255,0.55)',glowB:'rgba(210,140,255,0)',cockpit:'#ecd8ff',passiveDesc:'+12% Damage',passive:{dmgMult:1.12},fx:'swirl',chapter:2},
  {id:'blood',name:'BLOOD',cost:675,body:'#e84848',edge:'#6a1818',glowA:'rgba(255,110,110,0.55)',glowB:'rgba(255,110,110,0)',cockpit:'#ffd8d8',passiveDesc:'+20% DMG, -10% HP',passive:{dmgMult:1.20,hpMult:0.9},fx:'blood',chapter:2},
  {id:'phantom',name:'PHANTOM',cost:900,body:'#8a72c8',edge:'#3a2a5a',glowA:'rgba(190,160,255,0.6)',glowB:'rgba(190,160,255,0)',cockpit:'#e4dcff',passiveDesc:'12% Dodge',passive:{dodgeChance:0.12},fx:'ghost',chapter:2},
  {id:'frost',name:'FROST',cost:1200,body:'#a8dce8',edge:'#4a7a8a',glowA:'rgba(220,245,255,0.65)',glowB:'rgba(220,245,255,0)',cockpit:'#ffffff',passiveDesc:'+10% Rate of fire',passive:{rofMult:1.10},fx:'ice',chapter:2},
  {id:'rainbow',name:'RAINBOW',cost:1800,body:'#ff85b8',edge:'#7a2a5a',glowA:'rgba(255,160,220,0.6)',glowB:'rgba(160,220,255,0.3)',cockpit:'#fff8e8',passiveDesc:'+15% DMG, +10% HP, +15% Poin',passive:{dmgMult:1.15,hpMult:1.10,goldMult:1.15},fx:'rainbow',chapter:3},
  {id:'solar',name:'SOLAR',cost:2400,body:'#ffa94a',edge:'#7a3a05',glowA:'rgba(255,200,100,0.65)',glowB:'rgba(255,150,50,0)',cockpit:'#fff0d0',passiveDesc:'+20% Damage',passive:{dmgMult:1.20},fx:'fire',chapter:3},
  {id:'lunar',name:'LUNAR',cost:3200,body:'#e0e8f0',edge:'#6a7a8a',glowA:'rgba(220,240,255,0.7)',glowB:'rgba(180,210,240,0)',cockpit:'#ffffff',passiveDesc:'+20% Max HP',passive:{hpMult:1.20},fx:'moon',chapter:3},
  {id:'nebula',name:'NEBULA',cost:4200,body:'#c86ae8',edge:'#5a1a7a',glowA:'rgba(220,140,255,0.7)',glowB:'rgba(255,140,220,0.3)',cockpit:'#fce8ff',passiveDesc:'+15% Crit chance',passive:{critChance:0.15},fx:'nebula',chapter:3},
  {id:'quantum',name:'QUANTUM',cost:5500,body:'#5ae8e8',edge:'#1a6a7a',glowA:'rgba(120,255,255,0.7)',glowB:'rgba(120,200,255,0.3)',cockpit:'#e0ffff',passiveDesc:'+25% Rate of fire',passive:{rofMult:1.25},fx:'quantum',chapter:4},
  {id:'titanium',name:'TITANIUM',cost:7000,body:'#8a8a9a',edge:'#3a3a4a',glowA:'rgba(200,200,220,0.7)',glowB:'rgba(160,160,190,0)',cockpit:'#e8e8f0',passiveDesc:'-25% damage diterima',passive:{armorMult:0.75},fx:'metal',chapter:4},
  {id:'galactic',name:'GALACTIC',cost:9000,body:'#2a4aa8',edge:'#0a1a5a',glowA:'rgba(120,180,255,0.75)',glowB:'rgba(80,120,255,0.3)',cockpit:'#d0e0ff',passiveDesc:'+30% Damage',passive:{dmgMult:1.30},fx:'galaxy',chapter:4},
  {id:'cosmic',name:'COSMIC',cost:12000,body:'#a83898',edge:'#4a0a4a',glowA:'rgba(255,140,255,0.75)',glowB:'rgba(180,80,255,0.35)',cockpit:'#ffe0ff',passiveDesc:'+35% DMG, +20% HP, +15% RoF, +25% Poin',passive:{dmgMult:1.35,hpMult:1.20,rofMult:1.15,goldMult:1.25},fx:'blackhole',chapter:4}
];

var PLAYER_SHAPES=[
  {id:'square',name:'KOTAK',cost:0,desc:'Bentuk standar (default)',icon:'square',passiveDesc:'Seimbang',passive:{},chapter:1},
  {id:'triangle',name:'SEGITIGA',cost:500,desc:'Hitbox ringkas, mudah menghindar',icon:'triangle',passiveDesc:'+10% Dodge',passive:{dodgeChance:0.10},chapter:1},
  {id:'circleShape',name:'BULAT',cost:750,desc:'Hull membulat, daya tahan ekstra',icon:'circleShape',passiveDesc:'+10% Max HP',passive:{hpMult:1.10},chapter:1},
  {id:'pentagon',name:'PENTAGON',cost:900,desc:'Sudut taktis lima sisi',icon:'pentagon',passiveDesc:'+8% DMG, +5% HP',passive:{dmgMult:1.08,hpMult:1.05},chapter:1},
  {id:'heart',name:'HATI',cost:1200,desc:'Bentuk hati klasik nan manis',icon:'heart',passiveDesc:'+12% Max HP',passive:{hpMult:1.12},chapter:2},
  {id:'hexagon',name:'HEKSAGON',cost:1500,desc:'Struktur kokoh, damage naik',icon:'hexagon',passiveDesc:'+12% Damage',passive:{dmgMult:1.12},chapter:2},
  {id:'octagon',name:'OKTAGON',cost:1800,desc:'Delapan sisi, tahan banting',icon:'octagon',passiveDesc:'+10% HP, -8% damage',passive:{hpMult:1.10,armorMult:0.92},chapter:2},
  {id:'star',name:'BINTANG',cost:2500,desc:'Fokus ke titik lemah musuh',icon:'star',passiveDesc:'+18% Crit, +8% DMG',passive:{critChance:0.18,dmgMult:1.08},chapter:2},
  {id:'cross',name:'SALIB',cost:2800,desc:'Struktur dua sumbu kokoh',icon:'cross',passiveDesc:'+15% HP, +8% DMG',passive:{hpMult:1.15,dmgMult:1.08},chapter:2},
  {id:'arrow',name:'PANAH',cost:3200,desc:'Bentuk panah aerodinamis',icon:'arrow',passiveDesc:'+12% RoF, +8% SPD',passive:{rofMult:1.12},chapter:3},
  {id:'diamondShape',name:'BERLIAN',cost:4000,desc:'Kristal keras, tahan serangan',icon:'diamondShape',passiveDesc:'-15% damage',passive:{armorMult:0.85},chapter:3},
  {id:'gear',name:'GEAR',cost:5000,desc:'Roda gigi mekanis',icon:'gear',passiveDesc:'+15% DMG, +10% RoF',passive:{dmgMult:1.15,rofMult:1.10},chapter:3},
  {id:'crystal',name:'KRISTAL',cost:5500,desc:'Kristal unik bercahaya',icon:'crystal',passiveDesc:'+20% Crit, +10% DMG',passive:{critChance:0.20,dmgMult:1.10},chapter:3},
  {id:'complex',name:'KOMPLEKS',cost:6000,desc:'Struktur maju multi-lapis',icon:'complexShape',passiveDesc:'+20% DMG, +10% HP, +10% RoF',passive:{dmgMult:1.20,hpMult:1.10,rofMult:1.10},chapter:3},
  {id:'shieldShape',name:'PERISAI',cost:7500,desc:'Formasi pertahanan total',icon:'shieldShape',passiveDesc:'-25% dmg, +20% HP',passive:{armorMult:0.75,hpMult:1.20},chapter:4}
];

var GUNS=[
  {id:'bullet',name:'PELURU',desc:'Tembakan standar (default)',cost:0,icon:'bullet',dmgMult:1,speedMult:1,size:5,count:1,spreadAng:0,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:1,life:3,chapter:1},
  {id:'heavy',name:'PELURU BERAT',desc:'Damage dua kali, agak lambat',cost:150,icon:'heavy',dmgMult:1.8,speedMult:0.8,size:10,count:1,spreadAng:0,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:1,life:3,chapter:1},
  {id:'laser',name:'LASER',desc:'Tembus semua musuh',cost:300,icon:'laser',dmgMult:2.0,speedMult:1.6,size:4,count:1,spreadAng:0,homing:false,pierce:99,zigzag:false,explosive:false,rofMult:1.1,life:3,chapter:1},
  {id:'poison',name:'RACUN',desc:'Setiap hit racuni musuh',cost:400,icon:'poison',dmgMult:2.3,speedMult:0.95,size:6,count:1,spreadAng:0,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:1.1,life:3,poison:true,chapter:1},
  {id:'zigzag',name:'ZIGZAG',desc:'Proyektil berkelok',cost:450,icon:'zigzag',dmgMult:2.7,speedMult:0.85,size:5,count:1,spreadAng:0,homing:false,pierce:0,zigzag:true,explosive:false,rofMult:1.05,life:3,chapter:1},
  {id:'spread',name:'SEBAR TIGA',desc:'Tiga peluru menyebar',cost:600,icon:'spread',dmgMult:1.1,speedMult:0.9,size:5,count:3,spreadAng:0.32,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:1,life:3,chapter:2},
  {id:'shotgun',name:'SENAPAN',desc:'Lima butir, jarak dekat',cost:750,icon:'shotgun',dmgMult:0.8,speedMult:1.3,size:4,count:5,spreadAng:0.65,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:1,life:0.4,chapter:2},
  {id:'homing',name:'PELACAK',desc:'Otomatis kejar musuh',cost:975,icon:'homing',dmgMult:4.1,speedMult:0.75,size:6,count:1,spreadAng:0,homing:true,pierce:0,zigzag:false,explosive:false,rofMult:1.1,life:3,chapter:2},
  {id:'machinegun',name:'GATLING',desc:'Tembak dua kali lebih cepat',cost:1200,icon:'machinegun',dmgMult:2.8,speedMult:1.15,size:3,count:1,spreadAng:0.06,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:2,life:2,chapter:2},
  {id:'rocket',name:'ROKET',desc:'Meledak, area damage',cost:1500,icon:'rocket',dmgMult:8.0,speedMult:0.55,size:9,count:1,spreadAng:0,homing:false,pierce:0,zigzag:false,explosive:true,explosionR:70,rofMult:0.8,life:3,chapter:2},
  {id:'plasma',name:'PLASMA',desc:'Bola besar, damage x4, tembus 1',cost:2100,icon:'plasma',dmgMult:9.5,speedMult:0.5,size:14,count:1,spreadAng:0,homing:false,pierce:1,zigzag:false,explosive:false,rofMult:0.85,life:3,chapter:3},
  {id:'sniper',name:'SNIPER',desc:'Damage tinggi, tembakan lambat',cost:2600,icon:'sniper',dmgMult:24.0,speedMult:2.5,size:3,count:1,spreadAng:0,homing:false,pierce:1,zigzag:false,explosive:false,rofMult:0.4,life:3,chapter:3},
  {id:'triple',name:'TRIPEL',desc:'Tiga peluru vertikal',cost:3100,icon:'triple',dmgMult:3.7,speedMult:1,size:5,count:3,spreadAng:0,homing:false,pierce:0,zigzag:false,explosive:false,rofMult:1,life:3,chapter:3},
  {id:'wave',name:'GELOMBANG',desc:'Proyektil lebar, tembus 3',cost:3700,icon:'wave',dmgMult:14.0,speedMult:0.7,size:10,count:1,spreadAng:0,homing:false,pierce:3,zigzag:false,explosive:false,rofMult:0.9,life:3,chapter:3},
  {id:'flame',name:'API',desc:'RoF tinggi, damage area kecil',cost:4400,icon:'flame',dmgMult:4.1,speedMult:1.4,size:6,count:1,spreadAng:0.09,homing:false,pierce:0,zigzag:false,explosive:true,explosionR:40,rofMult:3.5,life:1.5,chapter:3},
  {id:'ice',name:'ES',desc:'Tembus 2, damage sedang',cost:5200,icon:'ice',dmgMult:14.5,speedMult:1.3,size:7,count:1,spreadAng:0,homing:false,pierce:2,zigzag:false,explosive:false,rofMult:1.15,life:3,chapter:3},
  {id:'lightning',name:'PETIR',desc:'Kejar musuh otomatis, cepat',cost:6200,icon:'lightning',dmgMult:12.5,speedMult:1.6,size:4,count:1,spreadAng:0,homing:true,pierce:0,zigzag:false,explosive:false,rofMult:1.5,life:3,chapter:4},
  {id:'deathray',name:'SINAR MAUT',desc:'Beam cepat, tembus semua',cost:7500,icon:'deathray',dmgMult:12.0,speedMult:2.2,size:5,count:1,spreadAng:0,homing:false,pierce:99,zigzag:false,explosive:false,rofMult:1.8,life:3,chapter:4}
];

var STARTING_UPGRADES=[
  {id:'hull',name:'HULL PLUS',desc:'Max HP awal +50',cost:375,icon:'heart',chapter:1},
  {id:'power',name:'POWER PLUS',desc:'Damage semua +15%',cost:600,icon:'bullets',chapter:1},
  {id:'rapid',name:'RAPID PLUS',desc:'Rate of fire +15%',cost:600,icon:'bolt',chapter:1},
  {id:'haste',name:'HASTE PLUS',desc:'Cooldown skill -25%',cost:750,icon:'clock',chapter:2},
  {id:'luck',name:'LUCK PLUS',desc:'Peluang drop langka +50%',cost:1050,icon:'star',chapter:2},
  {id:'regen',name:'REGEN PLUS',desc:'Pulih 1 HP tiap detik',cost:1500,icon:'leaf',chapter:2},
  {id:'crit',name:'CRIT PLUS',desc:'20% chance damage 3x',cost:1800,icon:'crit',chapter:3},
  {id:'dodge',name:'DODGE PLUS',desc:'15% chance hindari serangan',cost:2000,icon:'dodge',chapter:3},
  {id:'armor',name:'ARMOR PLUS',desc:'Damage diterima -20%',cost:2200,icon:'armor',chapter:3},
  {id:'vampiric',name:'VAMPIR PLUS',desc:'Pulih 1 HP tiap kill',cost:2500,icon:'vampiric',chapter:3},
  {id:'ricochet',name:'RICHOCHET',desc:'Semua peluru tembus +1',cost:3000,icon:'ricochet',chapter:4},
  {id:'greedy',name:'GREEDY',desc:'Poin dari kill +25%',cost:3500,icon:'greedy',chapter:4},
  {id:'precision',name:'PRECISION',desc:'Damage semua +10%',cost:4000,icon:'precision',chapter:4}
];

var ACHIEVEMENTS=[
  {id:'kill_100',name:'PEMBURU',desc:'Kalahkan 100 musuh',icon:'skull',type:'kills',goal:100},
  {id:'kill_500',name:'VETERAN',desc:'Kalahkan 500 musuh',icon:'skull',type:'kills',goal:500},
  {id:'kill_1000',name:'PENEBAS',desc:'Kalahkan 1000 musuh',icon:'skull',type:'kills',goal:1000},
  {id:'kill_2500',name:'PEMBASMI',desc:'Kalahkan 2500 musuh',icon:'skull',type:'kills',goal:2500},
  {id:'kill_5000',name:'LEGENDA',desc:'Kalahkan 5000 musuh',icon:'skull',type:'kills',goal:5000},
  {id:'kill_10000',name:'ABADI',desc:'Kalahkan 10000 musuh',icon:'skull',type:'kills',goal:10000},
  {id:'kill_25000',name:'MITOS',desc:'Kalahkan 25000 musuh',icon:'skull',type:'kills',goal:25000},
  {id:'kill_50000',name:'DEWA PERANG',desc:'Kalahkan 50000 musuh',icon:'skull',type:'kills',goal:50000},
  {id:'kill_100000',name:'DEWA TERTINGGI',desc:'Kalahkan 100000 musuh',icon:'skull',type:'kills',goal:100000},
  {id:'win_tutorial',name:'MURID BARU',desc:'Menangkan Tutorial',icon:'trophy',type:'win_level',level:0},
  {id:'win_easy',name:'LANGKAH PERTAMA',desc:'Menangkan tingkat Mudah',icon:'trophy',type:'win_level',level:1},
  {id:'win_medium',name:'PEMANASAN',desc:'Menangkan tingkat Sedang',icon:'trophy',type:'win_level',level:2},
  {id:'win_hard',name:'TANGGUH',desc:'Menangkan tingkat Sulit',icon:'trophy',type:'win_level',level:3},
  {id:'win_expert',name:'AHLI',desc:'Menangkan tingkat Ahli',icon:'trophy',type:'win_level',level:4},
  {id:'win_nightmare',name:'MIMPI BURUK',desc:'Menangkan Nightmare',icon:'trophy',type:'win_level',level:5},
  {id:'win_impossible',name:'TIDAK MUNGKIN',desc:'Menangkan Impossible',icon:'trophy',type:'win_level',level:6},
  {id:'win_doom',name:'KEHANCURAN',desc:'Menangkan Doom',icon:'trophy',type:'win_level',level:7},
  {id:'win_rrror',name:'ERROR TERATASI',desc:'Menangkan 4RROR',icon:'trophy',type:'win_level',level:8},
  {id:'win_chaos',name:'CHAOS MASTER',desc:'Menangkan Chaos',icon:'trophy',type:'win_level',level:9},
  {id:'win_vortex',name:'VORTEX SLAYER',desc:'Menangkan Vortex',icon:'trophy',type:'win_level',level:10},
  {id:'win_nova',name:'NOVA BLASTER',desc:'Menangkan Nova',icon:'trophy',type:'win_level',level:11},
  {id:'win_final',name:'DEWA AKHIR',desc:'Menangkan Final Boss',icon:'trophy',type:'win_level',level:12},
  {id:'boss_1',name:'PEMBURU BOSS',desc:'Kalahkan Boss pertama',icon:'boss',type:'bosses',goal:1},
  {id:'boss_5',name:'PENEBAS BOSS',desc:'Kalahkan 5 Boss',icon:'boss',type:'bosses',goal:5},
  {id:'boss_10',name:'PEMBANTAI BOSS',desc:'Kalahkan 10 Boss',icon:'boss',type:'bosses',goal:10},
  {id:'boss_30',name:'PENAKLUK BOSS',desc:'Kalahkan 30 Boss',icon:'boss',type:'bosses',goal:30},
  {id:'boss_100',name:'PENAKLUK DEWA',desc:'Kalahkan 100 Boss',icon:'boss',type:'bosses',goal:100},
  {id:'combo_5',name:'MEMBARA',desc:'Capai combo x5',icon:'combo',type:'comboMax',goal:5},
  {id:'combo_10',name:'TAK TERHENTIKAN',desc:'Capai combo x10',icon:'combo',type:'comboMax',goal:10},
  {id:'combo_20',name:'MONSTER',desc:'Capai combo x20',icon:'combo',type:'comboMax',goal:20},
  {id:'combo_30',name:'DEWA COMBO',desc:'Capai combo x30',icon:'combo',type:'comboMax',goal:30},
  {id:'all_skills',name:'MAESTRO SKILL',desc:'Punya semua skill',icon:'star',type:'all_skills'},
  {id:'all_ships',name:'LINTAS ARMADA',desc:'Punya semua kapal',icon:'star',type:'all_ships'},
  {id:'all_guns',name:'GUDANG SENJATA',desc:'Punya semua senjata',icon:'star',type:'all_guns'},
  {id:'all_starting',name:'START SEMPURNA',desc:'Beli semua bonus awal',icon:'star',type:'all_starting'},
  {id:'all_shapes',name:'ARSITEK',desc:'Punya semua bentuk kapal',icon:'star',type:'all_shapes'},
  {id:'all_pets',name:'PASUKAN HEWAN',desc:'Punya semua pet',icon:'star',type:'all_pets'},
  {id:'voucher_used',name:'PENUKAR KODE',desc:'Pakai 1 kode voucher',icon:'star',type:'vouchers_used',goal:1},
  {id:'voucher_all',name:'MASTER VOUCHER',desc:'Pakai semua kode voucher',icon:'star',type:'vouchers_used',goal:10},
  {id:'chapter1',name:'BAB 1 TUNTAS',desc:'Selesaikan seluruh Bab 1',icon:'trophy',type:'chapter',chapter:1},
  {id:'chapter2',name:'BAB 2 TUNTAS',desc:'Selesaikan seluruh Bab 2',icon:'trophy',type:'chapter',chapter:2},
  {id:'chapter3',name:'BAB 3 TUNTAS',desc:'Selesaikan seluruh Bab 3',icon:'trophy',type:'chapter',chapter:3},
  {id:'chapter4',name:'BAB 4 TUNTAS',desc:'Selesaikan seluruh Bab 4',icon:'trophy',type:'chapter',chapter:4},
  {id:'endless_1000',name:'SURVIVOR',desc:'Skor Endless 1000',icon:'star',type:'endless',goal:1000},
  {id:'endless_5000',name:'ENDLESS LEGEND',desc:'Skor Endless 5000',icon:'star',type:'endless',goal:5000},
  {id:'nohit_clear',name:'TANPA LUKA',desc:'Selesaikan No Hit Run',icon:'star',type:'challenge_nohit'},
  {id:'pistol_clear',name:'PISTOLER',desc:'Selesaikan Hanya Pistol',icon:'star',type:'challenge_pistol'},
  {id:'speed_clear',name:'SPEEDRUNNER',desc:'Selesaikan Speedrun',icon:'star',type:'challenge_speed'},
  {id:'bossrush_clear',name:'BOSS SLAYER',desc:'Selesaikan Boss Rush',icon:'star',type:'challenge_bossrush'},
  {id:'mp_win',name:'KERJA SAMA',desc:'Menang 1x Multiplayer',icon:'star',type:'mp_wins',goal:1},
  {id:'mp_5',name:'TIM SOLID',desc:'Menang 5x Multiplayer',icon:'star',type:'mp_wins',goal:5},
  {id:'mp_gift',name:'DERMAWAN',desc:'Kirim 1 KP ke pemain lain',icon:'star',type:'mp_gifts',goal:1},
  {id:'friend_1',name:'SOSIALIS',desc:'Tambah 1 teman',icon:'star',type:'friends',goal:1},
  {id:'friend_5',name:'POPULER',desc:'Tambah 5 teman',icon:'star',type:'friends',goal:5},
  {id:'level_10',name:'PEMULA TANGGUH',desc:'Capai level 10',icon:'star',type:'level',goal:10},
  {id:'level_50',name:'PEJUANG BINTANG',desc:'Capai level 50',icon:'star',type:'level',goal:50},
  {id:'level_100',name:'LEGENDA LUAR ANGKASA',desc:'Capai level 100',icon:'star',type:'level',goal:100},
  {id:'trophy_1',name:'JUARA TOURNAMENT',desc:'Dapatkan 1 Trophy Tournament',icon:'trophy',type:'trophies',goal:1},
  {id:'trophy_5',name:'RAJA ARENA',desc:'Dapatkan 5 Trophy Tournament',icon:'trophy',type:'trophies',goal:5}
];

function findSkill(id){for(var i=0;i<SKILLS.length;i++)if(SKILLS[i].id===id)return SKILLS[i];return null;}
function findShip(id){for(var i=0;i<SHIPS.length;i++)if(SHIPS[i].id===id)return SHIPS[i];return SHIPS[0];}
function findShape(id){for(var i=0;i<PLAYER_SHAPES.length;i++)if(PLAYER_SHAPES[i].id===id)return PLAYER_SHAPES[i];return PLAYER_SHAPES[0];}
function findGun(id){for(var i=0;i<GUNS.length;i++)if(GUNS[i].id===id)return GUNS[i];return GUNS[0];}
function findStart(id){for(var i=0;i<STARTING_UPGRADES.length;i++)if(STARTING_UPGRADES[i].id===id)return STARTING_UPGRADES[i];return null;}
function findPet(id){for(var i=0;i<PETS.length;i++)if(PETS[i].id===id)return PETS[i];return null;}
function ownedSkill(id){return save.ownedSkills.indexOf(id)>=0;}
function ownedShip(id){return save.ships.indexOf(id)>=0;}
function ownedShape(id){return save.shapes.indexOf(id)>=0;}
function ownedGun(id){return save.guns.indexOf(id)>=0;}
function ownedStart(id){return save.startingUpgrades.indexOf(id)>=0;}
function ownedPet(id){return save.pets.indexOf(id)>=0;}
function vouchersUsedCount(){var t=0,k;for(k in save.usedVouchers)if(save.usedVouchers[k])t++;return t;}

var THEME_MENU={bgTop:'#bae6fd',bgBottom:'#e0f2fe',edge:'#7dd3fc',particles:['rgba(255,255,255,ALPHA)','rgba(255,200,87,ALPHA)','rgba(255,107,74,ALPHA)']};
var THEME_TUTORIAL={bgTop:'#e8f8ff',bgBottom:'#bde9fb',edge:'#67c7f0',particles:['rgba(255,255,255,ALPHA)','rgba(103,199,240,ALPHA)']};
var THEME_EASY={bgTop:'#d4fce4',bgBottom:'#a8f0cd',edge:'#3ddc97',particles:['rgba(255,255,255,ALPHA)','rgba(61,220,151,ALPHA)']};
var THEME_MEDIUM={bgTop:'#fff2cc',bgBottom:'#ffe4a3',edge:'#ffc857',particles:['rgba(255,220,120,ALPHA)','rgba(255,140,40,ALPHA)']};
var THEME_HARD={bgTop:'#ffd6d6',bgBottom:'#ffb59f',edge:'#ff6b4a',particles:['rgba(255,180,140,ALPHA)','rgba(255,220,200,ALPHA)']};
var THEME_EXPERT={bgTop:'#e8d5ff',bgBottom:'#d4beff',edge:'#9b6bff',particles:['rgba(200,140,255,ALPHA)','rgba(240,220,255,ALPHA)']};
var THEME_NIGHTMARE={bgTop:'#2a1030',bgBottom:'#5a1030',edge:'#ff2d55',particles:['rgba(255,80,120,ALPHA)','rgba(180,60,255,ALPHA)','rgba(255,200,120,ALPHA)']};
var THEME_IMPOSSIBLE={bgTop:'#1a0a1a',bgBottom:'#2a1030',edge:'#442244',particles:['rgba(120,60,120,ALPHA)','rgba(180,80,80,ALPHA)','rgba(80,80,160,ALPHA)']};
var THEME_DOOM={bgTop:'#000000',bgBottom:'#0a0000',edge:'#8a0000',particles:['rgba(60,0,0,ALPHA)','rgba(120,0,0,ALPHA)','rgba(180,20,20,ALPHA)']};
var THEME_RRROR={bgTop:'#000000',bgBottom:'#1a0000',edge:'#ff0000',particles:['rgba(255,0,0,ALPHA)','rgba(150,0,0,ALPHA)','rgba(255,60,60,ALPHA)'],rising:true};
var THEME_CHAOS={bgTop:'#2a0a3a',bgBottom:'#5a1a5a',edge:'#c840ff',particles:['rgba(200,80,255,ALPHA)','rgba(255,80,200,ALPHA)','rgba(120,0,180,ALPHA)']};
var THEME_VORTEX={bgTop:'#0a1a3a',bgBottom:'#1a0a4a',edge:'#4090ff',particles:['rgba(80,150,255,ALPHA)','rgba(150,80,255,ALPHA)','rgba(255,255,255,ALPHA)'],rising:true};
var THEME_NOVA={bgTop:'#3a1a00',bgBottom:'#7a2a0a',edge:'#ff8a00',particles:['rgba(255,180,60,ALPHA)','rgba(255,100,40,ALPHA)','rgba(255,255,180,ALPHA)']};
var THEME_FINAL={bgTop:'#0a0000',bgBottom:'#1a001a',edge:'#ff0055',particles:['rgba(255,0,85,ALPHA)','rgba(255,200,0,ALPHA)','rgba(155,107,255,ALPHA)']};

var ENEMY_TYPES={
blueSmall:{size:0.8,hp:5,damage:3,shootType:'bullet',fireRate:1,color:'#a9c9f5',dark:'#5f8bd6',projSpeed:230,speed:85},
blueNormal:{size:1.0,hp:10,damage:5,shootType:'bullet',fireRate:1,color:'#5f93e0',dark:'#2f5fa8',projSpeed:230,speed:75},
blackSmall:{size:0.6,hp:15,damage:15,shootType:'laser',fireRate:1/3,color:'#5a5a6a',dark:'#2a2a3a',speed:70},
redSmall:{size:0.8,hp:20,damage:15,shootType:'projectile',fireRate:2,color:'#e05555',dark:'#8a2020',projSpeed:260,speed:90},
greenSplit:{size:0.9,hp:25,damage:8,shootType:'projectile',fireRate:1.2,color:'#4fbf6a',dark:'#1f6b2f',projSpeed:200,speed:70,splits:2},
poisonSpitter:{size:0.95,hp:22,damage:6,shootType:'poison',fireRate:0.9,color:'#a8e63a',dark:'#4a6a14',projSpeed:210,speed:65},
emeraldZigzag:{size:0.9,hp:30,damage:12,shootType:'zigzag',fireRate:1.1,color:'#3eb874',dark:'#1a6b3e',projSpeed:220,speed:65},
cyanBurst:{size:0.85,hp:22,damage:6,shootType:'burst5',fireRate:1.4,color:'#5fd0d9',dark:'#1f6b6b',projSpeed:320,speed:70},
plasmaSpiral:{size:0.95,hp:32,damage:10,shootType:'spiral',fireRate:1.8,color:'#e05fd0',dark:'#7a1a6b',projSpeed:200,speed:65},
purpleZig:{size:0.9,hp:28,damage:12,shootType:'projectile',fireRate:1.5,color:'#8f5cbf',dark:'#4f2a70',projSpeed:240,speed:95},
silverTwin:{size:1.0,hp:35,damage:10,shootType:'twin',fireRate:1.6,color:'#b8c4cc',dark:'#5a6470',projSpeed:250,speed:60},
goldRadial:{size:1.05,hp:40,damage:8,shootType:'radial',fireRate:2.2,color:'#e0c050',dark:'#8a6a14',projSpeed:190,speed:55},
cyanSniper:{size:0.85,hp:18,damage:12,shootType:'bullet',fireRate:1/1.8,color:'#5fd9d9',dark:'#1f6b6b',projSpeed:520,speed:50},
coralBurst:{size:0.85,hp:22,damage:6,shootType:'burst',fireRate:2.2,color:'#e07a6a',dark:'#8a3428',projSpeed:290,speed:80},
pinkBomber:{size:1.1,hp:35,damage:10,shootType:'projectile',fireRate:1.5,color:'#d96fa8',dark:'#7a2a55',projSpeed:180,speed:55,spread:3},
amberHoming:{size:0.95,hp:28,damage:14,shootType:'homing',fireRate:1.5,color:'#e0a83a',dark:'#8a5c14',projSpeed:200,speed:55},
obsidianKamikaze:{size:0.85,hp:14,damage:35,shootType:'none',fireRate:0,color:'#5a5a6a',dark:'#2a2a3a',speed:190},
whiteFlash:{size:0.75,hp:14,damage:8,shootType:'bullet',fireRate:2.4,color:'#f0f0f0',dark:'#909090',projSpeed:340,speed:180},
greenTank:{size:1.3,hp:80,damage:10,shootType:'burst5',fireRate:1.0,color:'#4fbf6a',dark:'#1f6b2f',projSpeed:220,speed:40,splits:3},
purpleGatling:{size:0.8,hp:30,damage:4,shootType:'bullet',fireRate:4,color:'#a04fd0',dark:'#502070',projSpeed:280,speed:80},
redBomber:{size:1.2,hp:50,damage:12,shootType:'projectile',fireRate:1.2,color:'#d05050',dark:'#701818',projSpeed:200,speed:50,spread:5},
blackBig:{size:1.6,hp:100,damage:20,shootType:'laser',fireRate:1/1.8,color:'#3a3a4a',dark:'#1a1a2a',speed:40},
tealSplit:{size:1.0,hp:35,damage:10,shootType:'twin',fireRate:1.4,color:'#4fc0c0',dark:'#1f6a6a',projSpeed:240,speed:60,splits:2},
yellowSwarm:{size:0.55,hp:8,damage:4,shootType:'bullet',fireRate:3.2,color:'#f0e050',dark:'#8f7f14',projSpeed:280,speed:120},
orangeRapid:{size:1.0,hp:40,damage:8,shootType:'burst',fireRate:2.5,color:'#e09050',dark:'#7a4010',projSpeed:250,speed:70},
blueBig:{size:1.8,hp:70,damage:35,shootType:'projectile',fireRate:3,color:'#3452a8',dark:'#0e1838',projSpeed:270,speed:42},
yellowFast:{size:0.7,hp:12,damage:8,shootType:'bullet',fireRate:2,color:'#e0d24a',dark:'#8f7f14',projSpeed:300,speed:150},
violetOrbit:{size:0.95,hp:30,damage:14,shootType:'projectile',fireRate:2,color:'#a56fd9',dark:'#5a2a8a',projSpeed:250,speed:60,orbit:true},
orangeTank:{size:1.4,hp:90,damage:18,shootType:'projectile',fireRate:1,color:'#d68a3c',dark:'#8a4f14',projSpeed:210,speed:38,spread:3},
crimsonLaser:{size:1.15,hp:45,damage:25,shootType:'laser',fireRate:1/2.5,color:'#c33a68',dark:'#5c0e28',speed:55},
violetReaper:{size:1.2,hp:55,damage:16,shootType:'homingTwin',fireRate:1.6,color:'#7a3a9a',dark:'#2a0a4a',projSpeed:210,speed:48},
steelGuard:{size:1.5,hp:120,damage:12,shootType:'radial',fireRate:2.4,color:'#8a8a9a',dark:'#3a3a4a',projSpeed:180,speed:34},
heavenly:{size:1.35,hp:90,damage:14,shootType:'heavenly',fireRate:0.5,color:'#ffffff',dark:'#c8c8d8',projSpeed:280,speed:42,orbs:8,heavenlyCycle:2},
thickLaser:{size:1.2,hp:65,damage:30,shootType:'thickLaser',fireRate:1/3.5,color:'#ff4d88',dark:'#8a1440',speed:40},
miniBoss:{size:1.85,hp:260,damage:30,shootType:'radial',fireRate:0.65,color:'#c84848',dark:'#582828',projSpeed:230,speed:32}
};

var ENEMY_INTRO_ORDER=['blueSmall','blueNormal','blackSmall','redSmall','greenSplit','poisonSpitter','emeraldZigzag','cyanBurst','purpleZig','whiteFlash','plasmaSpiral','silverTwin','goldRadial','cyanSniper','coralBurst','purpleGatling','pinkBomber','amberHoming','obsidianKamikaze','tealSplit','yellowSwarm','greenTank','redBomber','blueBig','yellowFast','violetOrbit','orangeRapid','orangeTank','crimsonLaser','blackBig','violetReaper','steelGuard','heavenly','thickLaser'];

var ENEMY_SHAPES=[
  {id:'square',weight:40,kpMult:1.0},
  {id:'round',weight:20,kpMult:1.15},
  {id:'triangle',weight:15,kpMult:1.35},
  {id:'symmetric',weight:15,kpMult:1.6},
  {id:'complex',weight:10,kpMult:2.2}
];
function pickShape(){
  var total=0;
  for(var i=0;i<ENEMY_SHAPES.length;i++)total+=ENEMY_SHAPES[i].weight;
  var r=Math.random()*total;
  for(var j=0;j<ENEMY_SHAPES.length;j++){r-=ENEMY_SHAPES[j].weight;if(r<=0)return ENEMY_SHAPES[j];}
  return ENEMY_SHAPES[0];
}

var BOSS_TYPES=[
  {name:'TITAN ZIGZAG',color:'#e0577f',dark:'#5c0e28',size:2.6,hp:200,speed:22,shootInterval:2.4,cycle:['zigzag','laser','gatling'],moveRange:110},
  {name:'INTI PRISMA',color:'#5272c8',dark:'#0e1838',size:2.8,hp:200,speed:18,shootInterval:2.1,cycle:['laser','homing','zigzag','gatling'],moveRange:140},
  {name:'MONSTER GATLING',color:'#e8a858',dark:'#8a4f14',size:2.4,hp:200,speed:28,shootInterval:1.8,cycle:['gatling','zigzag','laser','radialBoss'],moveRange:160},
  {name:'PENUAI KOSONG',color:'#a86ae8',dark:'#3a1a5a',size:2.7,hp:200,speed:22,shootInterval:2.0,cycle:['homing','laser','spiralBoss','gatling'],moveRange:130},
  {name:'PENGUASA OBSIDIAN',color:'#6a6a8a',dark:'#1a1a3a',size:2.9,hp:220,speed:20,shootInterval:1.9,cycle:['radialBoss','zigzag','laser','homing'],moveRange:150},
  {name:'PENGUASA PLASMA',color:'#e87ad8',dark:'#7a1a6b',size:2.7,hp:210,speed:24,shootInterval:1.7,cycle:['spiralBoss','gatling','homing','radialBoss'],moveRange:140}
];

var LEVELS=[
  {id:0,name:'TUTORIAL',chapter:1,unlockCost:0,cardClass:'easy',duration:30,theme:THEME_TUTORIAL,stageLength:10,enemiesPerSecond:1,baseMaxActive:3,maxActiveGrowth:0.5,maxActiveCap:6,hpMult:0.6,dmgMult:0.5,healFreqMult:1,throttleRatio:4,bossInterval:999,isEndless:false,bossesCanStack:false,spawnRateMult:1,isTutorial:true},
  {id:1,name:'MUDAH',chapter:1,unlockCost:10,cardClass:'easy',duration:45,theme:THEME_EASY,stageLength:10,enemiesPerSecond:2,baseMaxActive:6,maxActiveGrowth:1.2,maxActiveCap:14,hpMult:1,dmgMult:1,healFreqMult:1,throttleRatio:2.5,bossInterval:999,isEndless:false,bossesCanStack:false,spawnRateMult:1},
  {id:2,name:'SEDANG',chapter:1,unlockCost:50,cardClass:'medium',duration:60,theme:THEME_MEDIUM,stageLength:12,enemiesPerSecond:4,baseMaxActive:8,maxActiveGrowth:1.0,maxActiveCap:18,hpMult:1,dmgMult:1,healFreqMult:1.25,throttleRatio:3.0,bossInterval:35,isEndless:false,bossesCanStack:false,spawnRateMult:1},
  {id:3,name:'SULIT',chapter:2,unlockCost:500,cardClass:'hard',duration:70,theme:THEME_HARD,stageLength:16,enemiesPerSecond:6,baseMaxActive:10,maxActiveGrowth:0.9,maxActiveCap:20,hpMult:1.2,dmgMult:1.3,healFreqMult:1.5,throttleRatio:4.0,bossInterval:28,isEndless:false,bossesCanStack:false,spawnRateMult:1.1},
  {id:4,name:'AHLI',chapter:2,unlockCost:2500,cardClass:'expert',duration:85,theme:THEME_EXPERT,stageLength:18,enemiesPerSecond:8,baseMaxActive:12,maxActiveGrowth:1.0,maxActiveCap:28,hpMult:1.3,dmgMult:1.7,healFreqMult:1.8,throttleRatio:4.5,bossInterval:22,isEndless:false,bossesCanStack:false,spawnRateMult:1.3},
  {id:5,name:'NIGHTMARE',chapter:2,unlockCost:7500,cardClass:'nightmare',duration:100,theme:THEME_NIGHTMARE,stageLength:14,enemiesPerSecond:10,baseMaxActive:14,maxActiveGrowth:1.1,maxActiveCap:32,hpMult:1.5,dmgMult:2.6,healFreqMult:2.2,throttleRatio:5.5,bossInterval:16,isEndless:false,bossesCanStack:false,spawnRateMult:1.6},
  {id:6,name:'IMPOSSIBLE',chapter:3,unlockCost:20000,cardClass:'impossible',duration:120,theme:THEME_IMPOSSIBLE,stageLength:20,enemiesPerSecond:13,baseMaxActive:18,maxActiveGrowth:1.3,maxActiveCap:42,hpMult:1.8,dmgMult:3.6,healFreqMult:2.5,throttleRatio:7.0,bossInterval:13,isEndless:false,bossesCanStack:true,spawnRateMult:2.2},
  {id:7,name:'DOOM',chapter:3,unlockCost:50000,cardClass:'doom',duration:150,theme:THEME_DOOM,stageLength:22,enemiesPerSecond:16,baseMaxActive:22,maxActiveGrowth:1.5,maxActiveCap:50,hpMult:2.2,dmgMult:4.8,healFreqMult:2.8,throttleRatio:8.5,bossInterval:11,isEndless:false,bossesCanStack:true,spawnRateMult:2.8},
  {id:8,name:'4RROR',chapter:3,unlockCost:100000,cardClass:'rrror',duration:140,theme:THEME_RRROR,stageLength:24,enemiesPerSecond:14,baseMaxActive:22,maxActiveGrowth:1.5,maxActiveCap:48,hpMult:1.9,dmgMult:4.4,healFreqMult:3.2,throttleRatio:9.5,bossInterval:14,isEndless:false,bossesCanStack:true,spawnRateMult:2.4},
  {id:9,name:'CHAOS',chapter:4,unlockCost:200000,cardClass:'rrror',duration:160,theme:THEME_CHAOS,stageLength:26,enemiesPerSecond:18,baseMaxActive:24,maxActiveGrowth:1.8,maxActiveCap:55,hpMult:2.4,dmgMult:5.2,healFreqMult:3.4,throttleRatio:10.0,bossInterval:10,isEndless:false,bossesCanStack:true,spawnRateMult:3.0},
  {id:10,name:'VORTEX',chapter:4,unlockCost:400000,cardClass:'impossible',duration:170,theme:THEME_VORTEX,stageLength:28,enemiesPerSecond:20,baseMaxActive:26,maxActiveGrowth:2.0,maxActiveCap:60,hpMult:2.6,dmgMult:5.8,healFreqMult:3.6,throttleRatio:11.0,bossInterval:9,isEndless:false,bossesCanStack:true,spawnRateMult:3.4},
  {id:11,name:'NOVA',chapter:4,unlockCost:800000,cardClass:'doom',duration:180,theme:THEME_NOVA,stageLength:30,enemiesPerSecond:22,baseMaxActive:28,maxActiveGrowth:2.2,maxActiveCap:65,hpMult:2.8,dmgMult:6.5,healFreqMult:3.8,throttleRatio:12.0,bossInterval:8,isEndless:false,bossesCanStack:true,spawnRateMult:3.8},
  {id:12,name:'FINAL BOSS',chapter:5,unlockCost:0,cardClass:'final',duration:180,theme:THEME_FINAL,stageLength:30,enemiesPerSecond:0,baseMaxActive:0,maxActiveGrowth:0,maxActiveCap:0,hpMult:1.8,dmgMult:3.0,healFreqMult:4.0,throttleRatio:20.0,bossInterval:5,isEndless:false,bossesCanStack:true,spawnRateMult:0,isFinal:true},
  {id:13,name:'ENDLESS SURVIVAL',chapter:1,unlockCost:0,cardClass:'endless',duration:Infinity,theme:THEME_EASY,stageLength:10,enemiesPerSecond:3,baseMaxActive:8,maxActiveGrowth:1.5,maxActiveCap:80,hpMult:1,dmgMult:1,healFreqMult:1,throttleRatio:99,bossInterval:30,isEndless:true,bossesCanStack:true,spawnRateMult:1}
];

var appState='menu';
var currentTheme=THEME_MENU;
var currentLevel=null;
var currentChallenge=null;
var paused=false;
var player,bosses,enemies,enemyProjectiles,playerProjectiles,healBubbles,boostBubbles,bombBubbles,lasers,particles,shockwaves,powerups,ambientFar,ambientNear,obstacleLasers;
var petState=null;
var bossesSpawnedInRun=0;
var elapsed,spawnAccum,spawnMultiplier,activeCapDelta,lastThrottleCheck,playerTier,projDamage,fireRate,fireTimer;
var healSpawnTimer,boostSpawnTimer,bombSpawnTimer,powerupSpawnTimer,dragging,lastTouchX,shakeTime,shakeMag,flashTime,thrusterTimer,prevHp,boostTime,tierFlash;
var runKills,runBossKills,runKillCount,killFlash,runDamage;
var activeSkillId,skillState,activeSkillTime,skillCooldown;
var spikesActive,invincibleActive,wipeoutActive,freezeActive,magnetActive;
var slowActive,leechActive,rageActive,mirrorActive,chainActive,voidbeamActive;
var chainTimer,voidbeamTimer;
var nextBossTime,bossIndex,lastWaveShownAt;
var nextMiniBossTime,miniBossCount;
var quadTime,shieldTime,rapidTime,pierceTime,multiplierTime;
var comboCount,comboTimer,comboLevel;
var waveBannerTimer;
var tookDamageThisRun;
var maxHpBonus,dmgMultBonus,rofMultBonus,cdMultBonus,dropMultBonus,regenBonus;
var PA={left:0,right:0,top:0,bottom:0};
var streakKillCount=0,streakTimer=0,streakLevel=0,lastStreakLabel='';
var activeSkillTotalDuration=1;
var shipPassive={},shapePassive={};
var playerPoisonTime=0,playerPoisonDPS=0;
var killTapCount=0,killTapTimer=null;
var bgCanvas=document.createElement('canvas');
var bgCtx=bgCanvas.getContext('2d',{alpha:false});
var enemySpriteCache={};
var bossSpriteCache={};
var playerSpriteCache={};
var playerGlowCache={};
var playerProjSpriteCache={};
var enemyProjSpriteCache={};
var powerupSprites={quad:null,shield:null,rapid:null,pierce:null,multiplier:null};
var bombSprite=null;
var petSpriteCache={};
var domCache={hpWidth:-1,hpLow:null,timer:null,lvlText:'',kills:-1,puHtml:'',comboLevel:-1,comboOn:null,bossW:-1};
var shopPreviewCtx=null,shopPreviewCanvas=null,shopPreviewAnim=null,shopPreviewFiring=0;
var shipFxTimer=0;
var mpBadgeXpText='';
var winShown=false;
var enemyIdCounter=0;
var isNetworkGame=false;
var onboardingActive=true;

window.DS_MP=window.DS_MP||{
  active:false,dead:false,globalMode:false,networkMode:false,isGlobalHost:false,isHost:false,
  playersCache:{},myId:null,roomRef:null,playerRef:null,
  updateTimer:0,reviveCountdown:0,myKills:0,myKillCount:0,
  onPlayerDeath:null,onGameEnd:null,onTickDead:null,drawOtherPlayers:null,
  globalEnemiesCache:{},globalBossesCache:{}
};
if(!window.DS_MP.globalEnemiesCache)window.DS_MP.globalEnemiesCache={};
if(!window.DS_MP.globalBossesCache)window.DS_MP.globalBossesCache={};

function amHost(){
  if(!window.DS_MP)return false;
  return !!(window.DS_MP.isGlobalHost||window.DS_MP.isHost);
}

function pushProfileToFirebase(){
  try{
    if(typeof firebase==='undefined')return;
    var cfg=window.FIREBASE_CONFIG||{};
    if(!cfg.databaseURL)return;
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    var db=firebase.database();
    var s=save;
    if(!s.globalId)return;
    db.ref('users/'+s.globalId).update({
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
      lastSeen:Date.now()
    });
  }catch(e){}
}

function lightenHex(hex,amt){
  var n=parseInt(hex.slice(1),16);
  var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.min(255,Math.round(r+(255-r)*amt));
  g=Math.min(255,Math.round(g+(255-g)*amt));
  b=Math.min(255,Math.round(b+(255-b)*amt));
  return 'rgb('+r+','+g+','+b+')';
}
function roundRectTo(g,x,y,w,h,r){if(r>w/2)r=w/2;if(r>h/2)r=h/2;g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function playArea(){PA.left=BORDER;PA.right=W-BORDER;PA.top=BORDER;PA.bottom=H-BORDER;return PA;}
function edgeLeft(){return BORDER+EDGE_PAD;}
function edgeRight(){return W-BORDER-EDGE_PAD;}
function edgeTop(){return BORDER+EDGE_PAD;}
function edgeBottom(){return H-BORDER-EDGE_PAD;}

function buildBackground(){
  bgCanvas.width=W;bgCanvas.height=H;
  var g=bgCtx;var pa=playArea();
  var grad=g.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,currentTheme.bgTop);grad.addColorStop(1,currentTheme.bgBottom);
  g.fillStyle=grad;g.fillRect(0,0,W,H);
  g.save();
  g.beginPath();
  g.rect(pa.left,pa.top,pa.right-pa.left,pa.bottom-pa.top);
  g.clip();
  if(currentTheme.bgTop!=='#000000'&&currentTheme.bgTop!=='#0a0000'){
    var lg=g.createRadialGradient(W*0.5,H*0.15,0,W*0.5,H*0.15,Math.max(W,H)*0.75);
    lg.addColorStop(0,'rgba(255,255,255,0.55)');
    lg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=lg;
    g.fillRect(pa.left,pa.top,pa.right-pa.left,pa.bottom-pa.top);
  }
  g.fillStyle='rgba(255,255,255,0.45)';
  var step=44;
  for(var y=pa.top+step;y<pa.bottom;y+=step)for(var x=pa.left+step;x<pa.right;x+=step)g.fillRect(x,y,2,2);
  g.restore();
  g.strokeStyle='rgba(255,255,255,0.9)';g.lineWidth=4;
  g.strokeRect(pa.left+2,pa.top+2,pa.right-pa.left-4,pa.bottom-pa.top-4);
  g.strokeStyle='rgba(36,36,56,0.35)';g.lineWidth=1.5;
  g.strokeRect(pa.left+5,pa.top+5,pa.right-pa.left-10,pa.bottom-pa.top-10);
}

function drawEnemyShape(g,cx,cy,w,shape){
  var hw=w/2;
  if(shape==='round'){g.beginPath();g.arc(cx,cy,hw,0,Math.PI*2);g.fill();}
  else if(shape==='triangle'){g.beginPath();g.moveTo(cx,cy-hw);g.lineTo(cx+hw*0.95,cy+hw*0.75);g.lineTo(cx-hw*0.95,cy+hw*0.75);g.closePath();g.fill();}
  else if(shape==='symmetric'){g.beginPath();for(var i=0;i<6;i++){var a=(i/6)*Math.PI*2-Math.PI/2;var px=cx+Math.cos(a)*hw,py=cy+Math.sin(a)*hw;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();g.fill();}
  else if(shape==='complex'){g.beginPath();var n=8;for(var j=0;j<n;j++){var a2=(j/n)*Math.PI*2-Math.PI/2;var rr=j%2===0?hw:hw*0.62;var px2=cx+Math.cos(a2)*rr,py2=cy+Math.sin(a2)*rr;if(j===0)g.moveTo(px2,py2);else g.lineTo(px2,py2);}g.closePath();g.fill();}
  else{roundRectTo(g,cx-hw,cy-hw,w,w,hw*0.28);g.fill();}
}

function buildEnemySprite(color,dark,w,flash,shape){
  var pad=5,size=Math.ceil(w+pad*2),c=document.createElement('canvas');
  c.width=c.height=size;
  var g=c.getContext('2d');var cx=size/2,cy=size/2;
  var base=flash?'#ff5c5c':color,dk=flash?'#8e0f0f':dark;
  g.fillStyle='rgba(36,36,56,0.18)';
  g.save();g.translate(0,4);drawEnemyShape(g,cx,cy,w,shape);g.restore();
  g.fillStyle='#ffffff';drawEnemyShape(g,cx,cy,w+6,shape);
  g.fillStyle=dk;drawEnemyShape(g,cx,cy,w+4,shape);
  var bg=g.createLinearGradient(0,cy-w/2,0,cy+w/2);
  bg.addColorStop(0,lightenHex(base,0.4));
  bg.addColorStop(0.6,base);
  bg.addColorStop(1,dk);
  g.fillStyle=bg;drawEnemyShape(g,cx,cy,w-2,shape);
  g.fillStyle='rgba(255,255,255,0.45)';
  roundRectTo(g,cx-w/2+4,cy-w/2+4,w-8,w*0.2,4);g.fill();
  var eyeR=Math.max(2,w*0.14);
  g.fillStyle='#fff';g.beginPath();g.arc(cx,cy,eyeR+1,0,Math.PI*2);g.fill();
  g.fillStyle=dk;g.beginPath();g.arc(cx,cy,eyeR,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(0,0,0,0.75)';g.beginPath();g.arc(cx,cy,eyeR*0.55,0,Math.PI*2);g.fill();
  return c;
}

function buildEnemySprites(){
  enemySpriteCache={};
  var shapes=['square','round','triangle','symmetric','complex'];
  for(var k in ENEMY_TYPES){
    var def=ENEMY_TYPES[k],w=BASE_SIZE*def.size;
    for(var si=0;si<shapes.length;si++){
      var shape=shapes[si];
      var key=k+'_'+shape;
      if(!enemySpriteCache[key]){
        enemySpriteCache[key]={
          normal:buildEnemySprite(def.color,def.dark,w,false,shape),
          flash:buildEnemySprite(def.color,def.dark,w,true,shape),
          half:w/2+5
        };
      }
    }
  }
}

function buildBossSprite(color,dark,w,flash){
  var pad=12,size=Math.ceil(w+pad*2),c=document.createElement('canvas');
  c.width=c.height=size;
  var g=c.getContext('2d');var cx=size/2,cy=size/2;
  var base=flash?'#ff8a8a':color,dk=flash?'#8e0f0f':dark;
  g.fillStyle='rgba(36,36,56,0.2)';
  roundRectTo(g,cx-w/2-1,cy-w/2+6,w+2,w,16);g.fill();
  g.fillStyle='#ffffff';
  roundRectTo(g,cx-w/2-5,cy-w/2-5,w+10,w+10,18);g.fill();
  g.globalAlpha=0.4;g.fillStyle=base;
  g.beginPath();g.arc(cx,cy,w*0.72,0,Math.PI*2);g.fill();
  g.globalAlpha=1;
  g.fillStyle=dk;
  roundRectTo(g,cx-w/2-3,cy-w/2-3,w+6,w+6,14);g.fill();
  var bg=g.createLinearGradient(0,cy-w/2,0,cy+w/2);
  bg.addColorStop(0,lightenHex(base,0.45));
  bg.addColorStop(0.55,base);
  bg.addColorStop(1,dk);
  g.fillStyle=bg;
  roundRectTo(g,cx-w/2,cy-w/2,w,w,12);g.fill();
  g.fillStyle='rgba(255,255,255,0.4)';
  roundRectTo(g,cx-w/2+5,cy-w/2+5,w-10,w*0.16,6);g.fill();
  g.fillStyle=dk;g.beginPath();g.arc(cx,cy,w*0.2,0,Math.PI*2);g.fill();
  g.fillStyle=flash?'#ffdede':'#ffffff';
  g.beginPath();g.arc(cx,cy,w*0.11,0,Math.PI*2);g.fill();
  g.fillStyle=dk;
  g.fillRect(cx-w/2-8,cy-w*0.14,8,w*0.28);
  g.fillRect(cx+w/2,cy-w*0.14,8,w*0.28);
  g.beginPath();g.moveTo(cx-w*0.18,cy+w/2-1);g.lineTo(cx+w*0.18,cy+w/2-1);g.lineTo(cx,cy+w/2+14);g.closePath();g.fill();
  return c;
}

function buildBossSprites(){
  bossSpriteCache={};
  for(var i=0;i<BOSS_TYPES.length;i++){
    var def=BOSS_TYPES[i],w=BASE_SIZE*def.size;
    bossSpriteCache[i]={
      normal:buildBossSprite(def.color,def.dark,w,false),
      flash:buildBossSprite(def.color,def.dark,w,true),
      half:w/2+12
    };
  }
}

function drawPlayerShapeBody(g,cx,cy,w,shape,fill,edge){
  var hw=w/2;
  g.save();
  if(shape==='triangle'){g.beginPath();g.moveTo(cx,cy-hw*0.95);g.lineTo(cx+hw,cy+hw*0.78);g.lineTo(cx-hw,cy+hw*0.78);g.closePath();}
  else if(shape==='circleShape'){g.beginPath();g.arc(cx,cy,hw*0.94,0,Math.PI*2);}
  else if(shape==='pentagon'){g.beginPath();for(var i=0;i<5;i++){var a=(i/5)*Math.PI*2-Math.PI/2;var px=cx+Math.cos(a)*hw,py=cy+Math.sin(a)*hw;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();}
  else if(shape==='hexagon'){g.beginPath();for(var j=0;j<6;j++){var a2=(j/6)*Math.PI*2-Math.PI/2;var px2=cx+Math.cos(a2)*hw,py2=cy+Math.sin(a2)*hw;if(j===0)g.moveTo(px2,py2);else g.lineTo(px2,py2);}g.closePath();}
  else if(shape==='octagon'){g.beginPath();for(var o=0;o<8;o++){var a3=(o/8)*Math.PI*2-Math.PI/2;var px3=cx+Math.cos(a3)*hw,py3=cy+Math.sin(a3)*hw;if(o===0)g.moveTo(px3,py3);else g.lineTo(px3,py3);}g.closePath();}
  else if(shape==='diamondShape'){g.beginPath();g.moveTo(cx,cy-hw);g.lineTo(cx+hw,cy);g.lineTo(cx,cy+hw);g.lineTo(cx-hw,cy);g.closePath();}
  else if(shape==='star'){g.beginPath();for(var k=0;k<10;k++){var a4=(k/10)*Math.PI*2-Math.PI/2;var rr=k%2===0?hw:hw*0.55;var px4=cx+Math.cos(a4)*rr,py4=cy+Math.sin(a4)*rr;if(k===0)g.moveTo(px4,py4);else g.lineTo(px4,py4);}g.closePath();}
  else if(shape==='cross'){var t=hw*0.4;g.beginPath();g.moveTo(cx-t,cy-hw);g.lineTo(cx+t,cy-hw);g.lineTo(cx+t,cy-t);g.lineTo(cx+hw,cy-t);g.lineTo(cx+hw,cy+t);g.lineTo(cx+t,cy+t);g.lineTo(cx+t,cy+hw);g.lineTo(cx-t,cy+hw);g.lineTo(cx-t,cy+t);g.lineTo(cx-hw,cy+t);g.lineTo(cx-hw,cy-t);g.lineTo(cx-t,cy-t);g.closePath();}
  else if(shape==='arrow'){g.beginPath();g.moveTo(cx,cy-hw);g.lineTo(cx+hw,cy);g.lineTo(cx+hw*0.4,cy);g.lineTo(cx+hw*0.4,cy+hw);g.lineTo(cx-hw*0.4,cy+hw);g.lineTo(cx-hw*0.4,cy);g.lineTo(cx-hw,cy);g.closePath();}
  else if(shape==='gear'){g.beginPath();var teeth=8;for(var m=0;m<teeth*2;m++){var a5=(m/(teeth*2))*Math.PI*2;var rr2=m%2===0?hw:hw*0.75;var px5=cx+Math.cos(a5)*rr2,py5=cy+Math.sin(a5)*rr2;if(m===0)g.moveTo(px5,py5);else g.lineTo(px5,py5);}g.closePath();}
  else if(shape==='crystal'){g.beginPath();g.moveTo(cx,cy-hw);g.lineTo(cx+hw*0.7,cy-hw*0.3);g.lineTo(cx+hw*0.5,cy+hw);g.lineTo(cx-hw*0.5,cy+hw);g.lineTo(cx-hw*0.7,cy-hw*0.3);g.closePath();}
  else if(shape==='shieldShape'){g.beginPath();g.moveTo(cx,cy-hw);g.lineTo(cx+hw,cy-hw*0.4);g.lineTo(cx+hw,cy+hw*0.3);g.quadraticCurveTo(cx+hw,cy+hw,cx,cy+hw);g.quadraticCurveTo(cx-hw,cy+hw,cx-hw,cy+hw*0.3);g.lineTo(cx-hw,cy-hw*0.4);g.closePath();}
  else if(shape==='complex'){g.beginPath();var n2=10;for(var q=0;q<n2;q++){var a6=(q/n2)*Math.PI*2-Math.PI/2;var rr3=q%2===0?hw:hw*0.55;var px6=cx+Math.cos(a6)*rr3,py6=cy+Math.sin(a6)*rr3;if(q===0)g.moveTo(px6,py6);else g.lineTo(px6,py6);}g.closePath();}
  else if(shape==='heart'){g.beginPath();g.moveTo(cx,cy+hw*0.85);g.bezierCurveTo(cx-hw*1.15,cy+hw*0.15,cx-hw*0.95,cy-hw*0.75,cx,cy-hw*0.2);g.bezierCurveTo(cx+hw*0.95,cy-hw*0.75,cx+hw*1.15,cy+hw*0.15,cx,cy+hw*0.85);g.closePath();}
  else{roundRectTo(g,cx-hw*0.85,cy-hw*0.85,w*0.85,w*0.85,hw*0.28);}
  g.fillStyle=fill;g.fill();
  g.lineWidth=Math.max(2,w*0.06);g.strokeStyle=edge;g.stroke();
  g.restore();
}

function buildPlayerSprite(ship,shape,boosted){
  var w=BASE_SIZE,h=BASE_SIZE,pad=10,size=Math.ceil(w+pad*2),c=document.createElement('canvas');
  c.width=c.height=size;
  var g=c.getContext('2d');var ox=pad,oy=pad;var cx=ox+w/2;
  var body=boosted?'#ffffff':ship.body,edge=boosted?'#5aa6e8':ship.edge;
  g.save();g.translate(0,3);
  drawPlayerShapeBody(g,cx,oy+h/2,w+8,shape,'rgba(36,36,56,0.16)','rgba(36,36,56,0.16)');
  g.restore();
  drawPlayerShapeBody(g,cx,oy+h/2,w+4,shape,'#ffffff','#ffffff');
  drawPlayerShapeBody(g,cx,oy+h/2,w,shape,body,edge);
  var cr=w*0.19;
  g.fillStyle=boosted?'#c8e4ff':ship.cockpit;
  g.beginPath();g.arc(cx,oy+h*0.38,cr,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(255,255,255,0.95)';
  g.beginPath();g.arc(cx-cr*0.3,oy+h*0.38-cr*0.3,cr*0.35,0,Math.PI*2);g.fill();
  g.fillStyle=boosted?'#e8f4ff':'#eaff8f';
  g.fillRect(cx-w*0.12,oy-1,2.5,4);
  g.fillRect(cx+w*0.12-2.5,oy-1,2.5,4);
  return {canvas:c,pad:pad};
}

function buildPlayerGlow(ship,boosted){
  var R=Math.ceil(BASE_SIZE*1.3),c=document.createElement('canvas');
  c.width=c.height=R*2;
  var g=c.getContext('2d');
  var gr=g.createRadialGradient(R,R,4,R,R,R);
  gr.addColorStop(0,boosted?'rgba(255,255,255,0.75)':ship.glowA);
  gr.addColorStop(1,ship.glowB);
  g.fillStyle=gr;g.fillRect(0,0,R*2,R*2);
  return {canvas:c,R:R};
}

function buildPlayerSprites(){
  playerSpriteCache={};playerGlowCache={};
  for(var i=0;i<SHIPS.length;i++){
    var s=SHIPS[i];
    for(var j=0;j<PLAYER_SHAPES.length;j++){
      var sh=PLAYER_SHAPES[j];
      var key=s.id+'_'+sh.id;
      playerSpriteCache[key]={
        normal:buildPlayerSprite(s,sh.id,false),
        boost:buildPlayerSprite(s,sh.id,true)
      };
    }
    playerGlowCache[s.id]={
      normal:buildPlayerGlow(s,false),
      boost:buildPlayerGlow(s,true)
    };
  }
}

function buildPetSprite(pet){
  var R=26,c=document.createElement('canvas');
  c.width=c.height=R*2+8;
  var g=c.getContext('2d');var cx=c.width/2,cy=c.height/2;
  var body,glow;
  if(pet.id==='scout'){body='#67c7f0';glow='rgba(103,199,240,0.7)';}
  else if(pet.id==='guardian'){body='#3ddc97';glow='rgba(61,220,151,0.7)';}
  else if(pet.id==='medic'){body='#ff77a9';glow='rgba(255,119,169,0.7)';}
  else if(pet.id==='ammo'){body='#ffc857';glow='rgba(255,200,87,0.7)';}
  else if(pet.id==='swift'){body='#9b6bff';glow='rgba(155,107,255,0.7)';}
  else if(pet.id==='magnetPet'){body='#ff6b4a';glow='rgba(255,107,74,0.7)';}
  else if(pet.id==='barrier'){body='#5aa6e8';glow='rgba(90,166,232,0.7)';}
  else if(pet.id==='voidPet'){body='#c86ae8';glow='rgba(200,106,232,0.7)';}
  else{body='#8a8aa3';glow='rgba(138,138,163,0.7)';}
  var rg=g.createRadialGradient(cx,cy,0,cx,cy,R+4);
  rg.addColorStop(0,'rgba(255,255,255,0.9)');
  rg.addColorStop(0.4,glow);
  rg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rg;
  g.beginPath();g.arc(cx,cy,R+4,0,Math.PI*2);g.fill();
  g.fillStyle='#ffffff';
  g.beginPath();g.arc(cx,cy,R-1,0,Math.PI*2);g.fill();
  g.fillStyle=body;
  g.beginPath();g.arc(cx,cy,R-3,0,Math.PI*2);g.fill();
  g.fillStyle='#242438';
  if(pet.id==='scout'){g.fillRect(cx-R*0.6,cy-3,R*0.3,6);g.fillRect(cx+R*0.3,cy-3,R*0.3,6);}
  else if(pet.id==='guardian'){g.beginPath();g.moveTo(cx,cy-R*0.5);g.lineTo(cx+R*0.4,cy-R*0.1);g.lineTo(cx+R*0.4,cy+R*0.4);g.lineTo(cx,cy+R*0.6);g.lineTo(cx-R*0.4,cy+R*0.4);g.lineTo(cx-R*0.4,cy-R*0.1);g.closePath();g.fill();}
  else if(pet.id==='medic'){g.fillRect(cx-3,cy-R*0.5,6,R);g.fillRect(cx-R*0.5,cy-3,R,6);}
  else if(pet.id==='ammo'){g.beginPath();g.moveTo(cx,cy-R*0.5);g.lineTo(cx+R*0.3,cy);g.lineTo(cx,cy+R*0.5);g.lineTo(cx-R*0.3,cy);g.closePath();g.fill();}
  else if(pet.id==='swift'){g.beginPath();g.moveTo(cx-R*0.4,cy-R*0.3);g.lineTo(cx+R*0.5,cy);g.lineTo(cx-R*0.4,cy+R*0.3);g.closePath();g.fill();}
  else if(pet.id==='magnetPet'){g.beginPath();g.arc(cx,cy,4,0,Math.PI*2);g.fill();g.fillRect(cx-1,cy-2,2,10);}
  else if(pet.id==='barrier'){g.beginPath();g.arc(cx,cy,R*0.45,0,Math.PI*2);g.fill();g.strokeStyle='#242438';g.lineWidth=2;g.beginPath();g.arc(cx,cy,R*0.65,0,Math.PI*2);g.stroke();}
  else if(pet.id==='voidPet'){g.beginPath();g.arc(cx,cy,R*0.35,0,Math.PI*2);g.fill();g.fillStyle='#ffffff';g.beginPath();g.arc(cx,cy,R*0.15,0,Math.PI*2);g.fill();}
  else{g.beginPath();g.arc(cx,cy,3,0,Math.PI*2);g.fill();}
  return {canvas:c,cx:cx,cy:cy,R:R};
}

function buildAllPetSprites(){
  petSpriteCache={};
  for(var i=0;i<PETS.length;i++)petSpriteCache[PETS[i].id]=buildPetSprite(PETS[i]);
}

function getGunProjStyle(id){
  if(id==='heavy')return {width:18,height:28,orbOffset:8,tailW:6,r:11,core:'#c8b060',inner:'#fff0a8',glow:'rgba(255,220,120,0.85)',glowEnd:'rgba(255,220,120,0)',trailTop:'rgba(255,235,150,1)',trailMid:'rgba(220,180,70,0.6)',trailEnd:'rgba(220,180,70,0)'};
  if(id==='laser')return {width:10,height:50,orbOffset:5,tailW:3,r:5,core:'#a0f0ff',inner:'#e0f8ff',glow:'rgba(160,240,255,0.9)',glowEnd:'rgba(160,240,255,0)',trailTop:'rgba(200,245,255,1)',trailMid:'rgba(120,220,255,0.75)',trailEnd:'rgba(120,220,255,0)',dot:true};
  if(id==='poison')return {width:16,height:30,orbOffset:7,tailW:5,r:8,core:'#8abf20',inner:'#e0ff90',glow:'rgba(160,240,60,0.9)',glowEnd:'rgba(160,240,60,0)',trailTop:'rgba(200,255,140,0.95)',trailMid:'rgba(120,200,40,0.65)',trailEnd:'rgba(120,200,40,0)',dot:true};
  if(id==='zigzag')return {width:14,height:26,orbOffset:6,tailW:4,r:6,core:'#80ff90',inner:'#d8ffdd',glow:'rgba(120,255,140,0.85)',glowEnd:'rgba(120,255,140,0)',trailTop:'rgba(160,255,180,0.95)',trailMid:'rgba(80,220,90,0.6)',trailEnd:'rgba(80,220,90,0)'};
  if(id==='spread'||id==='shotgun'||id==='triple')return {width:12,height:20,orbOffset:5,tailW:3.5,r:5,core:'#ffd080',inner:'#fff8d0',glow:'rgba(255,200,100,0.85)',glowEnd:'rgba(255,200,100,0)',trailTop:'rgba(255,215,140,0.95)',trailMid:'rgba(200,150,50,0.6)',trailEnd:'rgba(200,150,50,0)'};
  if(id==='homing'||id==='lightning')return {width:14,height:26,orbOffset:6,tailW:4,r:6,core:'#ff8050',inner:'#ffd0b0',glow:'rgba(255,140,80,0.9)',glowEnd:'rgba(255,140,80,0)',trailTop:'rgba(255,160,100,0.95)',trailMid:'rgba(200,80,30,0.6)',trailEnd:'rgba(200,80,30,0)',dot:true};
  if(id==='machinegun')return {width:8,height:16,orbOffset:4,tailW:2.5,r:3.5,core:'#e0f0ff',inner:'#ffffff',glow:'rgba(200,230,255,0.85)',glowEnd:'rgba(200,230,255,0)',trailTop:'rgba(220,240,255,0.95)',trailMid:'rgba(150,180,220,0.6)',trailEnd:'rgba(150,180,220,0)'};
  if(id==='rocket'||id==='flame')return {width:16,height:34,orbOffset:7,tailW:5,r:9,core:'#ff8050',inner:'#ffd080',glow:'rgba(255,120,60,0.9)',glowEnd:'rgba(255,120,60,0)',trailTop:'rgba(255,220,120,1)',trailMid:'rgba(255,140,60,0.7)',trailEnd:'rgba(200,60,20,0)',dot:true};
  if(id==='plasma'||id==='sniper')return {width:22,height:36,orbOffset:11,tailW:8,r:15,core:'#c080ff',inner:'#f0d8ff',glow:'rgba(180,120,255,0.9)',glowEnd:'rgba(180,120,255,0)',trailTop:'rgba(220,180,255,0.95)',trailMid:'rgba(140,80,220,0.65)',trailEnd:'rgba(140,80,220,0)',dot:true};
  if(id==='wave')return {width:26,height:30,orbOffset:15,tailW:12,r:13,core:'#4ff0ff',inner:'#d0feff',glow:'rgba(120,240,255,0.9)',glowEnd:'rgba(120,240,255,0)',trailTop:'rgba(200,250,255,0.95)',trailMid:'rgba(100,220,240,0.6)',trailEnd:'rgba(100,220,240,0)',dot:true};
  if(id==='ice')return {width:14,height:30,orbOffset:5,tailW:3.5,r:7,core:'#a0f8ff',inner:'#ffffff',glow:'rgba(150,240,255,0.9)',glowEnd:'rgba(150,240,255,0)',trailTop:'rgba(200,250,255,0.95)',trailMid:'rgba(120,220,255,0.7)',trailEnd:'rgba(120,220,255,0)',dot:true};
  if(id==='deathray')return {width:8,height:60,orbOffset:4,tailW:3,r:6,core:'#ff2060',inner:'#ffd0d8',glow:'rgba(255,60,120,0.9)',glowEnd:'rgba(255,60,120,0)',trailTop:'rgba(255,180,200,1)',trailMid:'rgba(255,80,140,0.8)',trailEnd:'rgba(255,80,140,0)',dot:true};
  return {width:14,height:30,orbOffset:5,tailW:3.5,r:5,core:'#a0ff90',inner:'#eaffb0',glow:'rgba(140,255,120,0.85)',glowEnd:'rgba(110,255,120,0)',trailTop:'rgba(200,255,140,0.95)',trailMid:'rgba(140,255,120,0.55)',trailEnd:'rgba(110,255,120,0)'};
}

function buildProjSpriteForGun(gun,sizeMult){
  sizeMult=sizeMult||1;
  var style=getGunProjStyle(gun.id);
  var w=style.width*sizeMult,h=style.height*sizeMult,pad=6;
  var c=document.createElement('canvas');
  c.width=w+pad*2;c.height=h+pad*2;
  var g=c.getContext('2d');var cx=(w+pad*2)/2;var orbY=pad+style.orbOffset*sizeMult;
  var lg=g.createLinearGradient(0,orbY,0,h+pad);
  lg.addColorStop(0,style.trailTop);
  lg.addColorStop(0.5,style.trailMid);
  lg.addColorStop(1,style.trailEnd);
  g.fillStyle=lg;
  g.beginPath();
  g.moveTo(cx-style.tailW*sizeMult,orbY);
  g.lineTo(cx+style.tailW*sizeMult,orbY);
  g.lineTo(cx,h+pad);
  g.closePath();g.fill();
  var rg=g.createRadialGradient(cx,orbY,0,cx,orbY,style.r*sizeMult+3);
  rg.addColorStop(0,'#ffffff');
  rg.addColorStop(0.35,style.inner);
  rg.addColorStop(0.75,style.glow);
  rg.addColorStop(1,style.glowEnd);
  g.fillStyle=rg;
  g.beginPath();g.arc(cx,orbY,style.r*sizeMult+3,0,Math.PI*2);g.fill();
  g.fillStyle=style.core;
  g.beginPath();g.arc(cx,orbY,style.r*sizeMult*0.55,0,Math.PI*2);g.fill();
  if(style.dot){g.fillStyle='#ffffff';g.beginPath();g.arc(cx,orbY,2.4*sizeMult,0,Math.PI*2);g.fill();}
  return {canvas:c,cx:cx,cy:orbY,r:style.r*sizeMult};
}

function buildAllProjSprites(){
  playerProjSpriteCache={};
  for(var i=0;i<GUNS.length;i++)playerProjSpriteCache[GUNS[i].id]=buildProjSpriteForGun(GUNS[i],1);
}

function projStyle(dmg){
  var t=Math.min(1,Math.max(0,dmg/50));
  var light=Math.round(70-52*t);
  var sat=Math.round(96-38*t);
  var hue=Math.round(18-18*t);
  var r=3.5+15*t;
  return {t:t,r:r,hue:hue,sat:sat,light:light,core:'hsl('+hue+','+sat+'%,'+light+'%)',inner:'hsl('+hue+','+sat+'%,'+Math.min(92,light+34)+'%)',glow:'hsla('+hue+','+sat+'%,'+light+'%,0.6)'};
}

function getEnemyProjSprite(dmg){
  var key=Math.round(dmg);
  var cached=enemyProjSpriteCache[key];if(cached)return cached;
  var st=projStyle(dmg),tail=st.r*2.4,pad=4;
  var W2=st.r*2+pad*2+4,H2=st.r*2+tail+pad*2+4;
  var c=document.createElement('canvas');
  c.width=Math.ceil(W2);c.height=Math.ceil(H2);
  var g=c.getContext('2d');var cx=c.width/2;var orbY=c.height-pad-st.r-2;var tailTop=pad;
  var lg=g.createLinearGradient(0,tailTop,0,orbY);
  lg.addColorStop(0,'rgba(0,0,0,0)');
  lg.addColorStop(0.5,st.glow);
  lg.addColorStop(1,st.glow);
  g.fillStyle=lg;
  g.beginPath();
  g.moveTo(cx,tailTop);
  g.lineTo(cx-st.r*0.7,orbY);
  g.lineTo(cx+st.r*0.7,orbY);
  g.closePath();g.fill();
  g.fillStyle='#ffffff';
  g.beginPath();g.arc(cx,orbY,st.r+3,0,Math.PI*2);g.fill();
  var rg=g.createRadialGradient(cx,orbY,0,cx,orbY,st.r+pad);
  rg.addColorStop(0,st.inner);
  rg.addColorStop(0.4,st.core);
  rg.addColorStop(0.75,st.glow);
  rg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rg;
  g.beginPath();g.arc(cx,orbY,st.r+pad,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,255,255,'+(0.4+0.45*(1-st.t)).toFixed(2)+')';
  g.lineWidth=1.8;
  g.beginPath();g.arc(cx,orbY,st.r*0.88,0,Math.PI*2);g.stroke();
  var spokeR=st.r*0.55,spokeInner=st.r*0.28;
  g.strokeStyle=st.inner;g.lineWidth=1.8;
  for(var s=0;s<3;s++){
    var sa=(s/3)*Math.PI*2;
    g.beginPath();
    g.moveTo(cx+Math.cos(sa)*spokeInner,orbY+Math.sin(sa)*spokeInner);
    g.lineTo(cx+Math.cos(sa)*spokeR,orbY+Math.sin(sa)*spokeR);
    g.stroke();
  }
  var sp={canvas:c,cx:cx,cy:orbY,r:st.r};
  enemyProjSpriteCache[key]=sp;
  return sp;
}

function buildPowerupSprites(){
  var R=20;
  function baseCanvas(){var c=document.createElement('canvas');c.width=c.height=R*2;return c;}
  var cx=R,cy=R;
  var c1=baseCanvas(),g1=c1.getContext('2d');
  var rg1=g1.createRadialGradient(cx,cy,0,cx,cy,R);
  rg1.addColorStop(0,'#ffffff');rg1.addColorStop(0.35,'#ffd977');rg1.addColorStop(0.8,'rgba(255,180,40,0.7)');rg1.addColorStop(1,'rgba(255,180,40,0)');
  g1.fillStyle=rg1;g1.beginPath();g1.arc(cx,cy,R,0,Math.PI*2);g1.fill();
  g1.fillStyle='#ffe4a3';
  g1.beginPath();g1.moveTo(cx,cy-9);g1.lineTo(cx+3,cy-3);g1.lineTo(cx+9,cy-3);g1.lineTo(cx+4,cy+2);g1.lineTo(cx+6,cy+9);g1.lineTo(cx,cy+4);g1.lineTo(cx-6,cy+9);g1.lineTo(cx-4,cy+2);g1.lineTo(cx-9,cy-3);g1.lineTo(cx-3,cy-3);g1.closePath();g1.fill();
  powerupSprites.quad={canvas:c1,cx:R,cy:R};
  var c2=baseCanvas(),g2=c2.getContext('2d');
  var rg2=g2.createRadialGradient(cx,cy,0,cx,cy,R);
  rg2.addColorStop(0,'#ffffff');rg2.addColorStop(0.35,'#67c7f0');rg2.addColorStop(0.8,'rgba(120,200,255,0.7)');rg2.addColorStop(1,'rgba(120,200,255,0)');
  g2.fillStyle=rg2;g2.beginPath();g2.arc(cx,cy,R,0,Math.PI*2);g2.fill();
  g2.fillStyle='#bde9fb';
  g2.beginPath();g2.moveTo(cx,cy-11);g2.lineTo(cx+9,cy-6);g2.lineTo(cx+9,cy+2);g2.quadraticCurveTo(cx+9,cy+9,cx,cy+12);g2.quadraticCurveTo(cx-9,cy+9,cx-9,cy+2);g2.lineTo(cx-9,cy-6);g2.closePath();g2.fill();
  powerupSprites.shield={canvas:c2,cx:R,cy:R};
  var c3=baseCanvas(),g3=c3.getContext('2d');
  var rg3=g3.createRadialGradient(cx,cy,0,cx,cy,R);
  rg3.addColorStop(0,'#ffffff');rg3.addColorStop(0.35,'#ffd9e8');rg3.addColorStop(0.8,'rgba(255,120,169,0.7)');rg3.addColorStop(1,'rgba(255,120,169,0)');
  g3.fillStyle=rg3;g3.beginPath();g3.arc(cx,cy,R,0,Math.PI*2);g3.fill();
  g3.fillStyle='#ff77a9';
  for(var p=0;p<6;p++){var pa=(p/6)*Math.PI*2;g3.beginPath();g3.arc(cx+Math.cos(pa)*7,cy+Math.sin(pa)*7,3,0,Math.PI*2);g3.fill();}
  g3.fillStyle='#ffffff';g3.beginPath();g3.arc(cx,cy,4,0,Math.PI*2);g3.fill();
  powerupSprites.rapid={canvas:c3,cx:R,cy:R};
  var c4=baseCanvas(),g4=c4.getContext('2d');
  var rg4=g4.createRadialGradient(cx,cy,0,cx,cy,R);
  rg4.addColorStop(0,'#ffffff');rg4.addColorStop(0.35,'#e4d0ff');rg4.addColorStop(0.8,'rgba(155,107,255,0.7)');rg4.addColorStop(1,'rgba(155,107,255,0)');
  g4.fillStyle=rg4;g4.beginPath();g4.arc(cx,cy,R,0,Math.PI*2);g4.fill();
  g4.fillStyle='#d4beff';
  g4.beginPath();g4.moveTo(cx,cy-11);g4.lineTo(cx+7,cy);g4.lineTo(cx+2,cy);g4.lineTo(cx+2,cy+11);g4.lineTo(cx-7,cy);g4.lineTo(cx-2,cy);g4.lineTo(cx-2,cy-11);g4.closePath();g4.fill();
  powerupSprites.pierce={canvas:c4,cx:R,cy:R};
  var c5=baseCanvas(),g5=c5.getContext('2d');
  var rg5=g5.createRadialGradient(cx,cy,0,cx,cy,R);
  rg5.addColorStop(0,'#ffffff');rg5.addColorStop(0.35,'#ffe480');rg5.addColorStop(0.8,'rgba(255,176,32,0.75)');rg5.addColorStop(1,'rgba(255,176,32,0)');
  g5.fillStyle=rg5;g5.beginPath();g5.arc(cx,cy,R,0,Math.PI*2);g5.fill();
  g5.fillStyle='#ffb020';g5.beginPath();g5.arc(cx,cy,10,0,Math.PI*2);g5.fill();
  g5.fillStyle='#242438';g5.font='bold 12px Fredoka,sans-serif';g5.textAlign='center';g5.textBaseline='middle';g5.fillText('x2',cx,cy+1);
  powerupSprites.multiplier={canvas:c5,cx:R,cy:R};
  var c6=baseCanvas(),g6=c6.getContext('2d');
  var rg6=g6.createRadialGradient(cx,cy,0,cx,cy,R);
  rg6.addColorStop(0,'#ffffff');rg6.addColorStop(0.35,'#ff6b4a');rg6.addColorStop(0.8,'rgba(120,20,10,0.85)');rg6.addColorStop(1,'rgba(120,20,10,0)');
  g6.fillStyle=rg6;g6.beginPath();g6.arc(cx,cy,R,0,Math.PI*2);g6.fill();
  g6.fillStyle='rgba(36,36,56,0.95)';g6.beginPath();g6.arc(cx,cy+2,9,0,Math.PI*2);g6.fill();
  g6.fillStyle='rgba(255,255,255,0.5)';g6.beginPath();g6.arc(cx-3,cy-1,2.5,0,Math.PI*2);g6.fill();
  g6.strokeStyle='#242438';g6.lineWidth=2.5;g6.beginPath();g6.moveTo(cx+4,cy-6);g6.quadraticCurveTo(cx+9,cy-11,cx+5,cy-15);g6.stroke();
  g6.fillStyle='#ffc857';g6.beginPath();g6.arc(cx+5,cy-15,3,0,Math.PI*2);g6.fill();
  g6.fillStyle='#fff8e7';g6.beginPath();g6.arc(cx+5,cy-15,1.4,0,Math.PI*2);g6.fill();
  bombSprite={canvas:c6,cx:R,cy:R};
}

function buildAllSprites(){
  buildEnemySprites();
  buildBossSprites();
  buildPlayerSprites();
  buildAllProjSprites();
  buildAllPetSprites();
  for(var k in ENEMY_TYPES)getEnemyProjSprite(ENEMY_TYPES[k].damage);
  buildPowerupSprites();
}

function pickThemeColor(alpha){
  var pool=currentTheme.particles;
  var base=pool[(Math.random()*pool.length)|0];
  return base.replace('ALPHA',alpha.toFixed(2));
}

function buildAmbientParticles(){
  ambientFar=[];ambientNear=[];
  var pa=playArea();
  var iw=pa.right-pa.left,ih=pa.bottom-pa.top;
  var rise=!!currentTheme.rising;
  for(var i=0;i<MAX_AMBIENT_FAR;i++){
    ambientFar.push({
      x:pa.left+Math.random()*iw,y:pa.top+Math.random()*ih,
      r:1.4+Math.random()*1.4,
      speed:rise?-(12+Math.random()*10):(12+Math.random()*10),
      sway:Math.random()*6.283,color:pickThemeColor(0.55+Math.random()*0.3),rise:rise
    });
  }
  for(var j=0;j<MAX_AMBIENT_NEAR;j++){
    ambientNear.push({
      x:pa.left+Math.random()*iw,y:pa.top+Math.random()*ih,
      r:2+Math.random()*1.8,
      speed:rise?-(22+Math.random()*14):(22+Math.random()*14),
      sway:Math.random()*6.283,color:pickThemeColor(0.65+Math.random()*0.3),rise:rise
    });
  }
}

function applyTheme(theme){currentTheme=theme;buildAmbientParticles();buildBackground();}

function resize(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
  buildBackground();
  buildAmbientParticles();
  if(shopPreviewCanvas){
    shopPreviewCanvas.width=shopPreviewCanvas.clientWidth;
    shopPreviewCanvas.height=shopPreviewCanvas.clientHeight;
  }
}
window.addEventListener('resize',resize);

function applyStartingBonus(){
  maxHpBonus=ownedStart('hull')?50:0;
  dmgMultBonus=ownedStart('power')?1.15:1;
  if(ownedStart('precision'))dmgMultBonus*=1.10;
  rofMultBonus=ownedStart('rapid')?1.15:1;
  cdMultBonus=ownedStart('haste')?0.75:1;
  dropMultBonus=ownedStart('luck')?1.5:1;
  regenBonus=ownedStart('regen')?1:0;
}

function getPetEffects(){
  if(!save.selectedPet)return {};
  var pet=findPet(save.selectedPet);
  if(!pet)return {};
  var lv=getUpgradeLevel('pet',pet.id);
  var eff={pet:pet,lv:lv};
  if(pet.type==='attacker'){eff.dmg=pet.baseDmg*(1+0.25*lv);eff.rof=pet.rof*(1+0.10*lv);eff.range=pet.range+lv*15;}
  else if(pet.type==='tank'){
    if(pet.id==='guardian'){eff.armor=pet.armor+0.03*lv;}
    else if(pet.id==='barrier'){eff.shieldDuration=pet.shieldDuration+0.4*lv;eff.interval=Math.max(6,pet.interval-0.6*lv);}
  }else if(pet.type==='helper'){
    if(pet.id==='medic'){eff.heal=pet.heal+2*lv;eff.interval=Math.max(3,pet.interval-0.4*lv);}
    else if(pet.id==='magnetPet'){eff.radius=pet.radius+40*lv;}
  }else if(pet.type==='buffer'){
    if(pet.id==='ammo'){eff.dmgMult=1+(pet.dmgMult-1)+0.04*lv;}
    else if(pet.id==='swift'){eff.rofMult=1+(pet.rofMult-1)+0.03*lv;}
  }else if(pet.type==='mage'){
    eff.chainDmg=pet.chainDmg+8*lv;
    eff.chainInterval=Math.max(0.6,pet.chainInterval-0.1*lv);
  }
  return eff;
}

function computePlayerStats(){
  var g=findGun(save.selectedGun)||GUNS[0];
  var gunB=getGunUpgradeBonus(g.id);
  var shipDmgMult=(shipPassive.dmgMult||1)*(shapePassive.dmgMult||1);
  var shipRofMult=(shipPassive.rofMult||1)*(shapePassive.rofMult||1);
  var petEff=getPetEffects();
  var petDmg=petEff.dmgMult||1;
  var petRof=petEff.rofMult||1;
  var tier=PLAYER_TIERS[Math.min(PLAYER_TIERS.length-1,playerTier)];
  projDamage=tier.dmg*dmgMultBonus*gunB.dmgMult*shipDmgMult*petDmg;
  fireRate=tier.rof*rofMultBonus*g.rofMult*gunB.rofMult*shipRofMult*petRof;
}

function resetGame(level,challenge){
  currentLevel=level;
  currentChallenge=challenge||null;
  paused=false;
  winShown=false;
  isNetworkGame=!!(window.DS_MP&&window.DS_MP.active&&window.DS_MP.networkMode);
  applyStartingBonus();
  shipPassive=getShipPassive();
  shapePassive=getShapePassive();
  var shipHpMult=(shipPassive.hpMult||1)*(shapePassive.hpMult||1);
  var shipUpgLv=getUpgradeLevel('ship',save.selectedShip);
  var mhp=Math.round((BASE_MAX_HP+maxHpBonus+shipUpgLv*10)*shipHpMult);
  if(currentChallenge==='nohit')mhp=Math.round(mhp*0.8);
  player={x:W/2-BASE_SIZE/2,y:H-BORDER-160,width:BASE_SIZE,height:BASE_SIZE,hp:mhp,maxHp:mhp};
  enemies.length=0;enemyProjectiles.length=0;playerProjectiles.length=0;
  healBubbles.length=0;boostBubbles.length=0;bombBubbles.length=0;lasers.length=0;
  particles.length=0;shockwaves.length=0;powerups.length=0;bosses.length=0;obstacleLasers.length=0;
  bossesSpawnedInRun=0;miniBossCount=0;
  elapsed=0;spawnAccum=0;spawnMultiplier=1;activeCapDelta=0;lastThrottleCheck=0;
  playerTier=0;runDamage=0;computePlayerStats();
  fireTimer=0.3;
  healSpawnTimer=(8+Math.random()*5)/level.healFreqMult;
  boostSpawnTimer=(16+Math.random()*6)/level.healFreqMult;
  bombSpawnTimer=8+Math.random()*6;
  powerupSpawnTimer=6+Math.random()*4;
  dragging=false;lastTouchX=0;shakeTime=0;shakeMag=0;flashTime=0;thrusterTimer=0;
  prevHp=mhp;boostTime=0;tierFlash=0;
  runKills=0;runBossKills=0;runKillCount=0;killFlash=0;
  activeSkillId=null;skillState='ready';activeSkillTime=0;skillCooldown=0;
  spikesActive=false;invincibleActive=false;wipeoutActive=false;freezeActive=false;magnetActive=false;
  slowActive=false;leechActive=false;rageActive=false;mirrorActive=false;chainActive=false;voidbeamActive=false;
  chainTimer=0;voidbeamTimer=0;
  nextBossTime=currentLevel.bossInterval;bossIndex=0;lastWaveShownAt=0;nextMiniBossTime=25;
  quadTime=0;shieldTime=0;rapidTime=0;pierceTime=0;multiplierTime=0;
  comboCount=0;comboTimer=0;comboLevel=1;
  streakKillCount=0;streakTimer=0;streakLevel=0;lastStreakLabel='';
  tookDamageThisRun=false;
  playerPoisonTime=0;playerPoisonDPS=0;killTapCount=0;
  petState=null;
  if(save.selectedPet&&findPet(save.selectedPet)){
    petState={id:save.selectedPet,x:W/2+60,y:H-BORDER-200,angle:0,attackTimer:1,healTimer:2,shieldTimer:5,chainTimer:1,eff:getPetEffects()};
  }
  domCache.hpWidth=-1;domCache.hpLow=null;domCache.timer=null;domCache.lvlText='';domCache.kills=-1;
  domCache.puHtml='__';domCache.comboLevel=-1;domCache.comboOn=null;domCache.bossW=-1;
  overlay.classList.remove('on');
  bossWrap.classList.remove('on');
  comboHud.classList.remove('on');
  hpFill.classList.remove('poison');
  updateHud();updateSkillBtn();updatePuHud();updateComboHud();updatePetHud();
  if(isNetworkGame){
    window.DS_MP.myKillCount=0;
    window.DS_MP.myKills=0;
  }
  if(currentLevel.isFinal){
    if(!isNetworkGame||amHost()){
      for(var i=0;i<BOSS_TYPES.length;i++)spawnBossForFinal(i);
    }
  }
  if(currentChallenge==='bossrush'){
    for(var b=0;b<3;b++)spawnBossForFinal(b);
  }
}

function spawnBossForFinal(idx){
  var def=BOSS_TYPES[idx%BOSS_TYPES.length];
  var w=BASE_SIZE*def.size;
  var baseX=edgeLeft()+40+Math.random()*(edgeRight()-edgeLeft()-w-80);
  var hp=Math.round(def.hp*BOSS_HP_MULT*currentLevel.hpMult*4);
  var range=Math.min(def.moveRange,(edgeRight()-edgeLeft()-w)/2-8);
  var boss={
    idx:idx%BOSS_TYPES.length,name:def.name,x:baseX,y:edgeTop()+40+idx*90,width:w,height:w,
    hp:hp,maxHp:hp,baseX:baseX,moveRange:range,phase:Math.random()*6.283,speed:def.speed,
    attackCycle:def.cycle,attackIdx:idx,shootInterval:def.shootInterval,fireTimer:1+idx*0.3,
    gatling:0,gatlingTimer:0,spawnT:0.6+idx*0.2,hitFlash:0,color:def.color,dark:def.dark,
    spiralAngle:0,bossNumber:idx+1,poisonTime:0,poisonDPS:0
  };
  bossesSpawnedInRun++;
  if(isNetworkGame){
    boss.id='b_'+Date.now().toString(36)+'_'+idx+'_'+Math.random().toString(36).slice(2,5);
    boss.spawnTime=Date.now();
    if(window.MP_spawnGlobalBoss)window.MP_spawnGlobalBoss(boss);
    boss._net=true;
    bosses.push(boss);
    bossWrap.classList.add('on');
    bossName.textContent=def.name;
  }else{
    bosses.push(boss);
  }
}

function getPhase(t,level){
  var stageIndex=Math.floor(t/level.stageLength);
  var unlockedCount=Math.min(ENEMY_INTRO_ORDER.length,3+stageIndex*2);
  var pool=ENEMY_INTRO_ORDER.slice(0,unlockedCount);
  var maxActive=Math.min(level.maxActiveCap,level.baseMaxActive+Math.floor(stageIndex*level.maxActiveGrowth));
  return {pool:pool,maxActive:maxActive};
}

function timeHpScale(){
  if(!currentLevel)return 1;
  if(currentLevel.isEndless)return 1+elapsed*0.02;
  var d=currentLevel.duration;if(!isFinite(d))d=600;
  return 1+(elapsed/d)*1.2;
}

function pickSpawnX(w){
  var minX=edgeLeft(),maxX=edgeRight()-w;
  if(maxX<minX)maxX=minX;
  var topZone=edgeTop()+200;
  var bestX=minX+Math.random()*(maxX-minX);
  var bestScore=-1;
  for(var a=0;a<6;a++){
    var cx=minX+Math.random()*(maxX-minX);
    var cxm=cx+w/2;
    var minDist=99999;
    for(var i=0;i<enemies.length;i++){
      var e=enemies[i];
      if(e.y>topZone)continue;
      var d=Math.abs((e.x+e.width/2)-cxm);
      if(d<minDist)minDist=d;
    }
    if(minDist>bestScore){bestScore=minDist;bestX=cx;}
  }
  return bestX;
}

function genEnemyId(){enemyIdCounter++;return 'e_'+Date.now().toString(36)+'_'+enemyIdCounter+'_'+Math.random().toString(36).slice(2,5);}

function buildEnemyObject(typeKey,xOverride,yOverride,shapeOverride){
  var def=ENEMY_TYPES[typeKey];
  if(!def)return null;
  var w=BASE_SIZE*def.size;
  var x=(xOverride!==undefined)?xOverride:pickSpawnX(w);
  if(x<edgeLeft())x=edgeLeft();
  if(x+w>edgeRight())x=edgeRight()-w;
  var hp=Math.max(1,Math.round(def.hp*currentLevel.hpMult*timeHpScale()));
  var dmg=Math.max(1,Math.round(def.damage*currentLevel.dmgMult));
  var y=(yOverride!==undefined)?yOverride:edgeTop();
  var shape=shapeOverride||pickShape();
  return {
    type:typeKey,x:x,y:y,width:w,height:w,hp:hp,maxHp:hp,damage:dmg,
    shootType:def.shootType,fireRate:def.fireRate,
    fireTimer:1/def.fireRate*(0.4+Math.random()*0.6)||1.5,
    color:def.color,dark:def.dark,speed:def.speed,projSpeed:def.projSpeed||0,
    spread:def.spread||0,orbit:def.orbit||false,splits:def.splits||0,
    orbitPhase:Math.random()*6.283,orbitRadius:30+Math.random()*60,
    baseX:x,spiralAngle:0,hitFlash:0,spawnT:SPAWN_ANIM,
    poisonTime:0,poisonDPS:0,shape:shape.id,shapeKp:shape.kpMult,
    heavenlyState:'ready',heavenlyTimer:def.heavenlyCycle||2,
    heavenlyOrbs:def.orbs||8,orbAngle:Math.random()*6.283
  };
}

function spawnEnemyAt(typeKey,xOverride,yOverride,shapeOverride){
  if(isNetworkGame&&!amHost())return;
  var e=buildEnemyObject(typeKey,xOverride,yOverride,shapeOverride);
  if(!e)return;
  if(isNetworkGame){
    e.id=genEnemyId();
    e.spawnTime=Date.now();
    e._netSpawnTime=e.spawnTime;
    e._netStartY=e.y;
    if(window.MP_spawnGlobalEnemy)window.MP_spawnGlobalEnemy(e);
    enemies.push(e);
  }else{
    enemies.push(e);
  }
}

function spawnEnemy(){
  var phase=getPhase(elapsed,currentLevel);
  var key=phase.pool[(Math.random()*phase.pool.length)|0];
  spawnEnemyAt(key);
}

function spawnMiniBoss(){
  if(isNetworkGame&&!amHost())return;
  var baseHp=ENEMY_TYPES.miniBoss.hp;
  var scale=1+miniBossCount*0.6;
  var def=ENEMY_TYPES.miniBoss;
  var w=BASE_SIZE*def.size;
  var x=pickSpawnX(w);
  var hp=Math.round(baseHp*scale*currentLevel.hpMult*timeHpScale());
  var dmg=Math.round(def.damage*currentLevel.dmgMult*(1+miniBossCount*0.15));
  var shape=pickShape();
  var e={
    type:'miniBoss',x:x,y:edgeTop(),width:w,height:w,hp:hp,maxHp:hp,damage:dmg,
    shootType:def.shootType,fireRate:def.fireRate,fireTimer:1.2,
    color:def.color,dark:def.dark,speed:def.speed,projSpeed:def.projSpeed,
    spread:0,orbit:false,splits:0,orbitPhase:0,orbitRadius:0,
    baseX:x,spiralAngle:0,hitFlash:0,spawnT:0.5,
    poisonTime:0,poisonDPS:0,shape:shape.id,shapeKp:shape.kpMult*2,isMiniBoss:true
  };
  miniBossCount++;
  if(isNetworkGame){
    e.id=genEnemyId();
    e.spawnTime=Date.now();
    e._netSpawnTime=e.spawnTime;
    e._netStartY=e.y;
    if(window.MP_spawnGlobalEnemy)window.MP_spawnGlobalEnemy(e);
    enemies.push(e);
  }else{
    enemies.push(e);
    showWaveBanner('MUSUH BESAR!',true);
    sfxRoar();
  }
}

function spawnBoss(){
  if(isNetworkGame&&!amHost())return;
  var idx=bossIndex%BOSS_TYPES.length;
  var def=BOSS_TYPES[idx];
  var w=BASE_SIZE*def.size;
  var cx=(edgeLeft()+edgeRight())/2;
  var baseX=cx-w/2+(Math.random()-0.5)*60;
  if(baseX<edgeLeft())baseX=edgeLeft();
  if(baseX+w>edgeRight())baseX=edgeRight()-w;
  var range=Math.min(def.moveRange,(edgeRight()-edgeLeft()-w)/2-8);
  var scaleFactor=1+bossesSpawnedInRun*1.0;
  var hp=Math.round(def.hp*BOSS_HP_MULT*currentLevel.hpMult*scaleFactor);
  var nb={
    idx:idx,name:def.name,x:baseX,y:edgeTop()-(bossesSpawnedInRun>0?60:0),
    width:w,height:w,hp:hp,maxHp:hp,baseX:baseX,moveRange:range,
    phase:Math.random()*6.283,speed:def.speed,attackCycle:def.cycle,attackIdx:0,
    shootInterval:def.shootInterval,fireTimer:1.4,gatling:0,gatlingTimer:0,
    spawnT:0.6,hitFlash:0,color:def.color,dark:def.dark,spiralAngle:0,
    bossNumber:bossesSpawnedInRun+1,poisonTime:0,poisonDPS:0
  };
  bossesSpawnedInRun++;
  if(isNetworkGame){
    nb.id='b_'+Date.now().toString(36)+'_'+idx+'_'+Math.random().toString(36).slice(2,5);
    nb.spawnTime=Date.now();
    nb._net=true;
    if(window.MP_spawnGlobalBoss)window.MP_spawnGlobalBoss(nb);
    bosses.push(nb);
    bossWrap.classList.add('on');
    bossName.textContent=def.name;
  }else{
    bosses.push(nb);
    bossIndex++;
    bossWrap.classList.add('on');
    bossName.textContent=def.name+(bossesSpawnedInRun>1?(' #'+bossesSpawnedInRun):'');
    sfxRoar();
    triggerShake(10,0.35);
    pushShockwave(cx,edgeTop()+w/2,110,'rgba(255,120,120,0.9)',0.7);
    showWaveBanner('BOSS: '+def.name,true);
  }
}

function bossAttack(boss,type){
  var cx=boss.x+boss.width/2,cy=boss.y+boss.height/2;
  var k,i,a;
  if(type==='laser'){
    for(k=0;k<3;k++){
      var lx=edgeLeft()+40+Math.random()*(edgeRight()-edgeLeft()-80);
      lasers.push({x:lx,startY:cy+boss.height*0.3,width:18,damage:20*currentLevel.dmgMult,timer:0.7,state:'warning',hasHit:false,dashOffset:0,fromBoss:true});
    }
  }else if(type==='zigzag'){
    for(k=0;k<5;k++){
      var offX=(k-2)*28;
      var sprite=getEnemyProjSprite(15);
      pushEnemyProjectile({x:cx+offX,y:cy+boss.height*0.3,vx:0,vy:200,r:sprite.r,damage:15*currentLevel.dmgMult,sprite:sprite,zigzag:true,zigzagTime:Math.random()*6.283,zigzagAmp:60+Math.random()*20,zigzagFreq:3+Math.random()*1.5,baseX:cx+offX,spin:2.2});
    }
  }else if(type==='gatling'){
    boss.gatling=10;boss.gatlingTimer=0;
  }else if(type==='homing'){
    for(k=0;k<3;k++){
      var sp3=getEnemyProjSprite(18);
      pushEnemyProjectile({x:cx+(k-1)*24,y:cy+boss.height*0.3,vx:0,vy:180,r:sp3.r,damage:18*currentLevel.dmgMult,sprite:sp3,homing:true,spin:1.6});
    }
  }else if(type==='radialBoss'){
    var n=10;
    var spr4=getEnemyProjSprite(12);
    for(i=0;i<n;i++){
      a=(i/n)*Math.PI*2+elapsedTotal;
      pushEnemyProjectile({x:cx,y:cy,vx:Math.cos(a)*180,vy:Math.sin(a)*180,r:spr4.r,damage:12*currentLevel.dmgMult,sprite:spr4,spin:3});
    }
  }else if(type==='spiralBoss'){
    var spr5=getEnemyProjSprite(14);
    for(i=0;i<3;i++){
      a=boss.spiralAngle+i*(Math.PI*2/3);
      pushEnemyProjectile({x:cx,y:cy,vx:Math.cos(a)*200,vy:Math.sin(a)*200,r:spr5.r,damage:14*currentLevel.dmgMult,sprite:spr5,spin:2.5});
    }
    boss.spiralAngle+=0.6;
  }
}

function killBoss(boss){
  if(boss._credited)return;
  boss._credited=true;
  var cx=boss.x+boss.width/2,cy=boss.y+boss.height/2;
  for(var i=0;i<6;i++)pushShockwave(cx,cy,140+i*30,'rgba(255,200,100,0.9)',0.7+i*0.1);
  for(var j=0;j<28;j++){
    var ang=(j/28)*Math.PI*2;
    pushParticle(cx,cy,Math.cos(ang)*220,Math.sin(ang)*220,0.7,'#ffd08a',3);
  }
  triggerShake(20,0.6);
  sfxBossDie();
  save.bossKills++;runBossKills++;
  var reward=10;
  if(ownedStart('greedy'))reward=Math.round(reward*1.25);
  if(shipPassive.goldMult)reward=Math.round(reward*shipPassive.goldMult);
  if(multiplierTime>0)reward*=2;
  grantKP(reward);
  runKills+=reward;
  window.DS_MP.myKills++;window.DS_MP.myKillCount++;
  pushDamageNumber(cx,cy-40,Math.round(reward)+' KP','#ffc857');
  if(!isNetworkGame){
    powerups.push({type:'quad',x:cx-90,y:cy,r:20,phase:0});
    powerups.push({type:'shield',x:cx-30,y:cy,r:20,phase:0});
    powerups.push({type:'rapid',x:cx+30,y:cy,r:20,phase:0});
    powerups.push({type:'pierce',x:cx+90,y:cy,r:20,phase:0});
  }
  checkAchievements();
  persist();
}

function updateBosses(dt){
  for(var bi=bosses.length-1;bi>=0;bi--){
    var boss=bosses[bi];
    if(boss.spawnT>0){boss.spawnT-=dt;continue;}
    if(boss._net&&!amHost()){
      if(boss.hitFlash>0){boss.hitFlash-=dt;if(boss.hitFlash<0)boss.hitFlash=0;}
      if(boss.hp<=0){
        if(!boss._credited)killBoss(boss);
        if(window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(boss.id,999999);
        bosses.splice(bi,1);
      }
      continue;
    }
    boss.phase+=dt*boss.speed*0.02;
    var nx=boss.baseX+Math.sin(boss.phase)*boss.moveRange;
    if(nx<edgeLeft())nx=edgeLeft();
    if(nx+boss.width>edgeRight())nx=edgeRight()-boss.width;
    boss.x=nx;
    if(boss.y<edgeTop()+30)boss.y+=35*dt;
    if(boss.hitFlash>0){boss.hitFlash-=dt;if(boss.hitFlash<0)boss.hitFlash=0;}
    if(boss.poisonTime>0){boss.poisonTime-=dt;boss.hp-=boss.poisonDPS*dt;}
    if(!freezeActive&&!slowActive){
      boss.fireTimer-=dt;
      if(boss.fireTimer<=0){
        var type=boss.attackCycle[boss.attackIdx%boss.attackCycle.length];
        boss.attackIdx++;
        bossAttack(boss,type);
        boss.fireTimer=boss.shootInterval;
      }
      if(boss.gatling>0){
        boss.gatlingTimer-=dt;
        if(boss.gatlingTimer<=0){
          boss.gatlingTimer=0.08;
          var sprite=getEnemyProjSprite(10);
          pushEnemyProjectile({x:boss.x+boss.width/2+(Math.random()-0.5)*boss.width*0.55,y:boss.y+boss.height*0.85,vx:(Math.random()-0.5)*120,vy:340,r:sprite.r,damage:8*currentLevel.dmgMult,sprite:sprite,spin:3.5});
          boss.gatling--;
        }
      }
    }else if(slowActive){
      boss.fireTimer-=dt*0.4;
      if(boss.fireTimer<=0){
        var type2=boss.attackCycle[boss.attackIdx%boss.attackCycle.length];
        boss.attackIdx++;
        bossAttack(boss,type2);
        boss.fireTimer=boss.shootInterval;
      }
    }
    if(rectsOverlap(player,boss))damagePlayer(35,{hp:0,hitFlash:0,x:player.x,y:player.y,width:1,height:1});
    if(boss.hp<=0){
      if(isNetworkGame&&boss.id){
        if(!boss._credited)killBoss(boss);
        if(window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(boss.id,999999);
        bosses.splice(bi,1);
      }else{
        killBoss(boss);
        bosses.splice(bi,1);
        if(bosses.length===0){bossWrap.classList.remove('on');}
      }
    }
  }
  if(bosses.length>0){
    var b0=bosses[0];
    var br=Math.max(0,Math.round(b0.hp/b0.maxHp*100));
    if(br!==domCache.bossW){domCache.bossW=br;bossFill.style.width=br+'%';}
  }
}

function estimateEnemyDps(){
  var t=0;
  for(var i=0;i<enemies.length;i++)t+=enemies[i].damage*enemies[i].fireRate;
  for(var j=0;j<bosses.length;j++)t+=30;
  return t;
}

function estimatePlayerDps(){
  var gun=findGun(save.selectedGun)||GUNS[0];
  var shots=gun.count||1;
  var per=projDamage*gun.dmgMult;
  if(quadTime>0)per*=4;
  if(rageActive)per*=2;
  var rof=fireRate;
  if(boostTime>0)rof*=2;
  if(rapidTime>0)rof*=2;
  if(activeSkillId==='gatling'){var gl=getUpgradeLevel('skill','gatling');rof*=(3.5+0.5*gl);}
  return per*shots*rof;
}

function throttleCheck(){
  if(isFinite(currentLevel.duration)&&elapsed>=currentLevel.duration-20){
    spawnMultiplier=Math.min(1.6,spawnMultiplier+0.15);
    activeCapDelta+=1;
    return;
  }
  var eDps=estimateEnemyDps();
  var pDps=Math.max(1,estimatePlayerDps());
  var ratio=eDps/pDps;
  if(ratio>currentLevel.throttleRatio){
    spawnMultiplier=Math.max(0.55,spawnMultiplier-0.12);
    activeCapDelta=Math.max(-3,activeCapDelta-1);
  }else if(ratio<1){
    spawnMultiplier=Math.min(1.3,spawnMultiplier+0.1);
  }
}

function spawnManager(dt){
  if(currentLevel.isFinal)return;
  if(winShown)return;
  if(isNetworkGame&&!amHost())return;
  var phase=getPhase(elapsed,currentLevel);
  var effMax=Math.max(3,phase.maxActive+activeCapDelta);
  var rate=currentLevel.enemiesPerSecond*spawnMultiplier*currentLevel.spawnRateMult;
  if(currentLevel.isEndless)rate*=1+elapsed*0.015;
  if(isFinite(currentLevel.duration)&&elapsed>=currentLevel.duration-20)rate*=1.35;
  spawnAccum+=dt*rate;
  if(spawnAccum>1.5)spawnAccum=1.5;
  if(spawnAccum>=1){spawnAccum-=1;spawnEnemy();}
  var boundary=Math.floor(elapsed/10)*10;
  if(boundary>lastThrottleCheck&&boundary>0){lastThrottleCheck=boundary;throttleCheck();}
}

function showWaveBanner(text,isBoss){
  waveBanner.textContent=text;
  waveBanner.classList.toggle('boss',!!isBoss);
  waveBanner.classList.add('on');
  if(waveBannerTimer)clearTimeout(waveBannerTimer);
  waveBannerTimer=setTimeout(function(){waveBanner.classList.remove('on');},1800);
}

function upgradeManager(){
  var tier=Math.min(PLAYER_TIERS.length-1,Math.floor(elapsed/TIER_SECONDS));
  if(tier>playerTier){
    playerTier=tier;
    computePlayerStats();
    var cx=player.x+player.width/2,cy=player.y+player.height/2;
    pushShockwave(cx,cy,player.width*2.2,'rgba(234,255,143,0.9)',0.5);
    for(var i=0;i<12;i++){
      var ang=(i/12)*Math.PI*2;
      pushParticle(cx,cy,Math.cos(ang)*160,Math.sin(ang)*160,0.5,'#eaff8f',2.2);
    }
    triggerShake(5,0.15);
    tierFlash=0.3;
    sfxWave();
  }
}

function pushParticle(x,y,vx,vy,life,color,r,text){
  if(particles.length>=MAX_PARTICLES)return;
  particles.push({x:x,y:y,vx:vx,vy:vy,life:life,maxLife:life,color:color,r:r,text:text||null});
}
function pushShockwave(x,y,maxR,color,life){
  if(shockwaves.length>=MAX_SHOCKWAVES)return;
  shockwaves.push({x:x,y:y,r:maxR*0.15,maxR:maxR,life:life,maxLife:life,color:color});
}
function pushEnemyProjectile(p){if(enemyProjectiles.length>=MAX_ENEMY_PROJECTILES)return;enemyProjectiles.push(p);}
function pushPlayerProjectile(p){if(playerProjectiles.length>=MAX_PLAYER_PROJECTILES)return;playerProjectiles.push(p);}
function spawnHitSpark(x,y,color){for(var i=0;i<4;i++){var ang=Math.random()*6.283;var spd=80+Math.random()*110;pushParticle(x,y,Math.cos(ang)*spd,Math.sin(ang)*spd,0.3,color,2.4);}}
function spawnMuzzle(x,y,color){for(var i=0;i<4;i++){var ang=(-Math.PI/2)+(Math.random()-0.5)*0.9;var spd=100+Math.random()*90;pushParticle(x,y,Math.cos(ang)*spd,Math.sin(ang)*spd,0.15,color,1.8);}}
function pushDamageNumber(x,y,dmg,color){pushParticle(x+(Math.random()-0.5)*14,y-4,(Math.random()-0.5)*40,-70-Math.random()*30,0.7,color,0,dmg);}

function addCombo(){
  comboCount++;
  comboTimer=2.0;
  var newLevel=Math.min(99,Math.floor(comboCount/3)+1);
  if(newLevel>comboLevel){
    comboLevel=newLevel;
    if(comboLevel>save.comboMax){save.comboMax=comboLevel;killDirty=true;checkAchievements();}
    sfxWave();
    pushShockwave(player.x+player.width/2,player.y+player.height/2,60+comboLevel*6,'rgba(255,200,87,0.85)',0.4);
  }
  updateComboHud();
}
function updateComboHud(){
  var on=(comboLevel>1||comboTimer>0);
  if(domCache.comboOn!==on){domCache.comboOn=on;if(on)comboHud.classList.add('on');else comboHud.classList.remove('on');}
  if(on&&domCache.comboLevel!==comboLevel){
    domCache.comboLevel=comboLevel;
    comboHud.innerHTML='<span class="mult">x'+comboLevel+'</span><span class="small">COMBO</span>';
  }
}
function resetCombo(){
  comboCount=0;comboLevel=1;comboTimer=0;
  if(domCache.comboOn!==false){domCache.comboOn=false;comboHud.classList.remove('on');}
  domCache.comboLevel=-1;
}
function streakLabelFor(n){
  var lbl=null;
  for(var i=0;i<STREAK_LABELS.length;i++)if(n>=STREAK_LABELS[i].n)lbl=STREAK_LABELS[i].label;
  return lbl;
}
function addStreak(){
  streakKillCount++;
  streakTimer=1.2;
  if(streakKillCount<2)return;
  var label=streakLabelFor(streakKillCount);
  if(!label)return;
  if(streakKillCount>streakLevel)streakLevel=streakKillCount;
  if(label!==lastStreakLabel){
    lastStreakLabel=label;
    showStreak(label);
    sfxStreak();
    var bonus=Math.max(1,streakKillCount-1);
    if(ownedStart('greedy'))bonus=Math.round(bonus*1.25);
    if(shipPassive.goldMult)bonus=Math.round(bonus*shipPassive.goldMult);
    if(multiplierTime>0)bonus*=2;
    runKills+=bonus;
    grantKP(bonus);
  }
}
var streakHudEl=document.getElementById('streakHud');
var streakFadeTimer=null;
function showStreak(text){
  streakHudEl.textContent=text;
  streakHudEl.style.transition='none';
  streakHudEl.style.opacity='0';
  streakHudEl.style.transform='scale(.6) rotate(-4deg)';
  void streakHudEl.offsetWidth;
  streakHudEl.style.transition='opacity .2s,transform .25s cubic-bezier(.22,1.12,.36,1.06)';
  streakHudEl.style.opacity='1';
  streakHudEl.style.transform='scale(1) rotate(-2deg)';
  if(streakFadeTimer)clearTimeout(streakFadeTimer);
  streakFadeTimer=setTimeout(function(){
    streakHudEl.style.transition='opacity .35s,transform .35s';
    streakHudEl.style.opacity='0';
    streakHudEl.style.transform='scale(1.4) rotate(3deg)';
  },700);
}

function firePlayer(dt){
  if(winShown)return;
  var mult=boostTime>0?2:1;
  if(rapidTime>0)mult*=2;
  if(activeSkillId==='gatling'){var gl=getUpgradeLevel('skill','gatling');mult*=(3.5+0.5*gl);}
  var rof=fireRate*mult,interval=1/rof;
  fireTimer-=dt;
  if(fireTimer<0)fireTimer=0;
  var guard=0;
  while(fireTimer<=0&&guard<12){fireTimer+=interval;guard++;shootOne();}
}

function shootOne(){
  var gun=findGun(save.selectedGun)||GUNS[0];
  if(currentChallenge==='pistol')gun=GUNS[0];
  var gunB=getGunUpgradeBonus(gun.id);
  var xPos=player.x+player.width/2,yPos=player.y-2;
  var baseAng=-Math.PI/2;
  var dmg=projDamage*gun.dmgMult;
  if(currentChallenge==='pistol')dmg=projDamage;
  if(quadTime>0)dmg*=4;
  if(rageActive)dmg*=2;
  var critChance=(ownedStart('crit')?0.20:0)+(shipPassive.critChance||0)+(shapePassive.critChance||0);
  if(critChance>0&&Math.random()<critChance)dmg*=3;
  var speed=PLAYER_PROJ_SPEED*gun.speedMult*gunB.speedMult;
  var sprite=playerProjSpriteCache[gun.id]||playerProjSpriteCache.bullet;
  var count=gun.count||1;
  var spreadAng=gun.spreadAng||0;
  var pierceBonus=(pierceTime>0?99:0)+(ownedStart('ricochet')?1:0);
  spawnMuzzle(xPos,yPos,gun.id==='laser'?'#a0f0ff':(gun.id==='plasma'?'#c080ff':(gun.id==='poison'?'#a0ff60':'#fff2c0')));
  for(var k=0;k<count;k++){
    var angOffset=0;
    if(count>1)angOffset=(k-(count-1)/2)*spreadAng;
    var ang=baseAng+angOffset+(Math.random()-0.5)*0.03;
    pushPlayerProjectile({
      x:xPos,y:yPos,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,r:sprite.r,damage:dmg,
      projType:gun.id,gunId:gun.id,pierce:(gun.pierce||0)+pierceBonus,
      zigzag:!!gun.zigzag,zigzagTime:0,zigzagAmp:28,zigzagFreq:9,baseX:xPos,
      homing:!!gun.homing,homingTarget:null,explosive:!!gun.explosive,
      explosionR:gun.explosionR||0,poison:!!gun.poison,life:gun.life||3,
      sprite:sprite,gunUpgLv:gunB.lv
    });
  }
  if(gun.id==='laser')sfxLaser();
  else if(gun.id==='poison')sfxPoison();
  else if(Math.random()<0.35)sfxShoot();
}

function fireEnemy(e){
  var cx=e.x+e.width/2,cy=e.y+e.height/2;
  if(e.shootType==='none')return;
  if(e.shootType==='heavenly'){
    var n=e.heavenlyOrbs||8;
    var sprH=getEnemyProjSprite(e.damage);
    for(var h=0;h<n;h++){
      var aH=e.orbAngle+h*(Math.PI*2/n);
      pushEnemyProjectile({x:cx+Math.cos(aH)*e.width*0.6,y:cy+Math.sin(aH)*e.width*0.6,vx:Math.cos(aH)*e.projSpeed,vy:Math.sin(aH)*e.projSpeed,r:sprH.r,damage:e.damage,sprite:sprH,spin:2.8,heavenlyOrb:true});
    }
    return;
  }
  if(e.shootType==='thickLaser'){
    lasers.push({x:cx,startY:e.y+e.height,width:(edgeRight()-edgeLeft())/3,damage:e.damage,timer:0.7,state:'warning',hasHit:false,dashOffset:0,sourceEnemy:e,thick:true});
    return;
  }
  if(e.shootType==='laser'){
    var w=Math.min(46,6+e.damage*0.5);
    lasers.push({x:cx,startY:e.y+e.height,width:w,damage:e.damage,timer:0.45,state:'warning',hasHit:false,dashOffset:0,sourceEnemy:e});
    return;
  }
  if(e.shootType==='poison'){
    var sprP=getEnemyProjSprite(e.damage);
    pushEnemyProjectile({x:cx,y:cy,vx:0,vy:e.projSpeed,r:sprP.r,damage:e.damage,sprite:sprP,sourceEnemy:e,spin:2,poison:true,poisonDPS:e.damage*0.25,poisonDuration:1.5,green:true});
    return;
  }
  var sprite=getEnemyProjSprite(e.damage);
  var count=1,vStep=0;
  if(e.shootType==='twin'){count=2;vStep=16;}
  else if(e.shootType==='burst'){count=3;vStep=10;}
  else if(e.shootType==='burst5'){count=5;vStep=8;}
  else if(e.spread>0)count=e.spread;
  var hSpacing=e.width*0.42;
  for(var k=0;k<count;k++){
    var offX=0,offY=k*vStep;
    if(e.shootType==='twin'||e.shootType==='burst'||e.shootType==='burst5')offX=(Math.random()-0.5)*6;
    else if(count>1)offX=(k-(count-1)/2)*hSpacing;
    var proj={x:cx+offX,y:cy+offY,vx:0,vy:e.projSpeed,r:sprite.r,damage:e.damage,sprite:sprite,sourceEnemy:e,spin:2.5+Math.random()*1.5};
    if(e.shootType==='zigzag'){proj.zigzag=true;proj.zigzagTime=Math.random()*6.28;proj.zigzagAmp=48+Math.random()*32;proj.zigzagFreq=3+Math.random()*2;proj.baseX=proj.x;}
    else if(e.shootType==='homing')proj.homing=true;
    else if(e.shootType==='homingTwin')proj.homing=true;
    pushEnemyProjectile(proj);
  }
  if(e.shootType==='spiral'){
    e.spiralAngle=(e.spiralAngle||0)+0.5;
    var spr=getEnemyProjSprite(e.damage);
    for(var s=0;s<3;s++){
      var a=e.spiralAngle+s*(Math.PI*2/3);
      pushEnemyProjectile({x:cx,y:cy,vx:Math.cos(a)*e.projSpeed,vy:Math.sin(a)*e.projSpeed,r:spr.r,damage:e.damage,sprite:spr,spin:3});
    }
  }else if(e.shootType==='radial'){
    var spr2=getEnemyProjSprite(e.damage),n2=8;
    for(var r=0;r<n2;r++){
      var a2=(r/n2)*Math.PI*2+elapsedTotal;
      pushEnemyProjectile({x:cx,y:cy,vx:Math.cos(a2)*e.projSpeed,vy:Math.sin(a2)*e.projSpeed,r:spr2.r,damage:e.damage,sprite:spr2,spin:2.8});
    }
  }
}

function triggerShake(mag,time){
  var mult=save.shakeAmt/100;
  mag*=mult;
  if(mag>shakeMag)shakeMag=mag;
  if(time>shakeTime)shakeTime=time;
  if(navigator.vibrate&&mag>6){try{navigator.vibrate(Math.min(60,Math.round(mag*2)));}catch(e){}}
}

function damagePlayer(amount,source){
  if(invincibleActive)return;
  if(window.DS_MP.active&&window.DS_MP.dead)return;
  var dodgeChance=(ownedStart('dodge')?0.15:0)+(shipPassive.dodgeChance||0)+(shapePassive.dodgeChance||0);
  if(dodgeChance>0&&Math.random()<dodgeChance){
    spawnHitSpark(player.x+player.width/2,player.y+player.height/2,'#bde9fb');
    pushParticle(player.x+player.width/2,player.y-10,0,-40,0.6,'#bde9fb',0,'DODGE');
    return;
  }
  var armorMult=(shipPassive.armorMult||1)*(shapePassive.armorMult||1);
  if(ownedStart('armor'))armorMult*=0.8;
  var petEff=getPetEffects();
  if(petEff.armor)armorMult*=(1-petEff.armor);
  if(shieldTime>0){amount*=0.1;pushParticle(player.x+player.width/2,player.y-10,0,-40,0.5,'#bde9fb',0,'-90%');}
  amount*=armorMult;
  if(currentChallenge==='nohit')amount=0;
  tookDamageThisRun=true;
  player.hp-=amount;
  resetCombo();
  streakKillCount=0;streakTimer=0;streakLevel=0;lastStreakLabel='';
  if((spikesActive||mirrorActive)&&source&&source.hp>0){
    var reflectPct=mirrorActive?1.0:0.35;
    if(spikesActive&&!mirrorActive){
      var sl=getUpgradeLevel('skill','spikes');
      reflectPct=0.35*(1+0.20*sl);
    }
    var reflect=Math.round(amount*reflectPct);
    if(reflect>0){
      if(isNetworkGame&&source.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(source.id,reflect);
      else{source.hp-=reflect;source.hitFlash=0.15;}
      spawnHitSpark(source.x+source.width/2,source.y+source.height/2,'#e0a4ff');
    }
  }
}

function explodeAt(x,y,r,dmg){
  pushShockwave(x,y,r*1.6,'rgba(255,180,100,0.9)',0.42);
  pushShockwave(x,y,r*1.1,'rgba(255,255,255,0.9)',0.3);
  for(var i=0;i<10;i++){
    var ang=Math.random()*6.283;
    var spd=120+Math.random()*160;
    pushParticle(x,y,Math.cos(ang)*spd,Math.sin(ang)*spd,0.45,'#ffb060',2.6);
  }
  triggerShake(8,0.22);
  for(var i2=enemies.length-1;i2>=0;i2--){
    var e=enemies[i2];
    if(e.spawnT>0)continue;
    var dx=(e.x+e.width/2)-x,dy=(e.y+e.height/2)-y;
    if(dx*dx+dy*dy<r*r){
      if(isNetworkGame&&e.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(e.id,dmg);
      else{e.hp-=dmg;e.hitFlash=0.15;}
      pushDamageNumber(e.x+e.width/2,e.y+e.height/2,Math.round(dmg),'#ffb060');
    }
  }
  for(var bj=0;bj<bosses.length;bj++){
    var bo=bosses[bj];
    if(bo.spawnT>0)continue;
    var bdx=(bo.x+bo.width/2)-x,bdy=(bo.y+bo.height/2)-y;
    if(bdx*bdx+bdy*bdy<r*r){
      if(isNetworkGame&&bo.id&&window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(bo.id,dmg);
      else{bo.hp-=dmg;bo.hitFlash=0.15;}
      pushDamageNumber(bo.x+bo.width/2,bo.y+bo.height/2,Math.round(dmg),'#ffb060');
    }
  }
}

function killEnemy(e){
  var cx=e.x+e.width/2,cy=e.y+e.height/2;
  spawnHitSpark(cx,cy,e.color);
  pushShockwave(cx,cy,e.width*1.4,'rgba(255,255,255,0.85)',0.3);
  if(e.splits>0&&(!isNetworkGame||amHost())){
    for(var s=0;s<e.splits;s++){
      var childX=e.x+(s-(e.splits-1)/2)*46;
      spawnEnemyAt('blueSmall',childX,e.y);
    }
  }
  if(!isNetworkGame){
    var dropRoll=Math.random();
    if(dropRoll<0.05*dropMultBonus)powerups.push({type:Math.random()<0.5?'quad':'shield',x:cx,y:cy,r:20,phase:0});
    else if(dropRoll<0.075*dropMultBonus)powerups.push({type:Math.random()<0.5?'rapid':'pierce',x:cx,y:cy,r:20,phase:0});
    else if(dropRoll<0.095*dropMultBonus)powerups.push({type:'multiplier',x:cx,y:cy,r:20,phase:0});
  }
  var shapeMult=e.shapeKp||1;
  var bonusKills=1+Math.floor(comboLevel/3);
  if(e.isMiniBoss)bonusKills+=5;
  bonusKills=Math.round(bonusKills*shapeMult);
  if(ownedStart('greedy'))bonusKills=Math.round(bonusKills*1.25);
  if(shipPassive.goldMult)bonusKills=Math.round(bonusKills*shipPassive.goldMult);
  if(multiplierTime>0)bonusKills*=2;
  runKills+=bonusKills;
  runKillCount++;
  grantKP(bonusKills);
  killDirty=true;
  killFlash=0.12;
  window.DS_MP.myKills++;
  window.DS_MP.myKillCount++;
  if(ownedStart('vampiric'))player.hp=Math.min(player.maxHp,player.hp+1);
  if(leechActive){
    var ll=getUpgradeLevel('skill','leech');
    player.hp=Math.min(player.maxHp,player.hp+5+ll*2);
  }
  addCombo();
  addStreak();
  checkAchievements();
  if(window.DS_MP.active&&window.MP_broadcastKill){
    window.MP_broadcastKill(e.isMiniBoss?'Boss Besar':(ENEMY_TYPES[e.type]?ENEMY_TYPES[e.type].name||e.type:'Musuh'));
  }
}

function updateEnemies(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elBottom=edgeBottom();
  var speedFactor=slowActive?0.4:1;
  for(var i=enemies.length-1;i>=0;i--){
    var e=enemies[i];
    if(e.spawnT>0)e.spawnT-=dt;
    else if(!freezeActive){
      if(!isNetworkGame){
        e.y+=e.speed*speedFactor*dt;
      }
      if(e.orbit){
        e.orbitPhase+=dt*1.8*speedFactor;
        var nx=e.baseX+Math.sin(e.orbitPhase)*e.orbitRadius;
        if(nx<elLeft)nx=elLeft;
        if(nx+e.width>elRight)nx=elRight-e.width;
        e.x=nx;
      }
      if(e.shootType==='heavenly'){
        e.orbAngle+=dt*1.4*speedFactor;
        if(e.heavenlyState==='ready'){
          e.heavenlyTimer-=dt;
          if(e.heavenlyTimer<=0){fireEnemy(e);e.heavenlyState='reload';e.heavenlyTimer=2;}
        }else{
          e.heavenlyTimer-=dt;
          if(e.heavenlyTimer<=0){e.heavenlyState='ready';e.heavenlyTimer=2;}
        }
      }
    }
    if(e.x<elLeft)e.x=elLeft;
    if(e.x+e.width>elRight)e.x=elRight-e.width;
    if(e.hitFlash>0){e.hitFlash-=dt;if(e.hitFlash<0)e.hitFlash=0;}
    if(e.poisonTime>0&&e.spawnT<=0){
      e.poisonTime-=dt;
      if(!isNetworkGame||amHost())e.hp-=e.poisonDPS*dt;
      if(Math.random()<0.2){
        pushParticle(e.x+e.width/2+(Math.random()-0.5)*e.width,e.y+e.height/2+(Math.random()-0.5)*e.height,0,-30,0.4,'#a8e63a',1.8);
      }
    }
    if(e.spawnT<=0&&!freezeActive&&e.shootType!=='none'&&e.shootType!=='heavenly'){
      if(!isNetworkGame||amHost()){
        e.fireTimer-=dt*speedFactor;
        if(e.fireTimer<=0){fireEnemy(e);e.fireTimer=1/e.fireRate;}
      }
    }
    if(e.y+e.height>elBottom){
      if(isNetworkGame&&e.id&&window.MP_killGlobalEnemy)window.MP_killGlobalEnemy(e.id);
      enemies.splice(i,1);
      continue;
    }
    if(e.spawnT<=0&&rectsOverlap(player,e)){
      damagePlayer(CONTACT_DAMAGE_FLAT,e);
      spawnHitSpark(e.x+e.width/2,e.y+e.height/2,e.color);
      pushShockwave(e.x+e.width/2,e.y+e.height/2,e.width*1.5,'rgba(255,120,120,0.85)',0.35);
      triggerShake(14,0.32);
      sfxHit();
      if(isNetworkGame&&e.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(e.id,999999);
      else e.hp=0;
      continue;
    }
    if(e.hp<=0){
      removeLaserFor(e);
      if(isNetworkGame&&e.id&&window.MP_killGlobalEnemy)window.MP_killGlobalEnemy(e.id);
      enemies.splice(i,1);
      sfxDeath();
      killEnemy(e);
    }
  }
}

function removeLaserFor(e){
  for(var i=0;i<lasers.length;i++)if(lasers[i].sourceEnemy===e)lasers[i].sourceEnemy=null;
}
function rectsOverlap(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function circleRectOverlap(cx,cy,r,rect){
  var clx=Math.max(rect.x,Math.min(cx,rect.x+rect.width));
  var cly=Math.max(rect.y,Math.min(cy,rect.y+rect.height));
  var dx=cx-clx,dy=cy-cly;
  return dx*dx+dy*dy<r*r;
}
function findNearestEnemy(x,y){
  var best=null,bestD=99999999;
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i];
    if(e.spawnT>0)continue;
    var dx=(e.x+e.width/2)-x,dy=(e.y+e.height/2)-y;
    var d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;best=e;}
  }
  for(var j=0;j<bosses.length;j++){
    var bo=bosses[j];
    if(bo.spawnT>0)continue;
    var bdx=(bo.x+bo.width/2)-x,bdy=(bo.y+bo.height/2)-y;
    var bd=bdx*bdx+bdy*bdy;
    if(bd<bestD){bestD=bd;best=bo;}
  }
  return best;
}

function damageTarget(target,dmg,x,y){
  if(target.hp>0){
    if(wipeoutActive)dmg=target.maxHp*10;
    if(isNetworkGame&&target.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(target.id,dmg);
    else target.hp-=dmg;
    target.hitFlash=0.15;
    spawnHitSpark(x,y,'#eaff8f');
    pushDamageNumber(x,y,Math.round(dmg),'#eaff8f');
  }
}
function applyPoisonToEnemy(target,dmg){
  if(!target)return;
  var poisonTotal=dmg*0.20;
  if(target.poisonTime>0){
    target.poisonDPS=Math.max(target.poisonDPS,poisonTotal);
    target.poisonTime=1.0;
  }else{
    target.poisonDPS=poisonTotal;
    target.poisonTime=1.0;
  }
}

function updatePlayerProjectiles(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elTop=edgeTop(),elBottom=edgeBottom();
  for(var i=playerProjectiles.length-1;i>=0;i--){
    var p=playerProjectiles[i];
    p.px=p.x;p.py=p.y;
    if(p.life!==undefined){
      p.life-=dt;
      if(p.life<=0){
        if(p.explosive)explodeAt(p.x,p.y,p.explosionR,p.damage*0.6);
        playerProjectiles.splice(i,1);
        continue;
      }
    }
    if(p.zigzag){
      p.zigzagTime+=dt*p.zigzagFreq;
      p.x=p.baseX+Math.sin(p.zigzagTime)*p.zigzagAmp;
      p.y+=p.vy*dt;
    }else if(p.homing){
      if(!p.homingTarget||p.homingTarget.hp<=0)p.homingTarget=findNearestEnemy(p.x,p.y);
      if(p.homingTarget){
        var tx=(p.homingTarget.x+p.homingTarget.width/2)-p.x;
        var ty=(p.homingTarget.y+p.homingTarget.height/2)-p.y;
        var tl=Math.sqrt(tx*tx+ty*ty)||1;
        var spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
        p.vx+=((tx/tl*spd)-p.vx)*4*dt;
        p.vy+=((ty/tl*spd)-p.vy)*4*dt;
      }
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
    }else{
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
    }
    if(p.y-p.r<elTop||p.x+p.r<elLeft||p.x-p.r>elRight||p.y-p.r>elBottom){
      if(p.explosive)explodeAt(p.x,p.y,p.explosionR,p.damage*0.6);
      playerProjectiles.splice(i,1);
      continue;
    }
    var hit=false;
    for(var j=enemies.length-1;j>=0;j--){
      var e=enemies[j];
      if(e.spawnT>0)continue;
      if(circleRectOverlap(p.x,p.y,p.r,e)){
        damageTarget(e,p.damage,p.x,p.y);
        if(p.poison)applyPoisonToEnemy(e,p.damage);
        if(p.explosive)explodeAt(p.x,p.y,p.explosionR,p.damage*0.6);
        if(p.pierce>0){p.pierce--;continue;}
        hit=true;
        break;
      }
    }
    if(!hit){
      for(var bj=0;bj<bosses.length;bj++){
        var bo=bosses[bj];
        if(bo.spawnT>0)continue;
        if(circleRectOverlap(p.x,p.y,p.r,bo)){
          var bdmg=wipeoutActive?Math.max(30,p.damage*4):p.damage;
          if(isNetworkGame&&bo.id&&window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(bo.id,bdmg);
          else bo.hp-=bdmg;
          bo.hitFlash=0.15;
          spawnHitSpark(p.x,p.y,'#eaff8f');
          pushDamageNumber(p.x,p.y,Math.round(bdmg),'#ffd84d');
          if(p.poison)applyPoisonToEnemy(bo,p.damage);
          if(p.explosive)explodeAt(p.x,p.y,p.explosionR,p.damage*0.6);
          if(p.pierce>0)p.pierce--;
          else hit=true;
          if(hit)break;
        }
      }
    }
    if(hit)playerProjectiles.splice(i,1);
  }
}

function updateEnemyProjectiles(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elTop=edgeTop(),elBottom=edgeBottom();
  for(var i=enemyProjectiles.length-1;i>=0;i--){
    var p=enemyProjectiles[i];
    p.px=p.x;p.py=p.y;
    if(p.zigzag){
      p.zigzagTime+=dt*p.zigzagFreq;
      p.x=p.baseX+Math.sin(p.zigzagTime)*p.zigzagAmp;
      p.y+=p.vy*dt;
    }else if(p.homing){
      var dx=(player.x+player.width/2)-p.x;
      var targetVx=dx*2;
      if(targetVx>200)targetVx=200;
      if(targetVx<-200)targetVx=-200;
      p.vx+=(targetVx-p.vx)*3*dt;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
    }else{
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
    }
    if(p.green&&Math.random()<0.4)pushParticle(p.x,p.y,(Math.random()-0.5)*40,-20+Math.random()*20,0.4,'#a8e63a',2);
    if(p.y-p.r>elBottom||p.y+p.r<elTop||p.x+p.r<elLeft||p.x-p.r>elRight){
      enemyProjectiles.splice(i,1);
      continue;
    }
    if(circleRectOverlap(p.x,p.y,p.r*0.8,player)){
      damagePlayer(p.damage,p.sourceEnemy);
      if(p.poison){
        playerPoisonTime=Math.max(playerPoisonTime,p.poisonDuration||1.5);
        playerPoisonDPS=Math.max(playerPoisonDPS,p.poisonDPS||(p.damage*0.25));
        hpFill.classList.add('poison');
      }
      spawnHitSpark(p.x,p.y,'#ff8f8f');
      enemyProjectiles.splice(i,1);
      triggerShake(5,0.15);
      sfxHit();
    }
  }
}

function updateLasers(dt){
  var elBottom=edgeBottom();
  for(var i=lasers.length-1;i>=0;i--){
    var l=lasers[i];
    if(l.sourceEnemy){
      l.x=l.sourceEnemy.x+l.sourceEnemy.width/2;
      l.startY=l.sourceEnemy.y+l.sourceEnemy.height;
    }
    l.dashOffset-=dt*80;
    l.timer-=dt;
    if(l.state==='warning'&&l.timer<=0){l.state='active';l.timer=l.thick?0.4:0.18;}
    else if(l.state==='active'){
      if(!l.hasHit){
        var half=l.width/2;
        var pcx=player.x+player.width/2;
        if(pcx>l.x-half-player.width/2&&pcx<l.x+half+player.width/2&&player.y+player.height>l.startY){
          damagePlayer(l.damage,l.sourceEnemy||null);
          l.hasHit=true;
          triggerShake(10,0.25);
        }
      }
      if(l.timer<=0){l.sourceEnemy=null;lasers.splice(i,1);}
    }
  }
}

function spawnObstacleLasers(){
  var count=2+Math.floor(Math.random()*2);
  for(var i=0;i<count;i++){
    var minX=edgeLeft()+40,maxX=edgeRight()-40;
    var x=minX+Math.random()*(maxX-minX);
    var speedMin=30,speedMax=90;
    var speed=speedMin+Math.random()*(speedMax-speedMin);
    var dir=Math.random()<0.5?-1:1;
    obstacleLasers.push({x:x,width:12,vx:speed*dir,damage:SIDE_LASER_DAMAGE,hitCooldown:0,alpha:0});
  }
  showWaveBanner('LASER RINTANGAN',true);
}

function updateObstacleLasers(dt){
  var elLeft=edgeLeft(),elRight=edgeRight();
  var ptop=edgeTop(),pbottom=edgeBottom();
  for(var i=0;i<obstacleLasers.length;i++){
    var ol=obstacleLasers[i];
    ol.x+=ol.vx*dt;
    if(ol.x<elLeft+6){ol.x=elLeft+6;ol.vx=Math.abs(ol.vx);}
    if(ol.x>elRight-6){ol.x=elRight-6;ol.vx=-Math.abs(ol.vx);}
    if(ol.alpha<1)ol.alpha=Math.min(1,ol.alpha+dt*3);
    if(ol.hitCooldown>0)ol.hitCooldown-=dt;
    if(ol.hitCooldown<=0){
      var pcx=player.x+player.width/2,pcy=player.y+player.height/2;
      if(pcx+player.width/2>ol.x-ol.width/2&&pcx-player.width/2<ol.x+ol.width/2&&pcy>ptop&&pcy<pbottom){
        damagePlayer(SIDE_LASER_DAMAGE,null);
        ol.hitCooldown=0.9;
        triggerShake(12,0.3);
        sfxHit();
        pushShockwave(pcx,pcy,60,'rgba(255,80,120,0.9)',0.4);
      }
    }
  }
}

function updateHealBubbles(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elTop=edgeTop(),elBottom=edgeBottom();
  healSpawnTimer-=dt;
  if(healSpawnTimer<=0){
    var x=elLeft+20+Math.random()*(elRight-elLeft-40-24);
    if(x<elLeft+8)x=elLeft+8;
    if(x+24>elRight-8)x=elRight-8-24;
    healBubbles.push({x:x+12,y:elTop+20,r:16,phase:Math.random()*6.283});
    healSpawnTimer=(8+Math.random()*5)/currentLevel.healFreqMult;
  }
  for(var i=healBubbles.length-1;i>=0;i--){
    var b=healBubbles[i];
    if(magnetActive){
      var dx=player.x+player.width/2-b.x,dy=player.y+player.height/2-b.y;
      var d=Math.sqrt(dx*dx+dy*dy)||1;
      b.x+=dx/d*420*dt;
      b.y+=dy/d*420*dt;
    }else b.y+=HEAL_BUBBLE_SPEED*dt;
    if(b.x-b.r<elLeft)b.x=elLeft+b.r;
    if(b.x+b.r>elRight)b.x=elRight-b.r;
    b.phase+=dt*4;
    if(b.y+b.r>elBottom){healBubbles.splice(i,1);continue;}
    if(circleRectOverlap(b.x,b.y,b.r,player)){
      player.hp=Math.min(player.maxHp,player.hp+player.maxHp*HEAL_RECOVER_RATIO);
      spawnHitSpark(b.x,b.y,'#3ddc97');
      pushShockwave(b.x,b.y,32,'rgba(61,220,151,0.85)',0.34);
      healBubbles.splice(i,1);
      sfxHeal();
    }
  }
}

function updateBoostBubbles(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elTop=edgeTop(),elBottom=edgeBottom();
  boostSpawnTimer-=dt;
  if(boostSpawnTimer<=0){
    var x=elLeft+20+Math.random()*(elRight-elLeft-40-24);
    if(x<elLeft+8)x=elLeft+8;
    if(x+24>elRight-8)x=elRight-8-24;
    boostBubbles.push({x:x+12,y:elTop+20,r:15,phase:Math.random()*6.283});
    boostSpawnTimer=(16+Math.random()*6)/currentLevel.healFreqMult;
  }
  for(var i=boostBubbles.length-1;i>=0;i--){
    var b=boostBubbles[i];
    if(magnetActive){
      var dx=player.x+player.width/2-b.x,dy=player.y+player.height/2-b.y;
      var d=Math.sqrt(dx*dx+dy*dy)||1;
      b.x+=dx/d*420*dt;
      b.y+=dy/d*420*dt;
    }else b.y+=BOOST_BUBBLE_SPEED*dt;
    if(b.x-b.r<elLeft)b.x=elLeft+b.r;
    if(b.x+b.r>elRight)b.x=elRight-b.r;
    b.phase+=dt*4;
    if(b.y+b.r>elBottom){boostBubbles.splice(i,1);continue;}
    if(circleRectOverlap(b.x,b.y,b.r,player)){
      boostTime=3;
      spawnHitSpark(b.x,b.y,'#ffffff');
      pushShockwave(b.x,b.y,38,'rgba(255,255,255,0.9)',0.36);
      boostBubbles.splice(i,1);
      sfxHeal();
    }
  }
}

function updateBombBubbles(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elTop=edgeTop(),elBottom=edgeBottom();
  bombSpawnTimer-=dt;
  if(bombSpawnTimer<=0){
    var x=elLeft+20+Math.random()*(elRight-elLeft-40-36);
    if(x<elLeft+8)x=elLeft+8;
    if(x+36>elRight-8)x=elRight-8-36;
    bombBubbles.push({x:x+18,y:elTop+20,r:20,phase:Math.random()*6.283});
    bombSpawnTimer=(14+Math.random()*8)/currentLevel.healFreqMult;
  }
  for(var i=bombBubbles.length-1;i>=0;i--){
    var b=bombBubbles[i];
    if(magnetActive){
      var dx=player.x+player.width/2-b.x,dy=player.y+player.height/2-b.y;
      var d=Math.sqrt(dx*dx+dy*dy)||1;
      b.x+=dx/d*420*dt;
      b.y+=dy/d*420*dt;
    }else b.y+=BOOST_BUBBLE_SPEED*0.9*dt;
    if(b.x-b.r<elLeft)b.x=elLeft+b.r;
    if(b.x+b.r>elRight)b.x=elRight-b.r;
    b.phase+=dt*4;
    if(b.y+b.r>elBottom){bombBubbles.splice(i,1);continue;}
    if(circleRectOverlap(b.x,b.y,b.r*0.85,player)){
      if(!invincibleActive){
        player.hp-=BOMB_DAMAGE;
        tookDamageThisRun=true;
        resetCombo();
        streakKillCount=0;streakTimer=0;streakLevel=0;lastStreakLabel='';
      }
      spawnHitSpark(b.x,b.y,'#ff5c39');
      pushShockwave(b.x,b.y,70,'rgba(255,92,57,0.95)',0.5);
      pushShockwave(b.x,b.y,40,'rgba(36,36,56,0.7)',0.35);
      for(var k=0;k<8;k++){
        var ang=Math.random()*6.283;
        pushParticle(b.x,b.y,Math.cos(ang)*180,Math.sin(ang)*180,0.5,'#ff8552',3);
      }
      triggerShake(14,0.35);
      sfxBomb();
      bombBubbles.splice(i,1);
    }
  }
}

function updatePowerups(dt){
  var elLeft=edgeLeft(),elRight=edgeRight(),elBottom=edgeBottom();
  powerupSpawnTimer-=dt;
  if(powerupSpawnTimer<=0&&powerups.length<4){
    var px2=edgeLeft()+40+Math.random()*(edgeRight()-edgeLeft()-80);
    var types=['quad','shield','rapid','pierce','multiplier','multiplier'];
    var tp=types[(Math.random()*types.length)|0];
    powerups.push({type:tp,x:px2,y:edgeTop()+20,r:20,phase:0});
    powerupSpawnTimer=8+Math.random()*6;
  }
  var petEff=petState?petState.eff:{};
  for(var i=powerups.length-1;i>=0;i--){
    var pu=powerups[i];
    pu.phase+=dt*4;
    pu.y+=60*dt;
    var dxm=player.x+player.width/2-pu.x,dym=player.y+player.height/2-pu.y;
    var dm=Math.sqrt(dxm*dxm+dym*dym)||1;
    if(magnetActive||(petEff.radius&&dm<petEff.radius)){
      var pullSpeed=magnetActive?420:240;
      pu.x+=dxm/dm*pullSpeed*dt;
      pu.y+=dym/dm*pullSpeed*dt;
    }
    if(pu.x-pu.r<elLeft)pu.x=elLeft+pu.r;
    if(pu.x+pu.r>elRight)pu.x=elRight-pu.r;
    if(pu.y+pu.r>elBottom){powerups.splice(i,1);continue;}
    if(circleRectOverlap(pu.x,pu.y,pu.r*0.9,player)){
      if(pu.type==='quad')quadTime=6;
      else if(pu.type==='shield')shieldTime=5;
      else if(pu.type==='rapid')rapidTime=6;
      else if(pu.type==='pierce')pierceTime=6;
      else if(pu.type==='multiplier')multiplierTime=3;
      spawnHitSpark(pu.x,pu.y,'#ffffff');
      pushShockwave(pu.x,pu.y,55,'rgba(255,255,255,0.95)',0.4);
      powerups.splice(i,1);
      sfxPower();
    }
  }
}

function updateChainLightning(dt){
  if(!chainActive)return;
  chainTimer-=dt;
  if(chainTimer<=0){
    chainTimer=0.4;
    var lv=getUpgradeLevel('skill','chain');
    var dmg=30*(1+0.20*lv);
    var target=findNearestEnemy(player.x+player.width/2,player.y);
    if(target){
      if(isNetworkGame&&target.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(target.id,dmg);
      else{target.hp-=dmg;target.hitFlash=0.15;}
      pushDamageNumber(target.x+target.width/2,target.y+target.height/2,Math.round(dmg),'#ffe066');
      spawnHitSpark(target.x+target.width/2,target.y+target.height/2,'#ffe066');
    }
  }
}

function updateVoidbeam(dt){
  if(!voidbeamActive)return;
  voidbeamTimer-=dt;
  if(voidbeamTimer<=0){
    voidbeamTimer=0.08;
    var lv=getUpgradeLevel('skill','voidbeam');
    var dmg=projDamage*0.8*(1+0.20*lv);
    var xPos=player.x+player.width/2,yPos=player.y-2;
    var sprite=playerProjSpriteCache.bullet;
    pushPlayerProjectile({x:xPos,y:yPos,vx:0,vy:-PLAYER_PROJ_SPEED*1.8,r:4,damage:dmg,projType:'voidbeam',gunId:'bullet',pierce:99,life:2,sprite:sprite,gunUpgLv:0});
  }
}

function updatePlayerPoison(dt){
  if(playerPoisonTime>0){
    playerPoisonTime-=dt;
    player.hp-=playerPoisonDPS*dt;
    if(Math.random()<0.3){
      pushParticle(player.x+player.width/2+(Math.random()-0.5)*player.width,player.y+(Math.random()-0.5)*player.height,-20-Math.random()*20,20+Math.random()*20,0.5,'#a8e63a',2);
    }
    if(playerPoisonTime<=0){playerPoisonTime=0;playerPoisonDPS=0;hpFill.classList.remove('poison');}
  }
}

function updatePet(dt){
  if(!petState)return;
  var eff=petState.eff;
  var pet=eff.pet;
  if(!pet)return;
  var targetX=player.x+player.width/2+Math.cos(elapsedTotal*1.5)*52;
  var targetY=player.y-40+Math.sin(elapsedTotal*1.5)*22;
  petState.x+=(targetX-petState.x)*4*dt;
  petState.y+=(targetY-petState.y)*4*dt;
  petState.angle+=dt*2;
  if(pet.type==='attacker'&&eff.dmg){
    petState.attackTimer-=dt;
    if(petState.attackTimer<=0){
      petState.attackTimer=1/Math.max(0.2,eff.rof);
      var tgt=findNearestEnemy(petState.x,petState.y);
      if(tgt){
        var dx=(tgt.x+tgt.width/2)-petState.x;
        var dy=(tgt.y+tgt.height/2)-petState.y;
        var d=Math.sqrt(dx*dx+dy*dy)||1;
        if(d<eff.range){
          var sprite=playerProjSpriteCache.bullet;
          pushPlayerProjectile({x:petState.x,y:petState.y,vx:dx/d*620,vy:dy/d*620,r:sprite.r,damage:eff.dmg,projType:'pet',gunId:'bullet',pierce:0,life:1.8,sprite:sprite,gunUpgLv:0});
          spawnMuzzle(petState.x,petState.y,'#67c7f0');
        }
      }
    }
  }else if(pet.type==='helper'&&pet.id==='medic'&&eff.heal){
    petState.healTimer-=dt;
    if(petState.healTimer<=0){
      petState.healTimer=eff.interval;
      if(player.hp<player.maxHp){
        player.hp=Math.min(player.maxHp,player.hp+eff.heal);
        spawnHitSpark(petState.x,petState.y,'#ff77a9');
        pushParticle(player.x+player.width/2,player.y-10,0,-50,0.6,'#ff77a9',0,'+'+eff.heal);
        sfxHeal();
      }
    }
  }else if(pet.type==='tank'&&pet.id==='barrier'&&eff.shieldDuration){
    petState.shieldTimer-=dt;
    if(petState.shieldTimer<=0){
      petState.shieldTimer=eff.interval;
      shieldTime=Math.max(shieldTime,eff.shieldDuration);
      spawnHitSpark(petState.x,petState.y,'#5aa6e8');
      pushShockwave(player.x+player.width/2,player.y+player.height/2,70,'rgba(90,166,232,0.9)',0.4);
      sfxPower();
    }
  }else if(pet.type==='mage'&&pet.id==='voidPet'&&eff.chainDmg){
    petState.chainTimer-=dt;
    if(petState.chainTimer<=0){
      petState.chainTimer=eff.chainInterval;
      var t=findNearestEnemy(player.x+player.width/2,player.y);
      if(t){
        if(isNetworkGame&&t.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(t.id,eff.chainDmg);
        else{t.hp-=eff.chainDmg;t.hitFlash=0.15;}
        pushDamageNumber(t.x+t.width/2,t.y+t.height/2,Math.round(eff.chainDmg),'#c86ae8');
        spawnHitSpark(t.x+t.width/2,t.y+t.height/2,'#c86ae8');
      }
    }
  }
}

function updateParticles(dt){
  for(var i=particles.length-1;i>=0;i--){
    var p=particles[i];
    p.life-=dt;
    if(p.life<=0){particles.splice(i,1);continue;}
    p.x+=p.vx*dt;
    p.y+=p.vy*dt;
    if(p.text!==null)p.vx*=0.96;
  }
}

function updateShockwaves(dt){
  for(var i=shockwaves.length-1;i>=0;i--){
    var s=shockwaves[i];
    s.life-=dt;
    if(s.life<=0){shockwaves.splice(i,1);continue;}
    var t=1-s.life/s.maxLife;
    s.r=s.maxR*(0.15+0.85*t);
  }
}

function updateThruster(dt){
  thrusterTimer-=dt;
  if(thrusterTimer<=0){
    thrusterTimer=0.09;
    var ship=findShip(save.selectedShip);
    pushParticle(player.x+player.width/2+(Math.random()-0.5)*(player.width*0.4),player.y+player.height-2,0,120+Math.random()*40,0.24,boostTime>0?'#ffffff':ship.cockpit,1.8);
  }
  if(boostTime>0){boostTime-=dt;if(boostTime<0)boostTime=0;}
  if(quadTime>0){quadTime-=dt;if(quadTime<0)quadTime=0;}
  if(shieldTime>0){shieldTime-=dt;if(shieldTime<0)shieldTime=0;}
  if(rapidTime>0){rapidTime-=dt;if(rapidTime<0)rapidTime=0;}
  if(pierceTime>0){pierceTime-=dt;if(pierceTime<0)pierceTime=0;}
  if(multiplierTime>0){multiplierTime-=dt;if(multiplierTime<0)multiplierTime=0;}
}

function updateShipFx(dt){
  shipFxTimer-=dt;
  if(shipFxTimer>0)return;
  shipFxTimer=0.08;
  var ship=findShip(save.selectedShip);
  var cx=player.x+player.width/2,cy=player.y+player.height/2;
  var fx=ship.fx||'default';
  if(fx==='default'||fx==='leaf'){pushParticle(cx+(Math.random()-0.5)*30,cy+20,0,-40-Math.random()*20,0.7,'#5cc27a',1.5);}
  else if(fx==='ripple'){pushShockwave(cx,cy,20+Math.sin(elapsedTotal*3)*5,'rgba(120,190,255,0.6)',0.4);}
  else if(fx==='sparkle'){pushParticle(cx+(Math.random()-0.5)*36,cy+(Math.random()-0.5)*36,(Math.random()-0.5)*40,(Math.random()-0.5)*40-20,0.7,'#ffe480',1.8);}
  else if(fx==='smoke'){pushParticle(cx+(Math.random()-0.5)*30,cy+20+(Math.random()*10),(Math.random()-0.5)*30,-30-Math.random()*20,0.9,'rgba(80,80,100,0.8)',3);}
  else if(fx==='swirl'){var a=elapsedTotal*4;pushParticle(cx+Math.cos(a)*28,cy+Math.sin(a)*28,-Math.sin(a)*60,Math.cos(a)*60,0.6,'#c080ff',2);}
  else if(fx==='blood'){pushParticle(cx+(Math.random()-0.5)*28,cy+18,-10-Math.random()*20,80+Math.random()*30,0.7,'#e84848',2);}
  else if(fx==='ghost'){pushParticle(cx+(Math.random()-0.5)*30,cy+(Math.random()-0.5)*30,0,0,0.5,'rgba(200,180,255,0.7)',4);}
  else if(fx==='ice'){pushParticle(cx+(Math.random()-0.5)*34,cy+(Math.random()-0.5)*34,(Math.random()-0.5)*20,(Math.random()-0.5)*20,0.8,'#d0f0ff',2);}
  else if(fx==='rainbow'){var hue2=(elapsedTotal*100)%360;pushParticle(cx+(Math.random()-0.5)*34,cy+(Math.random()-0.5)*34,(Math.random()-0.5)*30,(Math.random()-0.5)*30,0.7,'hsl('+hue2+',90%,65%)',2.2);}
  else if(fx==='fire'){pushParticle(cx+(Math.random()-0.5)*32,cy+22,(Math.random()-0.5)*20,60+Math.random()*40,0.6,'#ffb040',2.5);}
  else if(fx==='moon'){var am=elapsedTotal*2;pushParticle(cx+Math.cos(am)*34,cy+Math.sin(am)*34,0,0,0.5,'rgba(220,235,255,0.85)',2.4);}
  else if(fx==='nebula'){for(var i=0;i<2;i++)pushParticle(cx+(Math.random()-0.5)*36,cy+(Math.random()-0.5)*36,(Math.random()-0.5)*50,(Math.random()-0.5)*50,0.7,'rgba(220,140,255,0.7)',2.6);}
  else if(fx==='quantum'){pushParticle(cx+(Math.random()-0.5)*40,cy+(Math.random()-0.5)*40,0,0,0.4,'rgba(120,255,255,0.85)',4);}
  else if(fx==='metal'){pushParticle(cx+(Math.random()-0.5)*36,cy+(Math.random()-0.5)*36,(Math.random()-0.5)*60,(Math.random()-0.5)*60,0.5,'rgba(200,200,220,0.9)',1.8);}
  else if(fx==='galaxy'){for(var j=0;j<2;j++)pushParticle(cx+(Math.random()-0.5)*40,cy+(Math.random()-0.5)*40,(Math.random()-0.5)*30,(Math.random()-0.5)*30,0.8,'rgba(150,200,255,0.85)',1.6);}
  else if(fx==='blackhole'){var ang2=elapsedTotal*3;pushParticle(cx+Math.cos(ang2)*40,cy+Math.sin(ang2)*40,-Math.cos(ang2)*40,-Math.sin(ang2)*40,0.7,'rgba(180,80,255,0.9)',3);}
}

function updateAmbient(dt){
  var pa=playArea();
  var bottom=pa.bottom,top=pa.top,left=pa.left,right=pa.right;
  for(var i=0;i<ambientFar.length;i++){
    var s=ambientFar[i];
    s.y+=s.speed*dt;
    s.x+=Math.sin(elapsedTotal*1.2+s.sway)*6*dt;
    if(s.rise){if(s.y<top){s.y=bottom;s.x=left+Math.random()*(right-left);}}
    else{if(s.y>bottom){s.y=top;s.x=left+Math.random()*(right-left);}}
  }
  for(var j=0;j<ambientNear.length;j++){
    var n=ambientNear[j];
    n.y+=n.speed*dt;
    n.x+=Math.sin(elapsedTotal*1.4+n.sway)*8*dt;
    if(n.rise){if(n.y<top){n.y=bottom;n.x=left+Math.random()*(right-left);}}
    else{if(n.y>bottom){n.y=top;n.x=left+Math.random()*(right-left);}}
  }
}

function drawAmbient(){
  for(var i=0;i<ambientFar.length;i++){
    var s=ambientFar[i];
    ctx.fillStyle=s.color;
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fill();
  }
  for(var j=0;j<ambientNear.length;j++){
    var n=ambientNear[j];
    ctx.fillStyle=n.color;
    ctx.beginPath();
    ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
    ctx.fill();
  }
}

function drawPlayer(){
  var cx=player.x+player.width/2,cy=player.y+player.height/2;
  var boosted=boostTime>0;
  var ship=findShip(save.selectedShip);
  var glowSet=playerGlowCache[ship.id]||playerGlowCache['default'];
  var key=ship.id+'_'+save.selectedShape;
  var spriteSet=playerSpriteCache[key]||playerSpriteCache[ship.id+'_square']||playerSpriteCache['default_square'];
  var glow=boosted?glowSet.boost:glowSet.normal;
  if((shipPassive.armorMult&&shipPassive.armorMult<1)||(shapePassive.armorMult&&shapePassive.armorMult<1)){
    ctx.save();ctx.globalAlpha=0.55+Math.sin(elapsedTotal*4)*0.15;ctx.strokeStyle='rgba(180,180,200,0.9)';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(cx,cy,player.width*1.5,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(shipPassive.dodgeChance||shapePassive.dodgeChance){
    ctx.save();ctx.globalAlpha=0.35+Math.sin(elapsedTotal*6)*0.15;
    for(var i=0;i<3;i++){
      var pa=(elapsedTotal*1.5+i*2.09);
      ctx.fillStyle='rgba(180,150,255,0.6)';
      ctx.beginPath();ctx.arc(cx+Math.cos(pa)*player.width*1.2,cy+Math.sin(pa)*player.width*1.2,5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  if(shipPassive.critChance||shapePassive.critChance){
    ctx.save();
    for(var k=0;k<4;k++){
      var ang2=(elapsedTotal*1.2+k*Math.PI/2);
      var r2=player.width*1.35;
      ctx.fillStyle='rgba(255,220,255,0.9)';
      ctx.beginPath();ctx.arc(cx+Math.cos(ang2)*r2,cy+Math.sin(ang2)*r2,2.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.drawImage(glow.canvas,cx-glow.R,cy-glow.R);
  if(quadTime>0){ctx.beginPath();ctx.arc(cx,cy,player.width*1.05,0,Math.PI*2);ctx.strokeStyle='rgba(255,200,87,'+(0.6+Math.sin(elapsedTotal*14)*0.3)+')';ctx.lineWidth=3.5;ctx.stroke();}
  if(invincibleActive){ctx.beginPath();ctx.arc(cx,cy,player.width*0.95,0,Math.PI*2);ctx.strokeStyle='rgba(189,233,251,'+(0.7+Math.sin(elapsedTotal*12)*0.25)+')';ctx.lineWidth=3.5;ctx.stroke();}
  if(shieldTime>0){ctx.beginPath();ctx.arc(cx,cy,player.width*1.15,0,Math.PI*2);ctx.strokeStyle='rgba(103,199,240,'+(0.6+Math.sin(elapsedTotal*12)*0.25)+')';ctx.lineWidth=4;ctx.stroke();}
  if(rapidTime>0){ctx.beginPath();ctx.arc(cx,cy,player.width*1.25,0,Math.PI*2);ctx.strokeStyle='rgba(255,119,169,'+(0.55+Math.sin(elapsedTotal*18)*0.3)+')';ctx.lineWidth=2.5;ctx.stroke();}
  if(pierceTime>0){ctx.beginPath();ctx.arc(cx,cy,player.width*1.35,0,Math.PI*2);ctx.strokeStyle='rgba(155,107,255,'+(0.55+Math.sin(elapsedTotal*16)*0.3)+')';ctx.lineWidth=2.5;ctx.stroke();}
  if(multiplierTime>0){ctx.beginPath();ctx.arc(cx,cy,player.width*1.45,0,Math.PI*2);ctx.strokeStyle='rgba(255,176,32,'+(0.7+Math.sin(elapsedTotal*20)*0.3)+')';ctx.lineWidth=3;ctx.stroke();}
  if(rageActive){ctx.beginPath();ctx.arc(cx,cy,player.width*1.55,0,Math.PI*2);ctx.strokeStyle='rgba(255,80,60,'+(0.6+Math.sin(elapsedTotal*22)*0.3)+')';ctx.lineWidth=3;ctx.stroke();}
  if(mirrorActive){ctx.beginPath();ctx.arc(cx,cy,player.width*1.65,0,Math.PI*2);ctx.strokeStyle='rgba(220,240,255,'+(0.7+Math.sin(elapsedTotal*20)*0.3)+')';ctx.lineWidth=3;ctx.stroke();}
  var sprite=boosted?spriteSet.boost:spriteSet.normal;
  ctx.drawImage(sprite.canvas,player.x-sprite.pad,player.y-sprite.pad);
}

function drawPet(){
  if(!petState)return;
  var spr=petSpriteCache[petState.id];
  if(!spr)return;
  ctx.save();
  ctx.globalAlpha=0.75+Math.sin(elapsedTotal*3)*0.15;
  ctx.drawImage(spr.canvas,petState.x-spr.cx,petState.y-spr.cy);
  ctx.restore();
}

function drawEnemies(){
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i];
    var key=e.type+'_'+(e.shape||'square');
    var spr=enemySpriteCache[key]||enemySpriteCache[e.type+'_square'];
    if(!spr)continue;
    var img=(e.hitFlash>0)?spr.flash:spr.normal;
    var cx=e.x+e.width/2,cy=e.y+e.height/2;
    if(e.spawnT>0){
      var t=1-e.spawnT/SPAWN_ANIM,scale=t*t*(3-2*t);
      if(scale<0.05)scale=0.05;
      var hw=spr.half*scale;
      ctx.drawImage(img,cx-hw,cy-hw,spr.half*2*scale,spr.half*2*scale);
    }else if(freezeActive||slowActive){
      ctx.save();
      ctx.globalAlpha=freezeActive?0.75:0.9;
      ctx.drawImage(img,cx-spr.half,cy-spr.half);
      if(freezeActive){
        ctx.globalAlpha=0.95;ctx.strokeStyle='rgba(120,220,255,1)';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(cx,cy,e.width*0.62,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }else ctx.drawImage(img,cx-spr.half,cy-spr.half);
    if(e.poisonTime>0&&e.spawnT<=0){
      ctx.save();
      ctx.globalAlpha=0.6+Math.sin(elapsedTotal*10)*0.2;ctx.strokeStyle='rgba(168,230,58,0.95)';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(cx,cy,e.width*0.68,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    if(e.shootType==='heavenly'&&e.spawnT<=0&&e.heavenlyState==='ready'){
      var orbs=e.heavenlyOrbs||8;
      for(var o=0;o<orbs;o++){
        var oa=e.orbAngle+o*(Math.PI*2/orbs);
        var ox=cx+Math.cos(oa)*e.width*0.6;
        var oy=cy+Math.sin(oa)*e.width*0.6;
        ctx.save();ctx.globalAlpha=0.75;
        var og=ctx.createRadialGradient(ox,oy,0,ox,oy,7);
        og.addColorStop(0,'#ffffff');og.addColorStop(0.5,'#f0f8ff');og.addColorStop(1,'rgba(220,235,255,0)');
        ctx.fillStyle=og;ctx.beginPath();ctx.arc(ox,oy,7,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=1;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(ox,oy,3.2,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }
    if(e.hp<e.maxHp&&e.spawnT<=0){
      var barW=e.width;
      var ratio=e.hp/e.maxHp;
      if(ratio<0)ratio=0;
      ctx.fillStyle='rgba(255,255,255,0.85)';ctx.fillRect(e.x-3,e.y-12,barW+6,7);
      ctx.fillStyle='rgba(36,36,56,0.35)';ctx.fillRect(e.x-2,e.y-11,barW+4,5);
      ctx.fillStyle=ratio<0.35?'#ff6b4a':'#3ddc97';ctx.fillRect(e.x,e.y-10,barW*ratio,3);
    }
  }
}

function drawBosses(){
  for(var bi=0;bi<bosses.length;bi++){
    var boss=bosses[bi];
    var spr=bossSpriteCache[boss.idx];
    if(!spr)continue;
    var img=(boss.hitFlash>0)?spr.flash:spr.normal;
    var cx=boss.x+boss.width/2,cy=boss.y+boss.height/2;
    if(boss.spawnT>0){
      var t=1-boss.spawnT/0.6,scale=t*t*(3-2*t);
      if(scale<0.05)scale=0.05;
      var hw=spr.half*scale;
      ctx.drawImage(img,cx-hw,cy-hw,spr.half*2*scale,spr.half*2*scale);
    }else{
      if(freezeActive||slowActive){
        ctx.save();ctx.globalAlpha=0.85;
        ctx.drawImage(img,cx-spr.half,cy-spr.half);
        ctx.globalAlpha=0.95;
        ctx.strokeStyle=freezeActive?'rgba(120,220,255,1)':'rgba(180,140,255,0.9)';
        ctx.lineWidth=3.5;
        ctx.beginPath();ctx.arc(cx,cy,boss.width*0.6,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      }else ctx.drawImage(img,cx-spr.half,cy-spr.half);
      if(boss.poisonTime>0){
        ctx.save();ctx.globalAlpha=0.55+Math.sin(elapsedTotal*10)*0.2;ctx.strokeStyle='rgba(168,230,58,0.95)';ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(cx,cy,boss.width*0.7,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      }
      if(bosses.length>1){
        ctx.save();
        ctx.font='bold 14px Fredoka,sans-serif';ctx.textAlign='center';
        ctx.fillStyle='#fff';ctx.strokeStyle='rgba(36,36,56,0.9)';ctx.lineWidth=4;
        var label='#'+boss.bossNumber;
        ctx.strokeText(label,cx,boss.y-6);ctx.fillText(label,cx,boss.y-6);
        ctx.restore();
      }
    }
  }
}

function drawProjectiles(){
  var i,p,img,pox,poy,pScale,ang;
  for(i=0;i<playerProjectiles.length;i++){
    p=playerProjectiles[i];
    img=p.sprite.canvas;
    pox=p.sprite.cx;poy=p.sprite.cy;
    var gunUpgLv=p.gunUpgLv||0;
    if(wipeoutActive){ctx.globalAlpha=0.6;ctx.fillStyle='#ff6b4a';ctx.beginPath();ctx.arc(p.x,p.y,p.r*2.6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    if(quadTime>0){ctx.globalAlpha=0.6;ctx.fillStyle='#ffc857';ctx.beginPath();ctx.arc(p.x,p.y,p.r*2.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    pScale=(1+Math.sin(elapsedTotal*12+p.x*0.03)*0.08)*(1+0.05*gunUpgLv);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(Math.atan2(p.vy,p.vx)+Math.PI/2);
    ctx.scale(pScale,pScale);
    ctx.drawImage(img,-pox,-poy);
    ctx.restore();
  }
  for(var j=0;j<enemyProjectiles.length;j++){
    var q=enemyProjectiles[j];
    var sp=q.sprite;
    var vx2=q.x-(q.px!==undefined?q.px:q.x);
    var vy2=q.y-(q.py!==undefined?q.py:q.y);
    var len=Math.sqrt(vx2*vx2+vy2*vy2);
    var spinRate=(q.spin||2.5);
    if(len>0.01){
      ang=Math.atan2(vy2,vx2)-Math.PI/2+elapsedTotal*spinRate;
      var qScale=1+Math.sin(elapsedTotal*10+q.x*0.02)*0.1;
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(ang);ctx.scale(qScale,qScale);
      ctx.drawImage(sp.canvas,-sp.cx,-sp.cy);ctx.restore();
    }else{
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(elapsedTotal*spinRate);
      ctx.drawImage(sp.canvas,-sp.cx,-sp.cy);ctx.restore();
    }
  }
}

function drawLasers(){
  var elBottom=edgeBottom();
  for(var i=0;i<lasers.length;i++){
    var l=lasers[i];
    if(l.state==='warning'){
      ctx.save();
      ctx.setLineDash([9,7]);
      ctx.lineDashOffset=l.dashOffset;
      ctx.strokeStyle=l.fromBoss?'rgba(255,90,120,0.9)':(l.thick?'rgba(255,80,180,0.85)':'rgba(255,60,60,0.8)');
      ctx.lineWidth=l.width*0.4;
      ctx.beginPath();ctx.moveTo(l.x,l.startY);ctx.lineTo(l.x,elBottom);ctx.stroke();
      ctx.restore();
    }else{
      var g=ctx.createLinearGradient(l.x-l.width/2,0,l.x+l.width/2,0);
      if(l.fromBoss){g.addColorStop(0,'rgba(255,60,120,0.2)');g.addColorStop(0.5,'rgba(255,235,245,1)');g.addColorStop(1,'rgba(255,60,120,0.2)');}
      else{g.addColorStop(0,'rgba(255,90,90,0.2)');g.addColorStop(0.5,'rgba(255,235,235,1)');g.addColorStop(1,'rgba(255,90,90,0.2)');}
      ctx.fillStyle=g;
      ctx.fillRect(l.x-l.width/2,l.startY,l.width,elBottom-l.startY);
      ctx.fillStyle='rgba(255,240,240,1)';
      ctx.fillRect(l.x-l.width*0.18,l.startY,l.width*0.36,elBottom-l.startY);
    }
  }
}

function drawObstacleLasers(){
  var elTop=edgeTop(),elBottom=edgeBottom();
  for(var i=0;i<obstacleLasers.length;i++){
    var ol=obstacleLasers[i];
    var a=ol.alpha;
    ctx.save();
    ctx.globalAlpha=a*0.35;
    ctx.fillStyle='rgba(255,80,180,0.9)';
    ctx.fillRect(ol.x-ol.width*1.5,elTop,ol.width*3,elBottom-elTop);
    ctx.globalAlpha=a*0.75;
    ctx.fillStyle='#fff';
    ctx.fillRect(ol.x-ol.width/2,elTop,ol.width,elBottom-elTop);
    ctx.restore();
  }
}

function drawHealBubbles(){
  for(var i=0;i<healBubbles.length;i++){
    var b=healBubbles[i];
    var pulse=1+Math.sin(b.phase)*0.12;
    ctx.globalAlpha=0.5;ctx.fillStyle='#3ddc97';
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*1.7*pulse,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.fillStyle='#3ddc97';
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*pulse,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#fff';
    ctx.fillRect(b.x-2,b.y-7,4,14);
    ctx.fillRect(b.x-7,b.y-2,14,4);
  }
}

function drawBoostBubbles(){
  for(var i=0;i<boostBubbles.length;i++){
    var b=boostBubbles[i];
    var pulse=1+Math.sin(b.phase)*0.14;
    ctx.globalAlpha=0.5;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*1.8*pulse,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*pulse,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#3ddc97';ctx.lineWidth=3;ctx.stroke();
  }
}

function drawBombBubbles(){
  for(var i=0;i<bombBubbles.length;i++){
    var b=bombBubbles[i];
    var pulse=1+Math.sin(b.phase*1.4)*0.15;
    var warnAlpha=0.55+Math.sin(b.phase*3)*0.35;
    ctx.globalAlpha=warnAlpha*0.55;ctx.fillStyle='#ff5c39';
    ctx.beginPath();ctx.arc(b.x,b.y,b.r*2.05*pulse,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    if(bombSprite)ctx.drawImage(bombSprite.canvas,b.x-bombSprite.cx*pulse,b.y-bombSprite.cy*pulse,bombSprite.canvas.width*pulse,bombSprite.canvas.height*pulse);
  }
}

function drawPowerups(){
  for(var i=0;i<powerups.length;i++){
    var pu=powerups[i];
    var spr=powerupSprites[pu.type];
    if(!spr)continue;
    var pulse=1+Math.sin(pu.phase)*0.15;
    ctx.globalAlpha=0.65;
    ctx.drawImage(spr.canvas,pu.x-spr.cx*pulse*1.4,pu.y-spr.cy*pulse*1.4,spr.canvas.width*pulse*1.4,spr.canvas.height*pulse*1.4);
    ctx.globalAlpha=1;
    ctx.drawImage(spr.canvas,pu.x-spr.cx*pulse,pu.y-spr.cy*pulse,spr.canvas.width*pulse,spr.canvas.height*pulse);
  }
}

function drawParticles(){
  for(var i=0;i<particles.length;i++){
    var p=particles[i];
    var a=p.life/p.maxLife;
    if(p.text!==null&&p.text!==undefined){
      ctx.globalAlpha=a;
      ctx.font='bold 16px Fredoka,sans-serif';
      ctx.textAlign='center';
      ctx.lineWidth=3.5;
      ctx.strokeStyle='rgba(36,36,56,0.9)';
      ctx.strokeText(p.text,p.x,p.y);
      ctx.fillStyle=p.color;
      ctx.fillText(p.text,p.x,p.y);
    }else{
      ctx.globalAlpha=a*0.9;
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.globalAlpha=1;
  ctx.textAlign='start';
}

function drawShockwaves(){
  for(var i=0;i<shockwaves.length;i++){
    var s=shockwaves[i];
    var t=1-s.life/s.maxLife;
    ctx.globalAlpha=(1-t)*0.9;
    ctx.strokeStyle=s.color;
    ctx.lineWidth=3.5*(1-t)+1;
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.stroke();
  }
  ctx.globalAlpha=1;
}

function drawFlash(){
  if(flashTime>0){
    var a=flashTime*1.4;
    if(a>0.35)a=0.35;
    ctx.fillStyle='rgba(255,107,74,'+a+')';
    ctx.fillRect(0,0,W,H);
  }
  if(tierFlash>0){
    var a2=tierFlash*1.1;
    if(a2>0.3)a2=0.3;
    ctx.fillStyle='rgba(234,255,143,'+a2+')';
    ctx.fillRect(0,0,W,H);
  }
}

function updateHud(){
  var ratio=player.hp/player.maxHp;
  if(ratio<0)ratio=0;
  var w=Math.round(ratio*100);
  if(w!==domCache.hpWidth){domCache.hpWidth=w;hpFill.style.width=w+'%';}
  var isLow=ratio<=0.25;
  if(isLow!==domCache.hpLow){
    domCache.hpLow=isLow;
    if(isLow&&playerPoisonTime<=0)hpFill.classList.add('low');
    else if(!isLow&&playerPoisonTime<=0)hpFill.classList.remove('low');
  }
  var t;
  if(!isFinite(currentLevel.duration)){
    t='ENDLESS '+(currentLevel.isEndless?Math.floor(elapsed):'-');
  }else{t=Math.max(0,Math.ceil(currentLevel.duration-elapsed));}
  if(t!==domCache.timer){
    domCache.timer=t;
    timerText.textContent=t;
    timerText.style.fontSize=(typeof t==='string')?'14px':'26px';
  }
  var lt=projDamage.toFixed(1)+' DMG';
  if(lt!==domCache.lvlText){domCache.lvlText=lt;lvlText.textContent=lt;}
  var displayKills;
  if(window.DS_MP.active)displayKills=window.DS_MP.myKillCount;
  else displayKills=runKillCount;
  if(displayKills!==domCache.kills){
    domCache.kills=displayKills;
    gameKills.textContent=displayKills;
  }
}

function updatePuHud(){
  var html='';
  if(quadTime>0)html+='<div class="pu-tag quad">x4 '+Math.ceil(quadTime)+'</div>';
  if(shieldTime>0)html+='<div class="pu-tag shield">SHIELD '+Math.ceil(shieldTime)+'</div>';
  if(rapidTime>0)html+='<div class="pu-tag rapid">CEPAT '+Math.ceil(rapidTime)+'</div>';
  if(pierceTime>0)html+='<div class="pu-tag pierce">TEMBUS '+Math.ceil(pierceTime)+'</div>';
  if(multiplierTime>0)html+='<div class="pu-tag multiplier">KP x2 '+Math.ceil(multiplierTime)+'</div>';
  if(playerPoisonTime>0)html+='<div class="pu-tag psn">RACUN '+Math.ceil(playerPoisonTime)+'</div>';
  if(petState){
    var pet=findPet(petState.id);
    if(pet)html+='<div class="pu-tag pet">'+pet.name+'</div>';
  }
  var ship=findShip(save.selectedShip);
  if(ship.passiveDesc&&ship.id!=='default')html+='<div class="pu-tag ship">'+ship.passiveDesc+'</div>';
  if(html!==domCache.puHtml){domCache.puHtml=html;puHud.innerHTML=html;}
}

function updatePetHud(){
  var el=document.getElementById('petHud');
  if(!el)return;
  if(!petState||(appState!=='playing'&&appState!=='playingMP')){el.classList.remove('on');return;}
  var pet=findPet(petState.id);
  if(!pet){el.classList.remove('on');return;}
  el.classList.add('on');
  var name=document.getElementById('petHudName');
  var lv=document.getElementById('petHudLv');
  var cv=document.getElementById('petHudCanvas');
  if(name)name.textContent=pet.name;
  if(lv)lv.textContent='LV '+getUpgradeLevel('pet',pet.id);
  if(cv){
    var c=cv.getContext('2d');
    c.clearRect(0,0,cv.width,cv.height);
    var spr=petSpriteCache[pet.id];
    if(spr)c.drawImage(spr.canvas,0,0,cv.width,cv.height);
  }
}

var hintTimer=null;
function showHint(){
  hint.classList.add('on');
  if(hintTimer)clearTimeout(hintTimer);
  hintTimer=setTimeout(function(){hint.classList.remove('on');},4500);
}

function spawnConfetti(colors,count){
  confettiLayer.innerHTML='';
  var frag=document.createDocumentFragment();
  for(var i=0;i<count;i++){
    var el=document.createElement('div');
    el.className='confetti';
    el.style.left=(Math.random()*100)+'%';
    el.style.background=colors[(Math.random()*colors.length)|0];
    el.style.animationDuration=(1.8+Math.random()*1.6)+'s';
    el.style.animationDelay=(Math.random()*0.5)+'s';
    el.style.width=(6+Math.random()*4)+'px';
    el.style.height=(10+Math.random()*8)+'px';
    el.style.borderRadius=Math.random()<0.3?'50%':'2px';
    frag.appendChild(el);
  }
  confettiLayer.appendChild(frag);
}

var achToastTimer=null;
function showAchToast(a){
  achToastName.textContent=a.name;
  achToast.classList.add('on');
  if(achToastTimer)clearTimeout(achToastTimer);
  achToastTimer=setTimeout(function(){achToast.classList.remove('on');},2600);
}

function checkAchievements(){
  var changed=false;
  var vUsed=vouchersUsedCount();
  var friendCount=0;
  for(var fk in save.friends)if(save.friends[fk])friendCount++;
  for(var i=0;i<ACHIEVEMENTS.length;i++){
    var a=ACHIEVEMENTS[i];
    if(save.achievements[a.id])continue;
    var unlock=false;
    if(a.type==='kills'&&save.totalKills>=a.goal)unlock=true;
    else if(a.type==='win_level'&&save.winFlags[a.level])unlock=true;
    else if(a.type==='bosses'&&save.bossKills>=a.goal)unlock=true;
    else if(a.type==='comboMax'&&save.comboMax>=a.goal)unlock=true;
    else if(a.type==='all_skills'&&save.ownedSkills.length===SKILLS.length)unlock=true;
    else if(a.type==='all_ships'&&save.ships.length===SHIPS.length)unlock=true;
    else if(a.type==='all_guns'&&save.guns.length===GUNS.length)unlock=true;
    else if(a.type==='all_starting'&&save.startingUpgrades.length===STARTING_UPGRADES.length)unlock=true;
    else if(a.type==='all_shapes'&&save.shapes.length===PLAYER_SHAPES.length)unlock=true;
    else if(a.type==='all_pets'&&save.pets.length===PETS.length)unlock=true;
    else if(a.type==='vouchers_used'&&vUsed>=a.goal)unlock=true;
    else if(a.type==='chapter'&&chapterComplete(a.chapter))unlock=true;
    else if(a.type==='endless'&&save.endlessBest>=a.goal)unlock=true;
    else if(a.type==='challenge_nohit'&&save.challengeBests.nohit>0)unlock=true;
    else if(a.type==='challenge_pistol'&&save.challengeBests.pistol>0)unlock=true;
    else if(a.type==='challenge_speed'&&save.challengeBests.speed>0)unlock=true;
    else if(a.type==='challenge_bossrush'&&save.challengeBests.bossrush>0)unlock=true;
    else if(a.type==='mp_wins'&&(save.mpWins||0)>=a.goal)unlock=true;
    else if(a.type==='mp_gifts'&&(save.mpGifts||0)>=a.goal)unlock=true;
    else if(a.type==='friends'&&friendCount>=a.goal)unlock=true;
    else if(a.type==='level'&&save.level>=a.goal)unlock=true;
    else if(a.type==='trophies'&&save.trophies>=a.goal)unlock=true;
    if(unlock){
      save.achievements[a.id]=true;
      changed=true;
      sfxAch();
      showAchToast(a);
    }
  }
  if(changed)persist();
}

function showWinModal(){
  if(winShown)return;
  winShown=true;
  if(isNetworkGame&&!amHost())return;
  var elapsedSec=Math.ceil(elapsed);
  var isEndless=currentLevel.isEndless;
  var bonus=0;
  if(currentChallenge==='nohit'&&!tookDamageThisRun)bonus+=500;
  if(currentChallenge==='speed'){
    var par=currentLevel.duration;
    if(elapsedSec<par*0.7)bonus+=Math.round((par*0.7-elapsedSec)*20);
  }
  if(currentChallenge==='bossrush')bonus+=1000;
  if(isEndless)bonus=runKills;
  if(bonus>0)grantKP(bonus);
  var winModal=document.getElementById('winModal');
  var winSub=document.getElementById('winSub');
  var winKp=document.getElementById('winKp');
  var winKills=document.getElementById('winKills');
  var winTime=document.getElementById('winTime');
  var winNoHit=document.getElementById('winNoHit');
  var winBonus=document.getElementById('winBonus');
  if(winSub)winSub.textContent=currentChallenge?currentChallenge.toUpperCase():currentLevel.name;
  if(winKp)winKp.textContent=runKills.toLocaleString('id-ID');
  if(winKills)winKills.textContent=runKillCount;
  if(winTime)winTime.textContent=elapsedSec+'s';
  if(winNoHit)winNoHit.textContent=tookDamageThisRun?'Tidak':'YA!';
  if(winBonus)winBonus.textContent=bonus>0?('+'+bonus.toLocaleString('id-ID')+' Bonus KP'):'Tidak ada bonus';
  var conf=document.getElementById('winConfetti');
  if(conf){
    conf.innerHTML='';
    var colors=['#ffc857','#ff6b4a','#3ddc97','#67c7f0','#9b6bff','#ff77a9','#ffffff'];
    for(var c=0;c<70;c++){
      var el=document.createElement('div');
      el.className='confetti';
      el.style.left=(Math.random()*100)+'%';
      el.style.background=colors[(Math.random()*colors.length)|0];
      el.style.animationDuration=(1.8+Math.random()*1.6)+'s';
      el.style.animationDelay=(Math.random()*0.5)+'s';
      el.style.width=(6+Math.random()*4)+'px';
      el.style.height=(10+Math.random()*8)+'px';
      el.style.borderRadius=Math.random()<0.3?'50%':'2px';
      conf.appendChild(el);
    }
  }
  if(winModal)winModal.classList.add('on');
  sfxVictory();
  if(currentLevel.isEndless){
    if(runKills>save.endlessBest)save.endlessBest=runKills;
  }
  if(currentChallenge){
    var bestKey=currentChallenge;
    if(currentChallenge==='speed'){
      var prev=save.challengeBests.speed||0;
      if(prev===0||elapsedSec<prev)save.challengeBests.speed=elapsedSec;
    }else{
      var prevB=save.challengeBests[bestKey]||0;
      if(runKills>prevB)save.challengeBests[bestKey]=runKills;
    }
  }
  save.winFlags[currentLevel.id]=true;
  if(!tookDamageThisRun)save.noHitFlags[currentLevel.id]=true;
  if(currentLevel.id===3)save.hardWins++;
  if(currentLevel.id===4)save.expertWins++;
  if(currentLevel.id===5)save.nightmareWins++;
  if(currentLevel.id===6)save.impossibleWins++;
  if(currentLevel.id===7)save.doomWins=(save.doomWins||0)+1;
  if(currentLevel.id===8)save.rrrorWins=(save.rrrorWins||0)+1;
  if(currentLevel.id===12)save.finalWins=(save.finalWins||0)+1;
  checkAchievements();
  persist();
}

function endGame(won){
  if(window.DS_MP.active){
    if(!won){
      if(window.DS_MP.onPlayerDeath)window.DS_MP.onPlayerDeath();
    }else{
      if(window.DS_MP.onGameEnd)window.DS_MP.onGameEnd();
    }
    return;
  }
  appState='ended';
  hud.classList.remove('on');
  hint.classList.remove('on');
  skillBtn.classList.remove('on','active','ready');
  bossWrap.classList.remove('on');
  comboHud.classList.remove('on');
  streakHudEl.style.opacity='0';
  petHud.classList.remove('on');
  pauseBtn.classList.remove('on');
  var prevBest=save.bestKills[currentLevel.id]||0;
  var isNewBest=runKills>prevBest;
  if(isNewBest)save.bestKills[currentLevel.id]=runKills;
  overlay.classList.add('on');
  overlayTitle.style.animation='none';
  void overlayTitle.offsetWidth;
  overlayTitle.style.animation='';
  if(won){
    overlayTitle.textContent='MENANG';
    overlayTitle.classList.remove('lose');
    overlayText.textContent='Poin: '+runKills+'  |  Musuh: '+runKillCount;
    spawnConfetti(['#ff6b4a','#ffc857','#3ddc97','#67c7f0','#9b6bff'],60);
  }else{
    overlayTitle.textContent='KALAH';
    overlayTitle.classList.add('lose');
    var txt='Poin: '+runKills+'  |  Musuh: '+runKillCount;
    if(isNewBest)txt+='  -  REKOR BARU!';
    overlayText.textContent=txt;
    spawnConfetti(['#9b6bff','#4a4a63','#ff77a9','#ffc857'],30);
  }
  persist();
  refreshAll();
  stopBGM();
}

function updateSkillBtn(){
  var badge=document.getElementById('skillLvBadge');
  if(appState!=='playing'&&appState!=='playingMP'){
    skillBtn.classList.remove('on','ready','active');
    skillCd.style.setProperty('--p',0);
    skillCdText.textContent='';
    if(badge)badge.textContent='';
    return;
  }
  if(!save.selectedSkill){
    skillBtn.classList.remove('on','ready','active');
    if(badge)badge.textContent='';
    return;
  }
  var sk=findSkill(save.selectedSkill);
  if(!sk){
    skillBtn.classList.remove('on','ready','active');
    if(badge)badge.textContent='';
    return;
  }
  skillBtn.classList.add('on');
  var upgLv=getUpgradeLevel('skill',sk.id);
  if(badge)badge.textContent='LV '+upgLv+'/5';
  if(skillState==='ready'){
    skillBtn.classList.add('ready');
    skillBtn.classList.remove('active');
    skillCd.style.setProperty('--p',0);
    skillCdText.textContent='';
  }else if(skillState==='active'){
    skillBtn.classList.remove('ready');
    skillBtn.classList.add('active');
    var total=activeSkillTotalDuration||1;
    var p=Math.max(0,Math.min(100,100-(activeSkillTime/total)*100));
    skillCd.style.setProperty('--p',p);
    skillCdText.textContent=activeSkillTime>0?Math.ceil(activeSkillTime):'';
  }else{
    skillBtn.classList.remove('ready','active');
    var cdTotal=(sk.cooldown*cdMultBonus*(1-0.08*upgLv))||1;
    skillCd.style.setProperty('--p',(skillCooldown/cdTotal)*100);
    skillCdText.textContent=Math.ceil(skillCooldown);
  }
}

function skillVisualBurst(upgLv,baseColor){
  var n=8+upgLv*5;
  var cx=player.x+player.width/2,cy=player.y+player.height/2;
  for(var i=0;i<n;i++){
    var a=(i/n)*Math.PI*2;
    var spd=150+upgLv*70;
    pushParticle(cx,cy,Math.cos(a)*spd,Math.sin(a)*spd,0.5+upgLv*0.1,baseColor||'#ffffff',2+upgLv*0.6);
  }
  for(var s=0;s<upgLv;s++){
    var col=['rgba(255,255,255,0.9)','rgba(255,220,140,0.9)','rgba(255,140,60,0.9)','rgba(255,80,180,0.9)','rgba(180,80,255,0.9)'][s];
    pushShockwave(cx,cy,80+s*45,col,0.5+s*0.12);
  }
}

function activateSkill(){
  if(appState!=='playing'&&appState!=='playingMP')return;
  if(!save.selectedSkill)return;
  if(skillState!=='ready')return;
  if(window.DS_MP.active&&window.DS_MP.dead)return;
  var sk=findSkill(save.selectedSkill);
  if(!sk)return;
  var upgLv=getUpgradeLevel('skill',sk.id);
  var durMult=1+0.12*upgLv;
  var powerMult=1+0.20*upgLv;
  activeSkillId=sk.id;
  skillState='active';
  activeSkillTime=sk.duration*durMult;
  activeSkillTotalDuration=activeSkillTime;
  skillVisualBurst(upgLv,'#ffe066');
  if(sk.id==='health'){player.hp=Math.min(player.maxHp,player.hp+50*powerMult);activeSkillTime=0;sfxHeal();}
  else if(sk.id==='spikes')spikesActive=true;
  else if(sk.id==='magnet')magnetActive=true;
  else if(sk.id==='freeze')freezeActive=true;
  else if(sk.id==='invincible')invincibleActive=true;
  else if(sk.id==='wipeout')wipeoutActive=true;
  else if(sk.id==='bomb'){
    var bdmg=200*powerMult;
    for(var i=enemies.length-1;i>=0;i--){
      var e=enemies[i];
      if(e.spawnT>0)continue;
      if(isNetworkGame&&e.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(e.id,bdmg);
      else{e.hp-=bdmg;e.hitFlash=0.2;}
    }
    for(var bj=0;bj<bosses.length;bj++){
      var bo=bosses[bj];
      if(bo.spawnT>0)continue;
      if(isNetworkGame&&bo.id&&window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(bo.id,bdmg);
      else{bo.hp-=bdmg;bo.hitFlash=0.2;}
    }
    triggerShake(22,0.6);
    activeSkillTime=0;
  }
  else if(sk.id==='slow')slowActive=true;
  else if(sk.id==='leech')leechActive=true;
  else if(sk.id==='rage')rageActive=true;
  else if(sk.id==='mirror')mirrorActive=true;
  else if(sk.id==='chain'){chainActive=true;chainTimer=0;}
  else if(sk.id==='voidbeam'){voidbeamActive=true;voidbeamTimer=0;}
  pushShockwave(player.x+player.width/2,player.y+player.height/2,80,'rgba(255,200,100,0.9)',0.5);
  triggerShake(6+upgLv,0.2);
  sfxBuy();
  updateSkillBtn();
}

function endSkillEffect(id){
  if(id==='spikes')spikesActive=false;
  else if(id==='magnet')magnetActive=false;
  else if(id==='freeze')freezeActive=false;
  else if(id==='invincible')invincibleActive=false;
  else if(id==='wipeout')wipeoutActive=false;
  else if(id==='slow')slowActive=false;
  else if(id==='leech')leechActive=false;
  else if(id==='rage')rageActive=false;
  else if(id==='mirror')mirrorActive=false;
  else if(id==='chain')chainActive=false;
  else if(id==='voidbeam')voidbeamActive=false;
}

function updateActiveSkill(dt){
  if(skillState==='active'){
    activeSkillTime-=dt;
    if(activeSkillTime<=0){
      var sk=findSkill(activeSkillId);
      endSkillEffect(activeSkillId);
      activeSkillId=null;
      activeSkillTime=0;
      skillState='cooldown';
      var cdBase=sk?sk.cooldown:10;
      var upgLv=sk?getUpgradeLevel('skill',sk.id):0;
      skillCooldown=cdBase*cdMultBonus*(1-0.08*upgLv);
    }
  }else if(skillState==='cooldown'){
    skillCooldown-=dt;
    if(skillCooldown<=0){skillCooldown=0;skillState='ready';}
  }
}

function syncNetworkEnemies(dt){
  if(!isNetworkGame)return;
  if(!window.DS_MP)return;
  var nowTs=Date.now();
  var cache=window.DS_MP.globalEnemiesCache||{};
  var seen={};
  for(var id in cache){
    var g=cache[id];
    if(!g)continue;
    if(g.hp<=0)continue;
    seen[id]=true;
    var local=null;
    for(var i=0;i<enemies.length;i++)if(enemies[i].id===id){local=enemies[i];break;}
    if(!local){
      var def=ENEMY_TYPES[g.type];
      if(!def)continue;
      var w=BASE_SIZE*def.size;
      var lifeSec=(nowTs-(g.spawnTime||nowTs))/1000;
      var curY=(g.startY!==undefined?g.startY:edgeTop())+lifeSec*(def.speed||0);
      if(curY>edgeBottom()+80)continue;
      local={
        id:id,type:g.type,x:g.x,y:curY,width:w,height:w,
        hp:g.hp,maxHp:g.maxHp||g.hp,damage:g.damage||def.damage,
        shootType:def.shootType,fireRate:def.fireRate,
        fireTimer:1/def.fireRate*(0.4+Math.random()*0.6),
        color:def.color,dark:def.dark,speed:def.speed,projSpeed:def.projSpeed||0,
        spread:def.spread||0,orbit:def.orbit||false,splits:def.splits||0,
        orbitPhase:Math.random()*6.283,orbitRadius:30+Math.random()*60,
        baseX:g.x,spiralAngle:0,hitFlash:0,spawnT:0,
        poisonTime:0,poisonDPS:0,shape:g.shape||'square',shapeKp:1,
        heavenlyState:'ready',heavenlyTimer:2,heavenlyOrbs:8,orbAngle:Math.random()*6.283,
        isMiniBoss:!!g.isMiniBoss,
        _netSpawnTime:g.spawnTime||nowTs,
        _netStartY:g.startY!==undefined?g.startY:edgeTop()
      };
      enemies.push(local);
    }else{
      local.hp=g.hp;
      local.maxHp=g.maxHp||local.maxHp;
      local.x=g.x;
      var lifeSec2=(nowTs-(g.spawnTime||nowTs))/1000;
      var def2=ENEMY_TYPES[g.type];
      if(def2)local.y=(g.startY!==undefined?g.startY:edgeTop())+lifeSec2*(def2.speed||0);
    }
  }
  for(var ei=enemies.length-1;ei>=0;ei--){
    if(enemies[ei]._netSpawnTime&&!seen[enemies[ei].id])enemies.splice(ei,1);
  }
  var bossCache=window.DS_MP.globalBossesCache||{};
  var seenB={};
  for(var bid in bossCache){
    var gb=bossCache[bid];
    if(!gb)continue;
    seenB[bid]=true;
    var lb=null;
    for(var bi=0;bi<bosses.length;bi++)if(bosses[bi].id===bid){lb=bosses[bi];break;}
    if(!lb){
      if(gb.hp<=0)continue;
      var bdef=BOSS_TYPES[gb.idx%BOSS_TYPES.length];
      if(!bdef)continue;
      var bw=BASE_SIZE*bdef.size;
      var nb={
        id:bid,idx:gb.idx%BOSS_TYPES.length,name:bdef.name,
        x:gb.x,y:gb.y,width:bw,height:bw,hp:gb.hp,maxHp:gb.maxHp||gb.hp,
        baseX:gb.baseX||gb.x,moveRange:gb.moveRange||bdef.moveRange,
        phase:gb.phase||Math.random()*6.283,speed:gb.speed||bdef.speed,
        attackCycle:bdef.cycle,attackIdx:0,shootInterval:bdef.shootInterval,
        fireTimer:1.4,gatling:0,gatlingTimer:0,spawnT:0,hitFlash:0,
        color:bdef.color,dark:bdef.dark,spiralAngle:0,
        bossNumber:1,poisonTime:0,poisonDPS:0,_net:true
      };
      bosses.push(nb);
      bossWrap.classList.add('on');
      bossName.textContent=bdef.name;
    }else{
      lb.hp=gb.hp;
      lb.maxHp=gb.maxHp||lb.maxHp;
      lb.x=gb.x;
      lb.baseX=gb.baseX||lb.baseX;
    }
  }
  for(var bi2=bosses.length-1;bi2>=0;bi2--){
    var lb2=bosses[bi2];
    if(lb2._net&&!seenB[lb2.id]){
      if(!lb2._credited)killBoss(lb2);
      bosses.splice(bi2,1);
    }
  }
  if(bosses.length===0)bossWrap.classList.remove('on');
}

function pauseGame(){
  if(window.DS_MP.active)return;
  if(appState!=='playing')return;
  paused=true;
  appState='paused';
  var pm=document.getElementById('pauseModal');
  if(pm)pm.classList.add('on');
  stopBGM();
  sfxClick();
}
function resumeGame(){
  if(appState!=='paused')return;
  paused=false;
  appState='playing';
  var pm=document.getElementById('pauseModal');
  if(pm)pm.classList.remove('on');
  if(save.bgmOn)startBGM();
  sfxClick();
}
function quitToMenu(){
  appState='transitioning';
  var pm=document.getElementById('pauseModal');
  if(pm)pm.classList.remove('on');
  goScreen('level','levelSelect');
  sfxClick();
}

function loop(ts){
  requestAnimationFrame(loop);
  var dt=(loop.lastTs?(ts-loop.lastTs)/1000:0.016);
  loop.lastTs=ts;
  if(dt>0.05)dt=0.05;
  elapsedTotal+=dt;
  updateAmbient(dt);
  if(appState==='playing'||appState==='playingMP'){
    if(window.DS_MP.active&&window.DS_MP.dead){
      if(window.DS_MP.onTickDead)window.DS_MP.onTickDead(dt);
    }else{
      elapsed+=dt;
      if(isNetworkGame){
        syncNetworkEnemies(dt);
      }
      if(!currentLevel.isFinal&&!currentLevel.isEndless){
        if(!winShown){
          if(!isNetworkGame||amHost()){
            if(elapsed>=nextBossTime&&currentLevel.bossInterval<999){
              nextBossTime+=currentLevel.bossInterval;
              if(currentLevel.bossesCanStack||bosses.length===0)spawnBoss();
            }
            if(elapsed>=nextMiniBossTime){nextMiniBossTime+=25;spawnMiniBoss();}
            if(currentLevel.id!==0&&elapsed>=SIDE_LASER_START_TIME&&obstacleLasers.length===0)spawnObstacleLasers();
          }
          if(bosses.length===0&&elapsed-lastWaveShownAt>=20&&elapsed>3){
            lastWaveShownAt=elapsed;
            showWaveBanner('WAVE '+Math.floor(elapsed/20));
          }
        }
      }else if(currentLevel.isEndless){
        if(!winShown&&(!isNetworkGame||amHost())){
          if(elapsed>=nextBossTime){nextBossTime+=currentLevel.bossInterval;spawnBoss();}
          if(elapsed>=nextMiniBossTime){nextMiniBossTime+=25;spawnMiniBoss();}
        }
        if(bosses.length===0&&elapsed-lastWaveShownAt>=20&&elapsed>3){
          lastWaveShownAt=elapsed;
          showWaveBanner('WAVE '+Math.floor(elapsed/20));
        }
      }
      upgradeManager();
      spawnManager(dt);
      firePlayer(dt);
      updateActiveSkill(dt);
      updateChainLightning(dt);
      updateVoidbeam(dt);
      updatePlayerPoison(dt);
      updatePet(dt);
      updateEnemies(dt);
      updateBosses(dt);
      updatePlayerProjectiles(dt);
      updateEnemyProjectiles(dt);
      updateLasers(dt);
      updateObstacleLasers(dt);
      updateHealBubbles(dt);
      updateBoostBubbles(dt);
      updateBombBubbles(dt);
      updatePowerups(dt);
      updateParticles(dt);
      updateShockwaves(dt);
      updateThruster(dt);
      updateShipFx(dt);
      if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)resetCombo();}
      if(streakTimer>0){streakTimer-=dt;if(streakTimer<=0){streakKillCount=0;streakLevel=0;lastStreakLabel='';}}
      if(regenBonus>0&&player.hp<player.maxHp)player.hp=Math.min(player.maxHp,player.hp+regenBonus*dt);
      var elLeft=edgeLeft(),elRight=edgeRight();
      if(player.x<elLeft)player.x=elLeft;
      if(player.x+player.width>elRight)player.x=elRight-player.width;
      if(player.hp<prevHp)flashTime=0.18;
      prevHp=player.hp;
      if(shakeTime>0)shakeTime-=dt;
      if(flashTime>0)flashTime-=dt;
      if(tierFlash>0)tierFlash-=dt;
      if(killFlash>0)killFlash-=dt;
      updateSkillBtn();
      updatePuHud();
      updateComboHud();
      updateHud();
      updatePetHud();
      if(player.hp<=0){
        player.hp=0;
        updateHud();
        endGame(false);
      }else if(!currentLevel.isEndless&&!currentLevel.isFinal&&isFinite(currentLevel.duration)&&elapsed>=currentLevel.duration&&!winShown){
        if(!isNetworkGame||amHost()){
          showWinModal();
        }else{
          winShown=true;
          appState='waitingHost';
          showWaveBanner('MENUNGGU HOST...',true);
        }
      }
    }
  }else if(appState==='waitingHost'){
    updateParticles(dt);
    updateShockwaves(dt);
  }else{
    updateParticles(dt);
    updateShockwaves(dt);
    if(tierFlash>0)tierFlash-=dt;
  }
  if(appState==='shopMenu'&&shopPreviewCanvas)renderShopPreview(dt);
  ctx.save();
  if((appState==='playing'||appState==='playingMP')&&shakeTime>0){
    var m=shakeMag*(shakeTime/0.3);
    ctx.translate((Math.random()-0.5)*m,(Math.random()-0.5)*m);
  }
  ctx.drawImage(bgCanvas,0,0);
  drawAmbient();
  if(appState==='playing'||appState==='playingMP'||appState==='ended'||appState==='paused'||appState==='waitingHost'){
    drawHealBubbles();
    drawBoostBubbles();
    drawBombBubbles();
    drawPowerups();
    drawLasers();
    drawObstacleLasers();
    drawEnemies();
    drawBosses();
    if(window.DS_MP.active&&window.DS_MP.drawOtherPlayers)window.DS_MP.drawOtherPlayers();
    drawProjectiles();
    if(!(window.DS_MP.active&&window.DS_MP.dead)){drawPet();drawPlayer();}
  }
  drawShockwaves();
  drawParticles();
  if(appState==='playing'||appState==='playingMP')drawFlash();
  ctx.restore();
}

canvas.addEventListener('touchstart',function(ev){
  if(appState!=='playing'&&appState!=='playingMP')return;
  if(window.DS_MP.active&&window.DS_MP.dead)return;
  dragging=true;
  lastTouchX=ev.touches[0].clientX;
},{passive:true});
canvas.addEventListener('touchmove',function(ev){
  if(!dragging)return;
  if(appState!=='playing'&&appState!=='playingMP')return;
  if(window.DS_MP.active&&window.DS_MP.dead)return;
  var x=ev.touches[0].clientX;
  player.x+=x-lastTouchX;
  lastTouchX=x;
  var elLeft=edgeLeft(),elRight=edgeRight();
  if(player.x<elLeft)player.x=elLeft;
  if(player.x+player.width>elRight)player.x=elRight-player.width;
},{passive:true});
canvas.addEventListener('touchend',function(){dragging=false;});
canvas.addEventListener('touchcancel',function(){dragging=false;});
canvas.addEventListener('mousedown',function(ev){
  if(appState!=='playing'&&appState!=='playingMP')return;
  if(window.DS_MP.active&&window.DS_MP.dead)return;
  dragging=true;
  lastTouchX=ev.clientX;
});
window.addEventListener('mousemove',function(ev){
  if(!dragging)return;
  if(appState!=='playing'&&appState!=='playingMP')return;
  if(window.DS_MP.active&&window.DS_MP.dead)return;
  player.x+=ev.clientX-lastTouchX;
  lastTouchX=ev.clientX;
  var elLeft=edgeLeft(),elRight=edgeRight();
  if(player.x<elLeft)player.x=elLeft;
  if(player.x+player.width>elRight)player.x=elRight-player.width;
});
window.addEventListener('mouseup',function(){dragging=false;});

var WIPE_MS=380,wipeLock=false;
function playWipe(direction,onCovered,onDone){
  if(wipeLock){if(onCovered)onCovered();if(onDone)onDone();return;}
  wipeLock=true;
  var inX=(direction==='left')?'-100vw':'100vw';
  var outX=(direction==='left')?'100vw':'-100vw';
  wipeEl.style.transition='none';
  wipeEl.style.transform='translateX('+inX+')';
  void wipeEl.offsetWidth;
  wipeEl.style.transition='transform '+WIPE_MS+'ms cubic-bezier(.65,0,.35,1)';
  wipeEl.style.transform='translateX(0)';
  setTimeout(function(){
    if(onCovered)onCovered();
    setTimeout(function(){
      wipeEl.style.transform='translateX('+outX+')';
      setTimeout(function(){
        wipeEl.style.transition='none';
        wipeEl.style.transform='translateX('+inX+')';
        wipeLock=false;
        if(onDone)onDone();
      },WIPE_MS);
    },80);
  },WIPE_MS);
}

var dom={
  hpFill:document.getElementById('hpFill'),timerText:document.getElementById('timerText'),
  lvlText:document.getElementById('lvlText'),gameKills:document.getElementById('gameKills'),
  puHud:document.getElementById('puHud'),comboHud:document.getElementById('comboHud'),
  bossWrap:document.getElementById('bossWrap'),bossName:document.getElementById('bossName'),
  bossFill:document.getElementById('bossFill'),waveBanner:document.getElementById('waveBanner'),
  achToast:document.getElementById('achToast'),achToastName:document.getElementById('achToastName'),
  overlay:document.getElementById('overlay'),overlayTitle:document.getElementById('overlayTitle'),
  overlayText:document.getElementById('overlayText'),confettiLayer:document.getElementById('confettiLayer'),
  hud:document.getElementById('hud'),hint:document.getElementById('hint'),
  skillBtn:document.getElementById('skillBtn'),skillCd:document.getElementById('skillCd'),
  skillCdText:document.getElementById('skillCdText'),wipeEl:document.getElementById('wipe'),
  killLine:document.getElementById('killLine'),
  menuScreen:document.getElementById('menuScreen'),levelScreen:document.getElementById('levelScreen'),
  shopScreen:document.getElementById('shopScreen'),achScreen:document.getElementById('achScreen'),
  statsScreen:document.getElementById('statsScreen'),helpScreen:document.getElementById('helpScreen'),
  voucherScreen:document.getElementById('voucherScreen'),spinScreen:document.getElementById('spinScreen'),
  mpScreen:document.getElementById('mpScreen'),mpLobbyScreen:document.getElementById('mpLobbyScreen'),
  challengeScreen:document.getElementById('challengeScreen'),leaderScreen:document.getElementById('leaderScreen'),
  friendsScreen:document.getElementById('friendsScreen'),
  voucherInput:document.getElementById('voucherInput'),voucherEnter:document.getElementById('voucherEnter'),
  voucherBack:document.getElementById('voucherBack'),voucherMsg:document.getElementById('voucherMsg'),
  voucherTotal:document.getElementById('voucherTotal'),
  levelsGrid:document.getElementById('levelsGrid'),chapterTabs:document.getElementById('chapterTabs'),
  shopTabs:document.getElementById('shopTabs'),shopList:document.getElementById('shopList'),
  achList:document.getElementById('achList'),
  pKills:document.getElementById('pKills'),pBoss:document.getElementById('pBoss'),
  pAch:document.getElementById('pAch'),pShips:document.getElementById('pShips'),
  killsHeader:document.getElementById('killsHeader'),killsShop:document.getElementById('killsShop'),
  killsAch:document.getElementById('killsAch'),killsStats:document.getElementById('killsStats'),
  killsSpin:document.getElementById('killsSpin'),killsMP:document.getElementById('killsMP'),
  killsMPLobby:document.getElementById('killsMPLobby'),killsChallenge:document.getElementById('killsChallenge'),
  achCount:document.getElementById('achCount'),achKills:document.getElementById('achKills'),
  achBoss:document.getElementById('achBoss'),achCombo:document.getElementById('achCombo'),
  stKills:document.getElementById('stKills'),stTotalKills:document.getElementById('stTotalKills'),
  stBoss:document.getElementById('stBoss'),stHard:document.getElementById('stHard'),
  stExpert:document.getElementById('stExpert'),stNightmare:document.getElementById('stNightmare'),
  stImpossible:document.getElementById('stImpossible'),stCombo:document.getElementById('stCombo'),
  stAch:document.getElementById('stAch'),stTrophy:document.getElementById('stTrophy'),
  stEndless:document.getElementById('stEndless'),stCollection:document.getElementById('stCollection'),
  stCleared:document.getElementById('stCleared'),
  volSlider:document.getElementById('volSlider'),bgmSlider:document.getElementById('bgmSlider'),
  bgmSwitch:document.getElementById('bgmSwitch'),shakeSlider:document.getElementById('shakeSlider'),
  resetAll:document.getElementById('resetAll'),shopSub:document.getElementById('shopSub'),
  achSub:document.getElementById('achSub'),manualSave:document.getElementById('manualSave'),
  confirmModal:document.getElementById('confirmModal'),confirmMsg:document.getElementById('confirmMsg'),
  confirmYes:document.getElementById('confirmYes'),confirmNo:document.getElementById('confirmNo'),
  shopPreview:document.getElementById('shopPreview'),skillTestBtn:document.getElementById('skillTestBtn'),
  menuPlayerName:document.getElementById('menuPlayerName'),menuPlayerLevel:document.getElementById('menuPlayerLevel'),
  menuXpFill:document.getElementById('menuXpFill'),menuXpText:document.getElementById('menuXpText'),
  menuTrophyCount:document.getElementById('menuTrophyCount'),menuRankText:document.getElementById('menuRankText'),
  menuShipPreview:document.getElementById('menuShipPreview'),menuGear:document.getElementById('menuGear'),
  mpLevelBadge:document.getElementById('mpLevelBadge'),mpLevelNum:document.getElementById('mpLevelNum'),
  mpXpFill:document.getElementById('mpXpFill'),mpXpText:document.getElementById('mpXpText'),
  loadingOverlay:document.getElementById('loadingOverlay'),
  endlessModeCard:document.getElementById('endlessModeCard'),endlessBest:document.getElementById('endlessBest'),
  chNoHitBest:document.getElementById('chNoHitBest'),chPistolBest:document.getElementById('chPistolBest'),
  chSpeedBest:document.getElementById('chSpeedBest'),chBossBest:document.getElementById('chBossBest'),
  mpGlobalKills:document.getElementById('mpGlobalKills'),mpGlobalPlayers:document.getElementById('mpGlobalPlayers'),
  mpGlobalStats:document.getElementById('mpGlobalStats'),
  onboardModal:document.getElementById('nameOnboardingModal'),
  onboardInput:document.getElementById('onboardNameInput'),
  onboardSaveBtn:document.getElementById('onboardSaveBtn'),
  onboardHint:document.getElementById('onboardHint')
};

var hpFill=dom.hpFill,timerText=dom.timerText,lvlText=dom.lvlText,gameKills=dom.gameKills;
var puHud=dom.puHud,comboHud=dom.comboHud,bossWrap=dom.bossWrap,bossName=dom.bossName,bossFill=dom.bossFill;
var waveBanner=dom.waveBanner,achToast=dom.achToast,achToastName=dom.achToastName;
var overlay=dom.overlay,overlayTitle=dom.overlayTitle,overlayText=dom.overlayText,confettiLayer=dom.confettiLayer;
var hud=dom.hud,hint=dom.hint,skillBtn=dom.skillBtn,skillCd=dom.skillCd,skillCdText=dom.skillCdText,wipeEl=dom.wipeEl;
var petHud=document.getElementById('petHud');
var pauseBtn=document.getElementById('pauseBtn');

shopPreviewCanvas=dom.shopPreview;
if(shopPreviewCanvas)shopPreviewCtx=shopPreviewCanvas.getContext('2d');

var shopTab='gun';
var currentChapterTab=1;

function refreshHeaderKills(){
  var k=save.kills.toLocaleString('id-ID');
  if(dom.killsHeader)dom.killsHeader.textContent=k;
  if(dom.killsShop)dom.killsShop.textContent=k;
  if(dom.killsAch)dom.killsAch.textContent=k;
  if(dom.killsStats)dom.killsStats.textContent=k;
  if(dom.killsSpin)dom.killsSpin.textContent=k;
  if(dom.killsMP)dom.killsMP.textContent=k;
  if(dom.killsMPLobby)dom.killsMPLobby.textContent=k;
  if(dom.killsChallenge)dom.killsChallenge.textContent=k;
}

function achDone(){var c=0;for(var i=0;i<ACHIEVEMENTS.length;i++)if(save.achievements[ACHIEVEMENTS[i].id])c++;return c;}

function refreshProfile(){
  dom.pKills.textContent=save.kills.toLocaleString('id-ID');
  dom.pBoss.textContent=save.bossKills;
  dom.pAch.textContent=achDone()+'/'+ACHIEVEMENTS.length;
  dom.pShips.textContent=save.ships.length+'/'+SHIPS.length;
  dom.achSub.textContent=achDone()+'/'+ACHIEVEMENTS.length;
  dom.shopSub.textContent=save.kills.toLocaleString('id-ID')+' poin';
  if(dom.endlessBest)dom.endlessBest.textContent=save.endlessBest.toLocaleString('id-ID');
  if(dom.chNoHitBest)dom.chNoHitBest.textContent=(save.challengeBests.nohit||0).toLocaleString('id-ID');
  if(dom.chPistolBest)dom.chPistolBest.textContent=(save.challengeBests.pistol||0).toLocaleString('id-ID');
  if(dom.chSpeedBest)dom.chSpeedBest.textContent=(save.challengeBests.speed||0)+(save.challengeBests.speed?'s':'-');
  if(dom.chBossBest)dom.chBossBest.textContent=(save.challengeBests.bossrush||0).toLocaleString('id-ID');
  var fCount=0;for(var fk in save.friends)if(save.friends[fk])fCount++;
  var fEl=document.getElementById('friendCount');
  if(fEl)fEl.textContent=fCount;
}

function updateMenuCard(){
  if(dom.menuPlayerName)dom.menuPlayerName.textContent=(save.playerName||'PLAYER').toUpperCase();
  if(dom.menuPlayerLevel)dom.menuPlayerLevel.textContent='LV '+save.level;
  if(dom.menuTrophyCount)dom.menuTrophyCount.textContent=save.trophies;
  var needed=xpNeededForLevel(save.level);
  if(dom.menuXpFill&&dom.menuXpText){
    var pct=needed>0?Math.min(100,(save.xp/needed)*100):100;
    dom.menuXpFill.style.width=pct+'%';
    dom.menuXpText.textContent=save.xp+'/'+(needed||'MAX');
  }
  var cv=dom.menuShipPreview;
  if(cv){
    var ctx2=cv.getContext('2d');
    ctx2.clearRect(0,0,cv.width,cv.height);
    var ship=findShip(save.selectedShip);
    var shape=findShape(save.selectedShape);
    drawShipCentered(ctx2,ship,shape,cv.width,cv.height,{glow:true,glowAlpha:0.6,zoom:0.92});
  }
}

function updateMPLevelBadge(){
  if(!dom.mpLevelBadge)return;
  var needed=xpNeededForLevel(save.level);
  if(dom.mpLevelNum)dom.mpLevelNum.textContent='LV '+save.level;
  if(dom.mpXpFill){var pct=needed>0?Math.min(100,(save.xp/needed)*100):100;dom.mpXpFill.style.width=pct+'%';}
  if(dom.mpXpText){
    var t=save.xp+'/'+(needed||'MAX');
    if(t!==mpBadgeXpText){mpBadgeXpText=t;dom.mpXpText.textContent=t;}
  }
}

function drawShipCentered(g,ship,shape,boxW,boxH,opts){
  opts=opts||{};
  var key=ship.id+'_'+shape.id;
  var set=playerSpriteCache[key];
  if(!set)return;
  var spr=set.normal.canvas;
  var scale=Math.min(boxW/spr.width,boxH/spr.height)*(opts.zoom||1);
  var dw=spr.width*scale,dh=spr.height*scale;
  var dx=(boxW-dw)/2;
  var dy=(boxH-dh)/2+(opts.offsetY||0);
  if(opts.glow){
    var glow=playerGlowCache[ship.id];
    if(glow){
      g.save();g.globalAlpha=opts.glowAlpha||0.55;
      var gs=glow.R*2*scale;
      g.drawImage(glow.normal.canvas,(boxW-gs)/2,(boxH-gs)/2+(opts.offsetY||0),gs,gs);
      g.restore();
    }
  }
  g.save();
  if(opts.alpha!==undefined)g.globalAlpha=opts.alpha;
  g.drawImage(spr,dx,dy,dw,dh);
  g.restore();
}

function formatDuration(d){if(!isFinite(d))return 'Tanpa batas waktu';return d+' detik';}

function renderLevels(){
  var tabs=dom.chapterTabs.querySelectorAll('.chapter-tab');
  for(var t=0;t<tabs.length;t++){
    var ch=Number(tabs[t].getAttribute('data-chapter'));
    tabs[t].classList.toggle('on',ch===currentChapterTab);
    tabs[t].classList.toggle('locked',!isChapterUnlocked(ch));
  }
  var html='';
  var list=[];
  for(var i=0;i<LEVELS.length;i++){
    if(LEVELS[i].isEndless)continue;
    if(LEVELS[i].chapter===currentChapterTab)list.push(LEVELS[i]);
  }
  for(var j=0;j<list.length;j++){
    var L=list[j];
    var unlocked=isLevelUnlocked(L.id);
    var canUnlock=!unlocked&&save.kills>=L.unlockCost;
    var cls='level-card '+L.cardClass;
    if(!unlocked&&!canUnlock)cls+=' locked';
    var badge='';
    if(save.noHitFlags[L.id])badge='<div class="lc-badge gold">TANPA LUKA</div>';
    else if(save.winFlags[L.id])badge='<div class="lc-badge">TUNTAS</div>';
    if(L.isFinal)badge='<div class="lc-badge pink">FINAL</div>';
    var best=save.bestKills[L.id]||0;
    html+='<div class="'+cls+'" data-level="'+L.id+'">';
    html+='<div class="lc-name">'+L.name+(unlocked?'':' [TERKUNCI]')+'</div>';
    html+='<div class="lc-time">'+formatDuration(L.duration)+' | Spawn x'+L.spawnRateMult+' | HP x'+L.hpMult+' | DMG x'+L.dmgMult+'</div>';
    if(unlocked){
      html+='<div class="lc-best"><svg viewBox="0 0 24 24"><path d="M12 2C7.03 2 3 6.03 3 11c0 2.4 1 4.6 2.5 6.2V21c0 .55.45 1 1 1h11c.55 0 1-.45 1-1v-3.8C20 15.6 21 13.4 21 11c0-4.97-4.03-9-9-9z"/></svg>Best Kill: '+best.toLocaleString('id-ID')+'</div>';
    }else{
      html+='<div class="lc-lock">Buka: '+L.unlockCost.toLocaleString('id-ID')+' poin</div>';
    }
    html+=badge;
    html+='</div>';
  }
  dom.levelsGrid.innerHTML=html;
  var cards=dom.levelsGrid.querySelectorAll('.level-card');
  for(var c=0;c<cards.length;c++){
    cards[c].addEventListener('click',function(){
      initAudio();
      var idx=Number(this.getAttribute('data-level'));
      var L=LEVELS[idx];
      if(!isLevelUnlocked(L.id)){
        if(save.kills<L.unlockCost){showToast('Poin tidak cukup. Butuh '+L.unlockCost.toLocaleString('id-ID')+' poin.','error');return;}
        showConfirm('Buka tingkat '+L.name+' dengan '+L.unlockCost.toLocaleString('id-ID')+' poin?',function(){
          if(save.kills<L.unlockCost)return;
          save.kills-=L.unlockCost;
          unlockLevel(L.id);
          sfxUnlock();
          killDirty=true;
          persist();
          refreshHeaderKills();
          refreshProfile();
          renderLevels();
          showToast('Tingkat '+L.name+' terbuka!','success');
        });
        return;
      }
      sfxClick();
      currentChallenge=null;
      if(window.DS_MP.active||window.DS_MP.networkMode){
        window.DS_MP.active=false;
        window.DS_MP.networkMode=false;
        window.DS_MP.globalMode=false;
        window.DS_MP.dead=false;
        window.DS_MP.isGlobalHost=false;
        window.DS_MP.isHost=false;
      }
      isNetworkGame=false;
      startLevel(L,false);
    });
  }
  if(dom.endlessModeCard){
    dom.endlessModeCard.onclick=function(){
      initAudio();sfxClick();
      currentChallenge=null;
      if(window.DS_MP.active||window.DS_MP.networkMode){
        window.DS_MP.active=false;
        window.DS_MP.networkMode=false;
        window.DS_MP.globalMode=false;
        window.DS_MP.dead=false;
        window.DS_MP.isGlobalHost=false;
        window.DS_MP.isHost=false;
      }
      isNetworkGame=false;
      var L=null;
      for(var k=0;k<LEVELS.length;k++)if(LEVELS[k].isEndless){L=LEVELS[k];break;}
      if(L)startLevel(L,false);
    };
  }
}

function renderUpgradePips(lv){
  var html='<div class="upg-bar">';
  for(var i=0;i<MAX_UPGRADE_LEVEL;i++)html+='<div class="upg-pip'+(i<lv?' on':'')+'"></div>';
  html+='</div>';
  return html;
}

function shipSvgIcon(item,size){
  size=size||34;var s=size;
  return '<svg viewBox="0 0 40 40" width="'+s+'" height="'+s+'"><rect x="4" y="4" width="32" height="32" rx="6" fill="'+item.edge+'" stroke="#242438" stroke-width="1.5"/><path d="M20 8 L26 18 L32 22 L28 30 L12 30 L8 22 L14 18 Z" fill="'+item.body+'" stroke="#242438" stroke-width="1.2"/><circle cx="20" cy="17" r="3.6" fill="'+item.cockpit+'" stroke="#242438" stroke-width="0.8"/><circle cx="19" cy="16" r="1.2" fill="#ffffff" opacity="0.9"/><rect x="14" y="30" width="3" height="3" fill="#eaff8f"/><rect x="23" y="30" width="3" height="3" fill="#eaff8f"/></svg>';
}

function shapeSvgIcon(item,size){
  size=size||34;var s=size;var body='#8a8a9a',cockpit='#e8e8f0';var shape=item.id;var path='';
  if(shape==='triangle')path='<polygon points="20,6 34,34 6,34" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='circleShape')path='<circle cx="20" cy="20" r="14" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='pentagon')path='<polygon points="20,4 36,14 30,34 10,34 4,14" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='hexagon')path='<polygon points="20,5 33,12 33,28 20,35 7,28 7,12" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='octagon')path='<polygon points="14,4 26,4 36,14 36,26 26,36 14,36 4,26 4,14" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='diamondShape')path='<polygon points="20,5 35,20 20,35 5,20" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='star')path='<polygon points="20,4 24,15 36,15 26,23 30,35 20,28 10,35 14,23 4,15 16,15" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='cross')path='<path d="M14 4h12v10h10v12H26v10H14V26H4V14h10z" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='arrow')path='<polygon points="20,4 36,20 26,20 26,36 14,36 14,20 4,20" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='gear')path='<path d="M20 4l3 4h6l2 5 5 3v6l-5 3-2 5h-6l-3 4-3-4h-6l-2-5-5-3v-6l5-3 2-5h6z" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='crystal')path='<polygon points="20,4 32,14 28,34 12,34 8,14" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='shieldShape')path='<path d="M20 4l14 6v10c0 10-6 14-14 16-8-2-14-6-14-16V10z" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='complex')path='<polygon points="20,4 26,12 36,12 28,20 34,32 20,26 6,32 12,20 4,12 14,12" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else if(shape==='heart')path='<path d="M20 34C20 34 6 24 6 15c0-5 4-8 8-8 3 0 5 2 6 4 1-2 3-4 6-4 4 0 8 3 8 8 0 9-14 19-14 19z" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  else path='<rect x="7" y="7" width="26" height="26" rx="5" fill="'+body+'" stroke="#242438" stroke-width="1.2"/>';
  return '<svg viewBox="0 0 40 40" width="'+s+'" height="'+s+'">'+path+'<circle cx="20" cy="18" r="3" fill="'+cockpit+'" stroke="#242438" stroke-width="0.6"/></svg>';
}

function petSvgIcon(item,size){
  size=size||34;
  var spr=petSpriteCache[item.id];
  if(!spr)return ICONS[item.icon]||ICONS.star;
  return '<img src="'+spr.canvas.toDataURL()+'" style="width:'+size+'px;height:'+size+'px;">';
}

function renderShopPreview(dt){
  if(!shopPreviewCtx||!shopPreviewCanvas)return;
  var cw=shopPreviewCanvas.width,ch=shopPreviewCanvas.height;
  if(cw<=0||ch<=0)return;
  var g=shopPreviewCtx;
  var grad=g.createLinearGradient(0,0,0,ch);
  grad.addColorStop(0,'#bae6fd');
  grad.addColorStop(0.6,'#e0f2fe');
  grad.addColorStop(1,'#fffaf0');
  g.fillStyle=grad;
  g.fillRect(0,0,cw,ch);
  g.fillStyle='rgba(255,255,255,0.5)';
  for(var y=20;y<ch;y+=28)for(var x=20;x<cw;x+=28)g.fillRect(x,y,2,2);
  var ship=findShip(save.selectedShip);
  var shape=findShape(save.selectedShape);
  var key=ship.id+'_'+shape.id;
  var spriteSet=playerSpriteCache[key]||playerSpriteCache[ship.id+'_square']||playerSpriteCache['default_square'];
  if(!spriteSet)return;
  var cx=cw/2,cy=ch*0.65;
  var targetCx=cw*0.5+(Math.sin(elapsedTotal*0.8)*cw*0.2);
  var px=targetCx;
  shopPreviewFiring+=dt;
  if(shopPreviewFiring>=0.12){
    shopPreviewFiring=0;
    var sprite=playerProjSpriteCache[save.selectedGun]||playerProjSpriteCache.bullet;
    if(!shopPreviewAnim)shopPreviewAnim=[];
    shopPreviewAnim.push({x:px,y:cy-20,vy:-360,life:1.2,maxLife:1.2,sprite:sprite});
    if(shopPreviewAnim.length>30)shopPreviewAnim.shift();
  }
  var gun=findGun(save.selectedGun);
  var dmg=PLAYER_TIERS[5].dmg*gun.dmgMult;
  g.save();
  g.globalAlpha=0.9;
  var glowShip=playerGlowCache[ship.id]||playerGlowCache['default'];
  g.drawImage(glowShip.normal.canvas,px-glowShip.R*0.7,cy-glowShip.R*0.7,glowShip.R*1.4,glowShip.R*1.4);
  g.restore();
  var sprite2=spriteSet.normal;
  var scale=0.75;
  g.drawImage(sprite2.canvas,px-sprite2.canvas.width*scale/2,cy-sprite2.canvas.height*scale/2,sprite2.canvas.width*scale,sprite2.canvas.height*scale);
  if(shopPreviewAnim){
    for(var i=shopPreviewAnim.length-1;i>=0;i--){
      var p=shopPreviewAnim[i];
      p.life-=dt;
      p.y+=p.vy*dt;
      if(p.life<=0){shopPreviewAnim.splice(i,1);continue;}
      var a=p.life/p.maxLife;
      g.save();
      g.globalAlpha=a;
      g.drawImage(p.sprite.canvas,p.x-p.sprite.cx*0.7,p.y-p.sprite.cy*0.7,p.sprite.canvas.width*0.7,p.sprite.canvas.height*0.7);
      g.restore();
    }
  }
  if(save.selectedPet){
    var pSpr=petSpriteCache[save.selectedPet];
    if(pSpr){
      g.save();
      g.globalAlpha=0.9;
      g.drawImage(pSpr.canvas,cw-60-pSpr.cx*0.7,ch-50-pSpr.cy*0.7,pSpr.canvas.width*0.7,pSpr.canvas.height*0.7);
      g.restore();
    }
  }
  g.save();
  g.globalAlpha=0.85;
  g.font='bold 11px Fredoka,sans-serif';
  g.fillStyle='#4a4a63';
  g.textAlign='left';
  g.fillText(ship.name+' / '+shape.name,10,18);
  g.textAlign='right';
  g.fillStyle='#ff6b4a';
  g.fillText('DMG '+dmg.toFixed(1),cw-10,18);
  g.restore();
}

function renderShop(){
  var html='';
  var i,item,owned,equipped,canBuy,cls,upgLv,upgCost,canUpg,maxed,isDefault,chOK;
  if(shopTab==='gun'){
    for(i=0;i<GUNS.length;i++){
      item=GUNS[i];owned=ownedGun(item.id);equipped=save.selectedGun===item.id;
      isDefault=isDefaultItem('gun',item.id);chOK=canBuyByChapter(item.chapter);
      upgLv=isDefault?0:getUpgradeLevel('gun',item.id);
      maxed=!isDefault&&upgLv>=MAX_UPGRADE_LEVEL;
      upgCost=maxed?0:(isDefault?0:nextUpgradeCost(item.cost,upgLv));
      canUpg=!isDefault&&!maxed&&save.kills>=upgCost;
      cls='shop-row';
      if(equipped)cls+=' selected';else if(owned)cls+=' owned';
      if(isDefault)cls+=' default-lock';if(!chOK)cls+=' chapter-lock';
      html+='<div class="'+cls+'"><div class="shop-icon">'+ICONS[item.icon]+'</div><div class="shop-info">';
      if(isDefault)html+='<div class="shop-name">'+item.name+'<span class="upg-lv default">DEFAULT</span></div>';
      else html+='<div class="shop-name">'+item.name+(owned?'<span class="upg-lv">LV '+upgLv+'/5</span>':'')+'</div>';
      html+='<div class="shop-desc">'+item.desc+'</div>';
      html+='<div class="shop-meta">DMG x'+item.dmgMult+' | SPD x'+item.speedMult+' | RoF x'+item.rofMult+'</div>';
      if(!chOK)html+='<div class="shop-stat" style="color:#c93a3a;">Terbuka di Bab '+item.chapter+'</div>';
      if(owned&&!isDefault){var gB=getGunUpgradeBonus(item.id);html+='<div class="shop-stat">Total: +'+Math.round((gB.dmgMult-1)*100)+'% DMG, +'+Math.round((gB.rofMult-1)*100)+'% RoF</div>';html+=renderUpgradePips(upgLv);}
      html+='</div><div class="shop-action">';
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+item.cost+'</span></div><button class="shop-btn buy" data-type="gun" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
      else{
        if(equipped)html+='<button class="shop-btn used" disabled>DIPAKAI</button>';
        else html+='<button class="shop-btn eq" data-type="gun" data-id="'+item.id+'" data-act="equip">PAKAI</button>';
        if(isDefault)html+='<button class="shop-btn locked" disabled>DEFAULT</button>';
        else if(maxed)html+='<button class="shop-btn upgrade maxed" disabled>MAX LV5</button>';
        else html+='<button class="shop-btn upgrade" data-type="gun" data-id="'+item.id+'" data-act="upgrade"'+(canUpg?'':' disabled')+'>UPG '+upgCost+'</button>';
      }
      html+='</div></div>';
    }
  }else if(shopTab==='ship'){
    for(i=0;i<SHIPS.length;i++){
      item=SHIPS[i];owned=ownedShip(item.id);equipped=save.selectedShip===item.id;
      isDefault=isDefaultItem('ship',item.id);chOK=canBuyByChapter(item.chapter);
      upgLv=isDefault?0:getUpgradeLevel('ship',item.id);
      maxed=!isDefault&&upgLv>=MAX_UPGRADE_LEVEL;
      upgCost=maxed?0:(isDefault?0:nextUpgradeCost(item.cost,upgLv));
      canUpg=!isDefault&&!maxed&&save.kills>=upgCost;
      cls='shop-row';
      if(equipped)cls+=' selected';else if(owned)cls+=' owned';
      if(isDefault)cls+=' default-lock';if(!chOK)cls+=' chapter-lock';
      html+='<div class="'+cls+'"><div class="shop-icon">'+shipSvgIcon(item,36)+'</div><div class="shop-info">';
      if(isDefault)html+='<div class="shop-name">'+item.name+'<span class="upg-lv default">DEFAULT</span></div>';
      else html+='<div class="shop-name">'+item.name+(owned?'<span class="upg-lv">LV '+upgLv+'/5</span>':'')+'</div>';
      html+='<div class="shop-desc passive">'+item.passiveDesc+'</div>';
      html+='<div class="shop-meta">Efek: '+item.fx+'</div>';
      if(!chOK)html+='<div class="shop-stat" style="color:#c93a3a;">Terbuka di Bab '+item.chapter+'</div>';
      if(owned&&!isDefault){html+='<div class="shop-stat">Total: +'+(upgLv*10)+' Max HP</div>';html+=renderUpgradePips(upgLv);}
      html+='</div><div class="shop-action">';
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+item.cost+'</span></div><button class="shop-btn buy" data-type="ship" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
      else{
        if(equipped)html+='<button class="shop-btn used" disabled>DIPAKAI</button>';
        else html+='<button class="shop-btn eq" data-type="ship" data-id="'+item.id+'" data-act="equip">PAKAI</button>';
        if(isDefault)html+='<button class="shop-btn locked" disabled>DEFAULT</button>';
        else if(maxed)html+='<button class="shop-btn upgrade maxed" disabled>MAX LV5</button>';
        else html+='<button class="shop-btn upgrade" data-type="ship" data-id="'+item.id+'" data-act="upgrade"'+(canUpg?'':' disabled')+'>UPG '+upgCost+'</button>';
      }
      html+='</div></div>';
    }
  }else if(shopTab==='shape'){
    for(i=0;i<PLAYER_SHAPES.length;i++){
      item=PLAYER_SHAPES[i];owned=ownedShape(item.id);equipped=save.selectedShape===item.id;
      chOK=canBuyByChapter(item.chapter);cls='shop-row';
      if(equipped)cls+=' selected';else if(owned)cls+=' owned';
      if(item.id==='square')cls+=' default-lock';if(!chOK)cls+=' chapter-lock';
      html+='<div class="'+cls+'"><div class="shop-icon">'+shapeSvgIcon(item,36)+'</div><div class="shop-info">';
      if(item.id==='square')html+='<div class="shop-name">'+item.name+'<span class="upg-lv default">DEFAULT</span></div>';
      else html+='<div class="shop-name">'+item.name+'</div>';
      html+='<div class="shop-desc passive">'+item.passiveDesc+'</div>';
      html+='<div class="shop-desc">'+item.desc+'</div>';
      if(!chOK)html+='<div class="shop-stat" style="color:#c93a3a;">Terbuka di Bab '+item.chapter+'</div>';
      html+='</div><div class="shop-action">';
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+item.cost+'</span></div><button class="shop-btn buy" data-type="shape" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
      else{
        if(equipped)html+='<button class="shop-btn used" disabled>DIPAKAI</button>';
        else html+='<button class="shop-btn eq" data-type="shape" data-id="'+item.id+'" data-act="equip">PAKAI</button>';
        if(item.id==='square')html+='<button class="shop-btn locked" disabled>DEFAULT</button>';
      }
      html+='</div></div>';
    }
  }else if(shopTab==='skill'){
    for(i=0;i<SKILLS.length;i++){
      item=SKILLS[i];owned=ownedSkill(item.id);equipped=save.selectedSkill===item.id;
      chOK=canBuyByChapter(item.chapter);
      upgLv=getUpgradeLevel('skill',item.id);maxed=upgLv>=MAX_UPGRADE_LEVEL;
      upgCost=maxed?0:nextUpgradeCost(item.cost,upgLv);canUpg=!maxed&&save.kills>=upgCost;
      cls='shop-row';
      if(equipped)cls+=' selected';else if(owned)cls+=' owned';
      if(!chOK)cls+=' chapter-lock';
      html+='<div class="'+cls+'"><div class="shop-icon">'+ICONS[item.icon]+'</div><div class="shop-info">';
      html+='<div class="shop-name">'+item.name+(owned?'<span class="upg-lv">LV '+upgLv+'/5</span>':'')+'</div>';
      html+='<div class="shop-desc">'+item.desc+'</div>';
      html+='<div class="shop-meta">Durasi '+(item.duration>0?item.duration+'s':'Instan')+' | CD '+item.cooldown+'s</div>';
      if(!chOK)html+='<div class="shop-stat" style="color:#c93a3a;">Terbuka di Bab '+item.chapter+'</div>';
      if(owned){html+='<div class="shop-stat">-'+Math.round(upgLv*8)+'% CD, +'+Math.round(upgLv*12)+'% Durasi</div>';html+=renderUpgradePips(upgLv);}
      html+='</div><div class="shop-action">';
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+item.cost+'</span></div><button class="shop-btn buy" data-type="skill" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
      else{
        if(equipped)html+='<button class="shop-btn unequip" data-type="skill" data-id="'+item.id+'" data-act="unequip">LEPAS</button>';
        else html+='<button class="shop-btn eq" data-type="skill" data-id="'+item.id+'" data-act="equip">PAKAI</button>';
        if(maxed)html+='<button class="shop-btn upgrade maxed" disabled>MAX LV5</button>';
        else html+='<button class="shop-btn upgrade" data-type="skill" data-id="'+item.id+'" data-act="upgrade"'+(canUpg?'':' disabled')+'>UPG '+upgCost+'</button>';
      }
      html+='</div></div>';
    }
  }else if(shopTab==='pet'){
    for(i=0;i<PETS.length;i++){
      item=PETS[i];owned=ownedPet(item.id);equipped=save.selectedPet===item.id;
      chOK=canBuyByChapter(item.chapter);
      upgLv=getUpgradeLevel('pet',item.id);maxed=upgLv>=MAX_UPGRADE_LEVEL;
      upgCost=maxed?0:nextUpgradeCost(item.cost,upgLv);canUpg=!maxed&&save.kills>=upgCost;
      cls='pet-card';
      if(equipped)cls+=' selected';else if(owned)cls+=' owned';
      if(!chOK)cls+=' chapter-lock';
      html+='<div class="'+cls+'"><div class="pet-icon">'+petSvgIcon(item,44)+'</div><div class="pet-info">';
      html+='<div class="pet-name">'+item.name+'<span class="upg-lv">LV '+upgLv+'/5</span></div>';
      html+='<div class="pet-desc">'+item.desc+'</div>';
      html+='<div class="pet-meta"><span class="pet-tag '+item.type+'">'+item.tagLabel+'</span></div>';
      if(!chOK)html+='<div class="shop-stat" style="color:#c93a3a;">Terbuka di Bab '+item.chapter+'</div>';
      if(owned){html+='<div class="shop-stat">Upgrade: +'+Math.round(upgLv*20)+'% efek</div>';html+=renderUpgradePips(upgLv);}
      html+='</div><div class="pet-action">';
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+item.cost+'</span></div><button class="shop-btn buy" data-type="pet" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
      else{
        if(equipped)html+='<button class="shop-btn used" disabled>DIPAKAI</button>';
        else html+='<button class="shop-btn eq" data-type="pet" data-id="'+item.id+'" data-act="equip">PAKAI</button>';
        if(maxed)html+='<button class="shop-btn upgrade maxed" disabled>MAX LV5</button>';
        else html+='<button class="shop-btn upgrade" data-type="pet" data-id="'+item.id+'" data-act="upgrade"'+(canUpg?'':' disabled')+'>UPG '+upgCost+'</button>';
      }
      html+='</div></div>';
    }
  }else{
    for(i=0;i<STARTING_UPGRADES.length;i++){
      item=STARTING_UPGRADES[i];owned=ownedStart(item.id);chOK=canBuyByChapter(item.chapter);
      cls='shop-row';if(owned)cls+=' owned';if(!chOK)cls+=' chapter-lock';
      html+='<div class="'+cls+'"><div class="shop-icon">'+ICONS[item.icon]+'</div><div class="shop-info">';
      html+='<div class="shop-name">'+item.name+'</div>';
      html+='<div class="shop-desc">'+item.desc+'</div>';
      html+='<div class="shop-meta">'+(owned?'AKTIF':'PERMANEN - tidak bisa upgrade')+'</div>';
      if(!chOK)html+='<div class="shop-stat" style="color:#c93a3a;">Terbuka di Bab '+item.chapter+'</div>';
      html+='</div><div class="shop-action">';
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+item.cost+'</span></div><button class="shop-btn buy" data-type="start" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
      else html+='<button class="shop-btn used" disabled>AKTIF</button>';
      html+='</div></div>';
    }
  }
  dom.shopList.innerHTML=html;
  var btns=dom.shopList.querySelectorAll('button[data-act]');
  for(var b=0;b<btns.length;b++)btns[b].addEventListener('click',handleShopAction);
  if(dom.skillTestBtn){
    if(save.selectedSkill)dom.skillTestBtn.classList.remove('disabled');
    else dom.skillTestBtn.classList.add('disabled');
  }
}

function handleShopAction(){
  var type=this.getAttribute('data-type');
  var id=this.getAttribute('data-id');
  var act=this.getAttribute('data-act');
  if(act==='buy'){
    var cost=0,itemCh=null;
    if(type==='gun'){var g=findGun(id);if(!g||ownedGun(id))return;cost=g.cost;itemCh=g.chapter;}
    else if(type==='ship'){var s=findShip(id);if(!s||ownedShip(id))return;cost=s.cost;itemCh=s.chapter;}
    else if(type==='shape'){var sh=findShape(id);if(!sh||ownedShape(id))return;cost=sh.cost;itemCh=sh.chapter;}
    else if(type==='skill'){var sk=findSkill(id);if(!sk||ownedSkill(id))return;cost=sk.cost;itemCh=sk.chapter;}
    else if(type==='pet'){var pt=findPet(id);if(!pt||ownedPet(id))return;cost=pt.cost;itemCh=pt.chapter;}
    else if(type==='start'){var u=findStart(id);if(!u||ownedStart(id))return;cost=u.cost;itemCh=u.chapter;}
    if(!canBuyByChapter(itemCh)){showToast('Buka Bab '+itemCh+' dahulu','error');return;}
    if(save.kills<cost)return;
    save.kills-=cost;
    if(type==='gun'){save.guns.push(id);save.selectedGun=id;}
    else if(type==='ship'){save.ships.push(id);save.selectedShip=id;}
    else if(type==='shape'){save.shapes.push(id);save.selectedShape=id;}
    else if(type==='skill'){save.ownedSkills.push(id);if(!save.selectedSkill)save.selectedSkill=id;}
    else if(type==='pet'){save.pets.push(id);if(!save.selectedPet)save.selectedPet=id;}
    else if(type==='start'){save.startingUpgrades.push(id);}
    sfxBuy();killDirty=true;persist();refreshHeaderKills();refreshProfile();renderShop();updateMenuCard();checkAchievements();
  }else if(act==='equip'){
    if(type==='gun'&&ownedGun(id))save.selectedGun=id;
    else if(type==='ship'&&ownedShip(id))save.selectedShip=id;
    else if(type==='shape'&&ownedShape(id))save.selectedShape=id;
    else if(type==='skill'&&ownedSkill(id))save.selectedSkill=id;
    else if(type==='pet'&&ownedPet(id))save.selectedPet=id;
    sfxClick();persist();renderShop();refreshProfile();updateMenuCard();
  }else if(act==='unequip'){
    if(type==='skill'){save.selectedSkill=null;sfxClick();persist();renderShop();refreshProfile();}
  }else if(act==='upgrade'){
    if(type==='start'||type==='shape')return;
    if(isDefaultItem(type,id))return;
    var itemObj=null,baseCost=0;
    if(type==='gun'){itemObj=findGun(id);if(!itemObj||!ownedGun(id))return;baseCost=itemObj.cost;}
    else if(type==='ship'){itemObj=findShip(id);if(!itemObj||!ownedShip(id))return;baseCost=itemObj.cost;}
    else if(type==='skill'){itemObj=findSkill(id);if(!itemObj||!ownedSkill(id))return;baseCost=itemObj.cost;}
    else if(type==='pet'){itemObj=findPet(id);if(!itemObj||!ownedPet(id))return;baseCost=itemObj.cost;}
    if(!itemObj)return;
    var curLv=getUpgradeLevel(type,id);
    if(curLv>=MAX_UPGRADE_LEVEL)return;
    var cost2=nextUpgradeCost(baseCost,curLv);
    if(save.kills<cost2)return;
    save.kills-=cost2;setUpgradeLevel(type,id,curLv+1);
    sfxUpg();killDirty=true;persist();refreshHeaderKills();refreshProfile();renderShop();checkAchievements();
  }
}

function switchShopTab(tab){
  shopTab=tab;
  var tabs=dom.shopTabs.querySelectorAll('.tab');
  for(var i=0;i<tabs.length;i++){
    if(tabs[i].getAttribute('data-tab')===tab)tabs[i].classList.add('on');
    else tabs[i].classList.remove('on');
  }
  renderShop();
  if(shopPreviewCanvas){
    shopPreviewCanvas.width=shopPreviewCanvas.clientWidth;
    shopPreviewCanvas.height=shopPreviewCanvas.clientHeight;
  }
}

function renderAch(){
  var html='';
  var friendCount=0;for(var fk in save.friends)if(save.friends[fk])friendCount++;
  for(var i=0;i<ACHIEVEMENTS.length;i++){
    var a=ACHIEVEMENTS[i];
    var done=!!save.achievements[a.id];
    var prog='';
    if(a.type==='kills')prog=Math.min(save.totalKills,a.goal)+' / '+a.goal;
    else if(a.type==='bosses')prog=Math.min(save.bossKills,a.goal)+' / '+a.goal;
    else if(a.type==='comboMax')prog='x'+Math.min(save.comboMax,a.goal)+' / x'+a.goal;
    else if(a.type==='win_level')prog=save.winFlags[a.level]?'Selesai':'Belum';
    else if(a.type==='all_skills')prog=save.ownedSkills.length+' / '+SKILLS.length;
    else if(a.type==='all_ships')prog=save.ships.length+' / '+SHIPS.length;
    else if(a.type==='all_guns')prog=save.guns.length+' / '+GUNS.length;
    else if(a.type==='all_starting')prog=save.startingUpgrades.length+' / '+STARTING_UPGRADES.length;
    else if(a.type==='all_shapes')prog=save.shapes.length+' / '+PLAYER_SHAPES.length;
    else if(a.type==='all_pets')prog=save.pets.length+' / '+PETS.length;
    else if(a.type==='vouchers_used')prog=Math.min(vouchersUsedCount(),a.goal)+' / '+a.goal;
    else if(a.type==='chapter')prog=chapterComplete(a.chapter)?'Tuntas':'Belum';
    else if(a.type==='endless')prog=Math.min(save.endlessBest,a.goal)+' / '+a.goal;
    else if(a.type==='challenge_nohit')prog=save.challengeBests.nohit>0?'Selesai':'Belum';
    else if(a.type==='challenge_pistol')prog=save.challengeBests.pistol>0?'Selesai':'Belum';
    else if(a.type==='challenge_speed')prog=save.challengeBests.speed>0?'Selesai':'Belum';
    else if(a.type==='challenge_bossrush')prog=save.challengeBests.bossrush>0?'Selesai':'Belum';
    else if(a.type==='mp_wins')prog=Math.min(save.mpWins||0,a.goal)+' / '+a.goal;
    else if(a.type==='mp_gifts')prog=Math.min(save.mpGifts||0,a.goal)+' / '+a.goal;
    else if(a.type==='friends')prog=Math.min(friendCount,a.goal)+' / '+a.goal;
    else if(a.type==='level')prog=Math.min(save.level,a.goal)+' / '+a.goal;
    else if(a.type==='trophies')prog=Math.min(save.trophies,a.goal)+' / '+a.goal;
    var cls='ach-row'+(done?' done':'');
    html+='<div class="'+cls+'"><div class="ach-icon">'+(ICONS[a.icon]||ICONS.star)+'</div><div class="ach-info">';
    html+='<div class="ach-name">'+a.name+'</div>';
    html+='<div class="ach-desc">'+a.desc+'</div>';
    html+='<div class="ach-prog">'+prog+'</div>';
    html+='</div><div class="ach-status">'+(done?'OK':'LOCK')+'</div></div>';
  }
  dom.achList.innerHTML=html;
  var done=achDone();
  dom.achCount.textContent=done+'/'+ACHIEVEMENTS.length;
  dom.achKills.textContent=save.totalKills.toLocaleString('id-ID');
  dom.achBoss.textContent=save.bossKills;
  dom.achCombo.textContent='x'+Math.max(1,save.comboMax);
}

function renderStats(){
  dom.stKills.textContent=save.kills.toLocaleString('id-ID');
  dom.stTotalKills.textContent=save.totalKills.toLocaleString('id-ID');
  dom.stBoss.textContent=save.bossKills;
  dom.stHard.textContent=save.hardWins;
  dom.stExpert.textContent=save.expertWins;
  dom.stNightmare.textContent=save.nightmareWins;
  dom.stImpossible.textContent=save.impossibleWins;
  dom.stCombo.textContent='x'+Math.max(1,save.comboMax);
  dom.stAch.textContent=achDone()+'/'+ACHIEVEMENTS.length;
  if(dom.stTrophy)dom.stTrophy.textContent=save.trophies;
  if(dom.stEndless)dom.stEndless.textContent=save.endlessBest.toLocaleString('id-ID');
  var coll=save.ownedSkills.length+(save.ships.length-1)+(save.guns.length-1)+(save.shapes.length-1)+(save.pets.length-1)+save.startingUpgrades.length;
  var totalAll=SKILLS.length+(SHIPS.length-1)+(GUNS.length-1)+(PLAYER_SHAPES.length-1)+(PETS.length-1)+STARTING_UPGRADES.length;
  dom.stCollection.textContent=coll+' / '+totalAll;
  var cleared=0,totalLevels=0;
  for(var i=0;i<LEVELS.length;i++){
    if(LEVELS[i].isEndless)continue;
    totalLevels++;
    if(save.winFlags[i])cleared++;
  }
  dom.stCleared.textContent=cleared+' / '+totalLevels;
  dom.volSlider.value=save.soundVol;
  if(dom.bgmSlider)dom.bgmSlider.value=save.bgmVol;
  dom.shakeSlider.value=save.shakeAmt;
  if(dom.bgmSwitch){
    if(save.bgmOn)dom.bgmSwitch.classList.add('on');
    else dom.bgmSwitch.classList.remove('on');
  }
}

function refreshAll(){refreshHeaderKills();refreshProfile();updateMenuCard();}

function buildMenuDeco(){
  var layer=document.getElementById('menuDeco');
  if(!layer)return;
  layer.innerHTML='';
  var shapes=['circle','square','triangle','diamond'];
  var colors=['#ffc857','#ff6b4a','#3ddc97','#67c7f0','#9b6bff','#ff77a9','#ffffff'];
  var frag=document.createDocumentFragment();
  for(var i=0;i<16;i++){
    var s=document.createElement('div');
    s.className='deco-item '+shapes[i%shapes.length];
    var size=8+Math.random()*18;
    s.style.width=size+'px';s.style.height=size+'px';
    s.style.background=colors[i%colors.length];
    s.style.left=(Math.random()*94).toFixed(1)+'%';
    s.style.top=(Math.random()*94).toFixed(1)+'%';
    s.style.opacity='0.5';
    s.style.animationDuration=(5+Math.random()*6).toFixed(2)+'s';
    s.style.animationDelay=(-Math.random()*8).toFixed(2)+'s';
    frag.appendChild(s);
  }
  layer.appendChild(frag);
}

function showScreen(name){
  var all=[dom.menuScreen,dom.levelScreen,dom.shopScreen,dom.achScreen,dom.statsScreen,dom.helpScreen,dom.voucherScreen,dom.spinScreen,dom.mpScreen,dom.mpLobbyScreen,dom.challengeScreen,dom.leaderScreen,dom.friendsScreen];
  for(var i=0;i<all.length;i++)if(all[i])all[i].classList.remove('on');
  refreshAll();
  if(name==='menu')dom.menuScreen.classList.add('on');
  else if(name==='level'){dom.levelScreen.classList.add('on');renderLevels();refreshProfile();}
  else if(name==='shop'){
    dom.shopScreen.classList.add('on');
    refreshHeaderKills();renderShop();
    if(shopPreviewCanvas){
      setTimeout(function(){shopPreviewCanvas.width=shopPreviewCanvas.clientWidth;shopPreviewCanvas.height=shopPreviewCanvas.clientHeight;},30);
    }
  }
  else if(name==='ach'){dom.achScreen.classList.add('on');renderAch();}
  else if(name==='stats'){dom.statsScreen.classList.add('on');renderStats();}
  else if(name==='help')dom.helpScreen.classList.add('on');
  else if(name==='voucher')dom.voucherScreen.classList.add('on');
  else if(name==='spin'){if(dom.spinScreen)dom.spinScreen.classList.add('on');refreshHeaderKills();if(window.AD_spinRender)window.AD_spinRender();}
  else if(name==='mp'){dom.mpScreen.classList.add('on');if(window.MP_refreshSelfPreview)window.MP_refreshSelfPreview();if(window.MP_renderRoomList)window.MP_renderRoomList();}
  else if(name==='mpLobby'){dom.mpLobbyScreen.classList.add('on');if(appState!=='mpLobbyMenu')appState='mpLobbyMenu';}
  else if(name==='challenge'){if(dom.challengeScreen)dom.challengeScreen.classList.add('on');refreshProfile();}
  else if(name==='leader'){if(dom.leaderScreen)dom.leaderScreen.classList.add('on');if(window.LB_renderLeaderboard)window.LB_renderLeaderboard();}
  else if(name==='friends'){if(dom.friendsScreen)dom.friendsScreen.classList.add('on');if(window.FR_renderFriends)window.FR_renderFriends();}
}

function goScreen(name,stateName){
  appState='transitioning';
  playWipe('left',function(){
    hud.classList.remove('on');hint.classList.remove('on');
    skillBtn.classList.remove('on','active','ready');
    bossWrap.classList.remove('on');comboHud.classList.remove('on');
    streakHudEl.style.opacity='0';
    petHud.classList.remove('on');pauseBtn.classList.remove('on');
    overlay.classList.remove('on');
    showScreen(name);
    if(name==='menu')applyTheme(THEME_MENU);
    persist();
  },function(){appState=stateName||name;});
}

function startLevel(level,isMP){
  appState='transitioning';
  playWipe('right',function(){
    var all=[dom.menuScreen,dom.levelScreen,dom.shopScreen,dom.achScreen,dom.statsScreen,dom.helpScreen,dom.voucherScreen,dom.spinScreen,dom.mpScreen,dom.mpLobbyScreen,dom.challengeScreen,dom.leaderScreen,dom.friendsScreen];
    for(var i=0;i<all.length;i++)if(all[i])all[i].classList.remove('on');
    overlay.classList.remove('on');
    var winM=document.getElementById('winModal');if(winM)winM.classList.remove('on');
    var pm=document.getElementById('pauseModal');if(pm)pm.classList.remove('on');
    var rb=document.getElementById('mpReviveBox');if(rb)rb.classList.remove('on');
    applyTheme(level.theme);
    resetGame(level,currentChallenge);
    hud.classList.add('on');showHint();
    if(save.selectedSkill)skillBtn.classList.add('on');
    if(save.selectedPet)petHud.classList.add('on');
    if(!isMP)pauseBtn.classList.add('on');
    updateMPLevelBadge();
    var badge=dom.mpLevelBadge;
    if(badge)badge.classList.toggle('on',!!isMP);
    if(save.bgmOn)startBGM();
  },function(){
    appState=isMP?'playingMP':'playing';
    updateSkillBtn();updatePetHud();
    if(level.id===12)showWaveBanner('FINAL BOSS',true);
    if(level.isEndless)showWaveBanner('ENDLESS SURVIVAL',true);
    sfxWave();
  });
}

function startChallenge(ch){
  currentChallenge=ch;
  var baseLevel=LEVELS[1];
  if(ch==='bossrush')baseLevel=LEVELS[12];
  else if(ch==='speed')baseLevel=LEVELS[3];
  else if(ch==='nohit')baseLevel=LEVELS[2];
  else if(ch==='pistol')baseLevel=LEVELS[4];
  var clone={};
  for(var k in baseLevel)clone[k]=baseLevel[k];
  if(ch==='speed')clone.duration=Math.round(baseLevel.duration*0.8);
  if(ch==='bossrush'){clone.isFinal=true;clone.duration=180;}
  startLevel(clone,false);
}

function showVoucherMsg(text,type){
  dom.voucherMsg.textContent=text;
  dom.voucherMsg.className='voucher-msg '+(type||'');
  void dom.voucherMsg.offsetWidth;
  dom.voucherMsg.classList.add('pop');
  setTimeout(function(){dom.voucherMsg.classList.remove('pop');},450);
}

function openVoucherScene(){
  if(appState!=='playing')return;
  if(window.DS_MP.active)return;
  appState='transitioning';sfxSecret();
  playWipe('right',function(){
    hud.classList.remove('on');hint.classList.remove('on');
    skillBtn.classList.remove('on','active','ready');
    bossWrap.classList.remove('on');comboHud.classList.remove('on');
    streakHudEl.style.opacity='0';
    petHud.classList.remove('on');pauseBtn.classList.remove('on');
    showScreen('voucher');
    dom.voucherInput.value='';
    dom.voucherMsg.textContent='';
    dom.voucherMsg.className='voucher-msg';
    dom.voucherTotal.textContent=save.kills.toLocaleString('id-ID');
  },function(){
    appState='voucherMenu';
    setTimeout(function(){try{dom.voucherInput.focus();}catch(e){}},300);
  });
}

function applyVoucher(){
  var code=dom.voucherInput.value.trim().toUpperCase();
  if(!code){showVoucherMsg('MASUKKAN KODE DULU','error');sfxVoucherBad();return;}
  if(!VOUCHERS.hasOwnProperty(code)){showVoucherMsg('KODE TIDAK VALID','error');sfxVoucherBad();return;}
  if(save.usedVouchers[code]){showVoucherMsg('KODE SUDAH DIPAKAI','error');sfxVoucherBad();return;}
  var amount=VOUCHERS[code];
  grantKP(amount);
  save.usedVouchers[code]=true;
  persist();refreshAll();
  dom.voucherTotal.textContent=save.kills.toLocaleString('id-ID');
  showVoucherMsg('BERHASIL! +'+amount.toLocaleString('id-ID')+' POIN','success');
  sfxVoucherOk();checkAchievements();
  dom.voucherInput.value='';
  dom.voucherInput.blur();
}

function closeVoucherScene(){
  appState='transitioning';sfxClick();
  playWipe('left',function(){
    showScreen('menu');applyTheme(THEME_MENU);refreshAll();
  },function(){appState='menu';});
}

function showOnboarding(){
  onboardingActive=true;
  if(dom.onboardModal)dom.onboardModal.classList.add('on');
  if(dom.onboardInput){
    dom.onboardInput.value=save.playerName||'';
    updateOnboardHint();
    setTimeout(function(){try{dom.onboardInput.focus();}catch(e){}},350);
  }
}
function hideOnboarding(){
  onboardingActive=false;
  if(dom.onboardModal)dom.onboardModal.classList.remove('on');
}
function updateOnboardHint(){
  if(!dom.onboardHint||!dom.onboardInput||!dom.onboardSaveBtn)return;
  var v=(dom.onboardInput.value||'').trim().toUpperCase();
  if(v.length===0){
    dom.onboardHint.textContent='Minimal 3 karakter, maksimal 10';
    dom.onboardHint.style.color='#8a8aa3';
    dom.onboardSaveBtn.disabled=true;
  }else if(v.length<3){
    dom.onboardHint.textContent='Minimal 3 karakter (sekarang '+v.length+')';
    dom.onboardHint.style.color='#c93a3a';
    dom.onboardSaveBtn.disabled=true;
  }else{
    dom.onboardHint.textContent='Nama siap: '+v;
    dom.onboardHint.style.color='#0e8a5f';
    dom.onboardSaveBtn.disabled=false;
  }
}
function submitOnboarding(){
  if(!dom.onboardInput)return;
  var nm=(dom.onboardInput.value||'').trim().toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,10);
  if(nm.length<3){updateOnboardHint();return;}
  save.playerName=nm;
  if(!save.globalId)save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(0,8);
  persist();
  pushProfileToFirebase();
  hideOnboarding();
  refreshAll();
  updateMenuCard();
  sfxUnlock();
  showToast('Selamat datang, '+nm+'!','success',3000);
}

dom.killLine.addEventListener('click',function(ev){
  ev.stopPropagation();
  if(appState!=='playing')return;
  if(window.DS_MP.active)return;
  killTapCount++;
  if(killTapTimer)clearTimeout(killTapTimer);
  killTapTimer=setTimeout(function(){killTapCount=0;},850);
  if(killTapCount>=4){
    killTapCount=0;
    if(killTapTimer)clearTimeout(killTapTimer);
    openVoucherScene();
  }
});

dom.voucherEnter.addEventListener('click',function(){initAudio();applyVoucher();});
dom.voucherInput.addEventListener('keydown',function(ev){
  if(ev.key==='Enter'||ev.keyCode===13){ev.preventDefault();initAudio();applyVoucher();}
});
dom.voucherBack.addEventListener('click',function(){initAudio();closeVoucherScene();});

dom.confirmYes.addEventListener('click',function(){initAudio();sfxClick();hideConfirm(true);});
dom.confirmNo.addEventListener('click',function(){initAudio();sfxClick();hideConfirm(false);});
dom.confirmModal.addEventListener('click',function(ev){if(ev.target===dom.confirmModal)hideConfirm(false);});
document.addEventListener('keydown',function(ev){
  if(dom.confirmModal.classList.contains('on')){
    if(ev.key==='Escape')hideConfirm(false);
    else if(ev.key==='Enter')hideConfirm(true);
  }
});

pauseBtn.addEventListener('click',function(){initAudio();pauseGame();});
var pauseResumeBtn=document.getElementById('pauseResume');
var pauseRestartBtn=document.getElementById('pauseRestart');
var pauseQuitBtn=document.getElementById('pauseQuit');
if(pauseResumeBtn)pauseResumeBtn.addEventListener('click',function(){initAudio();resumeGame();});
if(pauseRestartBtn)pauseRestartBtn.addEventListener('click',function(){
  initAudio();
  var pm=document.getElementById('pauseModal');if(pm)pm.classList.remove('on');
  appState='transitioning';startLevel(currentLevel,false);
});
if(pauseQuitBtn)pauseQuitBtn.addEventListener('click',function(){initAudio();quitToMenu();});

var winContinueBtn=document.getElementById('winContinue');
var winToLevelBtn=document.getElementById('winToLevel');
if(winContinueBtn)winContinueBtn.addEventListener('click',function(){
  initAudio();sfxClick();
  var winM=document.getElementById('winModal');if(winM)winM.classList.remove('on');
  endGame(true);
});
if(winToLevelBtn)winToLevelBtn.addEventListener('click',function(){
  initAudio();sfxClick();
  var winM=document.getElementById('winModal');if(winM)winM.classList.remove('on');
  endGame(true);
});

document.getElementById('playBtn').addEventListener('click',function(){
  if(onboardingActive){showToast('Isi nama dulu ya','info');return;}
  initAudio();sfxClick();goScreen('level','levelSelect');
});
document.getElementById('navShop').addEventListener('click',function(){initAudio();sfxClick();goScreen('shop','shopMenu');});
document.getElementById('navAch').addEventListener('click',function(){initAudio();sfxClick();goScreen('ach','achMenu');});
document.getElementById('navStats').addEventListener('click',function(){initAudio();sfxClick();goScreen('stats','statsMenu');});
document.getElementById('navHelp').addEventListener('click',function(){initAudio();sfxClick();goScreen('help','helpMenu');});
document.getElementById('navMP').addEventListener('click',function(){initAudio();sfxClick();goScreen('mp','mpMenu');});
var navSpinBtn=document.getElementById('navSpin');
if(navSpinBtn)navSpinBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('spin','spinMenu');});
var navLeaderBtn=document.getElementById('navLeader');
if(navLeaderBtn)navLeaderBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('leader','leaderMenu');});
var navFriendsBtn=document.getElementById('navFriends');
if(navFriendsBtn)navFriendsBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('friends','friendsMenu');});
var navChallengeBtn=document.getElementById('navChallenge');
if(navChallengeBtn)navChallengeBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('challenge','challengeMenu');});
var spinBackBtn=document.getElementById('spinBack');
if(spinBackBtn)spinBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
var leaderBackBtn=document.getElementById('leaderBack');
if(leaderBackBtn)leaderBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
var friendsBackBtn=document.getElementById('friendsBack');
if(friendsBackBtn)friendsBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
var challengeBackBtn=document.getElementById('challengeBack');
if(challengeBackBtn)challengeBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
if(dom.menuGear)dom.menuGear.addEventListener('click',function(){initAudio();sfxClick();goScreen('stats','statsMenu');});

document.getElementById('levelBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('shopBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('achBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('statsBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('helpBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('mpBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});

var chTabs=dom.chapterTabs.querySelectorAll('.chapter-tab');
for(var ci=0;ci<chTabs.length;ci++)chTabs[ci].addEventListener('click',function(){
  var ch=Number(this.getAttribute('data-chapter'));
  if(!isChapterUnlocked(ch)){showToast('Buka bab sebelumnya dulu','error');return;}
  currentChapterTab=ch;renderLevels();
});
var tabBtns=dom.shopTabs.querySelectorAll('.tab');
for(var ti=0;ti<tabBtns.length;ti++)tabBtns[ti].addEventListener('click',function(){sfxClick();switchShopTab(this.getAttribute('data-tab'));});

document.getElementById('restartBtn').addEventListener('click',function(){initAudio();sfxClick();startLevel(currentLevel,false);});
document.getElementById('toLevelBtn').addEventListener('click',function(){initAudio();sfxClick();goScreen('level','levelSelect');});

skillBtn.addEventListener('click',activateSkill);

if(dom.skillTestBtn)dom.skillTestBtn.addEventListener('click',function(){
  initAudio();
  if(!save.selectedSkill){showToast('Belum ada skill terpilih','error');return;}
  sfxBuy();showToast('Test skill: '+findSkill(save.selectedSkill).name,'success');
});

dom.volSlider.addEventListener('input',function(){save.soundVol=Number(this.value);persist();});
if(dom.bgmSlider)dom.bgmSlider.addEventListener('input',function(){save.bgmVol=Number(this.value);persist();});
dom.shakeSlider.addEventListener('input',function(){save.shakeAmt=Number(this.value);persist();});
if(dom.bgmSwitch)dom.bgmSwitch.addEventListener('click',function(){
  save.bgmOn=!save.bgmOn;
  if(save.bgmOn)dom.bgmSwitch.classList.add('on');
  else dom.bgmSwitch.classList.remove('on');
  if(save.bgmOn&&(appState==='playing'||appState==='playingMP'))startBGM();
  else stopBGM();
  persist();sfxClick();
});

var challengeRows=document.querySelectorAll('#challengeScreen .challenge-row');
for(var cri=0;cri<challengeRows.length;cri++){
  challengeRows[cri].addEventListener('click',function(){
    initAudio();sfxClick();
    var ch=this.getAttribute('data-challenge');
    if(!ch)return;
    if(window.DS_MP.active||window.DS_MP.networkMode){
      window.DS_MP.active=false;
      window.DS_MP.networkMode=false;
      window.DS_MP.globalMode=false;
      window.DS_MP.dead=false;
      window.DS_MP.isGlobalHost=false;
      window.DS_MP.isHost=false;
      window.DS_MP.playersCache={};
    }
    isNetworkGame=false;
    startChallenge(ch);
  });
}

if(dom.manualSave)dom.manualSave.addEventListener('click',function(){
  if(persist()){sfxUnlock();showToast('Progres berhasil disimpan!','success');}
  else showToast('Gagal menyimpan: '+(storageError||'tidak diketahui'),'error');
});

dom.resetAll.addEventListener('click',function(){
  initAudio();sfxClick();
  showConfirm('Hapus semua progres? Semua poin, skill, kapal, senjata, upgrade, pencapaian, dan tingkat terbuka akan hilang.',function(){
    save.kills=0;save.totalKills=0;save.level=1;save.xp=0;save.totalXp=0;
    save.trophies=0;save.mpGifts=0;save.ownedSkills=[];save.selectedSkill=null;
    save.ships=['default'];save.selectedShip='default';
    save.shapes=['square'];save.selectedShape='square';
    save.guns=['bullet'];save.selectedGun='bullet';
    save.pets=['scout'];save.selectedPet='scout';save.petUpgrades={};
    save.achievements={};save.expertWins=0;save.hardWins=0;
    save.nightmareWins=0;save.impossibleWins=0;save.bossKills=0;
    save.doomWins=0;save.rrrorWins=0;save.finalWins=0;save.mpWins=0;
    save.winFlags={};save.noHitFlags={};save.comboMax=0;save.startingUpgrades=[];
    save.gunUpgrades={};save.shipUpgrades={};save.skillUpgrades={};save.bestKills={};
    save.unlockedLevels=[0];save.usedVouchers={};save.endlessBest=0;
    save.challengeBests={nohit:0,pistol:0,speed:0,bossrush:0};
    save.friends={};save.friendRequests={};save.friendSent={};
    persist();refreshAll();renderStats();renderLevels();
    showToast('Semua progres sudah dihapus.','success');
  });
});

if(dom.onboardInput){
  dom.onboardInput.addEventListener('input',function(){
    this.value=this.value.toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,10);
    updateOnboardHint();
  });
  dom.onboardInput.addEventListener('keydown',function(ev){
    if(ev.key==='Enter'||ev.keyCode===13){ev.preventDefault();initAudio();submitOnboarding();}
  });
}
if(dom.onboardSaveBtn)dom.onboardSaveBtn.addEventListener('click',function(){initAudio();submitOnboarding();});

setInterval(function(){if(killDirty)persist();},1500);
setInterval(function(){if(!onboardingActive&&save.playerName&&save.playerName.length>=3)pushProfileToFirebase();},30000);
window.addEventListener('beforeunload',function(){persist();});
document.addEventListener('visibilitychange',function(){if(document.hidden){persist();stopBGM();}});
window.addEventListener('pagehide',function(){persist();stopBGM();});

window.DS={
  save:save,LEVELS:LEVELS,SHIPS:SHIPS,PLAYER_SHAPES:PLAYER_SHAPES,GUNS:GUNS,
  SKILLS:SKILLS,STARTING_UPGRADES:STARTING_UPGRADES,ACHIEVEMENTS:ACHIEVEMENTS,
  PETS:PETS,ICONS:ICONS,BASE_SIZE:BASE_SIZE,BORDER:BORDER,MAX_LEVEL:MAX_LEVEL,
  getW:function(){return W;},getH:function(){return H;},
  getPlayer:function(){return player;},getAppState:function(){return appState;},
  setAppState:function(v){appState=v;},getCurrentLevel:function(){return currentLevel;},
  getElapsed:function(){return elapsed;},persist:persist,showToast:showToast,
  showConfirm:showConfirm,hideConfirm:hideConfirm,sfxClick:sfxClick,sfxMP:sfxMP,
  sfxAch:sfxAch,sfxUpg:sfxUpg,sfxEmoji:sfxEmoji,sfxGift:sfxGift,
  sfxVictory:sfxVictory,sfxRevive:sfxRevive,sfxSpin:sfxSpin,initAudio:initAudio,
  checkAchievements:checkAchievements,findShip:findShip,findShape:findShape,
  findGun:findGun,findSkill:findSkill,findStart:findStart,findPet:findPet,
  ownedShip:ownedShip,ownedShape:ownedShape,ownedGun:ownedGun,ownedSkill:ownedSkill,
  ownedPet:ownedPet,grantKP:grantKP,addXP:addXP,xpNeededForLevel:xpNeededForLevel,
  updateMenuCard:updateMenuCard,updateMPLevelBadge:updateMPLevelBadge,
  refreshAll:refreshAll,refreshHeaderKills:refreshHeaderKills,
  refreshProfile:refreshProfile,renderStats:renderStats,renderAch:renderAch,
  renderShop:renderShop,edgeLeft:edgeLeft,edgeRight:edgeRight,edgeTop:edgeTop,
  edgeBottom:edgeBottom,drawShipCentered:drawShipCentered,
  playerSpriteCache:function(){return playerSpriteCache;},
  playerGlowCache:function(){return playerGlowCache;},
  petSpriteCache:function(){return petSpriteCache;},
  startLevel:startLevel,showScreen:showScreen,goScreen:goScreen,
  spawnConfetti:spawnConfetti,getUpgradeLevel:getUpgradeLevel,
  pushProfileToFirebase:pushProfileToFirebase,
  isOnboarding:function(){return onboardingActive;},
  hasValidName:function(){return !!(save.playerName&&save.playerName.length>=3);}
};

window.MP_broadcastKill=null;
window.MP_spawnGlobalEnemy=null;
window.MP_spawnGlobalBoss=null;
window.MP_damageGlobalEnemy=null;
window.MP_damageGlobalBoss=null;
window.MP_killGlobalEnemy=null;

W=canvas.width=window.innerWidth;
H=canvas.height=window.innerHeight;
bosses=[];enemies=[];enemyProjectiles=[];playerProjectiles=[];
healBubbles=[];boostBubbles=[];bombBubbles=[];lasers=[];particles=[];
shockwaves=[];powerups=[];ambientFar=[];ambientNear=[];obstacleLasers=[];

checkStorage();
loadSave();
if(!save.mpWins)save.mpWins=0;
if(!save.mpGifts)save.mpGifts=0;
if(!save.trophies)save.trophies=0;
if(!save.globalId){
  save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  persist();
}
buildAllSprites();
buildBackground();
buildAmbientParticles();
dom.volSlider.value=save.soundVol;
if(dom.bgmSlider)dom.bgmSlider.value=save.bgmVol;
dom.shakeSlider.value=save.shakeAmt;
showScreen('menu');
refreshAll();
updateMPLevelBadge();
buildMenuDeco();
if(dom.loadingOverlay)setTimeout(function(){dom.loadingOverlay.classList.add('hide');},600);
if(save.playerName&&save.playerName.length>=3){
  onboardingActive=false;
  pushProfileToFirebase();
}else{
  setTimeout(showOnboarding,700);
}
requestAnimationFrame(loop);

})();
