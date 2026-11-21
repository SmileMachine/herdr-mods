import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForwardStore} from '../mods/port-manager/forward-store.js';
import {createForwardAdapter} from '../mods/port-manager/forward-adapter.js';
function fixture(){
 let data=null,output={code:1,stdout:'',stderr:''};const calls=[];
 const store=createForwardStore({path:'/state',read:async()=>data,write:async(_p,v,old)=>{if(data!==old)throw Error('stale');data=v}});
 const hc=async args=>{calls.push(args);return {code:0,stdout:JSON.stringify(args[0]==='machine'?{machines:[{name:'m'}]}:args[0]==='run'?{address:'t1'}:{state:'live'})}};
 const exec=async(...args)=>{calls.push(args);return output};
 return {adapter:createForwardAdapter({hc,exec,store,randomToken:async()=> 'a'.repeat(32)}),calls,set output(v){output=v},set data(v){data=v}};
}
test('uses argv, detects conflicts and requires unambiguous loopback PID',async()=>{
 const f=fixture();assert.equal(await f.adapter.portInUse(3000),false);
 f.output={code:0,stdout:'p123\ncssh\nn127.0.0.1:3000\n',stderr:''};
 assert.equal(await f.adapter.listenerOwner(3000),123);assert.equal(await f.adapter.portInUse(3000),true);
 assert.equal(await f.adapter.startTerminal('x=y',['ssh','-N','remote']), 't1');
 assert.deepEqual(f.calls.at(-1).slice(-4),['--','ssh','-N','remote']);
 f.output={code:0,stdout:'p123\ncssh\nn*:3000\n',stderr:''};await assert.rejects(f.adapter.listenerOwner(3000),/ambiguous/);
 f.output={code:1,stdout:'',stderr:'permission denied'};await assert.rejects(f.adapter.portInUse(3000),/inspect/);
});
test('saved entries survive adapter calls and corrupt storage fails closed',async()=>{
 const f=fixture(),item={identity:{token:'abc'},metadata:{machine:'m',host:'*',remote:3000}};
 await f.adapter.save(item);assert.deepEqual(await f.adapter.lookup(item.metadata),item);
 await assert.rejects(f.adapter.save(item),/Duplicate/);await f.adapter.remove('abc');assert.deepEqual(await f.adapter.list(),[]);
 f.data='{';await assert.rejects(f.adapter.list());await assert.rejects(f.adapter.lookup(item.metadata));
});
