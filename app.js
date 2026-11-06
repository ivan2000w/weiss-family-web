'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const portraitCache=new Map();
const enc=new TextEncoder(),dec=new TextDecoder();
let data,people,byId,key,manifest,selected,view='tree',mode='family',coords=[],worldW=900,worldH=550,scale=1,tx=0,ty=0,urls=[],toastTimer,unlockEpoch=0,navigationTrail=[],wholeLinks=[];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const initials=p=>p.name.split(' ').filter(Boolean).filter(s=>!s.startsWith('(')).map(s=>s[0]).filter(Boolean).filter((_,i,a)=>i===0||i===a.length-1).join('');
const years=p=>p.birthYear?(p.deathYear?`${p.birthYear} – ${p.deathYear}`:`Born ${p.birthYear}`):(p.deathYear?`Died ${p.deathYear}`:'Dates not recorded');
const birthPlace=p=>{const e=p.events.find(e=>e.type==='Birth');return e?e.details.slice(/\d/.test(e.details[0]||'')?1:0).join(' '):'';};
const base64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
async function decryptFile(file){const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error('Could not load archive');const bytes=new Uint8Array(await r.arrayBuffer());return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},key,bytes.slice(12));}
$('#reveal').addEventListener('click',()=>{const input=$('#password');input.type=input.type==='password'?'text':'password';$('#reveal').textContent=input.type==='password'?'Show':'Hide';$('#reveal').setAttribute('aria-label',input.type==='password'?'Show password':'Hide password');});
$('#unlock-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('#unlock');button.disabled=true;button.innerHTML='Opening the archive…';$('#gate-error').textContent='';const epoch=++unlockEpoch;
 try{if(!crypto.subtle)throw Error('secure');const r=await fetch('archive.json',{cache:'no-store'});if(!r.ok)throw Error('network');manifest=await r.json();const material=await crypto.subtle.importKey('raw',enc.encode($('#password').value),'PBKDF2',false,['deriveKey']);key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:base64(manifest.salt),iterations:manifest.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);const payload=await decryptFile(manifest.data);if(epoch!==unlockEpoch)return;data=JSON.parse(dec.decode(payload));people=data.people;byId=Object.fromEntries(people.map(p=>[p.id,p]));$('#password').value='';$('#gate').hidden=true;$('#app').hidden=false;init();}
 catch(error){key=null;$('#gate-error').textContent=error.message==='secure'?'Please open this site over HTTPS or localhost.':error.name==='OperationError'?'That password didn’t match. Please try again.':'The archive could not be opened. Check your connection and try again.';$('#password').focus();}
 finally{button.disabled=false;button.innerHTML='Open the archive <span aria-hidden="true">↗</span>';}});
