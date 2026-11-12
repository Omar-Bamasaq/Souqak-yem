import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPrerenderSnapshot, exportPrerenderSnapshot, DEFAULT_MAX_AGE_MS } from '../scripts/exportPrerenderSnapshot.mjs';
import { loadPrerenderSnapshot } from '../scripts/validatePrerenderSnapshot.mjs';
import { getPrerenderData } from '../scripts/prerenderData.mjs';
const time = Date.parse('2026-11-11T10:00:00Z'), catId = 'a'.repeat(24);
const category = { _id: catId, slug: 'cars', name: 'Cars', description: '', image: null, children: [] };
function ad(n=1) { return { _id:n.toString(16).padStart(24,'0'), slug:`car-${n}`, title:'Car', description:'Public description', status:'approved', isDeleted:false, isVisible:true, isArchived:false, sold:false, expiresAt:'2026-12-11T10:00:00Z', adType:'sell', price:100, currency:'YER', priceOnContact:false, images:['car.webp'], categoryId:category }; }
async function mock(t, { ads=[ad()], mutate=(_u,d)=>d, fail=false }={}) {
  const calls=[];
  const server=http.createServer((req,res)=>{
    calls.push({method:req.method,path:req.url,auth:req.headers.authorization,cookie:req.headers.cookie});
    const u=new URL(req.url,'http://localhost'); let d;
    if(u.pathname==='/api/categories/main') d=[category];
    else if(u.pathname==='/api/categories/cars') d=category;
    else if(u.pathname.includes('/breadcrumbs/')) d=[{name:'Cars',slug:'cars'}];
    else if(u.pathname==='/api/ads') { const page=Number(u.searchParams.get('page')),limit=Number(u.searchParams.get('limit')); d={items:ads.slice((page-1)*limit,page*limit).map(a=>({_id:a._id})),page,limit,total:ads.length,pages:Math.ceil(ads.length/limit)}; }
    else d=ads.find(a=>'/api/ads/'+a._id===u.pathname);
    res.writeHead(fail?503:d?200:404,{'content-type':'application/json'}); res.end(JSON.stringify(mutate(u,structuredClone(d))));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
  return {calls,options:{apiBase:`http://127.0.0.1:${server.address().port}/api`,allowLoopback:true,expectedCategoryCount:1,delayMs:0,now:()=>time,pageSize:2}};
}
test('exports complete paginated allowlisted JSON; reloads offline and rejects stale data',async t=>{
  const ads=[ad(1),ad(2),ad(3)]; ads[0].userId={email:'private@example.org',token:'never-export'};
  const {calls,options}=await mock(t,{ads});
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seo-export-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'snapshot.json');await exportPrerenderSnapshot(file,options);
  const result=await loadPrerenderSnapshot(file,{now:time,maxAgeMs:DEFAULT_MAX_AGE_MS});
  assert.equal(result.categories[0]._id,catId);assert.equal(result.ads.length,3);assert.equal(result.ads[0].categoryId._id,catId);
  assert.equal(result.categorySsgDataBySlug.cars.ads.length,3);assert.equal(JSON.stringify(result).includes('private@example.org'),false);
  assert.equal(Date.parse(result.metadata.expiresAt)-time,DEFAULT_MAX_AGE_MS);
  assert.ok(calls.some(c=>c.path.includes('page=2')));assert.ok(calls.every(c=>c.method==='GET'&&!c.auth&&!c.cookie&&!c.path.includes('admin')));
  const offline=await getPrerenderData({env:{SEO_PRERENDER_DATA_SOURCE:'local',SEO_PRERENDER_SNAPSHOT_PATH:file},readSnapshot:(p,o)=>loadPrerenderSnapshot(p,{...o,now:time})});assert.ok(offline.categorySsgDataBySlug instanceof Map);
  await assert.rejects(loadPrerenderSnapshot(file,{now:time+DEFAULT_MAX_AGE_MS+1,maxAgeMs:DEFAULT_MAX_AGE_MS}),/age/);
  await assert.rejects(exportPrerenderSnapshot(file,options),/EEXIST/);assert.equal((await fs.readdir(dir)).length,1);
});
test('zero ads succeeds',async t=>{const {options}=await mock(t,{ads:[]});const d=await createPrerenderSnapshot(options);assert.deepEqual(d.ads,[]);assert.deepEqual(d.categorySsgDataBySlug.cars.ads,[]);});
test('omits safe SVG images from main and child category snapshots',async t=>{
 const child={...category,_id:'b'.repeat(24),slug:'child',name:'Child',image:'/uploads/categories/child.svg'};
 const {options}=await mock(t,{ads:[],mutate(u,d){
  if(u.pathname==='/api/categories/cars'){d.image='https://souqak-yem.com/uploads/categories/cars.svg';d.children=[child];}
  return d;
 }});
 options.fetchImpl=async(url,init)=>{
  if(new URL(url).pathname==='/api/categories/child')
   return new Response(JSON.stringify(child),{status:200});
  return fetch(url,init);
 };
 const snapshot=await createPrerenderSnapshot(options);
 assert.equal(snapshot.categories[0].image,null);
 assert.equal(snapshot.categories[0].children[0].image,null);
 assert.equal(snapshot.categorySsgDataBySlug.cars.category.image,null);
 assert.equal(snapshot.categorySsgDataBySlug.cars.subcategories[0].image,null);
});
test('rejects unsafe category SVG image links instead of omitting them',async t=>{
 for(const image of [
  'javascript:alert(1).svg',
  '//untrusted.example/uploads/categories/car.svg',
  'https://untrusted.example/uploads/categories/car.svg',
  '/uploads/categories/../car.svg',
  '/uploads/private/car.svg',
  '/uploads/categories/car.svg?token=secret',
  '/uploads/categories/%252e%252e/car.svg'
 ]) {
  const {options}=await mock(t,{ads:[],mutate(u,d){
   if(u.pathname==='/api/categories/cars')d.image=image;
   return d;
  }});
  await assert.rejects(createPrerenderSnapshot(options),/Unsafe|Sensitive|Invalid encoded/);
 }
});
test('continues to reject SVG images in ads',async t=>{
 const {options}=await mock(t,{ads:[{...ad(),images:['/uploads/ads/car.svg']}]});
 await assert.rejects(createPrerenderSnapshot(options),/Unsafe image link/);
});
test('sensitive-data errors identify the field and type without echoing its value',async t=>{
 const cases=[
  {field:'categories[0].image',value:'/uploads/private/diagnostic-image-secret.svg',mutate(u,d){if(u.pathname==='/api/categories/cars')d.image=this.value;return d;}},
  {field:'categories[0].description',value:'diagnostic-email-secret@example.org',mutate(u,d){if(u.pathname==='/api/categories/cars')d.description=this.value;return d;}}
 ];
 for(const item of cases) {
  const {options}=await mock(t,{ads:[],mutate:item.mutate.bind(item)});
  await assert.rejects(createPrerenderSnapshot(options),error=>{
   assert.match(error.message,new RegExp(item.field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   assert.match(error.message,/type: string/);
   assert.doesNotMatch(error.message,/diagnostic-image-secret|diagnostic-email-secret|example\.org/);
   return true;
  });
 }
});
for(const [name,mutate,pattern] of [
 ['missing categories',(u,d)=>u.pathname.endsWith('/main')?[]:d,/Expected/],
 ['missing children',(u,d)=>{if(u.pathname.endsWith('/cars'))delete d.children;return d;},/children/],
 ['missing breadcrumbs',(u,d)=>u.pathname.includes('/breadcrumbs/')?[]:d,/breadcrumbs/],
 ['missing required ad flags',(u,d)=>{if(/\/ads\//.test(u.pathname))delete d.isVisible;return d;},/boolean/],
 ['invalid ID',(u,d)=>{if(/\/ads\//.test(u.pathname))d._id='bad';return d;},/_id/],
 ['truncated page',(u,d)=>{if(u.pathname==='/api/ads')d.items=[];return d;},/truncated/],
 ['missing pagination',(u,d)=>{if(u.pathname==='/api/ads')delete d.total;return d;},/pagination/],
 ['category global mismatch',(u,d)=>u.searchParams.has('categoryId')?{...d,items:[],total:0,pages:0}:d,/disagree/],
 ['sensitive text',(u,d)=>{if(/\/ads\//.test(u.pathname))d.description='private@example.org';return d;},/Sensitive/],
 ['encoded private link',(u,d)=>{if(/\/ads\//.test(u.pathname))d.images=['/uploads/%64ocuments/a.png'];return d;},/Sensitive|private/],
 ['signed image',(u,d)=>{if(/\/ads\//.test(u.pathname))d.images=['https://api.souqak-yem.com/uploads/a.png?token=secret'];return d;},/Sensitive|Unsafe/],
 ['external image',(u,d)=>{if(/\/ads\//.test(u.pathname))d.images=['https://untrusted.example/a.png'];return d;},/Unsafe/],
 ['private category image',(u,d)=>{if(u.pathname.endsWith('/cars'))d.image='/uploads/private/a.png';return d;},/Sensitive|private/],
 ['text URL',(u,d)=>{if(/\/ads\//.test(u.pathname))d.description='https://example.org/secret';return d;},/Links/]
])test(`rejects ${name}`,async t=>{const {options}=await mock(t,{mutate});await assert.rejects(createPrerenderSnapshot(options),pattern);});
for(const patch of [{status:'pending'},{isDeleted:true},{isVisible:false},{isArchived:true},{sold:true},{isSold:true},{isAvailable:false},{expiresAt:'2020-01-01'},{inventoryEnabled:true,stockQuantity:0}])test(`rejects nonindexable ${JSON.stringify(patch)}`,async t=>{const {options}=await mock(t,{ads:[{...ad(),...patch}]});await assert.rejects(createPrerenderSnapshot(options),/eligible/);});
test('API failure publishes no output',async t=>{const {options}=await mock(t,{fail:true});const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seo-failed-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));await assert.rejects(exportPrerenderSnapshot(path.join(dir,'bad.json'),options),/503/);assert.deepEqual(await fs.readdir(dir),[]);});
test('changed totals, duplicate IDs and changing first page fail',async t=>{
 for(const mode of ['total','duplicate','first']){let count=0;const {options}=await mock(t,{ads:[ad(1),ad(2),ad(3)],mutate(u,d){if(u.pathname!=='/api/ads')return d;count++;if(mode==='total'&&count===2){d.total=4;d.pages=2;}if(mode==='duplicate'&&count===2)d.items=[{_id:ad(1)._id}];if(mode==='first'&&count===3)d.items.reverse();return d;}});await assert.rejects(createPrerenderSnapshot(options),/totals|Duplicate|changed/);}
});

test('default requires all 22 root categories',async t=>{
 const {options}=await mock(t,{ads:[]});delete options.expectedCategoryCount;
 await assert.rejects(createPrerenderSnapshot(options),/Expected 22/);
});
test('does not manufacture omitted descriptions or accept duplicate slugs',async t=>{
 for(const mode of ['description','slug']) {
  const {options}=await mock(t,{ads:[ad(1),ad(2)],mutate(u,d){if(/\/ads\//.test(u.pathname)){if(mode==='description')delete d.description;else d.slug='same';}return d;}});
  await assert.rejects(createPrerenderSnapshot(options),/description|Duplicate public ad slug/);
 }
});
test('recursively loads category pages and maps leaf ads to a real root ID',async t=>{
 const child={...category,_id:'b'.repeat(24),slug:'child',name:'Child'};
 const {options}=await mock(t,{ads:[{...ad(),categoryId:child}],mutate(u,d){
  if(u.pathname==='/api/categories/cars')d.children=[child];
  if(u.pathname==='/api/categories/child')return child;
  return d;
 }});
 // Supply the additional public child endpoint through a fetch adapter; the
 // ordinary HTTP mock still handles all remaining requests.
 const actualFetch=fetch;
 options.fetchImpl=(url,init)=>new URL(url).pathname==='/api/categories/child'?Promise.resolve(new Response(JSON.stringify(child),{status:200})):actualFetch(url,init);
 const result=await createPrerenderSnapshot(options);
 assert.equal(result.categories[0].children[0]._id,child._id);
 assert.equal(result.ads[0].categoryId._id,catId);
});
test('allows missing descriptions only on child categories',async t=>{
 const child={...category,_id:'b'.repeat(24),slug:'child',name:'Child'};
 delete child.description;

 const {options}=await mock(t,{ads:[],mutate(u,d){
  if(u.pathname==='/api/categories/cars')d.children=[child];
  return d;
 }});

 options.fetchImpl=async(url,init)=>{
  if(new URL(url).pathname==='/api/categories/child')
   return new Response(JSON.stringify(child),{status:200});
  return fetch(url,init);
 };

 const snapshot=await createPrerenderSnapshot(options);
 assert.equal(snapshot.categories[0].children[0].description,'');

 const {options:invalid}=await mock(t,{ads:[],mutate(u,d){
  if(u.pathname==='/api/categories/cars')delete d.description;
  return d;
 }});
 await assert.rejects(createPrerenderSnapshot(invalid),/category description/);
});

test('rejects a snapshot that ages out while exporting',async t=>{
 const {options}=await mock(t,{ads:[]});let count=0;options.maxAgeMs=1;options.now=()=>time+(count++?2:0);
 await assert.rejects(createPrerenderSnapshot(options),/lifetime/);
});
test('exports all 22 categories with empty public ad indexes using default count',async t=>{
 const {options}=await mock(t,{ads:[]});delete options.expectedCategoryCount;
 const roots=Array.from({length:22},(_,i)=>({...category,_id:(100+i).toString(16).padStart(24,'0'),slug:`category-${i}`}));
 options.fetchImpl=async(url,init)=>{
  const u=new URL(url);let data;
  if(u.pathname==='/api/categories/main')data=roots;
  else if(u.pathname.includes('/breadcrumbs/')){const c=roots.find(c=>u.pathname.endsWith(c._id));data=[{name:c.name,slug:c.slug}];}
  else if(u.pathname.startsWith('/api/categories/'))data=roots.find(c=>u.pathname.endsWith('/'+c.slug));
  else return fetch(url,init);
  return new Response(JSON.stringify(data),{status:200});
 };
 const snapshot=await createPrerenderSnapshot(options);
 assert.equal(snapshot.categories.length,22);assert.equal(Object.keys(snapshot.categorySsgDataBySlug).length,22);
 assert.deepEqual(snapshot.ads,[]);
});
