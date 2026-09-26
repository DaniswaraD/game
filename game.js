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
var DAMAGE_IFRAME_SECONDS=0.55;
var damageIFrame=0;
var challengeRun=true;
var __nav=typeof navigator!=='undefined'?navigator:null;
var PERF_MODE=!!(__nav&&((__nav.hardwareConcurrency&&__nav.hardwareConcurrency<=4)||(__nav.deviceMemory&&__nav.deviceMemory<=4)||/Android|iPhone|iPad|Mobile/i.test(__nav.userAgent||'')));
var MAX_PARTICLES=PERF_MODE?150:220,MAX_ENEMY_PROJECTILES=PERF_MODE?180:250,MAX_PLAYER_PROJECTILES=PERF_MODE?110:140;
var MAX_SHOCKWAVES=PERF_MODE?12:20,MAX_AMBIENT_FAR=PERF_MODE?10:18,MAX_AMBIENT_NEAR=PERF_MODE?6:12;
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
  globalId:'',friends:{},friendRequests:{},friendSent:{},
  campaignChapter:1,campaignDialogSeen:{},mpPersonalKills:0,mpTeamKills:0,
  lastLevelId:0,lastPlayedAt:0,dailyStreak:0,dailyLastComplete:'',storyClaimed:{},dailyQuest:null
};

var killDirty=false,lastPersistTime=0;

function loadSave(){
  var loaded=false;
  try{
    var raw=localStorage.getItem(SAVE_KEY)||localStorage.getItem(SAVE_KEY_LEGACY)||localStorage.getItem(SAVE_KEY_LEGACY2)||localStorage.getItem(SAVE_KEY_LEGACY3);
    if(!raw){validateSave();return false;}
    var s=JSON.parse(raw);
    if(!s){validateSave();return false;}
    for(var k in save){if(s[k]!==undefined)save[k]=s[k];}
    loaded=true;
  }catch(e){storageError='Load error: '+(e&&e.message?e.message:'unknown');}
  validateSave();
  if(loaded)updateStorageStatus('Data tersimpan dimuat',true);
  return loaded;
}

function validateSave(){
    if(!Array.isArray(save.ships))save.ships=['default'];
  if(typeof SHIPS!=='undefined')save.ships=save.ships.filter(function(id){return SHIPS.some(function(x){return x.id===id;});});
  if(save.ships.indexOf('default')<0)save.ships.unshift('default');
  if(save.ships.indexOf(save.selectedShip)<0)save.selectedShip='default';
  if(!Array.isArray(save.shapes))save.shapes=['square'];
  if(typeof PLAYER_SHAPES!=='undefined')save.shapes=save.shapes.filter(function(id){return PLAYER_SHAPES.some(function(x){return x.id===id;});});
  if(save.shapes.indexOf('square')<0)save.shapes.unshift('square');
  if(save.shapes.indexOf(save.selectedShape)<0)save.selectedShape='square';
  if(!Array.isArray(save.guns))save.guns=['bullet'];
  if(typeof GUNS!=='undefined')save.guns=save.guns.filter(function(id){return GUNS.some(function(x){return x.id===id;});});
  if(save.guns.indexOf('bullet')<0)save.guns.unshift('bullet');
  if(save.guns.indexOf(save.selectedGun)<0)save.selectedGun='bullet';
  if(!Array.isArray(save.pets))save.pets=['scout'];
  if(typeof PETS!=='undefined')save.pets=save.pets.filter(function(id){return PETS.some(function(x){return x.id===id;});});
  if(save.pets.indexOf('scout')<0)save.pets.unshift('scout');
  if(!Array.isArray(save.ownedSkills))save.ownedSkills=[];
  if(typeof SKILLS!=='undefined')save.ownedSkills=save.ownedSkills.filter(function(id){return SKILLS.some(function(x){return x.id===id;});});
  if(save.pets.indexOf(save.selectedPet)<0)save.selectedPet='scout';
  if(!Array.isArray(save.startingUpgrades))save.startingUpgrades=[];
  // Normalize inventory against real catalog IDs so corrupted/duplicated saves
  // cannot inflate Global Champion's item count or break shop state.
  var uniq=function(arr){var out=[],seen={};for(var ui=0;ui<arr.length;ui++){var id=String(arr[ui]||'');if(!id||seen[id])continue;seen[id]=true;out.push(id);}return out;};
  save.ownedSkills=uniq(save.ownedSkills);
  save.startingUpgrades=uniq(save.startingUpgrades);
  save.ships=uniq(Array.isArray(save.ships)?save.ships:['default']);
  save.shapes=uniq(Array.isArray(save.shapes)?save.shapes:['square']);
  save.guns=uniq(Array.isArray(save.guns)?save.guns:['bullet']);
  save.pets=uniq(Array.isArray(save.pets)?save.pets:['scout']);
  if(!Array.isArray(save.unlockedLevels))save.unlockedLevels=[0];
  if(save.selectedSkill&&save.ownedSkills.indexOf(save.selectedSkill)<0)save.selectedSkill=null;
  if(save.unlockedLevels.indexOf(0)<0)save.unlockedLevels.push(0);
  if(!save.achievements||typeof save.achievements!=='object')save.achievements={};
  if(!save.winFlags||typeof save.winFlags!=='object')save.winFlags={};
  if(!save.noHitFlags||typeof save.noHitFlags!=='object')save.noHitFlags={};
  if(!save.usedVouchers||typeof save.usedVouchers!=='object')save.usedVouchers={};
  if(!save.gunUpgrades||typeof save.gunUpgrades!=='object')save.gunUpgrades={};
  if(!save.shipUpgrades||typeof save.shipUpgrades!=='object')save.shipUpgrades={};
  if(!save.skillUpgrades||typeof save.skillUpgrades!=='object')save.skillUpgrades={};
  if(!save.bestKills||typeof save.bestKills!=='object')save.bestKills={};
  if(typeof save.kills!=='number'||!isFinite(save.kills)||save.kills<0)save.kills=0;
  if(typeof save.totalKills!=='number'||!isFinite(save.totalKills)||save.totalKills<0)save.totalKills=0;
  if(typeof save.level!=='number'||!isFinite(save.level)||save.level<1)save.level=1;
  if(save.level>MAX_LEVEL)save.level=MAX_LEVEL;
  if(typeof save.xp!=='number'||!isFinite(save.xp)||save.xp<0)save.xp=0;
  if(typeof save.totalXp!=='number'||!isFinite(save.totalXp)||save.totalXp<0)save.totalXp=0;
  if(typeof save.trophies!=='number'||!isFinite(save.trophies)||save.trophies<0)save.trophies=0;
  if(typeof save.mpGifts!=='number'||!isFinite(save.mpGifts)||save.mpGifts<0)save.mpGifts=0;
  if(typeof save.soundVol!=='number'||!isFinite(save.soundVol))save.soundVol=80;
  save.soundVol=Math.max(0,Math.min(100,save.soundVol));
  if(typeof save.bgmVol!=='number'||!isFinite(save.bgmVol))save.bgmVol=50;
  save.bgmVol=Math.max(0,Math.min(100,save.bgmVol));
  if(typeof save.shakeAmt!=='number'||!isFinite(save.shakeAmt))save.shakeAmt=100;
  save.shakeAmt=Math.max(0,Math.min(200,save.shakeAmt));
  if(typeof save.bgmOn!=='boolean')save.bgmOn=true;
  if(typeof save.expertWins!=='number'||!isFinite(save.expertWins)||save.expertWins<0)save.expertWins=0;
  if(typeof save.hardWins!=='number'||!isFinite(save.hardWins)||save.hardWins<0)save.hardWins=0;
  if(typeof save.nightmareWins!=='number'||!isFinite(save.nightmareWins)||save.nightmareWins<0)save.nightmareWins=0;
  if(typeof save.impossibleWins!=='number'||!isFinite(save.impossibleWins)||save.impossibleWins<0)save.impossibleWins=0;
  if(typeof save.doomWins!=='number'||!isFinite(save.doomWins)||save.doomWins<0)save.doomWins=0;
  if(typeof save.rrrorWins!=='number'||!isFinite(save.rrrorWins)||save.rrrorWins<0)save.rrrorWins=0;
  if(typeof save.finalWins!=='number'||!isFinite(save.finalWins)||save.finalWins<0)save.finalWins=0;
  if(typeof save.bossKills!=='number'||!isFinite(save.bossKills)||save.bossKills<0)save.bossKills=0;
  if(typeof save.mpWins!=='number'||!isFinite(save.mpWins)||save.mpWins<0)save.mpWins=0;
  if(typeof save.endlessBest!=='number'||!isFinite(save.endlessBest))save.endlessBest=0;
  if(!save.challengeBests||typeof save.challengeBests!=='object')save.challengeBests={nohit:0,pistol:0,speed:0,bossrush:0};
  if(!save.friends||typeof save.friends!=='object')save.friends={};
  if(!save.friendRequests||typeof save.friendRequests!=='object')save.friendRequests={};
  if(!save.friendSent||typeof save.friendSent!=='object')save.friendSent={};
  if(!save.storyClaimed||typeof save.storyClaimed!=='object')save.storyClaimed={};
  ensureDailyQuest();
  if(!save.globalId)save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  if(typeof save.playerName!=='string')save.playerName='';
  if(typeof save.campaignChapter!=='number'||save.campaignChapter<1)save.campaignChapter=1;
  if(!save.campaignDialogSeen||typeof save.campaignDialogSeen!=='object')save.campaignDialogSeen={};
  if(typeof save.mpPersonalKills!=='number'||!isFinite(save.mpPersonalKills))save.mpPersonalKills=0;
  if(typeof save.mpTeamKills!=='number'||!isFinite(save.mpTeamKills)||save.mpTeamKills<0)save.mpTeamKills=0;
  if(typeof save.lastLevelId!=='number'||!isFinite(save.lastLevelId)||save.lastLevelId<0)save.lastLevelId=0;
  if(typeof save.lastPlayedAt!=='number'||!isFinite(save.lastPlayedAt)||save.lastPlayedAt<0)save.lastPlayedAt=0;
  if(typeof save.dailyStreak!=='number'||!isFinite(save.dailyStreak)||save.dailyStreak<0)save.dailyStreak=0;
  if(typeof save.dailyLastComplete!=='string')save.dailyLastComplete='';
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
    try{if(window.MP_queueCloudSave)window.MP_queueCloudSave();}catch(e){}
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
  if(leveled>0){try{sfxUpg();}catch(e){}try{showToast('Naik ke Level '+save.level+'!','success',2800);}catch(e){}}
  killDirty=true;
  try{updateMenuCard();}catch(e){console.error('XP menu refresh error',e);}
  try{updateMPLevelBadge();}catch(e){console.error('XP MP badge refresh error',e);}
  return leveled;
}

function grantKP(amount){
  if(!amount||amount<=0)return;
  save.kills+=amount;save.totalKills+=amount;
  addXP(amount);
  killDirty=true;
  try{refreshHeaderKills();}catch(e){console.error('KP header refresh error',e);}
  try{refreshProfile();}catch(e){console.error('KP profile refresh error',e);}
}

var STORY_CHAPTERS=[
  {id:1,title:'SINYA RETAK',desc:'Sinyal darurat datang dari sektor yang seharusnya sudah mati. Log pertama menyebut satu nama yang tidak tercatat di arsip armada.',levels:[0,1,2],reward:750,xp:180,accent:'#67c7f0',tone:'AWAL // TENANG SEBELUM RETAK',quote:'COMMAND // Sinyal itu memakai kode armada lama. Tapi armada itu sudah hilang tujuh tahun lalu.',fragment:'FIELD FRAGMENT 01 // Rekaman lama berhenti tepat 14 detik sebelum armada menghilang. Ada satu pilot yang tidak pernah tercatat sebagai korban.',log:[['COMMAND','Jangan balas sinyalnya. Kita cuma perlu tahu dari mana asalnya.'],['PILOT','Kalau mereka masih di sana, kita tidak bisa pura-pura tidak dengar.'],['SYSTEM','Koreksi: ada sesuatu yang sedang membalas.']]},
  {id:2,title:'SERANGAN BALIK',desc:'Musuh berhenti menguji pertahanan. Mereka mulai memburu sumber sinyal—dan kapalmu ikut masuk daftar target.',levels:[3,4,5],reward:1800,xp:360,accent:'#3ddc97',tone:'KONTAK // MEREKA SUDAH TAHU',quote:'PILOT // Mereka bukan menyerang pangkalan. Mereka mencari sesuatu di belakang kita.',fragment:'FIELD FRAGMENT 02 // Semua unit musuh mengabaikan kapal lain ketika pilot ini berada dalam jangkauan. Seolah-olah namanya sudah ada di daftar perintah mereka.',log:[['COMMAND','Unit berat masuk dari tiga vektor. Mereka tahu jalur kita.'],['PILOT','Berarti ada yang membocorkan rute.'],['COMMAND','Atau mereka sudah hafal sebelum perang dimulai.']]},
  {id:3,title:'JANTUNG KEGELAPAN',desc:'Jejak membawa armada ke pusat anomali. Sensor mulai berbohong, dan beberapa rekaman menunjukkan kapal yang belum pernah dibuat.',levels:[6,7,8],reward:4000,xp:700,accent:'#9b6bff',tone:'ANOMALI // RUANG TIDAK LAGI PATUH',quote:'SYSTEM // Sumber energi bukan berada di dalam sektor. Sektor ini berada di dalam sumber energi.',fragment:'FIELD FRAGMENT 03 // Kamera hitam selama 0,7 detik. Saat menyala kembali, log menunjukkan kapalmu sudah berada di lokasi yang belum kamu datangi.',log:[['SYSTEM','Geometri ruang tidak konsisten. Jarak ke target berubah setiap detik.'],['PILOT','Jadi kita tidak sedang mendekati pusatnya.'],['COMMAND','Tidak. Pusatnya yang sedang mendekati kita.']]},
  {id:4,title:'PERANG VORTEX',desc:'Gerbang pertahanan terakhir aktif. Vortex dan Nova bukan sekadar penjaga—mereka dibuat untuk memastikan tidak ada yang keluar.',levels:[9,10,11],reward:8500,xp:1200,accent:'#ff77a9',tone:'VORTEX // MEREKA MEMPREDIKSI KITA',quote:'COMMAND // Kalau gerbang itu terbuka penuh, sektor ini tidak akan punya sisi luar lagi.',fragment:'FIELD FRAGMENT 04 // Pola serangan berubah sepersekian detik sebelum input pilot tercatat. Seseorang—atau sesuatu—mungkin melihat keputusan pilot sebelum keputusan itu dibuat.',log:[['PILOT','Vortex bergerak seperti tahu ke mana aku akan menghindar.'],['SYSTEM','Prediksi musuh mendahului input pilot.'],['COMMAND','Jangan lawan prediksinya. Rusakkan polanya.']]},
  {id:5,title:'AKHIR SEMESTA',desc:'Gerbang terakhir terbuka. Di baliknya bukan markas musuh, melainkan rekaman asal-usul perang yang selama ini disembunyikan.',levels:[12,14,15],reward:20000,xp:2500,accent:'#ffc857',tone:'COLLAPSE // SUMBERNYA ADA DI DALAM',quote:'SYSTEM // Sinyal pertama berasal dari kapalmu sendiri.',fragment:'FIELD FRAGMENT 05 // Blackbox mencatat satu perintah yang dikirim tujuh tahun lalu: PILOT-01, kembali. Tidak ada catatan bahwa perintah itu pernah selesai.',log:[['COMMAND','Matikan gerbangnya. Jangan baca apa pun yang ada di sana.'],['PILOT','Terlambat. Aku sudah melihat log-nya.'],['SYSTEM','IDENTITAS PENGIRIM: PILOT-01. STATUS: AKTIF.'],['PILOT','...Itu nama kapalku.']] }
];
var CAMPAIGN_DIALOGUES={
  1:[['COMMAND','Radar nyala. Mereka masuk sektor kita.'],['PILOT','Aku buka jalurnya.']],
  2:[['COMMAND','Unit berat di depan. Jangan kasih ruang.'],['PILOT','Dimengerti. Gas terus.']],
  3:[['SYSTEM','Sumber energi gelap terdeteksi.'],['COMMAND','Hantam intinya sebelum mereka bangkit.']],
  4:[['PILOT','Vortex di depan.'],['COMMAND','Tetap di jalur. Penjaganya beda kelas.']],
  5:[['COMMAND','Gerbang terakhir terbuka.'],['SYSTEM','Target datang bergantian. Jangan berhenti.'],['PILOT','Selesai di sini.']]
};
var campaignDialogQueue=[],campaignDialogIndex=0;

function closeCampaignDialog(){var box=document.getElementById('dialogueBox');if(!box)return;if(campaignDialogIndex<campaignDialogQueue.length-1){campaignDialogIndex++;box._render&&box._render();return;}box.classList.remove('on');var cb=box._after;box._after=null;if(cb)cb();}



var LEVEL_STORIES={
  0:[['COMMAND','Mesin aman. Jangan kirim balasan ke sinyal asing.'],['PILOT','Kalau begitu kenapa sinyalnya memakai kode kita?']],
  1:[['COMMAND','Sektor bersih. Sinyalnya pindah lagi.'],['PILOT','Seolah-olah ia tahu kita mengejarnya.']],
  2:[['COMMAND','Kontak banyak. Mereka menutup jalur pulang.'],['PILOT','Berarti sumber sinyal ada di depan.']],
  3:[['COMMAND','Pertahanan kedua runtuh. Musuh mulai mengubah formasi.'],['PILOT','Mereka belajar dari gerakanku.']],
  4:[['COMMAND','Unit elit masuk orbit. Mereka tidak mengejar armada lain.'],['PILOT','Mereka mengejar kapalku.']],
  5:[['COMMAND','Sesuatu besar baru aktif. Semua radar mengarah ke sana.'],['PILOT','Aku tidak suka kalau sistem kita sendiri ikut panik.']],
  6:[['COMMAND','Sensor mulai kacau. Jarak target tidak masuk akal.'],['PILOT','Kalau sensor bohong, aku pakai mata.']],
  7:[['COMMAND','DOOM membuka jalur serang. Tidak ada rute aman.'],['PILOT','Tidak perlu aman. Cukup ada satu rute.']],
  8:[['COMMAND','4RROR. Pola serangan berubah sebelum kita merespons.'],['PILOT','Mereka bukan membaca gerakanku. Mereka memprediksinya.']],
  9:[['COMMAND','CHAOS aktif. Arena kehilangan pola normal.'],['PILOT','Bagus. Berarti mereka juga kehilangan keunggulan.']],
  10:[['COMMAND','VORTEX menarik semua objek ke pusat.'],['PILOT','Pusatnya bergerak mendekat.']],
  11:[['COMMAND','NOVA. Energi tinggi. Gerbang hampir penuh.'],['PILOT','Kalau aku hancurkan penjaganya, gerbang ikut runtuh?']],
  12:[['COMMAND','Gerbang akhir terbuka. Jangan lihat apa yang ada di baliknya.'],['PILOT','Terlambat. Aku sudah melihatnya.']],
  14:[['COMMAND','Singularitas mulai runtuh. Log lama mulai terbaca.'],['SYSTEM','IDENTITAS PENGIRIM: PILOT-01.']],
  15:[['COMMAND','FINAL COLLAPSE. Semua target aktif.'],['SYSTEM','Sinyal pertama berasal dari kapalmu. Dan tujuh tahun lalu, seseorang mengirim perintah untuk membawamu pulang.'],['PILOT','Jadi perang ini... dimulai dari sini.']]
};
function showLevelStory(level,after){
  var lines=LEVEL_STORIES[level.id]||[['COMMAND','Operasi dimulai.'],['PILOT','Jalankan misi.']];
  var box=document.getElementById('dialogueBox');
  if(!box||!lines.length){if(after)after();return;}
  var idx=0;appState='campaignDialog';
  box.classList.add('on');
  function render(){
    var b=box.querySelector('.dialogue-badge'),sp=box.querySelector('.dialogue-speaker'),tx=box.querySelector('.dialogue-text'),nx=box.querySelector('#dialogueNext');
    if(b)b.textContent='MISSION '+String(level.id).padStart(2,'0');
    if(sp)sp.textContent=lines[idx][0];
    if(tx)tx.textContent=lines[idx][1];
    if(nx)nx.textContent=idx<lines.length-1?'LANJUT':'MULAI';
  }
  box._after=after||null;box._levelStory=true;box._render=render;render();
}

