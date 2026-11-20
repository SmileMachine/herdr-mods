import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('advanced settings start collapsed and toggle with mouse and keyboard',()=>{
 const elements=new Map();
 function el(){const target={};let proxy;proxy=new Proxy(target,{get(_t,key){
  if(key==='id')return id=>{elements.set(id,target);return proxy};
  if(key==='on_click')return fn=>{target.click=fn;return proxy};
  if(key==='on_key_down')return fn=>{target.key=fn;return proxy};
  if(key==='when')return (condition,fn)=>condition?fn(proxy):proxy;
  return ()=>proxy;
 }});return proxy;}
 let source=readFileSync(new URL('../mods/port-manager/main.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace('export default class PortManager','class PortManager')+'\nthis.PortManager=PortManager;';
 const emptyGroups={issues:[],spaceGroups:[],otherGroups:[]};
 const context={View:class{},div:el,h_flex:el,v_flex:el,svg:el,Input:{new:el},RadioGroup:{new:el},Radio:{new:el},Switch:{new:el},settings:()=>({}),theme:()=>({}),props:()=>({}),spaces:()=>[],shared:()=>null,compileFilter:()=>()=>true,groupPorts:()=>emptyGroups,createForwardRuntime:()=>({}),validateDrafts:()=>({})};
 vm.runInNewContext(source,context);
 const view=new context.PortManager(); const cx={notify(){},stop_propagation(){},timer:{every(){} }};
 // checking prevents startup I/O while still initializing popup state.
 context.checking=()=>true;context.props=()=>({view:'popup'});
 context.InputState={new:()=>({on(){}})};
 view.init({},cx);view.panel='settings';view.render(cx);
 assert.equal(view.advancedOpen,false);assert.ok(elements.has('pm-advanced-toggle'));assert.equal(elements.has('pm-advanced-settings'),false);
 elements.get('pm-advanced-toggle').click({},cx);elements.clear();view.render(cx);
 assert.ok(elements.has('pm-advanced-settings'));
 elements.get('pm-advanced-toggle').key({key:'enter'},cx);elements.clear();view.render(cx);
 assert.equal(elements.has('pm-advanced-settings'),false);
});


test('port groups fold independently with space and terminal open, process closed',()=>{
 const elements=new Map();
 function el(){const target={};let proxy;proxy=new Proxy(target,{get(_t,key){
  if(key==='id')return id=>{elements.set(id,target);return proxy};
  if(key==='on_click')return fn=>{target.click=fn;return proxy};
  if(key==='on_key_down')return fn=>{target.key=fn;return proxy};
  if(key==='when')return (condition,fn)=>condition?fn(proxy):proxy;
  return ()=>proxy;
 }});return proxy;}
 const source=readFileSync(new URL('../mods/port-manager/main.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace('export default class PortManager','class PortManager')+'\nthis.PortManager=PortManager;';
 const record={record:{port:3000,host:'*',name:'node'},stale:false};
 const groups={issues:[],spaceGroups:[{space:{id:'s',name:'Space',machine:null},records:[record]}],otherGroups:[{machine:null,category:'terminal',records:[record]},{machine:null,category:'process',records:[record]}]};
 const context={View:class{},div:el,h_flex:el,v_flex:el,svg:el,settings:()=>({}),theme:()=>({}),props:()=>({}),spaces:()=>[],shared:key=>key==='port-manager.snapshots'?[{records:[record.record]}]:null,compileFilter:()=>()=>true,groupPorts:()=>groups,managedForwardFor:()=>null,forwardFeedback:()=>null,browserUrl:()=>null};
 vm.runInNewContext(source,context);const view=new context.PortManager();
 view.popup=true;view.panel=null;view.forwardEntries=[];view.forwardStates={};view.forwardRecord=null;view.groupOverrides=new Map();
 const cx={notify(){},stop_propagation(){}};
 const render=()=>{elements.clear();view.render(cx);};render();
 assert.ok(elements.has('pm-row-space-0-0'));assert.ok(elements.has('pm-row-other-0-0'));assert.equal(elements.has('pm-row-other-1-0'),false);
 elements.get('pm-space-0').click({},cx);render();assert.equal(elements.has('pm-row-space-0-0'),false);assert.ok(elements.has('pm-row-other-0-0'));
 elements.get('pm-other-1').key({key:'enter'},cx);render();assert.ok(elements.has('pm-row-other-1-0'));
 elements.get('pm-other-title').click({},cx);render();assert.equal(elements.has('pm-other-0'),false);assert.equal(elements.has('pm-row-other-1-0'),false);
 elements.get('pm-other-title').click({},cx);render();assert.ok(elements.has('pm-row-other-1-0'));assert.equal(elements.has('pm-row-space-0-0'),false);
});
