import { useEffect, useState } from "react";
import {
  authenticatePasskey,
  clearCredentials,
  isPlatformAuthenticatorAvailable,
  isWebAuthnSupported,
  loadCredentials,
  registerPasskey,
  type AuthenticationResult,
  type RegistrationResult,
  type StoredCredential,
} from "../lib/webauthn";
import { sleep } from "../lib/utils";
import { StepFlow, type FlowStep } from "../components/StepFlow";
import { Actor, Callout, DataField, ResultBadge, SectionHeading } from "../components/ui";

type Mode = "register" | "authenticate";

export default function PasskeyLab() {
  const [supported, setSupported] = useState(true);
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [creds, setCreds] = useState<StoredCredential[]>([]);
  const [userName, setUserName] = useState("demo-user");
  const [mode, setMode] = useState<Mode>("register");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeActor, setActiveActor] = useState<string | null>(null);
  const [reg, setReg] = useState<RegistrationResult | null>(null);
  const [auth, setAuth] = useState<AuthenticationResult | null>(null);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
    isPlatformAuthenticatorAvailable().then(setPlatformAvailable);
    setCreds(loadCredentials());
  }, []);

  function refresh() {
    setCreds(loadCredentials());
  }

  async function doRegister() {
    setBusy(true);
    setError(null);
    setReg(null);
    setMode("register");
    setStep(0);
    try {
      setActiveActor("browser");
      await sleep(700);
      setStep(1);
      setActiveActor("authenticator"); // ここで指紋/顔/PIN のOSダイアログが出る
      const result = await registerPasskey(userName.trim() || "demo-user");
      setStep(2);
      setActiveActor("browser");
      await sleep(700);
      setStep(3);
      setActiveActor("server");
      await sleep(700);
      setStep(4);
      setReg(result);
      refresh();
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setActiveActor(null);
      setBusy(false);
    }
  }

  async function doAuthenticate() {
    setBusy(true);
    setError(null);
    setAuth(null);
    setMode("authenticate");
    setStep(0);
    try {
      setActiveActor("server");
      await sleep(700);
      setStep(1);
      setActiveActor("authenticator");
      const result = await authenticatePasskey();
      setStep(2);
      setActiveActor("browser");
      await sleep(700);
      setStep(3);
      setActiveActor("server");
      await sleep(700);
      setStep(4);
      setAuth(result);
      refresh();
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setActiveActor(null);
      setBusy(false);
    }
  }

  const registerSteps: FlowStep[] = [
    {
      id: "r0",
      actor: "サーバー",
      title: "チャレンジ＋ユーザー情報を発行",
      description: "サーバーが乱数（チャレンジ）と登録用パラメータを返す。",
      detail: reg ? <DataField tone="sky" label="challenge (b64url)" value={reg.challenge} /> : null,
    },
    {
      id: "r1",
      actor: "認証器",
      title: "本人確認 → 鍵ペアを生成",
      description:
        "OSの生体認証（指紋/顔）やPINで本人確認。認証器がこのサイト専用の鍵ペアを作る。秘密鍵は端末から出ない。",
      detail: reg ? (
        <DataField tone="violet" label="生成された資格情報ID" value={reg.credential.credentialId} />
      ) : null,
    },
    {
      id: "r2",
      actor: "ブラウザ",
      title: "公開鍵などをサーバーへ返す",
      description: "認証器が返した公開鍵・資格情報IDをブラウザがサーバーへ転送する。",
      detail: reg ? (
        <DataField tone="emerald" label="公開鍵 (SPKI, b64url)" value={reg.credential.publicKeySpki} />
      ) : null,
    },
    {
      id: "r3",
      actor: "サーバー",
      title: "公開鍵を保存（パスワードは保存しない）",
      description:
        "サーバーは公開鍵を保管するだけ。秘密情報を持たないので、漏洩してもなりすましに使えない。",
      detail: reg ? (
        <DataField tone="sky" label="アルゴリズム" value={algName(reg.credential.algorithm)} />
      ) : null,
    },
    {
      id: "r4",
      actor: "完了",
      title: "登録完了",
      description: "以後はこの公開鍵で本人確認できる。パスワードは一切不要。",
    },
  ];

  const authSteps: FlowStep[] = [
    {
      id: "a0",
      actor: "サーバー",
      title: "チャレンジを発行",
      description: "ログインのたびに新しい乱数を発行（リプレイ攻撃対策）。",
      detail: auth ? <DataField tone="sky" label="challenge (b64url)" value={auth.challenge} /> : null,
    },
    {
      id: "a1",
      actor: "認証器",
      title: "本人確認 → 秘密鍵で署名",
      description:
        "生体認証/PINで本人確認し、秘密鍵でチャレンジに署名する。秘密鍵は出ず、署名だけが出力される。",
      detail: auth ? (
        <DataField tone="violet" label="署名 (hex)" value={`${auth.signatureHex.slice(0, 48)}…`} />
      ) : null,
    },
    {
      id: "a2",
      actor: "ブラウザ",
      title: "署名・認証データを返す",
      description: "authenticatorData と clientDataJSON、署名をサーバーへ送る。",
      detail: auth ? (
        <DataField tone="slate" label="authenticatorData (hex)" value={`${auth.authenticatorDataHex.slice(0, 48)}…`} />
      ) : null,
    },
    {
      id: "a3",
      actor: "サーバー",
      title: "保存済み公開鍵で署名を検証",
      description:
        "登録時に預かった公開鍵で署名を検証（このデモではブラウザ内のWeb Cryptoで実際に検証）。",
      detail:
        auth != null ? (
          <DataField tone={auth.signatureValid ? "emerald" : "rose"} label="署名検証" value={auth.signatureValid ? "✓ 有効" : "✕ 無効"} />
        ) : null,
    },
    {
      id: "a4",
      actor: "完了",
      title: "ログイン成立",
      description: "署名が正しければログイン成功。パスワードのやり取りは一切なし。",
    },
  ];

  const steps = mode === "register" ? registerSteps : authSteps;

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="実機で体験 / WebAuthn" title="パスキーを実際に動かす">
        ここまでの「署名と検証」を、ブラウザ標準の <b className="text-slate-200">WebAuthn API</b> と
        お使いの端末の認証器（Touch ID / Face ID / Windows Hello / セキュリティキー）で本物として動かします。
      </SectionHeading>

      {!supported && (
        <Callout variant="warn" title="この環境では WebAuthn を利用できません">
          HTTPS もしくは localhost で、対応ブラウザを使うと動作します。上の2つの「公開鍵暗号」デモは利用できます。
        </Callout>
      )}
      {supported && platformAvailable === false && (
        <Callout variant="info" title="内蔵認証器が見つかりません">
          指紋/顔認証が使えない端末の可能性があります。外付けセキュリティキーやスマホ連携（QR）でも試せます。
        </Callout>
      )}

      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-slate-300">ユーザー名</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-400/50 sm:max-w-xs"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={doRegister} disabled={busy || !supported} className="btn-primary">
              {busy && mode === "register" ? "実行中…" : "① パスキーを登録"}
            </button>
            <button
              onClick={doAuthenticate}
              disabled={busy || !supported || creds.length === 0}
              className="btn-ghost"
            >
              {busy && mode === "authenticate" ? "実行中…" : "② パスキーでログイン"}
            </button>
          </div>
        </div>

        {/* 4者のやり取りを可視化 */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Actor icon="🧑" name="ユーザー" sub="生体認証" active={activeActor === "authenticator"} />
          <Actor icon="🌐" name="ブラウザ" sub="WebAuthn API" active={activeActor === "browser"} />
          <Actor icon="🔐" name="認証器" sub="秘密鍵を保持" active={activeActor === "authenticator"} />
          <Actor icon="🗄️" name="サーバー" sub="公開鍵を保持" active={activeActor === "server"} />
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-400/30">
            {error}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 text-sm font-semibold text-slate-200">
          {mode === "register" ? "登録フロー（Registration）" : "認証フロー（Authentication）"}
        </div>
        <StepFlow steps={steps} current={step} />
        {mode === "authenticate" && auth != null && (
          <div className="mt-5">
            <ResultBadge ok={auth.signatureValid}>
              {auth.signatureValid
                ? "署名検証OK：パスキーでログイン成功！"
                : "署名検証NG：ログイン失敗"}
            </ResultBadge>
          </div>
        )}
        {mode === "register" && reg != null && (
          <div className="mt-5">
            <ResultBadge ok>パスキー登録完了：公開鍵をサーバーに保存しました</ResultBadge>
          </div>
        )}
      </div>

      {/* 登録済みパスキー一覧（サーバー側DBの代役） */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            登録済みパスキー（このブラウザ内に保存）
          </div>
          {creds.length > 0 && (
            <button
              onClick={() => {
                clearCredentials();
                refresh();
              }}
              className="text-xs text-rose-300 hover:underline"
            >
              すべて削除
            </button>
          )}
        </div>
        {creds.length === 0 ? (
          <p className="text-sm text-slate-500">まだありません。「① パスキーを登録」から作成してください。</p>
        ) : (
          <ul className="space-y-2">
            {creds.map((c) => (
              <li key={c.credentialId} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{c.userName}</span>
                  <span className="text-slate-400">{algName(c.algorithm)}</span>
                  {c.authenticatorAttachment && (
                    <span className="text-slate-500">
                      {c.authenticatorAttachment === "platform" ? "🖥 内蔵認証器" : "🔑 外付け"}
                    </span>
                  )}
                  <span className="text-slate-600">
                    {new Date(c.createdAt).toLocaleString("ja-JP")}
                  </span>
                </div>
                <div className="mono mt-1 text-slate-500">ID: {c.credentialId}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function algName(alg: number): string {
  if (alg === -7) return "ES256 (ECDSA P-256)";
  if (alg === -257) return "RS256 (RSA)";
  return `alg=${alg}`;
}

function humanizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError")
      return "操作がキャンセルされたか、タイムアウトしました。もう一度お試しください。";
    if (e.name === "InvalidStateError")
      return "この認証器には既に登録済みの可能性があります。";
    if (e.name === "SecurityError")
      return "セキュリティ上の理由で実行できません（HTTPS / 正しいドメインが必要）。";
    return `${e.name}: ${msg}`;
  }
  return msg;
}
