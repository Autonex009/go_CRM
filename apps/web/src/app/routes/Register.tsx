import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { AuthLayout } from "../auth/AuthLayout";
import { SsoButtons } from "../auth/SsoButtons";
import { registerSchema, type RegisterInput } from "../auth/schemas";
import { useAuthStore, useIsAuthenticated } from "../auth/store";
import { ApiError, authApi } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { Alert, Button, Divider, Field } from "../ui";

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const authenticated = useIsAuthenticated();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const { token, user } = await authApi.register(email, password);
      setSession(token, user);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  });

  return (
    <AuthLayout title="Create account" subtitle="Start using go-CRM">
      <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" disabled={isSubmitting} className="mt-xs w-full">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="my-lg">
        <Divider>or continue with</Divider>
      </div>
      <SsoButtons />

      <p className="mt-lg text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
