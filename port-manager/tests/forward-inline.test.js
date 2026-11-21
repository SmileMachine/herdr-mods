import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sameListener} from '../mods/port-manager/forward-match.js';
test('inline editor survives cloned snapshots and stays on its listener',()=>{
 const selected={machine:'mbp',host:'*',port:20017,pid:42};
 assert.equal(sameListener(selected,JSON.parse(JSON.stringify(selected))),true);
 for(const change of [{machine:'mini'},{host:'127.0.0.1'},{port:20018},{pid:43}])
  assert.equal(sameListener(selected,{...selected,...change}),false);
 assert.equal(sameListener(null,selected),false);
});
