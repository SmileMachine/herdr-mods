import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {managedForwardFor,sameListener} from '../mods/port-manager/forward-match.js';

// Exercise the actual GPUI render branch and click callback while cloning the
// listener like a fresh shared-state snapshot on every render.
test('clicking a listener forward arrow opens the inline editor after snapshot cloning',()=>{
 const elements=new Map();
 // Define separately so fluent methods always return the same proxy.
 function el(){const target={};let proxy;proxy=new Proxy(target,{get(_t,key){
  if(key==='id')return id=>{target.id=id;elements.set(id,target);return proxy};
  if(key==='on_click')return fn=>{target.click=fn;return proxy};
  if(key==='when')return (condition,fn)=>condition?fn(proxy):proxy;
  return ()=>proxy;
 }});return proxy;}
 let source=readFileSync(new URL('../mods/port-manager/main.js',import.meta.url),'utf8');
 source=source.replace(/^import .*;\s*$/gm,'').replace('export default class PortManager','class PortManager')+'\nthis.PortManager=PortManager;';
 const context={View:class{},div:el,h_flex:el,v_flex:el,svg:el,Input:{new:el},settings:()=>({}),shared:()=>null,managedForwardFor,sameListener};
 vm.runInNewContext(source,context);
 const view=new context.PortManager();view.forwardEntries=[];view.forwardStates={};view.forwardRecord=null;
 view.localPort={set_value(value){this.value=value}};
 const cx={notify(){},stop_propagation(){}};
 const record={machine:'mbp',host:'*',port:49686,pid:709,name:'test'};
 view.portRow({record,stale:false},'other-0-0',{});
 assert.ok(elements.get('pm-forward-action-other-0-0')?.click,'forward arrow is actionable');
 elements.get('pm-forward-action-other-0-0').click({},cx);
 elements.clear();
 view.portRow({record:JSON.parse(JSON.stringify(record)),stale:false},'other-0-0',{});
 assert.ok(elements.has('pm-save-forward-other-0-0'),'inline submit appears on the same listener');
 assert.ok(elements.has('pm-cancel-forward-other-0-0'),'inline cancel appears');
 assert.equal(view.localPort.value,'49686');
});
