import express from 'express';
import session from 'express-session';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const directory = fileURLToPath(new URL('.', import.meta.url));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function createApp({ port = 3000, now = Date.now, challengeTTL = 120_000 } = {}) {
  const app = express();
  const origin = `http://localhost:${port}`;
  const users = new Map();
  // Consume synchronously before verification; concurrent requests cannot reuse a challenge.
  const challenges = new Map();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (req.headers.host !== new URL(origin).host) return res.status(403).json({ error: 'localhost URLを使用してください。' });
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (req.method === 'POST' && (req.headers.origin !== origin || !req.is('application/json'))) {
      return res.status(403).json({ error: '同一オリジンのJSONリクエストが必要です。' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use(session({
    name: 'passkey-lab.sid', secret: randomBytes(32).toString('hex'),
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: false, maxAge: 3_600_000 },
  }));
  function remember(req, details) {
    for (const [id, value] of challenges) if (value.expires <= now()) challenges.delete(id);
    challenges.set(req.sessionID, { ...details, expires: now() + challengeTTL });
    req.session.started = true;
  }
  function consume(req, kind) {
    const pending = challenges.get(req.sessionID);
    challenges.delete(req.sessionID);
    if (!pending || pending.kind !== kind || pending.expires <= now()) {
      throw fail('チャレンジが無効または期限切れです。最初からやり直してください。');
    }
    return pending;
  }
  async function login(req, username) {
    await new Promise((yes, no) => req.session.regenerate(error => error ? no(error) : yes()));
    req.session.username = username;
    await new Promise((yes, no) => req.session.save(error => error ? no(error) : yes()));
  }
  app.get('/api/me', (req, res) => res.json({ username: req.session.username ?? null }));
  app.post('/api/register/options', async (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(username)) throw fail('ユーザー名は英数字・_・- の1〜32文字で入力してください。');
    if (users.has(username)) throw fail('登録済みのユーザー名です。ログインするか別の名前を使ってください。', 409);
    const options = await generateRegistrationOptions({
      rpName: 'Passkey Lab', rpID: 'localhost', userName: username,
      attestationType: 'none',
      supportedAlgorithmIDs: [-7, -257],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    remember(req, { kind: 'register', challenge: options.challenge, username, userID: options.user.id });
    res.json(options);
  });
  app.post('/api/register/verify', async (req, res) => {
    const pending = consume(req, 'register');
    const result = await verifyRegistrationResponse({
      response: req.body, expectedChallenge: pending.challenge,
      expectedOrigin: origin, expectedRPID: 'localhost', requireUserVerification: true,
    });
    if (!result.verified || !result.registrationInfo) throw fail('登録を検証できませんでした。');
    if (users.has(pending.username)) throw fail('登録済みのユーザー名です。', 409);
    const credential = result.registrationInfo.credential;
    if ([...users.values()].some(user => user.credential.id === credential.id)) throw fail('登録済みのパスキーです。', 409);
    users.set(pending.username, { credential, userID: pending.userID });
    await login(req, pending.username);
    res.json({ verified: true });
  });
  app.post('/api/login/options', async (req, res) => {
    const options = await generateAuthenticationOptions({ rpID: 'localhost', userVerification: 'required' });
    remember(req, { kind: 'login', challenge: options.challenge });
    res.json(options);
  });
  app.post('/api/login/verify', async (req, res) => {
    const pending = consume(req, 'login');
    const entry = [...users].find(([, user]) => user.credential.id === req.body?.id);
    if (!entry || req.body?.response?.userHandle !== entry[1].userID) throw fail('登録済みのパスキーが見つかりません。');
    const [username, user] = entry;
    const result = await verifyAuthenticationResponse({
      response: req.body, expectedChallenge: pending.challenge,
      expectedOrigin: origin, expectedRPID: 'localhost',
      credential: user.credential, requireUserVerification: true,
    });
    if (!result.verified) throw fail('ログインを検証できませんでした。');
    user.credential.counter = result.authenticationInfo.newCounter;
    await login(req, username);
    res.json({ verified: true });
  });
  app.post('/api/logout', async (req, res) => {
    challenges.delete(req.sessionID);
    await new Promise((yes, no) => req.session.destroy(error => error ? no(error) : yes()));
    res.clearCookie('passkey-lab.sid');
    res.json({ ok: true });
  });
  app.get('/vendor/webauthn.js', (_req, res) => res.sendFile(resolve(directory, 'node_modules/@simplewebauthn/browser/dist/bundle/index.umd.min.js')));
  app.use(express.static(resolve(directory, 'public')));
  app.use((error, _req, res, _next) => {
    res.status(error.status ?? 400).json({ error: error.status ? error.message : '検証に失敗しました。操作をやり直してください。' });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp({ port }).listen(port, 'localhost', () => console.log(`Passkey Lab: http://localhost:${port}`));
}
