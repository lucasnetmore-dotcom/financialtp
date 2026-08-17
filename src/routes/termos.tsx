import { createFileRoute, Link } from "@tanstack/react-router";

import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos | Finance Flow AI" },
      {
        name: "description",
        content: "Termos de utilização do Finance Flow AI.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Voltar
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Termos de utilização</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: agosto de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-display text-base font-semibold text-foreground">1. Serviço</h2>
          <p className="mt-2">
            O Finance Flow AI oferece ferramentas de registo financeiro, sincronização entre
            dispositivos, exportação, alertas e insights calculados a partir dos dados que o
            utilizador introduz. Não substitui aconselhamento contabilístico ou fiscal profissional.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">2. Conta</h2>
          <p className="mt-2">
            É responsável pela confidencialidade da sua conta e pela veracidade dos dados
            introduzidos. Pode eliminar a conta a qualquer momento nas Definições.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">3. Planos e pagamento</h2>
          <p className="mt-2">
            O plano Free tem limites de lançamentos. Os planos Pro (€9,90/mês) e Business (€19,90/mês)
            são cobrados via Stripe em assinatura mensal. Pode cancelar a qualquer momento; o acesso
            pago mantém-se até ao fim do período já pago.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">4. Uso aceitável</h2>
          <p className="mt-2">
            É proibido usar o serviço para atividades ilegais, tentar comprometer a segurança da
            plataforma ou partilhar credenciais de forma abusiva.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">5. Limitação de responsabilidade</h2>
          <p className="mt-2">
            O serviço é prestado "tal como está". Os insights e notificações são orientações
            automáticas e não garantem resultados financeiros. Não respondemos por decisões tomadas
            apenas com base nestas indicações.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">6. Alterações</h2>
          <p className="mt-2">
            Podemos atualizar estes termos; a data no topo da página indica a versão em vigor.
            Continuar a usar o serviço após alterações implica aceitação da nova versão.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-foreground">7. Contacto</h2>
          <p className="mt-2">
            <a className="text-primary underline" href={SUPPORT_MAILTO}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
