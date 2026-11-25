import { cn } from '@/lib/utils'

// Pictogramas de badminton por disciplina (24×24, em `currentColor`): simples é um jogador com raquete, dupla são
// dois (o da frente com a raquete), e a jogadora tem saia (a mista põe um de cada). A sigla e o nome seguem no texto;
// o ícone é decorativo. Desenho grosso e com a raquete longe da cabeça para ler bem em 20 px.

function Figure({ x, skirt }: { x: number; skirt: boolean }) {
  return (
    <g>
      <circle cx={x} cy={4.5} r={2.4} fill="currentColor" stroke="none" />
      {skirt ? (
        <>
          <path d={`M${x} 8 L${x - 3.4} 15.5 H${x + 3.4} Z`} fill="currentColor" stroke="none" />
          <path d={`M${x - 1.4} 15.5 V21 M${x + 1.4} 15.5 V21`} />
        </>
      ) : (
        <path d={`M${x} 8 V15 M${x} 15 L${x - 2.6} 21 M${x} 15 L${x + 2.6} 21`} />
      )}
    </g>
  )
}

function Racket({ fromX }: { fromX: number }) {
  return (
    <g>
      <path d={`M${fromX} 10.5 L${fromX + 3.5} 8.5 L${fromX + 5} 6.5`} />
      <ellipse cx={fromX + 6.6} cy={4.4} rx={2.2} ry={3} transform={`rotate(35 ${fromX + 6.6} 4.4)`} />
    </g>
  )
}

export function DisciplineIcon({ discipline, className }: { discipline: string; className?: string }) {
  const doubles = discipline === 'MD' || discipline === 'WD' || discipline === 'XD'
  const women = discipline === 'WS' || discipline === 'WD'
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('size-5 shrink-0', className)}
    >
      {doubles ? (
        <>
          <g opacity={0.55}><Figure x={4.5} skirt={women} /></g>
          <Figure x={11} skirt={women || discipline === 'XD'} />
          <Racket fromX={11} />
        </>
      ) : (
        <>
          <Figure x={8} skirt={women} />
          <Racket fromX={8} />
        </>
      )}
    </svg>
  )
}
