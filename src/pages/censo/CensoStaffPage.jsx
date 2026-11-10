import React, { useState, useEffect } from 'react';
import CensoLookup from './sections/CensoLookup';
import CensoForm from './sections/CensoForm';
import { usePlatformSession } from '../../data/platformSession';
import { loadCensusRecords } from '../../data/censusStore';

export default function CensoStaffPage({ initialTask = 'update', onClose }) {
  const { user } = usePlatformSession();
  const [mode, setMode] = useState(initialTask === 'new' ? { type: 'new' } : null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (user?.role === 'enumerator') loadCensusRecords()
      .then(() => { if (active) setReady(true); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user?.id, user?.community_id, user?.role]);
  if (user?.role !== 'enumerator') return <p role="alert">Solo el personal encuestador puede registrar o actualizar personas.</p>;
  return <div className="census-workflow">
    {(!mode || !ready || error) && <button className="button outline" onClick={onClose}>Volver a las personas censadas</button>}
    {error ? <p role="alert">{error}</p> : !ready ? <p role="status">Cargando registros de tu comunidad…</p> :
      mode ? <CensoForm mode={mode} community={user.community} onBack={onClose} /> :
      <CensoLookup community={user.community} onSelect={setMode} showNewHouse={false} />}
  </div>;
}
