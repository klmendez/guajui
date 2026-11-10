import React from 'react';
import { Download, FileText } from 'lucide-react';
import PageHero from '../../components/ui/PageHero';
import { usePublishedContent } from '../../data/contentStore';

const editionLabel = date => {
  if (!date) return 'Edición semestral';
  const parsed = new Date(`${date}T00:00:00`);
  const semester = parsed.getMonth() < 6 ? 'Primer semestre' : 'Segundo semestre';
  return `${semester} de ${parsed.getFullYear()}`;
};

export default function ElChuroPage() {
  const {items:editions,error}=usePublishedContent('El Churo');
  return <><PageHero eyebrow="Publicación semestral" title="El Churo" description="Memoria, actualidad y voces del territorio reunidas en una publicación del Consejo Comunitario del Río Guajuí." image="/assets/asamblea-limones.webp"/><section className="section churo-archive">{error && <p role="alert">{error}</p>}<div className="churo-intro"><span className="eyebrow">Archivo documental</span><h2>Consulta las ediciones de El Churo</h2><p>Cada seis meses publicamos una nueva edición para compartir procesos, historias, decisiones y aprendizajes de nuestras comunidades.</p></div>{editions.length ? <div className="churo-list">{editions.map((edition, index) => <article key={edition.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{editionLabel(edition.publicationDate)}</small><h3>{edition.title}</h3><p>{edition.description}</p></div><a className="button" href={edition.document} download={edition.documentName || `${edition.title}.pdf`}><Download/>Descargar PDF</a></article>)}</div> : <div className="churo-empty"><FileText/><div><h3>Próxima edición en preparación</h3><p>Las publicaciones aprobadas aparecerán aquí para consulta y descarga.</p></div></div>}</section></>;
}
