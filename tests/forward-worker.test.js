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
test('closing a UI observer does not cancel work owned by the worker',async()=>{
 let shared={id:'4',phase:'queued',action:'start',request:{}},release;
 const worker=createForwardWorker({read:()=>shared,write:v=>{shared=v},controller:{start:async()=>new Promise(r=>{release=r})},adapter:{}});
 const task=worker.execute();const initialObserver=shared.phase;assert.equal(initialObserver,'running');
 // The observer is discarded; only the persistent owner holds the task.
 release({state:'running'});await task;assert.equal(shared.phase,'done');assert.equal(shared.result.state,'running');
});
test('edit stops the existing forward before starting the new mapping',async()=>{
 let value={id:'5',phase:'queued',action:'edit',token:'old',request:{localPort:4002}},calls=[];
 const worker=createForwardWorker({read:()=>value,write:v=>{value=v},controller:{stop:async()=>{calls.push('stop');return {state:'stopped'}},start:async req=>{calls.push(['start',req]);return {state:'running'}}},adapter:{list:async()=>[{identity:{token:'old'},metadata:{local:4001}}]}});
 await worker.execute();assert.deepEqual(calls,['stop',['start',{localPort:4002}]]);assert.equal(value.result.state,'running');
});
