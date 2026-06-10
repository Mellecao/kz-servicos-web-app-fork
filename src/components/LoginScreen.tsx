"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetPassword, signIn } from "@/lib/api";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function LoginScreen() {
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
      setSuccess("Instrucoes de recuperacao enviadas para o seu e-mail.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao enviar e-mail";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const inputClasses =
    "w-full rounded-lg border border-[#334155] bg-[#0F172A] px-4 py-3 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/60 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#FEBF22]";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0F172A] px-5 py-10 text-[#F8FAFC] sm:px-8">
      <Image
        src="/assets/logo.png"
        alt="KZ Servicos"
        width={890}
        height={494}
        priority
        className="absolute right-5 top-5 h-10 w-auto object-contain sm:right-8 sm:top-8 sm:h-12"
      />

      <section className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image
            src="/assets/logo.png"
            alt="KZ Servicos"
            width={890}
            height={494}
            priority
            className="h-20 w-auto object-contain sm:h-24"
          />
        </div>

        <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-7 shadow-2xl shadow-black/25 sm:p-9">
          {!showForgotPassword ? (
            <>
              <h1 className="mb-1 text-2xl font-black text-[#F8FAFC]">
                Painel ADM
              </h1>
              <p className="mb-8 text-sm text-[#94A3B8]">
                Acesse sua conta para gerenciar a plataforma
              </p>

              {error && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-danger/10 p-3.5 text-sm text-danger">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#F8FAFC]">
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
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#F8FAFC]">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      required
                      className={`${inputClasses} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#94A3B8] transition-colors duration-200 hover:text-[#F8FAFC]"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-[#334155] text-primary focus:ring-primary focus:ring-offset-0"
                  />
                  <span className="text-sm text-[#94A3B8]">Lembrar de mim</span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full cursor-pointer rounded-lg bg-primary py-3.5 text-sm font-bold text-[#0F172A] shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError("");
                  }}
                  className="cursor-pointer text-sm font-medium text-primary transition-colors duration-200 hover:text-primary-dark"
                >
                  Esqueci minha senha
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-black text-[#F8FAFC]">
                Recuperar senha
              </h1>
              <p className="mb-8 text-sm text-[#94A3B8]">
                Informe seu e-mail para receber as instrucoes de recuperacao
              </p>

              {error && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-danger/10 p-3.5 text-sm text-danger">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-6 flex items-start gap-2 rounded-lg bg-success/10 p-3.5 text-sm text-success">
                  {success}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-[#F8FAFC]">
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
                  className="w-full cursor-pointer rounded-lg bg-primary py-3.5 text-sm font-bold text-[#0F172A] shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar instrucoes"}
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
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-200 hover:text-primary-dark"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  Voltar para o login
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
