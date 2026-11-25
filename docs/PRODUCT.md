# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Organizador e mesário da federação (FPB-SP):** no notebook da mesa de controle do ginásio, monta torneio, chave e agenda e lança resultados sob pressão de tempo. É o usuário crítico: um erro dele atrasa partidas. Às vezes lança a súmula num tablet, na beira da quadra.
- **Atleta, técnico e família:** no celular, no ginásio ou em casa. Querem saber a próxima partida, a quadra, a chave e o ranking. É o maior volume de acesso.
- **Público no ginásio:** lê o telão (`/telao`) a vários metros de distância.

## Product Purpose

Plataforma web de gestão de campeonatos de badminton para federações e organizadores: atletas, clubes, duplas, torneios, categorias, inscrições, chaves, partidas e rankings, com portal público de consulta. Sucesso é o torneio andar no horário e qualquer pessoa achar a informação que procura sem aprender o sistema.

## Positioning

Zero curva de aprendizado. Os sistemas de torneio existentes exigem aprender a navegar; o BirdieAtlas fala a língua do badminton ("Próxima partida", "Quadra 3", "Dupla mista") e deixa a próxima ação sempre à vista.

## Operating Context

- Ginásio com Wi-Fi instável: o portal público é PWA, com página offline.
- Mesa de controle com notebook, às vezes tablet; lançamento de placar set a set.
- Telão no ginásio com a fila de quadras.
- Súmulas e chaves impressas (`print.css`), com QR code para a página pública.

## Capabilities and Constraints

- Stack: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui sobre Radix, lucide-react. Não muda no redesign.
- Componentes da casa obrigatórios: `Field`, `ChoiceGroup`, `Tabs`, `Dialog`. Navegação só em `src/lib/navigation.ts`.
- Toda tela trata carregamento, erro, vazio e sucesso com dados reais da API.
- Páginas públicas nunca mostram e-mail, CPF, telefone ou data de nascimento; o atleta guarda só nome e ano de nascimento.
- Terminologia: torneio, categoria, disciplina (SM, SF, DM, DF, DX), chave, rodada, partida, set, quadra, inscrição, dupla, clube, ranking.

## Brand Commitments

- Nome: BirdieAtlas. Identidade "Atlas esportivo" (verde-quadra, amarelo-peteca, Barlow Condensed) mantida e refinada, não substituída.
- Não há logo próprio: o logo final é decisão pendente do usuário. A FPB-SP aparece só como texto; logo oficial só com autorização.
- Textos em português do Brasil, com acentuação correta.

## Evidence on Hand

- Não há fotos, depoimentos nem números de uso. Nenhum design pode inventar esses dados.
- Dados de exemplo vêm do seed (`apps/api/src/scripts/seed.ts`).

## Product Principles

1. A próxima ação está sempre visível: quem abre uma tela sabe o que fazer em seguida sem procurar.
2. Linguagem do badminton, nunca do sistema.
3. Navegação rasa: no máximo 2 níveis; toda informação pública a até 2 toques da home.
4. A mesa de controle não pode errar: ações destrutivas pedem confirmação, placares são legíveis e o estado da partida é inequívoco.
5. Capricho é requisito: estados, espaçamento e números recebem o mesmo cuidado que a tela principal.

## Accessibility & Inclusion

WCAG 2.1 AA verificado por axe e teclado no spec `apps/e2e` (claro, escuro, desktop e celular). Alvos de toque de pelo menos 44 px no portal público. Leitor de tela: ver `docs/ACESSIBILIDADE_LEITOR_DE_TELA.md`.
