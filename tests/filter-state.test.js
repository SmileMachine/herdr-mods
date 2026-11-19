import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyDrafts,validateDrafts} from '../mods/port-manager/filter-state.js';
test('invalid drafts leave only their own last valid filter active',()=>{
 const saved={name:'node',nameMode:'regex',ports:'3000'};
 const a=applyDrafts(saved,'[','4000-5000');
 assert.equal(a.next.name,'node'); assert.equal(a.next.ports,'4000-5000'); assert.ok(a.errors.name);
 const b=applyDrafts(saved,'python','70000');
 assert.equal(b.next.name,'python'); assert.equal(b.next.ports,'3000'); assert.ok(b.errors.ports);
 assert.deepEqual(validateDrafts('node|python','80,3000-4000','regex'),{});
});
