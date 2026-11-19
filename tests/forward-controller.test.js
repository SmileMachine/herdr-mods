import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForwardController} from '../mods/port-manager/forward-controller.js';
const request={machine:'m',host:'127.0.0.1',remotePort:3000,localPort:4000};
function fixture(){
 let terminal, saved, killed=0, owner=null;
 const io={attempts:2,machines:async()=>[{name:'m',target:'m'}],token:async()=>'a'.repeat(32),lookup:async()=>null,portInUse:async()=>false,
 startTerminal:async(label,argv)=>{let i=label.indexOf('=');terminal={address:'t1',state:'live',pid:40,created_ms:11,argv,labels:{[label.slice(0,i)]:label.slice(i+1)}};return 't1';},
 getTerminal:async()=>terminal,listenerOwner:async()=>owner,save:async(x)=>{saved=x},remove:async()=>{saved=null},stopTerminal:async()=>{killed++;terminal={...terminal,state:'finished'}},wait:async()=>{}};
 return {io,controller:createForwardController(io),get saved(){return saved},get killed(){return killed},set owner(x){owner=x},get terminal(){return terminal},set terminal(x){terminal=x}};
}
test('start only reports running after matching terminal identity and listener PID; stop verifies again',async()=>{
 const f=fixture(); f.owner=40; assert.equal((await f.controller.start(request)).state,'running');
 assert.equal((await f.controller.stop(f.saved.identity,f.saved.metadata)).state,'stopped'); assert.equal(f.killed,1); assert.equal(f.saved,null);
});
test('occupied port blocks startup; foreign listener and timeout never claim success or kill',async()=>{
 const a=fixture(); a.io.portInUse=async()=>true; await assert.rejects(a.controller.start(request),/already in use/); assert.equal(a.killed,0);
 const b=fixture();b.owner=55;assert.equal((await b.controller.start(request)).state,'unknown'); assert.equal(b.killed,0);
 const c=fixture();assert.equal((await c.controller.start(request)).state,'unknown');assert.equal(c.killed,0);
});
test('changed identity or ownership refuses stop and preserves saved entry',async()=>{
 const f=fixture();f.owner=40;await f.controller.start(request);f.terminal={...f.terminal,created_ms:12};
 assert.equal((await f.controller.stop(f.saved.identity,f.saved.metadata)).state,'unknown');assert.equal(f.killed,0);assert.ok(f.saved);
});
test('failed save and early ssh exit are not reported as success',async()=>{
 const a=fixture();a.io.save=async()=>{throw Error()};assert.equal((await a.controller.start(request)).state,'unknown');assert.equal(a.killed,0);
 const b=fixture();const start=b.io.startTerminal;b.io.startTerminal=async(...args)=>{const address=await start(...args);b.terminal={...b.terminal,state:'finished'};return address};
 assert.equal((await b.controller.start(request)).state,'failed');assert.equal(b.killed,0);
});

test('stop rejects mismatched persisted mapping',async()=>{
 const f=fixture();f.owner=40;await f.controller.start(request);
 assert.equal((await f.controller.stop(f.saved.identity,{...f.saved.metadata,local:4001})).state,'unknown');
 assert.equal(f.killed,0);
});
