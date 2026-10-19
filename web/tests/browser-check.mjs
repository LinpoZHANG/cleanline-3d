import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle']});
const errors=[],failed=[],results=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)failed.push([r.url(),r.status()]);});
const snapshot=()=>page.evaluate(()=>window.__cleanline.snapshot());
const shot=async(name)=>page.screenshot({path:`evidence/${name}.png`});
const scroll=async(id)=>{await page.evaluate(id=>window.scrollTo({top:document.getElementById(id).offsetTop,behavior:'instant'}),id);await page.waitForTimeout(1700);};
try{
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4174/',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__cleanline?.snapshot().loaded,null,{timeout:30000});await page.waitForTimeout(1700);
 // Revision04 unions the former separate hood panels into one closed mesh (80 exported meshes).
 let s=await snapshot();expect(s.groups).toBe(10);expect(s.meshes).toBeGreaterThanOrEqual(80);expect(s.renderCalls).toBeGreaterThan(0);await shot('desktop-hero');results.push({test:'GLB renders ten groups',pass:true,meshes:s.meshes,triangles:s.triangles});
 if(process.argv.includes('--workbench')){
  await scroll('explore');await page.waitForFunction(()=>window.__cleanline.snapshot().engineering);await shot('desktop-workbench');
  await page.click('.component-row[data-group="07"] button');await page.click('#isolate-toggle');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===1);await shot('desktop-isolated-joint');
  expect((await snapshot()).projection).toBe('orthographic');await expect(page.locator('.component-row.muted')).toHaveCount(9);
  await page.click('#show-all');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===10);
  await page.click('#station-reset');await page.setViewportSize({width:390,height:844});await scroll('explore');await shot('mobile-workbench');
  await page.click('.component-row[data-group="04"] button');await page.click('#isolate-toggle');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===1);await shot('mobile-isolated');
  expect(errors).toEqual([]);expect(failed).toEqual([]);await fs.writeFile('evidence/workbench-refinement-report.json',JSON.stringify({isolationAutofit:true,visibilitySync:true,desktopAndMobile:true,errors,failed},null,2));console.log('Workbench autofit and visibility refinement passed');
 } else {
 await scroll('craft');await shot('desktop-detail');
 await scroll('connection');await shot('desktop-joint');
 await scroll('structure');await page.waitForFunction(()=>window.__cleanline.snapshot().explosion>.94);await shot('desktop-exploded');
 await page.click('#hotspot-toggle');expect((await snapshot()).hotspots).toBe(true);await page.locator('.hotspot:not([hidden])').first().click();expect((await snapshot()).selected).toBeTruthy();await shot('desktop-hotspot');await page.click('#close-part');
 await page.click('#appearance-toggle');await page.click('[data-material="metal"]');await page.click('[data-color="teal"]');s=await snapshot();expect(s.material).toBe('metal');expect(s.color).toBe('teal');await expect(page.locator('#material-note')).toContainText('外观实验');await expect(page.locator('#state-line')).toContainText('青绿');await shot('desktop-appearance');
 await page.locator('#explode-range').evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>Math.abs(window.__cleanline.snapshot().explosion-.35)<.03);results.push({test:'Appearance, labels, hotspots and explosion range',pass:true});
 await page.click('#close-appearance');await page.click('#orbit-toggle');const before=(await snapshot()).camera;const rect=await page.locator('#canvas').boundingBox();await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.76,rect.y+rect.height*.42,{steps:15});await page.mouse.up();await page.waitForTimeout(600);expect((await snapshot()).camera).not.toEqual(before);results.push({test:'Orbit drag changes actual camera',pass:true});
 await page.click('#reset');await page.waitForFunction(()=>scrollY<5&&window.__cleanline.snapshot().explosion<.02);s=await snapshot();expect(s.material).toBe('original');expect(s.color).toBe('blue');expect(s.hotspots).toBe(false);expect(s.mode).toBe('story');results.push({test:'One-click reset restores every mode',pass:true});
 await scroll('explore');await page.waitForFunction(()=>window.__cleanline.snapshot().engineering);await shot('desktop-workbench');
 await page.click('.component-row[data-group="07"] button');await expect(page.locator('#selected-name')).toHaveText('蓝色锁紧环');await page.click('#isolate-toggle');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===1);expect((await snapshot()).visibleGroups).toEqual(['07']);await shot('desktop-isolated-joint');
 await page.click('[data-view="top"]');expect((await snapshot()).projection).toBe('orthographic');expect((await snapshot()).view).toBe('top');
 await page.click('#show-all');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===10);await page.locator('.component-row[data-group="10"] input').uncheck();await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===9);
 await page.selectOption('#station-material','metal');expect((await snapshot()).material).toBe('metal');await page.locator('#station-explode').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>Math.abs(window.__cleanline.snapshot().explosion-.7)<.03);
 await page.click('#station-reset');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===10);expect((await snapshot()).engineering).toBe(true);expect((await snapshot()).material).toBe('original');expect((await snapshot()).explosion).toBeLessThan(.02);results.push({test:'Engineering tree, isolation, hide, orthographic views, materials and in-place reset',pass:true});
 await scroll('specs');await shot('desktop-specs');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(2000);await shot('mobile-hero');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await scroll('structure');await page.waitForFunction(()=>window.__cleanline.snapshot().explosion>.94);await shot('mobile-exploded');
 await page.click('#appearance-toggle');await page.click('[data-material="clay"]');await page.click('[data-color="graphite"]');await shot('mobile-controls');await page.click('#reset');await page.waitForFunction(()=>scrollY<5);results.push({test:'390px layout and mobile controls',pass:true});
 await scroll('explore');await page.waitForFunction(()=>window.__cleanline.snapshot().engineering);await shot('mobile-workbench');await page.click('.component-row[data-group="04"] button');await page.click('#isolate-toggle');await page.waitForFunction(()=>window.__cleanline.snapshot().visibleGroups.length===1);await shot('mobile-isolated');await page.click('#station-reset');results.push({test:'Mobile engineering controls',pass:true});
 const reduce=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await reduce.goto(process.env.BASE_URL || 'http://127.0.0.1:4174/');await reduce.waitForFunction(()=>window.__cleanline?.snapshot().loaded);await reduce.close();results.push({test:'Reduced-motion page loads',pass:true});
 expect(errors).toEqual([]);expect(failed).toEqual([]);
 await fs.writeFile('evidence/browser-report.json',JSON.stringify({results,errors,failed,final:s},null,2));console.log(JSON.stringify({results,errors,failed}));
 }
}finally{await browser.close();}
