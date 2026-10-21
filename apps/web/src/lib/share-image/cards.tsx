import type { CSSProperties, ReactElement } from 'react'
import {
  PODIUM_CATEGORY_LIMIT,
  type AthleteCardModel,
  type PodiumCategory,
  type RankingCardModel,
  type TournamentCardModel,
} from '@/lib/share-cards'
import type { ShareImageFormat } from '@/lib/share'
import { BRAND, FONT_FAMILY, MEDALS } from './brand'

// Layouts das imagens de compartilhamento. O Satori só entende flexbox: todo contêiner com mais de um
// filho é `display: flex`, e texto longo termina em reticências (os modelos já limitam o tamanho).
// `host` é o endereço do site (ex.: "birdieatlas.example"), mostrado no rodapé.

const ROOT: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  color: BRAND.paper,
  fontFamily: FONT_FAMILY,
  fontWeight: 500,
  background: `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenDeep} 100%)`,
}

const ELLIPSIS: CSSProperties = { display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

/** Tamanho do título conforme o comprimento, para nomes longos continuarem legíveis em até 3 linhas. */
export function titleFontSize(text: string, sizes: { large: number; medium: number; small: number }): number {
  if (text.length <= 22) return sizes.large
  if (text.length <= 42) return sizes.medium
  return sizes.small
}

function Brand({ size = 30 }: { size?: number }): ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', width: size, height: size, borderRadius: size, background: BRAND.yellow, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', width: size * 0.4, height: size * 0.4, borderRadius: size, background: BRAND.green }} />
      </div>
      <div style={{ display: 'flex', fontSize: size, fontWeight: 700, letterSpacing: 5 }}>BIRDIEATLAS</div>
    </div>
  )
}

function Pill({ text, light = false, size = 26 }: { text: string; light?: boolean; size?: number }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        padding: `${size * 0.2}px ${size * 0.7}px`,
        borderRadius: 999,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: 'uppercase',
        background: light ? 'rgba(255,255,255,0.14)' : BRAND.yellow,
        color: light ? BRAND.paper : BRAND.yellowInk,
      }}
    >
      {text}
    </div>
  )
}

function Medal({ place, size }: { place: number; size: number }): ReactElement {
  const medal = MEDALS[place] ?? { bg: BRAND.paperMuted, ink: BRAND.inkMuted }
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size,
        alignItems: 'center',
        justifyContent: 'center',
        background: medal.bg,
        color: medal.ink,
        fontSize: size * 0.58,
        fontWeight: 700,
      }}
    >
      {place}
    </div>
  )
}

function Footer({ host }: { host: string }): ReactElement {
  return <div style={{ display: 'flex', fontSize: 24, letterSpacing: 2, color: BRAND.greenSoft }}>{host}</div>
}

// ---------------------------------------------------------------------------
// Torneio
// ---------------------------------------------------------------------------
function PodiumLine({ place, names, size }: { place: number; names: string[]; size: number }): ReactElement | null {
  if (names.length === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: size * 0.22 }}>
      <Medal place={place} size={size * 1.15} />
      <div style={{ ...ELLIPSIS, flex: 1, fontSize: size, fontWeight: place === 1 ? 700 : 500 }}>{names.join('  ·  ')}</div>
    </div>
  )
}

function PodiumBlock({ category, sizes, withThird }: { category: PodiumCategory; sizes: [number, number, number]; withThird: boolean }): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, marginTop: 18 }}>
      <div style={{ ...ELLIPSIS, fontSize: 22, letterSpacing: 1, textTransform: 'uppercase', color: BRAND.inkMuted }}>{category.name}</div>
      <PodiumLine place={1} names={category.first} size={sizes[0]} />
      <PodiumLine place={2} names={category.second} size={sizes[1]} />
      {withThird && <PodiumLine place={3} names={category.third} size={sizes[2]} />}
    </div>
  )
}

