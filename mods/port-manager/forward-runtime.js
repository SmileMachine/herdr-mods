import {hc,exec} from 'herdr';
import {randomBytes} from 'crypto';
import {createForwardAdapter} from './forward-adapter.js';
import {createForwardController} from './forward-controller.js';

// Construct within the view using its own storage; overlay and status-bar
// copies do not share localStorage. No process runs during construction.
export function createForwardRuntime(storage) {
  const adapter=createForwardAdapter({hc,exec,storage,randomToken:async()=>randomBytes(16).toString('hex')});
  return {adapter,controller:createForwardController(adapter)};
}
