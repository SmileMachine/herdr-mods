import {planForward} from './forward-plan.js';
import {matchesForwardIdentity} from './forward-ownership.js';

// All side effects are injected. A start returning unknown intentionally leaves
// the managed terminal alone: neither timeout nor a label proves ownership.
export function createForwardController(io) {
  async function start(request) {
    const plan = planForward(request, await io.machines(), await io.token());
    const existing=await io.lookup(plan.metadata);
    if (existing) {
      const state=await status(existing.identity,existing.metadata);
      if(state.state!=='stopped')throw new Error('A forward for this listener already exists or cannot be verified.');
      await io.remove(existing.identity.token);
    }
    if (await io.portInUse(plan.metadata.local)) throw new Error('The local port is already in use.');
    const argv = [plan.command, ...plan.args];
    // Persist intent before launching. An interrupted launch remains visible and
    // blocks duplicates rather than becoming an untracked live process.
    const pending={identity:{token:plan.metadata.token},metadata:plan.metadata,pending:true,argv};
    await io.save(pending);
    let address;
    try { address=await io.startTerminal(plan.label, argv); }
    catch(e) { return {state:'unknown',reason:'SSH launch could not be confirmed. Check the pending forward.'}; }
    if (!address || address.includes('/')) throw new Error('Unable to identify the local SSH terminal.');
    let terminal;
    try { terminal = await io.getTerminal(address); } catch { return {state:'unknown',address,reason:'Unable to inspect SSH terminal.'}; }
    if (terminal?.state !== 'live') return {state:'failed',address,reason:'SSH exited before forwarding started.'};
    const identity = {address, createdMs:terminal.created_ms, pid:terminal.pid, token:plan.metadata.token, argv};
    if (!matchesForwardIdentity(terminal,identity)) return {state:'unknown',address,reason:'Unable to verify SSH terminal identity.'};
    try { await io.update({identity,metadata:plan.metadata}); }
    catch { return {state:'unknown',address,reason:'Unable to save forward identity; SSH may still be running.'}; }
    for (let i=0;i<io.attempts;i++) {
      let fresh, owner;
      try { fresh=await io.getTerminal(address); owner=await io.listenerOwner(plan.metadata.local); }
      catch { return {state:'unknown',address,reason:'Unable to verify the SSH listener.'}; }
      if (fresh?.state !== 'live') return {state:'failed',address,reason:'SSH exited before forwarding started.'};
      if (!matchesForwardIdentity(fresh,identity)) return {state:'unknown',address,reason:'SSH terminal identity changed.'};
      if (owner === identity.pid) return {state:'running',address,metadata:plan.metadata};
      if (owner != null && owner !== identity.pid) return {state:'unknown',address,reason:'Local listener belongs to another process.'};
      await io.wait();
    }
    return {state:'unknown',address,reason:'SSH listener did not appear; SSH may still be running.'};
  }
  async function status(identity, metadata) {
    if (!identity || !metadata || metadata.token !== identity.token) return {state:'unknown',reason:'Missing or inconsistent forward identity.'};
    try {
      const terminal=await io.getTerminal(identity.address);
      if (terminal?.state !== 'live') {
        if (!matchesForwardIdentity({...terminal,state:'live'},identity)) return {state:'unknown',reason:'Saved terminal identity changed.'};
        return {state:'stopped'};
      }
      const owner=await io.listenerOwner(metadata.local);
      const label=terminal?.labels?.['port-manager.forward.v1'];
      let labelMeta; try { labelMeta=JSON.parse(decodeURIComponent(label)); } catch {}
      if (!matchesForwardIdentity(terminal,identity) || !labelMeta || ['token','machine','host','remote','local'].some(key=>labelMeta[key]!==metadata[key]) || owner!==identity.pid)
        return {state:'unknown',reason:'SSH identity or listener ownership could not be verified.'};
      return {state:'running'};
    } catch { return {state:'unknown',reason:'Unable to verify SSH ownership.'}; }
  }
  async function stop(identity, metadata) {
    if (!identity || !metadata || metadata.token !== identity.token) return {state:'unknown',reason:'Missing or inconsistent forward identity.'};
    let terminal, owner;
    try { terminal=await io.getTerminal(identity.address); owner=await io.listenerOwner(metadata.local); }
    catch { return {state:'unknown',reason:'Unable to verify SSH ownership.'}; }
    const label=terminal?.labels?.['port-manager.forward.v1'];
    let labelMeta; try { labelMeta=JSON.parse(decodeURIComponent(label)); } catch {}
    if (!matchesForwardIdentity(terminal,identity) || !labelMeta || ['token','machine','host','remote','local'].some(key=>labelMeta[key]!==metadata[key]) || owner !== identity.pid)
      return {state:'unknown',reason:'SSH identity or listener ownership could not be verified.'};
    // hc has no compare-and-kill primitive; this is a fresh best-effort check,
    // not a guarantee against a change between verification and kill.
    await io.stopTerminal(identity.address);
    const after=await io.getTerminal(identity.address);
    if (after?.state === 'live') return {state:'unknown',reason:'SSH terminal is still running.'};
    await io.remove(identity.token);
    return {state:'stopped'};
  }
  return {start,stop,status};
}
