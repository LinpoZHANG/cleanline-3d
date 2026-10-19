"""Export the current saved Blender project to the sibling web application."""
import bpy,json,math
import numpy as np
from pathlib import Path
assert bpy.data.filepath, 'Save the project in blender/output before exporting'
ROOT=Path(bpy.data.filepath).resolve().parents[2]
assert (ROOT/'web/package.json').exists(), 'Keep the repository folder structure intact'
s=bpy.context.scene;s.frame_set(1)
out=ROOT/'web/public/models';out.mkdir(parents=True,exist_ok=True)
# Procedural EPS converted to a tiny repeatable material texture (not model imagery).
N=512;y,x=np.mgrid[0:N,0:N].astype(float);x=x/N*32;y=y/N*32;gx=np.floor(x).astype(int);gy=np.floor(y).astype(int);dist=np.full((N,N),10.)
rng=np.random.default_rng(154150);jx=rng.random((34,34));jy=rng.random((34,34))
for dy in [-1,0,1]:
 for dx in [-1,0,1]:
  cx=gx+dx;cy=gy+dy;d=(cx+jx[cy%34,cx%34]-x)**2+(cy+jy[cy%34,cx%34]-y)**2;dist=np.minimum(dist,d)
v=np.clip(.58+.17*np.sqrt(dist)+rng.normal(0,.022,(N,N)),.4,.83)
pixels=np.ones((N,N,4),dtype=np.float32);pixels[:,:,:3]=v[:,:,None]
im=bpy.data.images.new('WEB EPS grain',N,N,alpha=True);im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(out/'eps-grain.png');im.file_format='PNG';im.save()
replaced=[];temp=[];copies=[];mesh_backups=[]
# Metric planar UVs keep EPS beads isotropic on long side panels.
for ob in s.objects:
 if ob.type=='MESH' and any(slot.material and 'EPS' in slot.material.name for slot in ob.material_slots):
  old=ob.data;ob.data=old.copy();mesh_backups.append((ob,old,ob.data));uv=ob.data.uv_layers.active or ob.data.uv_layers.new(name='Metric EPS UV')
  for poly in ob.data.polygons:
   normal=ob.matrix_world.to_3x3()@poly.normal;axis=max(range(3),key=lambda i:abs(normal[i]));axes=[i for i in range(3) if i!=axis]
   for li in poly.loop_indices:
    pt=ob.matrix_world@ob.data.vertices[ob.data.loops[li].vertex_index].co;uv.data[li].uv=(pt[axes[0]]/.032,pt[axes[1]]/.032)

for m in list(bpy.data.materials):
 if not m.use_nodes:continue
 bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs:continue
 cm=bpy.data.materials.new('WEB '+m.name);cm.use_nodes=True;temp.append(cm)
 cb=next(n for n in cm.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for key in ['Base Color','Metallic','Roughness','IOR','Transmission Weight','Alpha']:
  cb.inputs[key].default_value=bs.inputs[key].default_value
 if 'EPS' in m.name:
  tint=np.array(m.get('web_eps_tint',[1,1,1])); tinted=pixels.copy();tinted[:,:,:3]=np.clip(pixels[:,:,:3]*tint,0,1); ti=bpy.data.images.new('WEB '+m.name+' grain',N,N,alpha=True);ti.pixels.foreach_set(tinted.ravel());ti.pack();tex=cm.node_tree.nodes.new('ShaderNodeTexImage');tex.image=ti;cm.node_tree.links.new(tex.outputs['Color'],cb.inputs['Base Color'])
 for ob in s.objects:
  if ob.type=='MESH':
   for slot in ob.material_slots:
    if slot.material==m:replaced.append((slot,m));slot.material=cm
# Text geometry is exported as actual meshes.
for ob in list(s.objects):
 if ob.type=='FONT':
  c=ob.copy();c.data=ob.data.copy();s.collection.objects.link(c);c.name='WEB '+ob.name
  bpy.ops.object.select_all(action='DESELECT');c.select_set(True);bpy.context.view_layer.objects.active=c;bpy.ops.object.convert(target='MESH');copies.append(bpy.context.object)
bpy.ops.object.select_all(action='DESELECT')
parts=[]
for ob in s.objects:
 if any(c.name.startswith('90') for c in ob.users_collection):continue
 if ob.type in ['MESH','EMPTY']:
  ob.select_set(True)
  if ob.type=='EMPTY':parts.append({'name':ob.name,'explosion_mm':list(ob.get('explosion_mm',[0,0,0]))})
try:
 bpy.ops.export_scene.gltf(filepath=str(out/'cleanline.glb'),use_selection=True,export_format='GLB',export_animations=False,export_extras=True,export_apply=True,export_yup=True)
finally:
 for slot,m in replaced:slot.material=m
 for o in copies:bpy.data.objects.remove(o,do_unlink=True)
 for ob,old,new in mesh_backups:ob.data=old;bpy.data.meshes.remove(new)
 for m in temp:
  if m.users==0:bpy.data.materials.remove(m)
 bpy.ops.object.select_all(action='DESELECT')
(out/'parts.json').write_text(json.dumps({'source':'CleanLine_154150001.blend','units':'metres','parts':parts},ensure_ascii=False,indent=2))
print('EXPORTED',str(out/'cleanline.glb'),(out/'cleanline.glb').stat().st_size,'bytes')
