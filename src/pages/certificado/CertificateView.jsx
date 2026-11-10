import React from 'react';
import {QRCodeSVG} from 'qrcode.react';
export default function CertificateView({item,code}){
  return <article className="certificate"><div className="certificate-head"><img className="certificate-seal" src="/assets/marca-circular.png" alt="Consejo del Río Guajuí"/><h2>Certificado de pertenencia</h2><small>{code}</small></div><p>El Consejo Comunitario del Río Guajuí certifica que <b>{item.holder_name}</b>, documento <b>{item.masked_document}</b>, figura en el censo comunitario.</p><p>Comunidad: <b>{item.community}</b></p><p>Expedido: {new Date(item.issued_at).toLocaleDateString('es-CO')}</p><QRCodeSVG value={window.location.origin+'/verificar/'+code} size={150}/><p>Estado: {item.valid===false?'Revocado o inactivo':'Válido'}</p><div className="certificate-signature"><div className="signature-line"/><b>Firma del Representante Legal</b></div><button className="button primary" onClick={()=>window.print()}>Descargar o imprimir</button></article>;
}