function storyChapterUnlocked(index){
  var ch=STORY_CHAPTERS[index];
  return !!ch&&isChapterUnlocked(ch.id);
}
function storyChapterDone(ch){
  if(!ch)return false;
  for(var i=0;i<ch.levels.length;i++)if(!save.winFlags[ch.levels[i]])return false;
  return true;
}
function countWins(){
  var n=0;
  for(var k in save.winFlags)if(save.winFlags[k])n++;
  return n;
}
function ensureDailyQuest(){
  var now=new Date();var today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'),q=save.dailyQuest;
  if(!q||typeof q!=='object'||q.date!==today){
    save.dailyQuest={date:today,killsStart:save.totalKills||0,bossStart:save.bossKills||0,winsStart:countWins(),claimed:{}};
    killDirty=true;
    q=save.dailyQuest;
  }else if(!q.claimed||typeof q.claimed!=='object'){q.claimed={};save.dailyQuest=q;}
  return q;
}
function dailyQuestData(){
  var q=ensureDailyQuest();
  return [
    {id:'daily_kills',title:'PEMBURU',desc:'Kalahkan 50 musuh hari ini',goal:50,progress:Math.max(0,(save.totalKills||0)-(q.killsStart||0)),reward:300,xp:80},
    {id:'daily_boss',title:'PEMATAH BOSS',desc:'Kalahkan 2 boss hari ini',goal:2,progress:Math.max(0,(save.bossKills||0)-(q.bossStart||0)),reward:500,xp:120},
    {id:'daily_wins',title:'PILOT AKTIF',desc:'Menangkan 2 misi hari ini',goal:2,progress:Math.max(0,countWins()-(q.winsStart||0)),reward:700,xp:160}
  ];
}
function claimStoryReward(index){
  var ch=STORY_CHAPTERS[index];
  if(!ch||!storyChapterDone(ch)||save.storyClaimed[ch.id])return false;
  save.storyClaimed[ch.id]=true;
  grantKP(ch.reward);addXP(ch.xp);save.trophies=(save.trophies||0)+1;
  killDirty=true;persist();return true;
}
function claimDailyQuest(id){
  var qs=dailyQuestData(),q=null;
  for(var i=0;i<qs.length;i++)if(qs[i].id===id){q=qs[i];break;}
  var state=ensureDailyQuest();
  if(!q||state.claimed[q.id]||q.progress<q.goal)return false;
  state.claimed[q.id]=true;
  grantKP(q.reward);addXP(q.xp);
  killDirty=true;persist();return true;
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

var audioCtx=null,audioMaster=null,audioCompressor=null;
var bgmPlaying=false,bgmTimer=null,bgmStep=0,bgmMode='menu',lastShotSfx=0,lastHitSfx=0;
var adaptiveQuality=1,qualityEma=16.7,qualitySlowFrames=0,qualityFastFrames=0;

var howlerSfx=null,howlerSfxReady=false,howlerSfxLoading=false;
function initHowlerSfx(){
  if(howlerSfxReady||howlerSfxLoading||!window.Howl)return;
  howlerSfxLoading=true;
  try{
    howlerSfx=new Howl({
      src:['audio/danis-sfx.wav'],
      volume:Math.max(0,Math.min(1,(save.soundVol||0)/100)),
      sprite:{
        click:[0,44],shoot:[69,54],hit:[149,64],death:[239,160],
        boss:[424,569],victory:[1019,704],danger:[1749,320],buy:[2094,80]
      },
      onload:function(){howlerSfxReady=true;howlerSfxLoading=false;},
      onloaderror:function(){howlerSfxReady=false;howlerSfxLoading=false;howlerSfx=null;}
    });
  }catch(e){howlerSfxReady=false;howlerSfxLoading=false;howlerSfx=null;}
}
function playHowlerSfx(id){
  if(!howlerSfxReady||!howlerSfx)return false;
  try{howlerSfx.volume(Math.max(0,Math.min(1,(save.soundVol||0)/100)));howlerSfx.play(id);return true;}catch(e){return false;}
}
function initAudio(){
  if(!audioCtx){try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    audioMaster=audioCtx.createGain();
    audioMaster.gain.value=0.92;
    audioCompressor=audioCtx.createDynamicsCompressor();
    audioCompressor.threshold.value=-16;
    audioCompressor.knee.value=18;
    audioCompressor.ratio.value=4;
    audioCompressor.attack.value=0.006;
    audioCompressor.release.value=0.12;
    audioMaster.connect(audioCompressor);
    audioCompressor.connect(audioCtx.destination);
  }catch(e){audioCtx=null;audioMaster=null;audioCompressor=null;}}
  if(audioCtx&&audioCtx.state==='suspended'){try{audioCtx.resume();}catch(e){}}
  initHowlerSfx();
  if(window.DS_LIBS&&window.DS_LIBS.loadHowler&&!window.Howl){window.DS_LIBS.loadHowler().then(initHowlerSfx).catch(function(){});}
}
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
    o.connect(g);g.connect(audioMaster||audioCtx.destination);
    o.start(t);o.stop(t+dur+0.02);
  }catch(e){}
}
function sfxShoot(){
  var now=performance.now();
  if(now-lastShotSfx<42)return;
  lastShotSfx=now;
  if(playHowlerSfx('shoot'))return;
  var f=760+Math.random()*220;
  beep(f,0.035,'square',0.012,f*0.52);
}
function sfxLaser(){beep(1400,0.06,'sawtooth',0.018,520);}
function sfxHit(){
  var now=performance.now();
  if(now-lastHitSfx<28)return;
  lastHitSfx=now;
  if(playHowlerSfx('hit'))return;
  beep(220+Math.random()*70,0.045,'square',0.022,110);
}
function sfxDeath(){if(playHowlerSfx('death'))return;beep(180,0.14,'sawtooth',0.035,55);setTimeout(function(){beep(90,0.12,'triangle',0.025,45);},45);}
function sfxHeal(){beep(560,0.11,'sine',0.035,1120);setTimeout(function(){beep(840,0.08,'sine',0.025,1320);},55);}
function sfxRoar(){if(playHowlerSfx('boss'))return;beep(72,0.48,'sawtooth',0.065,34);setTimeout(function(){beep(96,0.38,'triangle',0.04,48);},85);setTimeout(function(){beep(128,0.3,'square',0.025,60);},170);}
function sfxWave(){beep(300,0.13,'triangle',0.03,620);setTimeout(function(){beep(620,0.16,'sine',0.03,980);},95);}
function sfxClick(){if(playHowlerSfx('click'))return;beep(540,0.028,'square',0.018,760);}
function sfxBuy(){if(playHowlerSfx('buy'))return;beep(720,0.06,'sine',0.035,1080);setTimeout(function(){beep(1080,0.09,'sine',0.03,1440);},65);}
function sfxUpg(){beep(430,0.07,'square',0.035,760);setTimeout(function(){beep(760,0.09,'triangle',0.035,1180);},75);setTimeout(function(){beep(1180,0.13,'sine',0.035,1660);},155);}
function sfxBossDie(){if(playHowlerSfx('boss'))return;beep(180,0.28,'sawtooth',0.055,48);setTimeout(function(){beep(300,0.24,'triangle',0.04,75);},125);setTimeout(function(){beep(620,0.42,'sine',0.04,980);},260);}
function sfxAch(){beep(620,0.08,'sine',0.035);setTimeout(function(){beep(830,0.09,'sine',0.035);},85);setTimeout(function(){beep(1240,0.18,'sine',0.04);},175);}
function sfxPower(){beep(460,0.07,'square',0.035,820);setTimeout(function(){beep(820,0.1,'sine',0.035,1260);},65);}
function sfxStreak(){beep(700,0.05,'square',0.035,1180);setTimeout(function(){beep(980,0.07,'sine',0.03,1500);},55);}
function sfxPoison(){beep(290,0.08,'sine',0.03,150);setTimeout(function(){beep(210,0.07,'triangle',0.02,120);},50);}
function sfxBomb(){beep(100,0.25,'sawtooth',0.06,38);setTimeout(function(){beep(180,0.17,'square',0.035,55);},70);}
function sfxUnlock(){beep(620,0.09,'sine',0.04);setTimeout(function(){beep(860,0.11,'sine',0.04);},90);setTimeout(function(){beep(1220,0.16,'sine',0.04);},190);}
function sfxVoucherOk(){beep(580,0.08,'sine',0.04);setTimeout(function(){beep(820,0.08,'sine',0.04);},85);setTimeout(function(){beep(1120,0.12,'sine',0.04);},170);setTimeout(function(){beep(1540,0.18,'sine',0.04);},270);}
function sfxVoucherBad(){beep(190,0.12,'square',0.04,95);setTimeout(function(){beep(130,0.16,'square',0.035,70);},105);}
function sfxSecret(){beep(420,0.045,'square',0.035);setTimeout(function(){beep(620,0.045,'square',0.035);},60);setTimeout(function(){beep(880,0.05,'square',0.035);},120);setTimeout(function(){beep(1320,0.13,'sine',0.04);},185);}
function sfxMP(){beep(560,0.07,'triangle',0.035);setTimeout(function(){beep(880,0.1,'sine',0.035);},70);setTimeout(function(){beep(1120,0.12,'sine',0.025);},145);}
function sfxRevive(){beep(440,0.09,'sine',0.04);setTimeout(function(){beep(660,0.1,'sine',0.04);},85);setTimeout(function(){beep(980,0.15,'sine',0.04);},175);}
function sfxEmoji(){beep(820,0.04,'sine',0.025);setTimeout(function(){beep(1180,0.07,'sine',0.025);},45);}
function sfxGift(){beep(540,0.05,'sine',0.035);setTimeout(function(){beep(760,0.05,'sine',0.035);},55);setTimeout(function(){beep(1040,0.06,'sine',0.035);},110);setTimeout(function(){beep(1440,0.13,'sine',0.035);},175);}
function sfxVictory(){if(playHowlerSfx('victory'))return;beep(520,0.1,'sine',0.045);setTimeout(function(){beep(660,0.1,'sine',0.045);},105);setTimeout(function(){beep(880,0.12,'sine',0.045);},215);setTimeout(function(){beep(1320,0.3,'sine',0.04);},335);}
function sfxDanger(){if(playHowlerSfx('danger'))return;beep(170,0.1,'sawtooth',0.035,90);setTimeout(function(){beep(115,0.14,'square',0.025,65);},85);}
function sfxSpin(){beep(520,0.045,'square',0.03);setTimeout(function(){beep(700,0.045,'square',0.03);},48);setTimeout(function(){beep(930,0.05,'square',0.03);},96);setTimeout(function(){beep(1260,0.11,'sine',0.035);},150);}

function setMusicMode(mode){
  bgmMode=mode||'menu';
  if(bgmPlaying){stopBGM();if(save.bgmOn)startBGM();}
}
function getMusicProfile(){
  var mode=bgmMode;
  if(mode==='combat'&&currentLevel){
    var id=Number(currentLevel.id)||0;
    if(id>=15)return {bpm:128,root:55,scale:[0,3,5,7,10],lead:[0,7,10,12,10,7,3,5],bass:[0,0,5,3],energy:1.35};
    if(id>=12)return {bpm:122,root:55,scale:[0,3,5,7,10],lead:[0,5,7,10,7,5,3,0],bass:[0,0,3,5],energy:1.18};
    if(id>=9)return {bpm:116,root:65,scale:[0,2,3,5,7,10],lead:[0,3,7,5,10,7,3,2],bass:[0,3,5,3],energy:1.0};
    return {bpm:108,root:73,scale:[0,2,3,5,7,9,10],lead:[0,5,7,9,7,5,3,2],bass:[0,5,3,7],energy:.86};
  }
  if(mode==='mp')return {bpm:114,root:62,scale:[0,2,4,7,9],lead:[0,4,7,9,7,4,2,0],bass:[0,0,7,5],energy:1.0};
  if(mode==='victory')return {bpm:100,root:65,scale:[0,2,4,7,9],lead:[0,4,7,12,9,7,4,2],bass:[0,0,7,5],energy:.7};
  if(mode==='story')return {bpm:76,root:55,scale:[0,2,3,7,9],lead:[0,7,9,7,3,2,0,-2],bass:[0,0,3,7],energy:.45};
  if(mode==='hangar')return {bpm:92,root:73,scale:[0,2,4,7,9],lead:[0,2,4,7,9,7,4,2],bass:[0,7,5,3],energy:.5};
  return {bpm:96,root:65,scale:[0,2,4,7,9],lead:[0,4,7,9,7,4,2,0],bass:[0,0,7,5],energy:.55};
}
function midiToHz(n){return 440*Math.pow(2,(n-69)/12);}
function musicVoice(freq,dur,type,vol,when){
  if(!audioCtx)return;
  try{
    var t=when||audioCtx.currentTime,g=audioCtx.createGain(),o=audioCtx.createOscillator();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+0.025);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(audioMaster||audioCtx.destination);o.start(t);o.stop(t+dur+0.02);
  }catch(e){}
}
function startBGM(){
  if(!audioCtx||!save.bgmOn||bgmPlaying)return;
  bgmPlaying=true;bgmStep=0;
  function schedule(){
    if(!bgmPlaying||!audioCtx||!save.bgmOn)return;
    var p=getMusicProfile(),beat=60/p.bpm,t=audioCtx.currentTime,step=bgmStep++,e=p.energy*(save.bgmVol/100)*0.045;
    var scale=p.scale,lead=p.lead,bass=p.bass;
    var leadDeg=lead[step%lead.length],oct=(step%8===4?12:0),semi=scale[Math.abs(leadDeg)%scale.length]+oct;
    musicVoice(midiToHz(48+p.root%12+semi),beat*.72,'triangle',e*.72,t);
    if(step%2===0){var b=bass[(step/2)%bass.length|0];musicVoice(midiToHz(36+p.root%12+b),beat*1.6,'sine',e*.9,t);}
    if(step%4===0){
      var chord=[0,4,7];for(var c=0;c<chord.length;c++)musicVoice(midiToHz(60+p.root%12+chord[c]),beat*3.4,'sine',e*.12,t);
    }
    if(p.energy>.8 && step%2===1)musicVoice(midiToHz(72+p.root%12+(scale[step%scale.length])),beat*.16,'square',e*.18,t);
    bgmTimer=setTimeout(schedule,Math.max(90,beat*1000));
  }
  schedule();
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
  {id:'voidPet',name:'VOID COMPANION',desc:'Rantai petir otomatis ke musuh',cost:6500,icon:'voidPet',type:'mage',tagLabel:'MAGE',chapter:4,chainDmg:22,chainInterval:1.3},
  {id:'pulse',name:'PULSE DRONE',desc:'Menembak burst pendek; kuat saat kamu aktif menyerang',cost:7600,icon:'scout',type:'attacker',tagLabel:'ATTACKER',chapter:4,baseDmg:30,rof:0.55,range:340},
  {id:'echo',name:'ECHO CORE',desc:'Bonus damage kecil yang konsisten tanpa auto-target berlebihan',cost:5200,icon:'ammo',type:'buffer',tagLabel:'BUFFER',chapter:4,dmgMult:1.16},
  {id:'apex',name:'APEX DRONE',desc:'Drone elit dengan tembakan berantai',cost:18000,icon:'scout',type:'attacker',tagLabel:'ELITE',chapter:5,baseDmg:70,rof:0.38,range:420},
  {id:'oracle',name:'ORACLE CORE',desc:'Core elit dengan serangan rantai',cost:22000,icon:'voidPet',type:'mage',tagLabel:'ELITE',chapter:5,chainDmg:55,chainInterval:0.8},
  {id:'aegis',name:'AEGIS PRIME',desc:'Perisai elit dengan shield berkala',cost:26000,icon:'barrier',type:'tank',tagLabel:'ELITE',chapter:5,armor:0.22,shieldDuration:4,interval:10},
  {id:'viper',name:'VIPER DRONE',desc:'Jet drone agresif dengan burst cepat',cost:11000,icon:'scout',type:'attacker',tagLabel:'ELITE',chapter:5,baseDmg:48,rof:0.46,range:390},
  {id:'nova',name:'NOVA SENTINEL',desc:'Drone energi dengan damage tinggi dan stabil',cost:14500,icon:'ammo',type:'attacker',tagLabel:'ELITE',chapter:5,baseDmg:58,rof:0.52,range:410}
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
  {id:'voidbeam',name:'SINAR KOSONG',desc:'Tembakan beam cepat otomatis',cost:5000,cooldown:20,duration:5,icon:'voidbeam',chapter:4},
  {id:'overdrive',name:'OVERDRIVE',desc:'Damage 3x selama 6 detik',cost:9000,cooldown:22,duration:6,icon:'rage',chapter:5},
  {id:'stasis',name:'STASIS TOTAL',desc:'Musuh melambat drastis',cost:12000,cooldown:24,duration:7,icon:'snow',chapter:5},
  {id:'phoenix',name:'PHOENIX',desc:'Pemulihan darurat besar',cost:15000,cooldown:30,duration:0,icon:'heart',chapter:5}
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
  {id:'shieldShape',name:'PERISAI',cost:7500,desc:'Formasi pertahanan total',icon:'shieldShape',passiveDesc:'-25% dmg, +20% HP',passive:{armorMult:0.75,hpMult:1.20},chapter:4},
  {id:'halo',name:'HALO',cost:11000,desc:'Formasi energi bercincin',icon:'circleShape',passiveDesc:'+18% HP, +12% Dodge',passive:{hpMult:1.18,dodgeChance:0.12},chapter:5},
  {id:'voidstar',name:'VOID STAR',cost:16000,desc:'Fokus damage dan critical',icon:'star',passiveDesc:'+25% DMG, +20% Crit',passive:{dmgMult:1.25,critChance:0.20},chapter:5}
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
  {id:'deathray',name:'SINAR MAUT',desc:'Beam cepat, tembus semua',cost:7500,icon:'deathray',dmgMult:12.0,speedMult:2.2,size:5,count:1,spreadAng:0,homing:false,pierce:99,zigzag:false,explosive:false,rofMult:1.8,life:3,chapter:4},
  {id:'boomerang',name:'BOOMERANG',desc:'Proyektil berbalik untuk serangan kedua',cost:4700,icon:'zigzag',dmgMult:7.5,speedMult:1.1,size:7,count:1,spreadAng:0,homing:false,pierce:2,zigzag:true,explosive:false,rofMult:1.1,life:4,chapter:3},
  {id:'burst',name:'BURST CORE',desc:'Tiga ledakan cepat dengan recoil tinggi',cost:5800,icon:'triple',dmgMult:5.2,speedMult:1.25,size:5,count:3,spreadAng:0.12,homing:false,pierce:0,zigzag:false,explosive:true,explosionR:28,rofMult:1.2,life:2.5,chapter:3},
  {id:'nova',name:'NOVA',desc:'Ledakan besar, lambat tapi menghancurkan',cost:8200,icon:'plasma',dmgMult:19.0,speedMult:0.45,size:15,count:1,spreadAng:0,homing:false,pierce:2,zigzag:false,explosive:true,explosionR:95,rofMult:0.55,life:4,chapter:4},
  {id:'voidshot',name:'VOID SHOT',desc:'Peluru gelap menembus musuh dan bergerak cepat',cost:9800,icon:'voidbeam',dmgMult:16.0,speedMult:2.0,size:6,count:1,spreadAng:0,homing:false,pierce:5,zigzag:false,explosive:false,rofMult:1.35,life:3.5,chapter:4},
  {id:'railgun',name:'RAILGUN',desc:'Proyektil super cepat dengan daya tembus tinggi',cost:11200,icon:'deathray',dmgMult:30.0,speedMult:3.2,size:4,count:1,spreadAng:0,homing:false,pierce:6,zigzag:false,explosive:false,rofMult:0.42,life:3.5,chapter:4},
  {id:'vortex',name:'VORTEX',desc:'Inti gravitasi mengejar target lalu meledak',cost:12800,icon:'voidbeam',dmgMult:11.0,speedMult:0.8,size:11,count:1,spreadAng:0,homing:true,pierce:1,zigzag:false,explosive:true,explosionR:88,rofMult:0.85,life:4,chapter:4},
  {id:'drill',name:'DRILL SHOT',desc:'Peluru bor menembus banyak musuh',cost:14500,icon:'heavy',dmgMult:10.5,speedMult:2.4,size:8,count:1,spreadAng:0,homing:false,pierce:10,zigzag:false,explosive:false,rofMult:0.95,life:3.2,chapter:4},
  {id:'scatterbomb',name:'SCATTER BOMB',desc:'Semburan tujuh bom kecil dengan ledakan berantai',cost:16000,icon:'rocket',dmgMult:5.8,speedMult:1.0,size:6,count:7,spreadAng:0.72,homing:false,pierce:0,zigzag:false,explosive:true,explosionR:46,rofMult:0.7,life:1.6,chapter:4}
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

var THEME_MENU={bgTop:'#050b13',bgBottom:'#0b1724',edge:'#53d7e8',particles:['rgba(83,215,232,ALPHA)','rgba(255,191,75,ALPHA)','rgba(255,255,255,ALPHA)']};
var THEME_TUTORIAL={bgTop:'#081522',bgBottom:'#0c2634',edge:'#53d7e8',particles:['rgba(220,250,255,ALPHA)','rgba(83,215,232,ALPHA)'],intensity:.18,pattern:'grid'};
var THEME_EASY={bgTop:'#071a18',bgBottom:'#0b3027',edge:'#3ddc97',particles:['rgba(220,255,242,ALPHA)','rgba(61,220,151,ALPHA)'],intensity:.24,pattern:'lanes'};
var THEME_MEDIUM={bgTop:'#1b1608',bgBottom:'#30250b',edge:'#ffc857',particles:['rgba(255,235,170,ALPHA)','rgba(255,200,87,ALPHA)'],intensity:.30,pattern:'rings'};
var THEME_HARD={bgTop:'#200d0b',bgBottom:'#3a1610',edge:'#ff6b4a',particles:['rgba(255,180,150,ALPHA)','rgba(255,107,74,ALPHA)'],intensity:.38,pattern:'diagonal'};
var THEME_EXPERT={bgTop:'#160d2b',bgBottom:'#28164a',edge:'#9b6bff',particles:['rgba(220,190,255,ALPHA)','rgba(155,107,255,ALPHA)'],intensity:.46,pattern:'rings'};
var THEME_NIGHTMARE={bgTop:'#2a1030',bgBottom:'#5a1030',edge:'#ff2d55',particles:['rgba(255,80,120,ALPHA)','rgba(180,60,255,ALPHA)','rgba(255,200,120,ALPHA)'],intensity:.54,pattern:'pulse'};
var THEME_IMPOSSIBLE={bgTop:'#1a0a1a',bgBottom:'#2a1030',edge:'#442244',particles:['rgba(120,60,120,ALPHA)','rgba(180,80,80,ALPHA)','rgba(80,80,160,ALPHA)'],intensity:.62,pattern:'void'};
var THEME_DOOM={bgTop:'#000000',bgBottom:'#0a0000',edge:'#8a0000',particles:['rgba(60,0,0,ALPHA)','rgba(120,0,0,ALPHA)','rgba(180,20,20,ALPHA)'],intensity:.72,pattern:'fracture'};
var THEME_RRROR={bgTop:'#000000',bgBottom:'#1a0000',edge:'#ff0000',particles:['rgba(255,0,0,ALPHA)','rgba(150,0,0,ALPHA)','rgba(255,60,60,ALPHA)'],rising:true,intensity:.82,pattern:'alarm'};
var THEME_CHAOS={bgTop:'#2a0a3a',bgBottom:'#5a1a5a',edge:'#c840ff',particles:['rgba(200,80,255,ALPHA)','rgba(255,80,200,ALPHA)','rgba(120,0,180,ALPHA)'],intensity:.88,pattern:'chaos'};
var THEME_VORTEX={bgTop:'#0a1a3a',bgBottom:'#1a0a4a',edge:'#4090ff',particles:['rgba(80,150,255,ALPHA)','rgba(150,80,255,ALPHA)','rgba(255,255,255,ALPHA)'],rising:true,intensity:.92,pattern:'vortex'};
var THEME_NOVA={bgTop:'#3a1a00',bgBottom:'#7a2a0a',edge:'#ff8a00',particles:['rgba(255,180,60,ALPHA)','rgba(255,100,40,ALPHA)','rgba(255,255,180,ALPHA)'],intensity:.96,pattern:'solar'};
var THEME_GATE={bgTop:'#17060b',bgBottom:'#3a0b18',edge:'#ff5c8a',particles:['rgba(255,92,138,ALPHA)','rgba(255,205,100,ALPHA)','rgba(190,110,255,ALPHA)'],intensity:.98,pattern:'gate'};
var THEME_ENDLESS={bgTop:'#061b20',bgBottom:'#092d2a',edge:'#52e0b0',particles:['rgba(120,255,220,ALPHA)','rgba(82,224,176,ALPHA)','rgba(130,220,255,ALPHA)'],intensity:.36,pattern:'endless'};
var THEME_SINGULARITY={bgTop:'#090613',bgBottom:'#1d0b30',edge:'#c38cff',particles:['rgba(195,140,255,ALPHA)','rgba(90,230,255,ALPHA)','rgba(255,80,180,ALPHA)'],intensity:.97,pattern:'singularity',rising:true};
var THEME_FINAL={bgTop:'#020205',bgBottom:'#18000d',edge:'#ff0055',particles:['rgba(255,0,85,ALPHA)','rgba(255,200,0,ALPHA)','rgba(155,107,255,ALPHA)'],intensity:1,pattern:'collapse'};

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
  {id:12,name:'GERBANG AKHIR',chapter:5,unlockCost:0,cardClass:'final',duration:220,theme:THEME_GATE,stageLength:30,enemiesPerSecond:0,baseMaxActive:0,maxActiveGrowth:0,maxActiveCap:0,hpMult:1.8,dmgMult:3.0,healFreqMult:4.0,throttleRatio:20.0,bossInterval:999,isEndless:false,bossesCanStack:false,spawnRateMult:0,isFinal:true,finalBossCount:6},
  {id:13,name:'ENDLESS SURVIVAL',chapter:1,unlockCost:0,cardClass:'endless',duration:Infinity,theme:THEME_ENDLESS,stageLength:10,enemiesPerSecond:3,baseMaxActive:8,maxActiveGrowth:1.5,maxActiveCap:80,hpMult:1,dmgMult:1,healFreqMult:1,throttleRatio:99,bossInterval:30,isEndless:true,bossesCanStack:true,spawnRateMult:1},
  {id:14,name:'SINGULARITAS',chapter:5,unlockCost:0,cardClass:'doom',duration:200,theme:THEME_SINGULARITY,stageLength:28,enemiesPerSecond:10,baseMaxActive:18,maxActiveGrowth:1.2,maxActiveCap:38,hpMult:3.2,dmgMult:6.0,healFreqMult:4.2,throttleRatio:14.0,bossInterval:18,isEndless:false,bossesCanStack:false,spawnRateMult:2.8},
  {id:15,name:'FINAL COLLAPSE',chapter:5,unlockCost:0,cardClass:'final',duration:240,theme:THEME_FINAL,stageLength:32,enemiesPerSecond:0,baseMaxActive:0,maxActiveGrowth:0,maxActiveCap:0,hpMult:2.2,dmgMult:4.0,healFreqMult:5.0,throttleRatio:24.0,bossInterval:999,isEndless:false,bossesCanStack:false,spawnRateMult:0,isFinal:true,finalBossCount:6}
];

