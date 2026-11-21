// Shared commands retain their target and action through completion so every
// popup can attribute progress and errors to the correct listener.
export function forwardFeedback(command, {token, machine, host, port} = {}) {
 if (!command) return null;
 const request=command.request;
 const matched=(token && (command.token===token || command.result?.metadata?.token===token)) ||
   (request && request.machine===machine && request.host===host && Number(request.remotePort)===Number(port));
 if (!matched) return null;
 if (command.phase==='queued'||command.phase==='running')
  return {kind:'progress',text:({start:'Starting…',stop:'Stopping…',edit:'Saving…',remove:'Removing…'})[command.action]??'Working…'};
 if (command.phase==='done' && ['error','failed','unknown'].includes(command.result?.state))
  return {kind:'error',text:command.result.reason || 'Unable to complete the forward operation.'};
 return null;
}
