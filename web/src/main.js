import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);
const viewer = $('viewer'), canvas = $('canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { loaded:false, mode:'story', material:'original', color:'blue', hotspots:false, selected:null, manualExplosion:null, chapter:0, explosion:0, error:null, engineering:false, selectedGroup:null, isolated:false, hiddenGroups:[], grid:true, view:'iso' };
const colorNames = {blue:'深蓝',graphite:'石墨',teal:'青绿'};
const colors = {blue:0x243a8c,graphite:0x45484e,teal:0x397b7b};
const materialNames = {original:'原件材质',metal:'金属实验',clay:'技术白模'};
const chapterNames = ['整体 · 组装状态','细节 · 材料与侧扣','连接 · 锁紧机构','结构 · 分层展开','探索 · 自定义视角'];
const partInfo = {
 cover:{group:'04',index:'01 / SERVICE COVER',title:'罩体与侧扣',description:'侧部为有背壁的盲凹槽，罩体下方留有容纳存水弯的空间。外层金属板与侧扣按参考图恢复，下方保留 EPS 背衬；金属牌号与局部厚度未确认。',material:'金属外板与侧扣 / EPS 背衬',point:[.202,.075,.056]},
 joint:{group:'07',index:'02 / LOCKING JOINT',title:'锁紧环与配合',description:'蓝色环内设置入口槽和转入槽，与承口卡耳配合；密封圈座与径向螺钉一起呈现连接层次。隐藏配合为演示性推导结构。',material:'深蓝聚合物 · 树脂牌号未确认',point:[0,.069,.038]},
 pipe:{group:'05',index:'03 / DRAINAGE',title:'DN50 排水出口',description:'水平出口的外径为 50 mm，轴线距底部 42 mm。管口与壁厚均为真实几何，可从不同角度观察。',material:'PE-HD · 产品资料确认',point:[.285,.045,.021]},
 eps:{group:'02',index:'04 / ACOUSTIC BASE',title:'EPS 支撑底座',description:'颗粒状 EPS 底座承托排水构件，并用于声音隔离。底部另设 20 mm 垫板，在爆炸视图中可以清晰分辨。',material:'EPS · 产品资料确认',point:[.055,.045,.065]},
 flange:{group:'09',index:'05 / INLET FLANGE',title:'入口与连接法兰',description:'可调入口连接上部法兰。模型选择 170 mm 入口高度，位于图纸 90–220 mm 的可调范围内。',material:'透明罩采用塑料光学近似',point:[0,.17,.09]}
};
let scene, renderer, camera, controls, model, stageMesh, engineeringGrid;
let orthoExtent=.25;const groupBounds=new Map();
const groups = new Map(), meshes=[], markers=[];
const originals = new Map();
const raycaster = new THREE.Raycaster();
let width=1,height=1, userDragging=false, desiredTarget=new THREE.Vector3(), desiredCamera=new THREE.Vector3();
const keyframes = [
 {camera:[.43,.30,.52],target:[.018,.10,0],explode:0,joint:0},
 {camera:[.32,.22,.37],target:[.09,.08,.015],explode:0,joint:0},
 {camera:[.14,.25,.34],target:[-.075,.10,0],explode:0,joint:1},
 {camera:[.52,.37,.63],target:[.025,.17,0],explode:1,joint:0},
 {camera:[.43,.30,.52],target:[.018,.10,0],explode:0,joint:0},
];
const chapters=[...document.querySelectorAll('.chapter')];
const smooth=(x)=>x*x*(3-2*x);
const clamp=THREE.MathUtils.clamp;
let currentJoint=0, lastTime=0, frames=0, triangleCount=0;

function init(){
 try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
 } catch(e){fail('当前浏览器暂不支持三维渲染。请使用支持 WebGL 的浏览器重新打开。',e);return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(34,1,.005,10);
 camera.position.fromArray(keyframes[0].camera);
 controls=new OrbitControls(camera,canvas);controls.target.fromArray(keyframes[0].target);
 controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;controls.enabled=false;
 controls.minDistance=.19;controls.maxDistance=1.6;controls.maxPolarAngle=Math.PI*.88;
 controls.addEventListener('start',()=>{userDragging=true;});controls.addEventListener('end',()=>{userDragging=false;});
 const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.72;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xdbe5fa,0x16191f,.85));
 function light(c,i,p){const l=new THREE.DirectionalLight(c,i);l.position.set(...p);scene.add(l);return l;}
 const key=light(0xf8faff,2,[.3,.7,.4]);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.near=.01;key.shadow.camera.far=3;key.shadow.camera.left=-.55;key.shadow.camera.right=.55;key.shadow.camera.top=.55;key.shadow.camera.bottom=-.55;key.shadow.bias=-.0001;key.shadow.normalBias=.0003;
 light(0xa5bdff,1.7,[-.4,.2,-.3]);light(0xffffff,.7,[.5,.1,-.2]);
 const stage=new THREE.Mesh(new THREE.CylinderGeometry(.24,.245,.014,96),new THREE.MeshStandardMaterial({color:0x06070a,roughness:.85,metalness:0}));stage.position.set(.03,-.019,0);stage.receiveShadow=true;scene.add(stage);stageMesh=stage;
 engineeringGrid=new THREE.GridHelper(1,40,0x35455d,0x18212f);engineeringGrid.position.y=-.025;engineeringGrid.visible=false;scene.add(engineeringGrid);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.ShadowMaterial({opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.027;floor.receiveShadow=true;scene.add(floor);
 new ResizeObserver(resize).observe(viewer);resize();
 const loader=new GLTFLoader();
 loader.load(`${import.meta.env.BASE_URL}models/cleanline.glb?v=local-arc-bridge-20261019`,(gltf)=>{
  model=gltf.scene;model.position.x=-.105;scene.add(model);
  model.traverse((o)=>{
   if (/^\d{2}/.test(o.name)&&o.userData.explosion_mm){groups.set(o.name.slice(0,2),o);o.userData.basePosition=o.position.clone();o.userData.baseQuaternion=o.quaternion.clone();}
   if(o.isMesh){
    o.material=o.material.clone();o.castShadow=true;o.receiveShadow=true;
    if(o.material.transmission>0){o.castShadow=false;o.material.thickness=.0015;o.material.envMapIntensity=.8;}
    if(o.material.map)o.material.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    originals.set(o,{color:o.material.color.clone(),metalness:o.material.metalness,roughness:o.material.roughness,transmission:o.material.transmission,opacity:o.material.opacity,map:o.material.map,emissive:o.material.emissive.clone()});
    meshes.push(o);triangleCount+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
   }
  });
  if(groups.size!==10){console.warn('Expected ten component groups, found',groups.size);}
  model.updateMatrixWorld(true);for(const [id,g] of groups){groupBounds.set(id,new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()));}
  setupHotspots();setupTree();state.loaded=true;document.body.dataset.modelLoaded='true';$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,650);applyMaterial();updateUI();
 },(e)=>{if(e.total)$('load-percent').textContent=` · ${Math.round(e.loaded/e.total*100)}%`;},(e)=>fail('三维资源加载失败。请刷新页面重试。',e));
 renderer.setAnimationLoop(animate);
}
function fail(message,error){state.error=String(error);$('loading').innerHTML=`<p>${message}</p><button class="primary" onclick="location.reload()">重新加载</button>`;console.error(error);}
function resize(){width=viewer.clientWidth;height=viewer.clientHeight;if(!renderer)return;renderer.setSize(width,height,false);if(camera.isOrthographicCamera){camera.left=-orthoExtent*width/height;camera.right=orthoExtent*width/height;camera.top=orthoExtent;camera.bottom=-orthoExtent;}else camera.aspect=width/height;camera.updateProjectionMatrix();}
function storyPosition(){
 const y=scrollY;let i=0;
 while(i<chapters.length-2&&y>chapters[i+1].offsetTop)i++;
 const next=chapters[i+1];const t=clamp((y-chapters[i].offsetTop)/(next.offsetTop-chapters[i].offsetTop),0,1);
 return {i,t:smooth(t)};
}
function animate(time){
 const dt=Math.min((time-lastTime)/1000||.016,.05);lastTime=time;
 const {i,t}=storyPosition();const a=keyframes[i],b=keyframes[i+1];
 const workRect=$('explore').getBoundingClientRect();
 const inEngineering=workRect.top<innerHeight*.25&&workRect.bottom>innerHeight*.22;
 if(state.loaded&&inEngineering!==state.engineering)enterEngineering(inEngineering);
 const newChapter=t>.5?i+1:i;
 if(newChapter!==state.chapter){state.chapter=newChapter;updateUI();}
 const ending=$('specs').getBoundingClientRect().top<height*.36;
 document.body.classList.toggle('is-ending',ending);
 $('progress').style.width=`${clamp(scrollY/(document.documentElement.scrollHeight-innerHeight),0,1)*100}%`;
 desiredCamera.fromArray(a.camera).lerp(new THREE.Vector3(...b.camera),t);desiredTarget.fromArray(a.target).lerp(new THREE.Vector3(...b.target),t);
 let targetExplode=state.manualExplosion??THREE.MathUtils.lerp(a.explode,b.explode,t);
 let targetJoint=state.manualExplosion===null?THREE.MathUtils.lerp(a.joint,b.joint,t):0;
 if(state.manualExplosion!==null&&state.manualExplosion>.05){desiredCamera.fromArray(keyframes[3].camera);desiredTarget.fromArray(keyframes[3].target);}
 if(width>=600)desiredCamera.sub(desiredTarget).multiplyScalar(1.18).add(desiredTarget);
 if(width<600){
  const scale=width/height<.85?1.25:1.07;
  desiredCamera.sub(desiredTarget).multiplyScalar(scale).add(desiredTarget);
 }
 const alpha=reduced?1:1-Math.exp(-dt*5);
 state.explosion=THREE.MathUtils.lerp(state.explosion,targetExplode,alpha);currentJoint=THREE.MathUtils.lerp(currentJoint,targetJoint,alpha);
 if(state.mode==='story'&&!state.engineering){
  camera.position.lerp(desiredCamera,alpha);controls.target.lerp(desiredTarget,alpha);camera.lookAt(controls.target);
 }else controls.update();
 for(const [id,g] of groups){
  g.visible=!state.hiddenGroups.includes(id)&&(!state.isolated||!state.selectedGroup||id===state.selectedGroup);
  const d=g.userData.explosion_mm||[0,0,0];g.position.copy(g.userData.basePosition).add(new THREE.Vector3(d[0],d[2],-d[1]).multiplyScalar(state.explosion/1000));
  const heights={'06':12,'07':22,'08':50,'09':50,'10':50};g.position.y+=(heights[id]||0)*currentJoint/1000;
  g.quaternion.copy(g.userData.baseQuaternion);if(id==='07')g.rotateY(currentJoint*Math.PI/10);
 }
 if(model)model.updateMatrixWorld(true);
 for(const marker of markers){
  const p=marker.anchor.getWorldPosition(new THREE.Vector3()).project(camera);
  const show=state.hotspots&&groups.get(partInfo[marker.id].group).visible&&p.z<1&&p.z>-1&&Math.abs(p.x)<.94&&Math.abs(p.y)<.92&&!ending;
  marker.button.hidden=!show;
  if(show){marker.button.style.left=`${(p.x*.5+.5)*width}px`;marker.button.style.top=`${(-p.y*.5+.5)*height}px`;}
 }
 if(frames++%12===0){updateUI(false);}
 if(!ending&&document.visibilityState==='visible')renderer.render(scene,camera);
}
function groupId(mesh){let o=mesh;while(o){if(/^\d{2}/.test(o.name)&&o.userData.explosion_mm)return o.name.slice(0,2);o=o.parent;}return '';}
function setupHotspots(){
 for(const [id,info] of Object.entries(partInfo)){
  const g=groups.get(info.group);if(!g)continue;
  const anchor=new THREE.Object3D();anchor.position.fromArray(info.point);g.add(anchor);
  const button=document.createElement('button');button.className='hotspot';button.innerHTML='<span>＋</span>';button.setAttribute('aria-label',`查看${info.title}`);button.hidden=true;button.addEventListener('click',()=>selectPart(id));$('hotspots').append(button);markers.push({id,anchor,button});
 }
}
function selectPart(id){
 state.selected=id;const p=partInfo[id];if(state.engineering){selectGroup(p.group);return;}$('part-index').textContent=p.index;$('part-title').textContent=p.title;$('part-description').textContent=p.description;$('part-material').textContent=state.material==='original'?p.material:`当前：${materialNames[state.material]} · 外观实验，不代表原件材料`;
 $('part-panel').hidden=false;for(const m of markers)m.button.classList.toggle('selected',m.id===id);
 for(const mesh of meshes){mesh.material.emissive.copy(originals.get(mesh).emissive);if(groupId(mesh)===p.group)mesh.material.emissive.setHex(0x0d1c30);}
}
function closePart(){state.selected=null;$('part-panel').hidden=true;for(const m of markers)m.button.classList.remove('selected');for(const mesh of meshes)mesh.material.emissive.copy(originals.get(mesh).emissive);}
function applyMaterial(){
 for(const mesh of meshes){
  const orig=originals.get(mesh),m=mesh.material;const label=/label|ink/i.test(m.name)||mesh.name.startsWith('WEB_')||mesh.name.startsWith('WEB ');
  m.color.copy(orig.color);m.metalness=orig.metalness;m.roughness=orig.roughness;m.map=orig.map;
  if('transmission' in m)m.transmission=orig.transmission;
  if(state.material!=='original'&&!label){
   m.color.set(state.material==='metal'?0xa4aab3:0xc3c6cb);m.metalness=state.material==='metal'?.94:0;m.roughness=state.material==='metal'?.31:.72;m.map=null;if('transmission' in m)m.transmission=0;
  }
  if(groupId(mesh)==='07'&&/blue/i.test(m.name)){
   if(state.color!=='blue'||state.material!=='original')m.color.setHex(colors[state.color]);
  }
  m.needsUpdate=true;
 }
 if(state.selectedGroup&&state.engineering)selectGroup(state.selectedGroup);else if(state.selected)selectPart(state.selected);updateUI();
}
function updateUI(full=true){
 const pct=Math.round(state.explosion*100),opened=pct>20||currentJoint>.3;
 $('view-caption').textContent=state.mode==='orbit'?'自由观察 · 实时三维':chapterNames[state.chapter];
 $('orbit-toggle').setAttribute('aria-pressed',String(state.mode==='orbit'));
 $('orbit-toggle').lastElementChild.textContent=state.engineering?(state.mode==='orbit'?'锁定视角':'轨道旋转'):(state.mode==='orbit'?'返回叙事':'自由观察');
 $('explode-toggle').setAttribute('aria-pressed',String(opened));$('explode-toggle').lastElementChild.textContent=opened?'合拢':'爆炸';
 $('hotspot-toggle').setAttribute('aria-pressed',String(state.hotspots));
 $('explode-output').textContent=`${pct}%`;if(document.activeElement!==$('explode-range'))$('explode-range').value=pct;
 $('state-line').textContent=`${state.engineering?'工程工作台':state.mode==='orbit'?'自由观察':'滚动叙事'} · ${materialNames[state.material]} · ${colorNames[state.color]} · ${currentJoint>.3?'连接展开':pct>0?`拆分 ${pct}%`:'组装'}`;
 $('station-explode-output').textContent=`${pct}%`;if(document.activeElement!==$('station-explode'))$('station-explode').value=pct;
 $('station-material').value=state.material;
 document.querySelectorAll('.component-row').forEach(r=>r.classList.toggle('muted',!groups.get(r.dataset.group)?.visible));
 const visible=[...groups.values()].filter(g=>g.visible).length;$('visible-count').textContent=`${visible} / 10 可见`;$('station-status').textContent=state.selectedGroup?`${componentNames[state.selectedGroup]} · ${state.isolated?'已隔离':'已选中'}`:'完整装配';
 if(full){
  document.querySelectorAll('[data-material]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.material===state.material)));
  document.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===state.color)));
  $('color-label').textContent=colorNames[state.color];
  $('material-note').textContent=state.material==='original'&&state.color==='blue'?'参考图材质 · 深蓝锁紧环':`${materialNames[state.material]} · ${colorNames[state.color]}锁紧环 · 外观实验`;
 }
}
function orbit(enabled){state.mode=enabled?'orbit':'story';controls.enabled=enabled;viewer.classList.toggle('orbit',enabled);updateUI();}
function appearance(show){$('appearance-panel').hidden=!show;$('appearance-toggle').setAttribute('aria-expanded',String(show));}
function toggleHotspots(force){state.hotspots=force??!state.hotspots;if(!state.hotspots)closePart();updateUI();}
function reset(forceTop=false){if(state.engineering&&!forceTop){resetStation();return;}state.hiddenGroups=[];state.isolated=false;state.selectedGroup=null;state.manualExplosion=null;state.material='original';state.color='blue';state.hotspots=false;closePart();appearance(false);orbit(false);applyMaterial();window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});updateUI();}
$('orbit-toggle').addEventListener('click',()=>orbit(state.mode!=='orbit'));
$('explode-toggle').addEventListener('click',()=>{state.manualExplosion=state.explosion>.2||currentJoint>.3?0:1;if(state.mode==='orbit'&&state.manualExplosion){camera.position.fromArray(keyframes[3].camera);controls.target.fromArray(keyframes[3].target);if(camera.isOrthographicCamera){orthoExtent=.30;resize();}else if(width<600)camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);}updateUI();});
$('hotspot-toggle').addEventListener('click',()=>toggleHotspots());$('story-hotspots').addEventListener('click',()=>toggleHotspots(true));
$('appearance-toggle').addEventListener('click',()=>appearance($('appearance-panel').hidden));$('close-appearance').addEventListener('click',()=>appearance(false));
$('close-part').addEventListener('click',closePart);$('reset').addEventListener('click',()=>reset());$('back-top').addEventListener('click',()=>reset(true));
$('explode-range').addEventListener('input',e=>{state.manualExplosion=Number(e.target.value)/100;if(state.engineering){orthoExtent=.23+state.manualExplosion*.09;resize();}updateUI();});
document.querySelectorAll('[data-material]').forEach(b=>b.addEventListener('click',()=>{state.material=b.dataset.material;applyMaterial();}));
document.querySelectorAll('[data-color]').forEach(b=>b.addEventListener('click',()=>{state.color=b.dataset.color;applyMaterial();}));
document.querySelectorAll('.focus-part').forEach(b=>b.addEventListener('click',()=>{toggleHotspots(true);selectPart(b.dataset.part);}));

