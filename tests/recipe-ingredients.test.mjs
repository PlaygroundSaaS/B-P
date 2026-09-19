import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=await readFile(new URL('../app/studio/recipe-ingredients.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',compiled)(mod,mod.exports,name=>name==='@/lib/operations-model'?{newId:()=> 'new-line'}:name.endsWith('.module.css')?{default:{},__esModule:true}:require(name));
const Ingredients=mod.exports.default;
const data={inventory:[{id:'wrap',name:'Wrap',category:'Packaging',costPerStem:3,stemsRemaining:10},{id:'rose',name:'Rose',category:'Flowers',costPerStem:1.25,stemsRemaining:20}],materials:[{id:'ribbon',name:'Ribbon',category:'Sundries',unitCost:2}]};
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
test('flower choices exclude packaging and remove the Type control',()=>{const lines=[{id:'f',inventoryId:'rose',name:'Rose',category:'stem',quantity:5,unitCost:1.25}];const tree=Ingredients({data,lines,onChange(){}});const html=renderToStaticMarkup(tree);const flowers=html.split('recipe-extras-heading')[0];assert.match(flowers,/Rose/);assert.doesNotMatch(flowers,/Wrap|Custom material|>Type</);assert.match(html,/Sundries &amp; packaging/);});
test('adding a flower skips materials and fills the linked stem price',()=>{let result;const tree=Ingredients({data,lines:[],onChange:value=>result=value});nodes(tree).find(n=>n.type==='button'&&n.props.children==='+ Add flower').props.onClick();assert.equal(result[0].inventoryId,'rose');assert.equal(result[0].unitCost,1.25);assert.equal(result[0].category,'stem');});
test('adding separate extras preserves existing flower quantities, IDs and costs',()=>{const flower={id:'f',inventoryId:'rose',name:'Rose',category:'stem',quantity:5,unitCost:1.25};for(const [label,costCategory] of [['+ Add sundry','Sundry'],['+ Add packaging','Packaging']]){let result;const tree=Ingredients({data,lines:[flower],onChange:value=>result=value});nodes(tree).find(n=>n.type==='button'&&n.props.children===label).props.onClick();assert.deepEqual(result[0],flower);assert.equal(result[1].inventoryId,null);assert.equal(result[1].category,'sundry');assert.equal(result[1].costCategory,costCategory);}});
