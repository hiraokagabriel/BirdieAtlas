---
name: BirdieAtlas
description: Gestão de campeonatos de badminton com a clareza de uma súmula oficial.
colors:
  court-green: "oklch(0.48 0.115 155)"
  court-green-strong: "oklch(0.42 0.11 155)"
  court-green-mist: "oklch(0.95 0.025 145)"
  shuttle-yellow: "oklch(0.92 0.11 97)"
  shuttle-ink: "oklch(0.28 0.05 95)"
  paper: "oklch(0.985 0.006 95)"
  card: "oklch(1 0 0)"
  ink: "oklch(0.22 0.03 160)"
  ink-muted: "oklch(0.47 0.02 150)"
  line: "oklch(0.9 0.012 95)"
  field-line: "oklch(0.62 0.012 95)"
  court-line: "oklch(0.48 0.115 155 / 0.22)"
  fault-red: "oklch(0.48 0.21 27)"
  night: "oklch(0.17 0.02 160)"
  night-card: "oklch(0.21 0.025 160)"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
  subtitle:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
  caption:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.35
  score:
    fontFamily: "Barlow Condensed, Barlow, system-ui, sans-serif"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.court-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-primary-hover:
    backgroundColor: "{colors.court-green-strong}"
  button-primary-admin:
    backgroundColor: "{colors.court-green}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  chip-live:
    backgroundColor: "{colors.shuttle-yellow}"
    textColor: "{colors.shuttle-ink}"
    rounded: "{rounded.sm}"
    height: "22px"
    padding: "0 8px"
  surface:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
  score-cell:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.score}"
    rounded: "{rounded.md}"
    height: "56px"
    width: "64px"
---

# Design System: BirdieAtlas

> Padrão visual obrigatório para toda UI do `apps/web`. Produto e público: [`PRODUCT.md`](PRODUCT.md). Templates de referência: [`design/`](design/). Os tokens desta frente valem para o código depois da migração descrita em "Migração"; até lá, `apps/web/src/app/globals.css` é o estado atual.

## Overview

**Creative North Star: "A súmula da quadra"**

Uma súmula oficial de badminton não tem enfeite: linhas finas, números grandes, nomes legíveis e nenhuma dúvida sobre quem venceu. O BirdieAtlas segue esse princípio. A identidade "Atlas esportivo" continua: verde-quadra como cor de ação, amarelo-peteca para o que está acontecendo agora e Barlow Condensed para títulos e placares. O que muda é o acabamento: espaçamento numa escala fixa, poucos tamanhos de texto, números tabulares e todos os estados desenhados.

O portal público é pensado primeiro para o celular na arquibancada: alvos de 44 px, barra inferior com 4 destinos e a próxima ação sempre no topo. O admin é uma mesa de controle: denso, com controles de 36 px, tabelas no lugar de cartões e as pendências à vista. O telão é sempre escuro e lido a 10 metros de distância.

Rejeitamos a "cara de template": grade de cartões iguais com ícone, número-herói com legenda pequena, sobretítulo acima do título, gradiente e brilho decorativo.

**Key Characteristics:**
- Listas com linhas divisórias no lugar de grades de cartões.
- O amarelo-peteca aparece só no que está ao vivo ou foi chamado.
- Placares e posições em Barlow Condensed tabular; o texto corrido em Barlow.
- Plano por padrão; sombra só em camadas que flutuam (diálogo, menu, popover).
- Mesma linguagem em claro e escuro, com contraste AA verificado.

## Colors

Paleta contida: um verde de ação, um amarelo de "agora" e neutros quentes de papel. As cores das disciplinas e dos níveis são funcionais, nunca decorativas.

### Primary
- **Verde-quadra** (`court-green`): botão principal, link, aba selecionada, item ativo do menu, foco (via `ring`). No escuro sobe para `oklch(0.7 0.14 155)`.
- **Verde-quadra forte** (`court-green-strong`): hover do botão principal. Substitui o `primary/90` de hoje.
- **Névoa de quadra** (`court-green-mist`, token `secondary`): fundo de destaque calmo, como vitória, item ativo do menu do admin e caixa "Encontre sua próxima partida".

