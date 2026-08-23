import { parseJson } from "./authService";



const ADMIN_BASE = '/api/admin';

export async function getLogs() : Promise<{ logs: string[] }> {
  const response = await fetch(`${ADMIN_BASE}/logs`, {
    method: 'GET',
    credentials: 'include',
  });
  return parseJson<{ logs: string[] }>(response);
}