# Passkey Lab

SimpleWebAuthn + Express による localhost 専用のパスキー実験。登録するとログインし、ログアウト後はユーザー名を入力せずパスキーでログインできます。

## 起動

Node.js 22 以上（推奨: 24 LTS）を使用します。

```sh
cd 2026-10-17-passkey
npm ci
npm start
```

**http://localhost:3000** を開きます。`127.0.0.1` や LAN IP ではなく `localhost` を使ってください。localhost は HTTP でも WebAuthn を利用できます。ポート変更は `PORT=3001 npm start` とし、http://localhost:3001 を開きます。編集時は `npm run dev` で自動再起動できます（保存データもリセットされます）。

## localhost での手動検証

1. WebAuthn 対応ブラウザで上記 URL を開く。
2. `nola-test` などのユーザー名を入力して「パスキーを登録」を押す。
3. OS / ブラウザの案内で保存先を選び、Touch ID、顔認証、PIN などで承認する。
4. 「nola-test としてログイン中」と表示されることを確認する。
5. 再読み込みしてもログイン状態が維持されることを確認する。
6. 「ログアウト」→「パスキーでログイン」と進み、登録したパスキーを選んで同じユーザーでログインできることを確認する。
7. ログアウト後、同じユーザー名の登録が拒否されることを確認する。別名で登録を開始して認証画面をキャンセルし、エラー後に再操作できることも確認する。

### 実機の認証器を使わない場合

Chrome DevTools → More tools → WebAuthn を開き、Enable virtual authenticator environment を有効にします。CTAP2 / Internal、Resident key と User verification を有効にした仮想認証器を追加し、Automatic presence simulation と Is user verified を有効にして同じ手順を実行します。DevTools は検証中開いたままにします。実機で試すときは仮想認証器環境を無効にしてください。

## 検証・構成

```sh
npm test
```

API テストは異なる Origin、入力不正、セッションの取り違え、チャレンジの期限切れ・再利用、未知の認証情報、ログアウトを確認します。さらにソフトウェア認証器が生成した実際の P-256 署名で登録・ログインの成功、署名改ざん、不正 Origin、署名カウンターの巻き戻しを検証します。OS / ブラウザの操作は上記の手動手順で確認します。

- `server.js`: options 発行、登録・署名検証、セッション管理。RP ID は `localhost`、Origin は起動ポートを含む固定値。チャレンジはセッションに紐づけて120秒で失効し、検証の成否によらず一度で消費します。
- `public/`: 登録・ログイン UI。ブラウザ用ライブラリも npm からローカル配信します。
- 登録時・認証時ともユーザー検証を必須にし、公開鍵と署名カウンターをサーバーで保持します。ログイン成功時はセッション ID を再発行します。

## デモの制約

アカウント・公開鍵・セッションはメモリ保存です。再起動すると消えるため、改めて登録してください。端末やパスワードマネージャーに保存されたパスキーは残ります。実験後は `localhost` 用の不要なパスキーを管理画面で削除してください。

ユーザー名は任意の実験用識別子であり、実在する人やメールアドレスの所有権は検証しません。アカウント復旧、複数パスキー追加、永続 DB、レート制限は未実装です。本番では HTTPS と Secure Cookie、永続的なセッションストアなどの設計が別途必要です。このサーバーは localhost のみにバインドします。バックエンドが必要なため GitHub Pages 配信対象にはしていません。

公式資料: [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server)
