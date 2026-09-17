import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/politica-de-privacidade")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 sm:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
        <p className="eyebrow">Finance Flow AI</p>
        <h1 className="mt-2 text-3xl font-bold">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: 21 de agosto de 2026</p>

        <div className="prose prose-sm mt-8 max-w-none dark:prose-invert">
          <h2>1. Responsável pelo tratamento</h2>
          <p>O Finance Flow AI é o responsável pelo tratamento dos dados pessoais tratados através da plataforma, nos termos aplicáveis do Regulamento Geral sobre a Proteção de Dados (RGPD) e da legislação portuguesa.</p>
          <h2>2. Dados que podemos tratar</h2>
          <p>Dependendo da utilização do serviço, podem ser tratados dados de conta como nome e e-mail, dados de autenticação, dados de clientes introduzidos pelo utilizador, contactos, NIF, notas, marcações, dados financeiros e informação técnica necessária para segurança e funcionamento.</p>
          <h2>3. Finalidades</h2>
          <p>Os dados são utilizados para criar e gerir contas, disponibilizar as funcionalidades contratadas, sincronizar os dados entre dispositivos, gerir clientes e marcações, processar pagamentos, enviar comunicações relacionadas com o serviço, prestar suporte, prevenir abuso e cumprir obrigações legais.</p>
          <h2>4. Fundamentos jurídicos</h2>
          <p>O tratamento pode basear-se na execução do contrato, no cumprimento de obrigações legais, em interesses legítimos e, quando exigido, no consentimento do titular dos dados.</p>
          <h2>5. Dados de clientes do utilizador</h2>
          <p>Quando o utilizador introduz dados de uma cliente ou outro terceiro, o utilizador é responsável por garantir que dispõe de fundamento legal adequado e que prestou as informações exigidas pela legislação aplicável. O Finance Flow AI trata esses dados para disponibilizar a funcionalidade solicitada pelo utilizador.</p>
          <h2>6. Prestadores de serviços</h2>
          <p>Podemos recorrer a fornecedores tecnológicos para alojamento, base de dados, autenticação, pagamentos, envio de e-mails, segurança e infraestrutura. Esses fornecedores apenas devem tratar dados dentro das finalidades e condições aplicáveis aos respetivos serviços.</p>
          <h2>7. Segurança</h2>
          <p>São aplicadas medidas técnicas e organizativas destinadas a proteger os dados contra acesso não autorizado, perda, alteração ou divulgação indevida. Nenhum sistema ligado à Internet pode garantir segurança absoluta.</p>
          <h2>8. Conservação</h2>
          <p>Os dados são conservados pelo período necessário para prestar o serviço, cumprir obrigações legais, resolver litígios e proteger direitos legítimos. Quando deixarem de ser necessários, serão eliminados ou anonimizados quando aplicável.</p>
          <h2>9. Direitos dos titulares</h2>
          <p>Nos termos da lei, o titular pode ter direitos de acesso, retificação, apagamento, limitação, oposição, portabilidade e retirada do consentimento, quando aplicável. Pode também apresentar reclamação junto da autoridade de controlo competente.</p>
          <h2>10. Transferências internacionais</h2>
          <p>Alguns fornecedores tecnológicos podem tratar dados fora do Espaço Económico Europeu. Quando tal aconteça, serão utilizadas as salvaguardas previstas na legislação aplicável.</p>
          <h2>11. Comunicações</h2>
          <p>Podemos enviar mensagens necessárias ao funcionamento da conta, como confirmações de marcações, recuperação de palavra-passe e informações importantes sobre o serviço. Comunicações de marketing serão tratadas de acordo com os requisitos legais aplicáveis.</p>
          <h2>12. Cookies e tecnologias semelhantes</h2>
          <p>A plataforma pode utilizar armazenamento local, cookies ou tecnologias semelhantes para manter sessões, preferências e segurança. Tecnologias que exijam consentimento serão apresentadas de acordo com as regras aplicáveis.</p>
          <h2>13. Alterações</h2>
          <p>Esta Política pode ser atualizada. Quando houver alterações relevantes, poderá ser solicitada nova aceitação antes de continuar a utilizar o serviço.</p>
          <h2>14. Contacto</h2>
          <p>Para exercer direitos ou colocar questões sobre privacidade, utilize os canais de contacto disponibilizados pelo Finance Flow AI.</p>
        </div>

        <div className="mt-8 border-t pt-5">
          <Link to="/auth" search={{ modo: "entrar" }} className="text-sm font-semibold text-primary hover:underline">Voltar para entrar</Link>
        </div>
      </article>
    </main>
  );
}
