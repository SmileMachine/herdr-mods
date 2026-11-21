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
test('RE2 regex supports groups, alternation and quantifiers', () => {
  const match = compileNamePattern('^(node|python)[0-9]*$', 'regex');
  assert.equal(match('Node42'), true); assert.equal(match('python'), true);
  assert.equal(match('node-dev'), false);
  assert.throws(() => compileNamePattern('[','regex'), /Unsupported or invalid RE2 expression/);
});
test('filters combine fields without mutating records and retain unknown names', () => {
  const rows=[{name:'codex',port:3000,terminal:'yes'},{name:'node',port:8000,terminal:'no'},{name:null,port:3001,terminal:'unknown'}];
  const before=structuredClone(rows); const filter=compileFilter({name:'codex',nameAction:'exclude',ports:'3000-3999'});
  assert.deepEqual(rows.filter(filter),[rows[2]]); assert.deepEqual(rows,before);
});

test('removed quick filters do not hide ports from old saved preferences', () => {
  const filter=compileFilter({terminalOnly:true,lowPortsOnly:true});
  assert.equal(filter({name:'service',port:50000,terminal:'no'}),true);
});


test('RE2 avoids catastrophic backtracking and rejects unsupported patterns',()=>{
 const re=compileNamePattern('(a+)+$', 'regex');
 assert.equal(re('a'.repeat(30000)+'!'),false);
 assert.throws(()=>compileNamePattern('(?=foo)foo','regex'),/RE2/);
 assert.throws(()=>compileNamePattern('(foo)\\1','regex'),/RE2/);
 assert.equal(compileFilter({name:'(?=foo)',nameMode:'regex'})({name:'foo',port:80}),false);
});
