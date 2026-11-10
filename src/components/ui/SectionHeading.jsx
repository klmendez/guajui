import React from 'react';
export default function SectionHeading({eyebrow,title,text}){return <div className="section-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div>}