function lock(){unlockEpoch++;portraitCache.clear();key=null;data=null;people=null;byId=null;urls.forEach(URL.revokeObjectURL);urls=[];$('#app').hidden=true;$('#gate').hidden=false;$('#profile').replaceChildren();$('#family-overview').replaceChildren();$('#family-heading').textContent='';$('#focus-years').textContent='';$('#tree-selection-name').textContent='';wholeLinks=[];coords=[];$('#surname').innerHTML='<option value="">All family names</option>';navigationTrail=[];$('#nodes').replaceChildren();$('#connections').replaceChildren();$('#people-list').replaceChildren();$('#document-list').replaceChildren();$('#search-results').replaceChildren();$('#tree-search').value='';$('#people-search').value='';$('#provenance').textContent='';$('#password').value='';$('#password').type='password';$('#reveal').textContent='Show';history.replaceState(null,'',location.pathname);$('#password').focus();}
$('#lock').addEventListener('click',lock);
function init(){const hash=location.hash.slice(1).split('/');selected=byId[hash[1]]?hash[1]:data.root;navigationTrail=[];history.replaceState({trail:[]},'',`#${['tree','people','archive'].includes(hash[0])?hash[0]:'tree'}/${selected}`);$('#nav-count').textContent=people.length;$('.archive-stat strong').textContent=people.length;$('#surname').innerHTML='<option value="">All family names</option>'+[...new Set(people.map(p=>p.surname))].sort((a,b)=>a.localeCompare(b)).map(n=>`<option>${escapeHTML(n)}</option>`).join('');$('#provenance').textContent=data.provenance;renderArchive();setView(['tree','people','archive'].includes(hash[0])?hash[0]:'tree',false);}
function setView(next,update=true){view=next;for(const n of ['tree','people','archive'])$(`#${n}-view`).hidden=n!==view;$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});const titles={tree:['THE WEISS FAMILY','Your family tree','Find a person, then explore their parents, children and relatives.'],people:['THE WEISS FAMILY','Find a person','Search all 173 people by name or birthplace.'],archive:['THE WEISS FAMILY','Original documents','Open the family charts used to create this tree.']};$('#section-eyebrow').textContent=titles[view][0];$('#page-title').innerHTML=titles[view][1];$('#page-description').textContent=titles[view][2];if(view==='tree'){renderTree();renderProfile();}if(view==='people')renderPeople();if(update)history.replaceState({trail:navigationTrail},'',`#${view}/${selected}`);}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('.header .wordmark').addEventListener('click',e=>{e.preventDefault();setView('tree');});
window.addEventListener('hashchange',()=>{if(!data)return;const [v,id]=location.hash.slice(1).split('/');selected=byId[id]?id:data.root;navigationTrail=history.state?.trail||[];setView(['tree','people','archive'].includes(v)?v:'tree',false);$('.family-context').scrollIntoView({block:'start',behavior:'auto'});});
function select(id,fromList=false,keepCamera=false){
 if(!byId[id])return;
 if(selected!==id){navigationTrail.push(selected);history.pushState({trail:[...navigationTrail]},'',`#tree/${id}`);}
 selected=id;$('#tree-search').value='';$('#search-results').hidden=true;
 if(view!=='tree')setView('tree',false);else{renderTree(keepCamera);renderProfile();}
 if(mode==='whole'){if(!keepCamera)requestAnimationFrame(focusWholePerson);return;}
 $('#family-heading').focus({preventScroll:true});$('.family-context').scrollIntoView({block:'start',behavior:'auto'});
}
$('#home-person').addEventListener('click',()=>select(data.root));
$('#person-back').addEventListener('click',()=>{if(navigationTrail.length)history.back();});
$$('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;renderTree();}));
$('#show-details').addEventListener('click',()=>{$('#profile').focus({preventScroll:true});$('#profile').scrollIntoView({block:'start',behavior:'auto'});});
function shortName(p){const words=p.name.split(' ');return words[0]+' '+words.at(-1);}
function siblingsOf(p){return people.filter(q=>q.id!==p.id&&p.parents.length&&q.parents.some(id=>p.parents.includes(id))).map(q=>q.id);}
function portraitMarkup(p){
 if(!p.portrait)return '';
 const photo=p.portrait,fictional=photo.kind==='fictional';
 const source=photo.sourceUrl&&/^https:\/\//.test(photo.sourceUrl)?`<a href="${escapeHTML(photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(photo.sourceTitle||'View archive source')} ↗</a>`:'';
 return `<figure class="portrait ${fictional?'fictional':'historical'}"><span class="portrait-type">${fictional?'Fictional depiction':'Archive image'}</span><img id="person-portrait" alt="${fictional?'Fictional depiction of ':''}${escapeHTML(p.name)}" hidden><p id="portrait-loading" role="status">Opening portrait…</p><figcaption>${escapeHTML(photo.caption)}${source}</figcaption></figure>`;
}
async function loadPortrait(p){
 if(!p.portrait||!manifest.portraits?.[p.id])return;
 const epoch=unlockEpoch;
 try{
  let pending=portraitCache.get(p.id);
  if(!pending){pending=decryptFile(manifest.portraits[p.id]).then(buffer=>{if(epoch!==unlockEpoch)return null;const mime=p.portrait.file.endsWith('.png')?'image/png':p.portrait.file.endsWith('.webp')?'image/webp':'image/jpeg';const url=URL.createObjectURL(new Blob([buffer],{type:mime}));urls.push(url);return url;});portraitCache.set(p.id,pending);}
  const url=await pending;if(epoch!==unlockEpoch||selected!==p.id||!url)return;
  const img=$('#person-portrait');if(!img)return;img.src=url;img.hidden=false;$('#portrait-loading').hidden=true;
 }catch{portraitCache.delete(p.id);if(epoch===unlockEpoch&&selected===p.id&&$('#portrait-loading'))$('#portrait-loading').textContent='Portrait could not be opened. Select this person again to retry.';}
}
function renderProfile(){
 const p=byId[selected];
 $('#profile').innerHTML=`<h2>Life details</h2><p class="profile-person">${escapeHTML(p.name)}</p>${portraitMarkup(p)}${p.events.length?p.events.map(e=>`<div class="detail-event"><span>${escapeHTML(e.type)}</span><div>${e.details.map(t=>escapeHTML(t)).join('<br>')||'Not recorded'}</div></div>`).join(''):'<p class="record-empty">No dates or places are recorded for this person.</p>'}${p.deceased&&!p.deathYear?'<div class="detail-event"><span>Status</span><div>Recorded as deceased; date not given.</div></div>':''}${p.notes.map(n=>`<p class="note">${escapeHTML(n)}</p>`).join('')}<button class="record-link" data-document="close-family" data-page="${p.pages[0]}"><span>Open original record<span class="record-pages">Family chart · page ${p.pages.join(', ')}</span></span><span aria-hidden="true">↗</span></button><p class="record-disclaimer">These are historical records. An absent death date does not confirm that someone is living.</p><button id="return-to-family" class="details-button">↑ Back to family</button>`;
 loadPortrait(p);
 $('#profile').querySelector('[data-document]').addEventListener('click',e=>openDocument(e.currentTarget.dataset.document,Number(e.currentTarget.dataset.page)));
 $('#return-to-family').addEventListener('click',()=>{$('#family-heading').focus({preventScroll:true});$('.family-context').scrollIntoView({block:'start',behavior:'auto'});});
}
function renderOverview(p){
 const personCard=id=>{const q=byId[id];return `<button class="family-card" data-person="${id}"><span class="family-card-name">${escapeHTML(q.name)}</span><span class="family-card-years">${escapeHTML(years(q))}</span><span class="family-card-action">View family <span aria-hidden="true">→</span></span></button>`;};
 const group=(name,ids,description,empty,collapsible=false)=>{
  const cards=ids.length?`<div class="family-card-grid">${ids.map(personCard).join('')}</div>`:`<p class="no-records">${empty}</p>`;
  return collapsible?`<details class="family-group siblings"><summary>${name} <span class="relation-count">${ids.length}</span><span class="expand-label">Show / hide</span></summary><p class="group-explanation">${description}</p>${cards}</details>`:`<section class="family-group"><div class="family-group-heading"><h3>${name} <span class="relation-count">${ids.length}</span></h3><p>${description}</p></div>${cards}</section>`;
 };
 $('#family-overview').innerHTML=group('Parents',p.parents,'One generation earlier','No parents are recorded here.')+group('Spouses & partners',p.partners,'','No spouse or partner is recorded here.')+group('Children',p.children,'One generation later','No children are recorded here.')+group('Brothers & sisters',siblingsOf(p),'','No brothers or sisters are recorded here.');
 $('#family-overview').querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.person)));
}
function renderTree(keepCamera=false){
 const p=byId[selected];$('.family-focus').hidden=mode==='whole';$('#family-help').hidden=mode==='whole';$('#family-heading').textContent=p.name;$('#focus-years').textContent=years(p);
 $('#person-back').disabled=!navigationTrail.length;
 $('#person-back').textContent=navigationTrail.length?'← Back to '+shortName(byId[navigationTrail.at(-1)]):'← Back';
 $('#person-back').title=navigationTrail.length?`Return to ${byId[navigationTrail.at(-1)].name}`:'Choose a relative to begin exploring';
 $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 $('#family-overview').hidden=mode!=='family';$('.tree-frame').hidden=mode==='family';$('.explorer').classList.toggle('whole-tree',mode==='whole');
 $('#family-help').textContent=mode==='family'?'Tap a relative’s name to see their family. Use the Back button to return.':'The full tree includes everyone in the records. Select a person to see their name and details above the tree.';
 if(mode==='family'){renderOverview(p);return;}
 if(mode==='whole'){renderWholeTree(keepCamera);return;}
 coords=[];const links=[];const W=280,H=200,STEP=350;
 function walk(id,depth,y,spread){const node={id,x:32+depth*STEP,y,label:['This person','Parent','Grandparent'][depth]};coords.push(node);if(depth<2)byId[id].parents.forEach((parent,i)=>{const py=byId[id].parents.length===1?y:y+(i===0?-1:1)*spread;const next=walk(parent,depth+1,py,spread/2);links.push({a:node,b:next});});return node;}
 walk(p.id,0,500,240);const low=Math.min(...coords.map(c=>c.y));coords.forEach(c=>c.y-=low-70);worldW=Math.max(...coords.map(c=>c.x))+W+32;worldH=Math.max(...coords.map(c=>c.y))+H+40;
 $('#tree-world').style.width=worldW+'px';$('#tree-world').style.height=worldH+'px';$('#connections').setAttribute('width',worldW);$('#connections').setAttribute('height',worldH);
 $('#connections').innerHTML=links.map(({a,b})=>{const x1=a.x+W,y1=a.y+H/2,x2=b.x,y2=b.y+H/2;return `<path d="M${x1} ${y1}H${(x1+x2)/2}V${y2}H${x2}"/>`;}).join('');
 $('#nodes').innerHTML=coords.map(c=>{const n=byId[c.id];return `<button class="person-node ${c.id===selected?'selected':''}" style="left:${c.x}px;top:${c.y}px" data-person="${c.id}" ${c.id===selected?'aria-current="true"':''} aria-label="${escapeHTML(n.name)}, ${escapeHTML(years(n))}. ${c.label}. View family."><span class="node-tag">${c.label}</span><span class="node-name">${escapeHTML(n.name)}</span><span class="node-years">${escapeHTML(years(n))}</span><span class="node-action">View family →</span></button>`;}).join('');
 $('#nodes').querySelectorAll('button').forEach(b=>b.addEventListener('click',e=>{if(suppressClick){e.preventDefault();return;}select(b.dataset.person);}));$('#canvas-title').textContent='ANCESTOR TREE';$('#visible-count').textContent=`${coords.length} people shown`;requestAnimationFrame(()=>fitTree());
}

