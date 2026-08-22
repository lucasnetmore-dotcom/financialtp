# 🌳 Finance Flow AI — Ecosystem Root

> **Master architecture / Root node**
>
> Este documento é o ponto de origem do ecossistema de negócios. O Finance Flow AI é o **primeiro produto/ramo** da árvore. Novos produtos devem ser adicionados como ramos independentes e, quando fizer sentido, conectados através de identidade, clientes, pagamentos, automações e dados partilhados.

---

## 🌱 ROOT — ECOSSISTEMA

```text
                         ┌──────────────────────────┐
                         │     ECOSSISTEMA ROOT     │
                         │      BUSINESS OS         │
                         └────────────┬─────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 │                    │                    │
                 ▼                    ▼                    ▼
        ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
        │ FINANCE FLOW   │   │    FUTURO 01   │   │    FUTURO 02   │
        │      AI        │   │    [PENDENTE]  │   │    [PENDENTE]  │
        │   🟢 ATIVO     │   │      ⚪        │   │      ⚪        │
        └───────┬────────┘   └────────────────┘   └────────────────┘
                │
        ┌───────┼────────┬──────────┬───────────┐
        ▼       ▼        ▼          ▼           ▼
      💰      👥       📅         📊          🔔
   FINANCEIRO  CRM    AGENDA    RELATÓRIOS   AUTOMAÇÕES
```

---

# 01 — 🌳 PRINCÍPIOS DO ECOSSISTEMA

### Uma identidade

O objetivo futuro é que uma pessoa/empresa possa utilizar vários produtos sem criar contas duplicadas.

```text
                    IDENTIDADE ÚNICA
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
      Produto A       Produto B       Produto C
```

### Uma base de relacionamento

Clientes, empresas, equipas e permissões devem poder ser relacionados entre produtos sem duplicação desnecessária.

### Produtos independentes, ecossistema conectado

Cada produto deve continuar funcional sozinho. A conexão acontece através de contratos/APIs/módulos partilhados, e não através de código fortemente acoplado.

### Segurança primeiro

- isolamento por utilizador/organização;
- permissões explícitas;
- dados sensíveis minimizados;
- auditoria;
- RGPD;
- secrets apenas no ambiente seguro;
- pagamentos validados no servidor;
- webhooks autenticados.

---

# 02 — 🟢 RAMO 01: FINANCE FLOW AI

**Estado:** ATIVO

**Função:** núcleo financeiro + CRM + agenda para pequenos negócios.

```text
FINANCE FLOW AI
│
├── 💰 Financeiro
│   ├── Lançamentos
│   ├── Receitas
│   ├── Despesas
│   ├── Caixa
│   └── Relatórios
│
├── 👥 CRM
│   ├── Clientes
│   ├── Perfis
│   ├── Histórico
│   └── Valor gasto
│
├── 📅 Agenda
│   ├── Dia
│   ├── Semana
│   ├── Mês
│   ├── Marcações
│   └── Serviços
│
├── 💳 Billing
│   ├── Free
│   ├── Pro
│   └── Business
│
└── 🔐 Conta / Segurança
    ├── Autenticação
    ├── Consentimento legal
    ├── RGPD
    └── Eliminação de conta
```

---

# 03 — 🔗 CAMADAS DE CONEXÃO FUTURAS

Estas são as “raízes” que poderão ligar todos os produtos.

| Camada | Função | Estado |
|---|---|---|
| Identity | Login único / utilizador | 🟢 Base existente |
| Organization | Empresa, equipa e permissões | 🟡 Futuro |
| Customers | Cliente partilhado entre produtos | 🟡 Futuro |
| Billing | Subscrições e pagamentos | 🟢 Stripe existente |
| Notifications | E-mail / SMS / WhatsApp | 🟡 Futuro |
| Automation | Eventos e workflows | 🟡 Futuro |
| Analytics | Métricas cross-product | 🟡 Futuro |
| API | Comunicação entre produtos | 🟡 Futuro |
| Audit | Histórico de ações | 🟡 Em evolução |

