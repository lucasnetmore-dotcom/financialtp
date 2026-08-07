# Synced Finances

Quero transformar meu aplicativo em um sistema totalmente sincronizado entre PC e iPhone.

Atualmente tenho uma versão desktop e uma versão mobile, porém quero que ambas utilizem exatamente o mesmo banco de dados e a mesma conta do usuário.

Objetivos:

- Um único login para todos os dispositivos.

- Todos os lançamentos devem ser salvos no Supabase.

- Nunca utilizar Local Storage como banco principal.

- Toda alteração realizada no PC deve aparecer automaticamente no iPhone.

- Toda alteração realizada no iPhone deve aparecer automaticamente no PC.

- Utilizar sincronização em tempo real (Realtime) do Supabase sempre que possível.

- Garantir consistência dos dados mesmo quando dois dispositivos estiverem conectados simultaneamente.

Verifique toda a arquitetura do projeto e faça as alterações necessárias.

Analise:

- Autenticação

- Banco de dados

- Tabelas

- Relacionamentos

- Políticas RLS

- Realtime

- Hooks

- Queries

- Cache

- Estado global

- Persistência

- Offline Sync quando possível

Todos os registros de:

- Receitas

- Despesas

- Contas

- Cartões

- Categorias

- Metas

- Assinaturas

- Parcelamentos

- Configurações

- Perfil

- Caixa

- Histórico

- Relatórios

devem ser sincronizados automaticamente.

Sempre que um registro for criado, alterado ou excluído em qualquer dispositivo, a mudança deve refletir imediatamente nos demais.

Caso alguma tela ainda utilize dados locais, substitua pela comunicação com o Supabase.

Também implemente:

- Loading durante sincronização.

- Indicador "Sincronizado".

- Tratamento de erro.

- Reconexão automática.

- Atualização automática após reconectar a internet.

- Evitar registros duplicados.

- Controle de conflitos caso dois dispositivos alterem o mesmo registro.

Ao finalizar, faça uma auditoria completa para garantir que todos os módulos utilizem o mesmo banco de dados e que o aplicativo funcione perfeitamente tanto no desktop quanto no iPhone.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://financialtp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f215dd6e-4555-481e-9a57-507860f1ab15).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
