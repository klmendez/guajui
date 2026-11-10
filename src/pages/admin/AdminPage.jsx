import AccessPanel from './AccountAccessPanel';
import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {LayoutDashboard,House,ClipboardCheck,FileClock,ChartNoAxesCombined,Bell,BadgeCheck,Newspaper,NotebookPen,CalendarDays,BriefcaseBusiness,GraduationCap,Landmark,Mail,FolderOpen,PanelsTopLeft,UsersRound,History,UserCog,LogOut,Menu,X,Eye,EyeOff,PanelLeftClose,PanelLeftOpen,Globe} from 'lucide-react';
import {supabase} from '../../data/supabaseClient';
import {usePlatformSession,logout,refreshSession,loginWithPassword,platformAccountRequest,requestPasswordRecovery,saveRecoveredPassword,cancelPasswordRecovery} from '../../data/platformSession';
import {rows,rpc,insert,update,unwrap,roles,communityNames,communityOptions} from '../../data/platformStore';
import {loadCensusRecords,loadCensusRequests,decideCensusRequest,deleteCensusRecord,fullName} from '../../data/censusStore';
import {loadSurveys,saveSurvey,loadServiceResponses,censusSurvey,makeId} from '../../data/surveyStore';
import {loadContent,saveContent} from '../../data/contentStore';
import {ParticipationNotesAdmin,MeetingAttendanceAdmin,SurveyBuilder,SurveyReport} from './ServicePanels';
import TeacherFollowupAdmin from './TeacherFollowupAdmin';
import ResumeBankAdmin from './ResumeBankAdmin';
import BoardPerformanceAdmin from './BoardPerformanceAdmin';
import CensoStaffPage from '../censo/CensoStaffPage';
import CertificateView from '../certificado/CertificateView';
import '../../styles/platform-admin.css';

