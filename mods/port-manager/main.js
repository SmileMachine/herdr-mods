import { View, div, svg } from 'gpui-kit';
import { v_flex, h_flex, Input, InputState, Radio, RadioGroup, Switch } from 'gpui-base';
import { props, theme, shared, setShared, checking, openOverlay, closeOverlay, window, settings, spaces } from 'herdr';
import { compileFilter } from './model.js';
import { scanAll } from './runtime.js';
import { snapshotsChanged } from './discovery.js';
import { groupPorts } from './groups.js';
import { applyDrafts, validateDrafts } from './filter-state.js';
import {createForwardRuntime} from './forward-runtime.js';
import {createForwardWorker} from './forward-worker.js';
import {managedForwardFor} from './forward-match.js';

const PREF='port-manager.preferences', DATA='port-manager.snapshots', FORWARD_CMD='port-manager.forward-command';
const defaults={strategy:'process',name:'',nameMode:'text',nameAction:'exclude',ports:'',portAction:'include',includeUnattached:false};
const preferences=()=>({...defaults,...(shared(PREF)??{})});
const snapshots=()=>shared(DATA)??[];
export default class PortManager extends View {
 init(_p,cx) {
  this.popup=props()?.view==='popup' || Boolean(props()?.overlay); this.errors={}; this.busy=false; this.panel=null; this.expandedProcesses=new Set(); this.forwardRecord=null; this.forwardMessage=''; this.forwardStates={}; this.forwardEntries=[]; this.forwardRuntime=createForwardRuntime(); this.lastForwardCommand=null; this.forwardRefreshBusy=false;
  if (this.popup) {
   const p=preferences(); this.name=InputState.new({value:p.name,placeholder:'e.g. node'}); this.ports=InputState.new({value:p.ports,placeholder:'e.g. 3000, 8000-8999'}); this.localPort=InputState.new({placeholder:'Local port'}); this.agentSocket=InputState.new({value:p.agentSocket??'',placeholder:'Optional absolute path'});
   const changed=(_e,cx)=>{const result=applyDrafts(preferences(),this.name.value(),this.ports.value());this.errors=result.errors;setShared(PREF,result.next);cx.notify();};
   this.name.on('change',changed); this.ports.on('change',changed); cx.timer.every(500,cx=>{const c=shared(FORWARD_CMD),key=c?`${c.id}:${c.phase}`:'';if(key!==this.lastForwardCommand){this.lastForwardCommand=key;if(c?.phase==='done'){if(c.id===this.ownForwardCommand&&c.result?.state==='running'){this.forwardRecord=null;this.panel='forwards';}this.refreshForwards(cx);}cx.notify();}}); this.agentSocket.on('change',(_e,cx)=>{setShared(PREF,{...preferences(),agentSocket:this.agentSocket.value()});cx.notify();}); if(!checking())this.refreshForwards(cx); return;
  }
  if(checking()) return;
  this.worker=createForwardWorker({read:()=>shared(FORWARD_CMD),write:value=>setShared(FORWARD_CMD,value),...this.forwardRuntime});this.worker.interrupt();
  this.scan(cx); cx.timer.every(5000,cx=>{if(window()?.active)this.scan(cx);});
  cx.timer.every(300,cx=>{cx.spawn(async cx=>{await this.worker.execute();});});
 }
 scan(cx) {
  if(this.busy)return; this.busy=true;
  cx.spawn(async cx=>{try {const result=await scanAll(snapshots(),preferences().includeUnattached); if(snapshotsChanged(snapshots(),result))setShared(DATA,result);} catch(e){console.warn(`port-manager: ${e}`);} finally {this.busy=false;cx.notify();}});
 }
 set(key,value,cx){
  const current=preferences(), next={...current,[key]:value};
  // A regex draft can be invalid when switching modes. Keep the last valid
  // preference until corrected, and display the error beside the field.
  const errors=validateDrafts(this.name.value(),this.ports.value(),next.nameMode);
  if(key==='nameMode' && errors.name){this.errors={...errors,name:'Enter a valid JavaScript regular expression before switching to Regex.'};cx.notify();return;}
  const result=applyDrafts(next,this.name.value(),this.ports.value());
  this.errors=result.errors;setShared(PREF,result.next);cx.notify();
 }
 iconButton(id,icon,label,action,t){
  return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(5).text_color(t.dim)
   .cursor_pointer().tooltip(label).accessibility_label(label).tab_index(0).hover(s=>s.bg(t.hover).text_color(t.foreground))
   .on_click((_e,cx)=>{action(cx);cx.stop_propagation();}).on_key_down((e,cx)=>{if(e.key==='enter'||e.key==='space'){action(cx);cx.stop_propagation();}})
   .child(svg(`mods/port-manager/icons/${icon}.svg`).size(14));
 }
 button(id,label,action,t,selected=false){
  return div().id(id).px(8).py(5).rounded(5).bg(selected?t.selected:t.raised).text_color(t.foreground)
   .when(selected,el=>el.font_medium())
   .cursor_pointer().tooltip(label).accessibility_label(`${label}${selected?' (selected)':''}`).tab_index(0).hover(s=>selected?s:s.bg(t.hover))
   .on_click((_e,cx)=>action(cx)).on_key_down((e,cx)=>{if(e.key==='enter'||e.key==='space'){action(cx);cx.stop_propagation();}}).child(label);
 }
 choices(id,label,items,value,onChange,t){
  return RadioGroup.new(id).accessibility_label(label).flex().flex_row().gap(12).items_center()
   .children(items.map(([key,text])=>Radio.new(`${id}-${key}`).checked(key===value).accessibility_label(text)
    .tab_index(0).flex().items_center().gap(5).py(5).cursor_pointer()
    .on_change((checked,cx)=>{if(checked)onChange(key,cx);})
    .child(div().size(14).flex_none().rounded_full().border_1().border_color(key===value?t.foreground:t.muted)
     .flex().items_center().justify_center().when(key===value,el=>el.child(div().size(6).rounded_full().bg(t.foreground))))
    .child(div().child(text))));
 }
 switchControl(id,label,value,onChange,t){
  return Switch.new(id).checked(value).accessibility_label(label).tab_index(0).flex().items_center().gap(8).py(5).cursor_pointer()
   .on_change((checked,cx)=>onChange(checked,cx))
   .child(h_flex().w(30).h(18).flex_none().rounded_full().border_1().border_color(value?t.foreground:t.muted)
    .bg(value?t.selected:t.raised).items_center().px(2).when(value,el=>el.justify_end())
    .child(div().size(12).rounded_full().bg(value?t.foreground:t.muted)))
   .child(div().child(label));
 }
 refreshForwards(cx){
  if(this.forwardRefreshBusy)return;this.forwardRefreshBusy=true;
  cx.spawn(async cx=>{try {const list=await this.forwardRuntime.adapter.list();const states={};for(const entry of list)states[entry.identity.token]=entry.pending?{state:'unknown',reason:'The SSH launch could not be confirmed. Check Herdr terminals before retrying.'}:await this.forwardRuntime.controller.status(entry.identity,entry.metadata);this.forwardEntries=list;this.forwardStates=states;}catch(e){this.forwardMessage=`Unable to read forwards: ${e.message??e}`;}finally{this.forwardRefreshBusy=false;cx.notify();}});
 }
 forwardAction(command,cx){
  const active=shared(FORWARD_CMD);
  if(active?.phase==='queued'||active?.phase==='running'){this.forwardMessage='Another forward operation is in progress.';cx.notify();return;}
  const id=`${Date.now()}-${Math.random()}`;this.ownForwardCommand=id;setShared(FORWARD_CMD,{...command,id,phase:'queued'});this.forwardMessage='';cx.notify();
 }
 render(cx){
  const t=theme(),p=preferences(),all=snapshots(),records=all.flatMap(x=>x.records),filter=compileFilter(p),shown=records.filter(filter);
  if(!this.popup) return h_flex().size_full().justify_end().items_center().bg(t.chrome).border_t(1).border_color(t.border)
   .child(this.button('pm-open',`Ports ${shown.length}`,()=>{const v=globalThis.window?.viewport_size?.(),z=settings().zoom??1;openOverlay({mod:'port-manager',kind:'popup',at:v?{x:Math.max(0,v.width-490*z),y:Math.max(0,v.height-630*z)}:'pointer',width:480,height:600,props:{view:'popup',height:600}});},t));
  const groups=groupPorts(all,spaces(),p.strategy,filter);
  const command=shared(FORWARD_CMD);
  const operationBusy=command?.phase==='queued'||command?.phase==='running';
  const operationMessage=operationBusy?'Working…':command?.phase==='done'&&command.id===this.ownForwardCommand?(command.result?.reason??(command.result?.state==='running'?'Forward started.':command.result?.state==='stopped'?'Forward stopped.':`Forward status: ${command.result?.state}`)):'';
  return v_flex().w_full().h(props()?.height ?? 600).bg(t.popover).text_color(t.foreground).text_size(13)
   .on_key_down((e,cx)=>{if(e.key==='escape'){closeOverlay(props().overlay);cx.stop_propagation();}})
   .child(h_flex().h(40).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border).child(div().font_medium().child('Ports')).child(div().text_size(12).text_color(t.muted).child(`${shown.length} / ${records.length}`)).child(div().flex_1()).child(this.button('pm-filters','Filters',cx=>{this.panel=this.panel==='filters'?null:'filters';this.forwardRecord=null;cx.notify();},t,this.panel==='filters')).child(this.button('pm-forwards','Forwards',cx=>{this.panel=this.panel==='forwards'?null:'forwards';this.forwardRecord=null;if(this.panel)this.refreshForwards(cx);cx.notify();},t,this.panel==='forwards')).child(this.button('pm-settings','Settings',cx=>{this.panel=this.panel==='settings'?null:'settings';this.forwardRecord=null;cx.notify();},t,this.panel==='settings')))
   .when(this.panel==='filters',el=>el.child(v_flex().id('pm-filter-panel').flex_none().px(14).py(10).gap(10).border_b(1).border_color(t.border).text_size(12)
    .child(v_flex().gap(4)
     .child(div().font_medium().child('Process name'))
     .child(h_flex().gap(6).items_center()
      .child(Input.new(this.name).flex_1().min_w(0).h(30).px(8).rounded(5).border_1().border_color(this.errors.name?t.ansi1:t.input).bg(t.background).accessibility_label('Process name'))
      .child(this.choices('name-action','Process name filter',[ ['include','Include'],['exclude','Exclude']],p.nameAction,(v,cx)=>this.set('nameAction',v,cx),t)))
     .child(h_flex().gap(6).items_center().child(div().text_color(t.muted).child('Match')).child(this.choices('name-mode','Process name match mode',[ ['text','Text'],['regex','Regex']],p.nameMode,(v,cx)=>this.set('nameMode',v,cx),t)))
     .when(Boolean(this.errors.name),e=>e.child(div().text_color(t.ansi1).child(`${this.errors.name} Previous valid filter remains active.`))))
    .child(v_flex().gap(4)
     .child(div().font_medium().child('Ports'))
     .child(h_flex().gap(6).items_center()
      .child(Input.new(this.ports).flex_1().min_w(0).h(30).px(8).rounded(5).border_1().border_color(this.errors.ports?t.ansi1:t.input).bg(t.background).accessibility_label('Ports'))
      .child(this.choices('port-action','Port filter',[ ['include','Include'],['exclude','Exclude']],p.portAction,(v,cx)=>this.set('portAction',v,cx),t)))
     .when(Boolean(this.errors.ports),e=>e.child(div().text_color(t.ansi1).child(`${this.errors.ports} Previous valid filter remains active.`))))

   ))
   .when(this.panel==='settings',el=>el.child(v_flex().id('pm-settings-panel').flex_none().px(14).py(10).gap(12).border_b(1).border_color(t.border).text_size(12)
    .child(v_flex().gap(5).child(div().font_medium().child('Space attribution'))
     .child(this.choices('strategy','Space attribution',[ ['process','Process tree'],['cwd','Working directory']],p.strategy,(v,cx)=>this.set('strategy',v,cx),t)))
    .child(v_flex().gap(5).child(div().font_medium().child('Machines'))
     .child(this.switchControl('unattached','Scan ready machines without spaces',p.includeUnattached,(value,cx)=>this.set('includeUnattached',value,cx),t))
     .child(div().text_color(t.muted).child('Only machines already connected to Herdr are scanned.')))
    .child(v_flex().gap(4).child(div().font_medium().child('SSH agent socket'))
     .child(Input.new(this.agentSocket).w_full().h(30).px(8).rounded(5).border_1().border_color(t.input).bg(t.background).accessibility_label('SSH agent socket path'))
     .child(div().text_color(t.muted).child('Leave empty to use the SSH environment or configuration.')))
   ))
   .when(this.panel==='forwards',el=>el.child(v_flex().id('pm-forward-panel').flex_none().px(14).py(10).gap(6).border_b(1).border_color(t.border).text_size(12)
    .child(h_flex().items_center().child(div().flex_1().font_medium().child('Managed forwards')).child(this.iconButton('pm-refresh-forwards','refresh','Refresh forwards',cx=>this.refreshForwards(cx),t)))
    .children(this.forwardEntries.map((item,i)=>{
     const status=this.forwardStates[item.identity.token]??{state:'checking'},state=status.state;
     const edit=(cx)=>{this.forwardRecord={...item.metadata,token:item.identity.token,port:item.metadata.remote};this.localPort.set_value(String(item.metadata.local));this.panel=null;this.forwardMessage='';cx.notify();};
     return v_flex().id(`pm-forward-${i}`).gap(2)
      .child(h_flex().gap(4).items_center()
       .child(div().flex_1().min_w(0).truncate().child(`${item.metadata.machine}:${item.metadata.remote} → localhost:${item.metadata.local} · ${state}`))
       .when(state!=='stopped'&&state!=='checking'&&item.identity?.address,e=>e.child(this.iconButton(`pm-edit-${i}`,'edit','Edit forward',edit,t)).child(this.iconButton(`pm-stop-${i}`,'stop','Stop forward',cx=>this.forwardAction({action:'stop',token:item.identity.token},cx),t)))
       .when(state==='stopped',e=>e.child(this.iconButton(`pm-retry-${i}`,'play','Start forward',cx=>{this.forwardRecord={...item.metadata,port:item.metadata.remote};this.localPort.set_value(String(item.metadata.local));this.panel=null;this.forwardMessage='';cx.notify();},t)).child(this.iconButton(`pm-remove-${i}`,'trash','Remove stopped forward',cx=>this.forwardAction({action:'remove',token:item.identity.token},cx),t))))
      .when(state==='unknown',e=>e.child(div().text_color(t.muted).child(`${status.reason??'Unable to verify this forward.'}${item.identity.address?` Terminal: ${item.identity.address}.`:''}`)));
    }))
    .when(!this.forwardEntries.length,e=>e.child(div().text_color(t.muted).child('No managed forwards.')))
    .when(Boolean(this.forwardMessage||operationMessage),e=>e.child(div().text_color(t.muted).child(this.forwardMessage||operationMessage)))
   ))
   .when(Boolean(this.forwardRecord),el=>el.child(v_flex().flex_none().px(14).py(10).gap(6).border_b(1).border_color(t.border).text_size(12)
    .child(div().font_medium().child(`Forward ${this.forwardRecord?.machine}:${this.forwardRecord?.port}`))
    .child(h_flex().gap(8).items_center().child(Input.new(this.localPort).w(120).h(30).px(8).rounded(5).border_1().border_color(t.input).bg(t.background).accessibility_label('Local port'))
     .child(this.iconButton('pm-start-forward',this.forwardRecord?.token?'save':'play',operationBusy?'Working…':(this.forwardRecord?.token?'Save forward':'Start forward'),cx=>{const r=this.forwardRecord;this.forwardAction({action:r.token?'edit':'start',token:r.token,request:{machine:r.machine,host:r.host,remotePort:r.port,localPort:this.localPort.value(),agentSocket:preferences().agentSocket?.trim()||undefined}},cx);},t))
     .child(this.iconButton('pm-cancel-forward','close','Cancel',cx=>{if(!operationBusy){this.forwardRecord=null;cx.notify();}},t)))
    .when(Boolean(this.forwardMessage||operationMessage),e=>e.child(div().text_color(t.muted).child(this.forwardMessage||operationMessage)))
   ))
   .when(!all.length,el=>el.child(div().px(14).py(10).text_size(12).text_color(t.dim).child('Scanning listeners…')))
   .when(all.length>0 && !records.length,el=>el.child(div().px(14).py(10).text_size(12).text_color(t.dim).child('No listeners found. Check machine errors below.')))
   .when(records.length>0 && !shown.length,el=>el.child(div().px(14).py(10).text_size(12).text_color(t.dim).child('No ports match the current filters.')))
   .child(v_flex().id('pm-list').flex_1().min_h(0).overflow_y_scrollbar()
    .children(groups.issues.map((issue,i)=>h_flex().id(`pm-error-${i}`).flex_none().px(14).py(5).text_size(12).text_color(t.ansi1)
     .child(`${issue.machine??'This computer'}: ${issue.error??'Scan failed'}${issue.at ? ' · showing last results' : ''}`)))
    .children(groups.spaceGroups.flatMap((group,i)=>[
     h_flex().id(`pm-space-${i}`).h(34).flex_none().px(14).gap(8).items_center().bg(t.raised).border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).truncate().child(group.space.name))
      .when(Boolean(group.space.machine),el=>el.child(div().text_size(12).text_color(t.muted).child(group.space.machine)))
      .child(div().text_size(12).text_color(t.muted).child(`${group.records.length}`)),
     ...group.records.map((entry,j)=>this.portRow(entry,`space-${i}-${j}`,t))
    ]))
    .when(groups.otherGroups.length>0,el=>el.child(h_flex().id('pm-other-title').h(34).flex_none().px(14).items_center().text_color(t.muted).border_b(1).border_color(t.border).child('Other ports')))
    .children(groups.otherGroups.flatMap((group,i)=>{
     const labels={terminal:'Other terminal',process:'Other process',unknown:'Unknown attribution',ambiguous:'Ambiguous checkout'};
     const key=JSON.stringify([group.machine,group.category]);
     const collapsible=group.category==='process', expanded=this.expandedProcesses.has(key);
     const heading=h_flex().id(`pm-other-${i}`).h(34).flex_none().px(14).gap(8).items_center().bg(t.raised).border_b(1).border_color(t.border)
      .when(collapsible,el=>el.cursor_pointer().hover(s=>s.bg(t.hover))
       .tooltip(expanded?'Collapse other processes':'Expand other processes')
       .accessibility_label(`${expanded?'Collapse':'Expand'} other processes on ${group.machine??'this computer'}`)
       .on_click((_e,cx)=>{if(expanded)this.expandedProcesses.delete(key);else this.expandedProcesses.add(key);cx.notify();}))
      .child(div().flex_1().min_w(0).truncate().child(`${collapsible?(expanded?'▾ ':'▸ '):''}${group.machine??'This computer'} · ${labels[group.category]}`))
      .child(div().text_size(12).text_color(t.muted).child(`${group.records.length}`));
     return [heading,...(collapsible&&!expanded?[]:group.records.map((entry,j)=>this.portRow(entry,`other-${i}-${j}`,t)))];
    })));
 }
 portRow({record:r,stale},id,t){
  const managed=managedForwardFor(r,this.forwardEntries);
  const state=managed?this.forwardStates[managed.identity.token]?.state:'none';
  const edit=(cx)=>{this.forwardRecord={...managed.metadata,token:managed.identity.token,port:managed.metadata.remote};this.localPort.set_value(String(managed.metadata.local));this.panel=null;this.forwardMessage='';cx.notify();};
  return h_flex().id(`pm-row-${id}`).h(54).flex_none().px(14).pt(9).gap(14).items_start().border_b(1).border_color(t.border).hover(s=>s.bg(t.hover))
   .child(div().w(56).flex_none().font_family(settings().font_family ?? 'JetBrains Mono').font_bold().child(String(r.port)))
   .child(v_flex().flex_1().min_w(0).gap(2).child(div().truncate().text_color(t.muted).child(`${r.name??'Unknown process'}${r.pid?` · ${r.pid}`:''}`))
    .child(div().truncate().text_size(12).text_color(t.dim).child(`${r.host}${stale?' · Stale':''}`)))
   .when(Boolean(r.machine)&&!stale&&!managed,el=>el.child(this.iconButton(`pm-forward-action-${id}`,'forward','Forward port',cx=>{this.forwardRecord=r;this.localPort.set_value(String(r.port));this.panel=null;this.forwardMessage='';cx.notify();},t)))
   .when(Boolean(r.machine)&&!stale&&managed,el=>el.child(h_flex().gap(2).items_center()
    .child(div().max_w(120).truncate().text_size(12).text_color(t.muted).tooltip(`Forwarded to localhost:${managed.metadata.local}`).child(`→ localhost:${managed.metadata.local}`))
    .when(state!=='stopped'&&state!=='checking'&&managed.identity?.address,e=>e.child(this.iconButton(`pm-edit-forward-${id}`,'edit','Edit forward',edit,t)).child(this.iconButton(`pm-stop-forward-${id}`,'stop','Stop forward',cx=>this.forwardAction({action:'stop',token:managed.identity.token},cx),t)))));
 }
}
