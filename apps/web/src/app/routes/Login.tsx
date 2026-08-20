import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@go-crm/schemas";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

import { AuthLayout } from "../auth/AuthLayout";
import { SsoButtons } from "../auth/SsoButtons";
import { useAuthStore, useIsAuthenticated } from "../auth/store";
import { ApiError, authApi } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { Divider } from "../ui";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const authenticated = useIsAuthenticated();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const { token, user } = await authApi.login(email, password);
      setSession(token, user);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  });

  return (
    <AuthLayout title="Sign In" subtitle="Welcome back! Please enter your credentials.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Email Input */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-fg-muted">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-fg-subtle" />
            <input
              id="email"
              type="email"
              placeholder="admin@autonex.ai"
              autoComplete="email"
              className={`w-full rounded-xl border bg-surface-muted/50 pl-9 pr-3 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 ${
                errors.email ? "border-rose-500 focus:ring-rose-500/30" : "border-line"
              }`}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs font-semibold text-rose-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-fg-muted">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-fg-subtle" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              className={`w-full rounded-xl border bg-surface-muted/50 pl-9 pr-10 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 ${
                errors.password ? "border-rose-500 focus:ring-rose-500/30" : "border-line"
              }`}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-fg-subtle hover:text-fg transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs font-semibold text-rose-500">{errors.password.message}</p>
          )}
        </div>

        {/* Form Error Alert */}
        {formError && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-500 hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Sign In to Dashboard</span>
          )}
        </button>
      </form>

      <div className="my-6">
        <Divider>or continue with</Divider>
      </div>
      <SsoButtons />

      <p className="mt-6 text-center text-xs text-fg-muted">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

