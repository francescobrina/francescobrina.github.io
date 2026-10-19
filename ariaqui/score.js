
(()=>{'use strict';
const $=id=>document.getElementById(id), all=q=>[...document.querySelectorAll(q)];
const COLORS={green:['#13a876','#e5f6ed'],blue:['#3896b4','#e7f4fa'],yellow:['#dfa92a','#fff4d6'],orange:['#ed8339','#ffedd8'],red:['#df5460','#ffeaec'],purple:['#9760c8','#f2e8fb'],trendlow:['#78aca2','#e9f5f1'],trendmid:['#79aabd','#ecf6f9'],trendhigh:['#648fb8','#edf3f9'],trendpeak:['#687fae','#eaf0fa'],gray:['#8d99a2','#edf1f3']};
const LINK={aqi:'https://airindex.eea.europa.eu/AQI/',uv:'https://www.who.int/news-room/questions-and-answers/item/radiation-the-ultraviolet-%28uv%29-index',gamma:'https://remap.jrc.ec.europa.eu/',cams:'https://open-meteo.com/en/docs/air-quality-api',ufp:'https://www.arpae.it/it/temi-ambientali/aria/scopri-di-piu/progetti-speciali/progetto-supersito'};
const KEYS=[['pm2_5','european_aqi_pm2_5','PM2.5'],['pm10','european_aqi_pm10','PM10'],['nitrogen_dioxide','european_aqi_nitrogen_dioxide','NO2'],['ozone','european_aqi_ozone','Ozono'],['sulphur_dioxide','european_aqi_sulphur_dioxide','SO2'],['carbon_monoxide',null,'CO']];
const valid=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const fmt=x=>x===null?'N/D':new Intl.NumberFormat('it-IT',{maximumFractionDigits:3}).format(x);
const S=(tone,label,reason,method,url='',pct=0)=>({tone,label,reason,method,url,pct});
const no=()=>S('gray','N/D','La misura non è disponibile: non significa zero o aria sicura.','Nessuna soglia applicata senza un dato affidabile.');
const cached=()=>S('gray','Dato salvato','Questa è una copia memorizzata, non una lettura attuale.','Aggiorna per visualizzare un livello valido.');
function indexGrade(label,val,a,stale){
 if(stale)return cached();if(val===null)return no();
 if(a===null)return S('gray','Solo valore','La concentrazione è disponibile, ma il sottoindice AQI non è stato restituito.','La singola concentrazione oraria non equivale alle soglie EEA.','');
 const rows=[[20,'green','Buona'],[40,'blue','Discreta'],[60,'yellow','Moderata'],[80,'orange','Scarsa'],[100,'red','Molto scarsa'],[Infinity,'purple','Estrema']];
 const b=rows.find(r=>a<=r[0]);
 return S(b[1],b[2],'Livello del sottoindice europeo per '+label+'. Anche verde non significa rischio zero.','Categoria European AQI calcolata dal servizio atmosferico. Le concentrazioni orarie e le medie utilizzate per alcuni sottoindici non sono intercambiabili.',LINK.aqi,Math.min(100,Math.max(3,a)));
}
function relative(j,key,i,value,stale){
 if(value===null)return no();if(stale)return cached();
 const hist=Array.isArray(j?.hourly?.[key])?j.hourly[key].slice(Math.max(0,i-24),i).filter(x=>valid(x)!==null):[];
 if(hist.length<8)return S('gray','Solo valore','Non sono disponibili almeno otto ore precedenti per fare un confronto.','Il colore non è una classificazione sanitaria.',LINK.cams);
 const lo=Math.min(...hist),hi=Math.max(...hist);
 if(hi-lo<=Math.max(1e-12,Math.abs(hi)*1e-8))return S('trendmid','Trend · stabile','Concentrazione pressoché invariata nelle ore disponibili.','Questa è una descrizione della tendenza, NON un giudizio di sicurezza sanitaria.',LINK.cams,45);
 const rank=(hist.filter(v=>v<value).length+.5*hist.filter(v=>v===value).length)/hist.length;
 const why='Valore circa al percentile '+Math.round(rank*100)+' rispetto alle ultime '+hist.length+' ore precedenti del modello. I gas possono variare durante il giorno per reazioni atmosferiche e condizioni meteorologiche. Un valore alto rispetto alla notte o al mattino NON significa automaticamente concentrazione elevata o pericolosa.';
 const method='TREND, NON ALLARME. Confronto AriaQui sulle precedenti 24 ore (almeno 8 valide), calcolato sui dati modellati CAMS. Le categorie non sono soglie sanitarie, normative né di tossicità. Una variazione relativa va interpretata insieme al valore assoluto, alla fonte e alle medie di esposizione.';
 if(rank<=.25)return S('trendlow','Trend · sotto i recenti',why,method,LINK.cams,20);
 if(rank<=.75)return S('trendmid','Trend · nella media',why,method,LINK.cams,48);
 if(rank<=.90)return S('trendhigh','Trend · sopra i recenti',why,method,LINK.cams,76);
 return S('trendpeak','Trend · fra i più alti',why,method,LINK.cams,97);
}
function ultraviolet(v,stale){
 if(v===null)return no();if(stale)return cached();
 const rows=[[3,'green','Basso','Esposizione solare UV generalmente contenuta.'],[6,'yellow','Moderato','Cerca ombra nelle ore centrali; proteggi pelle e occhi.'],[8,'orange','Alto','Riduci esposizioni prolungate e usa protezione solare.'],[11,'red','Molto alto','Evita lunghe esposizioni al sole nelle ore centrali.'],[Infinity,'purple','Estremo','Limita al massimo l’esposizione solare non protetta.']];
 const b=rows.find(r=>v<r[0]);
 return S(b[1],b[2],b[3],'Categorie OMS/ICNIRP: 0–2 basso, 3–5 moderato, 6–7 alto, 8–10 molto alto, 11+ estremo. UV e gamma non sono la stessa radiazione.',LINK.uv,Math.min(100,v*9));
}
function gammaGrade(g){
 if(!g||!Number.isFinite(g.value)||g.value<0||!String(g.unit).toLowerCase().includes('sv/h'))return no();
 const age=(Date.now()-Date.parse(g.time))/3600000;
 if(!Number.isFinite(age)||age>24)return S('gray','Dato non recente','La misura ha oltre 24 ore. Non rappresenta necessariamente la situazione attuale.','Aggiorna il servizio ufficiale.',LINK.gamma);
 // These are not dose-limit thresholds; broad visual comparisons only.
 const method='Scala puramente descrittiva rispetto a un ampio intervallo di fondo naturale (circa 0,05–0,25 µSv/h). NON è una scala sanitaria, un limite legale o un allarme. Il fondo varia da luogo a luogo: confronta le serie storiche della stessa stazione e le comunicazioni di ARPAE/ISIN.';
 if(g.value<=.25)return S('green','Fondo usuale*','Misura entro un ampio riferimento di fondo naturale. Non significa rischio zero.',method,LINK.gamma,25);
 if(g.value<=.5)return S('yellow','Sopra riferimento*','Misura oltre la fascia orientativa: verifica lo storico locale.',method,LINK.gamma,56);
 if(g.value<=1)return S('orange','Da verificare*','Valore sensibilmente sopra il riferimento orientativo. Consulta i dati ufficiali.',method,LINK.gamma,78);
 return S('red','Molto sopra riferimento*','Controlla subito serie storiche e comunicazioni ufficiali, senza dedurre automaticamente una situazione di emergenza.',method,LINK.gamma,98);
}
let dialog=null;
function openInfo(item){
 if(!dialog){dialog=document.createElement('dialog');dialog.id='scoreDialog';dialog.innerHTML='<div class="score-dialog-body"><div class="score-dialog-head"><h2 id="scoreTitle"></h2><button type="button" class="score-dialog-close" aria-label="Chiudi">×</button></div><div id="scoreContent"></div></div>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});}
 $('scoreTitle').textContent=item.title;const root=$('scoreContent');root.replaceChildren();
 const p=document.createElement('span');p.className='grade-chip';p.textContent=item.grade.label;p.style.setProperty('--signal',COLORS[item.grade.tone][0]);p.style.setProperty('--tint',COLORS[item.grade.tone][1]);
 const n=document.createElement('div');n.className='score-dialog-val';n.textContent=item.value;
 const why=document.createElement('p');why.className='score-dialog-p';why.textContent=item.grade.reason;
 const how=document.createElement('div');how.className='score-dialog-method';how.textContent=item.grade.method;root.append(p,n,why,how);
 if(item.grade.url){const a=document.createElement('a');a.href=item.grade.url;a.textContent='Consulta la fonte ↗';a.target='_blank';a.rel='noopener noreferrer';a.className='score-dialog-link';root.append(a);}
 if(!dialog.open)dialog.showModal();
}
function colorCard(card,grade,title,value){
 if(!card)return;
 const p=COLORS[grade.tone]||COLORS.gray;
 card.classList.add('grade-card');card.style.setProperty('--signal',p[0]);card.style.setProperty('--tint',p[1]);card.style.setProperty('--percent',grade.pct+'%');
 let tag=card.querySelector('.grade-chip');if(!tag){tag=document.createElement('span');tag.className='grade-chip';card.append(tag);}tag.textContent=grade.label;tag.style.setProperty('--signal',p[0]);tag.style.setProperty('--tint',p[1]);
 let bar=card.querySelector('.grade-track');if(!bar){bar=document.createElement('div');bar.className='grade-track';bar.append(document.createElement('span'));card.append(bar)}
 if(!card.querySelector('.grade-tap')){let hint=document.createElement('div');hint.className='grade-tap';card.append(hint)}
 const hint=card.querySelector('.grade-tap');hint.textContent=grade.tone.startsWith('trend')?'Solo confronto orario · non è un allarme · Tocca ↗':'Tocca per leggere la spiegazione ↗';
 card._info={title,value,grade};
 if(!card.dataset.scoreBound){card.dataset.scoreBound='true';card.classList.add('grade-clickable');card.tabIndex=0;card.setAttribute('role','button');
 card.addEventListener('click',e=>{if(!e.target.closest('a,button,select,input,label'))openInfo(card._info)});
 card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===card){e.preventDefault();openInfo(card._info)}});}
}
function current(j,key,i){return valid(j?.current?.[key])??valid(j?.hourly?.[key]?.[i])}
function colorAir(){
 const z=window.__aqScoreLast;if(!z)return;const {j,hour,stale}=z;
 all('#coreCards .pollutant').forEach((card,i)=>{const p=KEYS[i];if(!p)return;const v=current(j,p[0],hour),a=p[1]?valid(j.hourly?.[p[1]]?.[hour]):null;const gr=p[1]?indexGrade(p[2],v,a,stale):relative(j,p[0],hour,v,stale);
 const old=card.querySelector('.chip');if(old)old.remove();colorCard(card,gr,p[2],fmt(v)+' µg/m³')});
 const uv=current(j,'uv_index',hour);
 const uvCard=$('uvValue')?.closest('.radiocard');if(uvCard){const gr=ultraviolet(uv,stale),tag=$('uvLevel');if(tag)tag.style.display='none';colorCard(uvCard,gr,'Indice UV',fmt(uv));}
 colorAdvanced();
}
function colorAdvanced(){
 const z=window.__aqScoreLast;
 all('#advCards .advcard').forEach(card=>{const key=card.dataset.key,group=card.dataset.group;const v=group==='unavailable'?null:valid(z?.j?.hourly?.[key]?.[z?.hour]);const gr=relative(z?.j,key,z?.hour||0,v,z?.stale||false);
 const context=key==='methane'?' La concentrazione assoluta di metano va letta tenendo conto che il gas è naturalmente presente nell’atmosfera a circa 1,9 ppm su scala globale (NOAA, 2026). Non è un indice di tossicità locale.':key==='formaldehyde'?' Come ordine di grandezza, l’OMS indica 100 µg/m³ di formaldeide in ambienti interni su media di 30 minuti. Non è una soglia direttamente confrontabile con questa stima modellata esterna e oraria.':key==='glyoxal'?' La quantità in µg/m³ può essere piccola anche quando è tra le più alte nelle ultime ore.':'';
 if(context)gr.reason+=context;
 const title=card.querySelector('.name')?.textContent||key||'Parametro';
 colorCard(card,gr,title,fmt(v)+(card.querySelector('.val small')?.textContent||''))});
}
function colorGamma(){
 const source=window.__aqGammaLast;const card=$('gammaReadout')?.closest('.radiocard');if(!card)return;
 const gr=gammaGrade(source?.station||null);const tag=$('gammaLevel');if(tag)tag.style.display='none';
 colorCard(card,gr,'Radioattività gamma',source?.station?fmt(source.station.value)+' '+source.station.unit:'N/D');
}
function colorNano(){
 for(const [sel,title,method] of [['.nano-card.pm1','PM1','Il modello non fornisce PM1, e la presenza in anagrafe ARPAE non fornisce la misura in diretta.'],['.nano-card.ufp','PM0.1 / UFP','Servono strumenti per particelle sotto 100 nm; PM1 non è una sostituzione.']]){
 const el=document.querySelector(sel);if(!el)return;const badge=el.querySelector('.nano-pill');if(badge)badge.remove();colorCard(el,S('gray','Non monitorato','Nessun valore verificato per il punto selezionato. N/D non indica zero.',method,LINK.ufp),title,'N/D');
 }
}
function legend(){if($('scoringLegend'))return;const e=document.createElement('div');e.id='scoringLegend';e.className='mini-scale-guide';e.innerHTML='<b>ATTENZIONE AI COLORI:</b> le schede Detective hanno bordi blu/verde-acqua perché mostrano <b>solo la tendenza rispetto alle ore precedenti</b>. Non indicano il pericolo o il superamento di un limite sanitario. Le categorie dell’AQI e dell’UV usano invece scale specifiche; per gamma il colore è solo un confronto orientativo con il fondo naturale. Grigio = N/D. Tocca ogni scheda per le spiegazioni.';document.getElementById('advanced')?.append(e);}
function paint(){legend();colorNano();colorAir();colorGamma();}
window.addEventListener('ariaqui:render',colorAir);window.addEventListener('ariaqui:cards',colorAdvanced);window.addEventListener('ariaqui:gamma',colorGamma);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint);else paint();
})();