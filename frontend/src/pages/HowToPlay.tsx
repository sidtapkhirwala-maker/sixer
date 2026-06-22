import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ── Shared helpers ──────────────────────────────────────────────────────────

interface BonusPenaltyRowProps {
  name:       string
  condition:  string
  value:      string
  valueClass: string
}
function BonusPenaltyRow({ name, condition, value, valueClass }: BonusPenaltyRowProps) {
  return (
    <div className="flex items-center justify-between bg-surface rounded-lg p-4 gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base text-cream uppercase leading-none">{name}</p>
        <p className="font-body text-xs text-muted mt-1 leading-snug">{condition}</p>
      </div>
      <div className="w-12 text-right shrink-0">
        <span className={`font-display text-xl leading-none ${valueClass}`}>{value}</span>
      </div>
    </div>
  )
}

interface AccordionSectionProps {
  value:    string
  title:    string
  subtitle: string
  children: ReactNode
}
function AccordionSection({ value, title, subtitle, children }: AccordionSectionProps) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value={value} className="border border-saffron/[0.25] rounded-lg overflow-hidden">
        <AccordionTrigger className="py-4 px-4 hover:no-underline group bg-saffron/[0.06] hover:bg-saffron/[0.10] transition-colors duration-150 [&>svg]:h-6 [&>svg]:w-6 [&>svg]:text-saffron">
          <div className="flex-1 text-left pr-4">
            <p className="font-display text-lg text-cream leading-none">{title}</p>
            <p className="font-body text-sm text-muted mt-1">{subtitle}</p>
          </div>
          <span className="font-body text-[10px] uppercase tracking-widest text-saffron mr-2 group-data-[state=open]:hidden">
            Tap to expand
          </span>
          <span className="font-body text-[10px] uppercase tracking-widest text-saffron mr-2 hidden group-data-[state=open]:inline">
            Tap to collapse
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

// ── Data ───────────────────────────────────────────────────────────────────

const STEPS = [
  { num: '01', title: 'SPIN', body: 'Each round, the reel lands on a random franchise and year.' },
  { num: '02', title: 'PICK', body: 'Any player from that squad. No role rules. Your call.' },
  { num: '03', title: 'RUN',  body: 'Your XI plays 16 matches. Your record becomes your Sixer Score.' },
]

const BONUSES = [
  { name: 'LOCAL XI',           condition: 'All 11 players from India.',                                                         value: '+2' },
  { name: 'COMPLETE ATTACK',    condition: 'At least 2 spinners, 2 pacers, and 2 all-rounders.',                                 value: '+4' },
  { name: 'TIER STACK',         condition: 'Seven or more picks at player score 9.0 or higher.',                                 value: '+2' },
  { name: 'POWER HITTERS',      condition: 'Three or more batters, keepers, or ARs with strike rate ≥175.',                     value: '+3' },
  { name: 'DEATH SPECIALISTS',  condition: 'Two or more pace bowlers with economy ≤7.0.',                                       value: '+2' },
  { name: 'SPIN TWINS',         condition: 'Two or more spinners with combined wickets ≥35.',                                   value: '+2' },
  { name: 'TWIN ANCHORS',       condition: '2+ top-order batters with batting average 50+.',                                     value: '+2' },
]

const PENALTIES = [
  { name: 'NO KEEPER',        condition: 'Your XI has no wicketkeeper.',                                   value: '−10' },
  { name: 'NO SPINNER',       condition: 'No specialist spin bowler in the side.',                         value: '−5'  },
  { name: 'NO PACER',         condition: 'No specialist pace bowler in the side.',                         value: '−5'  },
  { name: 'NO ALL-ROUNDER',   condition: 'No all-rounder in your XI.',                                     value: '−5'  },
  { name: 'THIN BATTING',     condition: 'Fewer than 6 players who can bat (batters + keepers + ARs).',    value: '−8'  },
  { name: 'LIGHT ON BOWLING', condition: 'Fewer than 5 bowling options (bowlers + ARs).',                  value: '−10' },
  { name: 'BOUNDARY RIDERS',  condition: 'Five or more finishers stacked.',                                value: '−10' },
  { name: 'PURE ANCHORS',     condition: 'Five or more top-order batters stacked.',                        value: '−5'  },
]

const SCORE_ROWS = [
  { score: '110+', record: '16-0',  tier: 'S', tinted: true  },
  { score: '107+', record: '15-1',  tier: 'A', tinted: false },
  { score: '104+', record: '14-2',  tier: 'A', tinted: false },
  { score: '101+', record: '13-3',  tier: 'B', tinted: false },
  { score: '98+',  record: '12-4',  tier: 'B', tinted: false },
  { score: '94+',  record: '11-5',  tier: 'B', tinted: false },
  { score: '90+',  record: '10-6',  tier: 'C', tinted: false },
  { score: '86+',  record: '9-7',   tier: 'C', tinted: false },
  { score: '82+',  record: '8-8',   tier: 'C', tinted: false },
  { score: '77+',  record: '7-9',   tier: 'D', tinted: false },
  { score: '72+',  record: '6-10',  tier: 'D', tinted: false },
  { score: '67+',  record: '5-11',  tier: 'D', tinted: false },
  { score: '62+',  record: '4-12',  tier: 'E', tinted: false },
  { score: '57+',  record: '3-13',  tier: 'E', tinted: false },
  { score: '51+',  record: '2-14',  tier: 'E', tinted: false },
  { score: '45+',  record: '1-15',  tier: 'F', tinted: false },
  { score: '<45',  record: '0-16',  tier: 'F', tinted: false },
]

