import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProcesses, scanMachine, mergeMachineSnapshots } from '../mods/port-manager/discovery.js';

test('parse process records and unknown tty', () => {
 const p=parseProcesses('10 1 ??\n20 10 ttys01\ninvalid'); assert.equal(p.parents.get(20),10); assert.equal(p.ttys.has(20),true); assert.equal(p.ttys.has(10),false);
});
test('scan classifies two strategies and isolates machine context', async () => {
 const calls=[]; const adapter={exec:async(cmd,args,opts)=>{calls.push([cmd,opts.on]); return cmd==='lsof'?{code:0,stdout:'p20\ncnode\nn127.0.0.1:3000\n'}:{code:0,stdout:'20 10 ttys01\n10 1 ??\n'};}};
 const ctx={shells:async()=>new Map([[10,'s']]),candidates:async()=>[{root:'/repo',space:'other'}],cwd:async()=>'/repo/src'};
 const r=await scanMachine('remote',adapter,ctx); assert.equal(r[0].processSpace,'s'); assert.equal(r[0].cwdSpace,'other'); assert.equal(r[0].machine,'remote'); assert.ok(calls.every(x=>x[1]==='remote'));
});
test('failed lsof falls back to ss and leaves process unknown if ps fails', async()=>{
 const adapter={exec:async(cmd)=>cmd==='lsof'?{code:127,stderr:'missing'}:cmd==='ss'?{code:0,stdout:'LISTEN 0 4 *:80 *:*'}:{code:1}};
 const r=await scanMachine(null,adapter,{shells:async()=>new Map(),candidates:async()=>[],cwd:async()=>null}); assert.equal(r[0].pid,null); assert.equal(r[0].terminal,'unknown');
});
test('failed scan is not an empty success and stale data remains marked',()=>{
 const prev=[{machine:'a',records:[{port:80}],at:42}];
 const r=mergeMachineSnapshots(['a','b'],[{status:'rejected',reason:Error('offline')},{status:'fulfilled',value:[]}],prev,100);
 assert.equal(r[0].stale,true); assert.equal(r[0].records[0].port,80); assert.equal(r[0].at,42); assert.equal(r[1].stale,false);
});
