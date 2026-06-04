// ブラウザ標準の Web Crypto API を使った「本物の」公開鍵暗号デモ。
// 公開鍵暗号には大きく2つの使い方があり、本ラボではこの2パターンを体験する：
//
//   1. 暗号化 / 復号 (RSA-OAEP)
//        公開鍵で暗号化 → 秘密鍵で復号。目的は「機密性」。
//        ※ パスキー(WebAuthn)はこのパターンは使わない。
//
//   2. 署名 / 検証 (ECDSA P-256)
//        秘密鍵で署名 → 公開鍵で検証。目的は「真正性（本人性）」。
//        ※ パスキー(WebAuthn)が実際に使っているのはこちら。

import { bytesToHex, textToBytes } from "./utils";

// ----------------------------------------------------------------------------
// パターン1: 暗号化 / 復号 （RSA-OAEP）
// ----------------------------------------------------------------------------

export interface EncryptKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateEncryptKeyPair(): Promise<EncryptKeyPair> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** 公開鍵でメッセージを暗号化する。 */
export async function encryptMessage(
  publicKey: CryptoKey,
  message: string,
): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, textToBytes(message));
}

/** 秘密鍵で暗号文を復号する。鍵が一致しなければ例外（＝復号失敗）になる。 */
export async function decryptMessage(
  privateKey: CryptoKey,
  ciphertext: ArrayBuffer,
): Promise<string> {
  const plain = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, ciphertext);
  return new TextDecoder().decode(plain);
}

// ----------------------------------------------------------------------------
// パターン2: 署名 / 検証 （ECDSA P-256） ← パスキーの心臓部
// ----------------------------------------------------------------------------

export interface SignKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export async function generateSignKeyPair(): Promise<SignKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

/** 秘密鍵でメッセージ（チャレンジ）に署名する。 */
export async function signMessage(
  privateKey: CryptoKey,
  message: string,
): Promise<ArrayBuffer> {
  return crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    textToBytes(message),
  );
}

/** 公開鍵で署名を検証する。改ざんや鍵の不一致があれば false。 */
export async function verifySignature(
  publicKey: CryptoKey,
  message: string,
  signature: ArrayBuffer,
): Promise<boolean> {
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    textToBytes(message),
  );
}

// ----------------------------------------------------------------------------
// 表示用ヘルパー
// ----------------------------------------------------------------------------

/** 鍵を JWK にエクスポートして、表示しやすい形で返す。 */
export async function exportKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey("jwk", key);
}

/** SHA-256 ダイジェスト（hex）。データの指紋表示に使う。 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return bytesToHex(digest);
}
