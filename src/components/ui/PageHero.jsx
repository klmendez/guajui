import React from 'react';
export default function PageHero({eyebrow,title,description,image='/assets/paisaje-juanico.webp'}){return <section className="page-hero" style={{'--page-image':`url("${image}")`}}><div><span className="eyebrow light">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></section>}