$('explore-btn').addEventListener('click',()=>{state.manualExplosion=0;orbit(true);$('explore').scrollIntoView({behavior:reduced?'instant':'smooth'});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePart();appearance(false);}});
let downPoint=null;
canvas.addEventListener('pointerdown',e=>downPoint={x:e.clientX,y:e.clientY});
canvas.addEventListener('pointerup',e=>{
 if(!downPoint||Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y)>6||(!state.hotspots&&!state.engineering))return;
 const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
 const hit=raycaster.intersectObjects(meshes.filter(m=>groups.get(groupId(m))?.visible),false)[0];if(hit){const id=groupId(hit.object);if(state.engineering){selectGroup(id);return;}const entry=Object.entries(partInfo).find(([,info])=>info.group===id);if(entry)selectPart(entry[0]);}
});

const componentNames={'01':'20 mm 垫板','02':'EPS 支撑底座','03':'排水壳体与承口','04':'盖板、背衬与侧扣','05':'DN50 排水出口','06':'密封圈','07':'蓝色锁紧环','08':'可调入口立管','09':'连接法兰','10':'施工保护罩'};
const componentMaterials={'01':'EPS · 颗粒泡沫','02':'EPS · 声音隔离','03':'PE-HD · 深灰聚合物','04':'金属外板与侧扣 + EPS 背衬','05':'PE-HD · 外径 50 mm','06':'橡胶外观 · 牌号未确认','07':'深蓝聚合物 · 配合结构推导','08':'深灰聚合物 · 壁厚推导','09':'透明聚合物 · 光学近似','10':'透明聚合物 · 光学近似'};
function setupTree(){
 $('component-tree').innerHTML='';
 for(const [id,name] of Object.entries(componentNames).sort(([a],[b])=>a.localeCompare(b))){
  const row=document.createElement('div');row.className='component-row';row.dataset.group=id;
  const check=document.createElement('input');check.type='checkbox';check.checked=true;check.setAttribute('aria-label',`显示${name}`);
  check.addEventListener('change',()=>{state.hiddenGroups=check.checked?state.hiddenGroups.filter(x=>x!==id):[...new Set([...state.hiddenGroups,id])];updateUI();});
  const button=document.createElement('button');button.innerHTML=`<span>${id}</span>${name}`;button.addEventListener('click',()=>selectGroup(id));row.append(check,button);$('component-tree').append(row);
 }
}
function selectGroup(id){
 if(!groups.has(id))return;state.selectedGroup=id;state.selected=null;$('part-panel').hidden=true;
 document.querySelectorAll('.component-row').forEach(r=>r.classList.toggle('selected',r.dataset.group===id));
 $('selected-id').textContent=`PART ${id}`;$('selected-name').textContent=componentNames[id];
 const info=Object.values(partInfo).find(p=>p.group===id);$('selected-function').textContent=info?.description||'独立装配构件。可通过构件树切换显示，或隔离后检查几何细节。';
 const b=groupBounds.get(id);if(b){$('dim-x').textContent=(b.x*1000).toFixed(1);$('dim-y').textContent=(b.z*1000).toFixed(1);$('dim-z').textContent=(b.y*1000).toFixed(1);}
 $('selected-material').textContent=state.material==='original'?componentMaterials[id]:`${materialNames[state.material]} · 外观实验`;
 for(const m of meshes){m.material.emissive.copy(originals.get(m).emissive);if(groupId(m)===id)m.material.emissive.setHex(0x0c1c30);}
 updateUI();
}
function setView(view,fit=false){
 const target=fit&&state.selectedGroup?new THREE.Box3().setFromObject(groups.get(state.selectedGroup)).getCenter(new THREE.Vector3()):new THREE.Vector3(.02,state.explosion>.3?.17:.10,0);
 const directions={iso:[.65,.48,.7],front:[0,0,1],right:[1,0,0],top:[0,1,.0001]};
 camera=new THREE.OrthographicCamera(-1,1,1,-1,.005,10);
 camera.position.copy(target).add(new THREE.Vector3(...directions[view]));camera.up.set(0,1,0);if(view==='top')camera.up.set(0,0,-1);
 orthoExtent=state.explosion>.3?.30:.23;
 if(fit&&state.selectedGroup){const size=new THREE.Box3().setFromObject(groups.get(state.selectedGroup)).getSize(new THREE.Vector3());orthoExtent=Math.max(size.x,size.y,size.z)*.72;}
 if(width<500)orthoExtent*=1.08;
 camera.lookAt(target);controls.object=camera;controls.target.copy(target);controls.minZoom=.4;controls.maxZoom=5;controls.update();state.view=view;resize();
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
}
function enterEngineering(enter){
 state.engineering=enter;document.body.classList.toggle('in-workbench',enter);stageMesh.visible=!enter;engineeringGrid.visible=enter&&state.grid;
 if(enter){state.manualExplosion=0;state.hotspots=false;closePart();appearance(false);orbit(true);resize();setView('iso');}
 else {state.isolated=false;state.hiddenGroups=[];state.selectedGroup=null;state.manualExplosion=null;closePart();camera=new THREE.PerspectiveCamera(34,width/height,.005,10);camera.position.copy(desiredCamera);controls.object=camera;controls.target.copy(desiredTarget);orbit(false);resize();document.querySelectorAll('.component-row input').forEach(c=>c.checked=true);}
 updateUI();
}
function resetStation(){
 state.material='original';state.color='blue';state.manualExplosion=0;state.isolated=false;state.hiddenGroups=[];state.selectedGroup=null;state.hotspots=false;state.grid=true;engineeringGrid.visible=true;
 $('grid-toggle').setAttribute('aria-pressed','true');$('isolate-toggle').setAttribute('aria-pressed','false');closePart();appearance(false);applyMaterial();orbit(true);state.explosion=0;currentJoint=0;
 document.querySelectorAll('.component-row').forEach(row=>{row.classList.remove('selected');row.querySelector('input').checked=true;});
 $('selected-id').textContent='ASSEMBLY';$('selected-name').textContent='完整装配';$('selected-function').textContent='选择左侧构件，查看对应属性与尺寸。';$('selected-material').textContent='混合材料装配';$('dim-x').textContent='358.0';$('dim-y').textContent='264.0';$('dim-z').textContent='199.0';
 setView('iso');updateUI();
}
$('isolate-toggle').addEventListener('click',()=>{if(!state.selectedGroup)selectGroup('07');state.isolated=!state.isolated;if(state.isolated){state.hiddenGroups=state.hiddenGroups.filter(id=>id!==state.selectedGroup);const row=document.querySelector(`.component-row[data-group="${state.selectedGroup}"] input`);if(row)row.checked=true;}for(const [id,g] of groups)g.visible=!state.hiddenGroups.includes(id)&&(!state.isolated||id===state.selectedGroup);$('isolate-toggle').setAttribute('aria-pressed',String(state.isolated));setView(state.view,state.isolated);updateUI();});
$('show-all').addEventListener('click',()=>{state.hiddenGroups=[];state.isolated=false;setView(state.view);$('isolate-toggle').setAttribute('aria-pressed','false');document.querySelectorAll('.component-row input').forEach(c=>c.checked=true);updateUI();});
$('grid-toggle').addEventListener('click',()=>{state.grid=!state.grid;engineeringGrid.visible=state.engineering&&state.grid;$('grid-toggle').setAttribute('aria-pressed',String(state.grid));});
$('station-reset').addEventListener('click',resetStation);
$('station-material').addEventListener('change',e=>{state.material=e.target.value;applyMaterial();});
$('station-explode').addEventListener('input',e=>{state.manualExplosion=Number(e.target.value)/100;orthoExtent=.23+state.manualExplosion*.09;resize();updateUI();});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('fit-selection').addEventListener('click',()=>{if(state.selectedGroup)setView(state.view,true);});

// Read-only diagnostics for local rendering verification.
window.__cleanline={snapshot:()=>({...state,groups:groups.size,meshes:meshes.length,triangles:triangleCount,renderCalls:renderer?.info.render.calls,visibleGroups:[...groups].filter(([,g])=>g.visible).map(([id])=>id),projection:camera?.isOrthographicCamera?'orthographic':'perspective',camera:camera?.position.toArray(),target:controls?.target.toArray(),partOffsets:[...groups].map(([id,g])=>[id,...g.position.toArray()])})};
init();
