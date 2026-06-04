import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Intro from "./sections/Intro";
import EncryptDecryptLab from "./sections/EncryptDecryptLab";
import SignVerifyLab from "./sections/SignVerifyLab";
import PasskeyLab from "./sections/PasskeyLab";

const TABS = [
  { id: "intro", label: "はじめに", icon: "🏠" },
  { id: "encrypt", label: "暗号化/復号", icon: "🔒" },
  { id: "sign", label: "署名/検証", icon: "✍️" },
  { id: "passkey", label: "パスキー体験", icon: "🔐" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function App() {
  const [tab, setTab] = useState<TabId>("intro");

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 pb-16">
      <header className="sticky top-0 z-20 -mx-4 mb-6 border-b border-white/5 bg-[#0b1120]/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setTab("intro")}
            className="flex items-center gap-2 font-bold text-white"
          >
            <span className="text-xl">🔑</span>
            <span>Passkey Lab</span>
          </button>
          <nav className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.id
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span className="mr-1">{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === "intro" && <Intro onNavigate={(id) => setTab(id as TabId)} />}
            {tab === "encrypt" && <EncryptDecryptLab />}
            {tab === "sign" && <SignVerifyLab />}
            {tab === "passkey" && <PasskeyLab />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-12 border-t border-white/5 pt-6 text-center text-xs text-slate-600">
        Passkey Lab — 本物の Web Crypto API / WebAuthn を使った教育用デモ。
        <br />
        暗号処理はすべてブラウザ内で完結し、サーバーへ秘密情報は送りません。
      </footer>
    </div>
  );
}
