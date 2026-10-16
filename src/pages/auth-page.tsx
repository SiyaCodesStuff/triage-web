import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/context';
import { safeDestination } from '@/auth/redirect';
import {
  loginSchema,
  registerSchema,
  type RegisterValues,
} from '@/auth/schemas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const detailSchema = z.array(
  z.object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
  }),
);
const locationStateSchema = z.object({
  from: z.string().optional(),
  reason: z.string().optional(),
});
const formSchema = loginSchema.extend({
  name: registerSchema.shape.name.optional(),
});
type Values = z.infer<typeof formSchema>;

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = locationStateSchema.safeParse(location.state);
  const destination = safeDestination(
    state.success
      ? (state.data.from ??
          new URLSearchParams(location.search).get('returnTo'))
      : new URLSearchParams(location.search).get('returnTo'),
  );
  const isRegister = mode === 'register';
  const title = isRegister ? 'Create an account' : 'Log in';
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(isRegister ? registerSchema : formSchema),
    defaultValues: {
      email: '',
      password: '',
      ...(isRegister ? { name: '' } : {}),
    },
  });

  const serverFocus = useRef<'name' | 'email' | 'password' | null>(null);
  useEffect(() => {
    if (!isSubmitting && serverFocus.current) {
      setFocus(serverFocus.current);
      serverFocus.current = null;
    }
  }, [isSubmitting, setFocus]);

  useEffect(() => {
    document.title = `${title} | Triage`;
  }, [title]);

  const submit = async (values: Values) => {
    clearErrors();
    try {
      if (isRegister)
        await auth.register(
          registerSchema.parse(values) satisfies RegisterValues,
        );
      else await auth.login({ email: values.email, password: values.password });
      navigate(destination, { replace: true });
    } catch (error) {
      const details =
        error instanceof ApiError
          ? detailSchema.safeParse(error.details)
          : null;
      let firstField = true;
      if (details?.success) {
        for (const detail of details.data) {
          const field =
            detail.path[0] === 'body' ? detail.path[1] : detail.path[0];
          if (
            field === 'email' ||
            field === 'password' ||
            (field === 'name' && isRegister)
          ) {
            if (firstField) serverFocus.current = field;
            setError(
              field,
              { type: 'server', message: detail.message },
              { shouldFocus: firstField },
            );
            firstField = false;
          }
        }
      }
      if (!firstField) return;
      if (isRegister && error instanceof ApiError && error.status === 409) {
        serverFocus.current = 'email';
        setError(
          'email',
          { type: 'server', message: error.message },
          { shouldFocus: true },
        );
      } else {
        setError('root.server', {
          message:
            error instanceof ApiError
              ? error.message
              : 'Unable to connect. Please try again.',
        });
      }
    }
  };

  return (
    <section
      className="mx-auto max-w-md space-y-6"
      aria-labelledby="auth-title"
    >
      <div className="space-y-2">
        <h1 id="auth-title" className="text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground">
          {isRegister
            ? 'Join your team and keep support moving.'
            : 'Welcome back to your Triage workspace.'}
        </p>
      </div>
      {state.success && state.data.reason === 'role' && (
        <p role="alert">
          This account does not have access to that page. Log in with another
          account.
        </p>
      )}
      <Card>
        <CardContent>
          <form
            noValidate
            onSubmit={(event) => {
              void handleSubmit(submit)(event);
            }}
            aria-busy={isSubmitting}
          >
            <fieldset
              disabled={isSubmitting || auth.isLoading}
              className="space-y-5"
            >
              <legend className="sr-only">{title}</legend>
              {isRegister && (
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="name"
                    autoComplete="name"
                    maxLength={120}
                    {...register('name')}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                  />
                  {errors.name && (
                    <p
                      id="name-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {errors.name.message}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  {...register('email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p
                    id="email-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    isRegister ? 'new-password' : 'current-password'
                  }
                  minLength={10}
                  maxLength={128}
                  {...register('password')}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password
                      ? 'password-hint password-error'
                      : 'password-hint'
                  }
                />
                <p id="password-hint" className="text-sm text-muted-foreground">
                  Use 10–128 characters.
                </p>
                {errors.password && (
                  <p
                    id="password-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>
              {errors.root?.server && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.root.server.message}
                </p>
              )}
              <Button type="submit" className="w-full">
                {isSubmitting
                  ? isRegister
                    ? 'Creating account…'
                    : 'Logging in…'
                  : title}
              </Button>
            </fieldset>
            {auth.isLoading && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                Checking your session…
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        {isRegister ? 'Already have an account? ' : 'New to Triage? '}
        <Link
          className="font-medium text-foreground underline underline-offset-4"
          to={isRegister ? '/login' : '/register'}
          state={{ from: destination }}
        >
          {isRegister ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </section>
  );
}
