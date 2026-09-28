/* Original synthetic demo routes, not race GPX or verified hiking trails. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  const small = matchMedia('(max-width:700px)');
  const video = $('.hero-video');
  const filmButton = $('.film-toggle');
  let heroVisible = false, userPaused = false, manualVideo = false;
  const automaticVideo = () => !small.matches && !reduce.matches && !navigator.connection?.saveData;
  function filmLabel() {
    filmButton.innerHTML = `<span aria-hidden="true">${video.paused?'▷':'Ⅱ'}</span>`;
    const label=video.paused?'Play mountain footage':'Pause mountain footage';
    filmButton.setAttribute('aria-label',label);filmButton.title=label;
  }
  async function playFilm() {
    if(!video.src)video.src='https://videos.pexels.com/video-files/4046338/4046338-hd_1920_1080_25fps.mp4';
    try { await video.play(); $('.film-status').textContent=''; } catch { filmLabel(); }
  }
  video.addEventListener('playing',()=>{video.classList.add('playing');filmLabel();});
  video.addEventListener('pause',filmLabel);
  video.addEventListener('error',()=>{video.classList.remove('playing');$('.film-status').textContent='Film unavailable. Showing the photograph.';filmLabel();});
  filmButton.addEventListener('click',()=>{if(video.paused){userPaused=false;manualVideo=true;playFilm();}else{userPaused=true;video.pause();}});
  new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;if(!heroVisible)video.pause();else if(!document.hidden&&!userPaused&&(automaticVideo()||manualVideo))playFilm();},{threshold:.2}).observe($('.hero'));

  const dialog=$('dialog');
  const enquiryEmail=(window.FAST_CONFIG?.enquiryEmail||'').trim();
  if(enquiryEmail){
    $('.preview-note').textContent='Opens your email app. Nothing is stored on this website.';
    $('form').hidden=false;
  }
  $('.offer-intro .enquire').addEventListener('click',()=>dialog.showModal());
  $('.close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  $('form').addEventListener('submit',event=>{
    event.preventDefault();if(!enquiryEmail)return;
    const fields=new FormData(event.currentTarget);
    const message=`Name: ${fields.get('name')}\nEmail: ${fields.get('email')}\n\n${fields.get('message')}`;
    window.location.href=`mailto:${enquiryEmail}?subject=${encodeURIComponent('Private adventure enquiry')}&body=${encodeURIComponent(message)}`;
    $('.enquiry-status').textContent='Send the draft from your email app to complete your enquiry.';
  });
  dialog.addEventListener('close',()=>{$('form').reset();$('.enquiry-status').textContent='';});

  let routes=null,place='alps',map=null,ready=false,loading=false,turn=0,frame=0,flight=null,km=0;
  const rad=n=>n*Math.PI/180;
  const current=()=>routes[place];
  function status(text){$('.terrain-status').textContent=text;$('.terrain-status').hidden=!text;}
  function flightLabel(){
    $('.fly-route').innerHTML=flight?'Pause <span aria-hidden="true">Ⅱ</span>':'Fly route <span aria-hidden="true">▷</span>';
    $('.fly-route').setAttribute('aria-pressed',String(Boolean(flight)));
  }
  function stop(){turn++;cancelAnimationFrame(frame);flight=null;map?.stop();flightLabel();}
  function point(distance){
    const points=current().points;let low=0,high=points.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(points[mid][2]<=distance)low=mid;else high=mid;}
    const a=points[low],b=points[high],f=Math.max(0,Math.min(1,(distance-a[2])/(b[2]-a[2]||1)));
    return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
  }
  function bearing(a,b){
    const lat1=rad(a[1]),lat2=rad(b[1]),dlon=rad(b[0]-a[0]);
    return (Math.atan2(Math.sin(dlon)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dlon))*180/Math.PI+360)%360;
  }
  function elevation(p){const value=map.queryTerrainElevation(p);return Number.isFinite(value)?value:current().fallbackAltitude*1.15;}
  function camera(p,heading,altitude){
    const distance=small.matches?5.6:4.3,delta=distance/6371.0088,br=rad(heading+180),lat=rad(p[1]);
    const y=Math.asin(Math.sin(lat)*Math.cos(delta)+Math.cos(lat)*Math.sin(delta)*Math.cos(br));
    const x=rad(p[0])+Math.atan2(Math.sin(br)*Math.sin(delta)*Math.cos(lat),Math.cos(delta)-Math.sin(lat)*Math.sin(y));
    const eye=[x*180/Math.PI,y*180/Math.PI];
    // Terrain can rise behind the point of interest; keep the camera above it.
    const eyeAltitude=Math.max(altitude+distance*1000*.7,elevation(eye)+900);
    return map.calculateCameraOptionsFromTo(new maplibregl.LngLat(...eye),eyeAltitude,new maplibregl.LngLat(...p),altitude);
  }
  function cursor(){
    const p=point(km);$('.route-position').textContent=km.toFixed(1)+' km';
    map.getSource('demo-position').setData({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}});return p;
  }
  function drawRoute(){
    const route=current(),coords=route.points.map(p=>p.slice(0,2));km=0;
    map.getSource('demo-route').setData({type:'Feature',properties:{illustrative:true},geometry:{type:'LineString',coordinates:coords}});
    $('.demo-label').textContent=`Demo route · ${route.distance.toFixed(1)} km`;
    $('#terrain').setAttribute('aria-label',`${route.name}, an illustrative ${route.distance.toFixed(1)} kilometre concept over 3D terrain. Not for navigation.`);
    cursor();
  }
  function overview(duration=1200){
    if(!ready)return;stop();
    map.fitBounds(current().bounds,{padding:small.matches?{top:55,bottom:85,left:25,right:25}:{top:65,bottom:80,left:75,right:75},pitch:50,bearing:0,maxZoom:11.8,duration:reduce.matches?0:duration});
  }
  function visit(next){
    stop();place=next;
    document.querySelectorAll('[data-place]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.place===place)));
    if(!ready)return;
    drawRoute();
    if(reduce.matches){overview(0);return;}
    const token=turn;
    map.once('moveend',()=>{if(token===turn)overview(2200);});
    map.easeTo({zoom:Math.min(map.getZoom(),4),pitch:0,duration:700});
  }
  document.querySelectorAll('[data-place]').forEach(button=>button.addEventListener('click',()=>visit(button.dataset.place)));
  function library(){
    if(window.maplibregl)return Promise.resolve();
    if(!document.querySelector('[data-map-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css';css.dataset.mapStyle='';document.head.append(css);}
    return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js';const timer=setTimeout(()=>{script.remove();reject(Error('Timeout'));},18000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Unavailable'));};document.head.append(script);});
  }
  function terrainProtocol(){
    if(typeof OffscreenCanvas==='undefined'||typeof createImageBitmap!=='function')return 'https';
    maplibregl.addProtocol('fast-sea',async(params,controller)=>{
      const response=await fetch(params.url.replace('fast-sea://','https://'),{signal:controller.signal});if(!response.ok)throw Error('Terrain unavailable');
      const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]<128){pixels.data[i]=128;pixels.data[i+1]=0;pixels.data[i+2]=0;}
      ctx.putImageData(pixels,0,0);return {data:await(await canvas.convertToBlob({type:'image/png'})).arrayBuffer()};
    });return 'fast-sea';
  }
  async function initialise(){
    if(ready||loading)return;loading=true;$('.load-terrain').disabled=true;$('.load-terrain').textContent='Loading terrain…';
    try {
      const [,data]=await Promise.all([library(),fetch('data/demo-routes.json?v=20260928-1').then(r=>{if(!r.ok)throw Error('Demo routes unavailable');return r.json();})]);
      routes=data.routes;const protocol=terrainProtocol();
      map=new maplibregl.Map({container:'terrain',center:current().center,zoom:10.5,pitch:50,maxPitch:75,minZoom:2,maxZoom:16,cooperativeGestures:true,attributionControl:{compact:true},style:{version:8,sources:{
        satellite:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:17,attribution:'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics'},
        terrain:{type:'raster-dem',tiles:[`${protocol}://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`],encoding:'terrarium',tileSize:256,maxzoom:13,attribution:'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen / AWS</a>'}},
        layers:[{id:'base',type:'background',paint:{'background-color':'#233e35'}},{id:'satellite',type:'raster',source:'satellite',paint:{'raster-saturation':-.14}}],terrain:{source:'terrain',exaggeration:1.15},sky:{'sky-color':'#a9c3cc','horizon-color':'#e4eeee','fog-color':'#d7e5e5','sky-horizon-blend':.7,'horizon-fog-blend':.6,'fog-ground-blend':.55}}});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Map timeout')),22000);map.once('load',()=>{clearTimeout(timer);resolve();});});
      const empty={type:'FeatureCollection',features:[]};
      map.addSource('demo-route',{type:'geojson',data:empty});
      map.addSource('demo-position',{type:'geojson',data:empty});
      map.addLayer({id:'demo-shadow',type:'line',source:'demo-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#2a241c','line-width':6.5,'line-opacity':.7}});
      map.addLayer({id:'demo-line',type:'line',source:'demo-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffb375','line-width':3.5}});
      map.addLayer({id:'demo-dot',type:'circle',source:'demo-position',paint:{'circle-radius':5,'circle-color':'#fff4de','circle-stroke-color':'#253a2f','circle-stroke-width':2}});
      ready=true;loading=false;drawRoute();overview(0);
      map.addControl(new maplibregl.NavigationControl({visualizePitch:true,showZoom:false}),'top-right');
      map.on('dragstart',stop);for(const event of ['zoomstart','rotatestart','pitchstart'])map.on(event,e=>{if(e.originalEvent)stop();});
      map.on('error',e=>{if(e.sourceId)status('Some imagery is unavailable.');});map.on('idle',()=>{if(map.areTilesLoaded())status('');});
      map.getCanvas().addEventListener('webglcontextlost',()=>{stop();status('Reload the page to restore the 3D view.');});
      $('.terrain-cover').hidden=true;$('.route-controls').hidden=false;$('.demo-label').hidden=false;
    } catch {
      map?.remove();map=null;ready=false;loading=false;$('.load-terrain').disabled=false;$('.load-terrain').textContent='Retry 3D view ↗';$('.terrain-cover>span').textContent='The map couldn’t load. Try again.';
    }
  }
  $('.load-terrain').addEventListener('click',initialise);
  $('.fly-route').addEventListener('click',()=>{
    if(flight){stop();return;}if(!ready)return;
    stop();if(km>=current().distance-.01)km=0;
    const p=cursor(),heading=bearing(p,point(Math.min(km+1.2,current().distance)));
    const f=flight={p,heading,altitude:elevation(p),last:0};flightLabel();
    const tick=now=>{
      if(flight!==f)return;
      const dt=Math.min(.05,(now-f.last)/1000);f.last=now;
      km=Math.min(current().distance,km+current().distance/110*dt);
      const target=cursor(),ahead=point(Math.min(km+1.2,current().distance));
      const desired=bearing(target,ahead),delta=((desired-f.heading+540)%360)-180;
      f.heading=(f.heading+delta*(1-Math.exp(-dt*.9))+360)%360;
      f.p=f.p.map((v,i)=>v+(target[i]-v)*(1-Math.exp(-dt*3.5)));
      f.altitude+=(elevation(target)-f.altitude)*(1-Math.exp(-dt*1.6));
      map.jumpTo(camera(f.p,f.heading,f.altitude));
      if(km>=current().distance){stop();return;}frame=requestAnimationFrame(tick);
    };
    const begin=()=>{if(flight!==f)return;f.last=performance.now();frame=requestAnimationFrame(tick);};
    if(reduce.matches){map.jumpTo(camera(p,heading,f.altitude));begin();}
    else {map.once('moveend',begin);map.easeTo({...camera(p,heading,f.altitude),duration:1300});}
  });
  $('.route-overview').addEventListener('click',()=>overview());
  new IntersectionObserver(([entry])=>{if(!entry.isIntersecting){stop();return;}if(!small.matches&&!navigator.connection?.saveData)initialise();},{threshold:.15}).observe($('.terrain-shell'));
  new ResizeObserver(()=>map?.resize()).observe($('.terrain-shell'));
  function help(){ $('.map-help').textContent=small.matches?'Two fingers to move · Pinch to zoom':'Drag to explore · Ctrl/⌘ + scroll to zoom'; }
  small.addEventListener('change',help);help();
  reduce.addEventListener('change',()=>{stop();if(reduce.matches){manualVideo=false;video.pause();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();video.pause();}else if(heroVisible&&!userPaused&&(automaticVideo()||manualVideo))playFilm();});
})();