const baseTabs=['Resumen','Censo','Encuestas'];
const adminTabs=[...baseTabs,'Estadísticas','Novedades','Certificados','Publicaciones','Apuntes','Reuniones','Hojas de vida','Seguimiento maestros','Seguimiento junta','Contacto','Archivos','Páginas','Grupos','Historial','Accesos'];
const scopedTabs=[...baseTabs,'Estadísticas','Novedades','Publicaciones'];
const adminNavigation=[
  {title:'PRINCIPAL',items:[['Resumen',LayoutDashboard],['Censo',House],['Encuestas',ClipboardCheck],['Estadísticas',ChartNoAxesCombined]]},
  {title:'COMUNIDAD',items:[['Novedades',Bell],['Publicaciones',Newspaper],['Apuntes',NotebookPen],['Reuniones',CalendarDays],['Contacto',Mail]]},
  {title:'EDUCACIÓN',items:[['Hojas de vida',BriefcaseBusiness],['Seguimiento maestros',GraduationCap],['Seguimiento junta',Landmark],['Certificados',BadgeCheck]]},
  {title:'CONTENIDO',items:[['Páginas',PanelsTopLeft],['Grupos',UsersRound],['Archivos',FolderOpen]]},
  {title:'SISTEMA',items:[['Historial',History],['Accesos',UserCog]]},
];
const roleTabs={superadmin:adminTabs,enumerator:baseTabs,community_leader:scopedTabs};
const sectionHelp={
  'Resumen':{superadmin:'Revisa el alcance del censo y accesos rápidos a las tareas de administración.',enumerator:'Consulta cuántas personas y familias hay en tu comunidad y entra a las tareas de campo.',community_leader:'Consulta el tamaño del censo de tu comunidad y sus familias registradas.'},
  'Censo':{superadmin:'Busca registros, filtra por comunidad, revisa la ficha y archiva registros cuando corresponda.',enumerator:'Busca una persona para actualizar sus datos o inicia un registro nuevo de vivienda y sus familias. Los cambios se guardan directamente.',community_leader:'Consulta los registros censales de tu comunidad. No puedes agregar ni editar personas.'},
  'Encuestas':{superadmin:'Crea, edita, publica o cierra encuestas y revisa sus resultados.',enumerator:'Diligencia las encuestas disponibles para tu comunidad y revisa los resultados permitidos por tu perfil.',community_leader:'Consulta encuestas y resultados disponibles para tu comunidad.'},
  'Solicitudes':{superadmin:'Consulta solicitudes antiguas del censo; el flujo actual del encuestador guarda directamente los registros.',enumerator:'Las altas y actualizaciones nuevas se guardan directamente desde Censo.',community_leader:'Consulta solicitudes antiguas relacionadas con el censo.'},
  'Estadísticas':{superadmin:'Explora cifras y resúmenes del censo de todas las comunidades.',enumerator:'Consulta estadísticas correspondientes a tu comunidad.',community_leader:'Consulta estadísticas del censo de tu comunidad.'},
  'Novedades':{superadmin:'Revisa y verifica o rechaza novedades reportadas sobre las familias.',community_leader:'Reporta una novedad de tu comunidad y consulta su estado.'},
  'Publicaciones':{superadmin:'Administra y publica contenidos del Consejo.',community_leader:'Propón publicaciones de tu comunidad para revisión del superadministrador.'},
  'Certificados':'Expide certificados para personas censadas, consulta los expedidos y revoca los que ya no estén vigentes.',
  'Apuntes':'Consulta los apuntes de participación que envían las personas y organiza su seguimiento.',
  'Reuniones':'Crea reuniones con nombre, fecha, objetivo y lugar; consulta los aportes de asistencia recibidos.',
  'Hojas de vida':'Consulta y organiza las hojas de vida enviadas al Consejo.',
  'Seguimiento maestros':'Administra los seguimientos docentes y consulta su asistencia, desempeño e historial.',
  'Seguimiento junta':'Consulta y organiza las evaluaciones de las personas de la junta del Consejo.',
  'Contacto':'Lee y gestiona las consultas recibidas por los canales de contacto.',
  'Archivos':'Administra los archivos y documentos compartidos en el sitio.',
  'Páginas':'Edita el contenido de las páginas informativas del sitio.',
  'Grupos':'Administra la información y publicación de los grupos comunitarios.',
  'Historial':'Revisa el registro de acciones realizadas en la plataforma.',
  'Accesos':'Asigna o desactiva cuentas y define el rol y comunidad de cada persona autorizada.',
};
const date=value=>value?new Date(value).toLocaleString('es-CO'):'—';
const actionError=e=>e?.message || 'No se pudo completar la operación.';
export function useData(loader,deps=[]){
  const [data,setData]=useState([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [version,setVersion]=useState(0);
  useEffect(()=>{let active=true;setLoading(true);setError('');
    loader().then(items=>{if(active)setData(items);}).catch(e=>{if(active)setError(actionError(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[...deps,version]);
  return {data,error,loading,reload:()=>setVersion(n=>n+1)};
}
function Status({state}){return state.error?<p role="alert" className="inline-message error">{state.error}</p>:state.loading?<p role="status">Cargando…</p>:null;}
function Details({value}){return <dl className="platform-details">{Object.entries(value || {}).map(([key,item])=><div key={key}><dt>{censusSurvey.questions.find(q=>q.id===key)?.label || key}</dt><dd>{Array.isArray(item)?item.join(', '):typeof item==='object'?JSON.stringify(item):String(item ?? '')}</dd></div>)}</dl>;}
function CommunitySelect({name='community',value,defaultValue,onChange,required=true,all=false}){return <select name={name} value={value} defaultValue={defaultValue} onChange={onChange} required={required}><option value="">{all?'Todas las comunidades':'Selecciona comunidad'}</option>{communityOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>;}
export default function AdminPage(){
  const session=usePlatformSession();
  const [tab,setTab]=useState('Resumen');
  const [menu,setMenu]=useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  if(session.recovery) return <PasswordRecovery session={session}/>;
  if(!session.user) return <PlatformLogin session={session}/>;
  const user=session.user;
  const tabs=roleTabs[user.role]||baseTabs;
  const sections=adminNavigation.map(section=>({...section,items:section.items.filter(([name])=>tabs.includes(name))})).filter(section=>section.items.length);
  const active=tabs.includes(tab)?tab:'Resumen';
  return <section className={'admin-page platform-admin '+(menu?'mobile-menu-open ':'')+(sidebarCollapsed?'sidebar-collapsed':'')} key={user.id+user.role+user.community_id}>
    <aside className="platform-sidebar"><div className="admin-profile"><img src="/assets/isotipo-guajui.png" alt="Consejo"/><span><b>Panel del Consejo</b><small>{roles[user.role].label}</small></span></div><button className="sidebar-collapse-toggle" onClick={()=>setSidebarCollapsed(value=>!value)} aria-label={sidebarCollapsed?'Expandir menú':'Contraer menú'} title={sidebarCollapsed?'Expandir menú':'Contraer menú'}>{sidebarCollapsed?<PanelLeftOpen aria-hidden="true"/>:<PanelLeftClose aria-hidden="true"/>}</button><button className="mobile-menu-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Cerrar menú':'Abrir menú'}>{menu?<X/>:<Menu/>}</button><div className="admin-role"><b>{user.username}</b><span>{user.community || 'Todas las comunidades'}</span></div><nav className="admin-nav" id="platform-navigation" aria-label="Menú principal">{sections.map(section=><div className="admin-nav-group" key={section.title}><h2 className="admin-nav-heading">{section.title}</h2>{section.items.map(([name,Icon])=><button key={name} title={name} aria-label={sidebarCollapsed?name:undefined} aria-current={active===name?'page':undefined} className={active===name?'active':''} onClick={()=>{setTab(name);setMenu(false);}}><Icon aria-hidden="true"/><span>{name}</span></button>)}</div>)}<Link className="button outline sidebar-public-link" to="/" title="Página pública"><Globe aria-hidden="true"/><span>Página pública</span></Link></nav></aside>
    <div className="admin-workspace"><header className="admin-topbar"><div><small>{roles[user.role].label}</small><b>{active}</b></div><button className="button outline" onClick={()=>logout().catch(e=>window.alert(e.message))}><LogOut/> Salir</button></header>
      <div className={'admin-content'+(active==='Censo'?' census-content':'')} key={active+user.id+user.role+user.community_id}>
        {active==='Resumen'&&<Overview user={user} onNavigate={name=>{if(tabs.includes(name)){setTab(name);setMenu(false);window.scrollTo({top:0,behavior:'instant'});}}}/>}
        {active==='Censo'&&<CensusPanel user={user}/>}
        {active==='Encuestas'&&<SurveysPanel user={user}/>}
        {active==='Solicitudes'&&<RequestsPanel user={user}/>}
        {active==='Estadísticas'&&<StatisticsPanel/>}
        {active==='Novedades'&&<NoveltiesPanel user={user}/>}
        {active==='Certificados'&&<CertificatesPanel/>}
        {active==='Publicaciones'&&<PublicationsPanel user={user}/>}
        {active==='Apuntes'&&<ParticipationNotesAdmin/>}
        {active==='Reuniones'&&<MeetingAttendanceAdmin/>}
        {active==='Hojas de vida'&&<ResumeBankAdmin/>}
        {active==='Seguimiento maestros'&&<TeacherFollowupAdmin/>}
        {active==='Seguimiento junta'&&<BoardPerformanceAdmin/>}
        {active==='Contacto'&&<ContactsPanel/>}
        {active==='Archivos'&&<FilesPanel/>}
        {active==='Páginas'&&<PagesPanel/>}
        {active==='Grupos'&&<GroupsPanel/>}
        {active==='Historial'&&<HistoryPanel/>}
        {active==='Accesos'&&<AccessPanel user={user}/>}
      </div>
    </div>
  </section>;
}
function PlatformLogin({session}){
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [recovering,setRecovering]=useState(false);
  const [sent,setSent]=useState(false);
  const [username,setUsername]=useState('');
  const recover=async event=>{
    event.preventDefault();if(busy)return;
    const identifier=new FormData(event.currentTarget).get('identifier');setBusy(true);setMessage('');
    try{const result=await requestPasswordRecovery(identifier);setMessage(result.message);setSent(true);}
    catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  const submit=async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);
    try{
      await loginWithPassword(form.get('username'),form.get('password'));
      setMessage('');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  return <section className="section platform-login"><form className="form-card" onSubmit={recovering?recover:submit}>
    <img src="/assets/isotipo-guajui.png" width="64" alt="Consejo"/>
    <h1>{recovering?'Recuperar contraseña':'Acceso a la plataforma'}</h1>
    {recovering?<>
      <p>Te enviaremos un enlace al correo asociado a tu cuenta para elegir una contraseña nueva.</p>
      {!sent&&<><label>Usuario o correo<input name="identifier" defaultValue={username} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required/></label>
        <button className="button primary" disabled={busy}>{busy?'Enviando…':'Enviar enlace de recuperación'}</button></>}
      <p className="platform-auth-help">Si tu cuenta no tiene correo asociado, el superadministrador puede cambiar tu contraseña desde Accesos.</p>
      {message&&<p role={sent?'status':'alert'}>{message}</p>}
      <button type="button" className="platform-auth-link" disabled={busy} onClick={()=>{setRecovering(false);setSent(false);setMessage('');}}>Volver a iniciar sesión</button>
    </>:<>
      <label>Usuario<input name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)} required/></label>
      <label>Contraseña<div className="platform-password"><input name="password" type={showPassword?'text':'password'} autoComplete="current-password" required/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
      <button className="button primary" disabled={busy || session.loading}>{busy?'Entrando…':'Entrar'}</button>
      <button type="button" className="platform-auth-link" disabled={busy} onClick={()=>{setRecovering(true);setMessage('');}}>Olvidé mi contraseña</button>
      {session.error&&<p role="alert">{session.error}</p>}{message&&<p role="alert">{message}</p>}
      {session.notice&&<p role="status">{session.notice}</p>}
    </>}
    <Link to="/">Volver a la página pública</Link>
  </form></section>;
}
function PasswordRecovery({session}){
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const submit=async event=>{
    event.preventDefault();if(busy)return;
    const data=new FormData(event.currentTarget);setBusy(true);setMessage('');
    try{await saveRecoveredPassword(data.get('password'),data.get('confirmation'));}
    catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  return <section className="section platform-login"><form className="form-card" onSubmit={submit}>
    <img src="/assets/isotipo-guajui.png" width="64" alt="Consejo"/><h1>Crear nueva contraseña</h1>
    {session.loading?<p role="status">Verificando el enlace…</p>:session.user?<>
      <p>Elige una contraseña nueva para <b>{session.user.username}</b>. Debe tener entre 10 y 128 caracteres.</p>
      <label>Nueva contraseña<div className="platform-password"><input name="password" type={showPassword?'text':'password'} autoComplete="new-password" minLength={10} maxLength={128} required/>
        <button type="button" aria-label={showPassword?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
      <label>Repite la nueva contraseña<input name="confirmation" type={showPassword?'text':'password'} autoComplete="new-password" minLength={10} maxLength={128} required/></label>
      <button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar nueva contraseña'}</button>
    </>:<p role="alert">El enlace no es válido o ha vencido. Vuelve al inicio de sesión y solicita uno nuevo desde «Olvidé mi contraseña».</p>}
    {message&&<p role="alert">{message}</p>}
    <button className="platform-auth-link" type="button" disabled={busy} onClick={()=>cancelPasswordRecovery().catch(e=>setMessage(e.message))}>Volver a iniciar sesión</button>
  </form></section>;
}
function Overview({user,onNavigate}){
  const state=useData(loadCensusRecords);
  const sections=adminNavigation.map(section=>({...section,items:section.items.filter(([name])=>name!=='Resumen'&&(roleTabs[user.role]||baseTabs).includes(name))})).filter(section=>section.items.length);
  return <><h2>Bienvenido, {user.username}</h2><p>{roles[user.role].label} / {user.community || 'Todas las comunidades'}</p><Status state={state}/><div className="metrics"><article><span>Personas censadas</span><b>{state.data.length}</b></article><article><span>Familias</span><b>{new Set(state.data.map(r=>r.family_id).filter(Boolean)).size}</b></article></div>
    <section className="overview-shortcuts" aria-label="Accesos a tus apartados">
      {sections.map(section=><section className="overview-shortcut-group" key={section.title}><h3>{section.title}</h3><div className="overview-shortcut-grid">
        {section.items.map(([name,Icon])=><button type="button" className="overview-shortcut-button" key={name} onClick={()=>onNavigate(name)} aria-label={'Abrir '+name}><Icon aria-hidden="true"/><span><b>{name}</b><small>{typeof sectionHelp[name]==='string'?sectionHelp[name]:sectionHelp[name]?.[user.role]}</small></span><span className="overview-shortcut-arrow" aria-hidden="true">→</span></button>)}
      </div></section>)}
    </section></>;

}
function CensusPanel({user}){
  const state=useData(loadCensusRecords);
  const [search,setSearch]=useState('');
  const [entry,setEntry]=useState('');
  const [selected,setSelected]=useState(null);
  const [community,setCommunity]=useState('');
  const [error,setError]=useState('');
  const visible=state.data.filter(r=>(!community || r.community_id===community) && [fullName(r),r.answers.documentNumber,r.answers.householdCode].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <>{!entry&&<div className="admin-toolbar"><div><h2>Censo de {user.community || 'todas las comunidades'}</h2><p>Viviendas, familias y personas aprobadas.</p></div>{user.role==='enumerator'&&!entry&&<div className="census-entry-actions"><button className="button outline" onClick={()=>setEntry('update')}>Actualizar persona</button><button className="button primary" onClick={()=>setEntry('new')}>Registro nuevo</button></div>}</div>}<Status state={state}/>{error&&<p role="alert">{error}</p>}{entry&&user.role==='enumerator'?<CensoStaffPage key={entry} initialTask={entry} onClose={()=>{setEntry('');state.reload();}}/>:<><div className="platform-filters"><label>Buscar persona, documento o vivienda<input value={search} onChange={e=>setSearch(e.target.value)}/></label>{user.role==='superadmin'&&<label>Comunidad<CommunitySelect value={community} onChange={e=>setCommunity(e.target.value)} required={false} all/></label>}<button className="button outline" onClick={state.reload}>Recargar lista</button></div><div className="admin-table"><table><thead><tr><th>Persona</th><th>Documento</th><th>Comunidad</th><th>Vivienda / familia</th><th>Acciones</th></tr></thead><tbody>{visible.map(r=><tr key={r.id}><td>{fullName(r)}</td><td>{r.answers.documentNumber}</td><td>{communityNames[r.community_id]}</td><td>{r.answers.householdCode} / {r.answers.familyCode}</td><td><button className="button outline" onClick={()=>setSelected(selected?.id===r.id?null:r)}>Ver datos</button>{user.role==='superadmin'&&<button className="button outline" onClick={async()=>{if(!window.confirm('¿Archivar a esta persona del censo activo?'))return;try{await deleteCensusRecord(r.id);state.reload();}catch(e){setError(e.message);}}}>Archivar</button>}</td></tr>)}</tbody></table></div>{!visible.length&&!state.loading&&<p>No hay registros con estos filtros.</p>}{selected&&<Details value={selected.answers}/>}</>}</>;
}
function RequestsPanel({user}){
  const state=useData(loadCensusRequests);
  const [error,setError]=useState('');
  const decide=async(id,decision)=>{try{await decideCensusRequest(id,decision);state.reload();}catch(e){setError(e.message);}};
  return <><h2>Solicitudes de actualización censal</h2><p>{user.role==='superadmin'?'Revisa cada solicitud antes de aprobar.':'Consulta el estado de las solicitudes de tu ámbito.'}</p><Status state={state}/>{error&&<p role="alert">{error}</p>}<button className="button outline" onClick={state.reload}>Actualizar</button><div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{item.id} · {item.status}</b><p>{communityNames[item.community_id]} · {date(item.created_at)}</p><details><summary>Ver datos solicitados</summary><Details value={item.changes}/></details></div>{item.status==='Pendiente'&&user.role==='superadmin'&&<div><button className="button primary" onClick={()=>decide(item.id,'Aprobada')}>Aprobar</button><button className="button outline" onClick={()=>decide(item.id,'Rechazada')}>Rechazar</button></div>}</article>)}</div>{!state.data.length&&!state.loading&&<p>No hay solicitudes.</p>}</>;
}
function StatisticsPanel(){
  const state=useData(loadCensusRecords);
  return <><Status state={state}/><SurveyReport survey={censusSurvey} responseData={state.data} onBack={()=>window.history.back()}/></>;
}
function SurveysPanel({user}){
  const state=useData(loadSurveys);
  const [editing,setEditing]=useState(null);
  const [report,setReport]=useState(null);
  const [responses,setResponses]=useState([]);
  const [error,setError]=useState('');
  const save=async item=>{try{await saveSurvey(item);setEditing(null);state.reload();setError('');}catch(e){setError(e.message);}};
  if(report)return <SurveyReport survey={report} responseData={responses} onBack={()=>setReport(null)}/>;
  return <><h2>Encuestas comunitarias</h2><p>{user.role==='superadmin'?'Crea, publica y consulta resultados.':'Diligencia encuestas de tu comunidad. Los resultados disponibles respetan tu perfil.'}</p>{error&&<p role="alert">{error}</p>}<Status state={state}/>{user.role==='superadmin'&&<button className="button primary" onClick={()=>setEditing({})}>Nueva encuesta</button>}{editing?<SurveyBuilder initial={editing.id?editing:null} onCancel={()=>setEditing(null)} onSave={save}/>:<div className="content-list">{state.data.map(item=><article key={item.id}><div><h3>{item.title}</h3><p>{item.description} · {item.status}</p></div><div><Link className="button outline" to="/encuestas">Diligenciar</Link><button className="button outline" onClick={async()=>{try{setResponses(await loadServiceResponses(item.id));setReport(item);}catch(e){setError(e.message);}}}>Resultados</button>{user.role==='superadmin'&&<><button className="button outline" onClick={()=>setEditing(item)}>Editar</button><button className="button outline" onClick={()=>save({...item,status:item.status==='published'?'closed':'published'})}>{item.status==='published'?'Cerrar':'Publicar'}</button></>}</div></article>)}</div>}</>;
}
function NoveltiesPanel({user}){
  const state=useData(()=>rows('community_novelties',q=>q.order('created_at',{ascending:false})));
  const census=useData(loadCensusRecords);
  const [message,setMessage]=useState('');
  const submit=async event=>{event.preventDefault();const form=new FormData(event.currentTarget);const target=event.currentTarget;const person=census.data.find(r=>r.id===form.get('record'));
    try{await insert('community_novelties',{record_id:person.id,community_id:person.community_id,kind:'death',event_date:form.get('date'),notes:form.get('notes')});state.reload();target.reset();setMessage('Novedad enviada para revisión.');}catch(e){setMessage(e.message);}};
  return <><h2>Novedades de las familias</h2><Status state={state}/><Status state={census}/><form className="publication-form" onSubmit={submit}><label>Persona<select name="record" required><option value="">Selecciona</option>{census.data.filter(r=>!r.answers.deceased).map(r=><option key={r.id} value={r.id}>{fullName(r)} · {communityNames[r.community_id]} · Vivienda {r.answers.householdCode}</option>)}</select></label><label>Fecha de fallecimiento<input name="date" type="date" max={new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'})} required/></label><label>Observaciones<textarea name="notes"/></label><button className="button primary">Enviar novedad</button></form>{message&&<p role="status">{message}</p>}<div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{census.data.find(r=>r.id===item.record_id)?fullName(census.data.find(r=>r.id===item.record_id)):item.record_id}</b><p>{item.kind} · {item.event_date} · {item.status}</p><p>{item.notes}</p></div>{user.role==='superadmin'&&item.status==='Pendiente'&&<div>{['Verificado','Rechazado'].map(decision=><button className="button outline" key={decision} onClick={async()=>{try{await rpc('review_novelty',{novelty_id:item.id,decision});state.reload();census.reload();}catch(e){setMessage(e.message);}}}>{decision==='Verificado'?'Verificar':'Rechazar'}</button>)}</div>}</article>)}</div></>;
}
function CertificatesPanel(){
  const census=useData(loadCensusRecords);
  const state=useData(()=>rows('certificates',q=>q.order('issued_at',{ascending:false})));
  const [selected,setSelected]=useState('');
  const [view,setView]=useState(null);
  const [error,setError]=useState('');
  const issue=async()=>{try{const item=await insert('certificates',{record_id:selected,holder_name:'',masked_document:'',community_id:census.data.find(r=>r.id===selected).community_id});setView(item);state.reload();}catch(e){setError(e.message);}};
  return <><h2>Expedición y control de certificados</h2><Status state={state}/><Status state={census}/>{error&&<p role="alert">{error}</p>}<div className="platform-filters"><label>Persona censada<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecciona</option>{census.data.map(r=><option key={r.id} value={r.id}>{fullName(r)} · {r.answers.documentNumber}</option>)}</select></label><button className="button primary" disabled={!selected} onClick={issue}>Expedir certificado</button></div>{view&&<CertificateView item={{...view,community:communityNames[view.community_id],valid:!view.revoked_at}} code={view.verification_code}/>}<div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{item.holder_name}</b><p>{date(item.issued_at)} · {item.revoked_at?'Revocado':'Válido'}</p></div><button className="button outline" onClick={()=>setView(item)}>Ver certificado</button>{!item.revoked_at&&<button className="button outline" onClick={async()=>{const reason=window.prompt('Motivo de revocación');if(!reason?.trim())return;try{await update('certificates',item.id,{revoked_at:new Date().toISOString(),revocation_reason:reason});setView(null);state.reload();}catch(e){setError(e.message);}}}>Revocar</button>}</article>)}</div></>;
}
function PublicationsPanel({user}){
  const state=useData(loadContent);
  const [editing,setEditing]=useState(null);
  const [kind,setKind]=useState('Noticia');
  const [error,setError]=useState('');
  const save=async event=>{event.preventDefault();const form=new FormData(event.currentTarget);
    const item={id:editing?.id || makeId('publicacion'),title:form.get('title').trim(),kind,
      section:user.role==='superadmin'?(communityNames[form.get('community')] || 'Consejo'):user.community,
      communityId:user.role==='superadmin'?(form.get('community') || null):user.community_id,
      status:form.get('status') || 'En revisión',
      description:form.get('description').trim(),body:form.get('body').trim(),image:form.get('image').trim(),
      publicationDate:form.get('publicationDate'),document:form.get('document') || '',edition:form.get('edition') || '',
      state:form.get('state') || 'Formulación',progress:Number(form.get('progress') || 0),
      startsOn:form.get('startsOn') || null,endsOn:form.get('endsOn') || null,
      startsAt:form.get('startsAt')?new Date(form.get('startsAt')).toISOString():null,
      endsAt:form.get('endsAt')?new Date(form.get('endsAt')).toISOString():null,place:form.get('place') || ''};
    try{await saveContent(item);setEditing(null);state.reload();setError('');}catch(e){setError(e.message);}
  };
  return <><div className="admin-toolbar"><div><h2>Publicaciones del Consejo</h2><p>{user.role==='superadmin'?'Gestiona noticias, proyectos, eventos, convocatorias y El Churo.':'Envía publicaciones de tu comunidad para aprobación.'}</p></div><button className="button primary" onClick={()=>{setEditing({});setKind('Noticia');}}>Nueva publicación</button></div><Status state={state}/>{error&&<p role="alert">{error}</p>}{editing&&<form className="publication-form" onSubmit={save} key={editing.id || 'new'}><h3>{editing.id?'Editar publicación':'Nueva publicación'}</h3><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}>{['Noticia','Evento','Convocatoria','Proyecto','El Churo','Seguimiento'].map(name=><option key={name}>{name}</option>)}</select></label><label>Título<input name="title" defaultValue={editing.title || ''} required/></label><label>Descripción<textarea name="description" defaultValue={editing.description || ''} required/></label><label>Contenido<textarea rows="6" name="body" defaultValue={editing.body || ''}/></label><label>Imagen (URL pública)<input name="image" type="url" defaultValue={editing.image?.startsWith('https:')?editing.image:''}/></label><label>Fecha de publicación<input name="publicationDate" type="date" defaultValue={editing.publicationDate || ''} required/></label>{user.role==='superadmin'&&<><label>Comunidad (opcional)<CommunitySelect name="community" defaultValue={editing.communityId || ''} required={false}/></label><label>Estado<select name="status" defaultValue={editing.status || 'Borrador'}>{['Borrador','En revisión','Aprobada','Rechazada'].map(value=><option key={value}>{value}</option>)}</select></label></>}
    {kind==='Proyecto'&&<><label>Estado del proyecto<select name="state" defaultValue={editing.state || 'Formulación'}>{['Formulación','En ejecución','Finalizado','Suspendido'].map(name=><option key={name}>{name}</option>)}</select></label><label>Avance %<input name="progress" type="number" min="0" max="100" defaultValue={editing.progress || 0}/></label><label>Fecha inicial<input name="startsOn" type="date" defaultValue={editing.startsOn || ''}/></label><label>Fecha final<input name="endsOn" type="date" defaultValue={editing.endsOn || ''}/></label></>}
    {kind==='Evento'&&<><label>Inicio<input name="startsAt" type="datetime-local" defaultValue={editing.startsAt?localDateTime(editing.startsAt):''} required/></label><label>Final<input name="endsAt" type="datetime-local" defaultValue={editing.endsAt?localDateTime(editing.endsAt):''}/></label><label>Lugar<input name="place" defaultValue={editing.place || ''} required/></label></>}
    {kind==='El Churo'&&<><label>Número de edición<input name="edition" defaultValue={editing.edition || ''} required/></label><label>Archivo PDF (URL pública desde Archivos)<input name="document" type="url" defaultValue={editing.document || ''} required/></label></>}
    <div><button type="button" className="button outline" onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary">{user.role==='superadmin'?'Guardar':'Enviar a revisión'}</button></div></form>}
    <div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{item.title}</b><p>{item.kind} · {item.section} · {item.status}</p><p>{item.description}</p></div>{(user.role==='superadmin' || (item.authorId===user.id && ['Borrador','En revisión'].includes(item.status)))&&<button className="button outline" onClick={()=>{setEditing(item);setKind(item.kind);}}>Editar {user.role==='superadmin'?'o revisar':''}</button>}</article>)}</div></>;
}
const localDateTime=value=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
function ContactsPanel(){
  const state=useData(()=>rows('contact_requests',q=>q.order('created_at',{ascending:false})));
  const events=useData(()=>rows('event_registrations',q=>q.order('created_at',{ascending:false})));
  const [error,setError]=useState('');
  return <><h2>Consultas y solicitudes de contacto</h2><Status state={state}/>{error&&<p role="alert">{error}</p>}<div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{item.name} · {item.subject}</b><p>{item.contact} · {date(item.created_at)}</p><p>{item.message}</p><small>Radicado: {item.id}</small></div><label>Estado<select value={item.status} onChange={async e=>{try{await update('contact_requests',item.id,{status:e.target.value,resolved_at:e.target.value==='Resuelta'?new Date().toISOString():null});state.reload();}catch(e){setError(e.message);}}}>{['Pendiente','En atención','Resuelta'].map(s=><option key={s}>{s}</option>)}</select></label></article>)}</div><h2>Inscripciones a eventos</h2><Status state={events}/><div className="content-list">{events.data.map(item=><article key={item.id}><div><b>{item.name}</b><p>{item.phone} · Documento: {item.document_number}</p><p>Evento: {item.event_id} · {date(item.created_at)}</p></div></article>)}</div></>;
}
function FilesPanel(){
  const state=useData(()=>rows('media_assets',q=>q.order('created_at',{ascending:false})));
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const upload=async event=>{event.preventDefault();const target=event.currentTarget;const form=new FormData(target);const file=form.get('file');const bucket=form.get('visibility')==='public'?'guajui-public':'guajui-private';const path=crypto.randomUUID()+'/'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');setBusy(true);
    try{unwrap(await supabase.storage.from(bucket).upload(path,file));try{await insert('media_assets',{bucket_id:bucket,object_path:path,title:file.name,mime_type:file.type,byte_size:file.size,is_public:bucket==='guajui-public'});}catch(e){await supabase.storage.from(bucket).remove([path]);throw e;}state.reload();target.reset();setMessage('Archivo guardado.');}catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  const open=async item=>{try{const url=item.is_public?supabase.storage.from(item.bucket_id).getPublicUrl(item.object_path).data.publicUrl:unwrap(await supabase.storage.from(item.bucket_id).createSignedUrl(item.object_path,120)).signedUrl;setMessage(url);}catch(e){setMessage(e.message);}};
  return <><h2>Archivos del Consejo</h2><p>Usa archivos públicos para noticias y El Churo. Los archivos privados solo se descargan con acceso autorizado.</p><Status state={state}/><form className="publication-form" onSubmit={upload}><label>Archivo<input name="file" type="file" required/></label><label>Acceso<select name="visibility"><option value="private">Privado</option><option value="public">Público</option></select></label><button className="button primary" disabled={busy}>Subir archivo</button></form>{message&&<p role="status" style={{overflowWrap:'anywhere'}}>{message.startsWith('https://')?<a href={message} target="_blank" rel="noreferrer">{message}</a>:message}</p>}<div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{item.title}</b><p>{item.is_public?'Público':'Privado'} · {Math.ceil(item.byte_size/1024)} KB</p></div><button className="button outline" onClick={()=>open(item)}>Obtener enlace</button></article>)}</div></>;
}
function PagesPanel(){
  const state=useData(()=>rows('site_pages',q=>q.order('slug')));
  const [slug,setSlug]=useState('consejo');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const page=state.data.find(item=>item.slug===slug);
  const sections=page?.sections?.length?page.sections:[{heading:'',body:''}];
  const submit=async event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setMessage('');
    try{unwrap(await supabase.from('site_pages').upsert({slug,title:form.get('title'),sections:sections.map((_,i)=>({heading:form.get('heading-'+i),body:form.get('body-'+i)})),published:Boolean(form.get('published')),updated_at:new Date().toISOString()}));state.reload();setMessage('Página guardada.');}
    catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  return <><h2>Información institucional</h2><p>Edita los bloques adicionales de Inicio y El Consejo.</p><Status state={state}/>
    <label>Página<select value={slug} onChange={e=>{setSlug(e.target.value);setMessage('');}}><option value="consejo">El Consejo</option><option value="inicio">Inicio</option></select></label>
    <form className="publication-form" onSubmit={submit} key={slug+JSON.stringify(page)}>
      <label>Título<input name="title" defaultValue={page?.title || ''} required/></label>
      {sections.map((section,i)=><React.Fragment key={i}><label>Encabezado<input name={'heading-'+i} defaultValue={section.heading} required/></label><label>Texto<textarea name={'body-'+i} rows="6" defaultValue={section.body} required/></label></React.Fragment>)}
      <label><input name="published" type="checkbox" defaultChecked={page?.published || false}/> Publicar</label>
      <button className="button primary" disabled={busy || state.loading}>{busy?'Guardando...':'Guardar página'}</button>
    </form>{message&&<p role="status">{message}</p>}</>;
}
function GroupsPanel(){
  const state=useData(()=>rows('community_groups',q=>q.order('name')));
  const [editing,setEditing]=useState(null);
  const [message,setMessage]=useState('');
  const submit=async event=>{event.preventDefault();const form=new FormData(event.currentTarget);try{unwrap(await supabase.from('community_groups').upsert({id:editing?.id || crypto.randomUUID(),name:form.get('name'),kind:form.get('kind'),community_id:form.get('community') || null,description:form.get('description'),contact_public:form.get('contact'),published:Boolean(form.get('published'))}));state.reload();setEditing(null);setMessage('Grupo guardado.');}catch(e){setMessage(e.message);}};
  return <><h2>Grupos y chirimías</h2><Status state={state}/><button className="button primary" onClick={()=>setEditing({})}>Nuevo grupo</button>{editing&&<form className="publication-form" onSubmit={submit} key={editing.id || 'new'}><label>Nombre<input name="name" defaultValue={editing.name || ''} required/></label><label>Tipo<select name="kind" defaultValue={editing.kind || 'population'}><option value="population">Grupo poblacional</option><option value="chirimia">Chirimía</option></select></label><label>Comunidad<CommunitySelect defaultValue={editing.community_id || ''} required={false}/></label><label>Descripción<textarea name="description" defaultValue={editing.description || ''}/></label><label>Contacto público<input name="contact" defaultValue={editing.contact_public || ''}/></label><label><input name="published" type="checkbox" defaultChecked={editing.published}/> Publicar</label><button type="button" className="button outline" onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary">Guardar</button></form>}{message&&<p role="status">{message}</p>}<div className="content-list">{state.data.map(item=><article key={item.id}><div><b>{item.name}</b><p>{item.description}</p></div><button className="button outline" onClick={()=>setEditing(item)}>Editar</button></article>)}</div></>;
}
function HistoryPanel(){
  const state=useData(()=>rows('audit_log',q=>q.order('occurred_at',{ascending:false})));
  return <><h2>Historial administrativo</h2><p>Las operaciones quedan asociadas a la identidad autenticada.</p><Status state={state}/><div className="admin-table"><table><thead><tr><th>Fecha</th><th>Tabla</th><th>Acción</th><th>Registro</th><th>Usuario</th></tr></thead><tbody>{state.data.map(item=><tr key={item.id}><td>{date(item.occurred_at)}</td><td>{item.table_name}</td><td>{item.operation}</td><td>{item.record_id}</td><td>{item.actor_id || 'Formulario público'}</td></tr>)}</tbody></table></div></>;
}
