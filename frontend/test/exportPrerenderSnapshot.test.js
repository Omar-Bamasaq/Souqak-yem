import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createPrerenderSnapshot, exportPrerenderSnapshot, DEFAULT_MAX_AGE_MS } from '../scripts/exportPrerenderSnapshot.mjs';
import { loadPrerenderSnapshot, validatePrerenderSnapshot } from '../scripts/validatePrerenderSnapshot.mjs';
import { getPrerenderData } from '../scripts/prerenderData.mjs';
import { SAFE_EMPTY_AD_DESCRIPTION, sanitizeSeoAdDescription } from '../src/lib/seoAdDescription.js';
const execFileAsync=promisify(execFile), exporterPath=fileURLToPath(new URL('../scripts/exportPrerenderSnapshot.mjs',import.meta.url));
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
test('records a valid source commit and omits it when unset',async t=>{
 const sourceCommit='abcdef0123456789abcdef0123456789abcdef01';
 const {options}=await mock(t,{ads:[]});
 const withCommit=await createPrerenderSnapshot({...options,sourceCommit});
 assert.equal(withCommit.metadata.sourceCommit,sourceCommit);
 const withoutCommit=await createPrerenderSnapshot(options);
 assert.equal(Object.hasOwn(withoutCommit.metadata,'sourceCommit'),false);
 const {sourceCommit:_,...metadataWithoutCommit}=withCommit.metadata;
 assert.deepEqual(metadataWithoutCommit,withoutCommit.metadata);
});
test('rejects invalid source commit values',async t=>{
 const {options}=await mock(t,{ads:[]});
 for(const sourceCommit of ['release','abcdef0123456789abcdef0123456789abcdef0A','abcdef0123456789abcdef0123456789abcdef0','g'.repeat(40),'']) {
  await assert.rejects(createPrerenderSnapshot({...options,sourceCommit}),/SEO_EXPORT_SOURCE_COMMIT.*40-character/);
 }
});
test('CLI reads and rejects an invalid SEO_EXPORT_SOURCE_COMMIT before API access',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'seo-source-commit-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const outputPath=path.join(dir,'snapshot.json');
 await assert.rejects(execFileAsync(process.execPath,[exporterPath,'--output',outputPath],{
  env:{...process.env,SEO_EXPORT_SOURCE_COMMIT:'release',SEO_EXPORT_API_BASE:'invalid'}
 }),error=>{
  assert.match(error.stderr,/SEO_EXPORT_SOURCE_COMMIT.*40-character/);
  return true;
 });
 assert.deepEqual(await fs.readdir(dir),[]);
});
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
test('allows phone-like digit sequences in valid category and ad image filenames',async t=>{
 const image='/uploads/categories/category-1787771219488-916700115.jpg';
 const {options}=await mock(t,{ads:[{...ad(),images:[image]}],mutate(u,d){
  if(u.pathname==='/api/categories/cars')d.image=image;
  return d;
 }});
 const snapshot=await createPrerenderSnapshot(options);
 assert.equal(snapshot.categories[0].image,image);
 assert.equal(snapshot.ads[0].images[0],image);
});
test('rejects private and traversal paths in ad image links',async t=>{
 for(const image of ['/uploads/private/ad.jpg','/uploads/ads/../private/ad.jpg']) {
  const {options}=await mock(t,{ads:[{...ad(),images:[image]}]});
  await assert.rejects(createPrerenderSnapshot(options),/Unsafe image link/);
 }
});
test('sensitive-data errors identify the field and type without echoing its value',async t=>{
 const cases=[
  {field:'categories[0].description',value:'diagnostic-email-secret@example.org',mutate(u,d){if(u.pathname==='/api/categories/cars')d.description=this.value;return d;}},
 ];
 for(const item of cases) {
  const {options}=await mock(t,{ads:[ad()],mutate:item.mutate.bind(item)});
  await assert.rejects(createPrerenderSnapshot(options),error=>{
   assert.match(error.message,new RegExp(item.field.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   assert.match(error.message,/type: string/);
   assert.equal(error.message.includes(item.value),false);
   assert.doesNotMatch(error.message,/diagnostic-image-secret|diagnostic-email-secret|example\.org/);
   return true;
  });
 }
});
test('sanitizes synthetic ad descriptions for SEO without exposing sensitive values',()=> {
 const cases=[
  {value:'بيع سيارة. البريد هو owner@example.com',forbidden:['owner@example.com'],expected:/تم إزالة البريد/},
  {value:'للتواصل واتساب 967771234567',forbidden:['967771234567'],expected:/تم إزالة رقم/},
  {value:'رؤية التفاصيل على https://example.org/item',forbidden:['https://example.org/item'],expected:/تم إزالة رابط/},
  {value:'الرابط https%253A%252F%252Fexample.org%252Fitem',forbidden:['example.org','%253A'],expected:/تم إزالة رابط/},
  {value:'البريد owner&#64;example&#46;com',forbidden:['owner','example'],expected:/تم إزالة البريد/},
  {value:'البريد owner&commat;example&period;com',forbidden:['owner','example'],expected:/تم إزالة البريد/},
  {value:'الرابط https&colon;&sol;&sol;example&period;org/item',forbidden:['example.org'],expected:/تم إزالة رابط/},
  {value:'الهاتف %2B967%20771234567',forbidden:['967','771234567'],expected:/تم إزالة رقم/},
  {value:'token=diagnostic-secret',forbidden:['diagnostic-secret'],expected:new RegExp(SAFE_EMPTY_AD_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))},
  {value:'token%253Ddiagnostic-secret',forbidden:['diagnostic-secret','%253D'],expected:new RegExp(SAFE_EMPTY_AD_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))},
  {value:'الملف موجود في private%252Fdocuments%252Fpassport.jpg',forbidden:['private','passport'],expected:/الملف موجود في/},
  {value:'سيارة موديل سامسونج A55 إصدار 2025 بسعر 125000 ريال',forbidden:[],expected:/سيارة موديل سامسونج A55 إصدار 2025 بسعر 125000 ريال/},
  {value:'خصم 20% متوفر حتى نهاية الشهر',forbidden:[],expected:/خصم 20% متوفر حتى نهاية الشهر/},
  {value:'967771234567',forbidden:['967771234567'],expected:new RegExp(SAFE_EMPTY_AD_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))},
  {value:'',forbidden:[],expected:new RegExp(SAFE_EMPTY_AD_DESCRIPTION.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}
 ];
 for(const item of cases) {
  const result=sanitizeSeoAdDescription(item.value);
  assert.match(result,item.expected);
  for(const forbidden of item.forbidden) assert.doesNotMatch(result,new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal(sanitizeSeoAdDescription(result),result);
 }
 const longDescription=sanitizeSeoAdDescription('م'.repeat(2200));
 assert.equal(longDescription.length,2000);
});
test('sanitizes encoded sensitive data while preserving ordinary percentages in the exported snapshot',async t=>{
 const original='سيارة بحالة ممتازة وخصم 20%: https%3A%2F%2Fexample.org%2Fitem، owner%40example.com، %2B967%20771234567، token%3Ddiagnostic-secret، private%2Fdocuments%2Fpassport.jpg';
 const {options}=await mock(t,{ads:[{...ad(),description:original}]});
 const snapshot=await createPrerenderSnapshot(options);
 const serialized=JSON.stringify(snapshot);
 for(const sensitive of ['example.org','owner%40example.com','771234567','diagnostic-secret','passport.jpg']) {
  assert.equal(serialized.includes(sensitive),false);
 }
 assert.match(snapshot.ads[0].description,/سيارة بحالة ممتازة/);
 assert.match(snapshot.ads[0].description,/خصم 20%/);
 assert.equal(snapshot.categorySsgDataBySlug.cars.ads[0].description,snapshot.ads[0].description);
});
test('sanitized ad description is copied consistently into the snapshot',async t=>{
 const original='السيارة بحالة جيدة، واتساب 967771234567، البريد owner@example.com';
 const {options}=await mock(t,{ads:[{...ad(),description:original}]});
 const snapshot=await createPrerenderSnapshot(options);
 const sanitized=snapshot.ads[0].description;
 assert.match(sanitized,/السيارة بحالة جيدة/);
 assert.doesNotMatch(sanitized,/967771234567|owner@example\.com/i);
 assert.equal(snapshot.categorySsgDataBySlug.cars.ads[0].description,sanitized);
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
 ['encoded private link',(u,d)=>{if(/\/ads\//.test(u.pathname))d.images=['/uploads/%64ocuments/a.png'];return d;},/Unsafe/],
 ['signed image',(u,d)=>{if(/\/ads\//.test(u.pathname))d.images=['https://api.souqak-yem.com/uploads/a.png?token=secret'];return d;},/Sensitive|Unsafe/],
 ['external image',(u,d)=>{if(/\/ads\//.test(u.pathname))d.images=['https://untrusted.example/a.png'];return d;},/Unsafe/],
 ['private category image',(u,d)=>{if(u.pathname.endsWith('/cars'))d.image='/uploads/private/a.png';return d;},/Unsafe/],
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
test('does not manufacture omitted descriptions',async t=>{
 for(const mode of ['description']) {
  const {options}=await mock(t,{ads:[ad(1),ad(2)],mutate(u,d){if(/\/ads\//.test(u.pathname)){if(mode==='description')delete d.description;else d.slug='same';}return d;}});
  await assert.rejects(createPrerenderSnapshot(options),/description/);
 }
});
test('allows different ad ids to share a title-derived slug',async t=>{
 const ads=[{...ad(1),slug:'same-title'},{...ad(2),slug:'same-title'}];
 const {options}=await mock(t,{ads});
 const snapshot=await createPrerenderSnapshot(options);
 assert.equal(snapshot.ads.length,2);
 assert.equal(snapshot.ads[0].slug,'same-title');
 assert.equal(snapshot.ads[1].slug,'same-title');
 assert.equal(new Set(snapshot.ads.map(item=>`/ad/${item._id}/${item.slug}`)).size,2);
});
test('snapshot validator allows duplicate ad slugs but rejects duplicate ids and unsafe links',async t=>{
 const ads=[{...ad(1),slug:'same-title'},{...ad(2),slug:'same-title'}];
 const {options}=await mock(t,{ads});
 const snapshot=await createPrerenderSnapshot(options);
 assert.doesNotThrow(()=>validatePrerenderSnapshot(snapshot,{now:time,maxAgeMs:DEFAULT_MAX_AGE_MS}));

 const duplicateId=structuredClone(snapshot);
 duplicateId.ads.push({...duplicateId.ads[0],title:'Another title',slug:'other-title'});
 await assert.rejects(Promise.resolve().then(()=>validatePrerenderSnapshot(duplicateId,{now:time,maxAgeMs:DEFAULT_MAX_AGE_MS})),/duplicate public ad id/);

 const unsafeSlug=structuredClone(snapshot);
 unsafeSlug.ads[0].slug='unsafe slug';
 unsafeSlug.categorySsgDataBySlug.cars.ads[0].slug='unsafe slug';
 await assert.rejects(Promise.resolve().then(()=>validatePrerenderSnapshot(unsafeSlug,{now:time,maxAgeMs:DEFAULT_MAX_AGE_MS})),/slug must be a single URL path segment/);
});
test('rejects duplicate ad ids and unsafe ad slugs',async t=>{
 const {options}=await mock(t,{ads:[ad(1),ad(1)]});
 await assert.rejects(createPrerenderSnapshot(options),/Duplicate ad across pages|Duplicate public ad id/);
 for(const slug of ['same/title','same%20title','same title','same?title','..']) {
  const {options}=await mock(t,{ads:[{...ad(1),slug}]});
  await assert.rejects(createPrerenderSnapshot(options),/Unsafe or missing slug/);
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
