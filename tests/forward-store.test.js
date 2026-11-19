import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForwardStore} from '../mods/port-manager/forward-store.js';
test('independent views share persisted entries and removal',async()=>{
 let raw=null; const api={path:'/state',read:async()=>raw,write:async(_p,next,expected)=>{if(raw!==expected)throw Error('stale');raw=next}};
 const a=createForwardStore(api),b=createForwardStore(api),entry={identity:{token:'1'},metadata:{machine:'m',host:'*',remote:3000}};
 await a.save(entry);assert.deepEqual(await b.list(),[entry]);await b.remove('1');assert.deepEqual(await a.list(),[]);
});
test('concurrent saves reject stale snapshots rather than overwrite',async()=>{
 let raw=null;const api={path:'/state',read:async()=>raw,write:async(_p,next,expected)=>{if(raw!==expected)throw Error('stale');raw=next}};
 const a=createForwardStore(api),b=createForwardStore(api);
 const result=await Promise.allSettled([a.save({identity:{token:'1'},metadata:{machine:'m',host:'*',remote:1}}),b.save({identity:{token:'2'},metadata:{machine:'m',host:'*',remote:2}})]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal((await a.list()).length,1);
});
test('invalid storage fails closed',async()=>{const store=createForwardStore({path:'/state',read:async()=>'{}',write:async()=>{throw Error('unexpected')}});await assert.rejects(store.list(),/invalid/);});
test('pending intent is atomically replaced by verified identity',async()=>{
 let raw=null;const api={path:'/state',read:async()=>raw,write:async(_p,next,expected)=>{if(raw!==expected)throw Error('stale');raw=next}};
 const store=createForwardStore(api),metadata={machine:'m',host:'*',remote:3};
 await store.save({identity:{token:'1'},metadata,pending:true});
 await store.update({identity:{token:'1',address:'t1'},metadata});
 assert.equal((await store.list())[0].identity.address,'t1');
 await assert.rejects(store.update({identity:{token:'2'},metadata}),/not found/);
});
