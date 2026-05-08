import { useLoginForm } from "./hooks/use-login-form";

export function LoginView(): React.JSX.Element {
  const form = useLoginForm();

  return (
    <div className="bg-background flex items-center justify-center min-h-screen p-gutter antialiased">
      <main className="w-full max-w-[440px] bg-surface-container-lowest rounded-lg border border-outline-variant shadow-[0px_4px_20px_rgba(0,33,39,0.08)] overflow-hidden">
        <div className="p-xl flex flex-col gap-lg">
          <div className="flex flex-col items-center text-center gap-sm">
            <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center text-on-primary mb-xs">
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_stories
              </span>
            </div>
            <h1 className="text-headline-md font-headline-md text-on-background m-0">Scholastic AI</h1>
            <p className="text-body-md font-body-md text-on-surface-variant m-0">Sign in to access your digital library.</p>
          </div>

          <form className="flex flex-col gap-md" onSubmit={form.handleSubmit} noValidate>
            <div className="flex flex-col gap-xs">
              <label className="text-label-caps font-label-caps text-on-surface" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  ref={form.emailRef}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-sm pr-sm pl-xl text-body-md font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition-all"
                  id="email"
                  name="email"
                  placeholder="name@institution.edu"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => form.setEmail(e.target.value)}
                  aria-invalid={form.fieldErrors.email ? "true" : undefined}
                  aria-describedby={form.fieldErrors.email ? "email-error" : undefined}
                />
              </div>
              {form.fieldErrors.email ? (
                <p id="email-error" className="text-body-sm font-body-sm text-error m-0">
                  {form.fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-xs">
              <div className="flex justify-between items-baseline">
                <label className="text-label-caps font-label-caps text-on-surface" htmlFor="password">
                  Password
                </label>
                <a
                  className="text-body-sm font-body-sm text-secondary font-semibold hover:text-primary transition-colors"
                  href="#"
                  aria-disabled="true"
                  tabIndex={-1}
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  ref={form.passwordRef}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-sm pr-sm pl-xl text-body-md font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 transition-all"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => form.setPassword(e.target.value)}
                  aria-invalid={form.fieldErrors.password ? "true" : undefined}
                  aria-describedby={form.fieldErrors.password ? "password-error" : undefined}
                />
              </div>
              {form.fieldErrors.password ? (
                <p id="password-error" className="text-body-sm font-body-sm text-error m-0">
                  {form.fieldErrors.password}
                </p>
              ) : null}
            </div>

            {form.submitError ? (
              <div role="alert" className="text-body-sm font-body-sm text-error">
                {form.submitError}
              </div>
            ) : null}

            <div className="pt-base">
              <button
                className="w-full bg-primary text-on-primary text-title-sm font-title-sm rounded-lg py-sm px-md hover:bg-on-primary-fixed-variant transition-colors flex items-center justify-center gap-xs shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                disabled={form.isSubmitting}
                aria-busy={form.isSubmitting}
              >
                {form.isSubmitting ? "Signing in…" : "Sign In"}
                {form.isSubmitting ? null : <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
              </button>
            </div>
          </form>

          <div className="text-center text-body-sm font-body-sm text-on-surface-variant pt-base border-t border-outline-variant/30">
            Don&apos;t have an account?{" "}
            <a className="text-primary font-semibold hover:text-secondary transition-colors" href="#" aria-disabled="true" tabIndex={-1}>
              Request Access
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
