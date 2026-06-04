// 本物の WebAuthn（パスキー）を、バックエンドなしで体験するためのモジュール。
//
// 通常パスキーは「サーバーが公開鍵を保管し、サーバーが署名を検証する」が、
// 本ラボでは学習目的で以下をすべてブラウザ内で完結させる：
//   - 登録: navigator.credentials.create() で認証器に鍵ペアを作らせ、
//           公開鍵を localStorage に保存（サーバーの代役）。
//   - 認証: navigator.credentials.get() で署名を作らせ、
//           保存しておいた公開鍵で Web Crypto を使い「実際に」署名検証する。
//
// これにより「秘密鍵は認証器から出ない」「サーバーは公開鍵で検証するだけ」という
// パスキーの本質を、本物の暗号で確かめられる。

import {
  base64urlToBytes,
  bytesToBase64url,
  randomChallenge,
} from "./utils";

const STORE_KEY = "passkey-lab/credentials";
const RP_NAME = "Passkey Lab";

/** localStorage に保存する登録済みパスキー情報（サーバー側DBの代役）。 */
export interface StoredCredential {
  credentialId: string; // base64url
  publicKeySpki: string; // base64url (SPKI DER)
  algorithm: number; // COSE alg (-7 = ES256, -257 = RS256)
  userName: string;
  createdAt: number;
  authenticatorAttachment: string | null;
  transports: string[];
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function loadCredentials(): StoredCredential[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredCredential[]) : [];
  } catch {
    return [];
  }
}

function saveCredentials(creds: StoredCredential[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(creds));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORE_KEY);
}

// ---------------------------------------------------------------------------
// 登録 (Registration / Attestation)
// ---------------------------------------------------------------------------

export interface RegistrationResult {
  credential: StoredCredential;
  challenge: string; // base64url（サーバーが発行した想定の乱数）
  clientDataJSON: Record<string, unknown>;
  rawClientData: string;
}

export async function registerPasskey(
  userName: string,
  challenge: Uint8Array = randomChallenge(32),
): Promise<RegistrationResult> {
  const userId = randomChallenge(16);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: RP_NAME, id: location.hostname },
    user: {
      id: userId,
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256 (ECDSA P-256) ← 最も一般的
      { type: "public-key", alg: -257 }, // RS256 (RSA) ← フォールバック
    ],
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    timeout: 60000,
    attestation: "none",
  };

  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
  if (!cred) throw new Error("認証器から資格情報が返りませんでした。");

  const response = cred.response as AuthenticatorAttestationResponse;

  // ブラウザ標準APIで公開鍵(SPKI DER)とアルゴリズムを取り出す。
  const spki = response.getPublicKey();
  const alg = response.getPublicKeyAlgorithm();
  if (!spki) {
    throw new Error("この認証器/ブラウザは公開鍵の取り出しに対応していません。");
  }

  const rawClientData = new TextDecoder().decode(response.clientDataJSON);
  const clientDataJSON = JSON.parse(rawClientData) as Record<string, unknown>;

  const stored: StoredCredential = {
    credentialId: cred.id,
    publicKeySpki: bytesToBase64url(new Uint8Array(spki)),
    algorithm: alg,
    userName,
    createdAt: Date.now(),
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
    transports:
      typeof response.getTransports === "function" ? response.getTransports() : [],
  };

  const all = loadCredentials().filter((c) => c.credentialId !== stored.credentialId);
  all.push(stored);
  saveCredentials(all);

  return {
    credential: stored,
    challenge: bytesToBase64url(challenge),
    clientDataJSON,
    rawClientData,
  };
}

// ---------------------------------------------------------------------------
// 認証 (Authentication / Assertion) ＋ ブラウザ内での署名検証
// ---------------------------------------------------------------------------

export interface AuthenticationResult {
  matchedCredentialId: string;
  challenge: string; // base64url
  clientDataJSON: Record<string, unknown>;
  rawClientData: string;
  authenticatorDataHex: string;
  signatureHex: string;
  /** 保存済み公開鍵で署名を検証した結果。パスキーの肝。 */
  signatureValid: boolean;
}

export async function authenticatePasskey(
  challenge: Uint8Array = randomChallenge(32),
): Promise<AuthenticationResult> {
  const stored = loadCredentials();
  if (stored.length === 0) {
    throw new Error("登録済みのパスキーがありません。先に登録してください。");
  }

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: location.hostname,
    timeout: 60000,
    userVerification: "preferred",
    allowCredentials: stored.map((c) => ({
      type: "public-key" as const,
      id: base64urlToBytes(c.credentialId),
    })),
  };

  const assertion = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
  if (!assertion) throw new Error("認証がキャンセルされました。");

  const response = assertion.response as AuthenticatorAssertionResponse;
  const matched = stored.find((c) => c.credentialId === assertion.id);
  if (!matched) throw new Error("対応する公開鍵が見つかりませんでした。");

  const authenticatorData = new Uint8Array(response.authenticatorData);
  const clientDataBytes = new Uint8Array(response.clientDataJSON);
  const signature = new Uint8Array(response.signature);

  const rawClientData = new TextDecoder().decode(clientDataBytes);
  const clientDataJSON = JSON.parse(rawClientData) as Record<string, unknown>;

  // 署名対象データ = authenticatorData || SHA-256(clientDataJSON)
  const clientDataHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", clientDataBytes),
  );
  const signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientDataHash, authenticatorData.length);

  const signatureValid = await verifyAssertionSignature(matched, signature, signedData);

  return {
    matchedCredentialId: matched.credentialId,
    challenge: bytesToBase64url(challenge),
    clientDataJSON,
    rawClientData,
    authenticatorDataHex: toHex(authenticatorData),
    signatureHex: toHex(signature),
    signatureValid,
  };
}

async function verifyAssertionSignature(
  cred: StoredCredential,
  signature: Uint8Array,
  signedData: Uint8Array,
): Promise<boolean> {
  const spki = base64urlToBytes(cred.publicKeySpki);

  if (cred.algorithm === -7) {
    // ES256: ECDSA P-256 / SHA-256。WebAuthnの署名はASN.1 DERなのでrawに変換。
    const key = await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const rawSig = derToRawEcdsaSignature(signature, 32);
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, rawSig, signedData);
  }

  if (cred.algorithm === -257) {
    // RS256: RSASSA-PKCS1-v1_5 / SHA-256。署名はそのまま使える。
    const key = await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signature, signedData);
  }

  throw new Error(`未対応の署名アルゴリズムです (alg=${cred.algorithm})`);
}

/**
 * ECDSA署名のASN.1 DER形式を、Web Cryptoが要求する raw (r||s) 形式へ変換する。
 * DER: 30 len 02 rLen r 02 sLen s
 */
function derToRawEcdsaSignature(der: Uint8Array, size: number): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("DER署名の形式が不正です。");
  // 全体長（1バイト想定。P-256では十分）。
  if (der[offset] & 0x80) offset += (der[offset] & 0x7f) + 1;
  else offset += 1;

  const readInt = (): Uint8Array => {
    if (der[offset++] !== 0x02) throw new Error("DER整数の形式が不正です。");
    let len = der[offset++];
    let val = der.slice(offset, offset + len);
    offset += len;
    // 先頭の符号用 0x00 を除去。
    while (val.length > 0 && val[0] === 0x00) val = val.slice(1);
    return val;
  };

  const r = readInt();
  const s = readInt();

  const out = new Uint8Array(size * 2);
  out.set(r, size - r.length);
  out.set(s, size * 2 - s.length);
  return out;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
