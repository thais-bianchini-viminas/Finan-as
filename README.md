# Finanças do Casal

App (PWA instalável no celular) + bot do Telegram para lançar despesas e receitas, separar custos fixos de gastos variáveis e acompanhar metas por categoria.

## Uso no dia a dia

**App:** abra a URL no celular e instale (Android: botão *Instalar*; iPhone: Safari → Compartilhar → *Adicionar à Tela de Início*). Pressionar o ícone dá atalhos para lançar despesa, receita ou abrir as metas.

| Aba | O que faz |
| --- | --- |
| Resumo | Saldo do mês no cabeçalho, Despesas/Receitas, rosca por categoria, destaques, metas, custos fixos x variáveis, regra 50/30/20, ritmo e histórico |
| Lançamentos | Tudo / Despesas / Receitas, filtro por categoria, toque para editar, trocar categoria, marcar como fixo ou excluir |
| **+** | Lançar despesa ou receita; categoria e fixo/variável sugeridos pelo histórico |
| Metas | Gerar pelo histórico de 3 meses (custos fixos marcáveis + média do variável), ajustar e salvar |
| Ajustes | Ativar notificações no aparelho, instalar o app, comandos do bot, sair |

**Telegram**

```
Mercado 230,50          → despesa (categoria e fixo/variável automáticos, botões para corrigir)
Uber 18 #lazer          → força a categoria
+5000 salário           → receita (também: "recebi 800 freela")
gerar metas             → metas do mês pelo histórico
metas | meta lazer 300 | copiar metas
resumo | painel | gastos | app | ajuda
```

O classificador aprende: toda correção feita pelos botões do bot ou no app passa a valer para lançamentos parecidos.

### Custo fixo x gasto variável
- **Custo fixo:** se repete todo mês (financiamento, aluguel, internet, luz, água, telefone, fatura, assinaturas). Entra automaticamente na geração de metas, e cada item pode ser desmarcado no mês em que não acontece.
- **Gasto variável:** consumo do dia a dia. Nas metas entra pela média dos últimos 3 meses.

## Configuração

Variáveis em `.env.example`. Depois de definir no Vercel, rode uma vez:

```bash
npm run setup-bot   # registra webhook com segredo + menu de comandos
```

## Desenvolvimento

```bash
npm install
npm run dev
```

> `npm run build` executa `prisma db push` no banco configurado em `DATABASE_URL`.
