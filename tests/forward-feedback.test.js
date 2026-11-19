import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forwardFeedback} from '../mods/port-manager/forward-feedback.js';
const target={machine:'mbp',host:'*',port:3000};
test('progress is specific to the target and action',()=>{
 const command={phase:'running',action:'start',request:{machine:'mbp',host:'*',remotePort:3000}};
 assert.deepEqual(forwardFeedback(command,target),{kind:'progress',text:'Starting…'});
 assert.equal(forwardFeedback(command,{...target,port:3001}),null);
 assert.equal(forwardFeedback({phase:'queued',action:'stop',token:'x'},{token:'x'}).text,'Stopping…');
 assert.equal(forwardFeedback({phase:'running',action:'edit',token:'x'},{token:'x'}).text,'Saving…');
});
test('success has no message; failure remains on its target',()=>{
 const cmd={phase:'done',action:'start',request:{machine:'mbp',host:'*',remotePort:3000}};
 assert.equal(forwardFeedback({...cmd,result:{state:'running'}},target),null);
 assert.deepEqual(forwardFeedback({...cmd,result:{state:'failed',reason:'SSH exited.'}},target),{kind:'error',text:'SSH exited.'});
 assert.equal(forwardFeedback({...cmd,result:{state:'failed',reason:'SSH exited.'}},{...target,port:3001}),null);
});
