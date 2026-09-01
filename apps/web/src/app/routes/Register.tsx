import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { AuthLayout } from "../auth/AuthLayout";
import { SsoButtons } from "../auth/SsoButtons";
import { registerSchema, type RegisterInput } from "../auth/schemas";
import { useAuthStore, useIsAuthenticated } from "../auth/store";
import { ApiError, authApi } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { Alert, Button, Divider, Field } from "../ui";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get("error");
  const setSession = useAuthStore((s) => s.setSession);
  const authenticated = useIsAuthenticated();
  const [formError, setFormError] = useState<string | null>(null);

  const displayError = formError || urlError;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    try {
      const { token, user } = await authApi.register(email, password, name);
      setSession(token, user);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  });

  return (
    <AuthLayout title="Create account" subtitle="Start using go-CRM">
      <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
        {displayError && <Alert>{displayError}</Alert>}
        <Field
          label="Full Name"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          error={errors.name?.message}
          {...register("name")}
        />
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

      <p className="mt-lg text-center text-sm text-fg-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent hover:text-accent-on">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
