import {hc,exec,readTextFile,writeTextFile,appHome} from 'herdr';
import {randomBytes} from 'crypto';
import {createForwardAdapter} from './forward-adapter.js';
import {createForwardStore} from './forward-store.js';
import {createForwardController} from './forward-controller.js';

// Constructing the runtime does not read files or start a process.
export function createForwardRuntime() {
  const store=createForwardStore({read:readTextFile,write:writeTextFile,path:`${appHome()}/port-manager-forwards.json`});
  const adapter=createForwardAdapter({hc,exec,store,randomToken:async()=>randomBytes(16).toString('hex')});
  return {adapter,controller:createForwardController(adapter)};
}
