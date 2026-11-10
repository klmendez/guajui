import React,{useEffect,useState} from 'react';
import {rows,roles,communityOptions,communityNames} from '../../data/platformStore';
import {platformAccountRequest} from '../../data/platformSession';

export default function AccountAccessPanel({user}){
  const [accounts,setAccounts]=useState([]);
  const [editing,setEditing]=useState(null);
  const [role,setRole]=useState('enumerator');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [version,setVersion]=useState(0);
  const [formVersion,setFormVersion]=useState(0);
  useEffect(()=>{
    let active=true;
    rows('access_grants',q=>q.order('login_username')).then(data=>{if(active)setAccounts(data.filter(item=>item.login_username));}).catch(e=>{if(active)setMessage(e.message);});
    return()=>{active=false;};
  },[version]);
  const self=editing?.login_username===user.username;
  const reset=()=>{setEditing(null);setRole('enumerator');setFormVersion(n=>n+1);};
  const submit=async event=>{
    event.preventDefault();if(busy)return;
    const form=new FormData(event.currentTarget);
    const body={username:form.get('username'),password:form.get('password'),email:form.get('email'),role,
      communityId:role==='superadmin'?null:form.get('community'),active:editing?.active ?? true};
    setBusy(true);setMessage('');
    try{
      if(editing)await platformAccountRequest('/accounts/'+encodeURIComponent(editing.login_username),body,'PATCH');
      else await platformAccountRequest('/accounts',body);
      setMessage(editing?'Usuario actualizado.':'Usuario creado. Ya puede entrar con las credenciales asignadas.');
      reset();setVersion(n=>n+1);
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  const toggle=async account=>{
    if(busy)return;setBusy(true);
    try{
      await platformAccountRequest('/accounts/'+encodeURIComponent(account.login_username),
        {role:account.role,communityId:account.community_id,active:!account.active},'PATCH');
      setVersion(n=>n+1);setMessage('Acceso actualizado.');
    }catch(e){setMessage(e.message);}finally{setBusy(false);}
  };
  return <><h2>Usuarios y accesos</h2><p>Crea un usuario y una contraseña para cada persona. Añade su correo para que pueda recuperar la contraseña. Solo hay tres perfiles y un responsable activo por comunidad.</p>
    <form className="publication-form" onSubmit={submit} key={(editing?.login_username || 'new')+formVersion}>
      <h3>{editing?'Editar usuario':'Crear usuario'}</h3>
      <label>Usuario<input name="username" autoComplete="off" autoCapitalize="none" spellCheck={false}
        pattern="[a-z][a-z0-9._-]{2,39}" minLength={3} maxLength={40}
        defaultValue={editing?.login_username || ''} readOnly={Boolean(editing)} required/></label>
      {editing?<p>Recuperación por correo: {editing.email.endsWith('.invalid')?'Sin correo asociado. Puedes definir una nueva contraseña aquí.':editing.email}</p>
        :<label>Correo para recuperar contraseña (opcional)<input name="email" type="email" autoComplete="email" maxLength={254}/></label>}
      <label>{editing?'Nueva contraseña (deja vacío para conservarla)':'Contraseña'}
        <input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required={!editing}/></label>
      <label>Perfil<select aria-label="Perfil" value={role} onChange={e=>setRole(e.target.value)} disabled={self}>
        {Object.entries(roles).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
      </select></label>
      {role!=='superadmin'&&<label>Comunidad asignada<select name="community" defaultValue={editing?.community_id || ''} disabled={self} required>
        <option value="">Selecciona la comunidad</option>{communityOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}
      </select></label>}
      <div>{editing&&<button type="button" className="button outline" disabled={busy} onClick={reset}>Cancelar</button>}
        <button className="button primary" disabled={busy}>{busy?'Guardando…':editing?'Guardar cambios':'Crear usuario'}</button></div>
    </form>
    {message&&<p role="status">{message}</p>}
    <div className="admin-table"><table><thead><tr><th>Usuario / correo de recuperación</th><th>Perfil</th><th>Comunidad</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>{accounts.map(account=><tr key={account.login_username}><td>{account.login_username}<small className="platform-account-email">{account.email.endsWith('.invalid')?'Sin correo asociado':account.email}</small></td><td>{roles[account.role]?.label}</td>
        <td>{communityNames[account.community_id] || 'Todas'}</td><td>{account.active?'Activo':'Desactivado'}</td>
        <td><button className="button outline" disabled={busy} onClick={()=>{setEditing(account);setRole(account.role);setMessage('');}}>Editar</button>
          <button className="button outline" disabled={busy || account.login_username===user.username} onClick={()=>toggle(account)}>{account.active?'Desactivar':'Activar'}</button></td></tr>)}</tbody>
    </table></div></>;
}
