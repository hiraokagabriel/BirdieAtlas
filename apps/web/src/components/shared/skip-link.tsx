/** Id do <main> de cada shell: destino do link "Pular para o conteúdo" (WCAG 2.4.1). */
export const MAIN_CONTENT_ID = 'conteudo-principal'

/**
 * Primeiro item da ordem de foco: invisível até receber foco. Leva direto ao conteúdo, sem passar
 * pelo cabeçalho e pela navegação a cada página.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only z-[200] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 print:hidden"
    >
      Pular para o conteúdo
    </a>
  )
}
