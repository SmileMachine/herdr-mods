import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('all action and disclosure SVGs and the Lucide license are packaged',()=>{
 for(const name of ['close','edit','external','waypoints','play','save','stop','trash','refresh','filter','settings','chevron-right','chevron-down']){
  const svg=readFileSync(new URL(`../mods/port-manager/icons/${name}.svg`,import.meta.url),'utf8');
  assert.match(svg,/<svg\b/);assert.match(svg,/currentColor/);
 }
 assert.match(readFileSync(new URL('../mods/port-manager/icons/LICENSE-lucide.txt',import.meta.url),'utf8'),/ISC License/);
});
