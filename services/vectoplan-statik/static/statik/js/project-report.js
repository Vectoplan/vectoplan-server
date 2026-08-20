(() => {
  "use strict";
  const payload = JSON.parse(document.getElementById("project-report-data").textContent);
  let positions = payload.result.positions || [];
  let byRef = Object.fromEntries(positions.map((item) => [item.position_ref, item]));
  const html = (value) => String(value ?? "–").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const fmt = (value) => typeof value === "number" ? new Intl.NumberFormat("de-DE", {maximumFractionDigits: 4}).format(value) : String(value ?? "–");

  function systemOverview() {
    const canvas = document.getElementById("project-system-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#f5f8f9"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#173b55"; ctx.font = "700 22px Segoe UI"; ctx.fillText("Bauwerkspositionen und Lastpfad", 28, 38);
    const groups = [...new Set(positions.map((item) => item.group))];
    const xGap = (canvas.width - 80) / Math.max(groups.length, 1); const nodeBox = {};
    groups.forEach((group, gx) => {
      const items = positions.filter((item) => item.group === group);
      ctx.fillStyle = "#607480"; ctx.font = "600 13px Segoe UI"; ctx.fillText(group, 35 + gx*xGap, 72);
      items.forEach((item, iy) => {
        const x = 28 + gx*xGap, y = 88 + iy*70, w = Math.min(xGap - 14, 175), h = 50; nodeBox[item.position_ref] = {x,y,w,h};
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "#9db0ba"; ctx.lineWidth = 1; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
        ctx.fillStyle = "#0c9aa0"; ctx.font = "700 13px Segoe UI"; ctx.fillText(item.position_ref, x+10, y+20);
        ctx.fillStyle = "#173b55"; ctx.font = "12px Segoe UI"; ctx.fillText(item.label.slice(0,22), x+10, y+38);
      });
    });
    ctx.strokeStyle = "#d48a20"; ctx.fillStyle = "#d48a20"; ctx.lineWidth = 2;
    (payload.result.load_links || []).forEach((link) => {
      const a=nodeBox[link.from], b=nodeBox[link.to]; if(!a||!b) return;
      const x1=a.x+a.w/2,y1=a.y+a.h,x2=b.x+b.w/2,y2=b.y;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      const angle=Math.atan2(y2-y1,x2-x1);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-8*Math.cos(angle-.45),y2-8*Math.sin(angle-.45));ctx.lineTo(x2-8*Math.cos(angle+.45),y2-8*Math.sin(angle+.45));ctx.closePath();ctx.fill();
    });
  }

  function heatmap(ctx, visual, width, height) {
    const rows=visual.grid?.rows||[]; if(!rows.length) return;
    const values=rows.flatMap((row)=>row.filter((cell)=>cell.active!==false&&cell.w_mm!==null).map((cell)=>Math.abs(Number(cell.w_mm))));
    const maximum=Math.max(...values,1e-9), palette=["#173bff","#05a9db","#10c88a","#f2d33f","#ef553b"], plot={x:28,y:58,w:width-56,h:height-100};
    rows.forEach((row,iy)=>row.forEach((cell,ix)=>{
      ctx.fillStyle=cell.active===false||cell.w_mm===null?"#fff":palette[Math.min(palette.length-1,Math.floor(Math.abs(Number(cell.w_mm))/maximum*palette.length))];
      ctx.fillRect(plot.x+ix*plot.w/row.length,plot.y+iy*plot.h/rows.length,plot.w/row.length+1,plot.h/rows.length+1);
      if(cell.supported){ctx.fillStyle="#173b55";ctx.fillRect(plot.x+ix*plot.w/row.length+2,plot.y+iy*plot.h/rows.length+2,4,4);}
    }));
    ctx.fillStyle="#405966";ctx.font="17px Segoe UI";ctx.fillText(`Verformung |w|max = ${maximum.toFixed(3)} mm`,28,height-18);
  }

  function beam(ctx, visual, width, height) {
    const samples=(visual.spans||[]).flatMap((span)=>span.samples||[]); if(!samples.length) return;
    const maxX=Math.max(...samples.map((p)=>Number(p.x_global_m)),1), maxM=Math.max(...samples.map((p)=>Math.abs(Number(p.moment_knm))),1e-9), baseline=height*.58;
    ctx.strokeStyle="#81949e";ctx.beginPath();ctx.moveTo(28,baseline);ctx.lineTo(width-28,baseline);ctx.stroke();ctx.strokeStyle="#0c9aa0";ctx.lineWidth=4;ctx.beginPath();samples.forEach((p,i)=>{const x=28+Number(p.x_global_m)/maxX*(width-56),y=baseline+Number(p.moment_knm)/maxM*(height*.30);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle="#405966";ctx.font="17px Segoe UI";ctx.fillText(`Momentenlinie |M|max = ${maxM.toFixed(2)} kNm`,28,height-18);
  }

  function truss(ctx, visual, width, height) {
    const nodes=visual.nodes||[]; if(!nodes.length) return;
    const minX=Math.min(...nodes.map(n=>Number(n.x_m))),maxX=Math.max(...nodes.map(n=>Number(n.x_m))),minY=Math.min(...nodes.map(n=>Number(n.y_m))),maxY=Math.max(...nodes.map(n=>Number(n.y_m)));
    const point=(n)=>({x:55+(Number(n.x_m)-minX)/Math.max(maxX-minX,1)*(width-110),y:height-65-(Number(n.y_m)-minY)/Math.max(maxY-minY,1)*(height-135)}), map=Object.fromEntries(nodes.map(n=>[String(n.node_id),point(n)]));
    const job=byRef[visual.position_ref]?.job.analysis_model, forces=Object.fromEntries((visual.members||[]).map(m=>[String(m.member_id),Number(m.axial_force_kn)]));
    (job?.members||[]).forEach(m=>{const a=map[String(m.start_node)],b=map[String(m.end_node)],f=forces[String(m.member_id)]||0;if(!a||!b)return;ctx.strokeStyle=f<0?"#ef553b":"#0c9aa0";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});
    nodes.forEach(n=>{const p=point(n);ctx.fillStyle="#173b55";ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();});ctx.fillStyle="#405966";ctx.font="17px Segoe UI";ctx.fillText("Stabkräfte: Zug türkis · Druck rot",28,height-18);
  }

  function positionGraphics() {
    document.querySelectorAll(".project-result-canvas").forEach((canvas)=>{
      const position=byRef[canvas.dataset.position], result=position?.result, analysis=result?.analysis?.analyses?.[0]?.result;
      const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#f5f8f9";ctx.fillRect(0,0,canvas.width,canvas.height);
      if(!analysis)return; const visual={...analysis,position_ref:position.position_ref};ctx.fillStyle="#173b55";ctx.font="700 21px Segoe UI";ctx.fillText(`${position.position_ref} · ${analysis.theory||analysis.solver}`,28,36);
      if(analysis.grid) heatmap(ctx,visual,canvas.width,canvas.height); else if(analysis.spans) beam(ctx,visual,canvas.width,canvas.height); else if(analysis.members) truss(ctx,visual,canvas.width,canvas.height); else {ctx.fillStyle="#607480";ctx.font="17px Segoe UI";ctx.fillText("Nachweisposition ohne Feld- oder Liniengrafik",28,85);}
    });
  }

  function stepMarkup(steps) {
    if (!steps?.length) return '<p class="empty">Für diese Position wurde kein Rechenschritt geliefert.</p>';
    return steps.map((step,index)=>`<article class="calculation-step"><span class="step-number">${String(index+1).padStart(2,"0")}</span><div><h4>${html(step.label||step.step_id)}</h4><code>${html(step.formula)}</code><p><b>Einsetzen:</b> ${html(step.substitutions)}</p><p class="step-result"><b>Ergebnis:</b> ${html(fmt(step.value))} ${html(step.unit||"")}</p><small>Bezug: ${html((step.standard_refs||[]).join(", ")||"Grundlagenstatik")} · Annahmen: ${html((step.assumptions||[]).join(", ")||"siehe Eingaben")}</small></div></article>`).join("");
  }

  function checkMarkup(checks) {
    return (checks||[]).map((item)=>`<tr><td>${html(item.label)}</td><td>${html(item.limit_state)}</td><td>${html(fmt(item.design_value))}</td><td>${html(fmt(item.resistance_value))}</td><td>${html(item.unit)}</td><td>${html(fmt(Number(item.utilization||0)*100))} %</td><td>${html(item.status)}</td></tr>`).join("");
  }

  function refreshResults(result) {
    payload.result = result; positions = result.positions || []; byRef = Object.fromEntries(positions.map((item)=>[item.position_ref,item]));
    document.querySelectorAll("[data-summary]").forEach((node)=>{node.textContent=fmt(result.summary[node.dataset.summary]);});
    positions.forEach((position)=>{
      const checks=(position.result.design||{}).checks||[];
      const tbody=document.querySelector(`[data-checks-for="${CSS.escape(position.position_ref)}"]`); if(tbody)tbody.innerHTML=checkMarkup(checks);
      const steps=document.querySelector(`[data-steps-for="${CSS.escape(position.position_ref)}"]`); if(steps)steps.innerHTML=stepMarkup(position.result.calculation_steps||[]);
      const pill=document.querySelector(`[data-position-status="${CSS.escape(position.position_ref)}"]`); if(pill){pill.textContent=position.result.summary.status;pill.dataset.status=position.result.summary.status;}
    });
    (result.environmental_actions||[]).forEach((action)=>{
      const card=document.querySelector(`[data-environment-result="${CSS.escape(action.action_id)}"]`); if(!card)return;
      Object.entries(action).forEach(([key,value])=>{const node=card.querySelector(`[data-env-value="${CSS.escape(key)}"]`);if(node&&value!==null)node.textContent=`${fmt(value)} ${key.endsWith("_kn_m2")?"kN/m²":key.endsWith("_kn")?"kN":""}`;});
      const steps=card.querySelector("[data-environment-steps]");if(steps)steps.innerHTML=stepMarkup(action.calculation_steps||[]);
    });
    systemOverview(); positionGraphics();
  }

  const state=document.getElementById("preview-state"); let timer;
  async function recalculate() {
    const changed=[...document.querySelectorAll("[data-edit-input]")].filter((input)=>input.value!==input.dataset.initial).map((input)=>({path:input.dataset.path,value:Number(input.value)})).filter((item)=>Number.isFinite(item.value));
    if(!changed.length){state.textContent="Original-Testfall · keine ungespeicherten Änderungen";return;}
    state.textContent=`Berechnung läuft · ${changed.length} geänderte Werte`; state.dataset.state="loading";
    try {
      const response=await fetch(payload.preview_url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({overrides:changed})});
      const result=await response.json(); if(!response.ok)throw new Error(result.message||"Variantenrechnung fehlgeschlagen");
      refreshResults(result); state.textContent=`Vorschau aktualisiert · ${changed.length} geänderte Werte · nicht gespeichert`;state.dataset.state="success";
    } catch(error) {state.textContent=`Fehler: ${error.message}`;state.dataset.state="error";}
  }
  document.getElementById("recalculate-project")?.addEventListener("click",recalculate);
  document.querySelectorAll("[data-edit-input]").forEach((input)=>input.addEventListener("input",()=>{state.textContent="Eingabe geändert · automatische Neuberechnung …";clearTimeout(timer);timer=setTimeout(recalculate,650);}));
  document.getElementById("reset-project")?.addEventListener("click",()=>{document.querySelectorAll("[data-edit-input]").forEach((input)=>{input.value=input.dataset.initial;});refreshResults(JSON.parse(document.getElementById("project-report-data").textContent).result);state.textContent="Original-Testfall · Eingaben zurückgesetzt";});
  document.getElementById("formula-search")?.addEventListener("input",(event)=>{const query=event.target.value.trim().toLowerCase();document.querySelectorAll("[data-formula-row]").forEach((row)=>{row.hidden=query&&!row.dataset.search.includes(query);});});
  systemOverview(); positionGraphics();
})();
