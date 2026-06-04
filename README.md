# Passkey Lab 🔑

パスキー（WebAuthn）の仕組みを、**本物の暗号を実際に動かしながら**、アニメーションで
ステップごとに体験・説明できる教育用 Web サービスです。説明の場で「実際に試しながら見せる」
ことを目的にしています。

## このアプリで体験できること

パスキーは「公開鍵暗号」で動いています。その**2つの使い方**を本物の暗号で体験し、
最後に実機のパスキーへつなげる構成です。

| セクション | 内容 | 鍵の向き | パスキーとの関係 |
| --- | --- | --- | --- |
| 🔒 暗号化 / 復号 | RSA-OAEP で機密性を守る | 公開鍵で暗号化 → 秘密鍵で復号 | ❌ パスキーは使わない |
| ✍️ 署名 / 検証 | ECDSA P-256 で本人性を示す | 秘密鍵で署名 → 公開鍵で検証 | ✅ **パスキーの核心** |
| 🔐 パスキー体験 | WebAuthn で実機の登録/認証 | 署名 / 検証 | ✅ 本物のパスキー |

> 💡 **ポイント**: パスキー（WebAuthn）が実際に使うのは「署名と検証」だけで、
> 「暗号化と復号」は使いません。両者は公開鍵暗号の対になる使い方なので、
> 並べて体験すると理解が深まります。

## 技術的な特徴

- **本物の暗号**: ブラウザ標準の [Web Crypto API](https://developer.mozilla.org/docs/Web/API/Web_Crypto_API)
  と [WebAuthn API](https://developer.mozilla.org/docs/Web/API/Web_Authentication_API) を使用。
- **バックエンド不要**: パスキーの登録時に得た公開鍵をブラウザ内（localStorage）に保存し、
  認証時の署名検証も Web Crypto でブラウザ内完結。「秘密鍵は認証器から出ない／サーバーは
  公開鍵で検証するだけ」というパスキーの本質を、本物の暗号で確認できます。
- **可視化**: Framer Motion で、ユーザー ⇄ ブラウザ ⇄ 認証器 ⇄ サーバー のやり取りを
  ステップごとにアニメーション表示します。

## 開発・実行

```bash
npm install      # 依存をインストール
npm run dev      # 開発サーバー（http://localhost:5173）
npm run build    # 本番ビルド（dist/）
npm run preview  # ビルド成果物をプレビュー
```

### パスキーを実機で試す条件

WebAuthn は **`localhost` か HTTPS** でのみ動作します。`npm run dev` で開く
`http://localhost:5173` ならそのまま指紋／顔認証（Touch ID / Face ID / Windows Hello）や
セキュリティキーで試せます。公開する場合は HTTPS で配信してください。

## デプロイ（Cloudflare Pages）

Private リポジトリでも無料で公開でき、`https://<名前>.pages.dev` の HTTPS URL が得られます
（パスキーの動作要件を満たします）。ローカルに Node が無くても Cloudflare 側でビルドされます。

1. [Cloudflare](https://dash.cloudflare.com/) に無料登録 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. GitHub を認可し、`kmiki0/test` を選択
3. ビルド設定:
   - Framework preset: **Vite**
   - Build command: **`npm run build`**
   - Build output directory: **`dist`**
   - Production branch: 公開したいブランチ（例: `claude/practical-wozniak-HmGKq` または `main`）
4. **Save and Deploy** → 数分で `https://<プロジェクト名>.pages.dev` が発行される

`vite.config.ts` の `base` は相対パス（`"./"`）なので、ルート配信（pages.dev）でもサブパス配信
（GitHub Pages の `/test/`）でも、そのまま動作します。

## 技術スタック

Vite ＋ React ＋ TypeScript ＋ Tailwind CSS ＋ Framer Motion