---

# 04 — 🌿 COMO ADICIONAR UM NOVO RAMO

Quando surgir um novo negócio/produto, **não alterar o Finance Flow AI para o transformar numa aplicação gigante**.

Criar um novo ramo:

```text
ECOSSISTEMA ROOT
│
├── Finance Flow AI          🟢
├── [Novo Produto]           ⚪
├── [Novo Produto]           ⚪
└── [Novo Produto]           ⚪
```

Cada novo ramo deve definir:

1. Nome do produto
2. Problema que resolve
3. Público-alvo
4. Modelo de negócio
5. Dados próprios
6. Dados partilhados
7. Integrações
8. Dependências do ecossistema
9. Permissões necessárias
10. Eventos que publica/consome

---

# 05 — 🧩 CONTRATO DE CONEXÃO

Um futuro produto pode ligar-se ao ecossistema através de eventos como:

```text
user.created
organization.created
customer.created
customer.updated
appointment.created
appointment.completed
payment.created
payment.failed
subscription.created
subscription.changed
subscription.cancelled
```

Exemplo futuro:

```text
AGENDA
  │
  │ appointment.completed
  ▼
FINANCE FLOW
  │
  │ payment.created
  ▼
ANALYTICS
  │
  ▼
DASHBOARD DO ECOSSISTEMA
```

---

# 06 — 🏗️ VISÃO DE LONGO PRAZO

```text
                         ECOSSISTEMA
                              │
              ┌───────────────┼────────────────┐
              │               │                │
              ▼               ▼                ▼
        FINANCE FLOW      PRODUTO 02       PRODUTO 03
              │               │                │
       ┌──────┼──────┐        │                │
       ▼      ▼      ▼        ▼                ▼
     CRM    AGENDA  FINANCE  ...              ...
       │      │      │
       └──────┼──────┘
              ▼
       IDENTITY / USERS
              │
       ORGANIZATIONS
              │
          BILLING
              │
       NOTIFICATIONS
              │
          AUTOMATION
```

---

# 07 — 📌 REGRA DE OURO

> **O Finance Flow AI é o primeiro ramo, não o tronco inteiro.**

O tronco futuro deve ser uma camada de ecossistema: identidade, organizações, permissões, billing, clientes, eventos e integrações.

Os produtos ficam nos ramos.

Isso permite crescer sem transformar uma única aplicação num monólito impossível de manter.

---

# 08 — 🗺️ ROADMAP DA ÁRVORE

### Fase 1 — Raiz
- [x] Finance Flow AI
- [x] Autenticação
- [x] Billing
- [x] CRM
- [x] Agenda
- [x] Legal / consentimento

### Fase 2 — Tronco
- [ ] Organização / empresa
- [ ] Equipa e permissões
- [ ] Identity central
- [ ] Customer ID global
- [ ] Event bus / webhooks internos
- [ ] API do ecossistema

### Fase 3 — Ramos
- [ ] Produto 02
- [ ] Produto 03
- [ ] Produto 04

### Fase 4 — Conexões
- [ ] Cross-product dashboard
- [ ] Dados partilhados
- [ ] Automações entre produtos
- [ ] Billing centralizado
- [ ] Marketplace/ecossistema

---

## 📁 Organização recomendada futura

```text
/docs
  /ecosystem
    ECOSYSTEM-ROOT.md
    PRODUCT-REGISTRY.md
    CONNECTIONS.md
    EVENTS.md

/src
  /core
    identity
    organizations
    permissions
    billing
    events

  /products
    /finance-flow
    /product-02
    /product-03
```

**Importante:** esta estrutura é um mapa arquitetural. Não significa que devemos mover o código atual para estes diretórios agora. A separação física deve acontecer apenas quando houver necessidade real.
