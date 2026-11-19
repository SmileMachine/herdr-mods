import { View, div } from 'gpui-kit';
import { v_flex, h_flex, Input, InputState } from 'gpui-base';
import { props, theme, shared, setShared, checking, openOverlay, closeOverlay, window, settings, spaces } from 'herdr';
import { compileFilter } from './model.js';
import { scanAll } from './runtime.js';
import { snapshotsChanged } from './discovery.js';
import { groupPorts } from './groups.js';

const PREF='port-manager.preferences', DATA='port-manager.snapshots';
const defaults={strategy:'process',name:'',nameMode:'text',nameAction:'exclude',ports:'',portAction:'include',terminalOnly:false,lowPortsOnly:false,includeUnattached:false};
const preferences=()=>({...defaults,...(shared(PREF)??{})});
const snapshots=()=>shared(DATA)??[];
export default class PortManager extends View {
 init(_p,cx) {
  this.popup=props()?.view==='popup' || Boolean(props()?.overlay); this.error=''; this.busy=false; this.showFilters=false;
  if (this.popup) {
   const p=preferences(); this.name=InputState.new({value:p.name,placeholder:'Process name'}); this.ports=InputState.new({value:p.ports,placeholder:'Ports: 3000,8000-8999'});
   const changed=(_e,cx)=>{const next={...preferences(),name:this.name.value(),ports:this.ports.value()}; try {compileFilter(next);this.error='';setShared(PREF,next);} catch(e) {this.error=String(e.message??e);} cx.notify();};
   this.name.on('change',changed); this.ports.on('change',changed); return;
  }
  if(checking()) return;
  this.scan(cx); cx.timer.every(5000,cx=>{if(window()?.active)this.scan(cx);});
 }
 scan(cx) {
  if(this.busy)return; this.busy=true;
  cx.spawn(async cx=>{try {const result=await scanAll(snapshots(),preferences().includeUnattached); if(snapshotsChanged(snapshots(),result))setShared(DATA,result);} catch(e){console.warn(`port-manager: ${e}`);} finally {this.busy=false;cx.notify();}});
 }
 set(key,value,cx){ const p={...preferences(),name:this.name?.value()??preferences().name,ports:this.ports?.value()??preferences().ports,[key]:value}; try {compileFilter(p);this.error='';setShared(PREF,p);} catch(e){this.error=String(e.message??e);}cx.notify(); }
 button(id,label,action,t){return div().id(id).px(7).py(4).rounded(5).cursor_pointer().tooltip(label).accessibility_label(label).hover(s=>s.bg(t.hover)).on_click((_e,cx)=>action(cx)).child(label);}
 render(cx){
  const t=theme(),p=preferences(),all=snapshots(),records=all.flatMap(x=>x.records),filter=compileFilter(p),shown=records.filter(filter);
  if(!this.popup) return h_flex().size_full().justify_end().items_center().bg(t.chrome).border_t(1).border_color(t.border)
   .child(this.button('pm-open',`Ports ${shown.length}`,()=>{const v=globalThis.window?.viewport_size?.(),z=settings().zoom??1;openOverlay({mod:'port-manager',kind:'popup',at:v?{x:Math.max(0,v.width-490*z),y:Math.max(0,v.height-630*z)}:'pointer',width:480,height:600,props:{view:'popup',height:600}});},t));
  const groups=groupPorts(all,spaces(),p.strategy,filter);
  const toggle=(key,label)=>this.button(`pm-${key}`,`${label}: ${p[key]?'On':'Off'}`,cx=>this.set(key,!p[key],cx),t);
  return v_flex().w_full().h(props()?.height ?? 600).bg(t.popover).text_color(t.foreground).text_size(13)
   .on_key_down((e,cx)=>{if(e.key==='escape'){closeOverlay(props().overlay);cx.stop_propagation();}})
   .child(h_flex().h(40).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border).child(div().font_medium().child('Ports')).child(div().text_size(12).text_color(t.muted).child(`${shown.length} / ${records.length}`)).child(div().flex_1()).child(this.button('pm-filters',this.showFilters?'Hide filters':'Filters',cx=>{this.showFilters=!this.showFilters;cx.notify();},t)).child(this.button('pm-close','Close',()=>closeOverlay(props().overlay),t)))
   .when(this.showFilters,el=>el.child(v_flex().flex_none().px(14).py(8).gap(6).border_b(1).border_color(t.border).text_size(12)
    .child(h_flex().gap(3).children([
    this.button('pm-strategy',`Attribution: ${p.strategy==='process'?'Process tree':'Working directory'}`,cx=>this.set('strategy',p.strategy==='process'?'cwd':'process',cx),t),
    toggle('includeUnattached','Ready machines')]))
    .child(h_flex().gap(3).children([toggle('terminalOnly','Terminal related'),toggle('lowPortsOnly','Port < 32768')]))
    .child(h_flex().gap(3).children([this.button('pm-mode',`Name: ${p.nameMode}`,cx=>this.set('nameMode',p.nameMode==='text'?'regex':'text',cx),t),this.button('pm-name-action',p.nameAction==='exclude'?'Exclude name':'Include name',cx=>this.set('nameAction',p.nameAction==='exclude'?'include':'exclude',cx),t)]))
    .child(h_flex().gap(6).child(Input.new(this.name).flex_1().h(30).px(6).border_1().border_color(t.input).bg(t.background))
     .child(Input.new(this.ports).w(145).h(30).px(6).border_1().border_color(t.input).bg(t.background))
     .child(this.button('pm-port-action',p.portAction==='include'?'Include':'Exclude',cx=>this.set('portAction',p.portAction==='include'?'exclude':'include',cx),t)))
    .when(Boolean(this.error),el=>el.child(div().text_color(t.ansi1).child(`${this.error}; previous filter remains active`)))
    .child(div().text_color(t.dim).child('Filters only hide rows. Unknown names and terminal status remain visible.'))
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
     return [h_flex().id(`pm-other-${i}`).h(34).flex_none().px(14).gap(8).items_center().bg(t.raised).border_b(1).border_color(t.border)
      .child(div().flex_1().min_w(0).truncate().child(`${group.machine??'This computer'} · ${labels[group.category]}`))
      .child(div().text_size(12).text_color(t.muted).child(`${group.records.length}`)),
      ...group.records.map((entry,j)=>this.portRow(entry,`other-${i}-${j}`,t))];
    })));
 }
 portRow({record:r,stale},id,t){
  return h_flex().id(`pm-row-${id}`).h(54).flex_none().px(14).pt(9).gap(14).items_start().border_b(1).border_color(t.border).hover(s=>s.bg(t.hover))
   .child(div().w(56).flex_none().font_family(settings().font_family ?? 'JetBrains Mono').font_bold().child(String(r.port)))
   .child(v_flex().flex_1().min_w(0).gap(2).child(div().truncate().text_color(t.muted).child(`${r.name??'Unknown process'}${r.pid?` · ${r.pid}`:''}`))
    .child(div().truncate().text_size(12).text_color(t.dim).child(`${r.host}${stale?' · Stale':''}`)));
 }
}
