"use strict";
// Cassonetti FE - static PWA; punti pubblici da OpenStreetMap, annotazioni locali.
(function () {
  const STORE = {
    marks: "cassonetti-fe-marks-v1",
    custom: "cassonetti-fe-custom-v1",
    cache: "cassonetti-fe-osm-v1"
  };
  const FERRARA = [44.8367, 11.6198];
  const OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  const MAX_AGE = 24 * 60 * 60 * 1000;
  const STORAGE_DAYS = 30;
  const state = {
    map: null, cluster: null, gpsMarker: null, gps: null,
    osm: [], custom: [], points: [], markers: new Map(),
    marks: new Set(), selectedId: null, filter: "all", search: "",
    markMode: false, sortByDistance: true, pendingAdd: null,
    fetching: false, dataOrigin: "OSM", hasNetworkData: false
  };
  const $ = id => document.getElementById(id);
  function htmlEscape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }
  function readJSON(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; }
    catch (error) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { toast("Spazio del browser insufficiente: esporta i dati"); return false; }
  }
  function loadSaved() {
    const ids = readJSON(STORE.marks, []);
    state.marks = new Set(Array.isArray(ids) ? ids.filter(v => typeof v === "string").slice(0, 60000) : []);
    const customs = readJSON(STORE.custom, []);
    state.custom = Array.isArray(customs) ? customs.slice(0, 20000).map(cleanCustom).filter(Boolean) : [];
  }
  function cleanCustom(p) {
    if (!p || typeof p !== "object" || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return null;
    const lat = Number(p.lat), lon = Number(p.lon);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    if (typeof p.id !== "string" || !p.id.startsWith("custom:")) return null;
    return {id:p.id.slice(0, 90), lat, lon, name:String(p.name || "Cassonetto aggiunto").slice(0, 100), kind:p.kind === "recycling" ? "recycling":"waste", custom:true, description:"Inserito manualmente"};
  }
  function fmtDistance(meters) {
    if (!Number.isFinite(meters)) return "";
    return meters < 1000 ? Math.round(meters) + " m" : (meters / 1000).toLocaleString("it-IT", {maximumFractionDigits:1}) + " km";
  }
  function distance(a,b) {
    const r = Math.PI / 180, dLat = (b[0]-a[0])*r, dLon = (b[1]-a[1])*r;
    const k = Math.sin(dLat/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLon/2)**2;
    return 12742000 * Math.asin(Math.sqrt(k));
  }
  function kindLabel(p) { return p.kind === "recycling" ? "Raccolta differenziata" : "Rifiuti / cassonetto"; }
  function detailName(tags,kind) {
    const raw = tags.name || tags["addr:street"] || tags.description;
    return raw && String(raw).trim() ? String(raw).trim().slice(0,120) : (kind === "recycling" ? "Cassonetto differenziata" : "Cassonetto rifiuti");
  }
  function detailDesc(tags,kind) {
    const parts = [];
    const t = String(tags["addr:street"] || tags["addr:city"] || tags.location || "").trim();
    if (t) parts.push(t.slice(0,100));
    if (kind === "recycling") {
      const categories = [
        ["recycling:glass","Vetro"],["recycling:paper","Carta"],["recycling:plastic","Plastica"],
        ["recycling:clothes","Tessili"],["recycling:metal","Metallo"],
        ["recycling:cardboard","Cartone"],["recycling:organic","Organico"],
        ["recycling:glass_bottles","Bottiglie di vetro"]
      ].filter(pair => tags[pair[0]] === "yes").map(pair => pair[1]);
      if (categories.length) parts.push(categories.join(", "));
    }
    if (tags.operator) parts.push(String(tags.operator).slice(0,50));
    return parts.join(" · ") || "Posizione censita da OpenStreetMap";
  }
  function normalize(data) {
    if (!data || !Array.isArray(data.elements)) throw Error("Risposta geografica non valida");
    const unique = new Map();
    for (const el of data.elements) {
      if (!el || !el.tags) continue;
      const tags = el.tags;
      const kind = tags.amenity === "waste_disposal" ? "waste" : tags.amenity === "recycling" ? "recycling" : null;
      if (!kind || tags.recycling_type === "centre" || tags.access === "private" || tags.access === "no") continue;
      const lat = Number(el.lat == null && el.center ? el.center.lat : el.lat);
      const lon = Number(el.lon == null && el.center ? el.center.lon : el.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const id = "osm:" + String(el.type) + ":" + String(el.id);
      unique.set(id,{id,lat,lon,kind,name:detailName(tags,kind),description:detailDesc(tags,kind),custom:false});
    }
    return Array.from(unique.values());
  }
  function buildQuery(area) {
    const selection = area ? "(area.fe)" : "(44.49,11.13,45.19,12.49)";
    const head = area ? 'area["boundary"="administrative"]["admin_level"="6"]["name"~"Ferrara",i]->.fe;' : "";
    return '[out:json][timeout:35];' + head + ' ( nwr["amenity"="waste_disposal"]' + selection + '; nwr["amenity"="recycling"]' + selection + '; ); out center;';
  }
  async function requestOverpass(query) {
    const errors = [];
    for (const endpoint of OVERPASS) {
      const controller = new AbortController();
      const stop = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(endpoint + "?data=" + encodeURIComponent(query), {signal:controller.signal, headers:{"Accept":"application/json"}});
        if (!response.ok) throw Error("HTTP " + response.status);
        const data = await response.json();
        if (!data || !Array.isArray(data.elements)) throw Error("Risposta vuota");
        return data;
      } catch (error) {
        errors.push(endpoint + ": " + String(error.message || error));
      } finally { clearTimeout(stop); }
    }
    throw Error(errors.join("; "));
  }
  async function loadStaticDataset() {
    // Dataset statico generato dal nostro workflow: niente CORS / timeout Overpass sul telefono.
    const response = await fetch("./data/cassonetti-ferrara.json", {cache:"no-store"});
    if (!response.ok) throw Error("Archivio OSM statico non disponibile (" + response.status + ")");
    const data = await response.json();
    if (!data || !Array.isArray(data.points) || !data.points.length) throw Error("Archivio OSM statico vuoto");
    const valid = data.points.filter(p =>
      p && typeof p.id === "string" && p.id.startsWith("osm:") &&
      Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
      (p.kind === "waste" || p.kind === "recycling") &&
      typeof p.name === "string"
    );
    if (!valid.length) throw Error("Nessuna coordinata valida nell'archivio statico");
    state.osm = valid;
    state.dataOrigin = "OpenStreetMap · archivio";
    state.hasNetworkData = true;
    saveJSON(STORE.cache,{time:Date.now(),origin:state.dataOrigin,points:valid});
    combinePoints();
    const date = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"}) : "recente";
    $("data-status").textContent = "OpenStreetMap · dati del " + date;
    return valid.length;
  }
  async function refreshData(force) {
    if (state.fetching) return;
    state.fetching = true;
    $("refresh-data").disabled = true;
    const cached = readJSON(STORE.cache, null);
    let hasValidCache = false;
    if (cached && Array.isArray(cached.points) && cached.points.length && Date.now() - Number(cached.time || 0) < STORAGE_DAYS*24*60*60*1000) {
      state.osm = cached.points;
      state.dataOrigin = cached.origin || "OpenStreetMap";
      state.hasNetworkData = true;
      combinePoints();
      hasValidCache = true;
      $("data-status").textContent = state.dataOrigin + " · salvati nel browser";
    } else {
      $("map-counter").textContent = "Carico cassonetti reali…";
    }
    try {
      if (!force) {
        // L'archivio Github viene aggiornato in autonomia, e rende immediato l'avvio.
        const count = await loadStaticDataset();
        if (!hasValidCache) toast(count.toLocaleString("it-IT") + " cassonetti caricati");
        return;
      }
      // Il refresh manuale prova prima la fonte live, senza cancellare il dataset salvato.
      const live=await requestOverpass(buildQuery(true));
      let points=normalize(live), origin="OSM · provincia";
      if (!points.length) {
        const fallback=await requestOverpass(buildQuery(false));
        points=normalize(fallback);origin="OSM · area indicativa";
      }
      if (!points.length) throw Error("Nessun punto censito nella risposta");
      state.osm=points;state.dataOrigin=origin;state.hasNetworkData=true;
      saveJSON(STORE.cache,{time:Date.now(),origin,points});
      combinePoints();
      $("data-status").textContent=origin+" · aggiornati adesso";
      toast(points.length.toLocaleString("it-IT")+" cassonetti aggiornati");
    } catch(error) {
      console.warn("Impossibile aggiornare Overpass / archivio:",error);
      if (!state.hasNetworkData) {
        try {
          const live = await requestOverpass(buildQuery(true));
          const points=normalize(live);
          if (!points.length) throw Error("Risposta priva di cassonetti");
          state.osm=points;state.dataOrigin="OSM · aggiornamento live";state.hasNetworkData=true;
          saveJSON(STORE.cache,{time:Date.now(),origin:state.dataOrigin,points});
          combinePoints();
          toast(points.length.toLocaleString("it-IT")+" cassonetti caricati");
        } catch(failure) {
          showNotice("Dati OSM temporaneamente non disponibili. Premi ↻ per riprovare oppure aggiungi un punto col +.");
          console.warn("Servizi dati non disponibili:", failure);
          combinePoints();
        }
      } else if(force) {
        toast("Aggiornamento online non riuscito: punti esistenti conservati");
      }
    } finally {
      state.fetching=false;
      $("refresh-data").disabled=false;
      refreshStats();
    }
  }
  function combinePoints() {
    const ids = new Map(state.osm.map(p => [p.id,p]));
    for (const p of state.custom) ids.set(p.id,p);
    state.points = Array.from(ids.values());
    renderEverything();
  }
  function referencePosition() {
    return state.gps || [state.map.getCenter().lat,state.map.getCenter().lng];
  }
  function visiblePoints() {
    const term = state.search.trim().toLocaleLowerCase("it-IT");
    let pts = state.points.filter(p => {
      if (state.filter === "marked" && !state.marks.has(p.id)) return false;
      if (state.filter === "unmarked" && state.marks.has(p.id)) return false;
      if (state.filter === "custom" && !p.custom) return false;
      if (state.filter === "waste" && p.kind !== "waste") return false;
      if (state.filter === "recycling" && p.kind !== "recycling") return false;
      return !term || (p.name + " " + p.description).toLocaleLowerCase("it-IT").includes(term);
    });
    if (state.sortByDistance) {
      const pos=referencePosition();
      pts.sort((a,b) => distance(pos,[a.lat,a.lon]) - distance(pos,[b.lat,b.lon]));
    } else {
      pts.sort((a,b) => a.name.localeCompare(b.name,"it"));
    }
    return pts;
  }
  function markerIcon(p) {
    const marked=state.marks.has(p.id);
    const cls="bin-pin " + p.kind + (marked?" marked":"") + (p.custom?" custom":"") + (state.selectedId===p.id?" active":"");
    return L.divIcon({
      className:"bin-icon", iconSize:[32,38],iconAnchor:[16,38],popupAnchor:[0,-34],
      html:'<div class="' + cls + '"><span>' + (marked?"×":p.kind==="recycling"?"♻":"•") + "</span></div>"
    });
  }
  function renderEverything() {
    if (!state.map || !state.cluster) return;
    const points=visiblePoints();
    state.cluster.clearLayers();
    state.markers.clear();
    for (const p of points) {
      const marker=L.marker([p.lat,p.lon],{icon:markerIcon(p),title:p.name});
      marker.on("click",() => {
        if (state.markMode) toggleMarked(p.id);
        else selectPoint(p.id,true);
      });
      state.markers.set(p.id,marker);
      state.cluster.addLayer(marker);
    }
    renderList(points);
    refreshStats(points.length);
    if (state.selectedId) renderDetail();
  }
  function renderList(points) {
    const list=$("places-list");
    if (!points.length) {
      list.innerHTML='<div class="list-placeholder">' +
        (state.fetching?"Caricamento dei cassonetti…":"Nessun punto per i filtri selezionati.") + "</div>";
      return;
    }
    const pos=referencePosition();
    list.innerHTML=points.slice(0,90).map(p => {
      const marked=state.marks.has(p.id);
      const d=fmtDistance(distance(pos,[p.lat,p.lon]));
      return '<article class="place-row' + (state.selectedId===p.id?" selected":"") + '" data-id="' + htmlEscape(p.id) + '" tabindex="0" role="button">' +
        '<span class="place-symbol ' + (marked?"marked":p.kind) + '">' + (marked?"×":p.kind==="recycling"?"♻":"●") + '</span>' +
        '<span class="place-body"><strong>' + htmlEscape(p.name) + '</strong><small>' + htmlEscape(p.description) + '</small></span>' +
        '<span class="place-distance">' + d + "</span></article>";
    }).join("") + (points.length > 90 ? '<div class="list-placeholder">Mostrati i 90 più vicini. Sulla mappa trovi gli altri ' + (points.length-90).toLocaleString("it-IT") + " punti.</div>" : "");
    list.querySelectorAll(".place-row").forEach(node => {
      const go = () => selectPoint(node.dataset.id,true);
      node.addEventListener("click",go);
      node.addEventListener("keydown",e => {if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
    });
  }
  function refreshStats(shown) {
    const total=state.points.length;
    const marked=state.points.reduce((n,p) => n+Number(state.marks.has(p.id)),0);
    const inMap=shown===undefined?visiblePoints().length:shown;
    $("total-count").textContent=total.toLocaleString("it-IT");
    $("marked-count").textContent=marked.toLocaleString("it-IT");
    $("remaining-count").textContent=(total-marked).toLocaleString("it-IT");
    $("mobile-count").textContent=inMap.toLocaleString("it-IT");
    $("map-counter").textContent=inMap.toLocaleString("it-IT") + " punti visibili" +
      (state.gps?" · GPS attivo":"");
  }
  function selectPoint(id,zoom) {
    const p=state.points.find(item=>item.id===id);
    if (!p) return;
    state.selectedId=id;
    renderEverything();
    $("detail-sheet").hidden=false;
    renderDetail();
    if (zoom) {
      closeMobileList();
      state.map.flyTo([p.lat,p.lon],Math.max(16,state.map.getZoom()),{duration:.55});
    }
  }
  function renderDetail() {
    const p=state.points.find(item=>item.id===state.selectedId);
    if (!p) { $("detail-sheet").hidden=true;state.selectedId=null;return; }
    const marked=state.marks.has(p.id);
    $("detail-kicker").textContent=p.custom?"PUNTO AGGIUNTO DA TE":kindLabel(p).toLocaleUpperCase("it-IT");
    $("detail-title").textContent=p.name;
    $("detail-subtitle").textContent=p.description;
    $("detail-distance").textContent=fmtDistance(distance(referencePosition(),[p.lat,p.lon])) + (state.gps?" dalla tua posizione":" dal centro mappa");
    $("detail-mark").classList.toggle("is-marked",marked);
    $("detail-mark").querySelector("span").textContent=marked?"Rimuovi X":"Segna con X";
    $("detail-remove").hidden=!p.custom;
  }
  function toggleMarked(id) {
    if (state.marks.has(id)) state.marks.delete(id);
    else state.marks.add(id);
    saveJSON(STORE.marks,Array.from(state.marks));
    renderEverything();
    toast(state.marks.has(id)?"Cassonetto segnato con X":"X rimossa");
  }
  function showNotice(message) {
    $("map-notice").textContent=message;
    $("map-notice").hidden=false;
  }
  let toastTimer;
  function toast(message) {
    const el=$("toast");el.textContent=message;el.classList.add("show");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
  }
  function closeMobileList() {
    $("sidebar").classList.remove("open");
    $("mobile-panel-cover").hidden=true;
    setTimeout(()=>state.map.invalidateSize(),250);
  }
  function toggleMobileList() {
    const open=$("sidebar").classList.toggle("open");
    $("mobile-panel-cover").hidden=!open;
    if(!open)setTimeout(()=>state.map.invalidateSize(),250);
  }
  function locateUser(center,silent) {
    if (!("geolocation" in navigator)) { if(!silent)toast("GPS non disponibile");return; }
    navigator.geolocation.getCurrentPosition(function (position) {
      state.gps=[position.coords.latitude,position.coords.longitude];
      if(state.gpsMarker)state.map.removeLayer(state.gpsMarker);
      state.gpsMarker=L.marker(state.gps,{zIndexOffset:1000,icon:L.divIcon({className:"",html:'<div class="user-gps-dot"></div>',iconSize:[17,17],iconAnchor:[9,9]})}).addTo(state.map);
      if (center)state.map.flyTo(state.gps,15,{duration:.7});
      renderEverything();
      if(!silent)toast("Posizione GPS aggiornata");
    },function(error) {
      if(!silent)toast(error.code===1?"Autorizza la posizione nelle impostazioni di Chrome":"Posizione GPS non disponibile");
    },{enableHighAccuracy:true,maximumAge:30000,timeout:12000});
  }
  async function findAreaFromSearch(query) {
    if (!query || query.length < 2) return;
    try {
      const request="https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&limit=1&viewbox=11.13,45.19,12.49,44.49&bounded=1&q=" + encodeURIComponent(query);
      const response=await fetch(request);
      if(!response.ok)throw Error("Ricerca non riuscita");
      const data=await response.json();
      if (!Array.isArray(data) || !data[0]) {toast("Località non trovata");return;}
      state.map.flyTo([Number(data[0].lat),Number(data[0].lon)],15,{duration:.75});
      state.search="";
      $("search-input").value="";
      $("clear-search").hidden=true;
      renderEverything();
      closeMobileList();
      toast("Mappa centrata su "+query);
    } catch(error) {toast("Ricerca geografica momentaneamente non disponibile");}
  }
  function openAddDialog() {
    const c=state.map.getCenter();
    state.pendingAdd=[c.lat,c.lng];
    $("add-coords").textContent=c.lat.toFixed(6)+", "+c.lng.toFixed(6);
    $("add-name").value="";
    $("add-type").value="waste";
    $("add-dialog").showModal();
  }
  function saveAddPoint() {
    const name=$("add-name").value.trim();
    if(!name){toast("Inserisci un nome");return;}
    const pos=state.pendingAdd;
    if(!pos)return;
    const id="custom:" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2,10);
    const p={id,lat:pos[0],lon:pos[1],name:name.slice(0,100),kind:$("add-type").value==="recycling"?"recycling":"waste",custom:true,description:"Inserito manualmente"};
    state.custom.push(p);
    saveJSON(STORE.custom,state.custom);
    combinePoints();
    selectPoint(id,true);
    toast("Cassonetto aggiunto e salvato");
  }
  function exportState() {
    const obj={app:"cassonetti-fe",version:1,exportedAt:new Date().toISOString(),marks:Array.from(state.marks),custom:state.custom};
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="cassonetti-ferrara-salvataggio-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast("Salvataggio esportato");
  }
  async function importState(file) {
    if(!file)return;
    try{
      if(file.size > 5*1024*1024)throw Error("File troppo grande");
      const doc=JSON.parse(await file.text());
      if(!doc || doc.app!=="cassonetti-fe" || !Array.isArray(doc.marks) || !Array.isArray(doc.custom))throw Error("Formato non valido");
      const addedMarks=doc.marks.filter(id=>typeof id==="string" && /^(osm:|custom:)/.test(id)).slice(0,60000);
      const custom=doc.custom.slice(0,20000).map(cleanCustom).filter(Boolean);
      state.marks=new Set([...state.marks,...addedMarks]);
      const merged=new Map(state.custom.map(p=>[p.id,p]));
      custom.forEach(p=>merged.set(p.id,p));
      state.custom=Array.from(merged.values());
      saveJSON(STORE.marks,Array.from(state.marks));
      saveJSON(STORE.custom,state.custom);
      combinePoints();toast("Salvataggio importato");
    }catch(error){toast("Impossibile importare: "+String(error.message || error));}
    $("import-file").value="";
  }
  function attachUI() {
    document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
      state.filter=btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("selected",b===btn));
      renderEverything();
    }));
    let searchTimer;
    $("search-input").addEventListener("input",e=>{
      clearTimeout(searchTimer);
      const val=e.target.value;
      $("clear-search").hidden=!val;
      searchTimer=setTimeout(()=>{state.search=val;renderEverything();},190);
    });
    $("search-input").addEventListener("keydown",e=>{
      if(e.key==="Enter"){
        e.preventDefault();
        const query=e.target.value.trim();
        if(!query)return;
        if(!visiblePoints().length || !state.search) findAreaFromSearch(query);
        else {state.search=query;renderEverything();toast("Filtrati i punti presenti");}
      }
    });
    $("clear-search").addEventListener("click",()=>{state.search="";$("search-input").value="";$("clear-search").hidden=true;renderEverything();});
    $("sort-button").addEventListener("click",()=>{
      state.sortByDistance=!state.sortByDistance;
      $("sort-button").textContent=state.sortByDistance?"Distanza ↕":"Nome ↕";
      renderEverything();
    });
    $("refresh-data").addEventListener("click",()=>refreshData(true));
    $("locate-button").addEventListener("click",()=>locateUser(true,false));
    $("mark-mode").addEventListener("click",()=>{
      state.markMode=!state.markMode;
      $("mark-mode").classList.toggle("active",state.markMode);
      $("mark-mode").title=state.markMode?"Tocca i punti per segnare o togliere la X":"Attiva la modalità X";
      toast(state.markMode?"Modalità X: tocca i cassonetti per segnarli":"Modalità X disattivata");
    });
    $("detail-close").addEventListener("click",()=>{$("detail-sheet").hidden=true;state.selectedId=null;renderEverything();});
    $("detail-mark").addEventListener("click",()=>{if(state.selectedId)toggleMarked(state.selectedId);});
    $("detail-nav").addEventListener("click",()=>{
      const p=state.points.find(p=>p.id===state.selectedId);
      if(!p)return;
      window.open("https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(p.lat+","+p.lon)+"&travelmode=driving","_blank","noopener,noreferrer");
    });
    $("detail-remove").addEventListener("click",()=>{
      const p=state.points.find(p=>p.id===state.selectedId);
      if(!p || !p.custom || !confirm("Eliminare questo cassonetto aggiunto?"))return;
      state.custom=state.custom.filter(item=>item.id!==p.id);
      state.marks.delete(p.id);
      saveJSON(STORE.custom,state.custom);saveJSON(STORE.marks,Array.from(state.marks));
      state.selectedId=null;$("detail-sheet").hidden=true;combinePoints();toast("Punto eliminato");
    });
    $("add-button").addEventListener("click",openAddDialog);
    $("cancel-add").addEventListener("click",()=>$("add-dialog").close());
    $("add-form").addEventListener("submit",e=>{e.preventDefault();saveAddPoint();$("add-dialog").close();});
    $("add-gps").addEventListener("click",()=>{
      if(!navigator.geolocation){toast("GPS non disponibile");return;}
      navigator.geolocation.getCurrentPosition(p=>{
        state.pendingAdd=[p.coords.latitude,p.coords.longitude];
        $("add-coords").textContent=state.pendingAdd.map(n=>n.toFixed(6)).join(", ");
        toast("Coordinate GPS selezionate");
      },()=>toast("Impossibile leggere il GPS"),{enableHighAccuracy:true,timeout:12000});
    });
    $("mobile-list-toggle").addEventListener("click",toggleMobileList);
    $("mobile-panel-cover").addEventListener("click",closeMobileList);
    const hideMenu=()=>{$("options-menu").hidden=true;$("options-cover").hidden=true;};
    $("menu-button").addEventListener("click",()=>{
      const show=$("options-menu").hidden;
      $("options-menu").hidden=!show;$("options-cover").hidden=!show;
    });
    $("options-cover").addEventListener("click",hideMenu);
    $("export-button").addEventListener("click",()=>{exportState();hideMenu();});
    $("import-button").addEventListener("click",()=>{$("import-file").click();hideMenu();});
    $("import-file").addEventListener("change",e=>importState(e.target.files[0]));
    $("clear-marks").addEventListener("click",()=>{
      if(confirm("Rimuovere tutte le X? I cassonetti aggiunti rimarranno salvati.")){
        state.marks.clear();saveJSON(STORE.marks,[]);renderEverything();toast("Tutte le X sono state rimosse");
      }
      hideMenu();
    });
    document.addEventListener("keydown",e=>{
      if(e.key==="Escape"){hideMenu();closeMobileList();$("detail-sheet").hidden=true;}
    });
  }
  function initMap() {
    if(!window.L){$("map").innerHTML='<div class="list-placeholder">Impossibile caricare la libreria della mappa. Controlla la connessione e ricarica.</div>';return false;}
    state.map=L.map("map",{preferCanvas:true,zoomControl:false}).setView(FERRARA,11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
      minZoom:8,maxZoom:19
    }).addTo(state.map);
    L.control.zoom({position:"bottomright"}).addTo(state.map);
    if(typeof L.markerClusterGroup==="function"){
      state.cluster=L.markerClusterGroup({chunkedLoading:true,showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:48,disableClusteringAtZoom:18});
    }else{
      state.cluster=L.layerGroup();
      showNotice("Raggruppamento non disponibile: visualizzazione semplificata.");
    }
    state.map.addLayer(state.cluster);
    let moveTimer;
    state.map.on("moveend",()=>{
      clearTimeout(moveTimer);
      moveTimer=setTimeout(()=>{renderList(visiblePoints());if(state.selectedId)renderDetail();},280);
    });
    return true;
  }
  function start() {
    loadSaved();
    if(!initMap())return;
    attachUI();
    combinePoints();
    refreshData(false);
    locateUser(false,true);
    if("serviceWorker" in navigator){
      window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}),{once:true});
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);
  else start();
})();