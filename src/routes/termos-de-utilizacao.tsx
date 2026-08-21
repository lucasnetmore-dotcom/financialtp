import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos-de-utilizacao")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 sm:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
        <p className="eyebrow">Finance Flow AI</p>
        <h1 className="mt-2 text-3xl font-bold">Termos de Utilização</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: 21 de agosto de 2026</p>

        <div className="prose prose-sm mt-8 max-w-none dark:prose-invert">
          <h2>1. Objeto</h2>
          <p>O Finance Flow AI é uma plataforma de gestão financeira, clientes e agenda destinada a apoiar a organização de negócios e profissionais. A utilização da plataforma pressupõe a aceitação destes Termos.</p>
          <h2>2. Conta e acesso</h2>
          <p>O utilizador é responsável por fornecer dados corretos, manter as suas credenciais seguras e por toda a atividade realizada através da sua conta. Não deve partilhar credenciais nem utilizar a plataforma para fins ilícitos.</p>
          <h2>3. Dados introduzidos pelo utilizador</h2>
          <p>O utilizador mantém a responsabilidade pelos dados que introduz na plataforma, incluindo dados financeiros, dados de clientes, contactos, NIF, notas e marcações. Deve possuir uma base legal adequada para recolher e utilizar dados pessoais de terceiros e cumprir as obrigações que lhe sejam aplicáveis.</p>
          <h2>4. Funcionalidades e disponibilidade</h2>
          <p>As funcionalidades podem ser atualizadas, melhoradas ou alteradas. Procuramos manter o serviço disponível e seguro, mas não garantimos disponibilidade ininterrupta nem ausência absoluta de erros ou interrupções.</p>
          <h2>5. Planos e pagamentos</h2>
          <p>Algumas funcionalidades dependem do plano contratado. Os preços, limites e condições aplicáveis são apresentados no momento da contratação. Os pagamentos podem ser processados por prestadores de serviços de pagamento terceiros, de acordo com os respetivos termos.</p>
          <h2>6. Utilização proibida</h2>
          <p>É proibido utilizar a plataforma para atividades ilegais, fraude, acesso não autorizado, tentativa de comprometer a segurança do serviço, distribuição de código malicioso ou violação dos direitos de terceiros.</p>
          <h2>7. Propriedade intelectual</h2>
          <p>A plataforma, o seu software, identidade visual e conteúdos próprios pertencem aos respetivos titulares e não podem ser copiados, vendidos ou explorados sem autorização.</p>
          <h2>8. Limitação de responsabilidade</h2>
          <p>O Finance Flow AI é uma ferramenta de organização e não substitui aconselhamento contabilístico, fiscal, jurídico ou financeiro profissional. O utilizador deve validar decisões e obrigações legais ou fiscais junto dos profissionais competentes.</p>
          <h2>9. Suspensão ou encerramento</h2>
          <p>Uma conta pode ser suspensa ou encerrada quando exista violação destes Termos, utilização abusiva, risco de segurança ou obrigação legal. O utilizador pode deixar de utilizar o serviço a qualquer momento, sem prejuízo de obrigações já vencidas.</p>
          <h2>10. Alterações aos Termos</h2>
          <p>Estes Termos podem ser atualizados para refletir alterações legais, técnicas ou funcionais. Quando a alteração for relevante, será apresentada ao utilizador uma nova versão para aceitação quando necessário.</p>
          <h2>11. Lei aplicável</h2>
          <p>Sem prejuízo das normas imperativas aplicáveis ao consumidor, estes Termos são regidos pela legislação portuguesa.</p>
          <h2>12. Contacto</h2>
          <p>Para questões relacionadas com os Termos, contacte o responsável pelo Finance Flow AI através dos canais disponibilizados na plataforma.</p>
        </div>

        <div className="mt-8 border-t pt-5">
          <Link to="/auth" className="text-sm font-semibold text-primary hover:underline">Voltar para entrar</Link>
        </div>
      </article>
    </main>
  );
}
