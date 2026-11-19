import { View, div } from 'gpui-kit';
import { v_flex, h_flex, Input, InputState, Radio, RadioGroup, Switch } from 'gpui-base';
import { props, theme, shared, setShared, checking, openOverlay, closeOverlay, window, settings, spaces } from 'herdr';
import { compileFilter } from './model.js';
import { scanAll } from './runtime.js';
import { snapshotsChanged } from './discovery.js';
import { groupPorts } from './groups.js';
import { applyDrafts, validateDrafts } from './filter-state.js';

const PREF='port-manager.preferences', DATA='port-manager.snapshots';
const defaults={strategy:'process',name:'',nameMode:'text',nameAction:'exclude',ports:'',portAction:'include',includeUnattached:false};
const preferences=()=>({...defaults,...(shared(PREF)??{})});
const snapshots=()=>shared(DATA)??[];
export default class PortManager extends View {
 init(_p,cx) {
  this.popup=props()?.view==='popup' || Boolean(props()?.overlay); this.errors={}; this.busy=false; this.panel=null; this.expandedProcesses=new Set();
  if (this.popup) {
   const p=preferences(); this.name=InputState.new({value:p.name,placeholder:'e.g. node'}); this.ports=InputState.new({value:p.ports,placeholder:'e.g. 3000, 8000-8999'});
   const changed=(_e,cx)=>{const result=applyDrafts(preferences(),this.name.value(),this.ports.value());this.errors=result.errors;setShared(PREF,result.next);cx.notify();};
   this.name.on('change',changed); this.ports.on('change',changed); return;
  }
  if(checking()) return;
  this.scan(cx); cx.timer.every(5000,cx=>{if(window()?.active)this.scan(cx);});
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
 render(cx){
  const t=theme(),p=preferences(),all=snapshots(),records=all.flatMap(x=>x.records),filter=compileFilter(p),shown=records.filter(filter);
  if(!this.popup) return h_flex().size_full().justify_end().items_center().bg(t.chrome).border_t(1).border_color(t.border)
   .child(this.button('pm-open',`Ports ${shown.length}`,()=>{const v=globalThis.window?.viewport_size?.(),z=settings().zoom??1;openOverlay({mod:'port-manager',kind:'popup',at:v?{x:Math.max(0,v.width-490*z),y:Math.max(0,v.height-630*z)}:'pointer',width:480,height:600,props:{view:'popup',height:600}});},t));
  const groups=groupPorts(all,spaces(),p.strategy,filter);
  return v_flex().w_full().h(props()?.height ?? 600).bg(t.popover).text_color(t.foreground).text_size(13)
   .on_key_down((e,cx)=>{if(e.key==='escape'){closeOverlay(props().overlay);cx.stop_propagation();}})
   .child(h_flex().h(40).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border).child(div().font_medium().child('Ports')).child(div().text_size(12).text_color(t.muted).child(`${shown.length} / ${records.length}`)).child(div().flex_1()).child(this.button('pm-filters','Filters',cx=>{this.panel=this.panel==='filters'?null:'filters';cx.notify();},t,this.panel==='filters')).child(this.button('pm-settings','Settings',cx=>{this.panel=this.panel==='settings'?null:'settings';cx.notify();},t,this.panel==='settings')))
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
  return h_flex().id(`pm-row-${id}`).h(54).flex_none().px(14).pt(9).gap(14).items_start().border_b(1).border_color(t.border).hover(s=>s.bg(t.hover))
   .child(div().w(56).flex_none().font_family(settings().font_family ?? 'JetBrains Mono').font_bold().child(String(r.port)))
   .child(v_flex().flex_1().min_w(0).gap(2).child(div().truncate().text_color(t.muted).child(`${r.name??'Unknown process'}${r.pid?` · ${r.pid}`:''}`))
    .child(div().truncate().text_size(12).text_color(t.dim).child(`${r.host}${stale?' · Stale':''}`)));
 }
}
