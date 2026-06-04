import { useEffect, useRef, useState } from "react";
import {
  authenticatePasskey,
  clearCredentials,
  isPlatformAuthenticatorAvailable,
  isWebAuthnSupported,
  loadCredentials,
  registerPasskey,
  type AttachmentChoice,
  type AuthenticationResult,
  type RegistrationResult,
  type StoredCredential,
} from "../lib/webauthn";
import { bytesToBase64url, randomChallenge } from "../lib/utils";
import { StepPlayer, type ActorDef, type PlayerStep } from "../components/StepPlayer";
import { Callout, DataField, SectionHeading } from "../components/ui";

type Mode = "register" | "authenticate";

const ACTORS: ActorDef[] = [
  { id: "user", icon: "🧑", name: "ユーザー", sub: "あなた" },
  { id: "browser", icon: "🌐", name: "ブラウザ", sub: "WebAuthn" },
  { id: "authenticator", icon: "🔐", name: "認証器", sub: "秘密鍵を保持" },
  { id: "server", icon: "🗄️", name: "サーバー", sub: "公開鍵を保持" },
];

export default function PasskeyLab() {
  const [supported, setSupported] = useState(true);
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [creds, setCreds] = useState<StoredCredential[]>([]);
  const [userName, setUserName] = useState("demo-user");
  const [mode, setMode] = useState<Mode>("register");
  // 登録先の認証器: platform=このデバイス内蔵 / cross-platform=スマホ・別デバイス(QR)
  const [attachment, setAttachment] = useState<AttachmentChoice>("platform");

  // 表示用の状態（各ステップの detail に流し込む）。
  const [challengeB64, setChallengeB64] = useState("");
  const [reg, setReg] = useState<RegistrationResult | null>(null);
  const [auth, setAuth] = useState<AuthenticationResult | null>(null);

  // 実際の呼び出しで使うチャレンジは ref で保持（表示と一致させる）。
  const challengeRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
    isPlatformAuthenticatorAvailable().then(setPlatformAvailable);
    setCreds(loadCredentials());
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    challengeRef.current = null;
    setChallengeB64("");
    setReg(null);
    setAuth(null);
    setMode(next);
  }

  function switchAttachment(next: AttachmentChoice) {
    if (next === attachment) return;
    challengeRef.current = null;
    setChallengeB64("");
    setReg(null);
    setAttachment(next);
  }

  function resetState() {
    challengeRef.current = null;
    setChallengeB64("");
    if (mode === "register") setReg(null);
    else setAuth(null);
  }

  // --- 登録フロー ---
  const registerSteps: PlayerStep[] = [
    {
      actor: "server",
      from: "server",
      to: "browser",
      arrowLabel: "challenge",
      title: "サーバーがチャレンジを発行",
      description:
        "サーバーが使い捨ての乱数（チャレンジ）と登録パラメータを返します。毎回違う値なので使い回しできません。",
      detail: challengeB64 ? (
        <DataField tone="sky" label="challenge (b64url)" value={challengeB64} />
      ) : null,
    },
    {
      actor: "browser",
      from: "browser",
      to: "authenticator",
      arrowLabel: "create() 依頼",
      title: "ブラウザが認証器に鍵生成を依頼",
      description:
        "navigator.credentials.create() を準備。このサイト(rpId)向けに、対応アルゴリズムで鍵ペアを作るよう認証器へ依頼します。",
      detail: (
        <DataField
          tone="slate"
          label="rpId / alg"
          value={`${location.hostname} / ES256(-7), RS256(-257)`}
        />
      ),
    },
    {
      actor: "authenticator",
      live: true,
      title:
        attachment === "cross-platform"
          ? "QR表示 → スマホで本人確認 → 鍵ペアを生成"
          : "本人確認 → 鍵ペアを生成",
      description:
        attachment === "cross-platform"
          ? "ブラウザが「別のデバイスを使う」QRコードを表示します。スマホの標準カメラで読み取り、スマホ側で指紋/顔認証すると、スマホの中に鍵ペアが作られます。秘密鍵はスマホから出ません。"
          : "端末の生体認証（指紋/顔）やPINで本人確認し、認証器がこのサイト専用の鍵ペアを生成します。秘密鍵は認証器の中に留まり、外には出ません。",
      detail: reg ? (
        <DataField tone="violet" label="生成された資格情報ID" value={reg.credential.credentialId} />
      ) : null,
    },
    {
      actor: "browser",
      from: "authenticator",
      to: "server",
      arrowLabel: "公開鍵",
      title: "公開鍵をサーバーへ送る",
      description:
        "認証器が返した『公開鍵』と資格情報IDを、ブラウザがサーバーへ転送します。送られるのは公開鍵だけ。",
      detail: reg ? (
        <DataField tone="emerald" label="公開鍵 (SPKI, b64url)" value={reg.credential.publicKeySpki} />
      ) : null,
    },
    {
      actor: "server",
      title: "公開鍵を保存して登録完了",
      description:
        "サーバーは公開鍵を保管するだけ。パスワードのような秘密を持たないので、漏洩してもなりすましに使えません。登録完了です！",
      detail: reg ? (
        <DataField tone="sky" label="アルゴリズム" value={algName(reg.credential.algorithm)} />
      ) : null,
    },
  ];

  async function activateRegister(i: number) {
    if (i === 0) {
      const c = randomChallenge(32);
      challengeRef.current = c;
      setChallengeB64(bytesToBase64url(c));
    }
    if (i === 2) {
      const result = await registerPasskey(
        userName.trim() || "demo-user",
        challengeRef.current ?? randomChallenge(32),
        attachment,
      );
      setReg(result);
      setCreds(loadCredentials());
    }
  }

  // --- 認証フロー ---
  const authSteps: PlayerStep[] = [
    {
      actor: "server",
      from: "server",
      to: "browser",
      arrowLabel: "challenge",
      title: "サーバーがチャレンジを発行",
      description:
        "ログインのたびに新しい乱数（チャレンジ）を発行します。これにより署名の使い回し（リプレイ攻撃）を防ぎます。",
      detail: challengeB64 ? (
        <DataField tone="sky" label="challenge (b64url)" value={challengeB64} />
      ) : null,
    },
    {
      actor: "browser",
      from: "browser",
      to: "authenticator",
      arrowLabel: "get() 依頼",
      title: "ブラウザが認証器に署名を依頼",
      description:
        "navigator.credentials.get() を準備。登録済みの資格情報IDを指定し、チャレンジへの署名を認証器へ依頼します。",
      detail: (
        <DataField tone="slate" label="rpId" value={`${location.hostname}（登録済みの鍵を使用）`} />
      ),
    },
    {
      actor: "authenticator",
      live: true,
      title: "本人確認 → 秘密鍵で署名",
      description:
        "生体認証/PINで本人確認し、秘密鍵でチャレンジに署名します。秘密鍵は外に出ず、出力されるのは『署名』だけです。",
      detail: auth ? (
        <DataField tone="violet" label="署名 (hex)" value={`${auth.signatureHex.slice(0, 64)}…`} />
      ) : null,
    },
    {
      actor: "browser",
      from: "authenticator",
      to: "server",
      arrowLabel: "署名",
      title: "署名をサーバーへ送る",
      description:
        "署名・authenticatorData・clientDataJSON をサーバーへ送ります。秘密鍵は送りません。",
      detail: auth ? (
        <DataField
          tone="slate"
          label="authenticatorData (hex)"
          value={`${auth.authenticatorDataHex.slice(0, 64)}…`}
        />
      ) : null,
    },
    {
      actor: "server",
      title: "公開鍵で署名を検証 → ログイン成立",
      description:
        "サーバーは登録時に預かった公開鍵で署名を検証します（このデモではブラウザ内のWeb Cryptoで実際に検証）。正しければ本人と確認でき、ログイン成立です。",
      detail:
        auth != null ? (
          <DataField
            tone={auth.signatureValid ? "emerald" : "rose"}
            label="署名検証"
            value={auth.signatureValid ? "✓ 有効：本人と確認" : "✕ 無効"}
          />
        ) : null,
    },
  ];

  async function activateAuthenticate(i: number) {
    if (i === 0) {
      const c = randomChallenge(32);
      challengeRef.current = c;
      setChallengeB64(bytesToBase64url(c));
    }
    if (i === 2) {
      const result = await authenticatePasskey(challengeRef.current ?? randomChallenge(32));
      setAuth(result);
      setCreds(loadCredentials());
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="実機で体験 / WebAuthn" title="パスキーを1ステップずつ動かす">
        「次へ」を押して、サーバー⇄ブラウザ⇄認証器のやり取りを自分のペースで進めましょう。
        <b className="text-slate-200">「認証器」のステップで実際の生体認証</b>が起動します。
      </SectionHeading>

      {!supported && (
        <Callout variant="warn" title="この環境では WebAuthn を利用できません">
          HTTPS もしくは localhost の対応ブラウザでお試しください。
        </Callout>
      )}
      {supported && platformAvailable === false && (
        <Callout variant="info" title="内蔵認証器が見つかりません">
          外付けセキュリティキーやスマホ連携（QR）でも試せます。
        </Callout>
      )}

      {/* モード切替＋ユーザー名 */}
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
            <button
              onClick={() => switchMode("register")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-sky-500/20 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ① 登録フロー
            </button>
            <button
              onClick={() => switchMode("authenticate")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === "authenticate"
                  ? "bg-sky-500/20 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ② 認証フロー
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">ユーザー名</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-40 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400/50"
            />
          </div>
        </div>

        {/* 登録先の認証器を選ぶ（登録フローのみ） */}
        {mode === "register" && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="mb-2 text-xs font-semibold text-slate-300">パスキーをどこに作る？</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DeviceChoiceButton
                active={attachment === "platform"}
                onClick={() => switchAttachment("platform")}
                icon="💻"
                title="このデバイス"
                sub="内蔵の指紋 / 顔 / Windows Hello"
              />
              <DeviceChoiceButton
                active={attachment === "cross-platform"}
                onClick={() => switchAttachment("cross-platform")}
                icon="📱"
                title="スマホ / 別デバイス"
                sub="QRコードを読み取って移行"
              />
            </div>
          </div>
        )}
      </div>

      {mode === "register" && attachment === "cross-platform" && (
        <Callout variant="info" title="QRコードはブラウザが表示します">
          「次へ」で<b>認証器のステップ</b>まで進むと、ブラウザが「別のデバイスを使う」QRコードを表示します。
          スマホの<b>標準カメラ</b>で読み取り、スマホ側で指紋／顔認証してください
          （※ Webアプリ側ではQRを生成できない仕様です）。
        </Callout>
      )}

      {mode === "authenticate" && creds.length === 0 ? (
        <Callout variant="warn" title="先にパスキーを登録してください">
          認証（ログイン）には登録済みのパスキーが必要です。「① 登録フロー」から作成してください。
        </Callout>
      ) : (
        <div className="card p-5">
          <StepPlayer
            key={`${mode}-${attachment}`}
            steps={mode === "register" ? registerSteps : authSteps}
            actors={ACTORS}
            onActivate={mode === "register" ? activateRegister : activateAuthenticate}
            onReset={resetState}
            formatError={humanizeError}
          />
        </div>
      )}

      {/* 登録済みパスキー一覧 */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-200">
            登録済みパスキー（このブラウザ内に保存）
          </div>
          {creds.length > 0 && (
            <button
              onClick={() => {
                clearCredentials();
                setCreds(loadCredentials());
              }}
              className="text-xs text-rose-300 hover:underline"
            >
              すべて削除
            </button>
          )}
        </div>
        {creds.length === 0 ? (
          <p className="text-sm text-slate-500">まだありません。「① 登録フロー」から作成してください。</p>
        ) : (
          <ul className="space-y-2">
            {creds.map((c) => (
              <li key={c.credentialId} className="rounded-lg border border-white/10 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">{c.userName}</span>
                  <span className="text-slate-400">{algName(c.algorithm)}</span>
                  {c.authenticatorAttachment && (
                    <span className="text-slate-500">
                      {c.authenticatorAttachment === "platform"
                        ? "💻 このデバイス"
                        : "📱 スマホ / 別デバイス"}
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

function DeviceChoiceButton({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-sky-400/60 bg-sky-400/10 shadow-lg shadow-sky-500/10"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-slate-100">{title}</span>
        <span className="text-[11px] text-slate-400">{sub}</span>
      </span>
      <span className={`ml-auto text-sm ${active ? "text-sky-300" : "text-transparent"}`}>✓</span>
    </button>
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
      return "操作がキャンセルされたか、タイムアウトしました。「もう一度」でやり直せます。";
    if (e.name === "InvalidStateError")
      return "この認証器には既に登録済みの可能性があります。";
    if (e.name === "SecurityError")
      return "セキュリティ上の理由で実行できません（HTTPS / 正しいドメインが必要）。";
    return `${e.name}: ${msg}`;
  }
  return msg;
}
