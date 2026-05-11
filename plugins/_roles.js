// _roles.js — DESACTIVADO
// Los roles han sido reemplazados por los rangos temáticos de levelRanks.js
// El rango se muestra automáticamente en el perfil según el nivel del usuario.

let handler = m => m
handler.before = async function () { return false }
export default handler
