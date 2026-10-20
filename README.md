# Finanças do Casal

App (PWA instalável no celular) + bot do Telegram para lançar gastos e acompanhar metas por categoria.

## Uso no dia a dia

**App** — abra a URL no celular e instale (Android: botão *Instalar*; iPhone: Safari → Compartilhar → *Adicionar à Tela de Início*). Pressionar o ícone dá atalhos direto para *Lançar* e *Metas*.

| Aba | O que faz |
| --- | --- |
| Resumo | Gasto x planejado, quanto dá para gastar por dia, projeção do mês, metas por categoria, ritmo, histórico |
| Gastos | Lista por dia, filtro por categoria, toque para editar/excluir |
| Lançar | Valor + descrição; categoria sugerida automaticamente; lembra quem lançou |
| Metas | Todas as categorias numa tela, salvar de uma vez, copiar do mês anterior, sugestão pela média de 3 meses |

As setas no topo trocam o mês (inclusive para planejar metas de meses futuros).

**Telegram**

```
Mercado 230,50          → lança (categoria automática, botões para trocar)
Uber 18 #lazer          → força a categoria
Almoço 35               → várias linhas = vários gastos
Uber 22

metas                   → metas do mês e quanto já foi usado
metas                   → define várias de uma vez
alimentação 1500
moradia 2800
meta lazer 0            → remove
copiar metas            → repete as do mês passado
resumo | painel | gastos | app | ajuda
```

O bot avisa quando uma categoria passa de 80% e de 100% da meta.

## Configuração

Variáveis em `.env.example`. Depois de definir no Vercel, rode uma vez:

```bash
npm run setup-bot   # registra webhook com segredo + menu de comandos
```

Para descobrir os chat IDs para `ALLOWED_CHAT_IDS`: com a variável definida, quem não estiver na lista recebe o próprio ID ao mandar mensagem ao bot.

## Desenvolvimento

```bash
npm install
npm run dev
```

> `npm run build` executa `prisma db push` no banco configurado em `DATABASE_URL`.
