/* Cache dell'app, non dei tasselli OpenStreetMap (rispetta policy tiles). */
const CACHE = "cassonetti-fe-shell-v5";
const SHELL = ["./","./index.html","./style.css?v=5","./app.js?v=5","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("cassonetti-fe-shell-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method!=="GET")return;
  const u=new URL(req.url);
  if(u.hostname.endsWith("tile.openstreetmap.org") || u.pathname.includes("/api/interpreter") || u.hostname.includes("nominatim"))return;
  const same=u.origin===self.location.origin;
  const trustedCDN=(u.hostname==="unpkg.com" || u.hostname==="fonts.googleapis.com" || u.hostname==="fonts.gstatic.com");
  if(!same&&!trustedCDN)return;
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    try {
      const res=await fetch(req);
      if(res.ok || (trustedCDN && res.type==="opaque")){
        const cache=await caches.open(CACHE);
        cache.put(req,res.clone()).catch(()=>{});
      }
      return res;
    }catch(e){
      if(cached)return cached;
      if(req.mode==="navigate")return await caches.match("./index.html");
      throw e;
    }
  })());
});