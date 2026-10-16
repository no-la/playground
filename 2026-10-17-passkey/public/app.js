const account = document.querySelector('#account');
const status = document.querySelector('#status');
const form = document.querySelector('#register-form');
const loginButton = document.querySelector('#login');
const logoutButton = document.querySelector('#logout');

async function api(path, body) {
  const response = await fetch(`/api/${path}`, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
async function refresh() {
  const { username } = await api('me');
  account.textContent = username ? `${username} としてログイン中` : '未ログイン';
  form.hidden = !!username;
  loginButton.hidden = !!username;
  logoutButton.hidden = !username;
}
async function run(action, message) {
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  status.textContent = '処理中です。認証画面が表示されたら操作してください…';
  try {
    await action();
    await refresh();
    status.textContent = message;
  } catch (error) {
    status.textContent = error.name === 'NotAllowedError'
      ? '認証がキャンセルされたか、時間切れになりました。もう一度お試しください。'
      : error.message;
  } finally {
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    const optionsJSON = await api('register/options', { username: document.querySelector('#username').value });
    const response = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
    await api('register/verify', response);
  }, '登録とログインに成功しました。ログアウトして再ログインを試せます。');
});
loginButton.addEventListener('click', () => run(async () => {
  const optionsJSON = await api('login/options', {});
  const response = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
  await api('login/verify', response);
}, 'パスキーでログインしました。'));
logoutButton.addEventListener('click', () => run(() => api('logout', {}), 'ログアウトしました。'));
if (!window.PublicKeyCredential || !window.isSecureContext) {
  status.textContent = 'WebAuthn対応ブラウザで http://localhost:3000 を開いてください。';
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
} else {
  refresh().catch(error => { status.textContent = error.message; });
}