// ── Page ───────────────────────────────────────────────────────────────────

export default function HowToPlay() {
  return (
    <Layout>
      <div className="max-w-[680px] mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-col gap-12">

          {/* 1 ── Intro */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
              <span className="font-body text-xs uppercase tracking-widest text-saffron">The Game</span>
            </div>
            <h1 className="font-display text-4xl text-cream">How Sixer Works</h1>
            <p className="font-body text-base text-muted leading-relaxed">
              Draft an IPL XI in 11 spins, then see how they'd do over a full 16-match season.
            </p>
          </section>

          {/* 2 ── Three steps */}
          <section className="flex flex-col gap-3">
            {STEPS.map((step) => (
              <div key={step.num} className="bg-surface rounded-lg py-5 px-5">
                <p className="font-display text-2xl text-saffron">{step.num}</p>
                <p className="font-display text-lg text-cream mt-1">{step.title}</p>
                <p className="font-body text-sm text-muted mt-2 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </section>

          {/* 3 ── Scoring overview */}
          <section>
            <p className="font-body text-sm text-muted leading-relaxed max-w-prose">
              Every player gets a Player Score from 0 to 11 based on their season stats. Sum your
              XI's player scores, add style bonuses, subtract structural penalties, and you get a
              Sixer Score. That maps to a 16-match season record and a tier letter.
            </p>
          </section>

          {/* 4 ── Bonuses accordion (collapsed by default) */}
          <section>
            <AccordionSection
              value="bonuses"
              title="Show bonuses"
              subtitle="Pick smart and stack rewards."
            >
              <div className="flex flex-col gap-2 pt-5 pb-5">
                {BONUSES.map((b) => (
                  <BonusPenaltyRow
                    key={b.name}
                    name={b.name}
                    condition={b.condition}
                    value={b.value}
                    valueClass="text-pitch"
                  />
                ))}
                <p className="font-body text-xs text-muted italic mt-3">
                  Bonuses cap at +15. Stack them strategically.
                </p>
              </div>
            </AccordionSection>
          </section>

          {/* 5 ── Penalties accordion (collapsed by default) */}
          <section>
            <AccordionSection
              value="penalties"
              title="Show structural penalties"
              subtitle="What happens when your XI is unbalanced."
            >
              <div className="flex flex-col gap-2 pt-5 pb-5">
                {PENALTIES.map((p) => (
                  <BonusPenaltyRow
                    key={p.name}
                    name={p.name}
                    condition={p.condition}
                    value={p.value}
                    valueClass="text-saffron"
                  />
                ))}
                <p className="font-body text-xs text-muted italic mt-3">
                  Penalties cap at −35. A truly broken XI floors at 0-16.
                </p>
              </div>
            </AccordionSection>
          </section>

          {/* 6 ── Score → Record table */}
          <section>
            <h2 className="font-display text-xl text-cream mb-3">Score → Record</h2>
            <p className="font-body text-sm text-muted mb-4">
              Your Sixer Score maps to a 16-match record.
            </p>
            <Table>
              <TableHeader>
                <TableRow className="border-subtle hover:bg-transparent">
                  <TableHead className="font-body font-bold text-xs uppercase tracking-wider text-muted px-3 py-2">SCORE</TableHead>
                  <TableHead className="font-body font-bold text-xs uppercase tracking-wider text-muted px-3 py-2">RECORD</TableHead>
                  <TableHead className="font-body font-bold text-xs uppercase tracking-wider text-muted px-3 py-2">TIER</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SCORE_ROWS.map((row) => (
                  <TableRow
                    key={row.score}
                    className={[
                      'border-subtle hover:bg-surface/50',
                      row.tinted ? 'bg-saffron/10' : '',
                    ].join(' ')}
                  >
                    <TableCell className="font-body text-sm text-cream px-3 py-2">{row.score}</TableCell>
                    <TableCell className="font-body text-sm text-cream px-3 py-2">{row.record}</TableCell>
                    <TableCell className="font-display font-black text-sm text-cream px-3 py-2">{row.tier}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {/* 7 ── Modes */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface border-2 border-saffron rounded-lg p-5">
                <p className="font-display text-xl text-cream">CLASSIC</p>
                <p className="font-body text-sm text-muted mt-1">Stats visible.</p>
                <p className="font-body text-sm text-cream mt-3 leading-relaxed">
                  See every player's runs, strike rate, wickets, and economy before you pick.
                  The straightforward way to draft.
                </p>
              </div>
              <div className="bg-surface border-2 border-pitch rounded-lg p-5">
                <p className="font-display text-xl text-cream">CRIC IQ</p>
                <p className="font-body text-sm text-muted mt-1">Stats hidden.</p>
                <p className="font-body text-sm text-cream mt-3 leading-relaxed">
                  Names only — no numbers. Memory and instinct. Hardest way to chase 16-0.
                </p>
              </div>
            </div>
          </section>

          {/* 8 ── CTA */}
          <section className="flex justify-center">
            <Link
              to="/"
              className={[
                'inline-flex items-center justify-center',
                'bg-saffron text-navy',
                'font-display text-xl',
                'px-10 py-4 rounded-lg',
                'transition-all duration-200',
                'hover:shadow-[0_0_32px_rgba(255,107,26,0.2)] hover:scale-[1.02]',
              ].join(' ')}
            >
              START DRAFTING
            </Link>
          </section>

        </div>
      </div>
    </Layout>
  )
}
