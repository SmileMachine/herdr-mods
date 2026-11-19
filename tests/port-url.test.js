import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserUrl} from '../mods/port-manager/port-url.js';

test('browser URLs target validated local ports only',()=>{
 assert.equal(browserUrl(3000),'http://localhost:3000');
 assert.equal(browserUrl('8080',true),'http://127.0.0.1:8080');
 for(const value of [0,65536,-1,'80/path','1@example.com','']) assert.equal(browserUrl(value),null);
});
