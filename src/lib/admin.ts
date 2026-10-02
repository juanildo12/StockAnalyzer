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