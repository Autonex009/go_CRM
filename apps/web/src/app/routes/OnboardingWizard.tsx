import { useState } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Sparkles, Shield, Terminal, ArrowRight, X } from "lucide-react";
import { orgApi } from "../org/api";

interface OnboardingWizardProps {
  role: string;
  userName?: string | null;
  onClose: () => void;
}

export function OnboardingWizard({ role, userName, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const isEngineer = role === "engineer";
  const totalSteps = 3;

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await orgApi.completeOnboarding();
    } catch (e) {
      // Non-blocking: fail quietly so user isn't stuck
      console.warn("Could not save onboarding status", e);
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  const displayName = userName ? userName.split(" ")[0] : "there";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Glow Header */}
        <div
          className={`h-28 w-full bg-gradient-to-r p-6 relative overflow-hidden flex items-end ${
            isEngineer
              ? "from-emerald-600 via-teal-600 to-cyan-700"
              : "from-purple-600 via-indigo-600 to-blue-700"
          }`}
        >
          <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/20 blur-2xl" />

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleFinish}
            className="absolute top-4 right-4 text-white/70 hover:text-white rounded-full p-1 bg-black/20 hover:bg-black/40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-inner">
              {isEngineer ? <Terminal className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-xs">
                <Sparkles className="h-3 w-3 text-amber-300" />
                <span>{isEngineer ? "Engineer Onboarding" : "Manager Onboarding"}</span>
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Welcome, {displayName}!
              </h2>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Step Indicators */}
          <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
              Step {step} of {totalSteps}
            </span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? isEngineer
                        ? "w-8 bg-emerald-500"
                        : "w-8 bg-purple-500"
                      : s < step
                      ? "w-3 bg-fg-muted/60"
                      : "w-3 bg-line"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Engineer Steps */}
          {isEngineer && (
            <>
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-fg">Your Shielded Engineering Workspace</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">
                    DealBridge provides engineers with a focused workspace without commercial noise or sales distractions.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Role-Scoped Task View</div>
                        <div className="text-[11px] text-fg-muted">
                          You only see implementation asks and sub-tasks specifically assigned to you.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-teal-500/10 p-2 text-teal-600 dark:text-teal-400">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Commercial Shielding</div>
                        <div className="text-[11px] text-fg-muted">
                          Deal valuations, invoicing, and customer billing data are hidden so you can focus strictly on technical delivery.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-fg">Execution & Kanban Boards</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">
                    Update your work in real-time so your team and leadership stay in sync.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                        <Terminal className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Kanban Progression</div>
                        <div className="text-[11px] text-fg-muted">
                          Drag and drop or update tasks from Requested → In Progress → Delivered.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Blocker Notifications</div>
                        <div className="text-[11px] text-fg-muted">
                          Flag blockers directly on asks to alert your manager instantly for rapid resolution.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-center py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-fg">You&apos;re All Set!</h3>
                    <p className="text-xs text-fg-muted max-w-sm mx-auto mt-1 leading-relaxed">
                      Check your dashboard to view active asks. If you have questions or need new assignments, reach out to your designated manager.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Manager Steps */}
          {!isEngineer && (
            <>
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-fg">Team Leadership & Delivery</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">
                    You manage technical delivery, bridging client requirements with engineer execution.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                        <Shield className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Manager Implementation View</div>
                        <div className="text-[11px] text-fg-muted">
                          View all implementation asks connected to client projects assigned to your engineering team.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                        <Terminal className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Sub-task Delegation</div>
                        <div className="text-[11px] text-fg-muted">
                          Decompose complex delivery tasks into sub-tasks and delegate them to individual engineers.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-fg">Roster & Team Allocation</h3>
                  <p className="text-xs text-fg-muted leading-relaxed">
                    Keep your engineers focused and monitor active workloads effortlessly.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Engineer Allocation Matrix</div>
                        <div className="text-[11px] text-fg-muted">
                          Access &apos;Team Tasks&apos; in the sidebar to review active tasks per engineer and balance workload.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-muted/50 p-3.5">
                      <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-fg">Team Hierarchy</div>
                        <div className="text-[11px] text-fg-muted">
                          Visit &apos;Team &amp; Settings&apos; → &apos;Team Structure&apos; to view and assign reporting engineers.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 text-center py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-fg">Ready to Lead!</h3>
                    <p className="text-xs text-fg-muted max-w-sm mx-auto mt-1 leading-relaxed">
                      You are now equipped to manage tasks, delegate to your engineering roster, and deliver high-impact results.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-fg-muted hover:text-fg hover:bg-surface-muted transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="text-xs font-medium text-fg-subtle hover:text-fg transition-colors"
              >
                Skip Tour
              </button>
            )}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition-all ${
                  isEngineer
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-purple-600 hover:bg-purple-500"
                }`}
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 ${
                  isEngineer
                    ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                    : "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"
                }`}
              >
                <span>Got it, let&apos;s go!</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
