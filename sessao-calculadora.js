let checking = false;
async function checkSession() {
  if (checking || document.hidden) return;
  checking = true;
  try {
    const response = await fetch('/api/acesso', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      const data = await response.json();
      location.replace('/calculadora-vendas.html?motivo=' + encodeURIComponent(data.reason || 'verificar'));
    }
  } catch {
    location.replace('/calculadora-vendas.html?motivo=verificar');
  } finally {
    checking = false;
  }
}
setInterval(checkSession, 30000);
window.addEventListener('focus', checkSession);
window.addEventListener('pageshow', checkSession);
document.addEventListener('visibilitychange', checkSession);
