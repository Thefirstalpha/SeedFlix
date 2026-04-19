// Service pour la gestion du stockage FTP côté frontend
export async function testFtpConnection(config: any) {
  const res = await fetch('/api/ftp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Erreur test connexion FTP');
  return await res.json();
}
