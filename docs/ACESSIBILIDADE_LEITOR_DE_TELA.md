# Roteiro de acessibilidade com leitor de tela

O axe e os testes dirigidos (`apps/e2e/tests/wcag*.spec.ts`) comprovam nomes, papéis, estados e ordem na árvore de acessibilidade. Eles não dizem **como cada leitor fala** esses elementos. Este roteiro cobre essa lacuna e precisa de uma pessoa: não dá para automatizar.

Quando alguém executar, registre o resultado na tabela do fim e atualize a linha "Acessibilidade WCAG 2.1 AA" do `PROGRESS.md`.

## Preparação

- Combinações mínimas: **NVDA + Firefox** e **NVDA + Chrome** (Windows); **VoiceOver + Safari** (macOS ou iOS); **TalkBack + Chrome** (Android). JAWS é desejável.
- Ambiente: `docker compose up -d`, `pnpm db:reset && pnpm db:seed`, API e web em desenvolvimento (`DEV_ADMIN_MODE=true`).
- Navegador sem extensões. Teste nos temas claro e escuro e, uma vez, com zoom de texto em 200%.
- Use só o teclado e o leitor. Mouse não conta como passo.

## Como registrar um problema

Anote: leitor e navegador, rota, o que o leitor falou, o que deveria falar e o critério WCAG. Se for falso positivo do leitor (comportamento conhecido do produto dele), diga qual.

## Fluxos

Cada item deve ser concluído sem ver a tela.

### Portal público

1. **Home** (`/`): pular para o conteúdo com o skip link; navegar por landmarks (cabeçalho, principal, rodapé) e por títulos; entender a lista de torneios e o status de cada um.
2. **Busca de atletas**: digitar, ouvir a quantidade de resultados, entrar no perfil.
3. **Torneio** (`/t/<slug>`): ouvir o título, o status e o pódio; percorrer a chave (partidas, quem joga, placar); a seção "Ao vivo agora" anuncia mudanças de placar sem roubar o foco.
4. **Ranking** (`/r/fpb-sp`): abas de disciplina por setas; a tabela fala cabeçalho e linha (posição, atleta, pontos); a ordenação anuncia `aria-sort`.
5. **Perfil do atleta e do clube**: histórico de torneios como lista; estatísticas com rótulo, não só número.
6. **Compartilhar e Imprimir**: o botão anuncia o resultado ("Link copiado"); "Baixar imagem" diz que baixa um arquivo.

### Admin

7. **Menu e tema**: abrir o menu de tema, escolher uma opção, o foco volta ao botão.
8. **Atletas**: tabela com legenda; abrir o detalhe do atleta (sheet), fechar com Escape e o foco voltar ao nome.
9. **Novo atleta, novo clube, nova dupla**: cada campo fala rótulo, obrigatoriedade e erro; ao enviar vazio, o foco vai para o primeiro campo inválido e o erro é falado.
10. **Importar CSV**: escolher o arquivo, ouvir a pré-visualização e o resumo ("2 importados, 1 com erro") sem procurar na tela.
11. **Inscrições**: inscrever, aprovar, recusar (campo de motivo) e remover; os botões de ícone falam a ação e o nome do atleta.
12. **Chave e resultado**: abrir uma partida, preencher os sets, confirmar; o diálogo prende o foco e o erro de validação é falado.
13. **Agenda e agenda automática**: formulário, pré-visualização e confirmação.
14. **Encerrar campeonato**: diálogo de confirmação, relatório final.
15. **Ao vivo (operador)**: marcar ponto, desfazer, encerrar a partida; o placar muda e é anunciado.
16. **Rankings e regras**: criar ranking, abrir uma regra, adicionar colocação, abrir o select de nível (lista falada, Escape fecha).
17. **Exportar CSV**: os botões "Exportar ..." falam a ação; a falha (modo admin desligado) é falada como alerta.

## Pontos de atenção conhecidos

- Os overlays do Radix (menu, select, diálogo) escondem o resto da página com `aria-hidden` enquanto abertos; é esperado e está justificado em `ALLOWED_VIOLATIONS`. Confirme que nada do fundo é lido enquanto o overlay está aberto.
- O gráfico do dashboard é decorativo; a tabela oculta é a alternativa. Confirme que a tabela é encontrada.
- Toasts: erros ficam até serem dispensados; os demais somem em 10 s. Confirme que são anunciados uma única vez.

## Resultado das execuções

| Data | Leitor + navegador | Quem | Itens com problema | Situação |
|---|---|---|---|---|
| | | | | |
