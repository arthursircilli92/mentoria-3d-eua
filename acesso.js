const endpoint = '/api/acesso';
const calculatorPage = endpoint + '?view=page';
const message = document.getElementById('recover-msg');
const emailInput = document.getElementById('recover-email');
const btn = document.getElementById('recover-btn');

async function enter(credentials) {
  message.textContent = 'Verificando sua assinatura...';
  btn.disabled = true;
  btn.classList.add('loading');
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
      signal: AbortSignal.timeout(20000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Confira seu acesso e tente novamente.');
    if (!data.active) throw new Error('Não foi possível confirmar seu acesso. Tente novamente.');
    message.textContent = 'Acesso liberado. Abrindo a calculadora...';
    location.replace(calculatorPage);
  } catch (err) {
    message.textContent = err.name === 'TimeoutError' || err instanceof TypeError
      ? 'Não foi possível consultar sua assinatura. Verifique a conexão e tente novamente.'
      : err.message;
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}
function recoverAccess(event) {
  event.preventDefault();
  enter({ email: emailInput.value.trim() });
}
(async function init() {
  const params = new URLSearchParams(location.search);
  const reason = params.get('motivo');
  if (params.has('session_id')) {
    return enter({ sessionId: params.get('session_id') });
  }
  if (reason) {
    message.textContent = ({
      substituida: 'Sua conta foi aberta em outro navegador. Entre novamente para usar a calculadora aqui.',
      inativa: 'Sua assinatura está inativa.',
      verificar: 'Reconecte-se para verificar o acesso.'
    })[reason] || 'Informe o e-mail da assinatura para entrar.';
    message.scrollIntoView({ block: 'center' });
  }
  try {
    emailInput.value = localStorage.getItem('calc3d_email') || '';
    const response = await fetch(endpoint);
    if (response.ok) location.replace(calculatorPage);
  } catch {
    message.textContent = 'Verifique sua conexão para acessar a calculadora.';
  }
})();
