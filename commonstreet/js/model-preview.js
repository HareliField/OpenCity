(async function previewScenery(){
 const input=document.getElementById('model'),status=document.getElementById('status');
 const id=new URLSearchParams(location.search).get('model')??input.value;
 input.value=id;
 if(!sceneryId(id)){
  status.textContent='Enter a model ID using lowercase letters, digits, and hyphens.';
  return;
 }
 const template=await requestScenery(id);
 if(!template){
  status.textContent='Could not load '+id+'. Check the model ID and its GLB export.';
  return;
 }
 const canvas=document.getElementById('preview');
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});
 }catch{
  status.textContent='This preview needs WebGL.';
  return;
 }
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputEncoding=THREE.sRGBEncoding;
 renderer.setClearColor(0x20262a);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38);
 const model=modelInstance(template,template.userData.dimensions);
 const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());
 const size=bounds.getSize(new THREE.Vector3()).toArray();
 const radius=Math.hypot(...size)/2;
 scene.add(model,new THREE.HemisphereLight(0xffffff,0x998c78,1.25));
 const key=new THREE.DirectionalLight(0xfff2dc,1.6);
 key.position.set(-1,2,3);
 scene.add(key);
 let yaw=Math.PI/5;
 function render(){
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  const distance=radius*3.6/Math.min(1,camera.aspect);
  camera.near=distance/100;
  camera.far=distance*3;
  camera.position.set(center.x+Math.sin(yaw)*distance,center.y+.30*distance,center.z+Math.cos(yaw)*distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  renderer.render(scene,camera);
 }
 for(const [button,turn] of [['left',-1],['right',1]]){
  const control=document.getElementById(button);
  control.disabled=false;
  control.addEventListener('click',()=>{yaw+=turn*Math.PI/6;render();});
 }
 new ResizeObserver(render).observe(canvas);
 render();
 status.textContent=id+' · '+size.map(n=>n.toFixed(3)).join(' × ')+' m';
})();
