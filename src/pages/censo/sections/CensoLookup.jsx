import { sameCommunity } from '../../../data/communities';
import React, { useState } from "react";
import { Edit3, HousePlus, Search, Users } from "lucide-react";
import {
  findByDocument,
  fullName,
  getLinkedFamilyMembers,
  hasUsedMissingBirthDateUpdate,
  maskDocument,
} from "../../../data/censusStore";

export default function CensoLookup({ onSelect, allowLinkedFamily = false, community, showNewHouse = true }) {
  const [document, setDocument] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(null);
  const search = () => {
    setVerified(null);
    if (!document.trim())
      return setMessage(
        "Ingresa el número de documento registrado en el censo.",
      );
    const record = findByDocument(document);
    if (!record || (community && !sameCommunity(record.answers.community, community)))
      return setMessage(
        "No encontramos una persona con ese documento. Revisa el número o solicita un registro nuevo.",
      );
    const hasBirthDate =
      record.answers.birthDate &&
      record.answers.birthDate !== "Falta actualizar";
    if (hasUsedMissingBirthDateUpdate(record.id))
      return setMessage(
        "La actualización única de este registro ya fue utilizada. Cualquier cambio adicional debe realizarlo el Consejo desde administración.",
      );
    if (hasBirthDate && birthDate !== record.answers.birthDate)
      return setMessage(
        "El documento y la fecha de nacimiento no coinciden con el censo maestro.",
      );
    setMessage("");
    if (!allowLinkedFamily) {
      onSelect({ type: "update", record, missingBirthDateAccess: !hasBirthDate });
      return;
    }
    setVerified({ record, members: getLinkedFamilyMembers(record), missingBirthDateAccess: !hasBirthDate });
  };
  return (
    <section className="section censo-entry left-entry">
      <div className="notice">
        <b>Consulta del personal autorizado</b>
        <p>
          Busca una persona por documento y confirma su fecha de nacimiento.
          Las modificaciones las realiza directamente el personal encuestador autorizado.
        </p>
      </div>
      <div className="lookup-card census-verify">
        <label>
          Número de documento
          <input
            value={document}
            onChange={(event) =>
              setDocument(event.target.value.replace(/\s/g, ""))
            }
            placeholder="Documento registrado"
          />
        </label>
        <label>
          Fecha de nacimiento
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </label>
        <button className="button primary" onClick={search}>
          <Search /> Verificar y actualizar
        </button>
      </div>
      {message && <div className="inline-message error">{message}</div>}
      {verified && (
        <div className="linked-family">
          <div className="linked-family-heading">
            <Users />
            <div>
              <h3>Integrantes vinculados</h3>
              <p>Hogar {verified.record.answers.householdCode} · Familia {verified.record.answers.familyCode}</p>
            </div>
          </div>
          <div className="linked-family-list">
            {verified.members.map((member) => (
              <article key={member.id}>
                <div>
                  <b>{fullName(member) || "Nombre pendiente"}</b>
                  <span>{member.answers.relationship || "Parentesco pendiente"}</span>
                  <small>Código {member.answers.personCode || "pendiente"} · Documento {maskDocument(member.answers.documentNumber)}</small>
                </div>
                <button className="button outline" onClick={() => onSelect({ type: "update", record: member, missingBirthDateAccess: member.id === verified.record.id && verified.missingBirthDateAccess })}>
                  <Edit3 /> Actualizar
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {showNewHouse && <><div className="choice-divider">
        <span>o</span>
      </div>
      <button className="new-house" onClick={() => onSelect({ type: "new" })}>
        <HousePlus />
        <span>
            <b>Registrar una vivienda y sus familias</b>
          <small>
            Puedes incluir varias familias en una misma vivienda. Cada persona
            entra directamente al censo maestro.
          </small>
        </span>
      </button>
      </>}
    </section>
  );
}
