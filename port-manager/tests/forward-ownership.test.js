import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planForward,FORWARD_LABEL} from '../mods/port-manager/forward-plan.js';
import {inspectForward} from '../mods/port-manager/forward-ownership.js';
const plan=planForward({machine:'m',host:'127.0.0.1',remotePort:3000,localPort:3001},[{name:'m',target:'m'}],'b'.repeat(32));
const term={address:'t1',state:'live',pid:10,labels:{[FORWARD_LABEL]:plan.label.slice(FORWARD_LABEL.length+1)}};
const table=new Map([[10,{name:'shell',ppid:1}],[11,{name:'ssh',ppid:10}],[12,{name:'node',ppid:10}],[13,{name:'ssh',ppid:1}]]);
test('requires live local labeled terminal, ssh ancestry, and exact loopback listener',()=>{
 assert.equal(inspectForward(term,table,[{pid:11,host:'127.0.0.1',port:3001}]).state,'verified');
 for (const socket of [{pid:12,host:'127.0.0.1',port:3001},{pid:13,host:'127.0.0.1',port:3001},{pid:11,host:'*',port:3001},{pid:11,host:'127.0.0.1',port:3002}])
  assert.equal(inspectForward(term,table,[socket]).state,'unknown');
 assert.equal(inspectForward({...term,state:'exited'},table,[]),null);
 assert.equal(inspectForward({...term,address:'m/t1'},table,[]),null);
 assert.equal(inspectForward({...term,pid:null},table,[]).state,'unknown');
});

test('terminal identity requires fresh creation time, PID, token and exact argv',async()=>{
 const {matchesForwardIdentity}=await import('../mods/port-manager/forward-ownership.js');
 const full={...term,created_ms:123,argv:['ssh','-N','target']};
 const expected={address:'t1',createdMs:123,pid:10,token:plan.metadata.token,argv:['ssh','-N','target']};
 assert.equal(matchesForwardIdentity(full,expected),true);
 for (const changed of [{pid:11},{created_ms:124},{state:'finished'},{argv:['ssh','-N','other']},{labels:{}},{address:'t2'}])
  assert.equal(matchesForwardIdentity({...full,...changed},expected),false);
});
