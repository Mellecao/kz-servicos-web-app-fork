"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, resetPassword } from "@/lib/api";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao fazer login";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await resetPassword(forgotEmail);
      setSuccess("Instruções de recuperação enviadas para o seu e-mail.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao enviar e-mail";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const inputClasses =
    "w-full px-4 py-3 rounded-lg border border-border bg-background text-dark placeholder:text-contrast/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-body";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Branding Panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Decorative shapes */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10" />
          <div className="absolute top-1/4 right-0 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute bottom-10 left-10 w-64 h-64 rounded-full bg-white/[0.07]" />
          <div className="absolute top-1/2 left-1/3 w-32 h-32 rotate-45 rounded-2xl bg-white/5" />
          <div className="absolute bottom-1/3 right-1/4 w-24 h-24 rounded-full bg-white/10" />
        </div>

        <div className="relative z-10 max-w-md text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <span className="font-heading font-black text-3xl text-white">K</span>
            </div>
            <span className="font-heading font-black text-4xl text-white tracking-tight">
              KZ Serviços
            </span>
          </div>

          <p className="text-white/80 text-lg font-body leading-relaxed mb-12">
            Gerencie motoristas, viagens e serviços em uma plataforma completa e intuitiva.
          </p>

          {/* Trust indicators */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3.5">
              <div className="text-white">
                <ShieldIcon />
              </div>
              <span className="text-white font-body font-medium text-sm">Plataforma segura e confiável</span>
            </div>
            <div className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3.5">
              <div className="text-white">
                <LockIcon />
              </div>
              <span className="text-white font-body font-medium text-sm">Dados protegidos com criptografia</span>
            </div>
            <div className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3.5">
              <div className="text-white">
                <CheckCircleIcon />
              </div>
              <span className="text-white font-body font-medium text-sm">Disponível 24 horas, 7 dias por semana</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo — visible only on mobile */}
          <div className="lg:hidden text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-heading font-black text-xl">K</span>
              </div>
              <span className="font-heading font-black text-2xl text-dark tracking-tight">
                KZ Serviços
              </span>
            </Link>
          </div>

          {/* Form Card */}
          <div className="bg-surface rounded-2xl border border-border p-8 sm:p-10 shadow-sm">
            {!showForgotPassword ? (
              <>
                <h1 className="text-2xl font-heading font-black text-dark mb-1">
                  Bem-vindo de volta
                </h1>
                <p className="text-sm text-contrast font-body mb-8">
                  Acesse sua conta para gerenciar a plataforma
                </p>

                {error && (
                  <div className="mb-6 p-3.5 rounded-lg bg-danger/10 text-danger text-sm font-body flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-dark font-body mb-1.5"
                    >
                      E-mail
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className={inputClasses}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-dark font-body mb-1.5"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className={`${inputClasses} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-contrast hover:text-dark cursor-pointer duration-200"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-sm text-contrast font-body">Lembrar de mim</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-background py-3.5 rounded-lg font-heading font-bold text-sm hover:brightness-110 transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/25"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Entrando...
                      </span>
                    ) : (
                      "Entrar"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError("");
                    }}
                    className="text-sm text-accent hover:text-accent/80 font-body font-medium transition-colors duration-200 cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-heading font-black text-dark mb-1">
                  Recuperar Senha
                </h1>
                <p className="text-sm text-contrast font-body mb-8">
                  Informe seu e-mail para receber as instruções de recuperação
                </p>

                {error && (
                  <div className="mb-6 p-3.5 rounded-lg bg-danger/10 text-danger text-sm font-body flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mt-0.5 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-3.5 rounded-lg bg-success/10 text-success text-sm font-body flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mt-0.5 shrink-0">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="m9 11 3 3L22 4" />
                    </svg>
                    {success}
                  </div>
                )}

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="block text-sm font-medium text-dark font-body mb-1.5"
                    >
                      E-mail
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className={inputClasses}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-background py-3.5 rounded-lg font-heading font-bold text-sm hover:brightness-110 transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-primary/25"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Enviando...
                      </span>
                    ) : (
                      "Enviar Instruções"
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setError("");
                      setSuccess("");
                    }}
                    className="text-sm text-accent hover:text-accent/80 font-body font-medium transition-colors duration-200 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    Voltar para o login
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-contrast/60 font-body mt-8">
            © {new Date().getFullYear()} KZ Serviços. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