var appState='menu';
var currentTheme=THEME_MENU;
function hexToRgba(hex,alpha){
  var h=String(hex||'#53d7e8').replace('#','');
  if(h.length===3)h=h.split('').map(function(x){return x+x;}).join('');
  var n=parseInt(h,16);
  if(!isFinite(n))return 'rgba(83,215,232,'+(alpha==null?.35:alpha)+')';
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+(alpha==null?.35:alpha)+')';
}
function themeFxColor(index,alpha){
  var pool=currentTheme&&currentTheme.particles;
  if(pool&&pool[index%pool.length])return pool[index%pool.length].replace('ALPHA',String(alpha==null?.35:alpha));
  return hexToRgba((currentTheme&&currentTheme.edge)||'#53d7e8',alpha==null?.35:alpha);
}
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
var nextBossTime,bossIndex,lastWaveShownAt,finalBossNext=0;
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
var dangerVignette=document.getElementById('dangerVignette');
var shopPreviewCtx=null,shopPreviewCanvas=null,shopPreviewAnim=null,shopPreviewFiring=0;
var shipFxTimer=0;
var mpBadgeXpText='';
var winShown=false;
var enemyIdCounter=0;
var isNetworkGame=false;
var onboardingActive=true;

window.DS_MP=window.DS_MP||{
  active:false,dead:false,globalMode:false,networkMode:false,sharedCombat:false,isGlobalHost:false,isHost:false,
  playersCache:{},myId:null,roomRef:null,playerRef:null,
  updateTimer:0,reviveCountdown:0,myKills:0,myKillCount:0,
  onPlayerDeath:null,onGameEnd:null,onTickDead:null,drawOtherPlayers:null,
  globalEnemiesCache:{},globalBossesCache:{},serverStartAt:0,serverEndAt:0,serverExpired:false
};
if(!window.DS_MP.globalEnemiesCache)window.DS_MP.globalEnemiesCache={};
if(!window.DS_MP.globalBossesCache)window.DS_MP.globalBossesCache={};

function amHost(){
  if(!window.DS_MP)return false;
  return !!(window.DS_MP.isGlobalHost||window.DS_MP.isHost);
}

function pushProfileToFirebase(){
  try{
    if(typeof firebase==='undefined'||!firebase.auth||!firebase.database)return;
    var cfg=window.FIREBASE_CONFIG||{};
    if(!cfg.databaseURL)return;
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    var au=firebase.auth().currentUser;
    if(!au)return;
    var db=firebase.database();
    var s=save;
    var uid=au.uid;
    s.globalId=uid;
    db.ref('users/'+uid).update({
      id:uid,
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
    }).catch(function(err){
      storageError='Firebase: '+(err&&err.code?err.code:'sinkronisasi gagal');
    });
  }catch(e){storageError='Firebase: '+(e&&e.code?e.code:'inisialisasi gagal');}
}

function lightenHex(hex,amt){
  var n=parseInt(hex.slice(1),16);
  var r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=Math.min(255,Math.round(r+(255-r)*amt));
  g=Math.min(255,Math.round(g+(255-g)*amt));
  b=Math.min(255,Math.round(b+(255-b)*amt));
  return 'rgb('+r+','+g+','+b+')';
}

function playArea(){
  var topSafe=Math.min(148,Math.max(92,H*0.14));
  var bottomSafe=Math.min(112,Math.max(58,H*0.085));
  PA.left=BORDER;PA.right=W-BORDER;PA.top=Math.max(BORDER,topSafe);PA.bottom=Math.min(H-BORDER,H-bottomSafe);
  if(PA.bottom<PA.top+BASE_SIZE*2.2){PA.top=BORDER;PA.bottom=H-BORDER;}
  return PA;
}
function edgeLeft(){return BORDER+EDGE_PAD;}
function edgeRight(){return W-BORDER-EDGE_PAD;}
function edgeTop(){return playArea().top+EDGE_PAD;}
function edgeBottom(){return playArea().bottom-EDGE_PAD;}

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
    lg.addColorStop(0,'rgba(255,255,255,0.10)');
    lg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=lg;
    g.fillRect(pa.left,pa.top,pa.right-pa.left,pa.bottom-pa.top);
  }
  g.fillStyle='rgba(255,255,255,0.22)';
  var step=44;
  for(var y=pa.top+step;y<pa.bottom;y+=step)for(var x=pa.left+step;x<pa.right;x+=step)g.fillRect(x,y,2,2);
  var decoId=currentLevel&&typeof currentLevel.id==='number'?currentLevel.id:0;
  var intensity=currentTheme.intensity||0.18;
  g.globalAlpha=0.08+intensity*0.18;
  g.strokeStyle=(currentTheme.particles&&currentTheme.particles[0]||'rgba(255,255,255,0.18)').replace('ALPHA',String(0.32+intensity*0.28));
  g.lineWidth=1.5+intensity*1.2;
  var pattern=currentTheme.pattern||(['grid','rings','diagonal','orbits','arc'][decoId%5]);
  if(pattern==='grid'){for(var gx=pa.left;gx<pa.right;gx+=64){g.beginPath();g.moveTo(gx,pa.top);g.lineTo(gx,pa.bottom);g.stroke();}for(var gy=pa.top;gy<pa.bottom;gy+=64){g.beginPath();g.moveTo(pa.left,gy);g.lineTo(pa.right,gy);g.stroke();}}
  else if(pattern==='lanes'){for(var lx=pa.left-100;lx<pa.right+100;lx+=100){g.beginPath();g.moveTo(lx,pa.bottom);g.lineTo(lx+70,pa.top);g.stroke();}}
  else if(pattern==='rings'||pattern==='pulse'){for(var cy=pa.top+50;cy<pa.bottom+80;cy+=120){for(var rr=28;rr<Math.min(W,H)*.30;rr+=42){g.beginPath();g.arc(W*.5,cy,rr,0,Math.PI*2);g.stroke();}}}
  else if(pattern==='diagonal'){for(var dy=pa.top-100;dy<pa.bottom+100;dy+=78){g.beginPath();g.moveTo(pa.left,dy);g.lineTo(pa.right,dy+95);g.stroke();}}
  else if(pattern==='void'){for(var vr=45;vr<Math.min(W,H)*.65;vr+=65){g.beginPath();g.arc(W*.5,H*.46,vr,0,Math.PI*2);g.stroke();}}
  else if(pattern==='fracture'||pattern==='alarm'){for(var fx=0;fx<10;fx++){var yy=pa.top+(fx/10)*(pa.bottom-pa.top);g.beginPath();g.moveTo(pa.left,yy);g.lineTo(W*.35,yy+(fx%2?24:-18));g.lineTo(W*.68,yy+(fx%3?10:-26));g.lineTo(pa.right,yy+(fx%2?-14:20));g.stroke();}}
  else if(pattern==='chaos'){for(var cx=pa.left-40;cx<pa.right+80;cx+=105){g.beginPath();g.arc(cx,H*.42,28+intensity*22,0,Math.PI*2);g.stroke();g.beginPath();g.arc(cx+35,H*.62,16+intensity*18,0,Math.PI*2);g.stroke();}}
  else if(pattern==='vortex'){for(var va=0;va<Math.PI*8;va+=.28){var vr2=10+va*11;var vx=W*.5+Math.cos(va)*vr2,vy=H*.46+Math.sin(va)*vr2*.55;var nx=W*.5+Math.cos(va+.28)*(vr2+11),ny=H*.46+Math.sin(va+.28)*(vr2+11)*.55;g.beginPath();g.moveTo(vx,vy);g.lineTo(nx,ny);g.stroke();}}
  else if(pattern==='solar'){for(var sr=0;sr<18;sr++){var sa=sr*Math.PI/9;g.beginPath();g.moveTo(W*.5+Math.cos(sa)*40,H*.42+Math.sin(sa)*40);g.lineTo(W*.5+Math.cos(sa)*(Math.min(W,H)*.58),H*.42+Math.sin(sa)*(Math.min(W,H)*.58));g.stroke();}}
  else if(pattern==='gate'){for(var gt=0;gt<5;gt++){var inset=24+gt*26;g.beginPath();g.rect(pa.left+inset,pa.top+inset,pa.right-pa.left-inset*2,pa.bottom-pa.top-inset*2);g.stroke();}}
  else if(pattern==='endless'){for(var ey=pa.top;ey<pa.bottom;ey+=56){g.beginPath();g.moveTo(pa.left,ey);g.lineTo(pa.right,ey);g.stroke();}for(var ex=pa.left;ex<pa.right;ex+=96){g.beginPath();g.moveTo(ex,pa.top);g.lineTo(ex,pa.bottom);g.stroke();}}
  else if(pattern==='singularity'){for(var si=0;si<14;si++){var sa2=si*Math.PI/7;var r1=35+si*7,r2=Math.min(W,H)*.62;g.beginPath();g.moveTo(W*.5+Math.cos(sa2)*r1,H*.47+Math.sin(sa2)*r1);g.quadraticCurveTo(W*.5,H*.47,W*.5+Math.cos(sa2+.7)*r2,H*.47+Math.sin(sa2+.7)*r2);g.stroke();}}
  else if(pattern==='collapse'){for(var cr=0;cr<9;cr++){var yy2=pa.top+cr*(pa.bottom-pa.top)/8;g.beginPath();g.moveTo(pa.left,yy2);g.quadraticCurveTo(W*.5,H*.5+(cr-4)*18,pa.right,yy2+(cr%2?14:-14));g.stroke();}}
  else{g.beginPath();g.moveTo(pa.left,H*.25);g.quadraticCurveTo(W*.5,H*.05,pa.right,H*.25);g.stroke();g.beginPath();g.moveTo(pa.left,H*.72);g.quadraticCurveTo(W*.5,H*.92,pa.right,H*.72);g.stroke();}
  /* Difficulty vignette: stronger levels feel more enclosed without hiding enemies. */
  var vg=g.createRadialGradient(W*.5,H*.48,Math.min(W,H)*.18,W*.5,H*.48,Math.max(W,H)*.72);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,'+(0.08+intensity*.18).toFixed(3)+')');
  g.fillStyle=vg;g.fillRect(pa.left,pa.top,pa.right-pa.left,pa.bottom-pa.top);
  /* V38 ambient command-field: a few large low-frequency light volumes make the arena feel alive without particle spam. */
  var glowA=g.createRadialGradient(W*.18,H*.24,0,W*.18,H*.24,Math.max(W,H)*.34);
  glowA.addColorStop(0,'rgba(83,215,232,.075)');glowA.addColorStop(1,'rgba(83,215,232,0)');
  g.fillStyle=glowA;g.fillRect(pa.left,pa.top,pa.right-pa.left,pa.bottom-pa.top);
  var glowB=g.createRadialGradient(W*.82,H*.72,0,W*.82,H*.72,Math.max(W,H)*.38);
  glowB.addColorStop(0,'rgba(155,107,255,.065)');glowB.addColorStop(1,'rgba(155,107,255,0)');
  g.fillStyle=glowB;g.fillRect(pa.left,pa.top,pa.right-pa.left,pa.bottom-pa.top);
  g.globalAlpha=1;
  g.restore();
  g.strokeStyle='rgba(160,220,235,0.72)';g.lineWidth=3;
  g.strokeRect(pa.left+2,pa.top+2,pa.right-pa.left-4,pa.bottom-pa.top-4);
  g.strokeStyle='rgba(120,190,205,0.24)';g.lineWidth=1;
  g.strokeRect(pa.left+5,pa.top+5,pa.right-pa.left-10,pa.bottom-pa.top-10);
}

function drawEnemyShape(g,cx,cy,w,shape){
  /* Enemy silhouettes are functional machines: chassis + hardpoints + sensor core. */
  var hw=w/2;
  g.beginPath();
  if(shape==='round'){
    g.moveTo(cx-hw*.78,cy-hw*.15);g.lineTo(cx-hw*.42,cy-hw*.62);g.lineTo(cx+hw*.42,cy-hw*.62);g.lineTo(cx+hw*.78,cy-hw*.15);g.lineTo(cx+hw*.58,cy+hw*.48);g.lineTo(cx,cy+hw*.72);g.lineTo(cx-hw*.58,cy+hw*.48);g.closePath();
  }else if(shape==='triangle'){
    g.moveTo(cx,cy-hw*1.02);g.lineTo(cx+hw*.82,cy+hw*.60);g.lineTo(cx+hw*.22,cy+hw*.46);g.lineTo(cx,cy+hw*.76);g.lineTo(cx-hw*.22,cy+hw*.46);g.lineTo(cx-hw*.82,cy+hw*.60);g.closePath();
  }else if(shape==='symmetric'){
    g.moveTo(cx,cy-hw);g.lineTo(cx+hw*.30,cy-hw*.66);g.lineTo(cx+hw*.82,cy-hw*.42);g.lineTo(cx+hw*.62,cy-.02*hw);g.lineTo(cx+hw*.90,cy+.48*hw);g.lineTo(cx+hw*.34,cy+.36*hw);g.lineTo(cx,cy+hw);g.lineTo(cx-hw*.34,cy+.36*hw);g.lineTo(cx-hw*.90,cy+.48*hw);g.lineTo(cx-hw*.62,cy-.02*hw);g.lineTo(cx-hw*.82,cy-hw*.42);g.lineTo(cx-hw*.30,cy-hw*.66);g.closePath();
  }else if(shape==='complex'){
    g.moveTo(cx,cy-hw*1.05);g.lineTo(cx+hw*.24,cy-hw*.72);g.lineTo(cx+hw*.82,cy-hw*.76);g.lineTo(cx+hw*.58,cy-.16*hw);g.lineTo(cx+hw,cy+.18*hw);g.lineTo(cx+hw*.58,cy+.30*hw);g.lineTo(cx+hw*.72,cy+.82*hw);g.lineTo(cx+.18*hw,cy+.55*hw);g.lineTo(cx,cy+hw);g.lineTo(cx-.18*hw,cy+.55*hw);g.lineTo(cx-hw*.72,cy+.82*hw);g.lineTo(cx-hw*.58,cy+.30*hw);g.lineTo(cx-hw,cy+.18*hw);g.lineTo(cx-hw*.58,cy-.16*hw);g.lineTo(cx-hw*.82,cy-hw*.76);g.lineTo(cx-hw*.24,cy-hw*.72);g.closePath();
  }else{
    g.moveTo(cx-hw*.72,cy-hw*.48);g.lineTo(cx-hw*.22,cy-hw*.88);g.lineTo(cx+hw*.52,cy-hw*.68);g.lineTo(cx+hw*.88,cy-.20*hw);g.lineTo(cx+hw*.62,cy+.50*hw);g.lineTo(cx+hw*.22,cy+.36*hw);g.lineTo(cx,cy+hw*.84);g.lineTo(cx-hw*.22,cy+.36*hw);g.lineTo(cx-hw*.62,cy+.50*hw);g.lineTo(cx-hw*.88,cy-.20*hw);g.closePath();
  }
  g.fill();
}

