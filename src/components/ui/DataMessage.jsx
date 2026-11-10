export default function DataMessage({error,empty}) {
  return error ? <p className="inline-message error" role="alert">{error}</p> : empty ? <p className="notice">Todavía no hay publicaciones disponibles.</p> : null;
}