### Secondary
- **Amarelo-peteca** (`shuttle-yellow` com texto `shuttle-ink`): só para estado vivo, como "Ao vivo", "Chamada", contador de partidas em quadra e set em andamento no telão. Vira o token novo `live` / `live-foreground`. Não reutiliza `accent`, que o shadcn usa no hover de menus.

### Neutral
- **Papel** (`paper`): fundo da página. **Cartão** (`card`): superfícies. **Tinta** (`ink`): texto. **Tinta suave** (`ink-muted`): texto secundário, sempre com 4,5:1 contra papel e cartão.
- **Linha** (`line`): divisórias e bordas de superfície. **Linha de campo** (`field-line`): borda de input, com 3:1 (WCAG 1.4.11).
- **Linha de quadra** (`court-line`): conectores da chave e réguas finas. Cor de linha, nunca de fundo.
- **Noite** (`night`, `night-card`): fundo e superfície do escuro e do telão.

### Funcionais (mantidas como estão em `globals.css`)
- Disciplinas SM, SF, DM, DF, DX: cinco matizes (245, 305, 200, 350, 55), cada uma em versão suave (chip) e sólida.
- Medalhas ouro, prata e bronze; níveis local a internacional; `success`, `warning`, `info` e `destructive` (`fault-red`).

### Named Rules
**A Regra do Agora.** O amarelo-peteca marca só o que está acontecendo neste momento. Se a partida não está em quadra nem foi chamada, ela não fica amarela.

**A Regra da Cor com Rótulo.** Cor nunca carrega significado sozinha: disciplina tem a sigla, vitória tem "V", status tem texto.

## Typography

**Display Font:** Barlow Condensed (fallback Barlow, system-ui)
**Body Font:** Barlow (fallback system-ui)

**Character:** As duas são da mesma família: a condensada dá voz de placar esportivo, e a Barlow comum é legível em tamanhos pequenos. Juntas, eliminam o contraste genérico Geist + display. Geist e Geist Mono saem.

### Hierarchy
Escala de 1,2 a partir de 16 px, em rem fixo (sem `clamp`).
- **Display** (700, 2.5rem, 1.05): título de página pública em desktop. No celular usa Headline.
- **Headline** (700, 2rem, 1.1): `h1` de página e do admin.
- **Title** (600, 1.5rem, 1.15): título de seção (`h2`).
- **Subtitle** (Barlow 600, 1.125rem, 1.3): nome de torneio em lista, título de painel.
- **Body** (400, 1rem, 1.5): texto corrido, com no máximo 70ch.
- **Body-sm** (400, 0.875rem): metadados em tabela.
- **Label** (600, 0.8125rem): rótulo de campo, cabeçalho de tabela.
- **Caption** (400, 0.75rem, tinta suave): data, local, "Atualizado agora". Nunca menor que 12 px.
- **Score** (Barlow Condensed 700, tabular): placares, posições, pontos e horários. O tamanho segue o contexto: 1.25rem em lista, 1.75rem no lançamento, 4.5rem no telão.

### Named Rules
**A Regra do Número Tabular.** Todo número que se compara com outro (placar, ponto, posição, hora) usa `tabular-nums`.

**A Regra das Duas Vozes.** Barlow Condensed só em títulos, placares e rótulos de quadra. Botão, campo, menu e texto corrido usam Barlow.

## Layout

- **Grade de 4 px:** espaçamentos 4, 8, 12, 16, 24, 32 e 48. Nada fora da escala.
- **Ritmo:** 8 a 12 px dentro de um grupo, 24 a 32 px entre seções, e mais espaço acima de um título do que abaixo dele.
- **Público:** contêiner de 1200 px com margem de 16 px. Celular em coluna única com barra inferior fixa (Início, Torneios, Ranking, Buscar). A partir de 900 px, navegação no topo e duas colunas (conteúdo e ranking ou chave).
- **Admin:** menu lateral de 232 px (`navigation.ts`), barra superior de 56 px e conteúdo com padding de 24 px, até 1400 px. No tablet, o menu recolhe para ícones.
- **Telão:** 1920×1080, grade de 3×2 quadras, margem de 40 a 48 px e faixa "A seguir" no rodapé.
- **Pontos de quebra verificados:** 375, 768, 1024 e 1440 (e 1920 no telão).

