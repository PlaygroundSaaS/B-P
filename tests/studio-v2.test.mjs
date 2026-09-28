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
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : name.startsWith('.') ? load(resolve(dirname(filename), name) + '.ts', mocks) : require(name));
  return module.exports;
}
const { emptyStudio, calculateTotals } = load('lib/pricing.ts');
const { applyStudioCommand, stockSummary, stockValue, totalStockValue, eventQuoteTotals, recipeRevision } = load('lib/studio-commands.ts');
const { profitModel, recipeProfitInput, eventProfitInput } = load('lib/profitability.ts');
const { businessIntelligence } = load('lib/business-intelligence.ts');
const { clientEvent, clientQuotation, clientAssetAllowed } = load('lib/client-portal.ts');
const { studioInsights } = load('lib/studio-insights.ts');
const { isStudioData } = load('lib/studio-validation.ts');
const quote = (id='recipe') => ({ id, name:'Rose design',quantity:1,status:'DRAFT',clientName:'Sample',occasion:'Wedding',eventDate:'2026-10-10',lines:[{id:'line',inventoryId:'rose',name:'Rose',category:'stem',quantity:4,unitCost:2}],labourHours:1,labourRate:10,wastagePercent:0,markupPercent:100,deliveryFee:0,discount:0,vatApplies:true,vatRate:20,createdAt:'2026-09-08T12:00:00Z' });
const state = () => ({ ...emptyStudio(),inventory:[{id:'rose',name:'Rose',costPerStem:2,stemsPurchased:20,stemsRemaining:20}],plans:[{id:'event',clientName:'Sample',type:'Wedding',notes:'Shared brief',createdAt:'2026-09-08T12:00:00Z',finishedEstimate:null,eventDate:'2026-10-10'}] });
const apply = (data, command) => applyStudioCommand(data, command, '2026-09-08T12:00:00Z');
const saved = (data=state(),q=quote()) => apply(data,{type:'saveRecipe',recipe:q,status:'QUOTE'}).data;
const purchased = (data=saved()) => apply(data,{type:'purchaseRecipe',recipeId:'recipe',allowShortages:false}).data;
const formal = () => ({id:'formal',planId:'event',clientName:'Sample',name:'Wedding flowers',recipeIds:['a','b'],recipes:[],setup:10,delivery:5,discount:0,vatRate:20,vatApplies:true,total:0,vat:0,status:'QUOTE',createdAt:'2026-09-08T12:00:00Z',updatedAt:'2026-09-08T12:00:00Z',terms:'Terms'});
const group = () => { let d=state(); for(const id of ['a','b']) d=saved(d,{...quote(id),planId:'event'}); return apply(d,{type:'saveEventQuote',quote:formal()}).data; };
test('draft and quote save never reserve or deduct stock; purchased retries do not duplicate',()=>{let d=apply(state(),{type:'saveRecipe',recipe:quote(),status:'DRAFT'}).data;assert.equal(d.inventory[0].stemsRemaining,20);d=saved(d);const first=apply(d,{type:'purchaseRecipe',recipeId:'recipe',allowShortages:false});assert.equal(first.transactions.length,1);const second=apply(first.data,{type:'purchaseRecipe',recipeId:'recipe',allowShortages:false});assert.equal(second.transactions.length,0);assert.equal(second.data.jobs.length,1);assert.equal(second.data.inventory[0].stemsRemaining,16);assert.deepEqual(stockSummary(second.data,'rose'),{available:16,reserved:4,onHand:20});});
test('shortages require explicit review and completion waits for stock',()=>{const d=state();d.inventory[0].stemsRemaining=2;const q=saved(d);assert.throws(()=>purchased(q),/required/);const result=apply(q,{type:'purchaseRecipe',recipeId:'recipe',allowShortages:true});assert.equal(result.data.inventory[0].stemsRemaining,0);assert.throws(()=>apply(result.data,{type:'production',recipeId:'recipe',status:'Completed',assignedTo:'Jade',due:''}),/required/);assert.equal(result.data.jobs[0].consumedAt,undefined);});
test('production consumes committed stock once without a second deduction',()=>{const d=purchased();const done=apply(d,{type:'production',recipeId:'recipe',status:'Completed',assignedTo:'Jade',due:''});assert.equal(done.data.inventory[0].stemsRemaining,16);assert.equal(done.transactions.filter(t=>t.kind==='Consume').length,1);assert.deepEqual(stockSummary(done.data,'rose'),{available:16,reserved:0,onHand:16});assert.equal(apply(done.data,{type:'production',recipeId:'recipe',status:'Packed',assignedTo:'Jade',due:''}).transactions.length,0);assert.throws(()=>apply(done.data,{type:'returnRecipe',recipeId:'recipe',reason:'Cancel'}),/production/);});
test('legacy purchases already deducted stock and are not deducted on completion again',()=>{const d=purchased();delete d.jobs[0].commitments;const next=apply(d,{type:'production',recipeId:'recipe',status:'Completed',assignedTo:'',due:''}).data;assert.equal(next.inventory[0].stemsRemaining,16);});
test('amendments release unused stock but cannot override production state',()=>{const d=purchased();const recipe=structuredClone(d.jobs[0]);recipe.lines[0].quantity=2;recipe.productionStatus='Delivered';const amended=apply(d,{type:'amendRecipe',recipe,reason:'Reduced quantity',allowShortages:false});assert.equal(amended.data.inventory[0].stemsRemaining,18);assert.equal(amended.data.jobs[0].productionStatus,'Not started');assert.equal(d.inventory[0].stemsRemaining,16);});
test('combined purchase is atomic when the second recipe lacks stock',()=>{const d=group();d.inventory[0].stemsRemaining=6;assert.throws(()=>apply(d,{type:'purchaseEventQuote',quoteId:'formal',allowShortages:false}),/required/);assert.equal(d.inventory[0].stemsRemaining,6);assert.equal(d.jobs.length,0);});
test('combined quote purchase blocks partial direct purchase and counts revenue once',()=>{const d=group();assert.throws(()=>apply(d,{type:'purchaseRecipe',recipeId:'a',allowShortages:false}),/event quotation/);const next=apply(d,{type:'purchaseEventQuote',quoteId:'formal',allowShortages:false}).data;const report=businessIntelligence(next);assert.equal(report.rows.length,1);assert.equal(report.revenue,next.operations.eventQuotes[0].total-next.operations.eventQuotes[0].vat);assert.equal(next.jobs.length,2);assert.equal(apply(next,{type:'purchaseEventQuote',quoteId:'formal',allowShortages:false}).transactions.length,0);});
test('quote purchase detects any changed costing or selling override',()=>{const d=group();d.quotes[0].sellingPriceExVat=100;assert.throws(()=>apply(d,{type:'purchaseEventQuote',quoteId:'formal',allowShortages:false}),/changed/);assert.notEqual(recipeRevision(quote()),recipeRevision({...quote(),supplierCharges:3}));});
test('event discount VAT is apportioned across taxable and exempt designs',()=>{const a={...quote(),sellingPriceExVat:100};const b={...quote('b'),sellingPriceExVat:100,vatApplies:false};assert.deepEqual(eventQuoteTotals([a,b],{setup:0,delivery:0,discount:100,vatRate:20,vatApplies:true}),{total:110,vat:10,net:100});});
test('profitability includes all costs and positive-profit tax only',()=>{const q={...quote(),quantity:2,sellingPriceExVat:200,deliveryCost:5,setupCost:6,collectionCost:7,supplierCharges:8,additionalExpenses:9,corporationTaxRate:25,lines:[...quote().lines,{id:'pack',name:'Wrap',category:'sundry',quantity:1,unitCost:3,costCategory:'Packaging',inventoryId:null}]};const input=recipeProfitInput(q);const model=profitModel(input);assert.equal(model.cost,calculateTotals(q).costSubtotal);assert.equal(model.packaging,6);assert.equal(model.labour,20);assert.equal(model.tax,Math.round(model.profit*.25*100)/100);assert.equal(model.gross-model.cost-model.vat-model.tax,model.retained);const loss=profitModel({...input,selling:1,vat:.2});assert.equal(loss.tax,0);assert.equal(loss.rating,'Loss making');});
test('invalid negative financial extras and excessive rates are rejected',()=>{for(const patch of [{supplierCharges:-2},{sellingPriceExVat:NaN},{corporationTaxRate:101}]){assert.throws(()=>saved(state(),{...quote(),...patch}));assert.equal(isStudioData({...state(),quotes:[{...quote(),...patch}]}),false);}});
test('multi-arrangement flower analytics scales quantities and costs',()=>{const d=purchased(saved(state(),{...quote(),quantity:2}));const insight=studioInsights(d);assert.equal(insight.rows[0].sold,8);assert.equal(insight.rows[0].cost,16);});
test('payment duplicate id is safe and refunds cannot exceed receipts',()=>{const d=purchased();const payment={id:'pay',orderId:'recipe',clientName:'Sample',amount:10,date:'2026-09-08',method:'Bank transfer',kind:'Deposit',reference:'Test'};const next=apply(d,{type:'payment',payment}).data;assert.equal(apply(next,{type:'payment',payment}).data.operations.payments.length,1);assert.throws(()=>apply(next,{type:'payment',payment:{...payment,id:'refund',amount:11,kind:'Refund'}}),/refund/i);});
test('client projection omits internal costs, notes, documents and recipe revisions',()=>{const d=group();const plan={...d.plans[0],details:{consultationNotes:'SECRET',documents:[{url:'/api/studio/assets/secret'}]},internalSecret:'SECRET'};const view=clientEvent(plan);const q=clientQuotation(d,d.operations.eventQuotes[0]);const text=JSON.stringify({view,q});assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('unitCost'));assert.ok(!text.includes('revision'));assert.ok(!text.includes('setupCost'));assert.equal(view.notes,'Shared brief');assert.equal(clientAssetAllowed(d,'other','/api/studio/assets/test'),false);});
test('private client endpoints refuse anonymous requests',async()=>{const mocks={'@/lib/client-auth':{clientGrant:async()=>null},'@/lib/studio-database':{createStudioDatabaseClient:()=>{throw Error('must not connect')}}};for(const path of ['app/api/client/route.ts','app/api/client/catalogue/route.ts']){const api=load(path,mocks);assert.equal((await api.GET(new Request('https://example.test/api/client'))).status,401);}});
test('client session cannot be promoted into the owner cookie; only password-bound owner sessions are valid',async()=>{const old={secret:process.env.AUTH_SECRET,password:process.env.STUDIO_PASSWORD};process.env.AUTH_SECRET='local-auth-test';process.env.STUDIO_PASSWORD='local-password';try{const {createHmac}=require('node:crypto');const key=createHmac('sha256','local-auth-test').update('studio-session:local-password').digest('base64url');for(const [role,signingKey,allowed] of [['client',key,false],['owner',key,true],[undefined,key,false],['owner','local-auth-test',false]]){const payload=Buffer.from(JSON.stringify({role,exp:Date.now()+100000})).toString('base64url');const token=payload+'.'+createHmac('sha256',signingKey).update(payload).digest('base64url');const auth=load('lib/studio-auth.ts',{'next/headers':{cookies:async()=>({get:()=>({value:token})})}});assert.equal(await auth.hasStudioSession(),allowed);}}finally{if(old.secret===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=old.secret;if(old.password===undefined)delete process.env.STUDIO_PASSWORD;else process.env.STUDIO_PASSWORD=old.password;}});
test('hire checks peak overlapping use rather than adding non-overlapping bookings',()=>{const d=state();d.operations={...load('lib/operations-types.ts').emptyOperations(),hireItems:[{id:'vase',name:'Vase',quantity:5,replacementCost:10,notes:'',category:'Vase'}],hireReservations:[{id:'a',itemId:'vase',planId:'event',clientName:'Sample',quantity:3,from:'2026-10-01',to:'2026-10-02',status:'Reserved',returned:0,damaged:0,lost:0,notes:''},{id:'b',itemId:'vase',planId:'event',clientName:'Sample',quantity:3,from:'2026-10-04',to:'2026-10-05',status:'Reserved',returned:0,damaged:0,lost:0,notes:''}]};const next=apply(d,{type:'reserveHire',reservation:{...d.operations.hireReservations[0],id:'c',quantity:2,from:'2026-10-01',to:'2026-10-05'}});assert.equal(next.data.operations.hireReservations.length,3);assert.throws(()=>apply(d,{type:'reserveHire',reservation:{...d.operations.hireReservations[0],id:'c',quantity:3,from:'2026-10-01',to:'2026-10-05'}}),/Only 2/);});
test('invoice issuance is idempotent and preserves accepted totals',()=>{const d=purchased();const total=d.jobs[0].totals.grossTotal;const next=apply(d,{type:'issueInvoice',orderId:'recipe'}).data;assert.ok(next.jobs[0].invoicedAt);assert.equal(next.jobs[0].totals.grossTotal,total);assert.equal(apply(next,{type:'issueInvoice',orderId:'recipe'}).data.jobs[0].invoicedAt,next.jobs[0].invoicedAt);});
test('AI and photo assistance reject client or anonymous access before calling a model',async()=>{const mocks={'ai':{},'@/lib/studio-auth':{hasStudioSession:async()=>false},'@/lib/studio-database':{createStudioDatabaseClient:()=>{throw Error('must not connect')}}};for(const path of ['app/api/studio/assistant/route.ts','app/api/studio/photo-analysis/route.ts']){const api=load(path,mocks);assert.equal((await api.POST(new Request('https://example.test'))).status,401);assert.equal((await api.GET(new Request('https://example.test'))).status,401);}});


test('client presentation renders the floral plan without internal notes, costs, VAT calculations or stock', () => {
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  const { default: Presentation } = load('app/studio/event-presentation.tsx', {'./ops-ui': { Photo: ({src,alt}) => React.createElement('img',{src:src || '/placeholder',alt}) }});
  const d = group(); d.plans[0].details = { consultationNotes: 'INTERNAL_SECRET_NOTE' }; d.plans[0].palette = 'Soft garden colours';
  const html = renderToStaticMarkup(React.createElement(Presentation, {plan:clientEvent(d.plans[0]),quotes:d.operations.eventQuotes.map(q=>clientQuotation(d,q)),close:()=>{}}));
  assert.match(html,/Soft garden colours/); assert.match(html,/Your complete quote/);
  assert.doesNotMatch(html,/INTERNAL_SECRET_NOTE|Gross profit|margin|\bVAT\b|corporation tax|Inventory|unitCost|setupCost/i);
});
test('paid standalone order cannot be amended below payments already recorded', () => {
  let d=purchased(); const total=d.jobs[0].totals.grossTotal;
  d=apply(d,{type:'payment',payment:{id:'paid-amend',orderId:'recipe',clientName:'Sample',kind:'Balance',method:'Cash',amount:total,date:'2026-09-08',reference:''}}).data;
  assert.throws(()=>apply(d,{type:'amendRecipe',recipe:{...d.jobs[0],sellingPriceExVat:1},reason:'Reduce price'}),/refund/i);
});
test('cancelled orders cannot receive a new payment', () => {
  const d=apply(purchased(),{type:'returnRecipe',recipeId:'recipe',reason:'Not needed'}).data;
  assert.throws(()=>apply(d,{type:'payment',payment:{id:'cancelled-payment',orderId:'recipe',clientName:'Sample',kind:'Balance',method:'Cash',amount:1,date:'2026-09-08',reference:''}}),/Cancelled orders/);
});
test('deleting a stock item removes it without recording wastage or a stock movement', () => {
  const d = state(); d.inventory.push({id:'tulip',name:'Tulip',costPerStem:1,stemsPurchased:10,stemsRemaining:10}); d.wastage = [{id:'old-waste',inventoryId:'rose',name:'Rose',quantity:2,unitCost:2,recordedAt:'2026-09-01T12:00:00Z'}];
  const result = apply(d,{type:'deleteStock',inventoryId:'rose'});
  assert.deepEqual(result.data.inventory.map(i=>i.id),['tulip']); assert.equal(result.data.inventory[0].stemsRemaining,10);
  assert.deepEqual(result.transactions,[]); assert.deepEqual(result.data.wastage,d.wastage); assert.deepEqual(result.recordIds,['rose']);
  assert.throws(()=>apply(result.data,{type:'deleteStock',inventoryId:'rose'}),/already been deleted/);
});
test('stock reserved for purchased work cannot be deleted until that order is cancelled', () => {
  const d = purchased();
  assert.throws(()=>apply(d,{type:'deleteStock',inventoryId:'rose'}),/reserved for purchased work/);
  const cancelled = apply(d,{type:'returnRecipe',recipeId:'recipe',reason:'Test order'}).data;
  assert.equal(apply(cancelled,{type:'deleteStock',inventoryId:'rose'}).data.inventory.length,0);
});
test('stock value uses the recorded cost of stock still in the studio, including stems reserved for purchased work', () => {
  const d = state(); d.inventory.push({id:'tulip',name:'Tulip',costPerStem:0.85,stemsPurchased:10,stemsRemaining:3});
  assert.deepEqual(stockValue(d,'rose'),{value:40,reserved:0}); assert.deepEqual(stockValue(d,'tulip'),{value:2.55,reserved:0});
  assert.deepEqual(totalStockValue(d),{value:42.55,reserved:0});
  const bought = purchased(saved(d));
  assert.deepEqual(stockValue(bought,'rose'),{value:40,reserved:8}); assert.deepEqual(totalStockValue(bought),{value:42.55,reserved:8});
  const made = apply(bought,{type:'production',recipeId:'recipe',status:'Completed',assignedTo:'Jade',due:''}).data;
  assert.deepEqual(totalStockValue(made),{value:34.55,reserved:0});
  assert.deepEqual(totalStockValue({...emptyStudio(),inventory:[]}),{value:0,reserved:0});
});
const { deletionScope, describeDeletion } = load('lib/studio-commands.ts');
const booked = () => {
  let d = apply(group(), {type:'purchaseEventQuote',quoteId:'formal',allowShortages:false}).data;
  d = apply(d, {type:'payment',payment:{id:'deposit',orderId:'formal',clientName:'Sample',kind:'Deposit',method:'Cash',amount:20,date:'2026-09-08',reference:''}}).data;
  const ops = d.operations; const client = d.customers[0].id;
  d.plans[0].customerId = client;
  ops.deliveries.push({id:'drop',planId:'event',clientName:'Sample',address:'',venue:'',contact:'',phone:'',date:'2026-10-10',window:'',setupTime:'',collectionDate:'',collectionTime:'',driver:'',vehicle:'',notes:'',access:'',parking:'',setupRequirements:'',status:'Planned',checklist:[]});
  ops.tasks.push({id:'task',planId:'event',title:'Prep',due:'2026-10-09',assignedTo:'',completed:false,notes:''});
  ops.hireItems.push({id:'vase',name:'Vase',category:'Vase',quantity:5,replacementCost:10,notes:''});
  ops.hireReservations.push({id:'hire',itemId:'vase',planId:'event',clientName:'Sample',quantity:2,from:'2026-10-09',to:'2026-10-11',status:'Reserved',returned:0,damaged:0,lost:0,notes:''});
  ops.leads.push({id:'lead',clientName:'Sample',contact:'',occasion:'Wedding',status:'Won',eventDate:'2026-10-10',followUpDate:'',consultationDate:'',consultationTime:'',notes:'',createdAt:'2026-09-01',customerId:client,planId:'event'});
  ops.crm.push({id:'note',customerId:client,kind:'Note',text:'Test client',date:'2026-09-01',dueDate:'',completed:false,assets:[]});
  ops.recurring.push({id:'weekly',customerId:client,clientName:'Sample',recipeId:'',frequency:'Weekly',price:30,address:'',style:'',colours:'',variations:'',billing:'',start:'2026-09-01',end:'',nextDate:'2026-09-15',status:'Active'});
  // Another client's event, and a different client who happens to share the name, must be untouched.
  d.customers.push({id:'other',name:'Other',contact:'',notes:'',createdAt:'2026-09-01'},{id:'twin',name:'Sample',contact:'',notes:'',createdAt:'2026-09-01'});
  d.plans.push({id:'other-event',clientName:'Other',customerId:'other',type:'Funeral',notes:'',createdAt:'2026-09-01',finishedEstimate:null,eventDate:'2026-11-01'},{id:'twin-event',clientName:'Sample',customerId:'twin',type:'Wedding',notes:'',createdAt:'2026-09-01',finishedEstimate:null,eventDate:'2026-12-01'});
  d.quotes.push({...quote('template'),clientName:'',isTemplate:true});
  return d;
};
test('deleting an event removes its recipes, quotation, payments and bookings and returns reserved stock without wastage', () => {
  const d = booked(); assert.equal(d.inventory[0].stemsRemaining,12);
  const summary = describeDeletion(deletionScope(d,{planId:'event'}));
  assert.deepEqual(summary.removed,['1 event','2 recipes','1 quotation','1 payment (£20.00)','1 delivery','1 hire booking','1 task']);
  assert.equal(summary.stockReturned,'Reserved stock goes back into Inventory: 8 Rose.');
  const result = apply(d,{type:'deleteEvent',planId:'event'}); const next = result.data;
  assert.deepEqual(next.plans.map(p=>p.id),['other-event','twin-event']); assert.equal(next.jobs.length,0); assert.deepEqual(next.quotes.map(q=>q.id),['template']);
  assert.equal(next.operations.eventQuotes.length,0); assert.equal(next.operations.payments.length,0); assert.equal(next.operations.deliveries.length,0);
  assert.equal(next.operations.tasks.length,0); assert.equal(next.operations.hireReservations.length,0);
  assert.equal(next.inventory[0].stemsRemaining,20); assert.deepEqual(stockSummary(next,'rose'),{available:20,reserved:0,onHand:20});
  assert.deepEqual(result.transactions.map(t=>[t.kind,t.quantity]),[['Release',4],['Release',4]]); assert.deepEqual(next.wastage,d.wastage);
  // The client, their notes and their enquiry stay; the enquiry just loses its link to the deleted event.
  assert.equal(next.customers.length,3); assert.equal(next.operations.crm.length,1); assert.equal(next.operations.leads[0].planId,undefined);
  assert.match(result.action,/^Event deleted: Sample wedding on 2026-10-10/); assert.ok(isStudioData(next));
  assert.throws(()=>apply(next,{type:'deleteEvent',planId:'event'}),/already been deleted/);
});
test('deleting a client removes their events and linked records but no one else’s', () => {
  const d = booked(); const client = d.customers[0].id;
  const scope = deletionScope(d,{customerId:client});
  assert.deepEqual(describeDeletion(scope).removed,['1 event','2 recipes','1 quotation','1 payment (£20.00)','1 delivery','1 hire booking','1 task','1 enquiry','1 client note','1 routine flower order']);
  const next = apply(d,{type:'deleteClient',customerId:client}).data;
  assert.deepEqual(next.customers.map(c=>c.id),['other','twin']); assert.deepEqual(next.plans.map(p=>p.id),['other-event','twin-event']);
  assert.deepEqual(next.quotes.map(q=>q.id),['template']); assert.equal(next.jobs.length,0); assert.equal(next.inventory[0].stemsRemaining,20);
  for (const key of ['eventQuotes','payments','deliveries','tasks','hireReservations','leads','crm','recurring']) assert.equal(next.operations[key].length,0,key);
  assert.equal(next.operations.hireItems.length,1); assert.ok(isStudioData(next));
  assert.throws(()=>apply(next,{type:'deleteClient',customerId:client}),/already been deleted/);
});
test('deleting an event keeps stock already used in production as used', () => {
  let d = booked(); for (const id of ['a','b']) d = apply(d,{type:'production',recipeId:id,status:'Completed',assignedTo:'',due:''}).data;
  const result = apply(d,{type:'deleteEvent',planId:'event'});
  assert.equal(describeDeletion(deletionScope(d,{planId:'event'})).stockReturned,''); assert.deepEqual(result.transactions,[]); assert.equal(result.data.inventory[0].stemsRemaining,12);
});