function buildEnemySprite(color,dark,w,flash,shape){
  var pad=8,size=Math.ceil(w+pad*2),c=document.createElement('canvas');
  c.width=c.height=size;
  var g=c.getContext('2d'),cx=size/2,cy=size/2;
  var base=flash?'#ff6464':color,dk=flash?'#8e1616':dark;
  g.save();g.translate(0,4);g.fillStyle='rgba(0,0,0,.28)';drawEnemyShape(g,cx,cy,w,shape);g.restore();
  g.fillStyle='#dce8f2';drawEnemyShape(g,cx,cy,w+5,shape);
  g.fillStyle=dk;drawEnemyShape(g,cx,cy,w+2,shape);
  g.fillStyle=base;drawEnemyShape(g,cx,cy,w-1,shape);

  /* Structural panel lines: deliberately sparse so the silhouette stays readable. */
  g.strokeStyle='rgba(255,255,255,.30)';g.lineWidth=Math.max(1.2,w*.035);
  g.beginPath();g.moveTo(cx-w*.34,cy-w*.34);g.lineTo(cx-w*.12,cy-w*.08);g.lineTo(cx+w*.32,cy-w*.20);g.stroke();
  g.beginPath();g.moveTo(cx-w*.34,cy+w*.34);g.lineTo(cx-w*.08,cy+w*.08);g.lineTo(cx+w*.28,cy+w*.20);g.stroke();

  /* Central sensor / reactor: a horizontal optical slit reads as equipment, not a cartoon eye. */
  var sensorW=Math.max(9,w*.42),sensorH=Math.max(4,w*.12);
  g.fillStyle='#07111b';g.beginPath();g.roundRect(cx-sensorW/2,cy-sensorH/2,sensorW,sensorH,sensorH*.5);g.fill();
  var sg=g.createLinearGradient(cx-sensorW/2,0,cx+sensorW/2,0);
  sg.addColorStop(0,dk);sg.addColorStop(.5,flash?'#fff1f1':base);sg.addColorStop(1,dk);
  g.fillStyle=sg;g.beginPath();g.roundRect(cx-sensorW*.38,cy-sensorH*.18,sensorW*.76,sensorH*.36,sensorH*.18);g.fill();
  g.fillStyle='#f4fbff';g.fillRect(cx-sensorW*.05,cy-sensorH*.15,Math.max(1.5,w*.035),sensorH*.30);
  /* Weapon hardpoints differ by silhouette instead of looking like random decoration. */
  g.fillStyle=dk;
  var portY=cy+w*.30,portW=Math.max(3,w*.14),portH=Math.max(3,w*.08);
  g.fillRect(cx-w*.38,portY,portW,portH);g.fillRect(cx+w*.24,portY,portW,portH);
  g.fillStyle=base;g.fillRect(cx-w*.34,portY+portH*.25,portW*.55,Math.max(1,portH*.5));g.fillRect(cx+w*.28,portY+portH*.25,portW*.55,Math.max(1,portH*.5));
  if(shape==='triangle'||shape==='complex'){
    g.fillStyle=dk;g.fillRect(cx-w*.06,cy-w*.48,w*.12,Math.max(3,w*.12));
  }
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

function buildBossSprite(color,dark,w,flash,style){
  var pad=22,size=Math.ceil(w+pad*2),c=document.createElement('canvas');
  c.width=c.height=size;
  var g=c.getContext('2d'),cx=size/2,cy=size/2;
  var base=flash?'#ff8a8a':color,dk=flash?'#8e0f0f':dark;
  var variant=(style||0)%6;
  /* Bosses use different industrial silhouettes, but all share the same fleet engineering language. */
  g.save();g.translate(0,7);g.fillStyle='rgba(0,0,0,.34)';g.beginPath();g.ellipse(cx,cy,w*.66,w*.48,0,0,Math.PI*2);g.fill();g.restore();
  g.fillStyle='#dce8f2';g.beginPath();g.roundRect(cx-w*.62,cy-w*.44,w*1.24,w*.88,w*.12);g.fill();
  g.fillStyle=dk;
  if(variant===0){
    g.beginPath();g.moveTo(cx,cy-w*.66);g.lineTo(cx+w*.38,cy-w*.34);g.lineTo(cx+w*.78,cy-w*.12);g.lineTo(cx+w*.58,cy+w*.38);g.lineTo(cx+w*.20,cy+w*.58);g.lineTo(cx,cy+w*.46);g.lineTo(cx-w*.20,cy+w*.58);g.lineTo(cx-w*.58,cy+w*.38);g.lineTo(cx-w*.78,cy-w*.12);g.lineTo(cx-w*.38,cy-w*.34);g.closePath();g.fill();
  }else if(variant===1){
    g.beginPath();g.moveTo(cx,cy-w*.70);g.lineTo(cx+w*.72,cy);g.lineTo(cx+w*.22,cy+w*.62);g.lineTo(cx,cy+w*.48);g.lineTo(cx-w*.22,cy+w*.62);g.lineTo(cx-w*.72,cy);g.closePath();g.fill();
  }else if(variant===2){
    g.beginPath();g.moveTo(cx-w*.58,cy-w*.42);g.lineTo(cx-w*.30,cy-w*.62);g.lineTo(cx+w*.30,cy-w*.62);g.lineTo(cx+w*.58,cy-w*.42);g.lineTo(cx+w*.82,cy-.10*w);g.lineTo(cx+w*.70,cy+w*.46);g.lineTo(cx+w*.30,cy+w*.62);g.lineTo(cx-w*.30,cy+w*.62);g.lineTo(cx-w*.70,cy+w*.46);g.lineTo(cx-w*.82,cy-.10*w);g.closePath();g.fill();
  }else if(variant===3){
    g.beginPath();g.moveTo(cx,cy-w*.70);g.lineTo(cx+w*.30,cy-w*.38);g.lineTo(cx+w*.62,cy-w*.46);g.lineTo(cx+w*.48,cy);g.lineTo(cx+w*.72,cy+w*.48);g.lineTo(cx+w*.18,cy+w*.34);g.lineTo(cx,cy+w*.66);g.lineTo(cx-w*.18,cy+w*.34);g.lineTo(cx-w*.72,cy+w*.48);g.lineTo(cx-w*.48,cy);g.lineTo(cx-w*.62,cy-w*.46);g.lineTo(cx-w*.30,cy-w*.38);g.closePath();g.fill();
  }else if(variant===4){
    g.beginPath();g.moveTo(cx-w*.48,cy-w*.56);g.lineTo(cx+w*.48,cy-w*.56);g.lineTo(cx+w*.72,cy-.12*w);g.lineTo(cx+w*.48,cy+w*.56);g.lineTo(cx-w*.48,cy+w*.56);g.lineTo(cx-w*.72,cy-.12*w);g.closePath();g.fill();
  }else{
    g.beginPath();g.moveTo(cx,cy-w*.68);g.lineTo(cx+w*.22,cy-w*.42);g.lineTo(cx+w*.74,cy-w*.30);g.lineTo(cx+w*.52,cy+w*.12);g.lineTo(cx+w*.66,cy+w*.52);g.lineTo(cx+w*.14,cy+w*.38);g.lineTo(cx,cy+w*.68);g.lineTo(cx-w*.14,cy+w*.38);g.lineTo(cx-w*.66,cy+w*.52);g.lineTo(cx-w*.52,cy+w*.12);g.lineTo(cx-w*.74,cy-w*.30);g.lineTo(cx-w*.22,cy-w*.42);g.closePath();g.fill();
  }
  var body=g.createLinearGradient(0,cy-w*.6,0,cy+w*.6);body.addColorStop(0,lightenHex(base,.35));body.addColorStop(.52,base);body.addColorStop(1,dk);
  g.fillStyle=body;
  g.beginPath();g.roundRect(cx-w*.42,cy-w*.31,w*.84,w*.62,w*.08);g.fill();

  /* Command bridge + reactor are deliberately centered; weapon hardpoints frame them. */
  g.fillStyle='#07111b';g.beginPath();g.roundRect(cx-w*.30,cy-w*.20,w*.60,w*.40,w*.06);g.fill();
  g.fillStyle=body;g.beginPath();g.roundRect(cx-w*.24,cy-w*.14,w*.48,w*.28,w*.05);g.fill();
  g.strokeStyle='rgba(255,255,255,.46)';g.lineWidth=Math.max(2,w*.022);g.beginPath();g.moveTo(cx-w*.31,cy);g.lineTo(cx+w*.31,cy);g.stroke();
  g.fillStyle='#07111b';g.beginPath();g.arc(cx,cy+w*.12,w*.19,0,Math.PI*2);g.fill();
  var core=g.createRadialGradient(cx-w*.04,cy-w*.04,1,cx,cy+w*.12,w*.18);core.addColorStop(0,'#ffffff');core.addColorStop(.25,base);core.addColorStop(1,dk);
  g.fillStyle=core;g.beginPath();g.arc(cx,cy+w*.12,w*.145,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,255,255,.58)';g.lineWidth=Math.max(2,w*.024);g.beginPath();g.arc(cx,cy+w*.12,w*.22,0,Math.PI*2);g.stroke();

  g.fillStyle=dk;
  var ports=[[-.54,-.05],[.54,-.05],[-.42,.42],[.42,.42]];
  for(var i=0;i<ports.length;i++){
    var px=cx+w*ports[i][0],py=cy+w*ports[i][1];
    g.fillRect(px-w*.055,py-w*.045,w*.11,w*.09);
    g.fillStyle='#dff7ff';g.fillRect(px-w*.025,py-w*.025,w*.05,w*.05);g.fillStyle=dk;
  }
  /* Variant-specific command mast / fins. */
  g.fillStyle=base;
  if(variant===0){g.fillRect(cx-w*.07,cy-w*.72,w*.14,w*.22);g.fillRect(cx-w*.46,cy-w*.58,w*.12,w*.18);g.fillRect(cx+w*.34,cy-w*.58,w*.12,w*.18);}
  else if(variant===1){g.beginPath();g.moveTo(cx-w*.13,cy-w*.32);g.lineTo(cx,cy-w*.58);g.lineTo(cx+w*.13,cy-w*.32);g.closePath();g.fill();}
  else if(variant===2){for(var q=-1;q<=1;q++){g.fillRect(cx+q*w*.22-w*.035,cy+w*.48,w*.07,w*.18);}}
  else if(variant===3){g.fillRect(cx-w*.06,cy-w*.62,w*.12,w*.30);}
  else if(variant===4){g.fillRect(cx-w*.40,cy-w*.72,w*.80,w*.09);}
  else{g.fillRect(cx-w*.08,cy-w*.70,w*.16,w*.26);g.fillRect(cx-w*.50,cy-w*.46,w*.12,w*.12);g.fillRect(cx+w*.38,cy-w*.46,w*.12,w*.12);}
  return c;
}

function buildBossSprites(){
  bossSpriteCache={};
  for(var i=0;i<BOSS_TYPES.length;i++){
    var def=BOSS_TYPES[i],w=BASE_SIZE*def.size;
    bossSpriteCache[i]={
      normal:buildBossSprite(def.color,def.dark,w,false,i),
      flash:buildBossSprite(def.color,def.dark,w,true,i),
      half:w/2+12
    };
  }
}

function drawPlayerShapeBody(g,cx,cy,w,shape,fill,edge){
  /* Top-down fighter-jet language: nose, swept wings, canopy, twin nacelles and tailplane.
     Shape unlocks change the wing planform, but every playable chassis remains unmistakably a jet. */
  var hw=w/2, variant=shape||'square';
  g.save();g.fillStyle=fill;g.strokeStyle=edge;g.lineWidth=Math.max(1.8,w*.038);g.beginPath();
  if(variant==='square'){
    // Default: compact square-wing interceptor. The outer frame stays boxy while the center is a real jet fuselage.
    g.moveTo(cx,cy-hw*1.18);g.lineTo(cx+hw*.18,cy-hw*.86);g.lineTo(cx+hw*.30,cy-hw*.38);
    g.lineTo(cx+hw*.82,cy-hw*.06);g.lineTo(cx+hw*.82,cy+hw*.18);g.lineTo(cx+hw*.42,cy+hw*.24);
    g.lineTo(cx+hw*.28,cy+hw*.78);g.lineTo(cx,cy+hw*1.02);g.lineTo(cx-hw*.28,cy+hw*.78);
    g.lineTo(cx-hw*.42,cy+hw*.24);g.lineTo(cx-hw*.82,cy+hw*.18);g.lineTo(cx-hw*.82,cy-hw*.06);
    g.lineTo(cx-hw*.30,cy-hw*.38);g.lineTo(cx-hw*.18,cy-hw*.86);g.closePath();
  }else if(variant==='triangle'||variant==='arrow'){
    g.moveTo(cx,cy-hw*1.22);g.lineTo(cx+hw*.18,cy-hw*.72);g.lineTo(cx+hw*.94,cy+hw*.10);
    g.lineTo(cx+hw*.62,cy+hw*.18);g.lineTo(cx+hw*.28,cy+hw*.72);g.lineTo(cx,cy+hw*.98);
    g.lineTo(cx-hw*.28,cy+hw*.72);g.lineTo(cx-hw*.62,cy+hw*.18);g.lineTo(cx-hw*.94,cy+hw*.10);
    g.lineTo(cx-hw*.18,cy-hw*.72);g.closePath();
  }else if(variant==='circleShape'||variant==='halo'){
    g.moveTo(cx,cy-hw*1.18);g.lineTo(cx+hw*.22,cy-hw*.72);g.lineTo(cx+hw*.72,cy-hw*.18);
    g.lineTo(cx+hw*.58,cy+hw*.18);g.lineTo(cx+hw*.30,cy+hw*.20);g.lineTo(cx+hw*.26,cy+hw*.78);
    g.lineTo(cx,cy+hw);g.lineTo(cx-hw*.26,cy+hw*.78);g.lineTo(cx-hw*.30,cy+hw*.20);g.lineTo(cx-hw*.58,cy+hw*.18);
    g.lineTo(cx-hw*.72,cy-hw*.18);g.lineTo(cx-hw*.22,cy-hw*.72);g.closePath();
  }else if(variant==='shieldShape'||variant==='pentagon'){
    g.moveTo(cx,cy-hw*1.20);g.lineTo(cx+hw*.24,cy-hw*.72);g.lineTo(cx+hw*.76,cy-hw*.28);
    g.lineTo(cx+hw*.64,cy+hw*.36);g.lineTo(cx+hw*.28,cy+hw*.76);g.lineTo(cx,cy+hw*1.02);
    g.lineTo(cx-hw*.28,cy+hw*.76);g.lineTo(cx-hw*.64,cy+hw*.36);g.lineTo(cx-hw*.76,cy-hw*.28);
    g.lineTo(cx-hw*.24,cy-hw*.72);g.closePath();
  }else if(variant==='gear'||variant==='complex'){
    g.moveTo(cx,cy-hw*1.24);g.lineTo(cx+hw*.18,cy-hw*.78);g.lineTo(cx+hw*.82,cy-hw*.42);
    g.lineTo(cx+hw*.62,cy-hw*.04);g.lineTo(cx+hw*.90,cy+hw*.22);g.lineTo(cx+hw*.48,cy+hw*.30);
    g.lineTo(cx+hw*.30,cy+hw*.82);g.lineTo(cx,cy+hw*1.04);g.lineTo(cx-hw*.30,cy+hw*.82);
    g.lineTo(cx-hw*.48,cy+hw*.30);g.lineTo(cx-hw*.90,cy+hw*.22);g.lineTo(cx-hw*.62,cy-hw*.04);
    g.lineTo(cx-hw*.82,cy-hw*.42);g.lineTo(cx-hw*.18,cy-hw*.78);g.closePath();
  }else{
    g.moveTo(cx,cy-hw*1.22);g.lineTo(cx+hw*.18,cy-hw*.76);g.lineTo(cx+hw*.72,cy-hw*.32);g.lineTo(cx+hw*.92,cy+hw*.10);
    g.lineTo(cx+hw*.54,cy+hw*.22);g.lineTo(cx+hw*.30,cy+hw*.78);g.lineTo(cx,cy+hw*1.04);
    g.lineTo(cx-hw*.30,cy+hw*.78);g.lineTo(cx-hw*.54,cy+hw*.22);g.lineTo(cx-hw*.92,cy+hw*.10);
    g.lineTo(cx-hw*.72,cy-hw*.32);g.lineTo(cx-hw*.18,cy-hw*.76);g.closePath();
  }
  g.fill();g.stroke();

  // Swept wing panel cuts and central fuselage.
  g.fillStyle=edge;g.globalAlpha=.26;
  g.beginPath();g.moveTo(cx-hw*.78,cy-hw*.02);g.lineTo(cx-hw*.30,cy-hw*.22);g.lineTo(cx-hw*.22,cy+hw*.08);g.lineTo(cx-hw*.66,cy+hw*.16);g.closePath();g.fill();
  g.beginPath();g.moveTo(cx+hw*.78,cy-hw*.02);g.lineTo(cx+hw*.30,cy-hw*.22);g.lineTo(cx+hw*.22,cy+hw*.08);g.lineTo(cx+hw*.66,cy+hw*.16);g.closePath();g.fill();
  g.globalAlpha=1;
  g.fillStyle=edge;g.globalAlpha=.18;g.fillRect(cx-hw*.09,cy-hw*.72,hw*.18,hw*1.42);g.globalAlpha=1;

  // Twin jet nacelles / exhaust housings.
  g.fillStyle='#07111b';
  g.beginPath();g.roundRect(cx-hw*.52,cy+hw*.34,hw*.22,hw*.50,hw*.06);g.roundRect(cx+hw*.30,cy+hw*.34,hw*.22,hw*.50,hw*.06);g.fill();
  g.fillStyle=edge;g.globalAlpha=.82;
  g.fillRect(cx-hw*.47,cy+hw*.60,hw*.12,hw*.12);g.fillRect(cx+hw*.35,cy+hw*.60,hw*.12,hw*.12);g.globalAlpha=1;

  // Tailplane.
  g.fillStyle=fill;g.strokeStyle=edge;g.lineWidth=Math.max(1,w*.025);g.beginPath();
  g.moveTo(cx-hw*.30,cy+hw*.54);g.lineTo(cx-hw*.62,cy+hw*.76);g.lineTo(cx-hw*.24,cy+hw*.70);
  g.lineTo(cx+hw*.24,cy+hw*.70);g.lineTo(cx+hw*.62,cy+hw*.76);g.lineTo(cx+hw*.30,cy+hw*.54);g.closePath();g.fill();g.stroke();
  g.restore();
}

function buildPlayerSprite(ship,shape,boosted){
  var w=BASE_SIZE,h=BASE_SIZE,pad=12,size=Math.ceil(w+pad*2),c=document.createElement('canvas');
  c.width=c.height=size;
  var g=c.getContext('2d'),ox=pad,oy=pad,cx=ox+w/2;
  var body=boosted?'#f5fbff':ship.body,edge=boosted?'#7cc7ff':ship.edge;
  /* Silhouette, paneling, cockpit and propulsion are authored as one small spacecraft. */
  g.save();g.translate(0,4);g.fillStyle='rgba(0,0,0,.28)';drawPlayerShapeBody(g,cx,oy+h/2,w+7,shape,'rgba(0,0,0,.28)','rgba(0,0,0,.28)');g.restore();
  drawPlayerShapeBody(g,cx,oy+h/2,w+3,shape,'#eaf2f8','#eaf2f8');
  drawPlayerShapeBody(g,cx,oy+h/2,w,shape,body,edge);
  /* cockpit canopy */
  var cr=w*.17;
  var cg=g.createLinearGradient(cx-cr,oy+h*.18,cx+cr,oy+h*.48);cg.addColorStop(0,boosted?'#ffffff':ship.cockpit);cg.addColorStop(1,'#7ca5c2');
  g.fillStyle=cg;g.beginPath();g.ellipse(cx,oy+h*.28,cr,cr*.78,0,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=Math.max(1,w*.025);g.stroke();
  g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.ellipse(cx-cr*.28,oy+h*.22,cr*.34,cr*.20,-.45,0,Math.PI*2);g.fill();
  /* reactor + thruster cores */
  g.fillStyle='#07111b';g.beginPath();g.arc(cx,oy+h*.62,w*.105,0,Math.PI*2);g.fill();
  g.fillStyle=boosted?'#ffffff':ship.cockpit;g.beginPath();g.arc(cx,oy+h*.62,w*.065,0,Math.PI*2);g.fill();
  g.fillStyle=boosted?'#dff4ff':'#b9f5d0';
  g.fillRect(cx-w*.44,oy+h*.67,w*.12,h*.07);g.fillRect(cx+w*.32,oy+h*.67,w*.12,h*.07);
  g.fillStyle='rgba(255,255,255,.72)';g.fillRect(cx-w*.08,oy+h*.02,w*.045,h*.08);g.fillRect(cx+w*.035,oy+h*.02,w*.045,h*.08);
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
  /* Pet chassis deliberately matches the game's default square hardware language.
     Role identity is carried by the internal core, not by unrelated mascot silhouettes. */
  var R=26,c=document.createElement('canvas');
  c.width=c.height=R*2+12;
  var g=c.getContext('2d'),cx=c.width/2,cy=c.height/2;
  var baseAccent=(currentTheme&&currentTheme.edge)||'#53d7e8';
  var accent=baseAccent;
  if(pet.type==='tank')accent=lightenHex(baseAccent,.16);
  else if(pet.type==='helper')accent=lightenHex(baseAccent,.28);
  else if(pet.type==='buffer')accent=lightenHex(baseAccent,.10);
  else if(pet.type==='mage')accent=lightenHex(baseAccent,.20);
  else if(pet.tagLabel==='ELITE')accent='#f3f7ff';
  var rg=g.createRadialGradient(cx,cy,3,cx,cy,R+7);
  rg.addColorStop(0,hexToRgba(accent,.20));rg.addColorStop(.6,hexToRgba(accent,.06));rg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rg;g.beginPath();g.arc(cx,cy,R+7,0,Math.PI*2);g.fill();
  /* Distinct drone chassis silhouettes. The core language stays consistent, but each family gets a different airframe. */
  var pv=pet.id;
  var pts=[];
  if(pv==='scout'||pv==='pulse'||pv==='apex'||pv==='viper'||pv==='nova'){
    pts=[[0,-.88],[.30,-.48],[.82,-.18],[.52,.04],[.28,.62],[0,.86],[-.28,.62],[-.52,.04],[-.82,-.18],[-.30,-.48]];
  }else if(pv==='guardian'||pv==='barrier'||pv==='aegis'){
    pts=[[0,-.92],[.48,-.52],[.74,-.02],[.58,.48],[0,.82],[-.58,.48],[-.74,-.02],[-.48,-.52]];
  }else if(pv==='medic'||pv==='echo'){
    pts=[[0,-.84],[.38,-.56],[.66,-.08],[.42,.58],[0,.78],[-.42,.58],[-.66,-.08],[-.38,-.56]];
  }else if(pv==='ammo'){
    pts=[[0,-.90],[.20,-.62],[.56,-.58],[.76,-.10],[.56,.54],[.20,.72],[0,.90],[-.20,.72],[-.56,.54],[-.76,-.10],[-.56,-.58],[-.20,-.62]];
  }else if(pv==='swift'){
    pts=[[0,-.98],[.18,-.50],[.88,-.20],[.48,.10],[.30,.72],[0,.90],[-.30,.72],[-.48,.10],[-.88,-.20],[-.18,-.50]];
  }else if(pv==='magnetPet'){
    pts=[[0,-.80],[.54,-.54],[.80,0],[.54,.54],[0,.80],[-.54,.54],[-.80,0],[-.54,-.54]];
  }else if(pv==='voidPet'||pv==='oracle'){
    pts=[[0,-.88],[.38,-.70],[.70,-.34],[.84,0],[.70,.34],[.38,.70],[0,.88],[-.38,.70],[-.70,.34],[-.84,0],[-.70,-.34],[-.38,-.70]];
  }else{
    pts=[[0,-.84],[.62,-.56],[.80,0],[.62,.56],[0,.84],[-.62,.56],[-.80,0],[-.62,-.56]];
  }
  g.fillStyle='rgba(0,0,0,.34)';g.beginPath();
  for(var pi=0;pi<pts.length;pi++){var sx=cx+pts[pi][0]*R*.82,sy=cy+pts[pi][1]*R*.82+4;if(pi===0)g.moveTo(sx,sy);else g.lineTo(sx,sy);}g.closePath();g.fill();
  g.fillStyle='#dce8f2';g.beginPath();
  for(var pj=0;pj<pts.length;pj++){var x=cx+pts[pj][0]*R*.82,y=cy+pts[pj][1]*R*.82;if(pj===0)g.moveTo(x,y);else g.lineTo(x,y);}g.closePath();g.fill();
  g.fillStyle='#0b1422';g.beginPath();
  for(var pk=0;pk<pts.length;pk++){var ix=cx+pts[pk][0]*R*.68,iy=cy+pts[pk][1]*R*.68;if(pk===0)g.moveTo(ix,iy);else g.lineTo(ix,iy);}g.closePath();g.fill();
  g.strokeStyle='#2b4057';g.lineWidth=1.5;g.stroke();
  /* Corner hardware and role ports. */
  g.fillStyle=accent;
  g.fillRect(cx-R*.57,cy-R*.40,R*.18,R*.08);g.fillRect(cx+R*.39,cy-R*.40,R*.18,R*.08);
  g.fillRect(cx-R*.57,cy+R*.32,R*.18,R*.08);g.fillRect(cx+R*.39,cy+R*.32,R*.18,R*.08);
  /* Functional core language. */
  g.fillStyle='#050b12';g.beginPath();g.roundRect(cx-R*.42,cy-R*.16,R*.84,R*.32,R*.05);g.fill();
  g.fillStyle=accent;
  if(pet.id==='scout'||pet.id==='pulse'||pet.id==='apex'||pet.id==='viper'||pet.id==='nova'){
    g.beginPath();g.moveTo(cx,cy-R*.32);g.lineTo(cx+R*.24,cy);g.lineTo(cx,cy+R*.32);g.lineTo(cx-R*.24,cy);g.closePath();g.fill();
  }else if(pet.id==='guardian'||pet.id==='barrier'||pet.id==='aegis'){
    g.beginPath();g.moveTo(cx,cy-R*.34);g.lineTo(cx+R*.27,cy-R*.18);g.lineTo(cx+R*.22,cy+R*.23);g.lineTo(cx,cy+R*.35);g.lineTo(cx-R*.22,cy+R*.23);g.lineTo(cx-R*.27,cy-R*.18);g.closePath();g.fill();
  }else if(pet.id==='medic'||pet.id==='echo'){
    g.fillRect(cx-R*.07,cy-R*.27,R*.14,R*.54);g.fillRect(cx-R*.27,cy-R*.07,R*.54,R*.14);
  }else if(pet.id==='ammo'){
    g.fillRect(cx-R*.25,cy-R*.24,R*.12,R*.48);g.fillRect(cx-R*.06,cy-R*.30,R*.12,R*.60);g.fillRect(cx+R*.13,cy-R*.24,R*.12,R*.48);
  }else if(pet.id==='swift'){
    g.beginPath();g.moveTo(cx-R*.31,cy);g.lineTo(cx+R*.28,cy-R*.22);g.lineTo(cx+R*.10,cy);g.lineTo(cx+R*.28,cy+R*.22);g.closePath();g.fill();
  }else if(pet.id==='magnetPet'){
    g.strokeStyle=accent;g.lineWidth=3.5;g.beginPath();g.arc(cx,cy,R*.18,Math.PI*.15,Math.PI*1.85);g.stroke();
  }else if(pet.id==='voidPet'||pet.id==='oracle'){
    g.beginPath();g.arc(cx,cy,R*.22,0,Math.PI*2);g.fill();g.fillStyle='#f3f7ff';g.beginPath();g.arc(cx,cy,R*.07,0,Math.PI*2);g.fill();
  }else{g.beginPath();g.arc(cx,cy,R*.18,0,Math.PI*2);g.fill();}
  g.fillStyle='#f3f7ff';g.fillRect(cx-R*.05,cy-R*.055,R*.10,R*.11);
  g.fillStyle=accent;g.beginPath();g.arc(cx,cy+R*.39,R*.07,0,Math.PI*2);g.fill();
  return {canvas:c,cx:cx,cy:cy,R:R,accent:accent,dataUrl:c.toDataURL('image/png')};
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
    else if(pet.id==='echo'){eff.dmgMult=1+(pet.dmgMult-1)+0.04*lv;}
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
  challengeRun=!!currentChallenge;
  paused=false;
  winShown=false;
  damageIFrame=0;
  isNetworkGame=!!(window.DS_MP&&window.DS_MP.active&&window.DS_MP.networkMode);
  applyStartingBonus();
  shipPassive=getShipPassive();
  shapePassive=getShapePassive();
  var shipHpMult=(shipPassive.hpMult||1)*(shapePassive.hpMult||1);
  var shipUpgLv=getUpgradeLevel('ship',save.selectedShip);
  var mhp=Math.round((BASE_MAX_HP+maxHpBonus+shipUpgLv*10)*shipHpMult);
  if(currentChallenge==='nohit')mhp=Math.round(mhp*0.8);
  var pa0=playArea();
  player={x:W/2-BASE_SIZE/2,y:Math.max(pa0.top+BASE_SIZE,pa0.bottom-BASE_SIZE-22),width:BASE_SIZE,height:BASE_SIZE,hp:mhp,maxHp:mhp};
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
  runKills=0;runBossKills=0;runKillCount=0;killFlash=0;killMilestoneMarks={};
  // Bersihkan timer/overlay visual dari run sebelumnya agar tidak menyeberang ke level baru.
  if(waveBannerTimer){clearTimeout(waveBannerTimer);waveBannerTimer=null;}
  if(streakFadeTimer){clearTimeout(streakFadeTimer);streakFadeTimer=null;}
  if(hintTimer){clearTimeout(hintTimer);hintTimer=null;}
  if(waveBanner)waveBanner.classList.remove('on');
  if(streakHudEl){streakHudEl.style.opacity='0';streakHudEl.style.transform='scale(1)';}
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
  if(currentLevel.isFinal){finalBossNext=0;if(!isNetworkGame||!window.DS_MP.sharedCombat||amHost())spawnBossForFinal(0);}
  if(currentChallenge==='bossrush'){
    finalBossNext=0;
    spawnBossForFinal(0);
  }
}

function spawnBossForFinal(idx){
  var def=BOSS_TYPES[idx%BOSS_TYPES.length];
  var w=BASE_SIZE*def.size;
  var baseX=edgeLeft()+40+Math.random()*(edgeRight()-edgeLeft()-w-80);
  var hp=Math.round(BOSS_TYPES[0].hp*BOSS_HP_MULT*currentLevel.hpMult*Math.pow(10,idx));
  var range=Math.max(0,Math.min(def.moveRange,(edgeRight()-edgeLeft()-w)/2-8));
  /* Keep the boss safely above the player even on short/tall phone viewports. */
  var safeGap=Math.max(36,BASE_SIZE*0.9);
  var playerTop=(player&&player.y!==undefined?player.y:edgeBottom()-160);
  var maxSpawnY=Math.max(edgeTop()+8,playerTop-w-safeGap);
  var bossHudClearance=Math.max(112,H*0.13);
  var spawnY=Math.min(edgeTop()+bossHudClearance,maxSpawnY);
  var boss={
    idx:idx%BOSS_TYPES.length,name:def.name,x:baseX,y:spawnY,width:w,height:w,
    hp:hp,maxHp:hp,baseX:baseX,moveRange:range,phase:Math.random()*6.283,speed:def.speed,
    attackCycle:def.cycle,attackIdx:idx,shootInterval:def.shootInterval,fireTimer:1+idx*0.3,
    gatling:0,gatlingTimer:0,spawnT:0.6+idx*0.2,hitFlash:0,color:def.color,dark:def.dark,
    spiralAngle:0,bossNumber:idx+1,poisonTime:0,poisonDPS:0
  };
  bossesSpawnedInRun++;
  if(isNetworkGame){
    boss.id='b_'+Date.now().toString(36)+'_'+idx+'_'+Math.random().toString(36).slice(2,5);
    boss.spawnTime=Date.now();
    if(window.DS_MP.sharedCombat&&window.MP_spawnGlobalBoss)window.MP_spawnGlobalBoss(boss);
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
  var enemyHudClearance=Math.max(92,H*0.10);
  var y=(yOverride!==undefined)?yOverride:edgeTop()+enemyHudClearance;
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
  if(isNetworkGame&&window.DS_MP.sharedCombat&&!amHost())return;
  var e=buildEnemyObject(typeKey,xOverride,yOverride,shapeOverride);
  if(!e)return;
  if(isNetworkGame){
    e.id=genEnemyId();
    e.spawnTime=Date.now();
    e._netSpawnTime=e.spawnTime;
    e._netStartY=e.y;
    if(window.DS_MP.sharedCombat&&window.MP_spawnGlobalEnemy)window.MP_spawnGlobalEnemy(e);
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
  if(isNetworkGame&&window.DS_MP.sharedCombat&&!amHost())return;
  var baseHp=ENEMY_TYPES.miniBoss.hp;
  var scale=1+miniBossCount*0.6;
  var def=ENEMY_TYPES.miniBoss;
  var w=BASE_SIZE*def.size;
  var x=pickSpawnX(w);
  var hp=Math.round(baseHp*scale*currentLevel.hpMult*timeHpScale());
  var dmg=Math.round(def.damage*currentLevel.dmgMult*(1+miniBossCount*0.15));
  var shape=pickShape();
  var e={
    type:'miniBoss',x:x,y:edgeTop()+Math.max(92,H*0.10),width:w,height:w,hp:hp,maxHp:hp,damage:dmg,
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
    if(window.DS_MP.sharedCombat&&window.MP_spawnGlobalEnemy)window.MP_spawnGlobalEnemy(e);
    enemies.push(e);
  }else{
    enemies.push(e);
    showWaveBanner('MUSUH BESAR!',true);
    sfxRoar();
  }
}

function spawnBoss(){
  if(isNetworkGame&&window.DS_MP.sharedCombat&&!amHost())return;
  var idx=bossIndex%BOSS_TYPES.length;
  var def=BOSS_TYPES[idx];
  var w=BASE_SIZE*def.size;
  var cx=(edgeLeft()+edgeRight())/2;
  var baseX=cx-w/2+(Math.random()-0.5)*60;
  if(baseX<edgeLeft())baseX=edgeLeft();
  if(baseX+w>edgeRight())baseX=edgeRight()-w;
  var range=Math.min(def.moveRange,(edgeRight()-edgeLeft()-w)/2-8);
  var scaleFactor=Math.pow(10,bossesSpawnedInRun);
  var hp=Math.round(BOSS_TYPES[0].hp*BOSS_HP_MULT*currentLevel.hpMult*scaleFactor);
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
    bossIndex++;
    nb.id='b_'+Date.now().toString(36)+'_'+idx+'_'+Math.random().toString(36).slice(2,5);
    nb.spawnTime=Date.now();
    nb._net=true;
    if(window.DS_MP.sharedCombat&&window.MP_spawnGlobalBoss)window.MP_spawnGlobalBoss(nb);
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
    spawnIndieBurst(cx,edgeTop()+w/2,14);
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
    if(boss._net&&window.DS_MP.sharedCombat&&!amHost()){
      if(boss.hitFlash>0){boss.hitFlash-=dt;if(boss.hitFlash<0)boss.hitFlash=0;}
      if(boss.hp<=0){
        if(!boss._credited)killBoss(boss);
        if(window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(boss.id,999999);
        bosses.splice(bi,1);
        if(bosses.length===0&&currentLevel.isFinal&&!winShown&&amHost()){finalBossNext++;if(finalBossNext<(currentLevel.finalBossCount||BOSS_TYPES.length))setTimeout(function(){if(!winShown)spawnBossForFinal(finalBossNext);},350);else showWinModal();}
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
      if(isNetworkGame&&window.DS_MP.sharedCombat&&boss.id){
        if(!boss._credited)killBoss(boss);
        if(window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(boss.id,999999);
        bosses.splice(bi,1);
      }else{
        killBoss(boss);
        bosses.splice(bi,1);
        if(bosses.length===0){
          bossWrap.classList.remove('on');
          if(currentLevel.isFinal&&!winShown){
            finalBossNext++;
            if(finalBossNext<(currentLevel.finalBossCount||BOSS_TYPES.length)){
              setTimeout(function(){if(!winShown&&(!isNetworkGame||!window.DS_MP.sharedCombat||amHost()))spawnBossForFinal(finalBossNext);},350);
            }else showWinModal();
          }
        }
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
  if(isNetworkGame&&window.DS_MP.sharedCombat&&!amHost())return;
  var phase=getPhase(elapsed,currentLevel);
  var effMax=Math.max(3,phase.maxActive+activeCapDelta);
  var rate=currentLevel.enemiesPerSecond*spawnMultiplier*currentLevel.spawnRateMult;
  if(currentLevel.isEndless)rate*=1+elapsed*0.015;
  if(isFinite(currentLevel.duration)&&elapsed>=currentLevel.duration-20)rate*=1.35;
  spawnAccum+=dt*rate;
  if(spawnAccum>1.5)spawnAccum=1.5;
  if(spawnAccum>=1){
    var guard=0;
    while(spawnAccum>=1 && enemies.length<effMax && guard<3){
      spawnAccum-=1;
      spawnEnemy();
      guard++;
    }
    if(enemies.length>=effMax)spawnAccum=Math.min(spawnAccum,0.95);
  }
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

var pixiFxApp=null,pixiFxLayer=null,pixiFxReady=false,pixiFxLoading=false,pixiFxPool=[];
function initPixiFxLayer(){
  /* V38: native Canvas particles are the production path. Pixi remains an optional lab experiment, never an in-game overlay. */
  return;
  pixiFxLoading=true;
  window.DS_LIBS.loadPixi().then(function(){
    if(!window.PIXI)throw new Error('PIXI global missing');
    pixiFxApp=new PIXI.Application();
    return pixiFxApp.init({resizeTo:window,backgroundAlpha:0,antialias:false,preference:'webgl',autoDensity:true,resolution:Math.min(window.devicePixelRatio||1,1.5),clearBeforeRender:true});
  }).then(function(){
    pixiFxLayer=pixiFxApp.stage;
    var node=pixiFxApp.canvas;
    node.id='pixiFxLayer';
    node.style.position='fixed';node.style.inset='0';node.style.width='100%';node.style.height='100%';node.style.pointerEvents='none';node.style.zIndex='1';
    document.body.appendChild(node);
    for(var i=0;i<MAX_PARTICLES;i++){
      var g=new PIXI.Graphics().circle(0,0,1).fill(0xffffff);
      g.visible=false;pixiFxLayer.addChild(g);pixiFxPool.push(g);
    }
    pixiFxReady=true;pixiFxLoading=false;
  }).catch(function(){pixiFxLoading=false;pixiFxReady=false;});
}
function pixiHex(color){return typeof color==='string'&&/^#[0-9a-fA-F]{6}$/.test(color);}
function updatePixiFx(){
  return;
  var used=0;
  for(var i=0;i<particles.length&&used<pixiFxPool.length;i++){
    var p=particles[i];
    if(p.text!==null||!pixiHex(p.color))continue;
    var g=pixiFxPool[used++],a=Math.max(0,Math.min(1,p.life/p.maxLife));
    g.visible=true;g.x=p.x;g.y=p.y;g.alpha=a*.9;g.tint=parseInt(p.color.slice(1),16);
    var scale=Math.max(.15,p.r||1);g.scale.set(scale);
  }
  for(var j=used;j<pixiFxPool.length;j++)pixiFxPool[j].visible=false;
}
function pushParticle(x,y,vx,vy,life,color,r,text){
  var cap=Math.max(70,Math.floor(MAX_PARTICLES*adaptiveQuality));
  if(particles.length>=cap)return;
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
  comboCount++;comboTimer=0.95;
  var newLevel=Math.min(99,Math.floor(comboCount/3)+1);
  if(newLevel>comboLevel){
    comboLevel=newLevel;
    if(comboLevel>save.comboMax){save.comboMax=comboLevel;killDirty=true;checkAchievements();}
    sfxWave();
    pushShockwave(player.x+player.width/2,player.y+player.height/2,60+comboLevel*6,'rgba(83,215,232,0.72)',0.4);
  }
  updateComboHud();
}
function updateComboHud(){
  var on=(comboLevel>1||comboTimer>0);
  if(domCache.comboOn!==on){domCache.comboOn=on;if(on)comboHud.classList.add('on');else comboHud.classList.remove('on');}
  if(on&&domCache.comboLevel!==comboLevel){
    domCache.comboLevel=comboLevel;
    var streak=streakLabelFor(comboCount)||'KEEP GOING';
    comboHud.innerHTML='<span class="small">COMBO</span><span class="mult">x'+comboLevel+'</span><span class="streak">'+esc(streak)+'</span>';
    if(window.gsap){
      try{window.gsap.killTweensOf(comboHud);window.gsap.fromTo(comboHud,{scale:.72,opacity:0,y:10},{scale:1,opacity:1,y:0,duration:.24,ease:'back.out(2)',overwrite:true});}catch(e){}
    }
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
  if(invincibleActive||damageIFrame>0)return;
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
  damageIFrame=DAMAGE_IFRAME_SECONDS;
  player.hp-=amount;
  spawnHitSpark(player.x+player.width/2,player.y+player.height/2,'#ff6b4a');
  triggerShake(Math.min(10,4+amount*0.12),0.14);
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
      if(isNetworkGame&&window.DS_MP.sharedCombat&&source.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(source.id,reflect);
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
      if(isNetworkGame&&window.DS_MP.sharedCombat&&e.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(e.id,dmg);
      else{e.hp-=dmg;e.hitFlash=0.15;}
      pushDamageNumber(e.x+e.width/2,e.y+e.height/2,Math.round(dmg),'#ffb060');
    }
  }
  for(var bj=0;bj<bosses.length;bj++){
    var bo=bosses[bj];
    if(bo.spawnT>0)continue;
    var bdx=(bo.x+bo.width/2)-x,bdy=(bo.y+bo.height/2)-y;
    if(bdx*bdx+bdy*bdy<r*r){
      if(isNetworkGame&&window.DS_MP.sharedCombat&&bo.id&&window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(bo.id,dmg);
      else{bo.hp-=dmg;bo.hitFlash=0.15;}
      pushDamageNumber(bo.x+bo.width/2,bo.y+bo.height/2,Math.round(dmg),'#ffb060');
    }
  }
}

function killEnemy(e){
  var cx=e.x+e.width/2,cy=e.y+e.height/2;
  spawnHitSpark(cx,cy,e.color);
  spawnIndieBurst(cx,cy,6);
  pushShockwave(cx,cy,e.width*1.4,'rgba(255,255,255,0.85)',0.3);
  if(e.splits>0&&(!isNetworkGame||!window.DS_MP.sharedCombat||amHost())){
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
  checkKillMilestone();
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
      if(!isNetworkGame||!window.DS_MP.sharedCombat){
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
      if(!isNetworkGame||!window.DS_MP.sharedCombat||amHost())e.hp-=e.poisonDPS*dt;
      if(Math.random()<0.2){
        pushParticle(e.x+e.width/2+(Math.random()-0.5)*e.width,e.y+e.height/2+(Math.random()-0.5)*e.height,0,-30,0.4,'#a8e63a',1.8);
      }
    }
    if(e.spawnT<=0&&!freezeActive&&e.shootType!=='none'&&e.shootType!=='heavenly'){
      if(!isNetworkGame||!window.DS_MP.sharedCombat||amHost()){
        e.fireTimer-=dt*speedFactor;
        if(e.fireTimer<=0){fireEnemy(e);e.fireTimer=1/e.fireRate;}
      }
    }
    if(e.y+e.height>elBottom){
      if(isNetworkGame&&window.DS_MP.sharedCombat&&e.id&&window.MP_killGlobalEnemy)window.MP_killGlobalEnemy(e.id);
      enemies.splice(i,1);
      continue;
    }
    if(e.spawnT<=0&&rectsOverlap(player,e)){
      damagePlayer(CONTACT_DAMAGE_FLAT,e);
      spawnHitSpark(e.x+e.width/2,e.y+e.height/2,e.color);
      pushShockwave(e.x+e.width/2,e.y+e.height/2,e.width*1.5,'rgba(255,120,120,0.85)',0.35);
      triggerShake(14,0.32);
      sfxHit();
      if(isNetworkGame&&window.DS_MP.sharedCombat&&e.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(e.id,999999);
      else e.hp=0;
      continue;
    }
    if(e.hp<=0){
      removeLaserFor(e);
      if(isNetworkGame&&window.DS_MP.sharedCombat&&e.id&&window.MP_killGlobalEnemy)window.MP_killGlobalEnemy(e.id);
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
    if(dmg>target.maxHp*0.12)pushShockwave(x,y,22,'rgba(255,255,255,.55)',0.16);
    if(wipeoutActive)dmg=target.maxHp*10;
    if(isNetworkGame&&window.DS_MP.sharedCombat&&target.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(target.id,dmg);
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
          if(isNetworkGame&&window.DS_MP.sharedCombat&&bo.id&&window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(bo.id,bdmg);
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
      if(isNetworkGame&&window.DS_MP.sharedCombat&&target.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(target.id,dmg);
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
        if(isNetworkGame&&window.DS_MP.sharedCombat&&t.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(t.id,eff.chainDmg);
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
  /* One slow scanline + six beacons: atmosphere without a heavy particle system. */
  var pa=playArea(),scan=pa.top+((elapsedTotal*18)%(Math.max(1,pa.bottom-pa.top)));
  ctx.save();ctx.globalAlpha=.055;ctx.fillStyle='#53d7e8';ctx.fillRect(pa.left,scan,pa.right-pa.left,1);
  ctx.globalAlpha=.22;ctx.fillStyle='#53d7e8';
  var beaconR=2+Math.sin(elapsedTotal*2)*.45;
  var bx=[pa.left+18,pa.right-18,pa.left+18,pa.right-18],by=[pa.top+18,pa.top+18,pa.bottom-18,pa.bottom-18];
  for(var b=0;b<4;b++){ctx.beginPath();ctx.arc(bx[b],by[b],beaconR,0,Math.PI*2);ctx.fill();}
  ctx.restore();
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
  /* Small orbital particles are part of the spacecraft identity, not a generic neon halo. */
  ctx.save();
  for(var auraI=0;auraI<7;auraI++){
    var auraA=elapsedTotal*(1.1+(auraI%3)*.18)+auraI*0.897;
    var auraR=player.width*(1.02+(auraI%3)*.18);
    var auraX=cx+Math.cos(auraA)*auraR, auraY=cy+Math.sin(auraA)*auraR*.72;
    var auraSize=1.6+(auraI%2)*1.2;
    ctx.globalAlpha=.22+.12*Math.sin(elapsedTotal*2+auraI);
    ctx.fillStyle=themeFxColor(auraI,.72);ctx.beginPath();ctx.arc(auraX,auraY,auraSize,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
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
  var pulse=.72+Math.sin(elapsedTotal*3)*.12;
  /* Pet has a restrained orbital field matching the current level palette. */
  ctx.globalAlpha=.24;ctx.strokeStyle=themeFxColor(1,.75);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(petState.x,petState.y,spr.R*1.18,spr.R*.72,petState.angle*.3,0,Math.PI*2);ctx.stroke();
  for(var pi=0;pi<4;pi++){
    var pa=elapsedTotal*(1.4+(pi*.08))+pi*Math.PI/2;
    ctx.globalAlpha=.28;ctx.fillStyle=themeFxColor(pi,.85);
    ctx.beginPath();ctx.arc(petState.x+Math.cos(pa)*spr.R*1.28,petState.y+Math.sin(pa)*spr.R*.82,1.7,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=pulse;
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
    var trailLen=Math.min(34,Math.max(10,Math.sqrt(p.vx*p.vx+p.vy*p.vy)*0.022));
    ctx.save();
    ctx.globalAlpha=.18;ctx.strokeStyle=(gunUpgLv>1?'#ffffff':'#8ee8ff');ctx.lineWidth=Math.max(1.2,p.r*.55);
    ctx.beginPath();ctx.moveTo(0,trailLen);ctx.lineTo(0,0);ctx.stroke();
    ctx.globalAlpha=1;
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
    var enteredDanger=isLow&&domCache.hpLow!==true;
    domCache.hpLow=isLow;
    if(isLow&&playerPoisonTime<=0)hpFill.classList.add('low');
    else if(!isLow&&playerPoisonTime<=0)hpFill.classList.remove('low');
    if(dangerVignette)dangerVignette.classList.toggle('on',isLow);
    if(enteredDanger&&appState==='playing')sfxDanger();
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

var killMilestoneMarks={};
var autoPausedByVisibility=false;
var pauseReason='manual';
function checkKillMilestone(){
  var n=runKillCount||0;
  var marks=[10,25,50,100,150,250,500];
  var mark=0,label='';
  for(var mi=0;mi<marks.length;mi++){if(n>=marks[mi]&&!killMilestoneMarks[marks[mi]])mark=marks[mi];}
  if(!mark)return;
  killMilestoneMarks[mark]=true;
  label=mark+' KILLS!';
  showWaveBanner(label,false);
  try{sfxStreak();}catch(e){}
  pushShockwave(player.x+player.width/2,player.y+player.height/2,90+mark*.4,'rgba(255,200,100,0.8)',0.45);
  pushParticle(player.x+player.width/2,player.y-18,0,-55,0.8,'#ffc857',0,'+'+mark);
  triggerShake(Math.min(10,3+mark/25),0.16);
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

function showFinalEnding(){
  var screen=document.getElementById('finalEndingScreen');
  var winM=document.getElementById('winModal');
  if(winM)winM.classList.remove('on');
  if(!screen)return;
  appState='finalEnding';
  screen.classList.add('on');
  screen.setAttribute('aria-hidden','false');
  sfxVictory();
  var archive=document.getElementById('finalEndingArchive');
  var menu=document.getElementById('finalEndingMenu');
  if(archive){archive.onclick=function(){initAudio();sfxClick();screen.classList.remove('on');screen.setAttribute('aria-hidden','true');goScreen('story','storyArchive');};}
  if(menu){menu.onclick=function(){initAudio();sfxClick();screen.classList.remove('on');screen.setAttribute('aria-hidden','true');goScreen('menu','menu');};}
}

function showWinModal(){
  if(winShown)return;
  winShown=true;
  // Freeze the run while the result screen is visible. Without a dedicated
  // state, the gameplay loop could keep spawning, damaging, and mutating
  // score/state behind the victory modal before the player pressed a button.
  appState='winModal';
  paused=false;
  hud.classList.remove('on');
  hint.classList.remove('on');
  skillBtn.classList.remove('on','active','ready');
  bossWrap.classList.remove('on');
  comboHud.classList.remove('on');
  streakHudEl.style.opacity='0';
  petHud.classList.remove('on');
  pauseBtn.classList.remove('on');
  stopBGM();
  setMusicMode('victory');
  if(save.bgmOn){initAudio();startBGM();}
  if(isNetworkGame&&window.DS_MP.sharedCombat&&!amHost())return;
  var elapsedSec=Math.ceil(elapsed);
  var isEndless=!!(currentLevel&&currentLevel.isEndless);
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
  if(winContinueBtn)winContinueBtn.textContent=currentLevel&&currentLevel.isFinal?'LIHAT EPILOG':'LANJUT';
  if(winKp)winKp.textContent=formatKP(runKills);
  if(winKills)winKills.textContent=runKillCount;
  if(winTime)winTime.textContent=elapsedSec+'s';
  if(winNoHit)winNoHit.textContent=tookDamageThisRun?'Tidak':'YA!';
  if(winBonus)winBonus.textContent=bonus>0?('+'+formatKP(bonus)+' Bonus KP'):'Tidak ada bonus';
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
  if(winModal&&window.gsap){
    try{
      var winBox=winModal.querySelector('.win-box');
      gsap.killTweensOf(winBox);
      gsap.fromTo(winBox,{opacity:0,y:24,scale:.94,filter:'blur(5px)'},{opacity:1,y:0,scale:1,filter:'blur(0px)',duration:.55,ease:'back.out(1.35)',clearProps:'transform,opacity,filter'});
      var winRows=winModal.querySelectorAll('.win-stat-row,.win-bonus,.win-btn');
      gsap.fromTo(winRows,{opacity:0,y:10},{opacity:1,y:0,duration:.32,ease:'power2.out',stagger:.055,delay:.16,clearProps:'transform,opacity'});
    }catch(e){}
  }
  if(window.DS_MP.active&&isNetworkGame&&amHost()&&window.DS_MP.onGameEnd)window.DS_MP.onGameEnd();
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
  if(!challengeRun)save.winFlags[currentLevel.id]=true;
  if(!challengeRun&&!tookDamageThisRun)save.noHitFlags[currentLevel.id]=true;
  if(currentLevel.id===3)save.hardWins++;
  if(currentLevel.id===4)save.expertWins++;
  if(currentLevel.id===5)save.nightmareWins++;
  if(currentLevel.id===6)save.impossibleWins++;
  if(currentLevel.id===7)save.doomWins=(save.doomWins||0)+1;
  if(currentLevel.id===8)save.rrrorWins=(save.rrrorWins||0)+1;
  if(currentLevel.isFinal)save.finalWins=(save.finalWins||0)+1;
  checkAchievements();
  persist();
}

function endGame(won){
  // End-game processing is idempotent: double clicks, duplicate callbacks, or
  // network echoes must never duplicate best-score/persist/UI work.
  if(appState==='ended')return false;
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
    spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.45,24);
    overlayTitle.textContent='MENANG';
    overlayTitle.classList.remove('lose');
    overlayText.textContent='Poin: '+runKills+'  |  Musuh: '+runKillCount;
    spawnConfetti(['#ff6b4a','#ffc857','#3ddc97','#67c7f0','#9b6bff'],60);
  }else{
    spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.45,10);
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
  return true;
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
      if(isNetworkGame&&window.DS_MP.sharedCombat&&e.id&&window.MP_damageGlobalEnemy)window.MP_damageGlobalEnemy(e.id,bdmg);
      else{e.hp-=bdmg;e.hitFlash=0.2;}
    }
    for(var bj=0;bj<bosses.length;bj++){
      var bo=bosses[bj];
      if(bo.spawnT>0)continue;
      if(isNetworkGame&&window.DS_MP.sharedCombat&&bo.id&&window.MP_damageGlobalBoss)window.MP_damageGlobalBoss(bo.id,bdmg);
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
  if(!isNetworkGame||!window.DS_MP.sharedCombat)return;
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

function pauseGame(reason){
  if(window.DS_MP.active)return;
  if(appState==='transitioning')return;
  pauseReason=reason||'manual';
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
  if(document.hidden)return;
  pauseReason='manual';
  paused=false;
  autoPausedByVisibility=false;
  appState='playing';
  var pm=document.getElementById('pauseModal');
  if(pm)pm.classList.remove('on');
  if(save.bgmOn){setMusicMode(currentLevel?'combat':'menu');startBGM();}
  sfxClick();
}
function quitToMenu(){
  if(appState!=='paused'&&appState!=='playing'&&appState!=='ended')return false;
  var pm=document.getElementById('pauseModal');
  if(pm)pm.classList.remove('on');
  var ok=goScreen('menu','menu');
  if(ok){autoPausedByVisibility=false;sfxClick();}
  return ok;
}

function updateResponsiveHud(){
  var narrow=window.innerWidth<720;
  document.documentElement.classList.toggle('is-narrow',narrow);
  var pause=document.getElementById('pauseBtn');
  if(pause)pause.setAttribute('aria-label',narrow?'Jeda':'Jeda permainan');
}
var audioGestureBound=false;
function bindAudioGesture(){
  if(audioGestureBound)return;
  audioGestureBound=true;
  document.addEventListener('pointerdown',function(){
    try{
      initAudio();
      if(save.bgmOn && !bgmPlaying && (appState==='menu'||appState==='mpMenu'||appState==='mpLobbyMenu'||appState==='storyArchive'||appState==='shopMenu'||appState==='achMenu'||appState==='statsMenu'||appState==='friendsMenu'||appState==='challengeMenu'||appState==='spinMenu'))startBGM();
    }catch(e){}
  },{passive:true});
}
bindAudioGesture();
window.addEventListener('resize',updateResponsiveHud,{passive:true});
window.addEventListener('orientationchange',function(){setTimeout(updateResponsiveHud,80);},{passive:true});
updateResponsiveHud();

function updateAdaptiveQuality(frameMs){
  qualityEma=qualityEma*0.92+frameMs*0.08;
  if(qualityEma>24){qualitySlowFrames++;qualityFastFrames=0;}
  else if(qualityEma<15){qualityFastFrames++;qualitySlowFrames=0;}
  else {qualitySlowFrames=Math.max(0,qualitySlowFrames-1);qualityFastFrames=Math.max(0,qualityFastFrames-1);}
  if(qualitySlowFrames>18){adaptiveQuality=Math.max(PERF_MODE?0.72:0.78,adaptiveQuality-0.04);qualitySlowFrames=0;}
  else if(qualityFastFrames>45){adaptiveQuality=Math.min(1,adaptiveQuality+0.03);qualityFastFrames=0;}
}

function loop(ts){
  requestAnimationFrame(loop);
  var rawDt=(loop.lastTs?(ts-loop.lastTs)/1000:0.016);
  loop.lastTs=ts;
  updateAdaptiveQuality(Math.min(50,rawDt*1000));
  var dt=rawDt;
  if(dt>0.05)dt=0.05;
  elapsedTotal+=dt;
  updateAmbient(dt);
  if(appState==='playing'||appState==='playingMP'){
    if(window.DS_MP.active&&window.DS_MP.gameEnded){
      updateParticles(dt);
      updatePixiFx();
      updateShockwaves(dt);
    }else if(window.DS_MP.active&&window.DS_MP.dead){
      if(window.DS_MP.onTickDead)window.DS_MP.onTickDead(dt);
    }else if(winShown){
      updateParticles(dt);
      updatePixiFx();
      updateShockwaves(dt);
      updateThruster(dt);
      updateShipFx(dt);
    }else{
      if(window.DS_MP.active&&window.DS_MP.serverEndAt){
        var serverNow=Date.now()+(Number(window.DS_MP.serverOffset)||0);
        if(serverNow>=Number(window.DS_MP.serverEndAt)){
          if(window.DS_MP.onServerTimeExpired)window.DS_MP.onServerTimeExpired();
          elapsed=currentLevel.duration;
          winShown=true;
          appState='waitingHost';
        }else if(window.DS_MP.serverStartAt){elapsed=Math.max(0,(serverNow-Number(window.DS_MP.serverStartAt))/1000);}
      }else{
        elapsed+=dt;
      }
      if(damageIFrame>0){damageIFrame-=dt;if(damageIFrame<0)damageIFrame=0;}
      if(isNetworkGame){
        syncNetworkEnemies(dt);
      }
      if(!currentLevel.isFinal&&!currentLevel.isEndless){
        if(!winShown){
          if(!isNetworkGame||!window.DS_MP.sharedCombat||amHost()){
            if(elapsed>=nextBossTime&&currentLevel.bossInterval<999){
              nextBossTime+=currentLevel.bossInterval;
              if(bosses.length===0)spawnBoss();
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
        if(!winShown&&(!isNetworkGame||!window.DS_MP.sharedCombat||amHost())){
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
      updatePixiFx();
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
      }else if(currentLevel.isFinal&&bosses.length===0&&finalBossNext>=(currentLevel.finalBossCount||BOSS_TYPES.length)&&!winShown){
        if(!isNetworkGame||!window.DS_MP.sharedCombat||amHost())showWinModal();
      }else if(!currentLevel.isEndless&&!currentLevel.isFinal&&isFinite(currentLevel.duration)&&elapsed>=currentLevel.duration&&!winShown){
        if(window.DS_MP.active&&window.DS_MP.serverEndAt){
          if(window.DS_MP.onServerTimeExpired)window.DS_MP.onServerTimeExpired();
        }else if(!isNetworkGame||!window.DS_MP.sharedCombat||amHost()){
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

var WIPE_MS=560,wipeLock=false,wipeSequence=0;
function setWipeTransform(value){
  if(!wipeEl)return;
  wipeEl.style.setProperty('transform',value,'important');
}
function setWipeTransition(value){
  if(!wipeEl)return;
  wipeEl.style.setProperty('transition',value,'important');
}
function setWipePhase(phase){
  if(!wipeEl)return;
  wipeEl.setAttribute('data-phase',phase);
  wipeEl.style.setProperty('--wipe-phase',phase==='in'?'0':phase==='cover'?'50':phase==='out'?'75':'100');
}
function playWipe(direction,onCovered,onDone){
  if(wipeLock||!wipeEl)return false;
  wipeLock=true;
  var token=++wipeSequence;
  var incoming=(direction==='left')?-110:110;
  var outgoing=(direction==='left')?110:-110;
  var finished=false,covered=false,raf=0,safetyTimer=null;
  function clearAll(){if(raf)cancelAnimationFrame(raf);if(safetyTimer)clearTimeout(safetyTimer);raf=0;safetyTimer=null;}
  function finish(){
    if(finished||token!==wipeSequence)return;
    finished=true;clearAll();
    wipeEl.classList.remove('active','phase-in','phase-cover','phase-out');
    setWipePhase('done');setWipeTransition('none');
    setWipeTransform('translate3d('+incoming+'vw,0,0)');
    wipeEl.style.pointerEvents='none';
    wipeLock=false;
    try{if(onDone)onDone();}catch(err){console.error('Transition completion error',err);}
  }
  function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function animate(from,to,duration,phase,done){
    var started=performance.now();
    setWipePhase(phase);
    function frame(now){
      if(finished||token!==wipeSequence)return;
      var t=Math.min(1,(now-started)/duration),e=ease(t),x=from+(to-from)*e;
      setWipeTransform('translate3d('+x+'vw,0,0)');
      if(t<1){raf=requestAnimationFrame(frame);return;}
      raf=0;if(done)done();
    }
    raf=requestAnimationFrame(frame);
  }
  try{
    wipeEl.classList.add('active','phase-in');
    wipeEl.classList.remove('phase-out','phase-cover');
    wipeEl.style.pointerEvents='auto';
    setWipeTransition('none');
    setWipeTransform('translate3d('+incoming+'vw,0,0)');
    animate(incoming,0,WIPE_MS,'in',function(){
      if(finished||token!==wipeSequence)return;
      if(!covered){
        covered=true;wipeEl.classList.remove('phase-in');wipeEl.classList.add('phase-cover');setWipePhase('cover');
        try{spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.5,26);}catch(e){console.error(e);}
        try{if(onCovered)onCovered();}catch(err){console.error('Transition covered callback error',err);}
      }
      setTimeout(function(){
        if(finished||token!==wipeSequence)return;
        wipeEl.classList.remove('phase-cover');wipeEl.classList.add('phase-out');
        animate(0,outgoing,WIPE_MS,'out',finish);
      },70);
    });
    safetyTimer=setTimeout(function(){finish();},WIPE_MS*2+1000);
  }catch(err){console.error('Transition setup error',err);finish();}
  return true;
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
  menuScreen:document.getElementById('menuScreen'),storyScreen:document.getElementById('storyScreen'),levelScreen:document.getElementById('levelScreen'),
  shopScreen:document.getElementById('shopScreen'),achScreen:document.getElementById('achScreen'),
  statsScreen:document.getElementById('statsScreen'),helpScreen:document.getElementById('helpScreen'),
  voucherScreen:document.getElementById('voucherScreen'),spinScreen:document.getElementById('spinScreen'),
  mpScreen:document.getElementById('mpScreen'),mpLobbyScreen:document.getElementById('mpLobbyScreen'),
  challengeScreen:document.getElementById('challengeScreen'),
  friendsScreen:document.getElementById('friendsScreen'),
  voucherInput:document.getElementById('voucherInput'),voucherEnter:document.getElementById('voucherEnter'),
  voucherBack:document.getElementById('voucherBack'),voucherMsg:document.getElementById('voucherMsg'),
  voucherTotal:document.getElementById('voucherTotal'),
  levelsGrid:document.getElementById('levelsGrid'),chapterTabs:document.getElementById('chapterTabs'),storyArchiveList:document.getElementById('storyArchiveList'),storyProgress:document.getElementById('storyProgress'),storyProgressBig:document.getElementById('storyProgressBig'),
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
  menuTrophyCount:document.getElementById('menuTrophyCount'),
  globalChampionCard:document.getElementById('globalChampionCard'),globalChampionName:document.getElementById('globalChampionName'),
  champKill:document.getElementById('champKill'),champLevel:document.getElementById('champLevel'),champAch:document.getElementById('champAch'),champItems:document.getElementById('champItems'),champScore:document.getElementById('champScore'),
  menuShipPreview:document.getElementById('menuShipPreview'),menuGear:document.getElementById('menuGear'),
  mpLevelBadge:document.getElementById('mpLevelBadge'),mpLevelNum:document.getElementById('mpLevelNum'),dailyQuestList:document.getElementById('dailyQuestList'),
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
var shopActionBusy=false;
var currentChapterTab=1;

function formatCompact(value){
  var n=Number(value);
  if(!isFinite(n))return '0';
  n=Math.max(0,n);
  var units=['','K','M','B','T','QD','QT','SX','SP','OC','NO','DC','UD','DD','TD','QAD','QID','SXD','SPD','OCD','NOD','VG'];
  if(n<1000)return Math.floor(n).toLocaleString('id-ID');
  var tier=Math.floor(Math.log10(n)/3);
  if(tier>=units.length)tier=units.length-1;
  var scaled=n/Math.pow(1000,tier);
  var decimals=scaled>=100?0:(scaled>=10?1:2);
  var out=scaled.toFixed(decimals).replace(/\.?0+$/,'');
  // Indonesian UI uses comma as the decimal separator: 1,2M.
  return out.replace('.',',')+units[tier];
}
function formatKP(value){return formatCompact(value);}
function formatXP(value){return formatCompact(value);}
function formatCount(value){return formatCompact(value);}


function refreshHeaderKills(){
  var k=formatKP(save.kills);
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
  dom.pKills.textContent=formatKP(save.kills);
  dom.pBoss.textContent=formatKP(save.bossKills);
  dom.pAch.textContent=achDone()+'/'+ACHIEVEMENTS.length;
  dom.pShips.textContent=save.ships.length+'/'+SHIPS.length;
  dom.achSub.textContent=achDone()+'/'+ACHIEVEMENTS.length;
  dom.shopSub.textContent=formatKP(save.kills)+' KP';
  if(dom.endlessBest)dom.endlessBest.textContent=formatCount(save.endlessBest);
  if(dom.chNoHitBest)dom.chNoHitBest.textContent=formatCount(save.challengeBests.nohit||0);
  if(dom.chPistolBest)dom.chPistolBest.textContent=formatCount(save.challengeBests.pistol||0);
  if(dom.chSpeedBest)dom.chSpeedBest.textContent=(save.challengeBests.speed||0)+(save.challengeBests.speed?'s':'-');
  if(dom.chBossBest)dom.chBossBest.textContent=formatCount(save.challengeBests.bossrush||0);
  var fCount=0;for(var fk in save.friends)if(save.friends[fk])fCount++;
  var fEl=document.getElementById('friendCount');
  if(fEl)fEl.textContent=fCount;
}

function todayKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function yesterdayKey(){var d=new Date();d.setDate(d.getDate()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dailyQuestStatus(){var qs=dailyQuestData(),ready=0,claimed=0;for(var i=0;i<qs.length;i++){if(qs[i].progress>=qs[i].goal)ready++;if(save.dailyQuest.claimed[qs[i].id])claimed++;}return {total:qs.length,ready:ready,claimed:claimed,complete:qs.length>0&&claimed===qs.length};}
function updateDailyStreak(){var st=dailyQuestStatus();if(!st.complete)return false;var t=todayKey();if(save.dailyLastComplete===t)return false;save.dailyStreak=save.dailyLastComplete===yesterdayKey()?save.dailyStreak+1:1;save.dailyLastComplete=t;persist();return true;}
function updateDailyMenuBadge(){var st=dailyQuestStatus(),badge=document.getElementById('dailyTileBadge'),mini=document.getElementById('dailyMiniStatus'),sb=document.getElementById('dailyStreakBadge');if(badge){if(st.ready>st.claimed){badge.textContent=String(st.ready-st.claimed);badge.style.display='flex';}else badge.style.display='none';}if(mini)mini.textContent=st.claimed+'/'+st.total;if(sb)sb.textContent=(save.dailyStreak||0)+' DAY';}

function updateMenuCard(){
  if(dom.menuPlayerName)dom.menuPlayerName.textContent=(save.playerName||'PLAYER').toUpperCase();
  if(dom.menuPlayerLevel)dom.menuPlayerLevel.textContent='LV '+save.level;
  if(dom.menuTrophyCount)dom.menuTrophyCount.textContent=save.trophies;
  var needed=xpNeededForLevel(save.level);
  if(dom.menuXpFill&&dom.menuXpText){
    var pct=needed>0?Math.min(100,(save.xp/needed)*100):100;
    dom.menuXpFill.style.width=pct+'%';
    dom.menuXpText.textContent=formatXP(save.xp)+' / '+(needed?formatXP(needed):'MAX');
  }
  var playLabel=document.getElementById('playBtnLabel'),playMeta=document.getElementById('playBtnMeta'),playBtn=document.getElementById('playBtn');
  var last=null;
  if(typeof save.lastLevelId==='number'&&isFinite(save.lastLevelId)&&save.lastLevelId>=0){
    for(var li=0;li<LEVELS.length;li++){if(Number(LEVELS[li].id)===Number(save.lastLevelId)){last=LEVELS[li];break;}}
  }
  var canResume=!!(last&&!last.isEndless&&isLevelUnlocked(last.id));
  if(playLabel)playLabel.textContent='MULAI';
  if(playMeta)playMeta.textContent=canResume?('LANJUT · BAB '+last.id):'PILIH BAB & MISI';
  if(playBtn)playBtn.setAttribute('aria-label','Pilih bab dan misi');
  updateDailyMenuBadge();
  try{if(window.MP_refreshGlobalChampion)window.MP_refreshGlobalChampion();}catch(e){}
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
    var t=formatXP(save.xp)+' / '+(needed?formatXP(needed):'MAX');
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

function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function formatDuration(d){if(!isFinite(d))return 'Tanpa batas waktu';return d+' detik';}

function renderStoryArchive(){
  var list=dom.storyArchiveList;if(!list)return;
  var completed=0,html='';
  for(var i=0;i<STORY_CHAPTERS.length;i++){
    var ch=STORY_CHAPTERS[i],unlocked=storyChapterUnlocked(i),done=storyChapterDone(ch),claimed=!!save.storyClaimed[ch.id];
    if(done)completed++;
    var state=done?'SELESAI':unlocked?'TERBUKA':'TERKUNCI';
    var cls='story-archive-card '+(done?'done ':'')+(unlocked?'unlocked':'locked');
    var first=(ch.log&&ch.log[0])?ch.log[0]:['ARCHIVE','Log belum tersedia.'];
    html+='<article class="'+cls+'" style="--story-accent:'+ch.accent+'">';
    html+='<div class="story-archive-head"><div><div class="story-archive-chapter">BAB '+ch.id+'</div><div class="story-archive-name">'+esc(ch.title)+'</div></div><span class="story-archive-status">'+state+'</span></div>';
    html+='<div class="story-archive-tone">'+esc(ch.tone||'ARCHIVE // CLASSIFIED')+'</div>';
    html+='<div class="story-archive-desc">'+esc(ch.desc)+'</div>';
    html+='<div class="story-archive-quote"><b>'+esc(first[0])+'</b>'+esc(first[1])+'</div>';
    html+='<div class="story-archive-fragment '+(unlocked?'revealed':'encrypted')+'"><span>'+(unlocked?'FIELD FRAGMENT // DECRYPTED':'FIELD FRAGMENT // ENCRYPTED')+'</span><p>'+esc(unlocked?(ch.fragment||'Fragment belum tersedia.'):'Selesaikan misi bab sebelumnya untuk membuka rekaman ini.')+'</p></div>';
    html+='<div class="story-archive-meta"><span class="story-archive-pill">'+ch.levels.length+' MISI</span><span class="story-archive-pill">+'+formatKP(ch.reward)+' KP</span><span class="story-archive-pill">+'+formatXP(ch.xp)+' XP</span></div>';
    html+='<div class="story-archive-actions"><button class="story-archive-btn primary" data-story-read="'+i+'" '+(unlocked?'':'disabled')+'>BACA LOG</button>';
    if(done&&!claimed)html+='<button class="story-archive-btn" data-story-claim="'+i+'">AMBIL ARSIP</button>';
    else if(claimed)html+='<button class="story-archive-btn" disabled>ARSIP DITERIMA</button>';
    else html+='<button class="story-archive-btn" disabled>SELESAIKAN BAB</button>';
    html+='</div></article>';
  }
  list.innerHTML=html;
  if(dom.storyProgress)dom.storyProgress.textContent=completed+'/5 BAB';
  if(dom.storyProgressBig)dom.storyProgressBig.textContent=completed+' / 5';
  var reads=list.querySelectorAll('[data-story-read]');
  for(var r=0;r<reads.length;r++)reads[r].addEventListener('click',function(){var i=Number(this.getAttribute('data-story-read'));showLoreChapter(i);});
  var claims=list.querySelectorAll('[data-story-claim]');
  for(var c=0;c<claims.length;c++)claims[c].addEventListener('click',function(){var i=Number(this.getAttribute('data-story-claim'));if(claimStoryReward(i)){sfxBuy();showToast('Arsip bab disimpan.','success');renderStoryArchive();refreshAll();}});
}
function showLoreChapter(index){
  var ch=STORY_CHAPTERS[index];if(!ch||!storyChapterUnlocked(index))return;
  var box=document.getElementById('dialogueBox'),name=document.getElementById('dialogueSpeaker'),text=document.getElementById('dialogueText'),btn=document.getElementById('dialogueNext');
  if(!box)return;
  var lines=ch.log||[];var i=0;appState='storyArchive';box.classList.add('on');box._levelStory=false;box._storyLog=true;
  function render(){var line=lines[i]||['ARCHIVE',''];var badge=box.querySelector('.dialogue-badge');if(badge)badge.textContent='ARCHIVE // BAB '+ch.id;if(name)name.textContent=line[0];if(text)text.textContent=line[1];if(btn)btn.textContent=i<lines.length-1?'LANJUT':'TUTUP';}
  box._render=render;box._after=null;render();
  box._storyAdvance=function(){if(i<lines.length-1){i++;render();return;}box.classList.remove('on');box._storyLog=false;box._storyAdvance=null;appState='storyArchive';};
}

function renderStory(){
  var daily=dom.dailyQuestList;if(!daily)return;
  var qs=dailyQuestData(),qh='';
  for(var j=0;j<qs.length;j++){var q=qs[j],claimed=!!save.dailyQuest.claimed[q.id],pct=Math.min(100,Math.round(q.progress/q.goal*100));
    qh+='<div class="daily-quest '+(claimed?'done':'')+'"><div class="daily-quest-title">'+q.title+'</div><div class="daily-quest-desc">'+q.desc+'</div><div class="daily-quest-track"><div class="daily-quest-fill" style="width:'+pct+'%"></div></div><div class="daily-quest-meta"><span>'+Math.min(q.progress,q.goal)+' / '+q.goal+'</span><span>+'+formatKP(q.reward)+' KP</span><span>+'+formatXP(q.xp)+' XP</span></div>';
    if(claimed)qh+='<button class="daily-quest-action" disabled>SELESAI</button>';else qh+='<button class="daily-quest-action" data-claim-daily="'+q.id+'" '+(q.progress<q.goal?'disabled':'')+'>AMBIL</button>';
    qh+='</div>';
  }
  daily.innerHTML=qh;updateDailyStreak();updateDailyMenuBadge();
  var dq=daily.querySelectorAll('[data-claim-daily]');for(var c=0;c<dq.length;c++)dq[c].addEventListener('click',function(){if(this.disabled)return;initAudio();if(claimDailyQuest(this.getAttribute('data-claim-daily'))){updateDailyStreak();try{sfxBuy();}catch(e){}try{showToast('Misi selesai!','success');}catch(e){}renderStory();refreshAll();}});
}

function chapterForLevel(levelId){if(levelId<=2)return 1;if(levelId<=5)return 2;if(levelId<=8)return 3;if(levelId<=11)return 4;return 5;}
function isChapterUnlocked(chapter){if(chapter<=1)return true;var prev=chapter-1,ids=[];for(var i=0;i<LEVELS.length;i++)if(!LEVELS[i].isEndless&&chapterForLevel(LEVELS[i].id)===prev)ids.push(LEVELS[i].id);for(var j=0;j<ids.length;j++)if(!save.winFlags[ids[j]])return false;return true;}
function renderChapterTabs(){if(!dom.chapterTabs)return;var tabs=dom.chapterTabs.querySelectorAll('.chapter-tab');for(var i=0;i<tabs.length;i++){var c=Number(tabs[i].getAttribute('data-chapter'));var ok=isChapterUnlocked(c);tabs[i].classList.toggle('on',c===currentChapterTab);tabs[i].classList.toggle('locked',!ok);tabs[i].disabled=!ok;tabs[i].setAttribute('aria-selected',c===currentChapterTab?'true':'false');}}
function renderLevels(){
  if(!dom.levelsGrid)return false;
  var html='';
  var list=[];
  for(var i=0;i<LEVELS.length;i++){
    var candidate=LEVELS[i];
    if(!candidate||candidate.isEndless||Number(candidate.chapter)!==Number(currentChapterTab))continue;
    list.push(candidate);
  }
  // Campaign contract: every chapter must visibly expose its missions.
  // If data is ever malformed, fail visibly instead of showing an empty screen.
  if(!list.length){
    dom.levelsGrid.innerHTML='<div class="level-empty"><strong>BAB '+currentChapterTab+'</strong><span>Data misi tidak tersedia.</span></div>';
    renderChapterTabs();
    return false;
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
    var ls=LEVEL_STORIES[L.id];if(ls&&ls[0])html+='<div class="lc-story">'+esc(ls[0][1])+'</div>';
    html+='<div class="lc-time">'+formatDuration(L.duration)+' | Spawn x'+L.spawnRateMult+' | HP x'+L.hpMult+' | DMG x'+L.dmgMult+'</div>';
    if(unlocked){
      html+='<div class="lc-best"><svg viewBox="0 0 24 24"><path d="M12 2C7.03 2 3 6.03 3 11c0 2.4 1 4.6 2.5 6.2V21c0 .55.45 1 1 1h11c.55 0 1-.45 1-1v-3.8C20 15.6 21 13.4 21 11c0-4.97-4.03-9-9-9z"/></svg>Best Kill: '+formatCount(best)+'</div>';
    }else{
      html+='<div class="lc-lock">Buka: '+formatKP(L.unlockCost)+' KP</div>';
    }
    html+=badge;
    html+='</div>';
  }
  dom.levelsGrid.innerHTML=html;
  renderChapterTabs();
  var cards=dom.levelsGrid.querySelectorAll('.level-card');
  for(var c=0;c<cards.length;c++){
    cards[c].addEventListener('click',function(){
      initAudio();
      var levelId=Number(this.getAttribute('data-level'));
      var L=null;for(var li2=0;li2<LEVELS.length;li2++){if(Number(LEVELS[li2].id)===levelId){L=LEVELS[li2];break;}}
      if(!L)return;
      if(!isLevelUnlocked(L.id)){
        if(save.kills<L.unlockCost){showToast('KP tidak cukup. Butuh '+formatKP(L.unlockCost)+' KP.','error');return;}
        showConfirm('Buka tingkat '+L.name+' dengan '+formatKP(L.unlockCost)+' KP?',function(){
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
  return '<img src="'+(spr.dataUrl||'')+'" alt="" style="width:'+size+'px;height:'+size+'px;image-rendering:auto;">';
}

function renderShopPreview(dt){
  if(!shopPreviewCtx||!shopPreviewCanvas)return;
  var cw=shopPreviewCanvas.width,ch=shopPreviewCanvas.height;if(cw<=0||ch<=0)return;
  var g=shopPreviewCtx,ship=findShip(save.selectedShip),shape=findShape(save.selectedShape),gun=findGun(save.selectedGun);
  var key=ship.id+'_'+shape.id,spriteSet=playerSpriteCache[key]||playerSpriteCache[ship.id+'_square']||playerSpriteCache['default_square'];
  if(!spriteSet)return;
  var cx=cw*.50,cy=ch*.60,phase=elapsedTotal*.8;
  g.clearRect(0,0,cw,ch);
  var bg=g.createLinearGradient(0,0,0,ch);bg.addColorStop(0,'#050b13');bg.addColorStop(.55,'#0a1420');bg.addColorStop(1,'#07101a');g.fillStyle=bg;g.fillRect(0,0,cw,ch);
  // Engineering grid / hangar floor.
  g.strokeStyle='rgba(83,215,232,.065)';g.lineWidth=1;
  for(var gx=0;gx<cw;gx+=28){g.beginPath();g.moveTo(gx,0);g.lineTo(gx,ch);g.stroke();}
  for(var gy=0;gy<ch;gy+=28){g.beginPath();g.moveTo(0,gy);g.lineTo(cw,gy);g.stroke();}
  // Effect bay rings: the shop is now a live systems/effects showroom, not a static card preview.
  var accent=ship.cockpit||'#53d7e8';
  for(var rr=34;rr<Math.min(cw,ch)*.46;rr+=28){g.strokeStyle=hexToRgba(accent,.09);g.beginPath();g.arc(cx,cy,rr,phase*.15+(rr%56)/80,phase*.15+(rr%56)/80+Math.PI*1.55);g.stroke();}
  // Orbiting telemetry particles, capped for low-end devices.
  var count=PERF_MODE?14:22;
  for(var i=0;i<count;i++){
    var a=phase*(.55+(i%3)*.08)+i*6.283/count,r=48+(i%5)*17;
    var px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r*.62,sz=1.2+(i%3)*.7;
    g.fillStyle=hexToRgba(i%4===0?'#ffbf4b':accent,.42+(i%4)*.08);g.beginPath();g.arc(px,py,sz,0,Math.PI*2);g.fill();
  }
  // Jet exhaust effect.
  for(var e=0;e<5;e++){var ey=cy+52+e*11+(phase*42%(11));var ea=Math.max(.04,.28-e*.045);g.fillStyle=hexToRgba(accent,ea);g.beginPath();g.ellipse(cx+(e%2?4:-4),ey,5-e*.55,10-e*1.2,0,0,Math.PI*2);g.fill();}
  var glow=playerGlowCache[ship.id]||playerGlowCache.default;
  if(glow){g.save();g.globalAlpha=.30;g.drawImage(glow.normal.canvas,cx-glow.R*.8,cy-glow.R*.8,glow.R*1.6,glow.R*1.6);g.restore();}
  var sprite=spriteSet.normal,scale=Math.min(.92,cw/sprite.canvas.width*.62);
  g.drawImage(sprite.canvas,cx-sprite.canvas.width*scale/2,cy-sprite.canvas.height*scale/2,sprite.canvas.width*scale,sprite.canvas.height*scale);
  // Weapon test lane.
  shopPreviewFiring+=dt;
  if(shopPreviewFiring>=.16){shopPreviewFiring=0;var ps=playerProjSpriteCache[save.selectedGun]||playerProjSpriteCache.bullet;shopPreviewAnim=shopPreviewAnim||[];shopPreviewAnim.push({x:cx+(Math.sin(phase*1.8)*3),y:cy-28,vy:-320,life:.72,maxLife:.72,sprite:ps});if(shopPreviewAnim.length>18)shopPreviewAnim.shift();}
  if(shopPreviewAnim){for(var j=shopPreviewAnim.length-1;j>=0;j--){var q=shopPreviewAnim[j];q.life-=dt;q.y+=q.vy*dt;if(q.life<=0){shopPreviewAnim.splice(j,1);continue;}var qa=q.life/q.maxLife;g.save();g.globalAlpha=qa;g.drawImage(q.sprite.canvas,q.x-q.sprite.cx*.52,q.y-q.sprite.cy*.52,q.sprite.canvas.width*.52,q.sprite.canvas.height*.52);g.restore();}}
  // Pet effect orbit: companion reads as a system module attached to the jet.
  var pet=petSpriteCache[save.selectedPet];
  if(pet){var pa=phase*1.15+Math.PI*.35,pr=Math.min(cw,ch)*.28,ppx=cx+Math.cos(pa)*pr,ppy=cy+Math.sin(pa)*pr*.45;g.save();g.globalAlpha=.30;g.strokeStyle=pet.accent;g.lineWidth=1;g.setLineDash([4,6]);g.beginPath();g.ellipse(cx,cy,pr,pr*.45,0,0,Math.PI*2);g.stroke();g.setLineDash([]);g.globalAlpha=.92;g.drawImage(pet.canvas,ppx-pet.cx*.48,ppy-pet.cy*.48,pet.canvas.width*.48,pet.canvas.height*.48);g.restore();}
  g.fillStyle='#8fa1b7';g.font='700 9px Inter,system-ui,sans-serif';g.textAlign='left';g.fillText('EFFECT BAY // LIVE LOADOUT',10,16);g.fillStyle=accent;g.fillText(String(ship.name||'JET').toUpperCase()+' • '+String(gun.name||'GUN').toUpperCase(),10,ch-12);
  g.textAlign='right';g.fillStyle='#ffbf4b';g.fillText('REACTOR ONLINE',cw-10,16);
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
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+formatKP(item.cost)+'</span></div><button class="shop-btn buy" data-type="gun" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
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
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+formatKP(item.cost)+'</span></div><button class="shop-btn buy" data-type="ship" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
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
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+formatKP(item.cost)+'</span></div><button class="shop-btn buy" data-type="shape" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
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
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+formatKP(item.cost)+'</span></div><button class="shop-btn buy" data-type="skill" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
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
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+formatKP(item.cost)+'</span></div><button class="shop-btn buy" data-type="pet" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
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
      if(!owned){canBuy=save.kills>=item.cost&&chOK;html+='<div class="shop-cost">'+ICONS.skull+'<span>'+formatKP(item.cost)+'</span></div><button class="shop-btn buy" data-type="start" data-id="'+item.id+'" data-act="buy"'+(canBuy?'':' disabled')+'>'+(chOK?'BELI':'TERKUNCI')+'</button>';}
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
  if(shopActionBusy)return;
  shopActionBusy=true;
  var releaseShopLock=function(){setTimeout(function(){shopActionBusy=false;},180);};
  var type=this.getAttribute('data-type');
  var id=this.getAttribute('data-id');
  var act=this.getAttribute('data-act');
  try{
    if(act==='buy'){
      var cost=0,itemCh=null;
      if(type==='gun'){var g=findGun(id);if(!g||ownedGun(id))return;cost=g.cost;itemCh=g.chapter;}
      else if(type==='ship'){var s=findShip(id);if(!s||ownedShip(id))return;cost=s.cost;itemCh=s.chapter;}
      else if(type==='shape'){var sh=findShape(id);if(!sh||ownedShape(id))return;cost=sh.cost;itemCh=sh.chapter;}
      else if(type==='skill'){var sk=findSkill(id);if(!sk||ownedSkill(id))return;cost=sk.cost;itemCh=sk.chapter;}
      else if(type==='pet'){var pt=findPet(id);if(!pt||ownedPet(id))return;cost=pt.cost;itemCh=pt.chapter;}
      else if(type==='start'){var u=findStart(id);if(!u||ownedStart(id))return;cost=u.cost;itemCh=u.chapter;}
      else return;
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
      else return;
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
  }finally{releaseShopLock();}
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
  dom.achKills.textContent=formatCount(save.totalKills);
  dom.achBoss.textContent=save.bossKills;
  dom.achCombo.textContent='x'+Math.max(1,save.comboMax);
}

function renderStats(){
  dom.stKills.textContent=formatKP(save.kills);
  dom.stTotalKills.textContent=formatCount(save.totalKills);
  dom.stBoss.textContent=save.bossKills;
  dom.stHard.textContent=save.hardWins;
  dom.stExpert.textContent=save.expertWins;
  dom.stNightmare.textContent=save.nightmareWins;
  dom.stImpossible.textContent=save.impossibleWins;
  dom.stCombo.textContent='x'+Math.max(1,save.comboMax);
  dom.stAch.textContent=achDone()+'/'+ACHIEVEMENTS.length;
  if(dom.stTrophy)dom.stTrophy.textContent=save.trophies;
  if(dom.stEndless)dom.stEndless.textContent=formatCount(save.endlessBest);
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


/* === Indie FX runtime === */
function spawnIndieBurst(x,y,count){
  var layer=document.getElementById('indieFxLayer');
  if(!layer||!isFinite(x)||!isFinite(y))return;
  count=Math.max(4,Math.min(22,count||10));
  var frag=document.createDocumentFragment();
  var colors=['#ffc857','#ff6b4a','#3ddc97','#67c7f0','#9b6bff','#ff77a9'];
  for(var i=0;i<count;i++){
    var e=document.createElement('span');e.className='fx-spark';
    var a=Math.random()*Math.PI*2,dist=24+Math.random()*76;
    e.style.left=x+'px';e.style.top=y+'px';e.style.color=colors[i%colors.length];
    e.style.setProperty('--dx',(Math.cos(a)*dist).toFixed(1)+'px');
    e.style.setProperty('--dy',(Math.sin(a)*dist-20).toFixed(1)+'px');
    e.style.animationDelay=(Math.random()*.08).toFixed(3)+'s';
    frag.appendChild(e);
  }
  var ring=document.createElement('span');ring.className='fx-ring';ring.style.left=x+'px';ring.style.top=y+'px';frag.appendChild(ring);
  layer.appendChild(frag);
  setTimeout(function(){
    var nodes=layer.querySelectorAll('.fx-spark,.fx-ring');
    for(var n=0;n<nodes.length;n++)if(!nodes[n].isConnected)continue;
    if(layer.childNodes.length>90){while(layer.childNodes.length>55)layer.removeChild(layer.firstChild);}
  },720);
}
function installIndiePointerFX(){
  if(window.__indiePointerFX)return;window.__indiePointerFX=true;
  document.addEventListener('pointerdown',function(ev){
    var target=ev.target&&ev.target.closest?ev.target.closest('button,.menu-tile,.level-card,.challenge-row,.shop-card,.story-card'):null;
    if(!target||target.disabled)return;
    spawnIndieBurst(ev.clientX,ev.clientY,7);
  },{passive:true});
}
function animateScreenEntry(screen){
  if(!screen)return;
  if(window.gsap){
    try{
      gsap.killTweensOf(screen);
      gsap.fromTo(screen,{opacity:0,y:10,scale:.985},{opacity:1,y:0,scale:1,duration:.42,ease:'power3.out',clearProps:'opacity,transform'});
      return;
    }catch(e){}
  }
  screen.classList.remove('screen-entry-pulse');
  void screen.offsetWidth;
  screen.classList.add('screen-entry-pulse');
  setTimeout(function(){screen.classList.remove('screen-entry-pulse');},520);
}

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
  var all=[dom.menuScreen,dom.storyScreen,dom.levelScreen,dom.shopScreen,dom.achScreen,dom.statsScreen,dom.helpScreen,dom.voucherScreen,dom.spinScreen,dom.mpScreen,dom.mpLobbyScreen,dom.challengeScreen,dom.friendsScreen];
  for(var i=0;i<all.length;i++)if(all[i])all[i].classList.remove('on');
  refreshAll();
  if(name==='menu'){setMusicMode('menu');dom.menuScreen.classList.add('on');try{initAudio();if(save.bgmOn)startBGM();}catch(e){}try{if(window.MP_refreshGlobalChampion)window.MP_refreshGlobalChampion();}catch(e){}}
  else if(name==='story'){setMusicMode('story');dom.storyScreen.classList.add('on');renderStoryArchive();}
  else if(name==='level'){dom.levelScreen.classList.add('on');renderLevels();renderStory();refreshProfile();}
  else if(name==='shop'){
    setMusicMode('hangar');
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
  else if(name==='mp'){setMusicMode('mp');dom.mpScreen.classList.add('on');if(window.MP_refreshSelfPreview)window.MP_refreshSelfPreview();if(window.MP_renderRoomList)window.MP_renderRoomList();}
  else if(name==='mpLobby'){setMusicMode('mp');dom.mpLobbyScreen.classList.add('on');if(appState!=='mpLobbyMenu')appState='mpLobbyMenu';}
  else if(name==='challenge'){if(dom.challengeScreen)dom.challengeScreen.classList.add('on');refreshProfile();}
  else if(name==='friends'){if(dom.friendsScreen)dom.friendsScreen.classList.add('on');if(window.FR_renderFriends)window.FR_renderFriends();}
  var shown=document.querySelector('.screen.on');
  animateScreenEntry(shown);
}

function goScreen(name,stateName){
  if(appState==='transitioning')return false;
  var started=playWipe('left',function(){
    spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.5,14);
    hud.classList.remove('on');hint.classList.remove('on');
    if(dangerVignette)dangerVignette.classList.remove('on');
    skillBtn.classList.remove('on','active','ready');
    bossWrap.classList.remove('on');comboHud.classList.remove('on');
    streakHudEl.style.opacity='0';
    petHud.classList.remove('on');pauseBtn.classList.remove('on');
    overlay.classList.remove('on');
    showScreen(name);
    if(name==='menu')applyTheme(THEME_MENU);
    persist();
  },function(){appState=stateName||name;});
  if(!started)return false;
  appState='transitioning';
  return true;
}

function startLevel(level,isMP){
  if(appState==='transitioning')return false;
  var started=playWipe('right',function(){
    spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.5,14);
    var all=[dom.menuScreen,dom.storyScreen,dom.levelScreen,dom.shopScreen,dom.achScreen,dom.statsScreen,dom.helpScreen,dom.voucherScreen,dom.spinScreen,dom.mpScreen,dom.mpLobbyScreen,dom.challengeScreen,dom.friendsScreen];
    for(var i=0;i<all.length;i++)if(all[i])all[i].classList.remove('on');
    overlay.classList.remove('on');
    var winM=document.getElementById('winModal');if(winM)winM.classList.remove('on');
    var pm=document.getElementById('pauseModal');if(pm)pm.classList.remove('on');
    var rb=document.getElementById('mpReviveBox');if(rb)rb.classList.remove('on');
    applyTheme(level.theme);
    setMusicMode('combat');
    resetGame(level,currentChallenge);
    if(!isMP&&level.id&&!level.isEndless&&!currentChallenge){save.lastLevelId=Number(level.id)||0;save.lastPlayedAt=Date.now();persist();}
    buildBackground();
    initPixiFxLayer();
    hud.classList.add('on');if(dangerVignette)dangerVignette.classList.remove('on');showHint();
    if(save.selectedSkill)skillBtn.classList.add('on');
    if(save.selectedPet)petHud.classList.add('on');
    if(!isMP)pauseBtn.classList.add('on');
    updateMPLevelBadge();
    var badge=dom.mpLevelBadge;
    if(badge)badge.classList.toggle('on',!!isMP);
    if(save.bgmOn)startBGM();
  },function(){
    appState=isMP?'playingMP':'playing';updateSkillBtn();updatePetHud();
    var begin=function(){if(level.id===12||level.id===15)showWaveBanner('FINAL BOSS',true);if(level.isEndless)showWaveBanner('ENDLESS SURVIVAL',true);sfxWave();};
    if(!isMP){showLevelStory(level,function(){appState='playing';begin();});}else begin();
  });
  if(!started)return false;
  appState='transitioning';
  return true;
}

function startChallenge(ch){
  var previousChallenge=currentChallenge;
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
  var started=startLevel(clone,false);
  if(!started)currentChallenge=previousChallenge;
  return !!started;
}

function showVoucherMsg(text,type){
  dom.voucherMsg.textContent=text;
  dom.voucherMsg.className='voucher-msg '+(type||'');
  void dom.voucherMsg.offsetWidth;
  dom.voucherMsg.classList.add('pop');
  setTimeout(function(){dom.voucherMsg.classList.remove('pop');},450);
}

function openVoucherScene(){
  if(appState!=='playing')return false;
  if(window.DS_MP.active)return false;
  var started=playWipe('right',function(){
    spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.5,14);
    hud.classList.remove('on');hint.classList.remove('on');
    skillBtn.classList.remove('on','active','ready');
    bossWrap.classList.remove('on');comboHud.classList.remove('on');
    streakHudEl.style.opacity='0';
    petHud.classList.remove('on');pauseBtn.classList.remove('on');
    showScreen('voucher');
    dom.voucherInput.value='';
    dom.voucherMsg.textContent='';
    dom.voucherMsg.className='voucher-msg';
    dom.voucherTotal.textContent=formatKP(save.kills);
  },function(){
    appState='voucherMenu';
    setTimeout(function(){try{dom.voucherInput.focus();}catch(e){}},300);
  });
  if(!started)return false;
  appState='transitioning';
  sfxSecret();
  return true;
}

function applyVoucher(){
  var code=dom.voucherInput.value.trim().toUpperCase();
  if(!code){showVoucherMsg('MASUKKAN KODE DULU','error');sfxVoucherBad();return;}
  if(window.DS_MP&&window.DS_MP.tryAdminCode&&window.DS_MP.tryAdminCode(code)){dom.voucherInput.value='';return;}
  if(!VOUCHERS.hasOwnProperty(code)){showVoucherMsg('KODE TIDAK VALID','error');sfxVoucherBad();return;}
  if(save.usedVouchers[code]){showVoucherMsg('KODE SUDAH DIPAKAI','error');sfxVoucherBad();return;}
  var amount=VOUCHERS[code];
  grantKP(amount);
  save.usedVouchers[code]=true;
  persist();refreshAll();
  dom.voucherTotal.textContent=formatKP(save.kills);
  showVoucherMsg('BERHASIL! +'+formatKP(amount)+' KP','success');
  sfxVoucherOk();checkAchievements();
  dom.voucherInput.value='';
  dom.voucherInput.blur();
}

function closeVoucherScene(){
  if(appState==='transitioning')return false;
  var started=playWipe('left',function(){
    spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.5,14);
    showScreen('menu');applyTheme(THEME_MENU);refreshAll();
  },function(){appState='menu';});
  if(!started)return false;
  appState='transitioning';
  sfxClick();
  return true;
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
  startLevel(currentLevel,false);
});
if(pauseQuitBtn)pauseQuitBtn.addEventListener('click',function(){initAudio();quitToMenu();});

var winContinueBtn=document.getElementById('winContinue');
var winToLevelBtn=document.getElementById('winToLevel');
function finishWinAndNavigate(destination){
  initAudio();sfxClick();
  var winM=document.getElementById('winModal');if(winM)winM.classList.remove('on');
  // Commit the completed run before changing screens so campaign unlocks,
  // best scores, achievements, and cloud/local persistence are finalized.
  endGame(true);
  if(destination==='next'&&!currentChallenge&&currentLevel&&currentLevel.isFinal){ showFinalEnding(); return; }
  if(destination==='next'&&!currentChallenge&&currentLevel&&!currentLevel.isEndless){
    var next=null;
    for(var ni=0;ni<LEVELS.length;ni++){
      var candidate=LEVELS[ni];
      if(!candidate||candidate.isEndless||Number(candidate.id)<=Number(currentLevel&&currentLevel.id))continue;
      if(isLevelUnlocked(candidate.id)){next=candidate;break;}
    }
    if(next){
      currentChallenge=null;
      startLevel(next,false);
      return;
    }
  }
  goScreen('level','levelSelect');
}
if(winContinueBtn)winContinueBtn.addEventListener('click',function(){finishWinAndNavigate('next');});
if(winToLevelBtn)winToLevelBtn.addEventListener('click',function(){finishWinAndNavigate('levels');});

document.getElementById('playBtn').addEventListener('click',function(){
  initAudio();sfxClick();
  // The account username is the player's identity. A second unexplained
  // name gate made the campaign appear unreachable on some restored saves.
  var identity=String(save.playerName||'').trim().toUpperCase();
  if(identity.length<3){
    identity='PLAYER';
    save.playerName=identity;
    persist();
    refreshAll();
  }
  onboardingActive=false;
  if(dom.onboardModal)dom.onboardModal.classList.remove('on');
  try{spawnIndieBurst(window.innerWidth*.5,window.innerHeight*.38,20);}catch(e){}
  var moved=goScreen('level','levelSelect');
  // Never leave the player on a dead menu if a transition is interrupted.
  if(!moved){
    appState='menu';
    try{showScreen('level');}catch(e){}
  }
});
document.getElementById('navShop').addEventListener('click',function(){initAudio();sfxClick();goScreen('shop','shopMenu');});
document.getElementById('navAch').addEventListener('click',function(){initAudio();sfxClick();goScreen('ach','achMenu');});
document.getElementById('navStats').addEventListener('click',function(){initAudio();sfxClick();goScreen('stats','statsMenu');});
var navDailyBtn=document.getElementById('navDaily');if(navDailyBtn)navDailyBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('level','levelSelect');setTimeout(function(){var card=document.getElementById('dailyOpsCard');if(card)card.scrollIntoView({behavior:'smooth',block:'center'});},620);});
document.getElementById('navMP').addEventListener('click',function(){initAudio();sfxClick();goScreen('mp','mpMenu');});
var navSpinBtn=document.getElementById('navSpin');
if(navSpinBtn)navSpinBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('spin','spinMenu');});
var navFriendsBtn=document.getElementById('navFriends');
if(navFriendsBtn)navFriendsBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('friends','friendsMenu');});
var dialogueNext=document.getElementById('dialogueNext');if(dialogueNext)dialogueNext.addEventListener('click',function(){initAudio();sfxClick();var box=document.getElementById('dialogueBox');if(box&&box._storyLog&&box._storyAdvance){box._storyAdvance();return;}if(box&&box._levelStory&&box._render){var tx=box.querySelector('.dialogue-text');var lines=LEVEL_STORIES[currentLevel&&currentLevel.id]||[];var speaker=box.querySelector('.dialogue-speaker');var next=box.querySelector('#dialogueNext');var key=(speaker&&speaker.textContent)||'';var idx=-1;for(var ii=0;ii<lines.length;ii++)if(lines[ii][0]===key&&lines[ii][1]===tx.textContent){idx=ii;break;}if(idx>=0&&idx<lines.length-1){box._render=box._render;var oldAfter=box._after;var nextIdx=idx+1;var renderFn=function(){var b=box.querySelector('.dialogue-badge'),sp=box.querySelector('.dialogue-speaker'),tt=box.querySelector('.dialogue-text'),nx=box.querySelector('#dialogueNext');if(b)b.textContent='MISSION '+String(currentLevel.id).padStart(2,'0');if(sp)sp.textContent=lines[nextIdx][0];if(tt)tt.textContent=lines[nextIdx][1];if(nx)nx.textContent=nextIdx<lines.length-1?'LANJUT':'MULAI';};box._render=renderFn;renderFn();return;}box.classList.remove('on');box._levelStory=false;var after=box._after;box._after=null;if(after)after();}else closeCampaignDialog();});
var navStoryBtn=document.getElementById('navStory');
if(navStoryBtn)navStoryBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('story','storyArchive');});
var navChallengeBtn=document.getElementById('navChallenge');
if(navChallengeBtn)navChallengeBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('challenge','challengeMenu');});
var spinBackBtn=document.getElementById('spinBack');
if(spinBackBtn)spinBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
var friendsBackBtn=document.getElementById('friendsBack');
if(friendsBackBtn)friendsBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
var challengeBackBtn=document.getElementById('challengeBack');
if(challengeBackBtn)challengeBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
if(dom.menuGear)dom.menuGear.addEventListener('click',function(){initAudio();sfxClick();goScreen('stats','statsMenu');});

var storyBackBtn=document.getElementById('storyBack');if(storyBackBtn)storyBackBtn.addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('levelBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('shopBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('achBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('statsBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('helpBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});
document.getElementById('mpBack').addEventListener('click',function(){initAudio();sfxClick();goScreen('menu','menu');});

var tabBtns=dom.shopTabs.querySelectorAll('.tab');
for(var ti=0;ti<tabBtns.length;ti++)tabBtns[ti].addEventListener('click',function(){sfxClick();switchShopTab(this.getAttribute('data-tab'));});
if(dom.chapterTabs){var chapterBtns=dom.chapterTabs.querySelectorAll('.chapter-tab');for(var ci=0;ci<chapterBtns.length;ci++)chapterBtns[ci].addEventListener('click',function(){if(this.disabled)return;initAudio();sfxClick();currentChapterTab=Number(this.getAttribute('data-chapter'))||1;renderLevels();if(dom.levelsGrid){dom.levelsGrid.classList.remove('chapter-enter');void dom.levelsGrid.offsetWidth;dom.levelsGrid.classList.add('chapter-enter');}});}

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
    save.trophies=0;save.mpGifts=0;save.ownedSkills=[];save.selectedSkill=null;save.storyClaimed={};save.dailyQuest={date:(function(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})(),killsStart:0,bossStart:0,winsStart:0,claimed:{}};
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
    save.campaignChapter=1;save.campaignDialogSeen={};save.mpPersonalKills=0;save.mpTeamKills=0;save.lastLevelId=0;save.lastPlayedAt=0;save.dailyStreak=0;save.dailyLastComplete='';
    save.globalId='g_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
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
window.addEventListener('pagehide',function(){
  try{persist();}catch(e){}
  try{if(window.MP_queueCloudSave)window.MP_queueCloudSave();}catch(e){}
});
window.addEventListener('beforeunload',function(){
  try{persist();}catch(e){}
});

document.addEventListener('visibilitychange',function(){
  if(document.hidden){
    persist();
    stopBGM();
    if(appState==='playing'&&!window.DS_MP.active){
      paused=true;
      appState='paused';
      autoPausedByVisibility=true;
      var pm=document.getElementById('pauseModal');
      if(pm)pm.classList.add('on');
    }
  }else if(autoPausedByVisibility&&appState==='paused'&&paused&&!window.DS_MP.active){
    var pm2=document.getElementById('pauseModal');
    if(pm2)pm2.classList.add('on');
    showToast('Game dijeda karena tab ditinggalkan.','info');
  }
});
window.addEventListener('pagehide',function(){persist();stopBGM();});

/* v11.1 Command Center */







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
  sfxVictory:sfxVictory,sfxDanger:sfxDanger,sfxRevive:sfxRevive,sfxSpin:sfxSpin,sfxBuy:sfxBuy,initAudio:initAudio,
  checkAchievements:checkAchievements,findShip:findShip,findShape:findShape,
  findGun:findGun,findSkill:findSkill,findStart:findStart,findPet:findPet,
  ownedShip:ownedShip,ownedShape:ownedShape,ownedGun:ownedGun,ownedSkill:ownedSkill,
  ownedPet:ownedPet,grantKP:grantKP,addXP:addXP,xpNeededForLevel:xpNeededForLevel,
  updateMenuCard:updateMenuCard,updateMPLevelBadge:updateMPLevelBadge,
  refreshAll:refreshAll,refreshHeaderKills:refreshHeaderKills,formatKP:formatKP,formatXP:formatXP,formatCompact:formatCompact,
  refreshProfile:refreshProfile,renderStats:renderStats,renderAch:renderAch,
  renderShop:renderShop,renderLevels:renderLevels,playArea:playArea,edgeLeft:edgeLeft,edgeRight:edgeRight,edgeTop:edgeTop,
  edgeBottom:edgeBottom,drawShipCentered:drawShipCentered,
  playerSpriteCache:function(){return playerSpriteCache;},
  playerGlowCache:function(){return playerGlowCache;},
  // Multiplayer renderer needs the same playfield context as the main loop.
  // Keep this accessor read-only so another module cannot replace the canvas context.
  getGameCtx:function(){return ctx;},
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
renderLevels();
showScreen('menu');
refreshAll();
updateMPLevelBadge();
buildMenuDeco();
installIndiePointerFX();
onboardingActive=false;
requestAnimationFrame(loop);

})();
