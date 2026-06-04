import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** 値（鍵・署名・ハッシュなど）を等幅でラベル付き表示するブロック。 */
export function DataField({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  tone?: "slate" | "sky" | "violet" | "emerald" | "rose";
}) {
  const toneMap: Record<string, string> = {
    slate: "border-white/10",
    sky: "border-sky-400/30 bg-sky-400/5",
    violet: "border-violet-400/30 bg-violet-400/5",
    emerald: "border-emerald-400/30 bg-emerald-400/5",
    rose: "border-rose-400/30 bg-rose-400/5",
  };
  return (
    <div className={`rounded-lg border ${toneMap[tone]} px-3 py-2`}>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mono">{value}</div>
    </div>
  );
}

/** 成功/失敗バッジ。 */
export function ResultBadge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
        ok
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
          : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"
      }`}
    >
      <span className="text-lg">{ok ? "✓" : "✕"}</span>
      {children}
    </motion.div>
  );
}

/** 登場人物（ユーザー / ブラウザ / サーバー / 認証器）を表すカード。 */
export function Actor({
  icon,
  name,
  sub,
  active,
}: {
  icon: string;
  name: string;
  sub?: string;
  active?: boolean;
}) {
  return (
    <motion.div
      animate={{
        scale: active ? 1.05 : 1,
        borderColor: active ? "rgba(56,189,248,0.6)" : "rgba(255,255,255,0.1)",
        boxShadow: active
          ? "0 0 30px rgba(56,189,248,0.35)"
          : "0 0 0px rgba(0,0,0,0)",
      }}
      className="flex min-w-[88px] flex-col items-center gap-1 rounded-xl border bg-white/[0.04] px-3 py-3 text-center"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-slate-100">{name}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </motion.div>
  );
}

/** セクションの見出し。 */
export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
      {children && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{children}</p>}
    </div>
  );
}

/** 注意・補足を表す囲み。 */
export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warn" | "key";
  title: string;
  children: ReactNode;
}) {
  const map = {
    info: { ring: "ring-sky-400/30", bg: "bg-sky-400/5", icon: "💡" },
    warn: { ring: "ring-amber-400/30", bg: "bg-amber-400/5", icon: "⚠️" },
    key: { ring: "ring-violet-400/30", bg: "bg-violet-400/5", icon: "🔑" },
  }[variant];
  return (
    <div className={`rounded-xl ${map.bg} px-4 py-3 ring-1 ${map.ring}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span>{map.icon}</span>
        {title}
      </div>
      <div className="text-sm leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}
