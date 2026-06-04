import { useState } from "react";
import { motion } from "framer-motion";
import {
  generateSignKeyPair,
  signMessage,
  verifySignature,
  type SignKeyPair,
} from "../lib/crypto";
import { shortHex, sleep } from "../lib/utils";
import { StepFlow, type FlowStep } from "../components/StepFlow";
import { Actor, Callout, DataField, ResultBadge, SectionHeading } from "../components/ui";

export default function SignVerifyLab() {
  const [keys, setKeys] = useState<SignKeyPair | null>(null);
  const [challenge, setChallenge] = useState<string>("");
  const [signature, setSignature] = useState<ArrayBuffer | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [tamper, setTamper] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [activeActor, setActiveActor] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setSignature(null);
    setValid(null);
    setStep(0);

    // 1. サーバーがチャレンジ（毎回違う乱数）を発行
    setActiveActor("server");
    const ch = `login-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    setChallenge(ch);
    const pair = keys ?? (await generateSignKeyPair());
    setKeys(pair);
    setStep(1);
    await sleep(1000);

    // 2. 本人が秘密鍵で署名
    setActiveActor("user");
    const sig = await signMessage(pair.privateKey, ch);
    setSignature(sig);
    setStep(2);
    await sleep(1100);

    // 3. 署名を送信
    setActiveActor("wire");
    setStep(3);
    await sleep(1000);

    // 4. サーバーが公開鍵で検証（改ざんスイッチONなら別メッセージで検証＝失敗）
    setActiveActor("server");
    const verifyTarget = tamper ? ch + "（改ざん）" : ch;
    const ok = await verifySignature(pair.publicKey, verifyTarget, sig);
    setValid(ok);
    setStep(4);
    await sleep(400);
    setActiveActor(null);
    setBusy(false);
  }

  const steps: FlowStep[] = [
    {
      id: "challenge",
      actor: "サーバー",
      title: "チャレンジ（使い捨ての乱数）を発行",
      description:
        "サーバーはログインのたびに新しい乱数を送る。毎回違うので、署名を盗んでも使い回せない（リプレイ攻撃対策）。",
      detail: challenge ? <DataField tone="sky" label="challenge" value={challenge} /> : null,
    },
    {
      id: "sign",
      actor: "本人（認証器）",
      title: "秘密鍵でチャレンジに署名",
      description:
        "本人だけが持つ秘密鍵で署名を作る。秘密鍵そのものは絶対に外に出ない。出るのは署名だけ。",
      detail: signature ? (
        <DataField tone="violet" label="署名 (hex)" value={shortHex(signature, 24, 16)} />
      ) : null,
    },
    {
      id: "send",
      actor: "通信路",
      title: "署名を送信",
      description: tamper
        ? "（実験中）途中で署名対象データが改ざんされたと仮定する。"
        : "署名とチャレンジをサーバーへ返す。",
      detail: tamper ? (
        <DataField tone="rose" label="改ざん" value="署名対象データが書き換えられた！" />
      ) : null,
    },
    {
      id: "verify",
      actor: "サーバー",
      title: "公開鍵で署名を検証",
      description:
        "サーバーは登録時に預かった公開鍵で署名を検証する。正しければ「秘密鍵を持つ本人だ」と確認できる。",
      detail:
        valid != null ? (
          <DataField tone={valid ? "emerald" : "rose"} label="検証結果" value={valid ? "✓ 本人と確認" : "✕ 不一致（なりすまし/改ざん）"} />
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="公開鍵暗号 / パターン 2" title="署名と検証（パスキーの心臓部）">
        「秘密鍵で署名 → 公開鍵で検証」。<b className="text-slate-200">本人であることを証明する（真正性）</b>使い方です。
        パスキーはまさにこの仕組みで「パスワードなしのログイン」を実現します。
      </SectionHeading>

      <Callout variant="key" title="ここがパスキーの本質">
        サーバーは<b>公開鍵</b>しか持ちません。だから漏洩しても安全。秘密鍵は端末（認証器）から出ず、できるのは「チャレンジへの署名」だけ。次の「パスキー体験」で、これを実機で動かします。
      </Callout>

      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={tamper}
              onChange={(e) => setTamper(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 accent-rose-500"
            />
            改ざん実験（検証が失敗する様子を見る）
          </label>
          <button onClick={run} disabled={busy} className="btn-primary">
            {busy ? "実行中…" : "▶ 署名してログイン"}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Actor icon="🧑‍💻" name="本人" sub="秘密鍵で署名" active={activeActor === "user"} />
          <motion.div className="flex-1 text-center text-xs text-slate-500">
            <motion.div
              animate={{ x: activeActor === "wire" ? [-20, 20, -20] : 0 }}
              transition={{ repeat: activeActor === "wire" ? Infinity : 0, duration: 1.2 }}
            >
              ✍️ ───────▶
            </motion.div>
            署名（秘密鍵は渡さない）
          </motion.div>
          <Actor icon="🗄️" name="サーバー" sub="公開鍵で検証" active={activeActor === "server"} />
        </div>
      </div>

      <div className="card p-5">
        <StepFlow steps={steps} current={step} />
        {valid != null && (
          <div className="mt-5">
            <ResultBadge ok={valid}>
              {valid ? "署名検証OK：本人と確認できました" : "署名検証NG：本人と確認できません"}
            </ResultBadge>
          </div>
        )}
      </div>
    </div>
  );
}
