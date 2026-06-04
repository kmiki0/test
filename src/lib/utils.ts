// バイト列と各種文字列表現を相互変換するためのヘルパー群。
// パスキーや暗号のデモでは ArrayBuffer / Uint8Array を頻繁に扱うため、
// 表示しやすい形（hex / base64url）へ変換できると可視化がしやすい。

export function bufToBytes(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

export function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = bufToBytes(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** 長い hex を「先頭…末尾」で省略表示する（鍵やダイジェストの表示用）。 */
export function shortHex(buf: ArrayBuffer | Uint8Array, head = 8, tail = 6): string {
  const hex = bytesToHex(buf);
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function bytesToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = bufToBytes(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function bytesToBase64url(buf: ArrayBuffer | Uint8Array): string {
  return bytesToBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToText(buf: ArrayBuffer | Uint8Array): string {
  return new TextDecoder().decode(bufToBytes(buf));
}

/** デモ用のランダムなチャレンジ（サーバーが毎回発行する乱数）を生成する。 */
export function randomChallenge(length = 32): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** アニメーションの「待ち」を作るための簡易 sleep。 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
