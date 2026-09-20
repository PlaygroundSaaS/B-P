import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function compile(file, mocks={}){const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('module','exports','require',code)(m,m.exports,n=>n in mocks?mocks[n]:require(n));return m.exports;}
const requestBody=compile('../lib/request-body.ts');
const fields={name:'Isolated test',email:'test@example.test',occasion:'Wedding',message:'A local test enquiry'};
const request=(body=fields,origin='https://www.bramblesandpetals.co.uk')=>new Request('https://www.bramblesandpetals.co.uk/api/enquiry',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
test('enquiries persist before email; missing or failed email never loses a saved enquiry',async()=>{
 const old={key:process.env.RESEND_API_KEY,from:process.env.RESEND_FROM_EMAIL,fetch:global.fetch};let saved=0,sends=0,canSave=true;
 const {POST}=compile('../app/api/enquiry/route.ts',{'@/lib/request-body':requestBody,'@/lib/website-enquiry':{captureWebsiteEnquiry:async()=>{saved++;return canSave;}}});
 try{
  delete process.env.RESEND_API_KEY;delete process.env.RESEND_FROM_EMAIL;
  global.fetch=async()=>{sends++;assert.ok(saved>0);return new Response('{}',{status:500});};
  assert.equal((await POST(request())).status,200);assert.equal(saved,1);assert.equal(sends,0);
  process.env.RESEND_API_KEY='local-test-only';process.env.RESEND_FROM_EMAIL='test@example.test';
  assert.equal((await POST(request())).status,200);assert.equal(sends,1);
  global.fetch=async()=>{throw new Error('timeout');};assert.equal((await POST(request())).status,200);
  canSave=false;assert.equal((await POST(request())).status,503);
  const before=saved;assert.equal((await POST(request({...fields,email:'invalid'}))).status,400);assert.equal(saved,before);
  assert.equal((await POST(request(fields,'https://other.example'))).status,403);assert.equal(saved,before);
  assert.equal((await POST(request({...fields,company:'bot'}))).status,200);assert.equal(saved,before);
 }finally{global.fetch=old.fetch;if(old.key===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old.key;if(old.from===undefined)delete process.env.RESEND_FROM_EMAIL;else process.env.RESEND_FROM_EMAIL=old.from;}
});
