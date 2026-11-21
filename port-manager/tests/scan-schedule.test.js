import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scanDue,scanIntervalMs} from '../mods/port-manager/scan-schedule.js';
test('scan interval defaults safely and follows changes without overlapping schedules',()=>{
 assert.equal(scanIntervalMs(undefined),5000);
 assert.equal(scanIntervalMs(0),5000);
 assert.equal(scanIntervalMs(60),60000);
 assert.equal(scanDue(10000,null,5),true);
 assert.equal(scanDue(14999,10000,5),false);
 assert.equal(scanDue(15000,10000,5),true);
 assert.equal(scanDue(15000,10000,10),false);
 assert.equal(scanDue(9000,10000,10),true);
});
