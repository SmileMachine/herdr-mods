import {parseLsof} from './model.js';
import {parsePort} from './forward-plan.js';

function parseResult(result) {
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || 'Herdr command failed.');
  return JSON.parse(result.stdout);
}
export function createForwardAdapter({hc,exec,store,randomToken}) {
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
    lookup:async meta=>(await store.list()).find(x=>x?.metadata?.machine===meta.machine && x.metadata.host===meta.host && x.metadata.remote===meta.remote)??null,
    portInUse:async port=>(await listeners(port)).length>0,
    startTerminal:async(label,argv)=>{const result=parseResult(await hc(['run','--bg','--no-parent','--no-notify','--label',label,'--json','--',...argv]));return result.address;},
    getTerminal:async address=>parseResult(await hc(['get',address,'--json'])),
    stopTerminal:async address=>{if(!/^t[0-9a-z]+$/.test(address))throw new Error('Invalid local terminal address.');parseResult(await hc(['kill',address,'--json']));},
    listenerOwner:async port=>{const found=await listeners(port);if(!found.length)return null;if(found.length!==1||found[0].host!=='127.0.0.1'||!found[0].pid)throw new Error('Local listener ownership is ambiguous.');return found[0].pid;},
    save:item=>store.save(item),
    update:item=>store.update(item),
    remove:token=>store.remove(token),
    wait:async()=>{const result=await exec('sleep',['0.25'],{timeout:2000});if(result.code!==0)throw new Error('Unable to wait for SSH.');},
    list:()=>store.list(),
  };
}
