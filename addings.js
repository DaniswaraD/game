(function(){
'use strict';

var SPIN_TIERS={
  normal:{
    id:'normal',
    label:'NORMAL SPIN',
    cost:25,
    kpValues:[15,30,60,100,150],
    ships:['azure','emerald','royal'],
    shapes:['triangle','circleShape','pentagon'],
    guns:['heavy','laser','poison']
  },
  premium:{
    id:'premium',
    label:'PREMIUM SPIN',
    cost:500,
    kpValues:[200,500,1000,2000,3500],
    ships:['obsidian','void','blood','phantom'],
    shapes:['heart','hexagon','octagon','star'],
    guns:['spread','shotgun','homing','machinegun']
  },
  highend:{
    id:'highend',
    label:'HIGH-END SPIN',
    cost:15000,
    kpValues:[5000,12000,20000,35000,75000],
    ships:['rainbow','solar','lunar','nebula','quantum','titanium','galactic','cosmic'],
    shapes:['arrow','diamondShape','gear','crystal','complex','shieldShape'],
    guns:['rocket','plasma','sniper','triple','wave','flame','ice','lightning','deathray']
  }
};

var rolling=false;

function DS(){return window.DS;}
function pick(a){return a[(Math.random()*a.length)|0];}

function kpIconBig(){
  return '<div style="font-size:58px;line-height:1;filter:drop-shadow(0 3px 5px rgba(0,0,0,.25));">&#128176;</div>';
}

function shipIconBig(ship){
  return '<svg viewBox="0 0 40 40" width="80" height="80">'+
    '<rect x="6" y="6" width="28" height="28" rx="6" fill="'+ship.edge+'" stroke="#242438" stroke-width="1.5"/>'+
    '<path d="M20 9 L27 18 L32 22 L28 31 L12 31 L8 22 L13 18 Z" fill="'+ship.body+'" stroke="#242438" stroke-width="1.2"/>'+
    '<circle cx="20" cy="17" r="3.3" fill="'+ship.cockpit+'" stroke="#242438" stroke-width="0.8"/>'+
    '<circle cx="19" cy="16" r="1.1" fill="#ffffff" opacity="0.9"/>'+
    '<rect x="14" y="30" width="3" height="3" fill="#eaff8f"/>'+
    '<rect x="23" y="30" width="3" height="3" fill="#eaff8f"/>'+
    '</svg>';
}

function shapeIconBig(shape){
  var ic=DS().ICONS[shape.icon];
  return ic||DS().ICONS.square;
}

function gunIconBig(gun){
  var ic=DS().ICONS[gun.icon];
  return ic||DS().ICONS.bullet;
}

function buildPool(tier){
  var pool=[];
  for(var i=0;i<tier.kpValues.length;i++){
    pool.push({type:'kp',amount:tier.kpValues[i]});
  }
  pool.push({type:'ship',id:pick(tier.ships)});
  pool.push({type:'ship',id:pick(tier.ships)});
  pool.push({type:'shape',id:pick(tier.shapes)});
  pool.push({type:'shape',id:pick(tier.shapes)});
  pool.push({type:'gun',id:pick(tier.guns)});
  return pool;
}

function getLv(type,id){
  var s=DS().save;
  if(type==='ship')return (s.shipUpgrades&&s.shipUpgrades[id])||0;
  if(type==='gun')return (s.gunUpgrades&&s.gunUpgrades[id])||0;
  return 0;
}

function setUpg(type,id,lv){
  var s=DS().save;
  if(type==='ship'){
    if(!s.shipUpgrades)s.shipUpgrades={};
    s.shipUpgrades[id]=lv;
  }else if(type==='gun'){
    if(!s.gunUpgrades)s.gunUpgrades={};
    s.gunUpgrades[id]=lv;
  }
}

function applyReward(reward){
  var s=DS().save;
  var res={
    type:reward.type,
    id:reward.id,
    amount:reward.amount,
    name:'',
    desc:'',
    icon:'',
    tag:'',
    tagClass:'kp'
  };

  if(reward.type==='kp'){
    DS().grantKP(reward.amount);
    res.name='+'+reward.amount.toLocaleString('id-ID')+' KP';
    res.desc='Poin tambahan untuk dibelanjakan di toko';
    res.icon=kpIconBig();
    res.tag='KILL POINTS';
    res.tagClass='kp';
    return res;
  }

  if(reward.type==='ship'){
    var ship=DS().findShip(reward.id);
    var owned=DS().ownedShip(reward.id);
    var lv=getLv('ship',reward.id);
    if(!owned){
      s.ships.push(reward.id);
      res.name=ship.name;
      res.desc=ship.passiveDesc||'Kapal baru siap dipakai!';
      res.tag='KAPAL BARU';
      res.tagClass='new';
    }else if(lv<5){
      setUpg('ship',reward.id,lv+1);
      res.name=ship.name+' LV '+(lv+1);
      res.desc='Upgrade! Max HP +10 dari level sebelumnya';
      res.tag='UPGRADE';
      res.tagClass='upgrade';
    }else{
      var refund=Math.round(ship.cost*1.5);
      DS().grantKP(refund);
      res.name=ship.name+' (MAX)';
      res.desc='Sudah level max. Dikonversi jadi +'+refund.toLocaleString('id-ID')+' KP';
      res.tag='KONVERSI KP';
      res.tagClass='kp';
    }
    res.icon=shipIconBig(ship);
    return res;
  }

  if(reward.type==='shape'){
    var shape=DS().findShape(reward.id);
    var ownedS=DS().ownedShape(reward.id);
    if(!ownedS){
      s.shapes.push(reward.id);
      res.name=shape.name;
      res.desc=shape.passiveDesc||'Bentuk baru siap dipakai!';
      res.tag='BENTUK BARU';
      res.tagClass='new';
    }else{
      res.name=shape.name;
      res.desc='*Bentuk sudah dimiliki';
      res.tag='SUDAH DIMILIKI';
      res.tagClass='upgrade';
    }
    res.icon=shapeIconBig(shape);
    return res;
  }

  if(reward.type==='gun'){
    var gun=DS().findGun(reward.id);
    var ownedG=DS().ownedGun(reward.id);
    var lvG=getLv('gun',reward.id);
    if(!ownedG){
      s.guns.push(reward.id);
      res.name=gun.name;
      res.desc=gun.desc||'Senjata baru siap dipakai!';
      res.tag='SENJATA BARU';
      res.tagClass='new';
    }else if(lvG<5){
      setUpg('gun',reward.id,lvG+1);
      res.name=gun.name+' LV '+(lvG+1);
      res.desc='Upgrade! +35% DMG, +15% RoF';
      res.tag='UPGRADE';
      res.tagClass='upgrade';
    }else{
      var refundG=Math.round(gun.cost*1.5);
      DS().grantKP(refundG);
      res.name=gun.name+' (MAX)';
      res.desc='Sudah level max. Dikonversi jadi +'+refundG.toLocaleString('id-ID')+' KP';
      res.tag='KONVERSI KP';
      res.tagClass='kp';
    }
    res.icon=gunIconBig(gun);
    return res;
  }

  return res;
}

function showResult(res){
  var modal=document.getElementById('spinResultModal');
  if(!modal)return;
  var label=document.getElementById('spinResultLabel');
  var icon=document.getElementById('spinResultIcon');
  var nameEl=document.getElementById('spinResultName');
  var descEl=document.getElementById('spinResultDesc');
  var tag=document.getElementById('spinResultTag');

  var cat='';
  if(res.type==='kp')cat='KILL POINTS';
  else if(res.type==='ship')cat='KAPAL';
  else if(res.type==='shape')cat='BENTUK';
  else if(res.type==='gun')cat='SENJATA';

  if(label)label.textContent=cat;
  if(icon)icon.innerHTML=res.icon;
  if(nameEl)nameEl.textContent=res.name;
  if(descEl)descEl.textContent=res.desc;
  if(tag){
    tag.textContent=res.tag;
    tag.className='spin-result-tag '+(res.tagClass||'kp');
  }
  modal.classList.add('on');
  DS().sfxBuy();
}

function closeResult(){
  var modal=document.getElementById('spinResultModal');
  if(modal)modal.classList.remove('on');
}

function doSpin(tierId){
  if(rolling)return;
  var tier=SPIN_TIERS[tierId];
  if(!tier)return;
  var s=DS().save;
  if(s.kills<tier.cost){
    DS().showToast('Poin tidak cukup. Butuh '+tier.cost.toLocaleString('id-ID')+' KP','error');
    return;
  }
  rolling=true;
  disableSpinBtns(true);

  s.kills-=tier.cost;
  if(!s.spins)s.spins=0;
  s.spins++;
  DS().persist();
  DS().refreshHeaderKills();
  DS().refreshProfile();
  DS().updateMenuCard();

  var pool=buildPool(tier);
  var reward=pool[(Math.random()*pool.length)|0];

  var ticks=0;
  var tid=setInterval(function(){
    DS().sfxSpin();
    ticks++;
    if(ticks>=5){
      clearInterval(tid);
      var res=applyReward(reward);
      DS().checkAchievements();
      DS().persist();
      DS().refreshHeaderKills();
      DS().refreshProfile();
      DS().updateMenuCard();
      if(window.AD_spinRender)window.AD_spinRender();
      showResult(res);
      rolling=false;
      disableSpinBtns(false);
    }
  },90);
}

function disableSpinBtns(dis){
  var n=document.getElementById('spinNormalBtn');
  var p=document.getElementById('spinPremiumBtn');
  var h=document.getElementById('spinHighEndBtn');
  if(n)n.disabled=dis;
  if(p)p.disabled=dis;
  if(h)h.disabled=dis;
}

window.AD_spinRender=function(){
  if(rolling)return;
  var s=DS().save;
  var n=document.getElementById('spinNormalBtn');
  var p=document.getElementById('spinPremiumBtn');
  var h=document.getElementById('spinHighEndBtn');
  if(n){
    n.disabled=s.kills<25;
    n.textContent=n.disabled?'KP KURANG':'SPIN NORMAL';
  }
  if(p){
    p.disabled=s.kills<500;
    p.textContent=p.disabled?'KP KURANG':'SPIN PREMIUM';
  }
  if(h){
    h.disabled=s.kills<15000;
    h.textContent=h.disabled?'KP KURANG':'SPIN HIGH-END';
  }
};

function bindUI(){
  var n=document.getElementById('spinNormalBtn');
  var p=document.getElementById('spinPremiumBtn');
  var h=document.getElementById('spinHighEndBtn');
  if(n)n.addEventListener('click',function(){DS().initAudio();doSpin('normal');});
  if(p)p.addEventListener('click',function(){DS().initAudio();doSpin('premium');});
  if(h)h.addEventListener('click',function(){DS().initAudio();doSpin('highend');});
  var close=document.getElementById('spinResultClose');
  if(close)close.addEventListener('click',function(){DS().sfxClick();closeResult();});
  var modal=document.getElementById('spinResultModal');
  if(modal){
    modal.addEventListener('click',function(ev){
      if(ev.target===modal)closeResult();
    });
  }
}

function boot(){
  if(!window.DS){
    setTimeout(boot,120);
    return;
  }
  if(!DS().save.spins)DS().save.spins=0;
  bindUI();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
