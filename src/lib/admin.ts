const envAdmins = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Fallback: correos que siempre son administradores, aunque ADMIN_EMAILS
// no esté configurado en el entorno de producción.
const DEFAULT_ADMIN_EMAILS = ['jferrerasdiaz@gmail.com'];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const all = new Set([...envAdmins, ...DEFAULT_ADMIN_EMAILS])
  return all.has(normalized);
}

// Un usuario también es administrador si la sesión ya resolvió plan 'enterprise'
// (p.ej. cuando el JWT se emitió como enterprise).
export function isAdminSession(
  email?: string | null,
  plan?: string | null
): boolean {
  if (isAdminEmail(email)) return true;
  return (plan || '').toLowerCase() === 'enterprise';
}