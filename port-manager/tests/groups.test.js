import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupPorts } from '../mods/port-manager/groups.js';

const spaces = [{id:'b',name:'B',machine:null},{id:'a',name:'A',machine:null},{id:'remote/a',name:'A',machine:'remote'}];
const row = (port, extra = {}) => ({port, terminal:'yes', processSpace:null,cwdSpace:null,...extra});
test('space groups follow space order before other groups, preserving machine identity', () => {
 const snapshots = [{machine:null,records:[row(1),row(2,{processSpace:'a'}),row(3,{processSpace:'b'}),row(4,{processSpace:'remote/a'})]},
  {machine:'remote',records:[row(5,{processSpace:'remote/a'}),row(6,{processSpace:'a'})]}];
 const input=structuredClone(snapshots);
 const result=groupPorts(snapshots,spaces,'process');
 assert.deepEqual(result.spaceGroups.map(g=>[g.space.id,g.records.map(e=>e.record.port)]),[['b',[3]],['a',[2]],['remote/a',[5]]]);
 assert.deepEqual(result.otherGroups.map(g=>[g.machine,g.records.map(e=>e.record.port)]),[[null,[1,4]],['remote',[6]]]);
 assert.deepEqual(snapshots,input);
});
test('strategy, ambiguity, filtering, and stale errors are represented independently', () => {
 const records=[row(1,{processSpace:'a',cwdSpace:'b'}),row(2,{cwdSpace:'b',cwdReason:'ambiguous'}),row(3,{terminal:'no'}),row(4,{terminal:'unknown'})];
 const snapshots=[{machine:null,records,stale:true,error:'offline',at:7},{machine:'remote',records:[],stale:true,error:'unavailable',at:null}];
 const cwd=groupPorts(snapshots,spaces,'cwd',r=>r.port!==3);
 assert.deepEqual(cwd.spaceGroups.map(g=>g.space.id),['b']);
 assert.deepEqual(cwd.otherGroups.map(g=>g.category),['ambiguous','unknown']);
 assert.equal(cwd.spaceGroups[0].records[0].stale,true);
 assert.equal(cwd.issues.length,2);
 assert.equal(groupPorts(snapshots,spaces,'process').spaceGroups[0].space.id,'a');
 assert.equal(records.length,4);
});

test('other terminal groups precede other process groups regardless of scan order', () => {
 const snapshots=[{machine:null,records:[row(1,{terminal:'no'}),row(2,{terminal:'yes'}),row(3,{terminal:'unknown'})]},
  {machine:'remote',records:[row(4,{terminal:'no'}),row(5,{terminal:'yes'})]}];
 const groups=groupPorts(snapshots,spaces,'process').otherGroups;
 assert.deepEqual(groups.map(g=>[g.machine,g.category]),[[null,'terminal'],['remote','terminal'],[null,'unknown'],[null,'process'],['remote','process']]);
});
