// A camera at the player's location records ordinary city updates in the review server.
(() => {
 const bar = document.createElement('div');
 bar.style.cssText = 'position:fixed;bottom:52px;right:8px;z-index:995;background:#14202b;padding:5px;color:white;font:12px system-ui';
 const status = document.createElement('span');
 const labels = {work:'Film shift', talk:'Film conversation', recovery:'Film recovery', detail:'Portrait frame'};
 let busy = false;
 async function film(mode) {
  if (busy) return;
  const agent = window.asphaltAgent;
  if (state!=='play' || !agent?.paused || $('sound').textContent.trim()!=='Sound off') throw Error('Use paused agent gameplay with Sound off');
  const resident = () => agent.run({op:'world',group:'people',radius:16,limit:150}).rows.find(r=>r.personId==='AH-R0001');
  if (!resident()) throw Error('Stand near Ida in the Wash House first');
  busy=true;
  const oldVisible=player.c.root.visible;
  const lens=camera.fov;
  const viewport=renderer.getSize(new THREE.Vector2());
  const pr=renderer.getPixelRatio();
  const copy=document.createElement('canvas');copy.width=768;copy.height=576;
  const image=copy.getContext('2d');
  let count=0;
  const total=mode==='detail'?1:mode==='talk'?48:mode==='recovery'?60:180;
  try {
   if(mode==='talk'||mode==='recovery') agent.run({op:'act',action:'interact'});
   renderer.setPixelRatio(1);renderer.setSize(768,576,false);
   camera.aspect=4/3;postResize(768,576);
   for(let i=1;i<=total;i++) {
    if(mode!=='detail') for(let k=0;k<2;k++) step(1/30,{forward:0,turn:0,fire:false,sprint:false});
    player.c.root.visible=false;
    const model=resident();
    if(!model) throw Error('Resident is out of view');
    const at=model.position;
    camera.position.set(player.pos.x,player.pos.y+1.55,player.pos.z);
    const distance=Math.max(.6,Math.hypot(at.x-player.pos.x,at.z-player.pos.z));
    const close=mode==='detail';
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan((close?.43:1.25)/distance));
    camera.lookAt(at.x,at.y+(close?1.58:1.0),at.z);
    if(mode==='recovery') {
     const root=scene.getObjectByName('Ida Mercer | Wash House');
     const points=['head','pelvis','hand_l','hand_r','foot_l','foot_r'].map(n=>root.getObjectByName(n).getWorldPosition(new V3()));
     const bounds=new THREE.Box3().setFromPoints(points);
     const center=bounds.getCenter(new V3());
     const yaw=model.yaw;
     camera.position.set(center.x-2.2*Math.cos(yaw)+.7*Math.sin(yaw),at.y+1.02,center.z+2.2*Math.sin(yaw)+.7*Math.cos(yaw));
     camera.fov=52;
     camera.lookAt(center.x,center.y+.08,center.z);
    }
    camera.updateProjectionMatrix();
    renderFrame(time);
    image.drawImage(canvas,0,0,768,576);
    const speech=$('toast').textContent;
    if((mode==='talk'||mode==='recovery') && toastT>0 && speech.startsWith('Ida')) {
     image.font='17px system-ui';image.textAlign='center';image.fillStyle='rgba(13,18,23,.82)';
     image.fillRect(12,527,744,38);image.fillStyle='white';
     image.fillText(speech,384,553,720);
    }
    const blob=await new Promise(resolve=>copy.toBlob(resolve,'image/jpeg',.91));
    const result=await fetch('/__frames/'+mode+'/'+String(i).padStart(4,'0'),{method:'POST',body:blob});
    if(!result.ok) throw Error('Frame write failed '+result.status);
    count=i;status.textContent=' '+i+' / '+total;
   }
  } finally {
   player.c.root.visible=oldVisible;
   renderer.setPixelRatio(pr);renderer.setSize(viewport.x,viewport.y,false);camera.fov=lens;
   resize();camInit=false;
   busy=false;
  }
  status.textContent=' Saved '+count+' frames';
 }
 for(const [key,label] of Object.entries(labels)) {
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.onclick=()=>film(key).catch(e=>{status.textContent=' '+e.message;});
  bar.append(button);
 }
 bar.append(status);
 document.body.append(bar);
})();
