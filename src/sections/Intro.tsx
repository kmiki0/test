import { motion } from "framer-motion";
import { Callout, SectionHeading } from "../components/ui";

export default function Intro({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-sky-300 via-indigo-200 to-violet-300 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl"
        >
          パスキーを「動かして」学ぶ
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base"
        >
          パスキー（WebAuthn）は「公開鍵暗号」で動いています。まずは土台となる
          <b className="text-slate-200">2つのパターン</b>を本物の暗号で体験し、最後に
          実機のパスキーへつなげましょう。
        </motion.p>
      </div>

      <SectionHeading eyebrow="まず全体像" title="公開鍵暗号には2つの使い方がある">
        どちらも「公開鍵」と「秘密鍵」のペアを使いますが、目的と鍵の向きが逆になります。
      </SectionHeading>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.button
          whileHover={{ y: -4 }}
          onClick={() => onNavigate("encrypt")}
          className="card p-6 text-left"
        >
          <div className="text-3xl">🔒</div>
          <h3 className="mt-3 text-lg font-bold text-white">① 暗号化 と 復号</h3>
          <p className="mt-1 text-xs text-sky-300">公開鍵で暗号化 → 秘密鍵で復号</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            目的は<b className="text-slate-200">機密性</b>。読まれたくない情報を守る。
            （パスキーはこちらは使いません）
          </p>
          <span className="mt-4 inline-block text-xs font-semibold text-sky-300">体験する →</span>
        </motion.button>

        <motion.button
          whileHover={{ y: -4 }}
          onClick={() => onNavigate("sign")}
          className="card p-6 text-left ring-1 ring-violet-400/20"
        >
          <div className="text-3xl">✍️</div>
          <h3 className="mt-3 text-lg font-bold text-white">② 署名 と 検証</h3>
          <p className="mt-1 text-xs text-violet-300">秘密鍵で署名 → 公開鍵で検証</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            目的は<b className="text-slate-200">真正性（本人性）</b>。
            <b className="text-violet-200">パスキーが使うのはこちら。</b>
          </p>
          <span className="mt-4 inline-block text-xs font-semibold text-violet-300">体験する →</span>
        </motion.button>
      </div>

      <Callout variant="key" title="つまりパスキーとは？">
        サーバーには<b>公開鍵</b>だけを預け、ログイン時に端末（認証器）が<b>秘密鍵で署名</b>して本人性を示す仕組み。
        パスワードを送受信しないので、フィッシングや漏洩に強いのが特徴です。
      </Callout>

      <div className="flex justify-center">
        <button onClick={() => onNavigate("passkey")} className="btn-primary">
          🔐 実機のパスキーを試す
        </button>
      </div>
    </div>
  );
}
