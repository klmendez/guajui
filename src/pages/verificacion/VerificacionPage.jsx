import React,{useState,useEffect} from 'react';
import {useParams,Link} from 'react-router-dom';
import {rpc} from '../../data/platformStore';
import CertificateView from '../certificado/CertificateView';
export default function VerificacionPage(){
  const {codigo}=useParams();
  const [item,setItem]=useState(null);
  const [message,setMessage]=useState('Verificando certificado…');
  useEffect(()=>{let active=true;rpc('verify_community_certificate',{code:codigo}).then(result=>{if(active){setItem(result[0] || null);setMessage(result.length?'':'Certificado no encontrado.');}}).catch(()=>{if(active)setMessage('Código de certificado inválido o servicio no disponible.');});return()=>{active=false;};},[codigo]);
  return <section className="section">{message&&<p role="status">{message}</p>}{item&&<CertificateView item={item} code={codigo}/>}<Link to="/certificado">Consultar otro certificado</Link></section>;
}
