import React, { useState } from 'react';
import { usePublishedContent } from '../../data/contentStore';
import PageHero from '../../components/ui/PageHero';
export default function NoticiasPage() {
  const { items, error } = usePublishedContent();
  const [kind, setKind] = useState('');
  const kinds = ['Noticia', 'Convocatoria', 'Seguimiento'];
  const publications = items.filter(item => kinds.includes(item.kind) && (!kind || item.kind === kind));
  return <><PageHero eyebrow="Actualidad comunitaria" title="Noticias y publicaciones" description="Noticias, convocatorias y avances del Consejo." image="/assets/aprobacion-guajui.webp" />
    <section className="section">
      <label>Tipo de publicación <select value={kind} onChange={event => setKind(event.target.value)}><option value="">Todas</option>{kinds.map(value => <option key={value}>{value}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      {!publications.length && !error && <p>No hay publicaciones disponibles.</p>}
      <div className="editorial-grid">{publications.map(item => <article key={item.id}>
        <img src={item.image} alt="" loading="lazy" />
        <div><small>{item.kind} · {item.date}</small><h2>{item.title}</h2><p>{item.description}</p>
          {item.body && <details><summary className="text-link">Leer publicación</summary><p style={{whiteSpace: 'pre-wrap'}}>{item.body}</p></details>}
        </div>
      </article>)}</div>
    </section></>;
}
