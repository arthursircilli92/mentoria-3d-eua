const endpoint = '/pack-prompts/api/acesso-pack';
const galleryPage = endpoint + '?view=page';
const message = document.getElementById('msg');
const emailInput = document.getElementById('email');
const btn = document.getElementById('btn');

async function enter(credentials) {
  btn.disabled = true;
  btn.classList.add('loading');
  btn.textContent = 'Verificando...';
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Confira seu acesso e tente novamente.');
    location.replace(galleryPage);
  } catch (err) {
    message.textContent = err.message;
    message.className = 'msg error';
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.textContent = 'Acessar biblioteca';
  }
}

document.getElementById('login-form').addEventListener('submit', function(event) {
  event.preventDefault();
  enter({ email: emailInput.value.trim() });
});

(async function init() {
  const params = new URLSearchParams(location.search);
  const reason = params.get('motivo');
  if (params.has('session_id')) {
    return enter({ sessionId: params.get('session_id') });
  }
  if (reason) {
    message.textContent = ({
      inativa: 'Seu acesso ao pack está inativo ou não foi encontrado.',
      login: 'Informe o e-mail da compra para acessar a biblioteca.'
    })[reason] || 'Informe o e-mail da compra para acessar.';
    message.className = 'msg info';
  }
  try {
    emailInput.value = localStorage.getItem('pack3d_email') || '';
    const response = await fetch(endpoint);
    if (response.ok) location.replace(galleryPage);
  } catch {
    message.textContent = 'Verifique sua conexão para acessar o pack.';
    message.className = 'msg error';
  }
})();