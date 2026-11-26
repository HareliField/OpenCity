// A camera at the player's location records ordinary city updates in the review server.
(() => {
 const bar = document.createElement('div');
 bar.style.cssText = 'position:fixed;bottom:52px;right:8px;z-index:995;background:#14202b;padding:5px;color:white;font:12px system-ui';
 const status = document.createElement('span');
 const labels = {work:'Film shift', talk:'Film conversation', recovery:'Film recovery', detail:'Portrait frame', standing:'Standing frame'};
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
  const standing=mode==='standing',w=standing?1024:768,h=standing?1536:576;
  const copy=document.createElement('canvas');copy.width=w;copy.height=h;
  const image=copy.getContext('2d');
  let count=0;
  const total=mode==='detail'||standing?1:mode==='talk'?48:mode==='recovery'?60:180;
  try {
   if(mode==='recovery'&&resident().activity!=='down')throw Error('Wait until Ida is down and HELP IDA UP is available.');
   if(mode==='talk'||mode==='recovery'){
    agent.run({op:'act',action:'interact'});
    const activity=resident().activity;
    if(mode==='recovery'&&activity!=='Recover')throw Error('Move within reach of Ida before recording recovery.');
    if(mode==='talk'&&!['Talk','SetDown','Laundry','PickUp','Carry'].includes(activity))throw Error('Move within speaking distance of Ida.');
   }
   renderer.setPixelRatio(1);renderer.setSize(w,h,false);
   camera.aspect=w/h;postResize(w,h);
   for(let i=1;i<=total;i++) {
    if(mode!=='detail'&&!standing) for(let k=0;k<2;k++) step(1/30,{forward:0,turn:0,fire:false,sprint:false});
    player.c.root.visible=false;
    const model=resident();
    if(!model) throw Error('Resident is out of view');
    const at=model.position;
    camera.position.set(player.pos.x,player.pos.y+1.55,player.pos.z);
    const distance=Math.max(.6,Math.hypot(at.x-player.pos.x,at.z-player.pos.z));
    const close=mode==='detail';
    const halfHeight=close?.43:mode==='talk'?.71:1.25;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(halfHeight/distance));
    camera.lookAt(at.x,at.y+(close?1.58:mode==='talk'?1.34:1.0),at.z);
    if(standing){
     if(model.activity!=='Idle')throw Error('Capture the standing frame while Ida is at rest.');
     const figure=scene.getObjectByName('Ida Mercer | Wash House').children[0],v=new V3(),box=new THREE.Box3();
     figure.updateWorldMatrix(true,true);
     figure.traverseVisible(n=>{
      if(!n.isMesh||!n.geometry.attributes.position)return;
      const verts=n.geometry.attributes.position;
      for(let k=0;k<verts.count;k+=2){
       if(n.isSkinnedMesh)n.boneTransform(k,v);else v.fromBufferAttribute(verts,k);
       box.expandByPoint(v.applyMatrix4(n.matrixWorld));
      }
     });
     const center=box.getCenter(new V3()),height=box.max.y-box.min.y,distance=2.93;
     // Look over the low foreground basket while keeping both shoe soles inside the portrait.
     camera.position.copy(center).add(new V3(Math.sin(model.yaw)*distance,.45,Math.cos(model.yaw)*distance));
     camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(height*.556/distance));camera.lookAt(center);
    }
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
    image.drawImage(canvas,0,0,w,h);
    const speech=$('toast').textContent;
    if((mode==='talk'||mode==='recovery') && toastT>0 && speech.startsWith('Ida')) {
     image.font='17px system-ui';image.textAlign='center';image.fillStyle='rgba(13,18,23,.82)';
     image.fillRect(12,527,744,38);image.fillStyle='white';
     image.fillText(speech,384,553,720);
    }
    const blob=await new Promise(resolve=>copy.toBlob(resolve,'image/jpeg',standing?.96:.91));
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
 const contact=document.createElement('button');contact.type='button';contact.textContent='Test standing contact';
 contact.onclick=()=>{
  try{
   if(state!=='play'||!window.asphaltAgent?.paused||$('sound').textContent.trim()!=='Sound off')throw Error('Use paused agent gameplay with Sound off');
   const root=scene.getObjectByName('Ida Mercer | Wash House'),row=WashHouse.record()[0];
   if(!root||row.activity!=='Idle')throw Error('Check the loaded, standing resident.');
   const forward=new V3(Math.sin(row.yaw),0,Math.cos(row.yaw)),side=new V3(forward.z,0,-forward.x);
   const names=['head','neck_01','spine_03','pelvis',...['l','r'].flatMap(s=>['upperarm','lowerarm','hand','thumb_03','index_03','middle_03','ring_03','pinky_03','thigh','calf','foot','ball'].map(b=>b+'_'+s))];
   let rays=0;
   for(const name of names)for(const axis of [forward,side]){
    const p=root.getObjectByName(name).getWorldPosition(new V3()),start=p.clone().addScaledVector(axis,-.65),end=p.clone().addScaledVector(axis,.65);
    const resident=WashHouse.ray(start,end.clone().sub(start),0);
    const world=rayWorld(start.x,start.z,end.x,end.z,start.y,end.y,0,true);
    if(resident<0||resident>.5001||world>resident+.0001)throw Error('Open contact at '+name);
    rays++;
   }
   const pelvis=root.getObjectByName('pelvis').getWorldPosition(new V3());
   const sweeps=[['back',forward],['left',side],['front',forward.clone().negate()],['right',side.clone().negate()]];
   const xz=p=>p.x.toFixed(2)+','+p.z.toFixed(2),failures=[];
   for(const [direction,d] of sweeps){
    const from=pelvis.clone().addScaledVector(d,-1.5),to=from.clone().addScaledVector(d,3.45);to.y=row.position.y;
    const motion={startX:from.x,startZ:from.z,dx:d.x*3.45,dz:d.z*3.45,dt:.5};
    const local=to.clone(),world=to.clone(),height=groundY(to.x,to.z,to.y);
    const bodyHit=WashHouse.push(local,.36,height,motion),worldHit=collideWorld(world,.36,motion);
    const intended=WashHouse.movementClearance(from,to,.36,height);
    const solo=WashHouse.movementClearance(from,local,.36,height),city=WashHouse.movementClearance(from,world,.36,height);
    // A washer can deflect the player around her and past the pelvis plane.
    // Test the entire resolved travel segment against every live body sphere.
    if(intended.distance>-.50||!bodyHit||!worldHit||solo.distance<-.004||city.distance<-.004){
     failures.push(direction+' '+xz(from)+'→'+xz(to)+'; floor '+height.toFixed(2)+'; Ida '+Number(!!bodyHit)+'@'+xz(local)+' '+solo.distance.toFixed(3)+'m '+solo.joint+'; city '+Number(!!worldHit)+'@'+xz(world)+' '+city.distance.toFixed(3)+'m '+city.joint);
    }
   }
   if(failures.length)throw Error('Open sprint path ['+xz(pelvis)+'] '+failures.join(' / '));
   status.textContent=' '+rays+' rays including both hands; 4 direct sprint impacts blocked; 4 city sprint paths clear of Ida';
  }catch(e){status.textContent=' '+e.message;}
 };
 bar.append(contact);
 bar.append(status);
 document.body.append(bar);
})();
