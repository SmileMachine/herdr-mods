// One persistent status-bar view owns this worker. UI copies submit one request
// through shared state; requests are never replayed after the owner restarts.
export function createForwardWorker({read,write,controller,adapter}) {
  let busy=false;
  async function execute() {
    const command=read();
    if(busy || !command || command.phase!=='queued')return;
    busy=true;
    write({...command,phase:'running'});
    try {
      let result;
      if(command.action==='start') result=await controller.start(command.request);
      else if(command.action==='stop') {
        const item=(await adapter.list()).find(x=>x.identity?.token===command.token);
        result=item?await controller.stop(item.identity,item.metadata):{state:'unknown',reason:'Forward record not found.'};
      } else throw new Error('Unsupported forward action.');
      write({id:command.id,phase:'done',result});
    } catch(e) {write({id:command.id,phase:'done',result:{state:'error',reason:String(e?.message??e)}});}
    finally {busy=false;}
  }
  function interrupt() {
    const command=read();
    if(command && (command.phase==='queued'||command.phase==='running'))
      write({id:command.id,phase:'done',result:{state:'unknown',reason:'Operation interrupted. Check managed forwards before retrying.'}});
  }
  return {execute,interrupt};
}
