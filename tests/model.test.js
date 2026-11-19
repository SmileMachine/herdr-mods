import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLsof, parseSs, classifyProcess, classifyCwd, parsePortRanges, compileFilter, compileNamePattern } from '../mods/port-manager/model.js';

test('lsof keeps distinct addresses and processes and resets command on new pid', () => {
  const r = parseLsof('p1\ncnode\nn127.0.0.1:3000\nn[::1]:3000\nn[::1]:3000\np2\nn*:3000\n');
  assert.equal(r.length, 3); assert.equal(r[2].name, null); assert.deepEqual(r.map(x => x.host), ['127.0.0.1','[::1]','*']);
});
test('ss keeps sockets without accessible processes and IPv6', () => {
  const r = parseSs('LISTEN 0 128 [::1]:80 [::]:*\nLISTEN 0 1 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=42,fd=4))');
  assert.equal(r[0].pid, null); assert.equal(r[1].name, 'node'); assert.equal(r[1].port, 3000);
});
test('process tree distinguishes owned, other tty, detached and unknown', () => {
  const parents = new Map([[20,10],[10,1],[30,1],[40,99]]), ttys = new Set([30]);
  assert.deepEqual(classifyProcess(20,parents,ttys,new Map([[10,'s']])), {space:'s',terminal:'yes'});
  assert.equal(classifyProcess(30,parents,ttys,new Map()).terminal,'yes');
  assert.equal(classifyProcess(10,parents,ttys,new Map()).terminal,'no');
  assert.equal(classifyProcess(40,parents,ttys,new Map()).terminal,'unknown');
  assert.equal(classifyProcess(null,parents,ttys,new Map()).terminal,'unknown');
});
test('cwd attribution is deepest and ambiguous matches are not guessed', () => {
  const c=[{root:'/repo',space:'a'},{root:'/repo/deep',space:'b'},{root:'/repo/deep',space:'c'}];
  assert.equal(classifyCwd('/repository',c).reason,'unmatched');
  assert.deepEqual(classifyCwd('/repo/deep/x',c).candidates,['b','c']);
  assert.equal(classifyCwd('/repo/a',c).space,'a');
});
test('port ranges validate inclusively', () => {
  assert.deepEqual(parsePortRanges('80, 3000-3002'),[[80,80],[3000,3002]]);
  for (const v of ['0','65536','9-2','1,','x']) assert.throws(() => parsePortRanges(v));
});
test('safe regex subset rejects exponential constructs and invalid input', () => {
  assert.equal(compileNamePattern('^code.$','regex')('codex'),true);
  for (const v of ['(a+)+$','a.*','[','\\1','a|b']) assert.throws(() => compileNamePattern(v,'regex'));
});
test('filters combine fields without mutating records and retain unknown names', () => {
  const rows=[{name:'codex',port:3000,terminal:'yes'},{name:'node',port:8000,terminal:'no'},{name:null,port:3001,terminal:'unknown'}];
  const before=structuredClone(rows); const filter=compileFilter({name:'codex',nameAction:'exclude',ports:'3000-3999',terminalOnly:true});
  assert.deepEqual(rows.filter(filter),[rows[2]]); assert.deepEqual(rows,before);
});
