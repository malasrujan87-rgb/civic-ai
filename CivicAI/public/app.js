const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let reports = [];
let map, markers;

const icons = { "Road Damage":"⌁", "Drainage":"≈", "Waste":"♲", "Streetlight":"☼", "Water Supply":"◉", "Other":"•" };
const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText = d => new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short"});
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
function showView(name){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  const titles={overview:"Good morning, Admin ✦",complaints:"Complaint management",map:"Issue map & hotspots",submit:"Report a community issue",track:"Track your complaint"};
  $("#pageTitle").textContent=titles[name]||"CivicAI";
  $("#crumb").textContent=name.toUpperCase();
  if(name==="map") setTimeout(renderMap,100);
  if(name==="complaints") renderTable();
  window.scrollTo({top:0,behavior:"smooth"});
}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
$("#topReport").addEventListener("click",()=>showView("submit"));
$("#todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});

async function api(url, options={}) {
  const response=await fetch(url,options);
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Request failed");
  return data;
}
async function loadData(){
  try { reports=await api("/api/reports"); await renderAll(); }
  catch(e){toast("Could not connect to the server. Start it with npm start.");}
}
async function renderAll(){
  const insights=await api("/api/insights");
  $("#totalStat").textContent=insights.total;
  $("#activeStat").textContent=insights.active;
  $("#urgentStat").textContent=insights.urgent;
  $("#resolvedStat").textContent=insights.resolved;
  $("#navCount").textContent=insights.active;
  renderRecent(); renderInsights(insights); renderCategories(insights.byCategory); renderTable(); renderHotspots(insights.hotspots);
  if(map) renderMap();
}
function renderRecent(){
  const list=[...reports].slice(0,5);
  $("#recentList").innerHTML=list.length?list.map(r=>`<div class="report-item"><div class="report-symbol">${icons[r.category]||"•"}</div><div class="report-main"><strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.location)} · ${dateText(r.createdAt)}</small></div><span class="priority ${r.priority}">${r.priority}</span></div>`).join(""):`<div class="empty-state">No reports yet. Submit your first community issue.</div>`;
}
function renderInsights(data){
  const items=[];
  if(data.urgent) items.push(["⚑","Urgent reports need review",`${data.urgent} active report(s) are marked High or Critical. Review these first.`]);
  if(data.hotspots.length) items.push(["⌖","Repeated reports detected",`${data.hotspots[0].location} has ${data.hotspots[0].count} reports. Consider a coordinated inspection.`]);
  const dupes=reports.filter(r=>r.duplicateOf).length;
  if(dupes) items.push(["⧉","Possible duplicates linked",`${dupes} report(s) appear similar to an existing issue. Check before creating separate work orders.`]);
  if(!items.length) items.push(["✦","Ready for community reports","Submit sample issues to see AI-generated patterns and recommendations here."]);
  $("#insightList").innerHTML=items.map(x=>`<div class="insight-item"><div class="insight-symbol">${x[0]}</div><div><strong>${x[1]}</strong><p>${x[2]}</p></div></div>`).join("");
}
function renderCategories(byCategory){
  const entries=Object.entries(byCategory||{}).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...entries.map(x=>x[1]));
  $("#categoryBars").innerHTML=entries.length?entries.map(([name,count])=>`<div class="bar-item"><strong>${escapeHtml(name)}</strong><div class="bar-track"><div class="bar-fill" style="width:${count/max*100}%"></div></div><small>${count} report(s)</small></div>`).join(""):`<p class="muted">No category data yet.</p>`;
}
function renderHotspots(hotspots){
  $("#hotspotList").innerHTML=hotspots.length?hotspots.map(h=>`<div class="hotspot"><span class="hotspot-count">${h.count} reports</span><strong>${escapeHtml(h.location)}</strong><small>Repeated reports · Review area conditions</small></div>`).join(""):`<p class="muted">No repeated-location hotspots yet. Submit multiple reports for the same location to reveal patterns.</p>`;
}
function renderTable(){
  if(!$("#reportRows"))return;
  const q=($("#searchInput")?.value||"").toLowerCase();
  const status=$("#statusFilter")?.value||"", priority=$("#priorityFilter")?.value||"";
  const filtered=reports.filter(r=>(!q||`${r.title} ${r.location} ${r.category} ${r.id}`.toLowerCase().includes(q))&&(!status||r.status===status)&&(!priority||r.priority===priority));
  $("#reportRows").innerHTML=filtered.map(r=>`<tr><td><strong>${escapeHtml(r.title)}</strong><br><small>${r.id} · ${dateText(r.createdAt)}</small></td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.location)}</td><td><span class="priority ${r.priority}">${r.priority}</span></td><td><span class="status">${escapeHtml(r.status)}</span></td><td><button class="action-btn" data-detail="${r.id}">Manage →</button></td></tr>`).join("");
  $("#emptyState").hidden=filtered.length>0;
  $$("[data-detail]").forEach(b=>b.addEventListener("click",()=>openDetail(b.dataset.detail)));
}
["searchInput","statusFilter","priorityFilter"].forEach(id=>$("#"+id)?.addEventListener("input",renderTable));
function openDetail(id){
  const r=reports.find(x=>x.id===id);if(!r)return;
  $("#modalContent").innerHTML=`<div class="eyebrow">REPORT ${r.id}</div><h2>${escapeHtml(r.title)}</h2><p>${escapeHtml(r.description)}</p><p><b>Location:</b> ${escapeHtml(r.location)} · <b>Category:</b> ${escapeHtml(r.category)}</p><p><b>AI summary:</b> ${escapeHtml(r.summary)}</p><p><b>AI priority:</b> <span class="priority ${r.priority}">${r.priority} (${r.score}/100)</span></p><div class="modal-reasons"><b>Why this priority?</b><br>${r.reasons.map(escapeHtml).join("<br>")}<br><br><small>${escapeHtml(r.aiNote)}</small></div>${r.duplicateOf?`<p class="error">Possible duplicate of report ${r.duplicateOf} (${r.duplicateConfidence}% similarity indicator). Human review required.</p>`:""}<label>Assign department / team<br><input id="assignInput" value="${escapeHtml(r.assignedTo||"")}" placeholder="e.g. Road Maintenance Team"></label><label>Update status<br><select id="statusInput">${["Submitted","Under Review","Assigned","In Progress","Resolved"].map(s=>`<option ${r.status===s?"selected":""}>${s}</option>`).join("")}</select></label><button class="primary-btn" id="saveReport">Save updates</button><div id="saveMessage"></div>`;
  $("#detailModal").classList.add("open");
  $("#saveReport").addEventListener("click",async()=>{
    try{
      await api("/api/reports/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({assignedTo:$("#assignInput").value,status:$("#statusInput").value})});
      $("#detailModal").classList.remove("open");reports=await api("/api/reports");await renderAll();toast("Complaint updated successfully.");
    }catch(e){$("#saveMessage").innerHTML=`<span class="error">${escapeHtml(e.message)}</span>`;}
  });
}
$("#closeModal").addEventListener("click",()=>$("#detailModal").classList.remove("open"));
$("#detailModal").addEventListener("click",e=>{if(e.target.id==="detailModal")$("#detailModal").classList.remove("open")});

$("#reportForm").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;const button=form.querySelector("button[type=submit]");
  button.disabled=true;button.textContent="Analyzing report...";
  $("#formMessage").textContent="";
  try{
    const fd=new FormData(form);
    if(fd.get("category")==="Auto-detect")fd.set("category","");
    const report=await api("/api/reports",{method:"POST",body:fd});
    reports=await api("/api/reports");await renderAll();
    form.reset();form.elements.citizenName.value="Demo Citizen";
    $("#formMessage").innerHTML=`<div class="success">✓ Report submitted. Your ID is <b>${report.id}</b>. AI suggests ${report.priority} priority. <button type="button" class="text-btn" id="showNewReport">View analysis →</button></div>`;
    $("#showNewReport").addEventListener("click",()=>{showView("complaints");openDetail(report.id)});
    toast("Complaint submitted successfully.");
  }catch(err){$("#formMessage").innerHTML=`<div class="error">${escapeHtml(err.message)}</div>`;}
  finally{button.disabled=false;button.innerHTML='Submit complaint <span>→</span>';}
});
$("#trackForm").addEventListener("submit",async e=>{
  e.preventDefault();const id=new FormData(e.currentTarget).get("reportId").trim().toUpperCase();
  try{
    const all=await api("/api/reports");const r=all.find(x=>x.id.toUpperCase()===id);
    if(!r){$("#trackResult").innerHTML='<p class="error">No report found. Check the report ID and try again.</p>';return;}
    const steps=["Submitted","Under Review","Assigned","In Progress","Resolved"], current=steps.indexOf(r.status);
    $("#trackResult").innerHTML=`<h3>${escapeHtml(r.title)}</h3><p class="muted">${r.id} · ${escapeHtml(r.location)}</p><p><b>Current status:</b> <span class="status">${r.status}</span></p><p><b>Assigned team:</b> ${escapeHtml(r.assignedTo||"Not yet assigned")}</p><div class="timeline">${steps.map((s,i)=>`<div style="opacity:${i<=current?1:.35}"><b>${s}</b><small>${i<current?"Completed":i===current?"Current stage":"Waiting"}</small></div>`).join("")}</div>`;
  }catch(err){$("#trackResult").textContent=err.message;}
});

function renderMap(){
  if(!window.L)return;
  if(!map){map=L.map("issueMap").setView([12.2958,76.6394],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors"}).addTo(map);markers=L.layerGroup().addTo(map);}
  markers.clearLayers();
  reports.filter(r=>r.latitude&&r.longitude).forEach(r=>{
    L.circleMarker([r.latitude,r.longitude],{radius:r.priority==="Critical"?10:7,color:r.priority==="Critical"?"#c54c4c":"#167a55",fillOpacity:.75}).addTo(markers).bindPopup(`<b>${escapeHtml(r.title)}</b><br>${escapeHtml(r.location)}<br>${r.priority} · ${r.status}`);
  });
}
loadData();
