import {parseLsof} from './model.js';
import {parsePort} from './forward-plan.js';

const STORE = 'port-manager.forwards.v1';
function readEntries(storage) {
  const raw=storage.getItem(STORE);
  if (!raw) return [];
  const data=JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Saved forwarding state is invalid.');
  return data;
}
function parseResult(result) {
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || 'Herdr command failed.');
  return JSON.parse(result.stdout);
}
export function createForwardAdapter({hc,exec,storage,randomToken}) {
  async function listeners(port) {
    const result=await exec('lsof',['-nP',`-iTCP:${parsePort(port)}`,'-sTCP:LISTEN','-F','pcn'],{timeout:10000});
    if (result.code===1 && !result.stdout && !result.stderr) return [];
    if (result.code!==0 || result.stderr?.trim()) throw new Error('Unable to inspect local listener ownership.');
    return parseLsof(result.stdout);
  }
  return {
    attempts:20,
    machines:async()=>{const result=parseResult(await hc(['machine','ls','--json'])); if(!Array.isArray(result.machines))throw new Error('Invalid machine list.');return result.machines;},
    token:randomToken,
    lookup:async meta=>readEntries(storage).find(x=>x?.metadata?.machine===meta.machine && x.metadata.host===meta.host && x.metadata.remote===meta.remote)??null,
    portInUse:async port=>(await listeners(port)).length>0,
    startTerminal:async(label,argv)=>{const result=parseResult(await hc(['run','--bg','--no-parent','--no-notify','--label',label,'--json','--',...argv]));return result.address;},
    getTerminal:async address=>parseResult(await hc(['get',address,'--json'])),
    stopTerminal:async address=>{if(!/^t[0-9a-z]+$/.test(address))throw new Error('Invalid local terminal address.');parseResult(await hc(['kill',address,'--json']));},
    listenerOwner:async port=>{const found=await listeners(port);if(!found.length)return null;if(found.length!==1||found[0].host!=='127.0.0.1'||!found[0].pid)throw new Error('Local listener ownership is ambiguous.');return found[0].pid;},
    save:async item=>{const items=readEntries(storage);if(items.some(x=>x?.identity?.token===item.identity.token))throw new Error('Duplicate forward identity.');items.push(item);storage.setItem(STORE,JSON.stringify(items));if(storage.flush)await storage.flush();},
    remove:async token=>{const items=readEntries(storage);storage.setItem(STORE,JSON.stringify(items.filter(x=>x?.identity?.token!==token)));if(storage.flush)await storage.flush();},
    wait:async()=>{const result=await exec('sleep',['0.25'],{timeout:2000});if(result.code!==0)throw new Error('Unable to wait for SSH.');},
    list:()=>readEntries(storage),
  };
}