### Named Rules
**A Regra dos Dois Toques.** Qualquer informação pública fica a até 2 toques da home: busca no topo, ao vivo e próximos torneios logo abaixo.

**A Regra da Próxima Ação.** Toda tela mostra a ação mais provável no primeiro viewport: "Encontre sua próxima partida" no torneio, "Lançar resultado" no admin e "Chamar partida" na quadra livre.

## Elevation & Depth

Plano por padrão. A profundidade vem do contraste entre papel e cartão e das linhas de 1 px. A sombra existe só em camadas que flutuam sobre a página.

### Shadow Vocabulary
- **Raised** (`0 1px 2px ink/6%, 0 4px 12px -4px ink/10%`): menus, popovers e toasts.
- **Overlay** (`0 2px 4px ink/8%, 0 16px 40px -8px ink/22%`): diálogos e sheets, sobre scrim `night/45%`.

### Named Rules
**A Regra do Plano.** Cartão em repouso não tem sombra. Se parece precisar, use uma linha divisória.

## Shapes

Cantos discretos, como os de uma súmula impressa: 4 px em chips e marcadores, 6 px em botões e campos, 8 px em superfícies e diálogos. Pílula só em avatar redondo. Bordas de 1 px; o destaque de estado usa contorno de 1 a 2 px, nunca borda lateral grossa colorida.

## Components

### Buttons
- **Shape:** cantos suaves (6 px).
- **Altura:** 44 px no portal público, 36 px no admin, nunca menos. O `h-8` (32 px) de hoje sai.
- **Primary:** verde-quadra com texto papel; hover em verde forte; 150 ms ease-out.
- **Outline:** cartão com borda de campo, para ações secundárias.
- **Ghost:** só para ações de linha em tabela e ícones de barra.
- **Destrutivo:** texto vermelho sobre fundo vermelho a 10%, sempre com confirmação em `Dialog`.
- **Foco:** contorno de 2 px na cor `ring`, afastado 2 px. Desabilitado: opacidade 50% e motivo no `title` ou texto ao lado.
- **Ícone sem texto:** 44 px (público) ou 36 px (admin), sempre com `aria-label`.

### Chips
- **Disciplina:** sigla em 700, 12 px, fundo suave da disciplina, 22 px de altura e cantos de 4 px.
- **Status:** "Ao vivo" e "Chamada" em amarelo-peteca com ponto; "Aguardando", "Prevista" e "Livre" em neutro; "Confirmada" em névoa de quadra.
- **Nível:** neutro com o nome ("Estadual"); a cor de nível fica para o ranking.

### Cards / Containers
- **Superfície:** cartão, borda `line` e cantos de 8 px, sem sombra.
- **Conteúdo:** listas com linhas de 56 px mínimos e divisórias de 1 px. Nunca cartão dentro de cartão.
- **Painel do admin:** cabeçalho de 48 px com título Subtitle e ação à direita, separado por linha.

### Inputs / Fields
- **Style:** sempre via `Field`, com rótulo visível acima. Placeholder não substitui rótulo. 44 px (público) ou 36 px (admin), borda `field-line` e cantos de 6 px.
- **Focus:** contorno `ring` de 2 px.
- **Error:** mensagem abaixo do campo, que diz o problema e como corrigir, com `aria-describedby`.
- **Placar:** célula de 64×56 px, Barlow Condensed 1.75rem tabular, `inputmode="numeric"`. O set vencido ganha fundo névoa. O vencedor é calculado e mostrado antes de salvar.

### Navigation
- **Público:** topo com marca e 5 links (desktop) e barra inferior com 4 destinos (celular), item ativo em verde-quadra com `aria-current`.
- **Admin:** menu lateral de `navigation.ts`, item ativo em névoa de quadra e contador amarelo só em "Ao vivo".
- **Abas:** `Tabs`, com sublinhado de 2 px verde na aba ativa e rolagem horizontal no celular.
- **Voltar:** link "‹ Torneios" acima do título. O nível pai sempre tem nome.

