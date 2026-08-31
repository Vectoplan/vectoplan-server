import {
  buildSolarLayout,
  automaticFlatSolarAzimuth,
  normalizeSolarSettings,
  normalizeSolarTargetArea,
  solarDailyEconomics,
  solarTargetAreaFromWheel,
  type SolarFace,
  type SolarModule,
  type SolarSettings,
} from './layout';

export interface SolarPanelOptions {
  root:HTMLElement;
  getCalculation:()=>unknown;
  getLocation:()=>{latitude:number;longitude:number}|null;
  onChange:(settings:SolarSettings)=>void;
  onClose:()=>void;
  onSave:()=>Promise<void>;
}

interface FacePotential { readonly specificKwhPerKwp:number; }

const moduleKey=(module:SolarModule)=>module.variantId||`${module.packageId}:${module.revision}:${module.label}`;
const number=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback;
const formatNumber=(value:unknown,digits=1)=>number(value,0).toLocaleString('de-DE',{maximumFractionDigits:digits});
const formatCurrency=(value:unknown)=>number(value,0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const wrap=(value:number)=>(value%360+360)%360;
export const solarAzimuthName=(value:number)=>['Nord','Nordost','Ost','Südost','Süd','Südwest','West','Nordwest'][Math.round(wrap(value)/45)%8];
const EEG_SOURCE_URL='https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/EEG_Foerderung/start.html';

export function solarInquiryUrl(href:string):string {
  const current=new URL(href,'http://localhost');
  const target=new URL('/contact',current.origin);
  target.searchParams.set('topic','solaranlage');
  target.searchParams.set('source','3d-editor');
  const project=current.searchParams.get('app_project_public_id')??current.searchParams.get('project');
  if(project)target.searchParams.set('project',project);
  return target.toString();
}

export function createSolarToolPanel(options:SolarPanelOptions) {
  const element=document.createElement('section');element.className='editor-solar-panel';
  element.dataset.editorUiInteractive='true';element.hidden=true;
  element.setAttribute('role','dialog');element.setAttribute('aria-label','Solaranlage auf Dachflächen');
  element.innerHTML=`<header><h2>Solaranlage</h2><button type="button" data-close aria-label="Solarwerkzeug schließen">×</button></header>
    <div class="editor-solar-panel__body">
      <fieldset><legend>1 · Dachflächen auswählen</legend><div data-faces></div></fieldset>
      <label class="editor-solar-panel__module">2 · Solarmodul<select data-module-select aria-label="Solarmodul auswählen"></select></label>
      <div data-module-facts class="editor-solar-panel__facts"></div>
      <label class="editor-solar-panel__area"><span>3 · Gewünschte PV-Fläche</span><span class="editor-solar-panel__area-input"><input data-target-area type="number" min="0" step="1" inputmode="decimal" aria-label="Gewünschte Modulfläche in Quadratmetern; mit dem Mausrad einstellbar"><span>m²</span></span><small data-area-limit></small></label>
      <div class="editor-solar-panel__result"><output data-summary></output><p data-area></p><p data-yield>Ertrag wird automatisch berechnet.</p></div>
    </div>
    <footer><button type="button" data-save>Solaranlage speichern</button><a data-inquiry target="_blank" rel="noopener">Solaranlage anfragen</a></footer>`;
  options.root.append(element);

  let settings=normalizeSolarSettings(null),modules:SolarModule[]=[],sequence=0,request:AbortController|null=null;
  let potentialSequence=0,potentialRequest:AbortController|null=null,potentialState:'idle'|'loading'|'unavailable'='idle';
  let estimateTimer:number|null=null,lastCalculation:unknown,catalogMessage='Modulkatalog wird geladen …';
  const facePotentials=new Map<string,FacePotential>();
  const facesRoot=element.querySelector<HTMLElement>('[data-faces]')!;
  const summary=element.querySelector<HTMLOutputElement>('[data-summary]')!;
  const areaText=element.querySelector<HTMLElement>('[data-area]')!;
  const yieldText=element.querySelector<HTMLElement>('[data-yield]')!;
  const moduleFacts=element.querySelector<HTMLElement>('[data-module-facts]')!;
  const moduleSelect=element.querySelector<HTMLSelectElement>('[data-module-select]')!;
  const targetArea=element.querySelector<HTMLInputElement>('[data-target-area]')!;
  const areaLimit=element.querySelector<HTMLElement>('[data-area-limit]')!;
  const save=element.querySelector<HTMLButtonElement>('[data-save]')!;
  const inquiry=element.querySelector<HTMLAnchorElement>('[data-inquiry]')!;
  inquiry.href=solarInquiryUrl(window.location.href);

  function invalidate(message='Ertrag wird nach der Auswahl automatisch neu berechnet.') {
    sequence++;request?.abort();request=null;
    if(estimateTimer!==null)window.clearTimeout(estimateTimer);estimateTimer=null;
    yieldText.textContent=message;
  }

  function renderModuleCatalog() {
    const selected=settings.module?moduleKey(settings.module):'';
    moduleSelect.replaceChildren(...modules.map(module=>{
      const option=document.createElement('option');option.value=moduleKey(module);option.textContent=module.label;
      option.selected=option.value===selected;return option;
    }));
    moduleSelect.disabled=!modules.length;
    const module=settings.module;
    if(!module){moduleFacts.textContent=catalogMessage;return;}
    moduleFacts.replaceChildren(document.createTextNode(`${module.powerWp.toFixed(0)} Wp · ${(module.widthM*module.lengthM).toFixed(2)} m² je Modul`));
    if(module.sourceUrl){const link=document.createElement('a');link.href=module.sourceUrl;link.target='_blank';link.rel='noopener';link.textContent='Datenblatt';moduleFacts.append(' · ',link);}
    if(catalogMessage)moduleFacts.append(' · ',document.createTextNode(catalogMessage));
  }

  function facePotentialText(face:SolarFace):string {
    const potential=facePotentials.get(face.id);
    if(potential)return `PVGIS ${formatNumber(potential.specificKwhPerKwp,0)} kWh/kWp pro Jahr`;
    if(!options.getLocation())return 'Standort für Potenzial fehlt';
    if(potentialState==='loading')return 'Potenzial wird berechnet …';
    if(potentialState==='unavailable')return 'Potenzial derzeit nicht verfügbar';
    return 'Potenzial wird vorbereitet …';
  }

  function renderFace(face:SolarFace,index:number):HTMLElement {
    const row=document.createElement('div');row.className='editor-solar-panel__face';
    const head=document.createElement('label');head.className='editor-solar-panel__face-head';
    const input=document.createElement('input');input.type='checkbox';input.checked=settings.selectedFaces.includes(face.id);input.dataset.solarFace=face.id;
    const title=document.createElement('strong');title.textContent=`Fläche ${index+1} · ${face.areaM2.toFixed(1)} m²`;
    input.onchange=()=>{settings={...settings,selectedFaces:input.checked?[...settings.selectedFaces,face.id]:settings.selectedFaces.filter(id=>id!==face.id)};publish();};
    head.append(input,title);
    const detail=document.createElement('small');
    const azimuth=face.tiltDeg<.1?settings.flatAzimuthDeg:face.azimuthDeg;
    detail.textContent=`Automatisch ${solarAzimuthName(azimuth)} · ${azimuth.toFixed(0)}° Azimut · ${face.tiltDeg.toFixed(0)}° · ${facePotentialText(face)}`;
    row.append(head,detail);return row;
  }

  function render() {
    lastCalculation=options.getCalculation();
    const layout=buildSolarLayout(lastCalculation,settings);
    facesRoot.replaceChildren(...layout.faces.map(renderFace));
    renderModuleCatalog();
    const shownTarget=normalizeSolarTargetArea(settings.targetAreaM2??layout.availableAreaM2,layout.availableAreaM2);
    targetArea.max=layout.availableAreaM2.toFixed(2);targetArea.disabled=!settings.module||!layout.availablePanelCount;
    targetArea.value=shownTarget?shownTarget.toFixed(1):'0';targetArea.setAttribute('aria-valuemax',targetArea.max);targetArea.setAttribute('aria-valuenow',String(shownTarget));
    areaLimit.textContent=layout.availableAreaM2?`Bis ${formatNumber(layout.availableAreaM2)} m² möglich · Mausrad: ± 1 m²`:'';
    summary.value=`${layout.panels.length} Module · ${layout.powerKwp.toFixed(2)} kWp${layout.truncated?' · Planungsgrenze erreicht':''}`;
    areaText.textContent=`${layout.occupiedAreaM2.toFixed(1)} m² belegt`;
    if(settings.selectedFaces.length && !layout.panels.length)summary.value+=' · Keine passende Belegungsfläche';
    save.disabled=!settings.module;
    if(!options.getLocation())yieldText.textContent='Ohne Projektstandort ist keine Tagesbilanz möglich.';
  }

  function publish(){invalidate();options.onChange(settings);render();scheduleEstimate();}

  async function loadFacePotentials() {
    const location=options.getLocation(),faces=buildSolarLayout(options.getCalculation(),settings).faces;
    potentialSequence++;potentialRequest?.abort();potentialRequest=null;facePotentials.clear();
    if(!location||!faces.length){potentialState='idle';render();return;}
    const current=potentialSequence,controller=new AbortController();potentialRequest=controller;potentialState='loading';render();
    const timer=window.setTimeout(()=>controller.abort(),12_000);
    try {
      const candidates=[...faces].sort((a,b)=>b.areaM2-a.areaM2).slice(0,8);
      const response=await fetch('/editor/api/solar/estimate',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({...location,systemLossPercent:settings.systemLossPercent,
          groups:candidates.map(face=>({faceId:face.id,tiltDeg:face.tiltDeg<.1?settings.flatTiltDeg:face.tiltDeg,
            azimuthDeg:face.tiltDeg<.1?settings.flatAzimuthDeg:face.azimuthDeg,powerKwp:1}))})});
      const result=await response.json();if(current!==potentialSequence)return;
      if(!response.ok||!result.ok)throw Error('Potenzial nicht verfügbar');
      for(const group of Array.isArray(result.groups)?result.groups:[]){
        if(group.status==='available'&&Number.isFinite(Number(group.specificKwhPerKwp)))facePotentials.set(String(group.faceId),{specificKwhPerKwp:Number(group.specificKwhPerKwp)});
      }
      potentialState=facePotentials.size?'idle':'unavailable';render();
    } catch {if(current===potentialSequence){potentialState='unavailable';render();}}
    finally {window.clearTimeout(timer);if(current===potentialSequence)potentialRequest=null;}
  }

  async function estimateYield() {
    const location=options.getLocation(),layout=buildSolarLayout(options.getCalculation(),settings);
    if(!location||!layout.panels.length)return;
    const current=sequence,controller=new AbortController();request=controller;
    const timer=window.setTimeout(()=>controller.abort(),12_000);
    yieldText.textContent='PVGIS-Einstrahlungsdaten werden ausgewertet …';
    try {
      const response=await fetch('/editor/api/solar/estimate',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({...location,systemLossPercent:settings.systemLossPercent,
          electricityPriceEurPerKwh:settings.electricityPriceEurPerKwh,selfConsumptionPercent:settings.selfConsumptionPercent,
          groups:layout.groups.filter(group=>group.count>0)})});
      const result=await response.json();if(current!==sequence)return;
      if(!response.ok||!result.ok)throw Error(result.message??'Ertrag nicht verfügbar');
      for(const group of Array.isArray(result.groups)?result.groups:[]){
        if(group.status==='available'&&Number.isFinite(Number(group.specificKwhPerKwp)))facePotentials.set(String(group.faceId),{specificKwhPerKwp:Number(group.specificKwhPerKwp)});
      }
      if(result.annualKwh===null){yieldText.textContent=result.status==='partial'
        ?`Nur Teilertrag verfügbar: ${number(result.availableAnnualKwh,0).toLocaleString('de-DE')} kWh/Jahr; Tagesbilanz unbekannt.`
        :'PVGIS ist nicht erreichbar. Anlage und Belegung bleiben trotzdem nutzbar.';return;}
      const economics=result.economics??solarDailyEconomics(result.annualKwh,settings.electricityPriceEurPerKwh,settings.selfConsumptionPercent,layout.powerKwp);
      yieldText.replaceChildren();
      const headline=document.createElement('strong');headline.textContent=`Jahresmittel · Ø ${formatNumber(economics.dailyKwh)} kWh/Tag`;
      const balance=document.createElement('span');balance.className='editor-solar-panel__balance';
      const seasons=economics.seasonal;
      if(seasons?.summer&&seasons?.winter){
        const seasonRow=(label:string,period:any)=>{
          const row=document.createElement('span');
          row.innerHTML=`<b>${label}</b><span>Ø ${formatNumber(period.dailyKwh)} kWh · ${period.dailyBenefitEur===null?'Vergütung offen':`${formatCurrency(period.dailyBenefitEur)}/Tag`}</span>`;
          return row;
        };
        balance.append(seasonRow('Sommer · Jun–Aug',seasons.summer),seasonRow('Winter · Dez–Feb',seasons.winter));
      }
      const selfUse=document.createElement('span');selfUse.innerHTML=`<b>Selbst genutzt (${formatNumber(economics.selfConsumptionPercent??settings.selfConsumptionPercent,0)} %)</b><span>${formatNumber(economics.selfConsumedKwh)} kWh · ${formatCurrency(economics.dailySavingsEur)} gespart</span>`;
      const exportRow=document.createElement('span');
      const direct=economics.compensationModel==='direct_marketing';
      const revenue=economics.dailyFeedInRevenueEur===null?'Ausschreibung nötig':`${formatCurrency(economics.dailyFeedInRevenueEur)} ${direct?'Marktwert':'Vergütung'}`;
      exportRow.innerHTML=`<b>Eingespeist</b><span>${formatNumber(economics.exportedKwh)} kWh · ${revenue}</span>`;
      const total=document.createElement('span');total.className='editor-solar-panel__benefit';total.textContent=economics.dailyBenefitEur===null?'Gesamtvorteil noch offen':`Ca. ${formatCurrency(economics.dailyBenefitEur)} Gesamtvorteil/Tag`;
      balance.append(selfUse,exportRow,total);yieldText.append(headline,balance);
      const sources=document.createElement('small'),pvgis=document.createElement('a'),eeg=document.createElement('a');
      pvgis.href=result.sourceUrl;pvgis.target='_blank';pvgis.rel='noopener';pvgis.textContent='PVGIS';
      eeg.href=economics.compensationSourceUrl??result.compensationSourceUrl??EEG_SOURCE_URL;eeg.target='_blank';eeg.rel='noopener';eeg.textContent='EEG 08/2026';
      sources.append(`PVGIS-Langzeitmittel${direct?' · vor Vermarktungskosten':''} · `,pvgis,' · ',eeg);yieldText.append(sources);
    } catch(error) {
      if(current===sequence)yieldText.textContent=controller.signal.aborted
        ?'PVGIS antwortet derzeit nicht. Anlage und Belegung bleiben trotzdem nutzbar.'
        :`Ertrag derzeit nicht verfügbar: ${error instanceof Error?error.message:String(error)}`;
    } finally {window.clearTimeout(timer);if(current===sequence)request=null;}
  }

  function scheduleEstimate(){
    if(estimateTimer!==null)window.clearTimeout(estimateTimer);
    const layout=buildSolarLayout(options.getCalculation(),settings);
    if(!options.getLocation()||!layout.panels.length)return;
    estimateTimer=window.setTimeout(()=>{estimateTimer=null;void estimateYield();},350);
  }

  function setTargetArea(value:unknown):void {
    const maximum=number(targetArea.max,1_000_000);
    settings=normalizeSolarSettings({...settings,targetAreaM2:normalizeSolarTargetArea(value,maximum)});publish();
  }
  moduleSelect.onchange=()=>{
    const selected=modules.find(module=>moduleKey(module)===moduleSelect.value)??null;
    settings=normalizeSolarSettings({...settings,module:selected});publish();
  };
  targetArea.onchange=()=>{if(Number.isFinite(targetArea.valueAsNumber))setTargetArea(targetArea.valueAsNumber);};
  targetArea.addEventListener('wheel',(event)=>{
    event.preventDefault();event.stopPropagation();
    setTargetArea(solarTargetAreaFromWheel(targetArea.valueAsNumber,event.deltaY,number(targetArea.max,1_000_000)));
  },{passive:false});
  targetArea.addEventListener('keydown',(event)=>{
    if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
    event.preventDefault();setTargetArea(number(targetArea.value,0)+(event.key==='ArrowUp'?1:-1));
  });
  function close(notify=true){if(element.hidden)return;element.hidden=true;invalidate('');potentialSequence++;potentialRequest?.abort();potentialRequest=null;delete options.root.dataset.editorSolarOpen;if(notify)options.onClose();}
  element.querySelector('[data-close]')!.addEventListener('click',()=>close());
  save.onclick=async()=>{save.disabled=true;try{await options.onSave();}finally{if(!element.hidden)render();}};

  return {element,isOpen:()=>!element.hidden,close,destroy:()=>{close(false);element.remove();},
    refresh:()=>{if(!element.hidden && lastCalculation!==options.getCalculation()){invalidate();render();void loadFacePotentials();scheduleEstimate();}},
    async open(value:unknown) {
      invalidate();
      const location=options.getLocation();
      settings=normalizeSolarSettings({...normalizeSolarSettings(value),faceLayouts:{},faceAzimuthDeg:{},
        flatAzimuthDeg:automaticFlatSolarAzimuth(location?.latitude)});
      modules=settings.module?[settings.module]:[];catalogMessage='Katalog wird geladen …';
      element.hidden=false;options.root.dataset.editorSolarOpen='true';render();void loadFacePotentials();
      const current=sequence;
      try {
        const response=await fetch('/editor/api/solar/module');const payload=await response.json();
        if(current!==sequence||element.hidden)return;
        if(!response.ok||!payload.ok)throw Error('Solarbibliothek nicht verfügbar');
        const descriptor=payload.descriptor??{};
        modules=(Array.isArray(descriptor.modules)?descriptor.modules:[descriptor.module]).map((module:unknown)=>normalizeSolarSettings({module}).module).filter((module:SolarModule|null):module is SolarModule=>module!==null);
        const selected=settings.module && modules.find(module=>moduleKey(module)===moduleKey(settings.module!));
        settings=normalizeSolarSettings({...settings,module:selected??modules[0]??settings.module,
          edgeMarginM:descriptor.edgeMarginM,gapM:descriptor.moduleGapM,systemLossPercent:descriptor.systemLossPercent,
          flatTiltDeg:descriptor.flatRoofTiltDeg,flatAzimuthDeg:automaticFlatSolarAzimuth(options.getLocation()?.latitude),
          electricityPriceEurPerKwh:descriptor.economics?.electricityPriceEurPerKwh,
          selfConsumptionPercent:descriptor.economics?.selfConsumptionPercent});
        catalogMessage='';publish();void loadFacePotentials();
      } catch {
        if(current!==sequence)return;
        catalogMessage=settings.module?'Modulkatalog nicht erreichbar · gespeichertes Modul wird weiterverwendet.':'Modulkatalog nicht erreichbar.';
        render();scheduleEstimate();
      }
    },
  };
}
