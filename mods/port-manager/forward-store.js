// A single atomically replaced state file is visible to every mod copy. The
// expected-content write rejects concurrent updates rather than losing them.
export function createForwardStore({read,write,path}) {
  async function snapshot() {
    const raw=await read(path);
    if (raw==null) return {raw,entries:[]};
    const entries=JSON.parse(raw);
    if(!Array.isArray(entries)) throw new Error('Saved forwarding state is invalid.');
    return {raw,entries};
  }
  return {
    async list(){return (await snapshot()).entries;},
    async save(item){
      const {raw,entries}=await snapshot();
      if(entries.some(x=>x?.identity?.token===item.identity.token))throw new Error('Duplicate forward identity.');
      if(entries.some(x=>x?.metadata?.machine===item.metadata.machine&&x.metadata.host===item.metadata.host&&x.metadata.remote===item.metadata.remote))throw new Error('A forward for this listener already exists.');
      await write(path,JSON.stringify([...entries,item]),raw);
    },
    async remove(token){const {raw,entries}=await snapshot();await write(path,JSON.stringify(entries.filter(x=>x?.identity?.token!==token)),raw);},
  };
}