function StatsBlock({ model, big }: { model: TournamentCardModel; big: number }): ReactElement {
  const items = [
    { value: model.stats.categories, label: model.stats.categories === 1 ? 'categoria' : 'categorias' },
    { value: model.stats.athletes, label: model.stats.athletes === 1 ? 'atleta' : 'atletas' },
    { value: model.stats.matches, label: model.stats.matches === 1 ? 'partida' : 'partidas' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 18 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontSize: big, fontWeight: 700, color: BRAND.green, lineHeight: 1 }}>{item.value}</div>
          <div style={{ display: 'flex', fontSize: big * 0.38, color: BRAND.inkMuted }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

export function TournamentCard({ model, format, host }: { model: TournamentCardModel; format: ShareImageFormat; host: string }): ReactElement {
  const portrait = format === 'portrait'
  const limit = PODIUM_CATEGORY_LIMIT[format]
  const shown = model.podium.slice(0, limit)
  const hidden = model.podium.length - shown.length
  const title = titleFontSize(model.name, portrait ? { large: 104, medium: 84, small: 66 } : { large: 88, medium: 68, small: 54 })
  const hasPodium = model.completed && shown.length > 0

  const panel = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: portrait ? '100%' : 520,
        ...(portrait ? { flex: 1 } : {}),
        padding: portrait ? 44 : 34,
        borderRadius: 32,
        overflow: 'hidden',
        background: BRAND.paper,
        color: BRAND.ink,
      }}
    >
      <div style={{ display: 'flex', flexShrink: 0, fontSize: portrait ? 40 : 32, fontWeight: 700, letterSpacing: 4, color: BRAND.green }}>
        {hasPodium ? 'PÓDIO' : 'O TORNEIO'}
      </div>
      {hasPodium ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {shown.map((category) => (
            <PodiumBlock
              key={category.name}
              category={category}
              sizes={portrait ? [40, 32, 28] : [34, 28, 26]}
              withThird={portrait || shown.length <= 2}
            />
          ))}
          {hidden > 0 && (
            <div style={{ display: 'flex', marginTop: 18, fontSize: portrait ? 30 : 24, color: BRAND.inkMuted }}>
              {`+ ${hidden} ${hidden === 1 ? 'categoria' : 'categorias'}`}
            </div>
          )}
        </div>
      ) : (
        <StatsBlock model={model} big={portrait ? 96 : 76} />
      )}
    </div>
  )

  const info = (
    <div style={{ display: 'flex', flexDirection: 'column', ...(portrait ? {} : { flex: 1 }), minWidth: 0, justifyContent: 'space-between', gap: portrait ? 22 : 0 }}>
      <Brand size={portrait ? 34 : 30} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: portrait ? 26 : 20, marginTop: portrait ? 0 : 24 }}>
        {model.levelLabel && <Pill text={model.levelLabel} size={portrait ? 30 : 26} />}
        <div style={{ display: 'flex', fontSize: title, fontWeight: 700, lineHeight: 0.98, textTransform: 'uppercase', lineClamp: 3 }}>{model.name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: portrait ? 38 : 32, color: BRAND.greenSoft }}>
          <div style={{ display: 'flex' }}>{model.dateRange}</div>
          {model.place && <div style={{ display: 'flex' }}>{model.place}</div>}
        </div>
      </div>
      {model.statusLabel ? <Pill text={model.statusLabel} light size={portrait ? 26 : 22} /> : <Footer host={host} />}
    </div>
  )

  return (
    <div style={{ ...ROOT, flexDirection: portrait ? 'column' : 'row', padding: portrait ? 64 : 56, gap: portrait ? 28 : 48 }}>
      {info}
      {panel}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Atleta
// ---------------------------------------------------------------------------
export function AthleteCard({ model, host }: { model: AthleteCardModel; host: string }): ReactElement {
  const name = titleFontSize(model.name, { large: 96, medium: 76, small: 58 })
  const tiles = [
    { value: String(model.titles), label: model.titles === 1 ? 'título' : 'títulos', highlight: model.titles > 0 },
    { value: String(model.podiums), label: model.podiums === 1 ? 'pódio' : 'pódios', highlight: false },
    { value: String(model.tournaments), label: model.tournaments === 1 ? 'torneio' : 'torneios', highlight: false },
    { value: model.bestPosition === null ? '—' : `${model.bestPosition}º`, label: 'melhor ranking', highlight: false },
  ]
  return (
    <div style={{ ...ROOT, flexDirection: 'column', justifyContent: 'space-between', padding: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand />
        <Footer host={host} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
        <div
          style={{
            display: 'flex',
            width: 200,
            height: 200,
            flexShrink: 0,
            borderRadius: 200,
            alignItems: 'center',
            justifyContent: 'center',
            background: BRAND.yellow,
            color: BRAND.green,
            fontSize: 96,
            fontWeight: 700,
          }}
        >
          {model.initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 12 }}>
          <div style={{ display: 'flex', fontSize: name, fontWeight: 700, lineHeight: 0.98, textTransform: 'uppercase', lineClamp: 2 }}>{model.name}</div>
          <div style={{ ...ELLIPSIS, fontSize: 36, color: BRAND.greenSoft }}>
            {model.clubName ? (model.place ? `${model.clubName} · ${model.place}` : model.clubName) : 'Sem clube ativo'}
          </div>
          {model.bestRankingName && <div style={{ ...ELLIPSIS, fontSize: 28, color: BRAND.greenSoft }}>{model.bestRankingName}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '20px 26px',
              borderRadius: 24,
              background: tile.highlight ? BRAND.gold : BRAND.paper,
              color: tile.highlight ? BRAND.goldInk : BRAND.inkMuted,
            }}
          >
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, lineHeight: 1, color: tile.highlight ? BRAND.goldInk : BRAND.green }}>{tile.value}</div>
            <div style={{ display: 'flex', fontSize: 26 }}>{tile.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------
export function RankingCard({ model, host }: { model: RankingCardModel; host: string }): ReactElement {
  const title = titleFontSize(model.title, { large: 72, medium: 58, small: 46 })
  return (
    <div style={{ ...ROOT, flexDirection: 'row', padding: 56, gap: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', width: 420, justifyContent: 'space-between' }}>
        <Brand />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Pill text={`Top ${Math.max(model.rows.length, 1)}`} />
          <div style={{ display: 'flex', fontSize: title, fontWeight: 700, lineHeight: 0.98, textTransform: 'uppercase', lineClamp: 4 }}>{model.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 32, color: BRAND.greenSoft }}>
            <div style={{ display: 'flex' }}>{`${model.disciplineLabel} · ${model.year}`}</div>
            <div style={ELLIPSIS}>{model.federation}</div>
          </div>
        </div>
        <Footer host={host} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, padding: '22px 30px', borderRadius: 32, background: BRAND.paper, color: BRAND.ink, justifyContent: 'center' }}>
        {model.rows.length === 0 ? (
          <div style={{ display: 'flex', fontSize: 34, color: BRAND.inkMuted }}>Ranking ainda sem classificados.</div>
        ) : (
          model.rows.map((row) => (
            <div key={row.position} style={{ display: 'flex', alignItems: 'center', gap: 18, height: 47 }}>
              <Medal place={row.position} size={36} />
              <div style={{ ...ELLIPSIS, flex: 1, fontSize: 30, fontWeight: row.position <= 3 ? 700 : 500 }}>{row.name}</div>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: BRAND.green }}>{row.points}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fallback: dado ausente, atleta inexistente ou API fora do ar
// ---------------------------------------------------------------------------
export function FallbackCard({ headline, format, host }: { headline: string; format: ShareImageFormat; host: string }): ReactElement {
  const portrait = format === 'portrait'
  return (
    <div style={{ ...ROOT, flexDirection: 'column', justifyContent: 'space-between', padding: portrait ? 72 : 56 }}>
      <Brand size={portrait ? 40 : 34} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', fontSize: portrait ? 120 : 92, fontWeight: 700, lineHeight: 0.98, textTransform: 'uppercase', lineClamp: 3 }}>{headline}</div>
        <div style={{ display: 'flex', fontSize: portrait ? 42 : 34, color: BRAND.greenSoft }}>Torneios, chaves, atletas e rankings de badminton.</div>
      </div>
      <Footer host={host} />
    </div>
  )
}
