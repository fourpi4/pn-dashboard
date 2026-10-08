const ORGS=["Маркет Плейс","Сайкал Стор","Галерея Ош","Даана Ош","Бест Аккаунтинг"];
const REGS=["АУП","Кызыл Кия","Джалал Абад"];
// Ставки: НК КР 2022 (ПН 10%, ст. 194 вычеты), Закон КР «О тарифах страховых взносов» (работник ПФ 8% + ГНПФ 2%;
// пенсионер — 8% без ГНПФ; инвалид I–II гр. — 2%); предел базы взносов с 2026 — 20 × 36 047
const RATE_DEF={
  pn:{l:"Подоходный налог, %",v:10,g:"Подоходный налог"},ded:{l:"Стандартный вычет, сом",v:650,g:"Подоходный налог"},dep:{l:"Вычет на иждивенца, сом",v:100,g:"Подоходный налог"},
  mrdPct:{l:"МРД, % от СМЗ района (0 — не применять)",v:60,g:"Подоходный налог"},
  sf:{l:"Взнос работника в ПФ, %",v:8,g:"Обычный сотрудник (уменьшает базу ПН)"},gnpf:{l:"ГНПФ (НПФ), %",v:2,g:"Обычный сотрудник (уменьшает базу ПН)"},emp:{l:"Взнос работодателя, % (сверх оклада)",v:2.25,g:"Обычный сотрудник (уменьшает базу ПН)"},
  p_sf:{l:"Взнос работника в ПФ, %",v:8,g:"Пенсионер"},p_gn:{l:"ГНПФ (НПФ), %",v:0,g:"Пенсионер"},p_emp:{l:"Взнос работодателя, %",v:2.25,g:"Пенсионер"},
  i_sf:{l:"Взнос работника в ПФ, %",v:2,g:"Инвалид I–II группы"},i_gn:{l:"ГНПФ (НПФ), %",v:0,g:"Инвалид I–II группы"},i_emp:{l:"Взнос работодателя, %",v:1.25,g:"Инвалид I–II группы"},
  cap:{l:"Предельная база взносов, сом",v:720940,g:"База страховых взносов"},
  penW:{l:"Женщины — пенсионер с, лет",v:58,g:"Пенсионный возраст (категория «Авто» по ИНН)"},penM:{l:"Мужчины — пенсионер с, лет",v:63,g:"Пенсионный возраст (категория «Авто» по ИНН)"}
};
const CATS={std:"001",pens:"003 пенс.",inv:"инвалид",mop:"106 МОП"};
const curMonth=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`};
const DEF=()=>({emps:[],pays:[],smz:{},rates:Object.fromEntries(Object.entries(RATE_DEF).map(([k,o])=>[k,o.v])),period:"",year:0,mod:null,src:null,showAll:false});
let S=DEF();

// ================= Связь с ботом «Аванс»: данные сайта хранятся на сервере бота в зашифрованном виде =================
// Адрес бота и ключ (команда /pn_key у бота) вводятся один раз и запоминаются только в этом браузере.
const CONN_KEY="pn_bot_conn";
const DEF_BOT_URL="https://avans-osh.onrender.com";
let CONN=null;
try{CONN=JSON.parse(localStorage.getItem(CONN_KEY)||"null")}catch(e){}
let ME=null;
const SRV={version:0,timer:null,saving:false,dirty:false,err:"",stop:false};
async function api(path,body){
  if(!CONN||!CONN.key)throw Object.assign(new Error("Не указан ключ бота"),{status:401});
  let r;
  try{r=await fetch(CONN.url.replace(/\/+$/,"")+"/api/pn/"+path,{method:body?"POST":"GET",headers:{"content-type":"application/json",authorization:"Bearer "+CONN.key},body:body?JSON.stringify(body):undefined})}
  catch(e){throw Object.assign(new Error("Бот «Аванс» недоступен — проверьте интернет и адрес бота"),{status:0})}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(j.error||`Ошибка сервера ${r.status}`),{status:r.status});
  return j;
}
// Каждое изменение уходит на сервер через 0,8 с; одновременную правку другим пользователем сервер отклоняет (409)
const save=()=>{S.mod=Date.now();SRV.dirty=true;clearTimeout(SRV.timer);if(!SRV.stop)SRV.timer=setTimeout(flush,800);syncNote()};
async function flush(){
  if(SRV.saving||!SRV.dirty||SRV.stop)return;
  SRV.saving=true;SRV.dirty=false;syncNote();
  try{const r=await api("state",{state:S,version:SRV.version});SRV.version=r.version;SRV.err=""}
  catch(e){
    SRV.dirty=true;SRV.err=e.message;
    if(e.status===409){SRV.dirty=false;SRV.err="";await note(e.message+"\nВаши последние изменения не сохранены — повторите их.");await loadState()}
    else if(e.status===401||e.status===403){SRV.stop=true;note(e.message+"\nУкажите новый ключ в «🔗 Бот «Аванс»». Несохранённые изменения будут потеряны.")}
  }
  finally{SRV.saving=false;syncNote();if(SRV.dirty&&!SRV.stop)SRV.timer=setTimeout(flush,4000)}
}
function syncNote(){
  const el=document.getElementById("syncSt");if(!el)return;
  el.className="sync "+(SRV.err?"bad":SRV.saving||SRV.dirty?"busy":"ok");
  el.textContent=SRV.err?"⚠ не сохранено: "+SRV.err:SRV.saving||SRV.dirty?"сохраняю…":"✓ сохранено на сервере";
}
window.addEventListener("beforeunload",ev=>{if(SRV.dirty||SRV.saving){ev.preventDefault();ev.returnValue=""}});
async function loadState(){
  const r=await api("state"),d=DEF(),st=r.state||{};
  S={...d,...st,rates:{...d.rates,...(st.rates||{})}};
  if(!S.period)S.period=curMonth();if(!S.year)S.year=+S.period.slice(0,4);
  SRV.version=r.version||0;SRV.info=r;
  period.value=S.period;showAll.checked=!!S.showAll;
  BOT.per="";render();refreshBot(true);
}
// ---- Связь с ботом: сотрудник дашборда ↔ сотрудник бота (Telegram ID → ИНН → ФИО), авансы за период
const BOT={per:"",links:{},requests:[],err:"",loading:false,staff:0};
async function refreshBot(force){
  const per=S.period;if(!force&&BOT.per===per)return;
  BOT.loading=true;renderBotNote();
  try{
    const r=await api("advances",{period:per,employees:S.emps.map(e=>({key:e.id,inn:e.inn||"",fio:e.fio||"",tg:e.tg||""}))});
    if(per!==S.period)return;
    BOT.per=per;BOT.links=Object.fromEntries(r.links.map(l=>[l.key,l]));BOT.requests=r.requests||[];BOT.staff=r.botEmployees;BOT.err="";
  }catch(e){BOT.err=e.message}
  BOT.loading=false;render();
}
const linkOf=e=>BOT.per===S.period?BOT.links[e.id]:null;
function advOf(e){const l=linkOf(e);return l&&l.matched?l.advances:null}
const advTaken=a=>a?r2(num(a.paid)+num(a.approved)):0;   // выдано + одобрено (к выдаче)
function renderBotNote(){
  const el=document.getElementById("botNote");if(!el)return;
  const per=S.emps.filter(e=>active(e,S.period)),m=per.filter(e=>(linkOf(e)||{}).matched).length;
  el.innerHTML=BOT.loading?"Бот «Аванс»: загружаю авансы…":BOT.err?`<span class="sync bad">Бот «Аванс»: ${esc(BOT.err)}</span>`:
    `Бот «Аванс»: связано <b>${m}</b> из ${per.length} сотрудников (в боте ${BOT.staff}). Связь — по Telegram ID, ИНН или ФИО. Начисленное и дни факт правьте прямо в таблице.`;
}
// ---- Свои окна для сообщений и подтверждений
function msgBox(text,cancel){return new Promise(res=>{msgText.textContent=text;msgCancel.hidden=!cancel;dlgMsg.returnValue="";dlgMsg.onclose=()=>res(dlgMsg.returnValue==="ok");dlgMsg.showModal()})}
const note=t=>msgBox(t,false),ask=t=>msgBox(t,true);
const r2=x=>Math.round(x*100)/100;
const num=v=>{if(v==null||v==="")return 0;const n=parseFloat(String(v).replace(/\s/g,"").replace(",","."));return isNaN(n)?0:n};
const fmt=x=>(x||0).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt0=x=>(x||0).toLocaleString("ru-RU",{maximumFractionDigits:0});
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtD=d=>d?String(d).split("-").reverse().join("."):"";
const uid=()=>Math.random().toString(36).slice(2,10);
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return n+" "+(m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c)};
function xlDate(v){if(v==null||v==="")return"";if(typeof v==="number"){const d=new Date(Math.round((v-25569)*864e5));return d.toISOString().slice(0,10)}const s=String(v).trim(),m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(m)return`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;return/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):""}
const MONTHS=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const perLabel=p=>{const[y,m]=(p||"").split("-").map(Number);return y?`${MONTHS[m-1]} ${y}`:"—"};
const todayIso=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};

