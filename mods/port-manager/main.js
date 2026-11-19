import { View, div } from 'gpui-kit';
import { v_flex, h_flex, Input, InputState } from 'gpui-base';
import { props, theme, shared, setShared, checking, openOverlay, closeOverlay, window, settings, spaces } from 'herdr';
import { compileFilter } from './model.js';
import { scanAll } from './runtime.js';
import { snapshotsChanged } from './discovery.js';

const PREF='port-manager.preferences', DATA='port-manager.snapshots';
const defaults={strategy:'process',name:'',nameMode:'text',nameAction:'exclude',ports:'',portAction:'include',terminalOnly:false,lowPortsOnly:false,includeUnattached:false};
const preferences=()=>({...defaults,...(shared(PREF)??{})});
const snapshots=()=>shared(DATA)??[];
export default class PortManager extends View {
 init(_p,cx) {
  this.popup=Boolean(props()?.overlay); this.error=''; this.busy=false;
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
   .child(this.button('pm-open',`Ports ${shown.length}`,()=>{const v=globalThis.window?.viewport_size?.(),z=settings().zoom??1;openOverlay({mod:'port-manager',kind:'popup',at:v?{x:Math.max(0,v.width-630*z),y:Math.max(0,v.height-650*z)}:'pointer',width:620,height:620,props:{view:'popup'}});},t));
  const toggle=(key,label)=>this.button(`pm-${key}`,`${label}: ${p[key]?'On':'Off'}`,cx=>this.set(key,!p[key],cx),t);
  return v_flex().size_full().p(10).gap(6).bg(t.popover).text_color(t.foreground).text_size(12)
   .on_key_down((e,cx)=>{if(e.key==='escape'){closeOverlay(props().overlay);cx.stop_propagation();}})
   .child(h_flex().gap(6).items_center().child(div().font_medium().child(`Ports ${shown.length} / ${records.length}`)).child(div().flex_1()).child(this.button('pm-close','Close',()=>closeOverlay(props().overlay),t)))
   .child(h_flex().gap(3).children([
    this.button('pm-strategy',`Attribution: ${p.strategy==='process'?'Process tree':'Working directory'}`,cx=>this.set('strategy',p.strategy==='process'?'cwd':'process',cx),t),
    toggle('includeUnattached','Ready machines without spaces')]))
   .child(h_flex().gap(3).children([toggle('terminalOnly','Terminal related'),toggle('lowPortsOnly','Port < 32768'),this.button('pm-mode',`Name: ${p.nameMode}`,cx=>this.set('nameMode',p.nameMode==='text'?'regex':'text',cx),t),this.button('pm-name-action',p.nameAction==='exclude'?'Exclude name':'Include name',cx=>this.set('nameAction',p.nameAction==='exclude'?'include':'exclude',cx),t)]))
   .child(h_flex().gap(6).child(Input.new(this.name).flex_1().h(30).px(6).border_1().border_color(t.input).bg(t.background))
    .child(Input.new(this.ports).w(170).h(30).px(6).border_1().border_color(t.input).bg(t.background))
    .child(this.button('pm-port-action',p.portAction==='include'?'Include':'Exclude',cx=>this.set('portAction',p.portAction==='include'?'exclude':'include',cx),t)))
   .when(Boolean(this.error),el=>el.child(div().text_color(t.ansi1).child(`${this.error}; previous filter remains active`)))
   .child(div().text_color(t.dim).child('Filters affect display only. Unknown names and terminal status remain visible. Regex uses JavaScript syntax.'))
   .when(!all.length,el=>el.child(div().text_color(t.muted).child('Scanning listeners…')))
   .when(all.length>0 && !records.length,el=>el.child(div().text_color(t.muted).child('No listeners found. Check machine errors below.')))
   .when(records.length>0 && !shown.length,el=>el.child(div().text_color(t.muted).child('No ports match the current filters.')))
   .child(v_flex().id('pm-list').flex_1().min_h(0).overflow_y_scrollbar().children(all.flatMap((group,i)=>{
    const rows=group.records.filter(filter); return [h_flex().id(`pm-machine-${i}`).h(28).flex_none().px(6).items_center().bg(t.raised).child(div().flex_1().child(group.machine??'This computer')).child(div().text_color(group.stale?t.ansi1:t.muted).child(group.stale?`Stale: ${group.error}`:`${rows.length} ports`)),...rows.map((r,j)=>{
      const space=p.strategy==='process'?r.processSpace:r.cwdSpace; const attribution=(space ? (spaces().find(x=>x.id===space)?.name ?? space) : null)??(p.strategy==='cwd'&&r.cwdReason==='ambiguous'?'Ambiguous checkout':r.terminal==='yes'?'Other terminal':r.terminal==='no'?'Other process':'Unknown');
      return h_flex().id(`pm-row-${i}-${j}`).h(43).flex_none().gap(8).px(6).items_center().border_b(1).border_color(t.border)
       .child(div().w(55).flex_none().child(String(r.port))).child(v_flex().flex_1().min_w(0).child(div().truncate().child(`${r.name??'Unknown process'}${r.pid?` · ${r.pid}`:''}`)).child(div().truncate().text_color(t.dim).child(`${r.host} · ${attribution}`)));
    })];
   })));
 }
}
