import React from'react';
import{Link}from'react-router-dom';
import{Landmark,Users,Newspaper,ClipboardList,ShieldCheck}from'lucide-react';

const areas=[
  {title:'Institucional',icon:Landmark,text:'Conoce la organización, el territorio y los principios del Consejo.',links:[['/consejo','El Consejo'],['/contacto','Contacto']]},
  {title:'Comunidad',icon:Users,text:'Procesos poblacionales, culturales y espacios de participación.',links:[['/grupos','Grupos poblacionales'],['/chirimias','Chirimías'],['/agenda','Agenda']]},
  {title:'Gestión pública',icon:Newspaper,text:'Acciones, resultados y actualidad de la comunidad.',links:[['/noticias','Noticias'],['/proyectos','Proyectos'],['/encuestas','Encuestas']]},
  {title:'Consulta pública',icon:ClipboardList,text:'Comprueba si una persona está en el censo de su comunidad y si cuenta con certificado vigente.',links:[['/censo','Consultar censo y certificado']]},
  {title:'Área privada',icon:ShieldCheck,text:'Herramientas reservadas para el personal autorizado del Consejo.',links:[['/admin','Panel administrativo']]}
];

export default function NavigationMapSection(){return <section className="section navigation-map" id="mapa-navegacion"><div className="section-heading"><span className="eyebrow">Mapa de navegación</span><h2>Encuentra rápidamente lo que necesitas</h2><p>El portal está organizado por áreas para facilitar el acceso a la información, los procesos comunitarios y los servicios del censo.</p></div><div className="sitemap-grid">{areas.map(({title,icon:Icon,text,links})=><article key={title}><Icon/><h2>{title}</h2><p>{text}</p><nav aria-label={title}>{links.map(([to,label])=><Link to={to} key={to}>{label}</Link>)}</nav></article>)}</div></section>}
