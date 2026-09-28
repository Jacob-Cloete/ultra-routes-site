(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion:reduce)'),small=matchMedia('(max-width:700px)');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const video=$('.hero-video'),filmButton=$('.film-toggle');
  let heroVisible=false,userPaused=false,manualVideo=false;
  const automaticVideo=()=>!small.matches&&!reduce.matches&&!navigator.connection?.saveData;
  function filmLabel(){const label=video.paused?'Play mountain footage':'Pause mountain footage';filmButton.innerHTML=`<span aria-hidden="true">${video.paused?'▷':'Ⅱ'}</span>`;filmButton.setAttribute('aria-label',label);}
  async function playFilm(){if(!video.src)video.src='https://videos.pexels.com/video-files/4046338/4046338-hd_1920_1080_25fps.mp4';try{await video.play();$('.film-status').textContent='';}catch{filmLabel();}}
  video.addEventListener('playing',()=>{video.classList.add('playing');filmLabel();});video.addEventListener('pause',filmLabel);
  video.addEventListener('error',()=>{video.classList.remove('playing');$('.film-status').textContent='Showing the photograph.';filmLabel();});
  filmButton.addEventListener('click',()=>{if(video.paused){userPaused=false;manualVideo=true;playFilm();}else{userPaused=true;video.pause();}});
  new IntersectionObserver(([e])=>{heroVisible=e.isIntersecting;if(!heroVisible)video.pause();else if(!document.hidden&&!userPaused&&(automaticVideo()||manualVideo))playFilm();},{threshold:.2}).observe($('.hero'));
  reduce.addEventListener('change',()=>{if(reduce.matches){manualVideo=false;video.pause();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else if(heroVisible&&!userPaused&&(automaticVideo()||manualVideo))playFilm();});

  let trips=[],year='all',submitting=false,openedBy=null;
  const signup=$('#signup-dialog'),form=$('#signup-form'),feedback=$('.signup-status');
  const terrainDialog=$('#terrain-dialog');
  for(const dialog of [signup,terrainDialog]){
    dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  }
  const landmarkIcon=t=>`<svg class="landmark-icon" viewBox="0 0 64 48" aria-hidden="true" focusable="false"><use href="assets/landmarks.svg?v=20260928-4#${esc(t.icon)}"></use></svg>`;
  function render(){
    $('#trip-list').innerHTML=trips.map(t=>`
      <details class="trip" name="adventure" id="${esc(t.id)}" data-trip="${esc(t.id)}">
        <summary>
          <span class="trip-number">${esc(t.number)}</span>
          <span class="trip-heading">
            <span class="trip-date">${esc(t.month)} ${t.year} · ${esc(t.region)}${t.region!==t.country?' / '+esc(t.country):''}</span>
            <h3 class="trip-title">${landmarkIcon(t)}<span>${esc(t.name)}</span></h3>
            <span class="trip-meta">${esc(t.distanceLabel||'~'+t.km+' km')} &nbsp;·&nbsp; ${t.days} trail days &nbsp;·&nbsp; ${t.capacity} guest places</span>
            ${t.pace?`<span class="trip-pace">${esc(t.pace)}</span>`:''}
          </span>
          <span class="trip-plus" aria-hidden="true">+</span>
        </summary>
        <div class="trip-body">
          <p class="trip-description">${esc(t.summary)}</p>
          <div class="trip-stats"><div><span>Training begins</span><strong>${esc(t.training)}</strong></div><div><span>Preparation</span><strong>12 weeks</strong></div></div>
          <p class="trip-route">${esc(t.route)}</p>
          <details class="trip-detail"><summary>The proposed route</summary>
            <ol>${t.stops.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
            <p>${esc(t.note)}</p><p>These are proposed trail days; allow extra time for arrival, departure and weather.</p>
            <p>${esc(t.distanceNote)}</p>
            <div class="route-sources">${[{name:t.sourceName,url:t.source},...(t.extraSources||[])].map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a>`).join('')}</div>
          </details>
          <details class="trip-detail"><summary>Your training focus</summary>
            <p>${esc(t.focus)}</p><p>Starting in ${esc(t.training)}: four weeks building a routine, four weeks of terrain-specific work, two weeks of trip rehearsal and two weeks easing into departure. Weekly video check-ins and kit guidance throughout.</p>
            <a href="#preparation">See the preparation framework ↓</a>
          </details>
          <div class="trip-actions"><button class="solid-button" type="button" data-join="${esc(t.id)}">Join interest list <span aria-hidden="true">↗</span></button><button class="text-button" type="button" data-terrain="${esc(t.id)}">See the landscape in 3D</button></div>
          <p class="places-note">Jacob + up to ${t.capacity} guests. Price to follow. Signing up does not reserve a place.</p>
        </div>
      </details>`).join('');
    $$('.trip').forEach(detail=>detail.addEventListener('toggle',()=>{const open=$('.trip[open]');$$('.world-pin').forEach(pin=>pin.classList.toggle('active',pin.dataset.destination===open?.dataset.trip));}));
    $$('[data-join]').forEach(b=>b.addEventListener('click',()=>openSignup(b.dataset.join,b)));
    $$('[data-terrain]').forEach(b=>b.addEventListener('click',()=>openTerrain(trips.find(t=>t.id===b.dataset.terrain))));
    renderMap();filter(year);
  }
  function filter(value){
    year=value;
    $$('.year-filter [data-year]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.year===year)));
    $$('.trip').forEach(el=>{const visible=year==='all'||String(trips.find(t=>t.id===el.dataset.trip).year)===year;el.hidden=!visible;if(!visible)el.open=false;});
    $$('.world-pin').forEach(pin=>pin.classList.toggle('dim',year!=='all'&&pin.dataset.year!==year));
    const count=trips.filter(t=>year==='all'||String(t.year)===year).length;
    $('.calendar-count').textContent=`${count} proposed adventure${count===1?'':'s'}`;
  }
  $$('.year-filter [data-year]').forEach(b=>b.addEventListener('click',()=>filter(b.dataset.year)));
  function renderMap(){
    const project=([lon,lat])=>[((lon+169.2+360)%360)/360*1000,(84-lat)/360*1000];
    const marker=t=>{const [x,y]=project(t.coord),[dx,dy]=t.mapOffset||[0,0];return {x,y,mx:x+dx,my:y+dy};};
    $('.map-pins').innerHTML=trips.map(t=>{const {mx,my}=marker(t);return `<button type="button" class="world-pin" data-destination="${esc(t.id)}" data-year="${t.year}" style="left:${mx/10}%;top:${my/4}%" aria-label="${esc(t.name)}, ${esc(t.country)}, ${esc(t.month)} ${t.year}" title="${esc(t.landmark)} · ${esc(t.country)} · ${t.year}">${landmarkIcon(t)}<span class="pin-number">${esc(t.number)}</span></button>`;}).join('');
    $('.map-ink').innerHTML=trips.map(t=>{const{x,y,mx,my}=marker(t);return `<path class="map-leader" d="M${x} ${y}L${mx} ${my}"/><circle class="map-dot" cx="${x}" cy="${y}" r="4"/><text x="${mx+8}" y="${my-7}" fill="#edd5b7" font-size="10" font-family="Arial">${esc(t.number)}</text>`;}).join('');
    $$('[data-destination]').forEach(b=>b.addEventListener('click',()=>{filter(String(trips.find(t=>t.id===b.dataset.destination).year));const item=document.getElementById(b.dataset.destination);item.open=true;item.scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'start'});item.querySelector('summary').focus({preventScroll:true});}));
  }
  function openSignup(id,button){if(submitting)return;const t=trips.find(t=>t.id===id);openedBy=button;form.reset();form.hidden=false;form.elements.trip.value=id;feedback.textContent='';feedback.classList.remove('error');$('.signup-manage').hidden=true;$('.signup-trip').textContent=`${t.name} · ${t.month} ${t.year}`;signup.showModal();}
  signup.addEventListener('close',()=>openedBy?.focus());
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(submitting)return;submitting=true;const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Saving…';feedback.classList.remove('error');feedback.textContent='';
    const f=new FormData(form),payload={trip:f.get('trip'),name:f.get('name'),email:f.get('email'),website:f.get('website'),consent:f.get('consent')==='on'};
    try{
      const response=await fetch('api/interest.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
      const result=await response.json().catch(()=>{throw Error('Signups need the hosted site. Please use fast.jacobcloete.pro or try again later.');});
      if(!response.ok||!result.ok)throw Error(result.error||'Your signup could not be saved. Please try again.');
      form.hidden=true;feedback.textContent='Thank you. Your interest has been recorded. Jacob can contact you when the trip details are ready. This isn’t a confirmed place.';
      if(result.manageToken){const link=new URL('manage.html',location.href);link.hash=result.manageToken;$('.withdrawal-link').href=link.href;$('.signup-manage').hidden=false;}
      else feedback.textContent+=' If this email was already on the list, its existing signup has been kept. No confirmation email is sent.';
    }catch(error){feedback.classList.add('error');feedback.textContent=error.name==='TimeoutError'?'The connection timed out. Please retry; your email will not be added twice.':error.message;}
    finally{submitting=false;button.disabled=false;button.innerHTML='Join interest list <span aria-hidden="true">↗</span>';}
  });
  $('.copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('.withdrawal-link').href);$('.copy-link').textContent='Copied';}catch{$('.copy-link').textContent='Copy the link above';}});

  let map=null,libraryPromise=null;
  function library(){if(window.maplibregl)return Promise.resolve();if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css';document.head.append(css);const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js';const timeout=setTimeout(()=>reject(Error('The map is taking too long to load. Close and try again.')),18000);script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);reject(Error('The map could not load. Close and try again.'));};document.head.append(script);}).catch(error=>{libraryPromise=null;throw error;});return libraryPromise;}
  let terrainRequest=0;
  async function openTerrain(t){const request=++terrainRequest;$('#terrain-title').textContent=t.name;$('.terrain-feedback').textContent='Loading satellite terrain…';terrainDialog.showModal();try{await library();if(request!==terrainRequest||!terrainDialog.open)return;
    if(map){map.jumpTo({center:t.coord,zoom:11,pitch:55,bearing:-20});map.resize();$('.terrain-feedback').textContent='Drag to explore · pinch or scroll to zoom';return;}
    map=new maplibregl.Map({container:'trip-terrain',center:t.coord,zoom:11,pitch:55,bearing:-20,maxPitch:75,cooperativeGestures:true,attributionControl:{compact:true},style:{version:8,sources:{satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:17,attribution:'Imagery © Esri, Maxar, Earthstar Geographics'},terrain:{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:13,attribution:'Terrain: Mapzen / AWS'}},layers:[{id:'base',type:'background',paint:{'background-color':'#203630'}},{id:'satellite',type:'raster',source:'satellite'}],terrain:{source:'terrain',exaggeration:1.15}}});
    map.addControl(new maplibregl.NavigationControl(),'top-right');map.on('load',()=>{$('.terrain-feedback').textContent='Drag to explore · pinch or scroll to zoom';});map.on('error',()=>{$('.terrain-feedback').textContent='Some map imagery is unavailable. You can still explore the trip details.';});new ResizeObserver(()=>map?.resize()).observe($('#trip-terrain'));
  }catch(error){$('.terrain-feedback').textContent=error.message;}}
  terrainDialog.addEventListener('close',()=>{terrainRequest++;map?.stop();});
  fetch('data/adventures.json?v=20260928-4').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{trips=data.trips;render();const id=decodeURIComponent(location.hash.slice(1));const target=trips.find(t=>t.id===id);if(target){document.getElementById(id).open=true;document.getElementById(id).scrollIntoView();}}).catch(()=>{$('#trip-list').innerHTML='<p class="loading-note">The calendar couldn’t load. <button type="button" class="text-button" id="retry-calendar">Try again</button></p>';$('#retry-calendar').addEventListener('click',()=>location.reload());});
})();
