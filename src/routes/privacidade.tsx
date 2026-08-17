import { createFileRoute, Link } from "@tanstack/react-router";

import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade | Finance Flow AI" },
      {
        name: "description",
        content: "Política de privacidade do Finance Flow AI — como tratamos os seus dados pessoais.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: agosto de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-display text-base font-semibold text-foreground">1. Quem somos</h2>
          <p className="mt-2">
            O Finance Flow AI é uma aplicação de gestão financeira sincronizada. O responsável pelo
            tratamento dos dados é o operador da plataforma contactável em{" "}
            <a className="text-primary underline" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">2. Dados que recolhemos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Dados de conta: e-mail e, se usar OAuth, nome/identificador do Google ou Apple.</li>
            <li>
              Dados financeiros que introduzir: lançamentos, categorias, metas, perfil do negócio.
            </li>
            <li>Dados técnicos mínimos: registos de autenticação e sessão necessários à segurança.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">3. Finalidade</h2>
          <p className="mt-2">
            Utilizamos os dados apenas para prestar o serviço (guardar e sincronizar os seus
            lançamentos, gerar insights no dispositivo, processar subscrições e garantir a
            segurança da conta). Não vendemos dados pessoais a terceiros.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">4. Base legal (RGPD)</h2>
          <p className="mt-2">
            Tratamento baseado na execução do contrato (prestação do serviço) e, quando aplicável,
            no consentimento (ex.: notificações do browser). Tem direito de acesso, retificação,
            apagamento, portabilidade e oposição, nos termos do RGPD.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">5. Armazenamento</h2>
          <p className="mt-2">
            Os dados são guardados em infraestrutura Supabase (base de dados e autenticação). Os
            insights são calculados localmente no seu dispositivo a partir dos dados da sua conta.
            Pode apagar a conta e os dados associados nas Definições da aplicação.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">6. Pagamentos</h2>
          <p className="mt-2">
            Subscrições Pro e Business são processadas pelo Stripe. Não armazenamos números de cartão
            no nosso servidor.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">7. Contacto</h2>
          <p className="mt-2">
            Para questões de privacidade:{" "}
            <a className="text-primary underline" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
