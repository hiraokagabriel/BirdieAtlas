"use client";

import { useUserMode } from "@/contexts/user-mode";
import { DASHBOARD_DATA, type DashboardMetric } from "@/mocks/dashboard-data";

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const toneClass = {
    default: "text-slate-500",
    success: "text-emerald-700",
    warning: "text-amber-700",
  }[metric.tone];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{metric.label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{metric.value}</p>
      <p className={`mt-2 text-xs font-medium ${toneClass}`}>{metric.hint}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { mode, hydrated } = useUserMode();
  const data = DASHBOARD_DATA[hydrated ? mode : "public"];

  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">{data.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{data.title}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{data.description}</p>
      </section>

      <section className={`grid gap-4 sm:grid-cols-2 ${data.metrics.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {data.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-950">{data.primarySectionTitle}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.primaryItems.map((item) => (
              <div key={`${item.title}-${item.meta}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-medium text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{item.meta}</p>
                </div>
                {item.status ? <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{item.status}</span> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-slate-950">{data.secondarySectionTitle}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.secondaryItems.map((item) => (
              <div key={`${item.title}-${item.meta}`} className="p-5">
                <h3 className="font-medium text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">{item.meta}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