### Linha de partida (assinatura)
Rótulo de quadra em Barlow Condensed, com "QUADRA" pequeno e o número grande à esquerda, e os dois lados um embaixo do outro. O vencedor fica em 700 e o perdedor em tinta suave. Os sets ficam à direita, tabulares, com o set corrente em verde (amarelo no telão). O mesmo desenho aparece na home, na agenda, no painel e no telão, só muda a escala.

### Chave
Colunas por rodada (rótulo em caption maiúscula), confrontos em caixas de 8 px e conectores de 1 px em `court-line`. Partida ao vivo com contorno amarelo-peteca. Rodada 1 é a final (ver `CLAUDE.md`).

### Estados (obrigatórios em toda tela)
- **Carregando:** skeleton no formato do conteúdo real (linhas, não spinner no meio).
- **Vazio:** frase que explica o porquê e a próxima ação ("Nenhum torneio aberto. Os próximos aparecem aqui assim que a federação publicar.").
- **Erro:** o que falhou, o que fazer e botão "Tentar de novo".
- **Sucesso:** toast curto; o dado novo aparece no lugar, sem recarregar a página.

### Movimento
150 a 250 ms com ease-out exponencial, só para comunicar estado (hover, abrir, salvar, chegada de placar). Sem animação de entrada de página. `prefers-reduced-motion` zera tudo (regra já em `globals.css`).

## Do's and Don'ts

### Do:
- **Do** usar Barlow Condensed tabular em todo placar, posição, ponto e horário.
- **Do** manter 44 px de alvo no público e 36 px no admin.
- **Do** escrever na língua do badminton: "Próxima partida", "Quadra 3", "Chamada", "Lançar resultado".
- **Do** desenhar os quatro estados (carregando, vazio, erro, sucesso) antes de dar a tela por pronta.
- **Do** usar listas com divisórias para coleções e tabelas no admin.
- **Do** conferir cada tela em 375 e 1440 px, claro e escuro, e passar no spec WCAG.
- **Do** colocar cor nova em token de `globals.css`, nunca valor solto no componente.

### Don't:
- **Don't** usar amarelo-peteca para decorar ou chamar atenção fora do estado vivo.
- **Don't** montar a página com grade de cartões iguais de ícone + título + texto.
- **Don't** usar número-herói com legenda pequena como abertura de painel.
- **Don't** pôr sobretítulo (eyebrow) acima de título, nem numerar seções (01, 02).
- **Don't** usar gradiente em texto, vidro ou blur decorativo, nem borda lateral colorida grossa.
- **Don't** usar emoji ou caractere Unicode como ícone: só lucide, traço 1.75.
- **Don't** abrir modal para o que cabe na própria página. `Dialog` só para lançar resultado, confirmar ação destrutiva e formulários curtos.
- **Don't** mostrar logo da FPB-SP sem autorização, nem inventar números, depoimentos ou fotos.

## Migração

Ordem dos PRs (um por linha, trilha completa do [`workflow.md`](../workflow.md)):

1. **Tokens e fontes:** trocar Geist por Barlow em `layout.tsx`; `--radius` para 0.5rem; adicionar `--primary-strong`, `--live`, `--live-foreground`, `--court-line` e as duas sombras em `globals.css` (claro e escuro).
2. **Componentes `ui`:** alturas de `button`, `input` e `select` (44/36 px), hover do primário, chips de status e `tabs` no novo desenho.
3. **Portal público:** barra inferior no celular (via `navigation.ts`), home, torneio, atleta, clube e ranking.
4. **Admin:** painel com quadras e "Precisa de você", tabelas, diálogo de resultado.
5. **Telão e impressão:** `/telao` no desenho de 3×2 e `print.css` com a mesma tipografia.

Templates (HTML e PNG) em [`design/`](design/): `home`, `torneio`, `atleta`, `admin`, `resultado` e `telao`. Os HTML usam `design/templates/system.css`, um espelho destes tokens. Os nomes e números dos templates são fictícios.
