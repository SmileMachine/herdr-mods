import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planForward,parseForwardLabel,remoteHost,FORWARD_LABEL} from '../mods/port-manager/forward-plan.js';
const machines=[{name:'mbp',target:'shawn@mbp',via:false}];
const token='a'.repeat(32);
test('SSH plan binds locally and preserves IPv4 or IPv6 destination, without shell interpolation',()=>{
 const plan=planForward({machine:'mbp',host:'[::1]',remotePort:3000,localPort:'4000'},machines,token);
 assert.equal(plan.args.at(-2),'127.0.0.1:4000:[::1]:3000');
 assert.equal(plan.args.at(-1),'shawn@mbp');
 assert.deepEqual(parseForwardLabel(plan.label.slice(FORWARD_LABEL.length+1)),plan.metadata);
 assert.equal(remoteHost('*'),'127.0.0.1'); assert.equal(remoteHost('[::]'),'::1');
 assert.equal(remoteHost('192.168.1.5'),'192.168.1.5');
 assert.equal(remoteHost('[2001:db8::1]'),'2001:db8::1');
});
test('rejects untrusted targets, invalid ports and unsupported addresses',()=>{
 const request={machine:'mbp',host:'127.0.0.1',remotePort:3000,localPort:4000};
 for(const host of ['example.com','127.0.0.999','[fe80::1%en0]','::1;evil',':','1:2','1:::2','1:2:3:4:5:6:7:8:9']) assert.throws(()=>planForward({...request,host},machines,token));
 for(const localPort of [0,65536,'4;2','']) assert.throws(()=>planForward({...request,localPort},machines,token));
 for(const m of [{name:'mbp',target:'-oProxyCommand=evil'},{name:'mbp',target:'remote cmd'},{name:'mbp',target:'box',via:true}]) assert.throws(()=>planForward(request,[m],token));
 assert.throws(()=>planForward(request,machines,'bad'));
});
test('malformed labels do not become managed forwards',()=>{
 for(const text of ['','%','{}',encodeURIComponent(JSON.stringify({v:1,token,machine:'m',host:'*',remote:3000,local:'3000'}))]) assert.equal(parseForwardLabel(text),null);
});

test('optional explicit agent is passed as one SSH option, never shell-expanded',()=>{
 const request={machine:'mbp',host:'127.0.0.1',remotePort:3000,localPort:4000};
 const p=planForward({...request,agentSocket:'/tmp/my socket'},machines,token);
 assert.ok(p.args.includes('IdentityAgent=/tmp/my socket'));
 assert.ok(p.args.includes('BatchMode=yes'));
 for(const agentSocket of ['relative','/tmp/\nconfig']) assert.throws(()=>planForward({...request,agentSocket},machines,token));
});