function renderWholeTree(keepCamera=false){
 const generations=[...new Set(people.map(p=>p.generation))].sort((a,b)=>a-b);
 const minX=Math.min(...people.map(p=>p.box[0]));
 coords=people.map(p=>({id:p.id,x:90+(p.box[0]-minX)*2.12,y:90+generations.indexOf(p.generation)*340,label:'Generation '+(generations.indexOf(p.generation)+1)}));
 const positions=Object.fromEntries(coords.map(c=>[c.id,c]));
 worldW=Math.max(...coords.map(c=>c.x))+370;worldH=generations.length*340+80;wholeLinks=[];
 const families=new Map(), joined=new Set();
 for(const child of people){
  if(!child.parents.length)continue;
  const ids=[...child.parents].sort((a,b)=>Number(a.slice(1))-Number(b.slice(1))),id=ids.join('|');
  if(!families.has(id))families.set(id,{parents:ids.map(id=>positions[id]),children:[]});
  families.get(id).children.push(positions[child.id]);
 }
 for(const [id,family] of families){
  const parents=family.parents,children=family.children;
  const jointX=parents.reduce((sum,p)=>sum+p.x+140,0)/parents.length;
  const jointY=Math.max(...parents.map(p=>p.y+200))+30;
  if(parents.length===2){
   joined.add(id);const [a,b]=parents;
   wholeLinks.push({type:'couple',d:`M${a.x+140} ${a.y+200}V${jointY}H${b.x+140}V${b.y+200}`,family:id});
  }else wholeLinks.push({type:'parent',d:`M${jointX} ${parents[0].y+200}V${jointY}`,family:id});
  const rows=new Map();for(const c of children){if(!rows.has(c.y))rows.set(c.y,[]);rows.get(c.y).push(c);}
  for(const [row,group] of rows){
   const branchY=row-40,left=Math.min(jointX,...group.map(c=>c.x+140)),right=Math.max(jointX,...group.map(c=>c.x+140));
   wholeLinks.push({type:'descent',d:`M${jointX} ${jointY}V${branchY}M${left} ${branchY}H${right}`,family:id});
   for(const c of group)wholeLinks.push({type:'child',d:`M${c.x+140} ${branchY}V${c.y}`,family:id});
  }
 }
 for(const p of people)for(const partner of p.partners){
  if(Number(p.id.slice(1))>=Number(partner.slice(1)))continue;
  const id=[p.id,partner].join('|');if(joined.has(id))continue;
  const a=positions[p.id],b=positions[partner],y=Math.max(a.y,b.y)+230;
  wholeLinks.push({type:'partner',d:`M${a.x+140} ${a.y+200}V${y}H${b.x+140}V${b.y+200}`,family:id});
 }
 $('#tree-world').style.width=worldW+'px';$('#tree-world').style.height=worldH+'px';$('#connections').setAttribute('width',worldW);$('#connections').setAttribute('height',worldH);
 $('#connections').innerHTML=generations.map((g,i)=>`<text x="14" y="${65+i*340}" fill="#526544" font-size="28" font-family="Arial">Generation ${i+1}</text>`).join('')+wholeLinks.map(link=>`<path class="${link.type}" data-family="${link.family}" d="${link.d}"/>`).join('');
 $('#nodes').innerHTML=coords.map(c=>{const n=byId[c.id];return `<button class="person-node ${c.id===selected?'selected':''}" style="left:${c.x}px;top:${c.y}px" data-person="${c.id}" ${c.id===selected?'aria-current="true"':''} aria-label="${escapeHTML(n.name)}, ${escapeHTML(years(n))}. Select person."><span class="node-tag">${c.label}</span><span class="node-name">${escapeHTML(n.name)}</span><span class="node-years">${escapeHTML(years(n))}</span><span class="node-action">Select person</span></button>`;}).join('');
 $('#nodes').querySelectorAll('button').forEach(b=>b.addEventListener('click',e=>{if(suppressClick){e.preventDefault();return;}select(b.dataset.person,false,true);}));
 $('#canvas-title').textContent='FULL FAMILY TREE';$('#visible-count').textContent=`All ${people.length} people · ${generations.length} generations`;
 $('#tree-selection-name').textContent=byId[selected].name+' · '+years(byId[selected]);
 $('#whole-tree-help').textContent='A line joins both parents. Their children branch from its middle. “Show everyone” shows the full tree; “Read names larger” brings you closer.';
 if(!keepCamera)requestAnimationFrame(()=>showEveryone());
}
function showEveryone(){if(mode!=='whole')return;const r=viewport.getBoundingClientRect();scale=Math.min((r.width-24)/worldW,(r.height-36)/worldH);tx=(r.width-worldW*scale)/2;ty=(r.height-worldH*scale)/2;applyTransform();}
function focusWholePerson(){if(mode!=='whole')return;const r=viewport.getBoundingClientRect(),p=coords.find(c=>c.id===selected);if(!p)return;scale=1;tx=r.width/2-(p.x+140);ty=r.height/2-(p.y+100);applyTransform();}
$('#show-everyone').addEventListener('click',showEveryone);$('#read-names').addEventListener('click',focusWholePerson);
$('#tree-selection-details').addEventListener('click',()=>{$('#profile').focus({preventScroll:true});$('#profile').scrollIntoView({block:'start',behavior:'auto'});});
$('#save-tree').addEventListener('click',()=>{
 if(!data||mode!=='whole')return;
 const wrap=text=>{const lines=[];let line='';for(const word of text.split(' ')){if((line+' '+word).trim().length>23&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;};
 const cards=coords.map(c=>{const p=byId[c.id];return `<g transform="translate(${c.x} ${c.y})"><rect width="280" height="200" fill="${c.id===selected?'#293d35':'#fffcf5'}" stroke="#667755" stroke-width="2"/><text x="18" y="32" fill="${c.id===selected?'#fff':'#293d35'}" font-family="Arial" font-size="22">${wrap(p.name).map((line,i)=>`<tspan x="18" dy="${i?27:0}">${escapeHTML(line)}</tspan>`).join('')}</text><text x="18" y="180" font-size="18" font-family="Arial" fill="${c.id===selected?'#fff':'#293d35'}">${escapeHTML(years(p))}</text></g>`;}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${worldW}" height="${worldH+100}" viewBox="0 0 ${worldW} ${worldH+100}"><rect width="100%" height="100%" fill="#f4f1e9"/><style>path{fill:none;stroke:#728461;stroke-width:3}.partner{stroke-dasharray:8 5}</style><text x="40" y="45" font-family="Georgia" font-size="36" fill="#293d35">Weiss family tree · 173 people · 9 generations</text><g transform="translate(0 70)">${$('#connections').innerHTML}${cards}</g></svg>`;
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));urls.push(url);const a=document.createElement('a');a.href=url;a.download='Weiss-full-family-tree.svg';a.click();toast('Full family tree saved. Open it in a browser to enlarge or print.');
});
function applyTransform(){$('#tree-world').style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;$('#tree-world').style.setProperty('--tree-scale',scale);$('#zoom-value').textContent=Math.round(scale*100)+'%';}
function fitTree(){if(!coords.length)return;if(mode==='whole'){focusWholePerson();return;}const r=$('#tree-viewport').getBoundingClientRect();scale=1;const focus=coords.find(c=>c.id===selected);tx=20-focus.x;ty=Math.max(65,r.height/2-100)-focus.y;applyTransform();}
function zoom(factor,x,y){const r=$('#tree-viewport').getBoundingClientRect();x=x??r.width/2;y=y??r.height/2;const next=Math.min(2,Math.max(mode==='whole'?.025:.75,scale*factor));tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;applyTransform();}
$('#zoom-in').addEventListener('click',()=>zoom(1.2));$('#zoom-out').addEventListener('click',()=>zoom(1/1.2));$('#fit').addEventListener('click',()=>fitTree(true));
const viewport=$('#tree-viewport'),pointers=new Map();let drag=null,pinch=null,suppressClick=false;
viewport.addEventListener('pointerdown',e=>{if(e.button&&e.button!==0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,tx,ty,moved:false};suppressClick=false;if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),scale};}if(!e.target.closest('button'))viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()];const dist=Math.hypot(a.x-b.x,a.y-b.y);const r=viewport.getBoundingClientRect();zoom(pinch.scale*dist/pinch.distance/scale,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);suppressClick=true;return;}if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6){drag.moved=true;suppressClick=true;viewport.classList.add('dragging');viewport.setPointerCapture(e.pointerId);}if(drag.moved){tx=drag.tx+dx;ty=drag.ty+dy;applyTransform();}}});
function endPointer(e){pointers.delete(e.pointerId);if(pointers.size===0){drag=null;pinch=null;viewport.classList.remove('dragging');setTimeout(()=>suppressClick=false,50);}else{const p=[...pointers.values()][0];drag={...p,tx,ty,moved:true};pinch=null;}}
viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.005),e.clientX-r.left,e.clientY-r.top);}}, {passive:false});
viewport.addEventListener('keydown',e=>{if(e.target!==viewport)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')tx+=40;if(e.key==='ArrowRight')tx-=40;if(e.key==='ArrowUp')ty+=40;if(e.key==='ArrowDown')ty-=40;if(e.key==='+')zoom(1.2);if(e.key==='-')zoom(1/1.2);if(e.key==='0')fitTree(true);applyTransform();});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(data&&view==='tree'&&mode==='whole'){if(scale<.2)showEveryone();else focusWholePerson();};},150);});
$('#tree-search').addEventListener('input',e=>{const q=fold(e.target.value.trim());const panel=$('#search-results');panel.hidden=!q;if(!q)return;const matches=people.filter(p=>fold(p.name+' '+birthPlace(p)).includes(q)).slice(0,12);panel.innerHTML=matches.length?matches.map(p=>`<button data-person="${p.id}">${escapeHTML(p.name)}<small>${escapeHTML(years(p))}${birthPlace(p)?' · '+escapeHTML(birthPlace(p)):''}</small></button>`).join(''):'<p>No matches. Try another name or place.</p>';panel.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>select(b.dataset.person)));});
$('#tree-search').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){$('#search-results button')?.focus();e.preventDefault();}if(e.key==='Enter'){$('#search-results button')?.click();e.preventDefault();}if(e.key==='Escape')$('#search-results').hidden=true;});
$('#search-results').addEventListener('keydown',e=>{const bs=[...$('#search-results').querySelectorAll('button')],i=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'){bs[Math.min(i+1,bs.length-1)]?.focus();e.preventDefault();}if(e.key==='ArrowUp'){if(i===0)$('#tree-search').focus();else bs[i-1]?.focus();e.preventDefault();}if(e.key==='Escape'){$('#search-results').hidden=true;$('#tree-search').focus();}});
document.addEventListener('click',e=>{if(!e.target.closest('.search-box'))$('#search-results').hidden=true;});
document.addEventListener('keydown',e=>{if(data&&view==='tree'&&e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#tree-search').focus();}});
function renderPeople(){const q=fold($('#people-search').value.trim()),surname=$('#surname').value,sort=$('#sort').value;const results=people.filter(p=>(!q||fold(p.name+' '+birthPlace(p)).includes(q))&&(!surname||p.surname===surname));results.sort(sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>{if(!a.birthYear)return b.birthYear?1:0;if(!b.birthYear)return -1;return sort==='oldest'?a.birthYear-b.birthYear:b.birthYear-a.birthYear;});$('#result-count').textContent=`${results.length} ${results.length===1?'person':'people'}`;$('#people-list').innerHTML=results.length?results.map(p=>`<button class="person-row" data-person="${p.id}"><span class="row-initials" aria-hidden="true">${escapeHTML(initials(p))}</span><span class="row-text"><span class="row-name">${escapeHTML(p.name)}</span><span class="row-meta">${escapeHTML(years(p))}</span></span><span class="row-action">View family →</span></button>`).join(''):'<p class="empty">No people match these filters.<br>Try another name, place, or family name.</p>';$('#people-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>select(b.dataset.person,true)));}
$('#people-search').addEventListener('input',renderPeople);$('#surname').addEventListener('change',renderPeople);$('#sort').addEventListener('change',renderPeople);
function renderArchive(){$('#document-list').innerHTML=data.sources.map((d,i)=>`<article class="document"><div class="doc-cover" aria-hidden="true"><small>0${i+1} / WEISS</small><span>${escapeHTML(d.title)}</span><small>FAMILY COLLECTION</small></div><div><h3>${escapeHTML(d.title)}</h3><p>${escapeHTML(d.description)}</p><div class="doc-meta">PDF · ${d.pages} PAGES</div><button data-document="${d.id}">Open original document ↗</button></div></article>`).join('');$('#document-list').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDocument(b.dataset.document)));}
async function openDocument(id,page=1){const currentKey=key;const popup=window.open('about:blank','_blank');if(popup){popup.document.title='Opening family document…';popup.document.body.textContent='Opening the original family document…';popup.opener=null;}toast('Opening the original document…');try{const buffer=await decryptFile(manifest.documents[id]);if(key!==currentKey){popup?.close();return;}const url=URL.createObjectURL(new Blob([buffer],{type:'application/pdf'}));urls.push(url);if(popup)popup.location.href=url+`#page=${page}`;else{const a=document.createElement('a');a.href=url;a.download=`weiss-${id}.pdf`;a.click();}toast('Original document opened.');}catch{popup?.close();toast('Could not open the document. Please try again.');}}
