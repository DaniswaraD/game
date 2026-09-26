const CACHE='danis-shooter-v54-light';
const APP_SHELL=['./','./index.html','./game.js','./multiplayer.js','./addings.js','./library-loader.js','./audio/danis-sfx.wav','./manifest.webmanifest','./favicon.svg','./icon-192.png','./icon-512.png'];
const NETWORK_TIMEOUT=3500;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const isApp=/\.(html|js|css|webmanifest|png|svg|wav)$/.test(url.pathname)||url.pathname.endsWith('/');
  if(!isApp)return;
  event.respondWith((async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),NETWORK_TIMEOUT);
    try{
      const res=await fetch(req,{signal:controller.signal});
      clearTimeout(timer);
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}
      return res;
    }catch(e){
      clearTimeout(timer);
      const cached=await caches.match(req);
      return cached||caches.match('./index.html');
    }
  })());
});
