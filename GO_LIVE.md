# Finance Flow AI — Checklist GO LIVE

O código da app já cobre checkout, ativação de plano (via Stripe), portal de cancelamento, landing, termos e privacidade.

Os passos abaixo **só tu** podes fazer nos dashboards (não dá para automatizar sem as tuas keys).

---

## 1. Vercel — variáveis de ambiente (Production)

| Variável | Obrigatória | Onde obter |
|----------|-------------|------------|
| `VITE_SUPABASE_URL` | Sim | Supabase → Settings → API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Sim | Supabase → API (publishable / anon) |
| `STRIPE_SECRET_KEY` | Sim | Stripe → **Live** `sk_live_...` |
| `STRIPE_PRICE_PRO` | Sim | Stripe → Products → Price ID Pro |
| `STRIPE_PRICE_BUSINESS` | Sim | Stripe → Products → Price ID Business |
| `STRIPE_WEBHOOK_SECRET` | Recomendado | Stripe → Webhooks → `whsec_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Recomendado | Supabase → API → `service_role` (nunca no browser) |

Depois de alterar: **Redeploy** no Vercel.

---

## 2. Stripe — produção

1. Ativar conta Stripe (dados de negócio + IBAN).
2. Criar produtos **Pro** (€9,90/mês) e **Business** (€19,90/mês) em modo **Live**.
3. Copiar os Price IDs para o Vercel.
4. **Customer Portal**: Settings → Billing → Customer portal → ativar (cancelar, fatura, cartão).
5. **Webhook** (Live):
   - URL: `https://financialtp.vercel.app/api/public/stripe-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Colar `whsec_...` em `STRIPE_WEBHOOK_SECRET`

---

## 3. Supabase

1. Authentication → URL Configuration:
   - Site URL: `https://financialtp.vercel.app`
   - Redirect URLs: `https://financialtp.vercel.app/**`
2. (Opcional) Google / Apple: Authentication → Providers → secrets + Client ID.
3. (Recomendado) Colar `service_role` no Vercel como `SUPABASE_SERVICE_ROLE_KEY` para gravar o plano na tabela `profiles`.

---

## 4. Teste final (15 min)

- [ ] Registo e login com e-mail
- [ ] Criar 1 lançamento no PC e ver no telemóvel
- [ ] Upgrade Pro com cartão **live** (valor real pequeno) ou confirmar test→live keys
- [ ] Voltar a /planos → plano correto
- [ ] Botão **Gerir / cancelar** abre o portal Stripe
- [ ] Cancelar e, após sync, plano Free

---

## 5. Venda

- Partilhar link: `https://financialtp.vercel.app`
- Nicho: 10 contactos (cabeleireiros, cafés, freelancers)
- Suporte: e-mail em `suporte@financeflow.ai` (ou o teu e-mail real — atualiza landing/termos se mudares)

---

## O que o código já faz

- Checkout Stripe Pro / Business
- Ativação do plano mesmo com RLS a bloquear `profiles.plan` (fonte de verdade = Stripe + cache local)
- Sincronizar plano / Gerir cancelamento (Customer Portal)
- Landing com preços e FAQ
- Termos e privacidade RGPD-oriented
- Webhook endpoint pronto (`/api/public/stripe-webhook`)
