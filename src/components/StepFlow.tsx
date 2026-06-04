import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export interface FlowStep {
  id: string;
  /** 主体（誰の処理か）: 表示用ラベル。 */
  actor: string;
  title: string;
  description: ReactNode;
  /** そのステップで生まれるデータの可視化（任意）。 */
  detail?: ReactNode;
}

/**
 * 縦型のアニメーション付きステップ表示。
 * current が進むと、完了/実行中/未実行が色とモーションで分かる。
 */
export function StepFlow({
  steps,
  current,
}: {
  steps: FlowStep[];
  current: number;
}) {
  return (
    <ol className="relative space-y-3">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <motion.li
            key={step.id}
            initial={false}
            animate={{
              opacity: state === "todo" ? 0.45 : 1,
            }}
            className="relative flex gap-3"
          >
            {/* 縦線 */}
            {i < steps.length - 1 && (
              <span
                className={`absolute left-[15px] top-9 h-[calc(100%-12px)] w-px ${
                  i < current ? "bg-sky-400/50" : "bg-white/10"
                }`}
              />
            )}
            {/* 番号バッジ */}
            <motion.span
              animate={{
                scale: state === "active" ? [1, 1.18, 1] : 1,
                backgroundColor:
                  state === "done"
                    ? "rgba(16,185,129,0.9)"
                    : state === "active"
                      ? "rgba(56,189,248,0.95)"
                      : "rgba(148,163,184,0.18)",
              }}
              transition={{
                scale: { repeat: state === "active" ? Infinity : 0, duration: 1.6 },
              }}
              className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            >
              {state === "done" ? "✓" : i + 1}
            </motion.span>

            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">{step.actor}</span>
                <span className="text-sm font-semibold text-slate-100">{step.title}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.description}</p>
              <AnimatePresence>
                {state !== "todo" && step.detail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 overflow-hidden"
                  >
                    {step.detail}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/** 鍵やデータが「移動する」様子を表す矢印アニメーション。 */
export function FlowArrow({ active, label }: { active: boolean; label?: string }) {
  return (
    <div className="relative flex flex-1 items-center">
      <div className="h-px w-full bg-white/15" />
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ left: "0%", opacity: 0 }}
            animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            className="absolute -top-2 text-lg"
          >
            ✉️
          </motion.div>
        )}
      </AnimatePresence>
      {label && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
}
