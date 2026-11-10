import PageHero from '../../components/ui/PageHero';
import {usePublishedContent} from '../../data/contentStore';
import DataMessage from '../../components/ui/DataMessage';
export default function ProyectosPage(){
  const {items,error}=usePublishedContent('Proyecto');
  return <><PageHero eyebrow="Gestión y transparencia" title="Proyectos del Consejo" description="Seguimiento a las iniciativas aprobadas por el Consejo."/><section className="section"><DataMessage error={error} empty={!items.length}/><div className="project-cards">{items.map(item=><article key={item.id}><span>{item.state}</span><h2>{item.title}</h2><p>{item.description}</p><progress max="100" value={item.progress || 0}/><p>{item.progress || 0}% de avance</p><details><summary>Ver ficha del proyecto</summary><p>{item.body}</p><p>{item.startsOn} – {item.endsOn || 'En curso'}</p></details></article>)}</div></section></>;
}
