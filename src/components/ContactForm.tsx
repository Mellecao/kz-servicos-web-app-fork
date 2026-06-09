"use client";

import { useState } from "react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section id="contato" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-heading font-black text-[#0F172A] mb-4">
            Entre em Contato
          </h2>
          <p className="text-[#64748B] text-lg">
            Tem alguma dúvida? Envie uma mensagem e responderemos em breve.
          </p>
        </div>

        <div className="max-w-xl mx-auto">
          {submitted ? (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-8 text-center">
              <div className="w-12 h-12 bg-[#22C55E] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="font-heading font-bold text-lg text-[#0F172A] mb-2">
                Mensagem enviada!
              </h3>
              <p className="text-[#64748B] text-sm">
                Obrigado pelo contato. Retornaremos em breve.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#334155] mb-1.5">
                  Nome
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#FEBF22] focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#334155] mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#FEBF22] focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-[#334155] mb-1.5">
                  Telefone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#FEBF22] focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-[#334155] mb-1.5">
                  Mensagem
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Como podemos ajudá-lo?"
                  className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#FEBF22] focus:border-transparent transition-all duration-200 text-sm resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#FEBF22] text-[#0F172A] py-3.5 rounded-lg font-heading font-bold text-sm hover:bg-[#e5ab1e] transition-colors duration-200 cursor-pointer"
              >
                Enviar Mensagem
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
