import { useState } from "react";
import { motion } from "framer-motion";
import {
  decryptMessage,
  encryptMessage,
  generateEncryptKeyPair,
  type EncryptKeyPair,
} from "../lib/crypto";
import { shortHex, sleep } from "../lib/utils";
import { StepFlow, type FlowStep } from "../components/StepFlow";
import { Actor, Callout, DataField, ResultBadge, SectionHeading } from "../components/ui";

export default function EncryptDecryptLab() {
  const [keys, setKeys] = useState<EncryptKeyPair | null>(null);
  const [message, setMessage] = useState("こんにちは、パスキー！");
  const [cipher, setCipher] = useState<ArrayBuffer | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [activeActor, setActiveActor] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setCipher(null);
    setDecrypted(null);
    setStep(0);

    // 1. 鍵ペア生成
    setActiveActor("keys");
    const pair = keys ?? (await generateEncryptKeyPair());
    setKeys(pair);
    setStep(1);
    await sleep(900);

    // 2. 公開鍵で暗号化
    setActiveActor("public");
    const ct = await encryptMessage(pair.publicKey, message);
    setCipher(ct);
    setStep(2);
    await sleep(1100);

    // 3. 送信（盗聴されても読めない）
    setActiveActor("wire");
    setStep(3);
    await sleep(1100);

    // 4. 秘密鍵で復号
    setActiveActor("private");
    const pt = await decryptMessage(pair.privateKey, ct);
    setDecrypted(pt);
    setStep(4);
    await sleep(500);
    setActiveActor(null);
    setBusy(false);
  }

  const steps: FlowStep[] = [
    {
      id: "gen",
      actor: "受信者",
      title: "鍵ペアを生成（公開鍵＋秘密鍵）",
      description:
        "受信者が RSA 鍵ペアを作る。公開鍵は誰に渡してもよく、秘密鍵だけは絶対に外に出さない。",
      detail: keys ? <DataField tone="violet" label="鍵ペア" value="RSA-OAEP 2048bit（公開鍵は配布可 / 秘密鍵は非公開）" /> : null,
    },
    {
      id: "enc",
      actor: "送信者",
      title: "公開鍵でメッセージを暗号化",
      description: "送信者は受信者の「公開鍵」で暗号化する。これで暗号文ができる。",
      detail: cipher ? (
        <DataField tone="sky" label="暗号文 (hex)" value={shortHex(cipher, 24, 16)} />
      ) : null,
    },
    {
      id: "send",
      actor: "通信路",
      title: "暗号文を送信",
      description:
        "途中で第三者に盗み見られても、秘密鍵がなければ意味のないデータにしか見えない。",
      detail: cipher ? (
        <DataField tone="rose" label="盗聴者から見えるもの" value={`🔒 ${shortHex(cipher, 16, 10)}（解読不能）`} />
      ) : null,
    },
    {
      id: "dec",
      actor: "受信者",
      title: "秘密鍵で復号",
      description: "受信者だけが持つ秘密鍵で復号でき、元のメッセージが復元される。",
      detail:
        decrypted != null ? (
          <DataField tone="emerald" label="復号結果" value={decrypted} />
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="公開鍵暗号 / パターン 1" title="暗号化と復号">
        「公開鍵で暗号化 → 秘密鍵で復号」。<b className="text-slate-200">秘密を守る（機密性）</b>ための使い方です。
        ブラウザ標準の Web Crypto API で本物の RSA 暗号を動かします。
      </SectionHeading>

      <Callout variant="warn" title="パスキーとの関係">
        パスキー（WebAuthn）は<b>このパターンは使いません</b>。ただし対になる概念として理解しておくと、次の「署名と検証」がよく分かります。
      </Callout>

      <div className="card p-5">
        <label className="mb-2 block text-sm font-medium text-slate-300">送りたいメッセージ</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-400/50"
            placeholder="例）口座番号は 1234-5678"
          />
          <button onClick={run} disabled={busy || !message} className="btn-primary">
            {busy ? "実行中…" : "▶ 暗号化して送る"}
          </button>
        </div>

        {/* 登場人物のアニメーション */}
        <div className="mt-6 flex items-center justify-between gap-2">
          <Actor icon="✉️" name="送信者" sub="公開鍵で暗号化" active={activeActor === "public"} />
          <motion.div className="flex-1 text-center text-xs text-slate-500">
            <motion.div
              animate={{ x: activeActor === "wire" ? [-20, 20, -20] : 0 }}
              transition={{ repeat: activeActor === "wire" ? Infinity : 0, duration: 1.2 }}
            >
              🔒 ───────▶
            </motion.div>
            暗号文（盗聴されても安全）
          </motion.div>
          <Actor icon="📬" name="受信者" sub="秘密鍵で復号" active={activeActor === "private" || activeActor === "keys"} />
        </div>
      </div>

      <div className="card p-5">
        <StepFlow steps={steps} current={step} />
        {decrypted != null && (
          <div className="mt-5">
            <ResultBadge ok={decrypted === message}>
              {decrypted === message ? "復号成功：メッセージが元通りに！" : "復号結果が一致しません"}
            </ResultBadge>
          </div>
        )}
      </div>
    </div>
  );
}
