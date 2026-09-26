(function(){
  'use strict';
  var registry={
    gsap:{url:'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js',test:function(){return !!window.gsap}},
    howler:{url:'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',test:function(){return !!window.Howl}}
  };
  var promises={};
  function load(name){
    if(registry[name]&&registry[name].test())return Promise.resolve(true);
    if(promises[name])return promises[name];
    var item=registry[name];
    if(!item)return Promise.reject(new Error('Unknown library: '+name));
    promises[name]=new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src=item.url;s.async=true;s.crossOrigin='anonymous';
      s.onload=function(){if(item.test()){resolve(true);}else{reject(new Error(name+' loaded without expected global'));}};
      s.onerror=function(){reject(new Error('Could not load '+name));};
      document.head.appendChild(s);
    });
    return promises[name];
  }
  window.DS_LIBS={
    versions:{gsap:'3.15.0',howler:'2.2.4'},
    load:load,
    loadGsap:function(){return load('gsap');},
    loadHowler:function(){return load('howler');},
    has:function(name){return !!(registry[name]&&registry[name].test());}
  };
  // Animation/audio are lightweight enough to warm up in the background.
  var warm=function(){load('gsap').catch(function(){});load('howler').catch(function(){});};
  if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:1800});
  else setTimeout(warm,900);
})();
