import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { encodeCBOR } from '@levischuck/tiny-cbor';

test('API guards, session binding, challenge expiry and consumption', async t => {
  let time = 0;
  const server = createServer().listen(0, 'localhost');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://localhost:${server.address().port}`;
  server.on('request', createApp({ port: server.address().port, now: () => time, challengeTTL: 100 }));
  let cookie;
  async function post(path, body = {}, headers = {}) {
    const response = await fetch(`${base}/api/${path}`, {
      method: 'POST', headers: {
        origin: base,
        'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers,
      }, body: JSON.stringify(body),
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await post('register/options', { username: 'test' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('register/options', { username: '<script>' })).status, 400);
  const options = await post('register/options', { username: 'test' });
  assert.equal(options.status, 200);
  assert.equal(options.body.rp.id, 'localhost');
  assert.equal(options.body.authenticatorSelection.userVerification, 'required');
  const firstCookie = cookie;
  cookie = undefined;
  assert.match((await post('register/verify')).body.error, /チャレンジ/);
  cookie = firstCookie;
  time = 101;
  assert.match((await post('register/verify')).body.error, /期限切れ/);
  await post('register/options', { username: 'test' });
  assert.equal((await post('register/verify', { id: 'invalid' })).status, 400);
  assert.match((await post('register/verify', { id: 'invalid' })).body.error, /チャレンジ/);
  await post('login/options');
  assert.equal((await post('login/verify', { id: 'unknown' })).status, 400);
  assert.match((await post('login/verify', { id: 'unknown' })).body.error, /チャレンジ/);
  await post('login/options');
  assert.equal((await post('logout')).status, 200);
  assert.match((await post('login/verify')).body.error, /チャレンジ/);
  const me = await fetch(`${base}/api/me`, { headers: { cookie } });
  assert.deepEqual(await me.json(), { username: null });

  // A software authenticator: real P-256 key, CBOR attestation and ECDSA assertions.
  const hash = data => createHash('sha256').update(data).digest();
  const b64 = data => Buffer.from(data).toString('base64url');
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const cose = encodeCBOR(new Map([
    [1, 2], [3, -7], [-1, 1],
    [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')],
  ]));
  const id = randomBytes(32);
  const registration = (await post('register/options', { username: 'signed-test' })).body;
  const clientData = (type, challenge, origin = base) => Buffer.from(JSON.stringify({ type, challenge, origin }));
  const authData = Buffer.concat([hash('localhost'), Buffer.from([0x45, 0, 0, 0, 0]), Buffer.alloc(16), Buffer.from([0, 32]), id, cose]);
  const response = {
    id: b64(id), rawId: b64(id), type: 'public-key', clientExtensionResults: {},
    response: {
      clientDataJSON: b64(clientData('webauthn.create', registration.challenge)),
      attestationObject: b64(encodeCBOR(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]))),
      transports: ['internal'],
    },
  };
  const anonymousCookie = cookie;
  assert.equal((await post('register/verify', response)).status, 200);
  assert.notEqual(cookie, anonymousCookie);
  assert.equal((await post('register/options', { username: 'signed-test' })).status, 409);
  await post('logout');
  async function assertion({ wrongOrigin = false, tamper = false, counter = 1 } = {}) {
    const options = (await post('login/options')).body;
    const client = clientData('webauthn.get', options.challenge, wrongOrigin ? 'https://evil.example' : base);
    const data = Buffer.concat([hash('localhost'), Buffer.from([5, 0, 0, 0, counter])]);
    const signature = sign('sha256', Buffer.concat([data, hash(client)]), privateKey);
    if (tamper) signature[signature.length - 1] ^= 1;
    return {
      id: b64(id), rawId: b64(id), type: 'public-key', clientExtensionResults: {},
      response: { clientDataJSON: b64(client), authenticatorData: b64(data), signature: b64(signature), userHandle: registration.user.id },
    };
  }
  assert.equal((await post('login/verify', await assertion({ wrongOrigin: true }))).status, 400);
  assert.equal((await post('login/verify', await assertion({ tamper: true }))).status, 400);
  const valid = await assertion();
  assert.equal((await post('login/verify', valid)).status, 200);
  const loggedIn = await fetch(`${base}/api/me`, { headers: { cookie } });
  assert.deepEqual(await loggedIn.json(), { username: 'signed-test' });
  assert.equal((await post('login/verify', valid)).status, 400);
  await post('logout');
  assert.equal((await post('login/verify', await assertion())).status, 400, 'counter rollback must fail');
  assert.equal((await post('login/verify', await assertion({ counter: 2 }))).status, 200);
});
