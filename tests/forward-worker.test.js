import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForwardWorker} from '../mods/port-manager/forward-worker.js';
test('worker owns operation and ignores duplicate polls while pending',async()=>{
 let value={id:'1',phase:'queued',action:'start',request:{port:1}}, release;let calls=0;
 const worker=createForwardWorker({read:()=>value,write:v=>{value=v},controller:{start:async()=>{calls++;return await new Promise(r=>release=r)}},adapter:{}});
 const pending=worker.execute();await worker.execute();assert.equal(value.phase,'running');assert.equal(calls,1);release({state:'running'});await pending;assert.equal(value.phase,'done');assert.equal(value.result.state,'running');
});
test('startup marks interrupted requests unknown rather than replaying',async()=>{
 let value={id:'2',phase:'running',action:'start'};let calls=0;
 const worker=createForwardWorker({read:()=>value,write:v=>{value=v},controller:{start:async()=>calls++},adapter:{}});
 worker.interrupt();await worker.execute();assert.equal(value.result.state,'unknown');assert.equal(calls,0);
});
test('stop resolves saved identity on worker side',async()=>{
 let value={id:'3',phase:'queued',action:'stop',token:'x'},seen;
 const worker=createForwardWorker({read:()=>value,write:v=>{value=v},controller:{stop:async(a,b)=>{seen=[a,b];return {state:'stopped'}}},adapter:{list:async()=>[{identity:{token:'x'},metadata:{local:123}}]}});
 await worker.execute();assert.equal(value.result.state,'stopped');assert.equal(seen[1].local,123);
});
