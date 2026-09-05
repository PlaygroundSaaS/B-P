import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
function load(path, mocks = {}) {
  const filename = resolve(root, path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : name.startsWith('.') ? load(resolve(dirname(filename), name) + '.ts', mocks) : require(name));
  return module.exports;
}
const { emptyStudio } = load('lib/pricing.ts');
const { saveQuoteToData, winQuote, weddingTotals } = load('lib/studio-operations.ts');
const { isStudioData } = load('lib/studio-validation.ts');
const { readJsonObject, requireSameOrigin } = load('lib/request-body.ts');
const quote = () => ({ id:'quote-1', clientName:'Sample Client', occasion:'Bouquet', eventDate:'', contact:'', lines:[{id:'line-1',inventoryId:'rose',name:'Rose',category:'stem',quantity:4,unitCost:2}], labourHours:1,labourRate:25,wastagePercent:10,markupPercent:250,deliveryFee:5,discount:0,vatApplies:true,vatRate:20,notes:'',createdAt:'2026-09-05T10:00:00Z' });
const sample = () => ({...emptyStudio(),inventory:[{id:'rose',name:'Rose',costPerStem:2,stemsPurchased:10,stemsRemaining:10}]});

test('saving an edited quote twice replaces it and preserves other quotes and stock', () => {
  const first=saveQuoteToData(sample(),quote());
  first.quotes.push({...quote(),id:'other'});
  const next=saveQuoteToData(first,{...quote(),contact:'updated'});
  assert.equal(next.quotes.length,2); assert.equal(next.quotes[0].contact,'updated'); assert.equal(next.inventory[0].stemsRemaining,10);
});
test('stock checks aggregate duplicate flower lines and leave inputs unchanged on failure', () => {
  const data=sample(); const q=quote();q.lines.push({...q.lines[0],id:'line-2',quantity:7});
  assert.throws(()=>winQuote(data,q),/needs 11.*only 10/);assert.equal(data.inventory[0].stemsRemaining,10);assert.equal(data.jobs.length,0);
});
test('winning moves a quote once and freezes its exact price and lines', () => {
  const q=quote();const next=winQuote(saveQuoteToData(sample(),q),q);
  assert.equal(next.inventory[0].stemsRemaining,6);assert.equal(next.quotes.length,0);assert.equal(next.jobs.length,1);
  q.lines[0].quantity=9;assert.equal(next.jobs[0].lines[0].quantity,4);
  assert.throws(()=>winQuote(next,q),/already a won job/);
});
test('missing inventory, negative pricing and fractional stems cannot become jobs', () => {
  const q=quote(); q.lines[0].inventoryId='deleted'; assert.throws(()=>winQuote(sample(),q),/no longer/);
  q.lines[0].inventoryId='rose';q.lines[0].quantity=1.5;assert.throws(()=>winQuote(sample(),q),/whole numbers/);
  q.lines[0].quantity=1;q.discount=-10;assert.throws(()=>winQuote(sample(),q),/zero or more/);
});
test('wedding totals price all purchases, not only stems assigned to arrangements', () => {
  const result=weddingTotals({inventory:[{stemsPerPurchase:10,purchases:2,costPerStem:1.25}],materials:[{quantity:2,unitCost:4}],arrangements:[{quantity:1,flowers:[{stemsPerArrangement:3}]}],markupPercent:100,vatRate:20});
  assert.deepEqual(result,{flowerCost:25,materialCost:8,baseCost:33,markup:33,net:66,netProfit:33,vat:13.2,total:79.2});
});
test('full-state writes reject partial envelopes, null rows and invalid prices', () => {
  assert.equal(isStudioData(sample()),true);assert.equal(isStudioData({}),false);assert.equal(isStudioData({...sample(),inventory:[null]}),false);assert.equal(isStudioData({...sample(),settings:{...sample().settings,vatRate:-1}}),false);
  assert.equal(isStudioData({...sample(),quotes:[{...quote(),lines:[null]}]}),false);
});
test('bounded request parser rejects null, arrays, malformed and oversized JSON',async()=>{
  for (const body of ['null','[]','{']) await assert.rejects(readJsonObject(new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json'},body})));
  await assert.rejects(readJsonObject(new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json'},body:'{"a":"1234567890"}'}),8),/too large/);
});
test('cross-origin Studio mutations are rejected',()=>assert.throws(()=>requireSameOrigin(new Request('https://example.test/api/studio',{headers:{origin:'https://elsewhere.test'}})),/from the website/));
test('Studio API denies anonymous reads and saves without reaching the database',async()=>{
  const api=load('app/api/studio/route.ts',{'@/lib/studio-auth':{hasStudioSession:async()=>false},'@/lib/studio-database':{createStudioDatabaseClient:()=>{throw Error('must not connect');}}});
  assert.equal((await api.GET()).status,401);assert.equal((await api.PUT(new Request('https://example.test/api/studio',{method:'PUT'}))).status,401);
});
test('invalid complete-state writes never reach a database mutation',async()=>{
  let touched=false;
  const api=load('app/api/studio/route.ts',{'@/lib/studio-auth':{hasStudioSession:async()=>true},'@/lib/studio-database':{createStudioDatabaseClient:()=>({from:()=>{touched=true;throw Error('must not write');}})}});
  const response=await api.PUT(new Request('https://example.test/api/studio',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({data:{},expectedUpdatedAt:null})}));
  assert.equal(response.status,400);assert.equal(touched,false);assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('revision conflicts return 409 instead of overwriting another edit',async()=>{
  let revision='';const chain={update(){return this},eq(key,value){if(key==='updated_at') revision=value;return this},select(){return this},maybeSingle:async()=>({data:null,error:null})};
  const api=load('app/api/studio/route.ts',{'@/lib/studio-auth':{hasStudioSession:async()=>true},'@/lib/studio-database':{createStudioDatabaseClient:()=>({from:()=>chain})}});
  const response=await api.PUT(new Request('https://example.test/api/studio',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({data:sample(),expectedUpdatedAt:'2026-09-05T10:00:00Z'})}));
  assert.equal(response.status,409);assert.equal(revision,'2026-09-05T10:00:00Z');
});
test('enquiry handles email-provider network failure with a usable response',async()=>{
  const oldFetch=globalThis.fetch;const oldKey=process.env.RESEND_API_KEY;const oldFrom=process.env.RESEND_FROM_EMAIL;
  process.env.RESEND_API_KEY='local-test';process.env.RESEND_FROM_EMAIL='test@example.test';globalThis.fetch=async()=>{throw Error('offline')};
  try {const api=load('app/api/enquiry/route.ts');const response=await api.POST(new Request('https://example.test/api/enquiry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Test',email:'test@example.test',occasion:'Wedding',message:'Local test only'})}));assert.equal(response.status,502);assert.match((await response.json()).error,/confirm delivery/);}
  finally {globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;if(oldFrom===undefined)delete process.env.RESEND_FROM_EMAIL;else process.env.RESEND_FROM_EMAIL=oldFrom;}
});
const { studioInsights } = load('lib/studio-insights.ts');
test('insights allocate job profit by line cost and subtract recorded wastage',()=>{
 const data=sample();const q=quote();q.lines.push({id:'material',inventoryId:null,name:'Vase',category:'sundry',quantity:1,unitCost:2});
 data.jobs=winQuote(data,q,'2026-09-05T12:00:00Z').jobs;data.wastage=[{id:'waste',inventoryId:'rose',name:'Rose',quantity:2,unitCost:2,recordedAt:'2026-09-06T12:00:00Z'}];
 const result=studioInsights(data,'2026-09-01','2026-09-30');const row=result.rows[0];assert.equal(row.sold,4);assert.equal(row.wasteCost,4);assert.equal(row.profit,Math.round((data.jobs[0].totals.profit*.8-4)*100)/100);assert.equal(result.trend.length,1);
});
test('insights respect inclusive London dates and exclude returned jobs',()=>{
 const data=sample();data.jobs=winQuote(data,quote(),'2026-08-31T23:30:00Z').jobs;
 assert.equal(studioInsights(data,'2026-09-01','2026-09-01').jobCount,1);
 assert.equal(studioInsights(data,'2026-08-01','2026-08-31').jobCount,0);
 data.jobs[0].stockReturned=true;assert.equal(studioInsights(data).rows.length,0);assert.equal(studioInsights(data).returnedJobs,1);
});
test('wastage-only periods and same flower in different units stay distinct',()=>{
 const data=sample();data.wastage=[{id:'one',inventoryId:'rose',name:'Rose',stockUnit:'stem',quantity:2,unitCost:2,recordedAt:'2026-09-05T12:00:00Z'},{id:'two',inventoryId:'old',name:'Rose',stockUnit:'bunch',quantity:1,unitCost:10,recordedAt:'2026-09-05T12:00:00Z'}];
 const result=studioInsights(data);assert.equal(result.wasteCost,14);assert.equal(result.profit,-14);assert.equal(result.rows.length,2);
});
test('optional wedding proposals accept existing records and reject invalid costs or external images',()=>{
 const plan={id:'plan',clientName:'Sample',notes:'Plan',setupOptions:[{id:'setup',title:'Ceremony',description:'Cream flowers',quantity:2,unitPrice:125,selected:true,photoSrc:'/assets/weddings/wedding-02.jpg'}]};
 assert.equal(isStudioData({...sample(),plans:[plan]}),true);
 assert.equal(isStudioData({...sample(),plans:[{...plan,setupOptions:[{...plan.setupOptions[0],unitPrice:-1}]}]}),false);
 assert.equal(isStudioData({...sample(),plans:[{...plan,setupOptions:[{...plan.setupOptions[0],photoSrc:'https://elsewhere.test/photo.jpg'}]}]}),false);
});
test('origin validation uses incoming host behind the Next server adapter',()=>{
 assert.doesNotThrow(()=>requireSameOrigin(new Request('http://localhost:3107/api/studio',{headers:{origin:'http://127.0.0.1:3107',host:'127.0.0.1:3107'}})));
});
test('login rejects a null body without attempting authentication',async()=>{
 const api=load('app/api/studio/login/route.ts',{'@/lib/studio-auth':{studioLoginConfigured:()=>{throw Error('must not authenticate');}}});
 const response=await api.POST(new Request('https://example.test/api/studio/login',{method:'POST',headers:{'content-type':'application/json'},body:'null'}));assert.equal(response.status,400);
});