let V={view:"main",org:"",reg:"",sort:"fio",dir:1};

// ---- Период: границы месяца, срок уплаты (20-е число следующего месяца)
function perBounds(per){const[y,m]=per.split("-").map(Number),last=new Date(y,m,0).getDate();return{start:per+"-01",end:`${per}-${String(last).padStart(2,"0")}`,last}}
function dueOf(per){const[y,m]=per.split("-").map(Number),d=new Date(y,m,20);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-20`}
const DAY_OFF=[5];   // выходной — пятница (как в «Кадры и ЗП»)
function workDays(fromIso,toIso){let n=0;const d=new Date(fromIso+"T00:00:00"),e=new Date(toIso+"T00:00:00");for(;d<=e;d.setDate(d.getDate()+1))if(!DAY_OFF.includes(d.getDay()))n++;return n}

// ---- ИНН физлица КР: 1-я цифра пол (1 — жен., 2 — муж.), затем дата рождения ДДММГГГГ
function innInfo(inn){
  inn=String(inn||"").replace(/\D/g,"");
  if(inn.length!==14)return{ok:false,msg:inn?`ИНН должен быть 14 цифр (сейчас ${inn.length})`:""};
  const sex=inn[0]==="1"?"жен.":inn[0]==="2"?"муж.":null;
  const d=+inn.slice(1,3),m=+inn.slice(3,5),y=+inn.slice(5,9),dt=new Date(y,m-1,d);
  if(!sex||dt.getDate()!==d||dt.getMonth()!==m-1||y<1900||dt>new Date())return{ok:false,msg:"ИНН не похож на ИНН физлица — дата рождения не читается"};
  return{ok:true,birth:`${String(d).padStart(2,"0")}.${String(m).padStart(2,"0")}.${y}`,sex,d,m,y};
}
function catOf(e,per){
  if(e.cat&&e.cat!=="auto")return e.cat;
  const ii=innInfo(e.inn);if(!ii.ok)return"std";
  const end=perBounds(per).end,[Y,M,D]=end.split("-").map(Number);let age=Y-ii.y;if(M<ii.m||(M===ii.m&&D<ii.d))age--;
  return age>=(ii.sex==="жен."?num(S.rates.penW):num(S.rates.penM))?"pens":"std";
}

// ---- Трудовые отношения в месяце: от даты приёма до даты увольнения
function empSpan(e,per){
  const b=perBounds(per),from=e.ordDate&&e.ordDate>b.start?e.ordDate:b.start,to=e.fireDate&&e.fireDate<b.end?e.fireDate:b.end;
  if(from>to)return{days:0,from,to,...b};
  return{days:Math.round((new Date(to+"T00:00:00")-new Date(from+"T00:00:00"))/864e5)+1,from,to,...b};
}
// без даты приёма сотрудник считается работающим с месяца, в котором его добавили (e.since)
const active=(e,per)=>empSpan(e,per).days>0&&(e.ordDate||!e.since||per>=e.since);
const mrec=(e,per)=>(e.m&&e.m[per])||{};

// ---- Профиль: ставки категории; ст. 200 ч. 7 — вычет 650/иждивенцы только при ≥ 15 днях и не совместителю
function prof(e,per){
  const R=S.rates,c=catOf(e,per);
  const p=c==="pens"?{sf:R.p_sf,gn:R.p_gn}:c==="inv"?{sf:R.i_sf,gn:R.i_gn}:{sf:R.sf,gn:R.gnpf};
  p.pn=R.pn;p.cat=c;p.short=empSpan(e,per).days<15;
  p.ded=e.dedMode==="1"?true:e.dedMode==="0"?false:!e.part&&!p.short;
  p.mrdOn=!e.part&&c!=="mop"&&c!=="inv";
  return p;
}
// МРД = mrdPct% СМЗ района, пропорционально «дням факт» к норме месяца (календарь без пятниц)
function mrdOf(e,per,p){
  const R=S.rates;if(!p.mrdOn||!num(R.mrdPct))return 0;
  const smz=num(S.smz[e.org+"|"+e.reg]);if(!smz)return 0;
  const sp=empSpan(e,per),norm=workDays(sp.start,sp.end),r=mrec(e,per),fact=r.days!=null&&r.days!==""?num(r.days):workDays(sp.from,sp.to);
  return r2(smz*num(R.mrdPct)/100*(norm?Math.min(1,fact/norm):1));
}
// Ядро расчёта ПН (используется и в ведомости, и в калькуляторе)
function core(o,nt,p,deps,mrd){
  const R=S.rates,base=R.cap>0?Math.min(o,R.cap):o;
  const sf=r2(base*p.sf/100),gn=r2(base*p.gn/100);
  const dedFull=p.ded?num(R.ded)+num(R.dep)*num(deps):0;
  const ded=r2(Math.min(dedFull,Math.max(0,o-nt-sf-gn)));
  const tb=r2(Math.max(0,o-nt-sf-gn-dedFull));
  const pn=r2(tb*p.pn/100);                                        // удерживается из дохода (гр. 16)
  const pnMrd=o>0&&mrd>tb?r2((mrd-tb)*p.pn/100):0;                  // за счёт работодателя (гр. 17)
  return{o,nt,sf,gn,ded,tb,pn,mrd,pnMrd,pnAll:r2(pn+pnMrd),net:r2(o-sf-gn-pn)};
}
const ZERO={o:0,nt:0,sf:0,gn:0,ded:0,tb:0,pn:0,mrd:0,pnMrd:0,pnAll:0,net:0};
function calc(e,per){
  per=per||S.period;if(!active(e,per))return{...ZERO,off:true};
  const r=mrec(e,per),o=r.acc!=null&&r.acc!==""?num(r.acc):num(e.oklad),p=prof(e,per);
  return core(o,num(r.nt),p,e.deps,o>0?mrdOf(e,per,p):0);
}
function sum(list,per){per=per||S.period;const a={cnt:0,part:0,mrdCnt:0,...ZERO};for(const e of list){const c=calc(e,per);if(c.off)continue;for(const k in ZERO)a[k]+=c[k];a.cnt++;if(e.part)a.part++;if(c.pnMrd>0)a.mrdCnt++}for(const k in ZERO)a[k]=r2(a[k]);return a}
function orgList(){return[...new Set([...ORGS,...S.emps.map(e=>e.org),...S.pays.map(p=>p.org)].filter(Boolean))]}
function regList(){return[...new Set([...REGS,...S.emps.map(e=>e.reg)].filter(Boolean))]}

// ---- Платежи
const paysOf=(org,reg,per)=>S.pays.filter(p=>(!org||p.org===org)&&(!reg||p.reg===reg)&&(!per||p.per===per));
const paidOf=(org,reg,per)=>r2(paysOf(org,reg,per).reduce((s,p)=>s+num(p.sum),0));
function status(per,accr,rest){
  if(accr<=0&&rest>=-0.005)return`<span class="st none">—</span>`;
  if(rest<=0.005)return rest<-0.005?`<span class="st auto">Переплата ${fmt(-rest)}</span>`:`<span class="st auto">Оплачено</span>`;
  const due=dueOf(per),t=todayIso();
  if(t>due){const d=Math.round((new Date(t)-new Date(due))/864e5);return`<span class="st bad">Просрочено ${plural(d,"день","дня","дней")}</span>`}
  const d=Math.round((new Date(due)-new Date(t))/864e5);return`<span class="st pending">До ${fmtD(due)} · ${plural(d,"день","дня","дней")}</span>`;
}
function yearRows(emps,org,year){
  const rows=[];
  for(let m=1;m<=12;m++){const per=`${year}-${String(m).padStart(2,"0")}`,t=sum(emps,per),paid=paidOf(org,"",per);rows.push({per,t,paid,rest:r2(t.pnAll-paid),future:per>curMonth()})}   // будущие месяцы — прогноз, в итоги не входят
  return rows;
}

// ================= Отрисовка =================
const scopeList=()=>S.emps.filter(e=>!V.org||e.org===V.org);
function render(){
  viewMain.hidden=V.view!=="main";viewVed.hidden=V.view!=="ved";viewPay.hidden=V.view!=="pay";
  renderNav();
  const scope=scopeList();
  if(V.view==="ved")renderVed(scope);else if(V.view==="pay")renderPay(scope);else{renderHead(scope);renderPivot(scope);renderAdv();renderYear(scope)}
  const src=S.src?`Excel «${esc(S.src.name)}» загружен ${new Date(S.src.at).toLocaleString("ru-RU")}`:"ручной ввод";
  fresh.innerHTML=`<span id="syncSt"></span> · бот «Аванс» ${esc(CONN?CONN.url.replace(/^https?:\/\//,""):"не подключён")} · данные: ${src} · изменено ${S.mod?new Date(S.mod).toLocaleString("ru-RU"):"—"} · период <b>${perLabel(S.period)}</b>, срок уплаты ПН до ${fmtD(dueOf(S.period))} · <b>не база ОФ</b>`;
  syncNote();renderBotNote();
}
function go(org,reg){V.view="main";V.org=org;V.reg=reg||"";render();window.scrollTo({top:0})}
function openVed(org,reg){V.view="ved";V.org=org||"";V.reg=reg||"";fq.value="";render();window.scrollTo({top:0})}

function renderNav(){
  const all=sum(S.emps),maxO=Math.max(1,...orgList().map(o=>sum(S.emps.filter(e=>e.org===o)).pnAll));
  const rest=(o,t)=>r2(t.pnAll-paidOf(o,"",S.period));
  let h=`<button class="oc all ${!V.org&&V.view!=="pay"?"on":""}" data-o=""><div class="t">Все организации <span class="badge">${all.cnt}</span></div><div class="m"><span>ПН ${fmt0(all.pnAll)}</span><span>остаток ${fmt0(rest("",all))}</span></div></button><div class="nav-h">Организации · ${perLabel(S.period)}</div>`;
  for(const org of orgList()){
    const t=sum(S.emps.filter(e=>e.org===org)),rs=rest(org,t);
    h+=`<button class="oc ${org===V.org&&V.view!=="pay"?"on":""}" data-o="${esc(org)}"><div class="t">${esc(org)} <span class="badge">${t.cnt}</span></div><div class="m"><span>ПН ${fmt0(t.pnAll)}</span><span>${t.cnt||rs?(rs>0.005?"к уплате "+fmt0(rs):"оплачено"):"нет сотрудников"}</span></div><div class="bar"><i style="width:${(t.pnAll/maxO*100).toFixed(1)}%"></i></div></button>`;
  }
  h+=`<div class="navbot"><div class="nav-h">Учёт</div>
    <button class="nb ${V.view==="pay"?"on":""}" data-nv="pay"><span>💳 Платежи по ПН</span><span class="c">${S.pays.length}</span></button>
    <button class="nb" data-nv="rates"><span>⚙ Ставки и СМЗ районов</span></button></div>`;
  nav.innerHTML=h;
}
nav.addEventListener("click",ev=>{
  const n=ev.target.closest("[data-nv]");
  if(n){if(n.dataset.nv==="pay"){V.view="pay";render();window.scrollTo({top:0})}else openRates();return}
  const b=ev.target.closest("[data-o]");if(b)go(b.dataset.o,"");
});

const kpiHtml=K=>K.map(([l,v,c])=>`<div class="kpi ${c||""}"><div class="l">${l}</div><div class="v">${typeof v==="number"?fmt(v):v}</div></div>`).join("");
function renderHead(scope){
  const t=sum(scope),paid=paidOf(V.org,"",S.period),rest=r2(t.pnAll-paid);
  crumbs.innerHTML=V.org?`<a data-o="">Все организации</a> › ${esc(V.org)}`:"Сводка по всем организациям ОФ";
  ttl.textContent=(V.org||"Все организации")+" · "+perLabel(S.period);
  const ch=[plural(t.cnt,"сотрудник","сотрудника","сотрудников")];
  if(t.part)ch.push(`совместителей: ${t.part}`);
  if(t.mrdCnt)ch.push(`ПН с МРД: ${t.mrdCnt} чел.`);
  ch.push(`срок уплаты до ${fmtD(dueOf(S.period))}`);
  chips.innerHTML=ch.map(c=>`<span class="chip">${c}</span>`).join("");
  kpis.innerHTML=kpiHtml([["Начислено доходов",t.o],["Вычеты (взносы + стандартные)",t.sf+t.gn+t.ded],["Облагаемая база",t.tb],["ПН удержан из дохода",t.pn],["ПН с МРД (за счёт работодателя)",t.pnMrd],["ПН к уплате всего",t.pnAll],["Уплачено за период",paid],[rest<-0.005?"Переплата":"Остаток к уплате",Math.abs(rest),"main"]]);
}
crumbs.addEventListener("click",ev=>{const b=ev.target.closest("[data-o]");if(b)go(b.dataset.o,"")});

function renderPivot(scope){
  const byReg=!!V.org,items=byReg?regList():orgList(),key=byReg?"reg":"org";
  pivotTitle.textContent=(byReg?"Итоги по регионам":"Итоги по организациям")+" · "+perLabel(S.period);
  pivotNote.textContent=byReg?"Платежи без указания региона учитываются только в итоге организации":"Клик по строке — открыть организацию";
  const T=sum(scope);
  const row=(cls,attrs,name,t,paid,share)=>{const rest=r2(t.pnAll-paid);return`<tr class="${cls}" ${attrs}><td>${name}${share==null?"":`<div style="font-size:11px;color:var(--mute);font-weight:400"><span class="shr"><i style="width:${share}%"></i></span>${share.toFixed(0)}% ПН</div>`}</td><td class="n">${t.cnt}</td><td class="n gl">${fmt(t.o)}</td><td class="n ded">${fmt(t.sf+t.gn)}</td><td class="n ded">${fmt(t.ded)}</td><td class="n">${fmt(t.tb)}</td><td class="n gl">${fmt(t.pn)}</td><td class="n">${fmt(t.pnMrd)}</td><td class="n net">${fmt(t.pnAll)}</td><td class="n gl">${fmt(paid)}</td><td class="n" style="font-weight:600;color:${rest>0.005?"var(--warn)":"var(--ok)"}">${fmt(rest)}</td></tr>`};
  const th=(l,c,t)=>`<th class="${c||""}" style="top:0" ${t?`title="${t}"`:""}>${l}</th>`;
  let h=`<thead><tr class="h">${th(byReg?"Регион":"Организация")}${th("Чел.","n")}${th("Начислено","n gl")}${th("Взносы ПФ + ГНПФ","n","Взнос работника в ПФ и ГНПФ — уменьшают базу ПН")}${th("Станд. вычеты","n","650 + 100 × иждивенцы (ст. 194)")}${th("Облаг. база","n")}${th("ПН удержан","n gl","гр. 16 STI-161")}${th("ПН с МРД","n","гр. 17 STI-161 — за счёт работодателя")}${th("ПН всего","n","гр. 18 STI-161")}${th("Уплачено","n gl")}${th("Остаток","n")}</tr></thead><tbody>`;
  for(const it of items){
    const t=sum(scope.filter(e=>e[key]===it)),paid=byReg?paidOf(V.org,it,S.period):paidOf(it,"",S.period);
    if(!t.cnt&&!paid&&!byReg&&!ORGS.includes(it))continue;
    h+=row("go",byReg?`data-r="${esc(it)}"`:`data-o="${esc(it)}"`,esc(it)+" ›",t,paid,T.pnAll?t.pnAll/T.pnAll*100:0);
  }
  h+=`</tbody><tfoot>${row("go",'data-all="1" title="Открыть ведомость ПН"',(byReg?`Итого «${esc(V.org)}»`:"Итого по всем")+" · ведомость ›",T,paidOf(V.org,"",S.period),null)}</tfoot>`;
  pivot.innerHTML=h;
}
pivot.addEventListener("click",ev=>{const r=ev.target.closest("tr.go");if(!r)return;if(r.dataset.all)openVed(V.org,"");else if(r.dataset.o!=null)go(r.dataset.o,"");else openVed(V.org,r.dataset.r)});

function renderYear(scope){
  yearTitle.textContent=`ПН по месяцам — ${V.org||"все организации"}`;yearLbl.textContent=S.year;
  const rows=yearRows(scope,V.org,S.year),max=Math.max(1,...rows.map(r=>r.t.pnAll));
  let h=`<thead><tr class="h"><th style="top:0">Месяц</th><th class="n" style="top:0">Чел.</th><th class="n gl" style="top:0">Начислено</th><th class="n" style="top:0">Облаг. база</th><th class="n gl" style="top:0">ПН удержан</th><th class="n" style="top:0">ПН с МРД</th><th class="n" style="top:0">ПН всего</th><th class="n gl" style="top:0">Уплачено</th><th class="n" style="top:0">Остаток</th><th style="top:0">Статус</th></tr></thead><tbody>`;
  const F={cnt:0,o:0,tb:0,pn:0,pnMrd:0,pnAll:0,paid:0,rest:0};
  for(const r of rows){
    const cur=r.per===S.period,empty=!r.t.cnt&&!r.paid||r.future;
    h+=`<tr class="go" data-per="${r.per}" style="${cur?"background:var(--acc2)":""}${empty?";color:var(--mute)":""}"><td>${cur?"▸ ":""}${perLabel(r.per)}<div style="font-size:11px;color:var(--mute);font-weight:400"><span class="shr"><i style="width:${(r.t.pnAll/max*100).toFixed(1)}%"></i></span></div></td><td class="n">${r.t.cnt}</td><td class="n gl">${fmt(r.t.o)}</td><td class="n">${fmt(r.t.tb)}</td><td class="n gl">${fmt(r.t.pn)}</td><td class="n">${fmt(r.t.pnMrd)}</td><td class="n net">${fmt(r.t.pnAll)}</td><td class="n gl">${fmt(r.paid)}</td><td class="n">${fmt(r.rest)}</td><td>${r.future?`<span class="st none">прогноз</span>`:status(r.per,r.t.pnAll,r.rest)}</td></tr>`;
    if(r.future)continue;
    for(const k of["o","tb","pn","pnMrd","pnAll"])F[k]+=r.t[k];F.paid+=r.paid;F.rest+=r.rest;
  }
  h+=`</tbody><tfoot><tr><td>Итого ${S.year} <span class="fresh">без прогноза</span></td><td></td><td class="n gl">${fmt(F.o)}</td><td class="n">${fmt(F.tb)}</td><td class="n gl">${fmt(F.pn)}</td><td class="n">${fmt(F.pnMrd)}</td><td class="n">${fmt(F.pnAll)}</td><td class="n gl">${fmt(F.paid)}</td><td class="n">${fmt(F.rest)}</td><td></td></tr></tfoot>`;
  yearTbl.innerHTML=h;
}
yearTbl.addEventListener("click",ev=>{const r=ev.target.closest("tr[data-per]");if(r)setPeriod(r.dataset.per)});
function shiftYear(d){S.year+=d;save();render()}
function setPeriod(p){S.period=p;period.value=p;S.year=+p.slice(0,4);save();render();refreshBot()}

// ---- Ведомость ПН
const COLS=[
  {k:"fio",l:"Сотрудник",s:1},{k:"cat",l:"Кат."},{k:"deps",l:"Ижд.",n:1},{k:"oklad",l:"Оклад",n:1,gl:1},
  {k:"acc",l:"Начислено",n:1,in:1,s:1},{k:"nt",l:"Необлаг.",n:1,in:1},{k:"days",l:"Дней факт",n:1,in:1},
  {k:"sf",l:"ПФ",n:1,gl:1},{k:"gn",l:"ГНПФ",n:1},{k:"ded",l:"Вычет",n:1},{k:"tb",l:"Облаг. база",n:1},
  {k:"pn",l:"ПН",n:1,gl:1,s:1},{k:"mrd",l:"МРД",n:1},{k:"pnMrd",l:"ПН с МРД",n:1},{k:"pnAll",l:"ПН всего",n:1,s:1},{k:"net",l:"На руки",n:1,gl:1},{k:"adv",l:"Аванс (бот)",n:1},{k:"pay",l:"К выплате",n:1},{k:"x",l:""}
];
function sortVal(e,k){if(k==="fio")return(e.fio||"").toLowerCase();const c=calc(e);return k==="acc"?c.o:c[k]}
const initials=f=>String(f||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
function cell(c,e,x){
  const per=S.period,r=mrec(e,per),p=prof(e,per);
  switch(c.k){
    case"fio":{const tags=(e.part?`<span class="tag a">совм.</span>`:"")+(x.off?`<span class="tag in">не работал</span>`:"")+(e.fireDate?`<span class="tag in">уволен ${fmtD(e.fireDate)}</span>`:"");
      return`<td class="fio"><div class="who"><span class="av">${esc(initials(e.fio))}</span><div><div class="nm">${esc(e.fio)}${tags}</div><div class="sm">${esc(e.inn||"ИНН не указан")} · ${esc(e.org)} · ${esc(e.reg)}</div></div></div></td>`}
    case"cat":return`<td>${CATS[p.cat]}${e.cat==="auto"||!e.cat?` <span class="fresh">авто</span>`:""}</td>`;
    case"deps":return`<td class="n">${num(e.deps)||""}</td>`;
    case"oklad":return`<td class="n gl ded">${fmt(num(e.oklad))}</td>`;
    case"acc":case"nt":case"days":{const v=r[c.k]!=null&&r[c.k]!==""?r[c.k]:"",ph=c.k==="acc"?fmt(num(e.oklad)):c.k==="nt"?"0":String(workDays(empSpan(e,per).from,empSpan(e,per).to));
      return`<td class="n"><input class="avi" data-f="${c.k}" data-id="${e.id}" value="${esc(v)}" placeholder="${esc(ph)}" inputmode="decimal" style="width:${c.k==="days"?60:100}px" ${x.off?"disabled":""}></td>`}
    case"ded":return`<td class="n ded" title="${p.ded?"вычет 650 + иждивенцы":"без вычета 650: "+(e.part?"совместитель":p.short?"< 15 дней":"отключён в карточке")}">${fmt(x.ded)}${p.ded?"":" <span class='tag a'>—</span>"}</td>`;
    case"pnAll":return`<td class="n net">${fmt(x.pnAll)}</td>`;
    case"adv":{const l=linkOf(e),a=advOf(e);if(!l||!l.matched)return`<td class="n adv none" title="Не найден в боте — укажите Telegram ID в карточке">${BOT.per===S.period?"нет в боте":"…"}</td>`;
      return`<td class="n adv" title="В боте: ${esc(l.fullName)} (${l.by==="telegram"?"по Telegram ID":l.by==="inn"?"по ИНН":"по ФИО"}) · выдано ${fmt(num(a.paid))}, одобрено ${fmt(num(a.approved))}">${fmt(advTaken(a))}${num(a.pending)?`<span class="sm">ждёт ${fmt0(num(a.pending))}</span>`:""}</td>`}
    case"pay":return`<td class="n" style="font-weight:600">${fmt(r2(x.net-advTaken(advOf(e))))}</td>`;
    case"x":return`<td><button class="ib act" data-edit="${e.id}" title="Карточка сотрудника">✎</button></td>`;
    default:return`<td class="n ${c.gl?"gl":""} ${["sf","gn"].includes(c.k)?"ded":""}">${fmt(x[c.k])}</td>`;
  }
}
function totRow(label,t,cls,list){
  const adv=r2((list||[]).reduce((s,e)=>s+advTaken(advOf(e)),0));t={...t,adv,pay:r2(t.net-adv)};
  return`<tr class="${cls}">${COLS.map(c=>c.k==="fio"?`<td class="fio">${label}</td>`:c.k==="adv"||c.k==="pay"?`<td class="n">${fmt(t[c.k])}</td>`:["o","sf","gn","ded","tb","pn","mrd","pnMrd","pnAll","net","nt"].includes(c.k==="acc"?"o":c.k)?`<td class="n ${c.gl?"gl":""}">${fmt(t[c.k==="acc"?"o":c.k])}</td>`:`<td class="${c.gl?"gl":""}"></td>`).join("")}</tr>`;
}
function renderVed(scope){
  const o=V.org,g=V.reg,list=scope.filter(e=>!g||e.reg===g),t=sum(list);
  vCrumbs.innerHTML=`<a data-o="">Все организации</a>${o?` › <a data-o="${esc(o)}">${esc(o)}</a>`:""} › Ведомость ПН${g?" › "+esc(g):""}`;
  vTtl.textContent=`Ведомость ПН · ${g||(o?o+" — все регионы":"все организации")}`;
  const ch=[perLabel(S.period),plural(t.cnt,"сотрудник","сотрудника","сотрудников")];if(o&&g)ch.push(o);if(t.part)ch.push(`совместителей: ${t.part}`);if(t.mrdCnt)ch.push(`ПН с МРД: ${t.mrdCnt}`);
  vChips.innerHTML=ch.map(c=>`<span class="chip">${esc(c)}</span>`).join("");
  const adv=r2(list.reduce((s,e)=>s+advTaken(advOf(e)),0));
  vKpis.innerHTML=kpiHtml([["Начислено",t.o],["ПН удержан",t.pn],["ПН всего (с МРД)",t.pnAll,"main"],["Аванс из бота (выдано + одобрено)",adv],["К выплате (на руки − аванс)",r2(t.net-adv)]]);
  const q=fq.value.trim().toLowerCase();
  let rows=list.filter(e=>(!q||[e.fio,e.inn].join(" ").toLowerCase().includes(q))&&(S.showAll||active(e,S.period)));
  let h=`<thead><tr class="h" style="top:0">${COLS.map(c=>`<th class="${c.n?"n":""} ${c.gl?"gl":""} ${c.s?"s":""} ${c.k==="fio"?"fio":""}" style="top:0" ${c.s?`data-s="${c.k}"`:""}>${c.l}${V.sort===c.k?`<span class="ar">${V.dir>0?"▲":"▼"}</span>`:""}</th>`).join("")}</tr></thead><tbody>`;
  if(!rows.length){tbl.innerHTML=h+`<tr><td colspan="${COLS.length}" class="empty">${S.emps.length?"Никого не найдено (уволенные и не работавшие в периоде скрыты).":"Нет сотрудников. Нажмите «+ Добавить сотрудника» или загрузите Excel по шаблону."}</td></tr></tbody>`;return}
  const cmp=(a,b)=>{const x=sortVal(a,V.sort),y=sortVal(b,V.sort);return(x>y?1:x<y?-1:0)*V.dir};
  const gk=!o?"org":!g?"reg":null,gitems=gk==="org"?orgList():gk==="reg"?regList():[null];
  for(const gi of gitems){
    const part=(gi==null?rows:rows.filter(e=>e[gk]===gi)).sort(cmp);if(!part.length)continue;
    if(gi!=null)h+=totRow(`${esc(gi)} <span style="color:var(--mute);font-weight:400">· ${part.length} чел.</span>`,sum(part),"grp",part);
    for(const e of part)h+=`<tr class="e">${COLS.map(c=>cell(c,e,calc(e))).join("")}</tr>`;
  }
  tbl.innerHTML=h+`</tbody><tfoot>${totRow(`ИТОГО · ${rows.length} чел.`,sum(rows),"",rows)}</tfoot>`;
}
vCrumbs.addEventListener("click",ev=>{const b=ev.target.closest("[data-o]");if(b)go(b.dataset.o,"")});
tbl.addEventListener("click",ev=>{
  const s=ev.target.closest("[data-s]");
  if(s){if(V.sort===s.dataset.s)V.dir=-V.dir;else{V.sort=s.dataset.s;V.dir=s.dataset.s==="fio"?1:-1}return render()}
  const ed=ev.target.closest("[data-edit]");if(ed)openForm(ed.dataset.edit);
});
tbl.addEventListener("change",ev=>{
  const f=ev.target.dataset.f,e=S.emps.find(x=>x.id===ev.target.dataset.id);if(!f||!e)return;
  setM(e,S.period,f,ev.target.value.trim()===""?"":num(ev.target.value));save();render();
});
function setM(e,per,f,v){e.m=e.m||{};const r=e.m[per]||(e.m[per]={});if(v===""||v==null)delete r[f];else r[f]=v;if(!Object.keys(r).length)delete e.m[per]}
fq.oninput=()=>renderVed(scopeList());
showAll.checked=!!S.showAll;showAll.onchange=()=>{S.showAll=showAll.checked;save();render()};

// ---- Платежи
function renderPay(scope){
  const o=V.org,rows=yearRows(scope,o,S.year),t=todayIso();
  pChips.innerHTML=[o||"Все организации",`${S.year} год`].map(c=>`<span class="chip">${esc(c)}</span>`).join("")+`<span class="chip" style="cursor:pointer" data-act="yearPrev">◀ ${S.year-1}</span><span class="chip" style="cursor:pointer" data-act="yearNext">${S.year+1} ▶</span>`;
  const A=rows.reduce((a,r)=>{if(r.future)return a;a.acc+=r.t.pnAll;a.paid+=r.paid;if(r.rest>0.005)a.rest+=r.rest;if(r.rest>0.005&&t>dueOf(r.per))a.over+=r.rest;return a},{acc:0,paid:0,rest:0,over:0});
  pKpis.innerHTML=kpiHtml([[`ПН начислено за ${S.year}`,A.acc],[`Уплачено за ${S.year}`,A.paid],["Остаток к уплате",A.rest,"main"],["Просрочено",A.over]]);
  let h=`<thead><tr class="h"><th style="top:0">Месяц</th><th class="n" style="top:0">ПН всего</th><th class="n" style="top:0">Уплачено</th><th class="n" style="top:0">Остаток</th><th style="top:0">Срок уплаты</th><th style="top:0">Статус</th><th style="top:0"></th></tr></thead><tbody>`;
  for(const r of rows)h+=`<tr style="${r.per===S.period?"background:var(--acc2)":""}${r.future?";color:var(--mute)":""}"><td>${perLabel(r.per)}</td><td class="n">${fmt(r.t.pnAll)}</td><td class="n">${fmt(r.paid)}</td><td class="n">${fmt(r.rest)}</td><td>${fmtD(dueOf(r.per))}</td><td>${r.future?`<span class="st none">прогноз</span>`:status(r.per,r.t.pnAll,r.rest)}</td><td>${r.rest>0.005&&!r.future?`<button class="ib" data-payfor="${r.per}" title="Оплатить остаток">＋ платёж</button>`:""}</td></tr>`;
  pSched.innerHTML=h+`</tbody>`;
  const list=S.pays.filter(p=>(!o||p.org===o)&&p.per.slice(0,4)===String(S.year)).sort((a,b)=>b.date.localeCompare(a.date));
  h=`<thead><tr class="h"><th style="top:0">Дата</th><th style="top:0">Организация</th><th style="top:0">Регион</th><th style="top:0">За месяц</th><th style="top:0">№ п/п</th><th class="n" style="top:0">Сумма</th><th style="top:0">Комментарий</th><th style="top:0"></th></tr></thead><tbody>`;
  if(!list.length)h+=`<tr><td colspan="8" class="empty">Платежей за ${S.year} год нет. Нажмите «+ Добавить платёж».</td></tr>`;
  for(const p of list)h+=`<tr class="e"><td>${fmtD(p.date)}</td><td>${esc(p.org)}</td><td>${esc(p.reg||"—")}</td><td>${perLabel(p.per)}</td><td>${esc(p.no||"")}</td><td class="n" style="font-weight:600">${fmt(num(p.sum))}</td><td>${esc(p.note||"")}</td><td><button class="ib act" data-pay="${p.id}" title="Изменить">✎</button></td></tr>`;
  if(list.length)h+=`</tbody><tfoot><tr><td colspan="5">Итого · ${list.length}</td><td class="n">${fmt(list.reduce((s,p)=>s+num(p.sum),0))}</td><td colspan="2"></td></tr></tfoot>`;
  pTbl.innerHTML=h;
}
pSched.addEventListener("click",ev=>{const b=ev.target.closest("[data-payfor]");if(!b)return;const per=b.dataset.payfor,r=yearRows(scopeList(),V.org,S.year).find(x=>x.per===per);openPay(null,{per,sum:r?r.rest:""})});
pTbl.addEventListener("click",ev=>{const b=ev.target.closest("[data-pay]");if(b)openPay(b.dataset.pay)});

let payId=null;
const PF=n=>payFrm.elements[n];
function openPay(id,pre){
  payId=id||null;const p=id?S.pays.find(x=>x.id===id):{org:V.org||ORGS[0],reg:"",per:S.period,date:todayIso(),sum:"",no:"",note:"",...pre};
  PF("org").innerHTML=orgList().map(o=>`<option>${esc(o)}</option>`).join("");
  PF("reg").innerHTML=`<option value="">— вся организация —</option>`+regList().map(g=>`<option>${esc(g)}</option>`).join("");
  for(const k of["org","reg","per","date","sum","no","note"])PF(k).value=p[k]??"";
  if(pre&&!V.org)PF("org").value=ORGS[0];
  payTitle.textContent=id?"Платёж по ПН":"Новый платёж по ПН";payDel.hidden=!id;payHint.textContent="";
  payUpd();dlgPay.showModal();
}
function payUpd(){const per=PF("per").value,org=PF("org").value;if(!per)return;const t=sum(S.emps.filter(e=>e.org===org),per),paid=paidOf(org,"",per)-(payId?num((S.pays.find(x=>x.id===payId)||{}).sum):0);payHint.innerHTML=`${esc(org)} · ${perLabel(per)}: ПН всего <b>${fmt(t.pnAll)}</b>, уже уплачено ${fmt(paid)}, остаток ${fmt(r2(t.pnAll-paid))} · срок до ${fmtD(dueOf(per))}`}
payFrm.addEventListener("input",payUpd);
payDel.onclick=async()=>{if(await ask("Удалить платёж?")){S.pays=S.pays.filter(x=>x.id!==payId);save();dlgPay.close();render()}};
dlgPay.addEventListener("close",()=>{
  if(dlgPay.returnValue!=="ok")return;dlgPay.returnValue="";
  const p={id:payId||uid()};for(const k of["org","reg","per","date","no","note"])p[k]=PF(k).value.trim();p.sum=num(PF("sum").value);
  if(payId)S.pays[S.pays.findIndex(x=>x.id===payId)]=p;else S.pays.push(p);
  save();render();
});

// ---- Карточка сотрудника
let editId=null;
const F=n=>frm.elements[n];
const radio=(n,v)=>frm.querySelectorAll(`input[name=${n}]`).forEach(r=>r.checked=r.value===v);
const radioVal=n=>frm.querySelector(`input[name=${n}]:checked`).value;
function formEmp(){return{id:editId,fio:F("fio").value.trim(),inn:F("inn").value.replace(/\D/g,""),tg:F("tg").value.replace(/\D/g,""),oklad:num(F("oklad").value),org:F("org").value,reg:F("reg").value,ordDate:F("ordDate").value,fireDate:F("fireDate").value,part:radioVal("part")==="1",deps:num(F("deps").value),cat:F("cat").value,dedMode:radioVal("dedMode")}}
function formPreview(){
  const ii=innInfo(F("inn").value);innHint.textContent=ii.ok?`${ii.sex}, род. ${ii.birth}`:ii.msg||"";innHint.className="hint "+(ii.ok?"ok":ii.msg?"bad":"");
  const e=formEmp(),per=S.period;e.m={[per]:{}};for(const k of["acc","nt","days"])if(F(k).value!=="")e.m[per][k]=num(F(k).value);
  if(!editId)e.since=per;else e.since=(S.emps.find(x=>x.id===editId)||{}).since;
  if(!active(e,per)){calcHint.innerHTML=`В периоде ${perLabel(per)} трудовых отношений нет — ПН не начисляется.`;return}
  const c=calc(e,per),p=prof(e,per);
  calcHint.innerHTML=`Категория: <b>${CATS[p.cat]}</b> · ${p.ded?"вычет 650 + иждивенцы":"без вычета 650 ("+(e.part?"совместитель":p.short?"< 15 дней в месяце":"отключён")+")"}<br>Начислено ${fmt(c.o)} − необлаг. ${fmt(c.nt)} − ПФ ${fmt(c.sf)} − ГНПФ ${fmt(c.gn)} − вычет ${fmt(c.ded)} = база <b>${fmt(c.tb)}</b> → ПН <b>${fmt(c.pn)}</b>${c.pnMrd?` + ПН с МРД ${fmt(c.pnMrd)} (МРД ${fmt(c.mrd)})`:""} · на руки ${fmt(c.net)}`;
  const l=editId&&linkOf({id:editId});
  if(l)calcHint.innerHTML+=l.matched?`<br>Бот «Аванс»: <b>${esc(l.fullName)}</b> (${l.by==="telegram"?"по Telegram ID":l.by==="inn"?"по ИНН":"по ФИО"}, ID ${l.telegramId}) · аванс за период ${fmt(advTaken(l.advances))}`:`<br><span style="color:var(--warn)">В боте «Аванс» не найден — укажите Telegram ID</span>`;
}
function openForm(id){
  editId=id||null;const e=id?S.emps.find(x=>x.id===id):{org:V.org||ORGS[0],reg:V.reg||REGS[0],cat:"auto",dedMode:"",part:false,deps:0};
  F("org").innerHTML=orgList().map(o=>`<option>${esc(o)}</option>`).join("");
  F("reg").innerHTML=regList().map(g=>`<option>${esc(g)}</option>`).join("");
  for(const k of["fio","inn","tg","oklad","org","reg","ordDate","fireDate","deps"])F(k).value=e[k]??"";
  F("cat").value=e.cat||"auto";radio("part",e.part?"1":"0");radio("dedMode",e.dedMode||"");
  const r=id?mrec(e,S.period):{};for(const k of["acc","nt","days"])F(k).value=r[k]??"";
  perSect.textContent=`Начисления за ${perLabel(S.period)}`;
  dlgTitle.textContent=id?"Карточка сотрудника":"Новый сотрудник";delBtn.hidden=!id;
  formPreview();dlg.showModal();
}
frm.addEventListener("input",formPreview);
delBtn.onclick=async()=>{const e=S.emps.find(x=>x.id===editId);if(e&&await ask(`Удалить ${e.fio}? Начисления за все месяцы будут удалены.`)){S.emps=S.emps.filter(x=>x.id!==editId);save();dlg.close();render()}};
dlg.addEventListener("close",()=>{
  if(dlg.returnValue!=="ok")return;dlg.returnValue="";
  const n=formEmp(),old=editId?S.emps.find(x=>x.id===editId):null;
  const e=old?Object.assign(old,n):{...n,id:uid(),m:{},since:S.period};if(!old)S.emps.push(e);
  for(const k of["acc","nt","days"])setM(e,S.period,k,F(k).value===""?"":num(F(k).value));
  save();render();refreshBot(true);
});

// ---- Настройки ставок и СМЗ
function openRates(){
  let h="",g0="";
  for(const[k,o]of Object.entries(RATE_DEF)){if(o.g!==g0){h+=`<div class="sect">${o.g}</div>`;g0=o.g}h+=`<label>${o.l}<input type="number" step="0.01" data-r="${k}" value="${S.rates[k]}"></label>`}
  rates.innerHTML=h;
  smzTbl.innerHTML=`<thead><tr class="h"><th style="top:0">Организация</th>${regList().map(g=>`<th class="n" style="top:0">${esc(g)}</th>`).join("")}</tr></thead><tbody>${orgList().map(o=>`<tr><td>${esc(o)}</td>${regList().map(g=>`<td class="n"><input type="number" min="0" step="1" data-smz="${esc(o+"|"+g)}" value="${S.smz[o+"|"+g]??""}" placeholder="СМЗ" style="width:110px;text-align:right"></td>`).join("")}</tr>`).join("")}</tbody>`;
  dlgRates.showModal();
}
rates.addEventListener("input",ev=>{const k=ev.target.dataset.r;if(k){S.rates[k]=num(ev.target.value);save();render()}});
smzTbl.addEventListener("input",ev=>{const k=ev.target.dataset.smz;if(!k)return;if(ev.target.value==="")delete S.smz[k];else S.smz[k]=num(ev.target.value);save();render()});
function resetRates(){for(const k in RATE_DEF)S.rates[k]=RATE_DEF[k].v;save();openRates();render()}
async function deleteAll(){if(await ask("Удалить ВСЕХ сотрудников, начисления и платежи? Отменить нельзя.")&&await ask("Точно удалить все данные?")){S.emps=[];S.pays=[];S.src=null;save();dlgRates.close();render()}}

// ---- Калькулятор ПН
let CM="gross";
cMode.addEventListener("click",ev=>{const b=ev.target.closest("[data-m]");if(!b)return;CM=b.dataset.m;cMode.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));renderCalc()});
for(const el of[cAmt,cCat,cPn,cMain,cDeps,cN,cNt,cMrd])el.addEventListener("input",renderCalc);
function calcProf(){const R=S.rates,c=cCat.value,p=c==="pens"?{sf:R.p_sf,gn:R.p_gn,emp:R.p_emp}:c==="inv"?{sf:R.i_sf,gn:R.i_gn,emp:R.i_emp}:{sf:R.sf,gn:R.gnpf,emp:R.emp};p.pn=num(cPn.value);p.ded=cMain.checked;return p}
function calcRun(o){return core(o,num(cNt.value),calcProf(),cDeps.value,cMain.checked&&cCat.value!=="inv"?num(cMrd.value):0)}
function grossFromNet(net){let lo=0,hi=Math.max(1,net*2+10000);for(let i=0;i<80;i++){const m=(lo+hi)/2;if(calcRun(m).net<net)lo=m;else hi=m}return r2(hi)}
function openCalc(){renderCalc();dlgCalc.showModal();cAmt.focus()}
function renderCalc(){
  const a=num(cAmt.value),o=CM==="net"?grossFromNet(a):a,c=calcRun(o),R=S.rates,p=calcProf(),n=Math.max(1,Math.round(num(cN.value)||1));
  const base=R.cap>0?Math.min(o,R.cap):o,empc=r2(base*num(p.emp)/100),sfgn=r2(c.sf+c.gn);
  const toTax=r2(c.pnAll+sfgn+empc),cost=r2(o+empc+c.pnMrd);
  const pct=x=>String(x).replace(".",",")+"%";
  const row=(cls,l,v)=>`<tr class="${cls}"><td>${l}</td><td class="n">${fmt(v)}</td>${n>1?`<td class="n">${fmt(r2(v*n))}</td>`:""}</tr>`;
  const dedL=p.ded?`Вычет: взносы ${pct(r2(p.sf+p.gn))} + ${fmt0(num(R.ded))}${num(cDeps.value)?` + ${fmt0(num(R.dep))} × ${num(cDeps.value)} ижд.`:""}`:`Вычет: только взносы ${pct(r2(p.sf+p.gn))} (совместитель — без 650)`;
  cTbl.innerHTML=`<thead><tr><th>Строка</th><th class="n">1 человек</th>${n>1?`<th class="n">${n} человек</th>`:""}</tr></thead><tbody>`+
    row("b","Начислено",c.o)+row("m",`Пенсионный фонд ${pct(p.sf)} (работник)`,c.sf)+row("m",`ГНПФ ${pct(p.gn)} (работник)`,c.gn)+
    row("m",dedL,r2(sfgn+c.ded))+(c.nt?row("m","Необлагаемые доходы (ст. 191)",c.nt):"")+
    row("m","База подоходного",c.tb)+row("b",`Подоходный налог ${pct(p.pn)}`,c.pn)+
    row("tax sep","На руки сотруднику",c.net)+
    row("m",`Работодатель ${pct(p.emp)} (сверх оклада)`,empc)+(c.pnMrd?row("m",`ПН с МРД за счёт работодателя (МРД ${fmt(c.mrd)})`,c.pnMrd):"")+
    row("tax","В налоговую: ПН + все взносы",toTax)+row("tot","Стоимость для компании",cost)+`</tbody>`;
  cNote.textContent=`Работник ${pct(r2(p.sf+p.gn))} (Пенсионный фонд ${pct(p.sf)} + ГНПФ ${pct(p.gn)}), работодатель ${pct(p.emp)}.`+(cMain.checked?"":" Совместитель: вычет 650 и иждивенцы не применяются (НК КР ст. 200 ч. 7).");
}

// ================= Excel =================
const TPL_HEAD=["Организация","Регион","ФИО","ИНН","Оклад","Начислено за месяц","Необлагаемые доходы","Дней факт","Иждивенцы","Совместитель (Да/Нет)","Категория (авто/001/003/106/инв)","Дата приёма","Дата увольнения"];
function downloadTemplate(){
  const ws=XLSX.utils.aoa_to_sheet([TPL_HEAD]);ws["!cols"]=[16,14,32,17,11,14,14,10,10,12,16,13,13].map(w=>({wch:w}));
  const help=XLSX.utils.aoa_to_sheet([["Как заполнять"],["Одна строка — один сотрудник. Организацию и регион можно указать один раз над группой строк (пустые ячейки берутся сверху)."],["«Начислено за месяц», «Необлагаемые доходы», «Дней факт» относятся к периоду, выбранному в дашборде при загрузке. Пусто — начислено = оклад, дни — по календарю без пятниц."],["Сотрудник ищется по организации + ИНН (если ИНН нет — по ФИО): найден — обновляется, нет — добавляется."],["Категория: авто (по возрасту из ИНН), 001 работник, 003 пенсионер, 106 МОП, инв — инвалид I–II гр."],["Даты — ДД.ММ.ГГГГ."]]);
  help["!cols"]=[{wch:120}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Сотрудники");XLSX.utils.book_append_sheet(wb,help,"Инструкция");
  saveXlsx(wb,"Шаблон_ПН.xlsx");
}
const CAT_IN={"":"auto","авто":"auto","auto":"auto","001":"std","1":"std","003":"pens","3":"pens","пенсионер":"pens","106":"mop","моп":"mop","инв":"inv","инвалид":"inv"};
const txt=v=>{if(v==null)return"";if(typeof v==="number"&&Math.abs(v)>=1e9)return v.toFixed(0);return String(v).trim()};
fileAdd.onchange=async()=>{
  const f=fileAdd.files[0];if(!f)return;fileAdd.value="";
  if(typeof XLSX==="undefined")return note("Библиотека Excel не загрузилась. Обновите страницу.");
  try{
    const wb=XLSX.read(await f.arrayBuffer()),rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:""});
    const H=rows[0].map(x=>String(x).toLowerCase()),col=(...keys)=>H.findIndex(h=>keys.some(k=>h.includes(k)));
    const C={org:col("организац"),reg:col("регион"),fio:col("фио"),inn:col("инн"),oklad:col("оклад"),acc:col("начислено"),nt:col("необлаг"),days:col("дней"),deps:col("иждив"),part:col("совмест"),cat:col("категор"),ord:col("приём","прием"),fire:col("увольн")};
    if(C.fio<0)return note("В первой строке нет колонки «ФИО». Используйте «⬇ Шаблон Excel».");
    const per=S.period,get=(r,k)=>C[k]<0?"":r[C[k]];let org="",reg="",add=0,upd=0,skip=0;
    for(const r of rows.slice(1)){
      if(txt(get(r,"org")))org=txt(get(r,"org"));if(txt(get(r,"reg")))reg=txt(get(r,"reg"));
      const fio=txt(get(r,"fio"));if(!fio||/^итог/i.test(fio)){continue}
      if(!org||!reg){skip++;continue}
      const inn=txt(get(r,"inn")).replace(/\D/g,"");
      let e=S.emps.find(x=>x.org===org&&(inn?x.inn===inn:!x.inn&&x.fio.toLowerCase()===fio.toLowerCase()));
      if(e)upd++;else{e={id:uid(),m:{},cat:"auto",dedMode:"",deps:0,part:false,since:per};S.emps.push(e);add++}
      Object.assign(e,{org,reg,fio,inn});
      if(txt(get(r,"oklad"))!=="")e.oklad=num(get(r,"oklad"));else if(e.oklad==null)e.oklad=num(get(r,"acc"));
      if(txt(get(r,"deps"))!=="")e.deps=num(get(r,"deps"));
      if(txt(get(r,"part"))!=="")e.part=/^(да|1|yes|true)/i.test(txt(get(r,"part")));
      const ct=txt(get(r,"cat")).toLowerCase();if(ct&&CAT_IN[ct])e.cat=CAT_IN[ct];
      if(txt(get(r,"ord")))e.ordDate=xlDate(get(r,"ord"));if(txt(get(r,"fire")))e.fireDate=xlDate(get(r,"fire"));
      for(const k of["acc","nt","days"])if(txt(get(r,k))!=="")setM(e,per,k,num(get(r,k)));
    }
    S.src={name:f.name,at:Date.now()};save();render();
    refreshBot(true);
    note(`Загружено из «${f.name}» за ${perLabel(per)}:\nдобавлено ${add}, обновлено ${upd}${skip?`\nпропущено без организации/региона: ${skip}`:""}`);
  }catch(err){note("Не удалось прочитать файл: "+err.message)}
};
function exportXlsx(){
  if(typeof XLSX==="undefined")return note("Библиотека Excel не загрузилась. Обновите страницу.");
  const per=S.period,head=["Организация","Регион","ФИО","ИНН","Категория","Совместитель","Иждивенцы","Начислено","Необлагаемые","Взнос ПФ","ГНПФ","Стандартный вычет","Облагаемая база","ПН удержан","МРД","ПН с МРД","ПН всего","На руки"];
  const rows=[head];
  for(const o of orgList())for(const g of regList())for(const e of S.emps.filter(x=>x.org===o&&x.reg===g&&active(x,per))){const c=calc(e,per);rows.push([o,g,e.fio,e.inn,CATS[catOf(e,per)],e.part?"Да":"Нет",num(e.deps),c.o,c.nt,c.sf,c.gn,c.ded,c.tb,c.pn,c.mrd,c.pnMrd,c.pnAll,c.net])}
  const t=sum(S.emps,per);rows.push(["","","ИТОГО","","","","",t.o,t.nt,t.sf,t.gn,t.ded,t.tb,t.pn,"",t.pnMrd,t.pnAll,t.net]);
  const ws=XLSX.utils.aoa_to_sheet(rows);for(const r of rows.keys()){const a=XLSX.utils.encode_cell({r,c:3});if(ws[a])ws[a].t="s"}
  ws["!cols"]=[16,14,30,17,10,8,8,12,11,10,10,11,13,12,10,10,12,12].map(w=>({wch:w}));
  const yr=[["Организация","Месяц","Чел.","Начислено","Облагаемая база","ПН удержан","ПН с МРД","ПН всего","Уплачено","Остаток","Срок уплаты"]];
  for(const o of orgList())for(const r of yearRows(S.emps.filter(e=>e.org===o),o,S.year))if((r.t.cnt||r.paid)&&!r.future)yr.push([o,perLabel(r.per),r.t.cnt,r.t.o,r.t.tb,r.t.pn,r.t.pnMrd,r.t.pnAll,r.paid,r.rest,fmtD(dueOf(r.per))]);
  const ws2=XLSX.utils.aoa_to_sheet(yr);ws2["!cols"]=[16,16,6,13,13,12,11,12,12,12,12].map(w=>({wch:w}));
  const ws3=XLSX.utils.aoa_to_sheet([["Дата","Организация","Регион","За месяц","№ п/п","Сумма","Комментарий"],...S.pays.map(p=>[fmtD(p.date),p.org,p.reg,perLabel(p.per),p.no,num(p.sum),p.note])]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Ведомость ПН");XLSX.utils.book_append_sheet(wb,ws2,`По месяцам ${S.year}`);XLSX.utils.book_append_sheet(wb,ws3,"Платежи");
  saveXlsx(wb,`ПН_${per}.xlsx`);
}

const saveXlsx=(wb,name)=>XLSX.writeFile(wb,name);

// ================= Авансы из бота за период: кто, сколько, какая организация =================
const ADV_ST={pending:"Ждёт решения",approved:"Одобрен, к выдаче",paid:"Выдан",rejected:"Отклонён",canceled:"Отменён"};
const ADV_CLS={pending:"pending",approved:"approved",paid:"auto",rejected:"rejected",canceled:"rejected"};
function renderAdv(){
  advTitle.textContent=`Авансы из бота «Аванс» · ${perLabel(S.period)}`;
  if(BOT.per!==S.period){advTbl.innerHTML=`<tbody><tr><td class="empty">${BOT.err?esc(BOT.err):"Загружаю авансы из бота…"}</td></tr></tbody>`;advNote.textContent="";return}
  // организация — из дашборда (по связи сотрудника), иначе место работы в боте
  const orgOf={};for(const e of S.emps){const l=linkOf(e);if(l&&l.matched)orgOf[l.employeeId]=orgOf[l.employeeId]||{org:e.org,reg:e.reg}}
  const list=BOT.requests.map(r=>({...r,o:orgOf[r.employeeId]})).filter(r=>!V.org||(r.o&&r.o.org===V.org));
  const tot=k=>list.filter(r=>r.status===k).reduce((s,r)=>s+r.amountSom,0);
  advNote.textContent=`Выдано ${fmt0(tot("paid"))} · к выдаче ${fmt0(tot("approved"))} · ждут решения ${fmt0(tot("pending"))} сом`;
  let h=`<thead><tr class="h"><th style="top:0">Сотрудник</th><th style="top:0">Организация</th><th style="top:0">Регион</th><th class="n" style="top:0">Сумма</th><th style="top:0">Статус</th><th style="top:0">Заявка</th><th style="top:0">Выдан</th></tr></thead><tbody>`;
  if(!list.length)h+=`<tr><td colspan="7" class="empty">За ${perLabel(S.period)} заявок на аванс нет</td></tr>`;
  const dt=v=>v?new Date(v).toLocaleDateString("ru-RU"):"—";
  for(const r of list)h+=`<tr><td>${esc(r.employeeName)}</td><td>${r.o?esc(r.o.org):`<span class="fresh" title="Сотрудник не связан с дашбордом — место работы из бота">${esc(r.workplace)} (бот)</span>`}</td><td>${r.o?esc(r.o.reg):"—"}</td><td class="n" style="font-weight:600">${fmt(r.amountSom)}</td><td><span class="st ${ADV_CLS[r.status]||""}">${ADV_ST[r.status]||esc(r.status)}</span></td><td>${dt(r.createdAt)}</td><td>${dt(r.paidAt)}</td></tr>`;
  advTbl.innerHTML=h+"</tbody>";
}

// ================= Подключение к боту: адрес и ключ =================
function openConn(msg){
  connUrl.value=(CONN&&CONN.url)||DEF_BOT_URL;connKey.value="";connMsg.innerHTML=msg||"";
  connOff.hidden=!(CONN&&CONN.key);dlgConn.showModal();
}
connFrm.addEventListener("submit",async ev=>{
  ev.preventDefault();
  const url=connUrl.value.trim(),key=connKey.value.trim()||(CONN&&CONN.key)||"";
  if(!/^https?:\/\//.test(url)||key.length<32){connMsg.innerHTML=`<div class="bwarn">Укажите адрес бота (https://…) и ключ из команды /pn_key</div>`;return}
  const old=CONN;CONN={url,key};connMsg.innerHTML=`<div class="fresh">Подключаюсь… бесплатный сервер может просыпаться до минуты</div>`;
  try{ME=await api("me")}catch(e){CONN=old;connMsg.innerHTML=`<div class="bwarn">${esc(e.message)}</div>`;return}
  try{localStorage.setItem(CONN_KEY,JSON.stringify(CONN))}catch(e){}
  dlgConn.close();SRV.stop=false;SRV.err="";await start();
});
connOff.onclick=async()=>{if(await ask("Отключить этот браузер от бота? Ключ будет удалён с этого компьютера, данные на сервере останутся.")){try{localStorage.removeItem(CONN_KEY)}catch(e){}location.reload()}};

// ================= Начисления → бот: «на руки» за период становится заработком в боте (лимит аванса) =================
let BS=null;
function openBotSend(){
  const per=S.period,rows=[],miss=[],zero=[],byId=new Map();
  for(const e of S.emps){
    if(!active(e,per))continue;
    const l=linkOf(e),c=calc(e,per);
    if(!l||!l.matched){miss.push(e);continue}
    const amt=Math.floor(c.net);if(amt<=0){zero.push(e);continue}
    const ex=byId.get(l.employeeId);
    if(ex){ex.amountSom+=amt;ex.names.push(e.fio);continue}   // совместительство в двух организациях — одна сумма в боте
    const r={employeeId:l.employeeId,fullName:l.fullName,amountSom:amt,names:[e.fio],org:e.org};byId.set(l.employeeId,r);rows.push(r);
  }
  BS={per,rows,import:null};
  const tot=rows.reduce((s,r)=>s+r.amountSom,0),pct=ME?ME.advancePercent:70;
  botTitle.textContent=`📤 Начисления → бот «Аванс» · ${perLabel(per)}`;
  botBody.innerHTML=`<div class="fresh">Сумма «на руки» (начислено − ПФ − ГНПФ − ПН, без копеек) станет заработком сотрудника в боте за ${perLabel(per)}. Лимит аванса в боте — ${pct}% от неё. Зарплату за месяц в бот можно загрузить <b>один раз</b>.</div>`+
    (BOT.per!==per?`<div class="bwarn">Связь с ботом ещё загружается — закройте окно и откройте снова.</div>`:"")+
    (miss.length?`<div class="bwarn">Не найдены в боте (${miss.length}): ${miss.slice(0,15).map(e=>esc(e.fio)).join(", ")}${miss.length>15?"…":""}. Укажите их Telegram ID в карточке.</div>`:"")+
    (zero.length?`<div class="bwarn">Пропущены с нулевой суммой: ${zero.length}</div>`:"")+
    `<div class="blist"><table><thead><tr><th style="top:0">Сотрудник в боте</th><th style="top:0">В дашборде</th><th class="n" style="top:0">Сумма, сом</th><th class="n" style="top:0">Лимит аванса</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.fullName)}</td><td>${esc(r.names.join(", "))}<div class="fresh">${esc(r.org)}</div></td><td class="n">${fmt0(r.amountSom)}</td><td class="n">${fmt0(Math.floor(r.amountSom*pct/100))}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">Нет связанных сотрудников с суммой</td></tr>`}</tbody><tfoot><tr><td colspan="2">Итого · ${rows.length} чел.</td><td class="n">${fmt0(tot)}</td><td></td></tr></tfoot></table></div><div id="botRes"></div>`;
  botGo.textContent="Проверить в боте";botGo.disabled=!rows.length||BOT.per!==per;botGo.hidden=false;botCancel.textContent="Закрыть";
  dlgBot.showModal();
}
botGo.onclick=async()=>{
  if(!BS)return;botGo.disabled=true;
  try{
    if(!BS.import){
      const r=await api("payroll/preview",{period:BS.per,rows:BS.rows.map(({employeeId,amountSom})=>({employeeId,amountSom}))});
      BS.import=r.import;
      botRes.innerHTML=`<div class="bok">Бот проверил: ${r.import.rowCount} чел. на ${fmt0(r.import.totalSom)} сом. Нажмите «Начислить в боте» — сотрудники получат уведомление.</div>`;
      botGo.textContent="Начислить в боте";botCancel.textContent="Отмена";
    }else{
      const r=await api(`payroll/${BS.import.id}/commit`,{});
      BS.import=null;
      botRes.innerHTML=`<div class="bok">✓ Начислено в боте: ${r.import.rowCount} чел., ${fmt0(r.import.totalSom)} сом за ${perLabel(r.import.period)}.</div>`;
      botGo.hidden=true;botCancel.textContent="Готово";
    }
  }catch(e){botRes.innerHTML=`<div class="bwarn">${esc(e.message)}</div>`}
  botGo.disabled=false;
};
// незавершённую проверку отменяем, чтобы она не блокировала повторную отправку
dlgBot.addEventListener("close",()=>{if(BS&&BS.import){api(`payroll/${BS.import.id}/cancel`,{}).catch(()=>{});BS.import=null}});

// ---- Кнопки с data-act (встроенные onclick запрещены политикой безопасности страницы)
const ACTS={template:downloadTemplate,pickFile:()=>fileAdd.click(),exportXlsx,calc:openCalc,pay:()=>openPay(),emp:()=>openForm(),
  yearPrev:()=>shiftYear(-1),yearNext:()=>shiftYear(1),back:()=>go(V.org,""),closeCalc:()=>dlgCalc.close(),deleteAll,resetRates,
  botSend:openBotSend,botRefresh:()=>refreshBot(true),conn:()=>openConn(),connClose:()=>dlgConn.close()};
document.addEventListener("click",ev=>{const b=ev.target.closest("[data-act]");if(b&&ACTS[b.dataset.act]){ev.preventDefault();ACTS[b.dataset.act]()}});

period.onchange=()=>{if(period.value)setPeriod(period.value)};
async function start(){
  gate.hidden=false;gateMsg.textContent="Загружаю данные из бота «Аванс»… бесплатный сервер может просыпаться до минуты";
  try{if(!ME)ME=await api("me");await loadState();gate.hidden=true}
  catch(e){gateMsg.innerHTML=`<b>${esc(e.message)}</b>`;if(e.status===401)openConn(`<div class="bwarn">${esc(e.message)}</div>`)}
}
if(CONN&&CONN.key)start();else{gateMsg.textContent="Сайт не подключён к боту «Аванс».";openConn()}

