#!/usr/bin/env python3
"""Download only real OpenStreetMap coordinates; never invent bins."""
import datetime, json, pathlib, sys, time, xml.etree.ElementTree as ET
from urllib import parse, request
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=ROOT/"data"/"cassonetti-ferrara.json"
SERVERS=["https://overpass-api.de/api/interpreter","https://overpass.private.coffee/api/interpreter","https://overpass.kumi.systems/api/interpreter"]
QUERIES=[
 '[out:json][timeout:75];area["boundary"="administrative"]["admin_level"="6"]["name"~"Ferrara",i]->.fe;(nwr["amenity"="waste_disposal"](area.fe);nwr["amenity"="recycling"](area.fe););out center;',
 '[out:json][timeout:75];(nwr["amenity"="waste_disposal"](44.48,11.12,45.20,12.47);nwr["amenity"="recycling"](44.48,11.12,45.20,12.47););out center;'
]
def get(query):
    for server in SERVERS:
        try:
            print("Richiesta:",server,flush=True)
            payload=parse.urlencode({"data":query}).encode()
            req=request.Request(server,data=payload,headers={"User-Agent":"Cassonetti-FE-OpenStreetMap-Importer/1.1","Accept":"application/json","Content-Type":"application/x-www-form-urlencoded"})
            with request.urlopen(req,timeout=25) as response: data=json.load(response)
            if not data.get("elements"): raise ValueError("Nessun elemento")
            return data["elements"]
        except Exception as exc:
            print(str(exc),file=sys.stderr,flush=True)
            time.sleep(1)
    raise RuntimeError("Tutti gli endpoint Overpass non disponibili")
def normalize(elements):
    out={}
    for e in elements:
        t=e.get("tags") or {}
        kind="waste" if t.get("amenity")=="waste_disposal" else "recycling" if t.get("amenity")=="recycling" else None
        if not kind or t.get("recycling_type")=="centre" or t.get("access") in ("private","no"):continue
        c=e.get("center") or {}
        lat=e.get("lat",c.get("lat"));lon=e.get("lon",c.get("lon"))
        if lat is None or lon is None:continue
        if not (44.3<=float(lat)<=45.4 and 11<=float(lon)<=12.7):continue
        key=f'osm:{e["type"]}:{e["id"]}'
        fallback="Cassonetto differenziata" if kind=="recycling" else "Cassonetto rifiuti"
        name=str(t.get("name") or t.get("addr:street") or t.get("description") or fallback)[:120]
        notes=[str(t[k])[:80] for k in ("addr:street","addr:city") if t.get(k)]
        if kind=="recycling":
            types=[label for tag,label in [("recycling:glass","Vetro"),("recycling:paper","Carta"),("recycling:plastic","Plastica"),("recycling:clothes","Tessili"),("recycling:metal","Metallo"),("recycling:cardboard","Cartone"),("recycling:organic","Organico")] if t.get(tag)=="yes"]
            if types:notes.append(", ".join(types))
        out[key]={"id":key,"lat":float(lat),"lon":float(lon),"name":name,"kind":kind,"description":" · ".join(notes) or "Posizione censita OpenStreetMap","custom":False}
    return sorted(out.values(),key=lambda p:p["id"])
def fallback_osm_main_api():
    """Ripiego sui punti REALI presenti nell'API OpenStreetMap (alcune zone)."""
    bboxes=[
      '11.585,44.807,11.665,44.870',
      '11.273,44.706,11.326,44.752',
      '12.157,44.677,12.223,44.713',
      '11.810,44.594,11.875,44.640',
      '11.790,44.867,11.855,44.914'
    ]
    results=[]
    for bbox in bboxes:
        try:
            url='https://api.openstreetmap.org/api/0.6/map?bbox='+bbox
            req=request.Request(url,headers={'User-Agent':'Cassonetti-FE-OpenStreetMap-Importer/1.1'})
            with request.urlopen(req,timeout=30) as resp: doc=ET.parse(resp).getroot()
            for node in doc.iter('node'):
                tags={tag.attrib['k']:tag.attrib['v'] for tag in node.findall('tag')}
                if tags.get('amenity') in ('recycling','waste_disposal'):
                    results.append({'type':'node','id':node.attrib['id'],'lat':float(node.attrib['lat']),'lon':float(node.attrib['lon']),'tags':tags})
            print('OSM API punti rilevati:',len(results),flush=True)
        except Exception as exc: print('OSM API errore:',str(exc),file=sys.stderr,flush=True)
    return results

def main():
    for i,query in enumerate(QUERIES):
        try:
            points=normalize(get(query))
            if not points:raise ValueError("Zero punti validi")
            payload={"source":"OpenStreetMap Overpass API","license":"ODbL 1.0","coverage":"Provincia di Ferrara" if i==0 else "Area geografica estesa, perimetro approssimato","updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"count":len(points),"points":points}
            OUT.parent.mkdir(parents=True,exist_ok=True)
            OUT.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf8")
            print("Punti reali salvati:",len(points),flush=True)
            return
        except Exception as exc: print("Copertura non riuscita:",exc,file=sys.stderr,flush=True)
    partial=normalize(fallback_osm_main_api())
    if partial:
        payload={"source":"OpenStreetMap API","license":"ODbL 1.0","coverage":"Alcuni centri abitati (copertura parziale)","updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"count":len(partial),"points":partial}
        OUT.parent.mkdir(parents=True,exist_ok=True)
        OUT.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf8")
        print("Punti reali parziali salvati:",len(partial),flush=True)
        return
    raise RuntimeError("Nessun dato scaricato: non sovrascrivo l'eventuale archivio")
if __name__=="__main__":main()
