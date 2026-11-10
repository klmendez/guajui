import React, { useState } from 'react';
import { CheckCircle2, CircleHelp, FileBadge, Search } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { rpc, communityOptions } from '../../data/platformStore';

export default function CensoPage() {
  const [document, setDocument] = useState('');
  const [community, setCommunity] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async event => {
    event.preventDefault();
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const rows = await rpc('lookup_census_presence', {
        identity_document: document.trim(),
        target_community: community,
      });
      setResult(rows?.[0] || { in_census: false, certificate_available: false });
    } catch {
      setError('No fue posible consultar en este momento. Inténtalo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return <>
    <PageHero eyebrow="Servicio público" title="Consulta de censo y certificado" description="Comprueba si tu registro está activo en el censo comunitario y si ya tiene un certificado vigente." />
    <section className="section public-census-lookup">
      <div className="notice">
        <b>Consulta privada</b>
        <p>Solo se mostrará el estado del registro. No se revelan nombres ni otros datos personales; el documento se usa para la búsqueda y no se añade al censo.</p>
      </div>
      <form className="lookup-card" onSubmit={search}>
        <label>Comunidad
          <select value={community} onChange={event => setCommunity(event.target.value)} required>
            <option value="">Selecciona tu comunidad</option>
            {communityOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Número de identificación
          <input inputMode="numeric" autoComplete="off" value={document} onChange={event => setDocument(event.target.value)} minLength={4} maxLength={30} required />
        </label>
        <button className="button primary" type="submit" disabled={loading}><Search aria-hidden="true" />{loading ? 'Consultando…' : 'Consultar'}</button>
      </form>
      {error && <p className="inline-message error" role="alert">{error}</p>}
      {result && <div className={`census-lookup-result ${result.in_census ? 'is-found' : 'is-missing'}`} role="status">
        {result.in_census ? <CheckCircle2 aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
        <div><h2>{result.in_census ? 'Registro encontrado' : 'No encontramos un registro activo'}</h2>
          <p>{result.in_census ? 'La persona aparece en el censo de la comunidad seleccionada.' : 'Revisa que la identificación y la comunidad estén correctas. Si necesitas ayuda, comunícate con el Consejo.'}</p>
          {result.in_census && <p className="certificate-status"><FileBadge aria-hidden="true" />{result.certificate_available ? 'Tiene un certificado vigente.' : 'Todavía no tiene un certificado vigente.'}</p>}
        </div>
      </div>}
    </section>
  </>;
}
