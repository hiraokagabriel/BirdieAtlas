"use client";

import Link from "next/link";
import { DASHBOARD_DATA } from "@/mocks/dashboard-data";
import { useUserMode } from "@/contexts/user-mode";

export default function HomePage() {
  const { mode, hydrated } = useUserMode();
  const data = DASHBOARD_DATA[hydrated ? mode : "public"];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-sm md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-100">BirdieAtlas</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
          Gestão clara para cada pessoa envolvida no badminton.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-teal-50 md:text-lg">
          Este protótipo permite alternar instantaneamente entre os papéis da plataforma e validar cada experiência antes da implementação do backend.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50">
            Abrir dashboard
          </Link>
          <span className="rounded-lg border border-white/30 px-4 py-2.5 text-sm text-teal-50">
            Modo atual: {data.eyebrow}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Público", "Torneios, resultados e rankings sem login."],
          ["Operação", "Atleta, juiz e administração com áreas próprias."],
          ["Evolução", "Dados mockados hoje, fonte JSON modular depois."],
        ].map(([title, description]) => (
          <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
