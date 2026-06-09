import Link from "next/link";
import ContactForm from "@/components/ContactForm";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white font-body">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#FEBF22] rounded-lg flex items-center justify-center">
              <span className="text-[#0F172A] font-heading font-black text-lg">K</span>
            </div>
            <span className="font-heading font-black text-xl text-[#0F172A] tracking-tight">
              KZ Serviços
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#recursos" className="text-[#64748B] hover:text-[#0F172A] text-sm font-medium transition-colors duration-200 cursor-pointer">
              Recursos
            </a>
            <a href="#como-funciona" className="text-[#64748B] hover:text-[#0F172A] text-sm font-medium transition-colors duration-200 cursor-pointer">
              Como Funciona
            </a>
            <a href="#depoimentos" className="text-[#64748B] hover:text-[#0F172A] text-sm font-medium transition-colors duration-200 cursor-pointer">
              Depoimentos
            </a>
            <a href="#contato" className="text-[#64748B] hover:text-[#0F172A] text-sm font-medium transition-colors duration-200 cursor-pointer">
              Contato
            </a>
          </nav>
          <Link
            href="/login"
            className="bg-[#FEBF22] text-[#0F172A] px-6 py-2.5 rounded-lg text-sm font-heading font-bold hover:bg-[#e5ab1e] transition-colors duration-200 cursor-pointer"
          >
            Acessar Plataforma
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-white py-24 lg:py-32">
          {/* Decorative elements */}
          <div className="absolute top-20 right-10 w-72 h-72 bg-[#FEBF22]/8 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-[#22C55E]/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-4 h-4 bg-[#FEBF22] rounded-full opacity-40" />
          <div className="absolute top-60 right-1/3 w-2 h-2 bg-[#22C55E] rounded-full opacity-50" />
          <div className="absolute bottom-40 left-1/4 w-3 h-3 bg-[#FEBF22] rounded-full opacity-30" />
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F172A" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          <div className="relative max-w-7xl mx-auto px-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-[#FEBF22]/10 text-[#92700C] px-4 py-1.5 rounded-full text-sm font-medium mb-8">
                <div className="w-2 h-2 bg-[#FEBF22] rounded-full" />
                Plataforma de serviços sob demanda
              </div>
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-heading font-black text-[#0F172A] leading-[1.1]">
                Conectamos você aos{" "}
                <span className="text-[#22C55E]">melhores profissionais</span>{" "}
                da sua região
              </h1>
              <p className="mt-6 text-lg lg:text-xl text-[#334155] leading-relaxed max-w-2xl">
                Transporte executivo, transfers, serviços residenciais e muito mais.
                Agende, acompanhe em tempo real e pague com flexibilidade — tudo em
                uma única plataforma.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="bg-[#FEBF22] text-[#0F172A] px-8 py-3.5 rounded-lg font-heading font-bold text-sm hover:bg-[#e5ab1e] transition-colors duration-200 cursor-pointer shadow-sm"
                >
                  Começar Agora
                </Link>
                <a
                  href="#recursos"
                  className="border border-[#E2E8F0] text-[#334155] px-8 py-3.5 rounded-lg text-sm font-medium hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all duration-200 cursor-pointer"
                >
                  Saiba Mais
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features/Services */}
        <section id="recursos" className="py-20 lg:py-24 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-heading font-black text-[#0F172A] mb-4">
                Nossos Serviços
              </h2>
              <p className="text-[#64748B] text-lg max-w-2xl mx-auto">
                Uma plataforma completa para gerenciar transporte e serviços com
                eficiência, segurança e praticidade.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Transporte Executivo",
                  description:
                    "Viagens agendadas com motoristas qualificados e veículos confortáveis para o seu dia a dia.",
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 17h2m10 0h2M5 17a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2M5 17v2m14-2v2" />
                      <circle cx="7.5" cy="17" r="0.5" />
                      <circle cx="16.5" cy="17" r="0.5" />
                    </svg>
                  ),
                },
                {
                  title: "Transfer Aeroporto",
                  description:
                    "Serviço de ida e volta para aeroportos com pontualidade garantida e acompanhamento de voo.",
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                    </svg>
                  ),
                },
                {
                  title: "Serviços Residenciais",
                  description:
                    "Diaristas, eletricistas, encanadores e mais. Profissionais verificados para a sua casa.",
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  ),
                },
                {
                  title: "Acompanhamento em Tempo Real",
                  description:
                    "Rastreamento GPS e status ao vivo de todas as suas solicitações e viagens em andamento.",
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  ),
                },
                {
                  title: "Pagamentos Flexíveis",
                  description:
                    "PIX, cartão de crédito, débito ou dinheiro. Escolha a forma de pagamento mais conveniente.",
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  ),
                },
                {
                  title: "Avaliações e Segurança",
                  description:
                    "Profissionais verificados e avaliados pela comunidade. Sua segurança é nossa prioridade.",
                  icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  ),
                },
              ].map((feature) => (
                <article
                  key={feature.title}
                  className="bg-white rounded-xl p-6 border border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-md transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-11 h-11 bg-[#FEBF22]/10 rounded-lg flex items-center justify-center text-[#FEBF22] mb-4 group-hover:bg-[#FEBF22]/20 transition-colors duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="font-heading font-bold text-lg text-[#0F172A] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[#64748B] text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="como-funciona" className="py-20 lg:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-heading font-black text-[#0F172A] mb-4">
                Como Funciona
              </h2>
              <p className="text-[#64748B] text-lg max-w-2xl mx-auto">
                Em poucos passos, você acessa os melhores profissionais da região.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connector line (desktop) */}
              <div className="hidden md:block absolute top-14 left-[20%] right-[20%] h-[2px] bg-[#E2E8F0]" />

              {[
                {
                  step: "01",
                  title: "Cadastre-se",
                  description:
                    "Crie sua conta em poucos minutos. É rápido, simples e gratuito.",
                },
                {
                  step: "02",
                  title: "Solicite",
                  description:
                    "Escolha o serviço desejado e agende no melhor horário para você.",
                },
                {
                  step: "03",
                  title: "Acompanhe",
                  description:
                    "Monitore tudo em tempo real pelo painel ou pelo celular.",
                },
              ].map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="w-14 h-14 bg-[#FEBF22] rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-sm">
                    <span className="font-heading font-black text-[#0F172A] text-sm">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-xl text-[#0F172A] mb-3">
                    {item.title}
                  </h3>
                  <p className="text-[#64748B] text-sm leading-relaxed max-w-xs mx-auto">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats/Social Proof */}
        <section className="py-20 bg-[#0F172A] relative overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="stats-dots" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#stats-dots)" />
            </svg>
          </div>
          <div className="relative max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "500+", label: "Viagens" },
                { value: "200+", label: "Profissionais" },
                { value: "98%", label: "Satisfação" },
                { value: "4.9", label: "Avaliação" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-4xl lg:text-5xl font-heading font-black text-[#FEBF22]">
                    {stat.value}
                  </p>
                  <p className="text-sm text-[#94A3B8] mt-2 font-medium">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="depoimentos" className="py-20 lg:py-24 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-heading font-black text-[#0F172A] mb-4">
                O que nossos clientes dizem
              </h2>
              <p className="text-[#64748B] text-lg max-w-2xl mx-auto">
                Veja os depoimentos de quem já utiliza a plataforma KZ Serviços.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  quote:
                    "O serviço de transporte executivo é impecável. Motoristas pontuais, veículos limpos e um atendimento diferenciado. Uso toda semana para ir ao aeroporto.",
                  name: "Marcela Oliveira",
                  role: "Cliente desde 2024",
                },
                {
                  quote:
                    "Encontrei eletricistas e encanadores de confiança pela plataforma. O acompanhamento em tempo real me dá muita tranquilidade. Recomendo demais!",
                  name: "Rafael Mendes",
                  role: "Cliente desde 2025",
                },
                {
                  quote:
                    "A praticidade de agendar tudo pelo celular e acompanhar o status em tempo real mudou minha rotina. A equipe KZ é muito atenciosa e profissional.",
                  name: "Camila Santos",
                  role: "Cliente desde 2024",
                },
              ].map((testimonial) => (
                <figure
                  key={testimonial.name}
                  className="bg-white rounded-xl p-6 border border-[#E2E8F0] hover:shadow-md transition-shadow duration-300"
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="#FEBF22"
                        stroke="#FEBF22"
                        strokeWidth="1"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <blockquote className="text-[#334155] text-sm leading-relaxed mb-6">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <figcaption className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#FEBF22]/10 rounded-full flex items-center justify-center">
                      <span className="text-[#FEBF22] font-heading font-bold text-sm">
                        {testimonial.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-sm text-[#0F172A]">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {testimonial.role}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form */}
        <ContactForm />
      </main>

      {/* Footer */}
      <footer className="bg-[#F8FAFC] py-10 border-t border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#FEBF22] rounded-lg flex items-center justify-center">
                <span className="text-[#0F172A] font-heading font-black text-sm">K</span>
              </div>
              <span className="text-[#64748B] text-sm">
                © 2026 KZ Serviços. Todos os direitos reservados.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-[#64748B] hover:text-[#0F172A] text-sm transition-colors duration-200 cursor-pointer">
                Termos de Uso
              </a>
              <a href="#" className="text-[#64748B] hover:text-[#0F172A] text-sm transition-colors duration-200 cursor-pointer">
                Política de Privacidade
              </a>
            </div>
            <div className="flex items-center gap-4">
              {/* Instagram */}
              <a href="#" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-200 cursor-pointer" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a href="#" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-200 cursor-pointer" aria-label="LinkedIn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              {/* WhatsApp */}
              <a href="#" className="text-[#64748B] hover:text-[#0F172A] transition-colors duration-200 cursor-pointer" aria-label="WhatsApp">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
