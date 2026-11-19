import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {managedForwardFor,sameListener} from '../mods/port-manager/forward-match.js';
import {forwardFeedback} from '../mods/port-manager/forward-feedback.js';
import {browserUrl} from '../mods/port-manager/port-url.js';

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
 const context={View:class{},div:el,h_flex:el,v_flex:el,svg:el,Input:{new:el},settings:()=>({}),shared:()=>null,managedForwardFor,sameListener,forwardFeedback,browserUrl};
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

test('row hover reveals local and forward actions and running links open the forwarded port',()=>{
 const elements=new Map();
 function el(){const target={};let proxy;proxy=new Proxy(target,{get(_t,key){
  if(key==='id')return id=>{elements.set(id,target);return proxy};
  if(key==='on_click')return fn=>{target.click=fn;return proxy};
  if(key==='on_hover')return fn=>{target.hover=fn;return proxy};
  if(key==='text_color')return value=>{target.color=value;return proxy};
  if(key==='when')return (condition,fn)=>condition?fn(proxy):proxy;
  return ()=>proxy;
 }});return proxy;}
 let source=readFileSync(new URL('../mods/port-manager/main.js',import.meta.url),'utf8');
 source=source.replace(/^import .*;\s*$/gm,'').replace('export default class PortManager','class PortManager')+'\nthis.PortManager=PortManager;';
 const context={View:class{},div:el,h_flex:el,v_flex:el,svg:el,Input:{new:el},settings:()=>({}),shared:()=>null,managedForwardFor,sameListener,forwardFeedback,browserUrl};
 vm.runInNewContext(source,context);
 const view=new context.PortManager();view.forwardEntries=[];view.forwardStates={};view.forwardRecord=null;
 let opened;const cx={notify(){},stop_propagation(){},open_url(url){opened=url}};
 const t={dim:'dim',muted:'muted',foreground:'foreground'};
 const local={machine:null,host:'*',port:3000};
 view.portRow({record:local,stale:false},'local',t);
 assert.equal(elements.get('pm-open-local-local').color,'#00000000');
 elements.get('pm-row-local').hover(true,cx);elements.clear();view.portRow({record:local,stale:false},'local',t);
 assert.equal(elements.get('pm-open-local-local').color,'dim');
 elements.get('pm-open-local-local').click({},cx);assert.equal(opened,'http://localhost:3000');
 const remote={machine:'mbp',host:'*',port:4000};
 elements.clear();view.portRow({record:remote,stale:false},'remote',t);
 assert.equal(elements.get('pm-forward-action-remote').color,'#00000000');
 elements.get('pm-row-remote').hover(true,cx);elements.clear();view.portRow({record:remote,stale:false},'remote',t);
 assert.equal(elements.get('pm-forward-action-remote').color,'dim');
 const item={identity:{token:'token',address:'terminal'},metadata:{machine:'mbp',host:'*',remote:4000,local:8080}};
 view.forwardEntries=[item];view.forwardStates={token:{state:'running'}};
 elements.clear();view.portRow({record:remote,stale:false},'remote',t);
 elements.get('pm-forward-link-remote').click({},cx);assert.equal(opened,'http://127.0.0.1:8080');
 view.forwardStates={token:{state:'stopped'}};elements.clear();view.portRow({record:remote,stale:false},'remote',t);
 assert.equal(elements.get('pm-forward-link-remote').click,undefined);
});
