"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Registration } from "@/lib/registrations";
import { fetchRegistrations, updateRegistration, approveRegistration } from "@/lib/registrations";

const MOCK_TOURNAMENT_ID = "tournament-mock-1";

const INITIAL_REGISTRATIONS: Registration[] = [
  { id: "registration-1", tournamentId: MOCK_TOURNAMENT_ID, athleteId: "athlete-1", pairId: null, categoryId: "category-1", status: "pending", notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), display: { athleteName: "Joao Pedro Silva" } },
  { id: "registration-2", tournamentId: MOCK_TOURNAMENT_ID, athleteId: "athlete-2", pairId: "pair-1", categoryId: "category-1", status: "pending", notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), display: { athleteName: "Ana Beatriz / Luiza Ramos" } },
  { id: "registration-3", tournamentId: MOCK_TOURNAMENT_ID, athleteId: "athlete-3", pairId: null, categoryId: "category-1", status: "approved", notes: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), display: { athleteName: "Marina Costa" } },
  { id: "registration-4", tournamentId: MOCK_TOURNAMENT_ID, athleteId: "athlete-4", pairId: null, categoryId: "category-2", status: "rejected", notes: "Documento pendente.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), display: { athleteName: "Gustavo Nunes" } },
];

const STATUS_LABEL: Record<Registration["status"], string> = { pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada" };
type Filter = "all" | Registration["status"];

export function OperationsDashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Registration | null>(null);
  const [activity, setActivity] = useState<string[]>(["Ranking de simples feminino foi recalculado.", "Nova inscricao recebida em Campinas."]);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["registrations", MOCK_TOURNAMENT_ID, "all"],
    queryFn: () => fetchRegistrations(MOCK_TOURNAMENT_ID, 1, 100),
    initialData: { data: INITIAL_REGISTRATIONS, pagination: { page: 1, pageSize: 100, total: INITIAL_REGISTRATIONS.length, totalPages: 1 } },
  });

  const filteredRegistrations = useMemo(() => {
    const list = data?.data ?? [];
    return filter === "all" ? list : list.filter((registration) => registration.status === filter);
  }, [filter, data]);

  const pendingCount = (data?.data ?? []).filter((registration) => registration.status === "pending").length;

  const updateMutation = useMutation({
    mutationFn: ({ registrationId, body }: { registrationId: string; body: { categoryId?: string; status?: Registration["status"]; notes?: string | null } }) => updateRegistration(registrationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      setEditing(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ registrationId, notes }: { registrationId: string; notes?: string | null }) => approveRegistration(registrationId, notes),
    onSuccess: (_, { registrationId }) => {
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      const reg = (data?.data ?? []).find((r) => r.id === registrationId);
      if (reg) setActivity((current) => [`${reg.display.athleteName} foi aprovado.`, ...current]);
    },
  });

  function saveRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "");
    const rawStatus = String(formData.get("status") ?? "pending");
    const notes = String(formData.get("notes") ?? "").trim();
    if (!name || !["pending", "approved", "rejected"].includes(rawStatus)) return;
    const status = rawStatus as Registration["status"];
    updateMutation.mutate({ registrationId: editing.id, body: { categoryId: category, status, notes: notes || null } });
    setActivity((current) => [`${name} teve a inscricao atualizada para ${STATUS_LABEL[status].toLowerCase()}.`, ...current]);
  }

  function handleApprove(id: string) {
    approveMutation.mutate({ registrationId: id });
  }

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando inscricoes...</div>;
  if (error) return <div className="p-8 text-center text-sm text-destructive">Erro ao carregar dados.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><h1 className="text-3xl font-semibold tracking-tight">Bom dia, Gabriel</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe a operacao da federacao e resolva as pendencias.</p></div><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="button" onClick={() => setActivity((current) => ["Fluxo de criacao de torneio iniciado.", ...current])}>+ Novo torneio</button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Atletas ativos", "1.284", "↑ 8,4% este mes"], ["Torneios ativos", "12", "↑ 3 novos"], ["Inscricoes pendentes", String(pendingCount), "Requer atencao"], ["Partidas hoje", "46", "92% atualizadas"]].map(([label, value, trend]) => <div className="rounded-xl border bg-card p-5 shadow-sm" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className={`mt-1 text-xs font-medium ${label === "Inscricoes pendentes" ? "text-amber-600" : "text-emerald-600"}`}>{trend}</p></div>)}</div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.8fr)]">
        <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex flex-col justify-between gap-2 border-b p-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Inscricoes que exigem atencao</h2><p className="mt-1 text-xs text-muted-foreground">Revise antes do fechamento das categorias</p></div><span className="text-xs text-muted-foreground">{filteredRegistrations.length} registros</span></div><div className="flex flex-wrap gap-2 border-b bg-muted/20 p-4">{(["all", "pending", "approved", "rejected"] as const).map((item) => <button className={`rounded-md border px-3 py-1.5 text-xs ${filter === item ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`} key={item} type="button" onClick={() => setFilter(item)}>{item === "all" ? "Todas" : STATUS_LABEL[item]}</button>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/20 text-left text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Atleta / dupla</th><th className="px-5 py-3 font-medium">Torneio</th><th className="px-5 py-3 font-medium">Categoria</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Acao</th></tr></thead><tbody>{filteredRegistrations.map((registration) => <tr className="border-t" key={registration.id}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{registration.display.athleteName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong className="block text-sm font-medium">{registration.display.athleteName}</strong><small className="text-xs text-muted-foreground">{registration.categoryId}</small></span></div></td><td className="px-5 py-4 text-xs">{registration.tournamentId}</td><td className="px-5 py-4 text-xs">{registration.categoryId}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${registration.status === "pending" ? "bg-amber-100 text-amber-700" : registration.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{STATUS_LABEL[registration.status]}</span></td><td className="px-5 py-4"><div className="flex gap-2"><button className="rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary" type="button" onClick={() => setEditing(registration)}>Editar</button>{registration.status === "pending" && <button className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700" type="button" onClick={() => handleApprove(registration.id)}>Aprovar</button>}</div></td></tr>)}</tbody></table>{filteredRegistrations.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma inscricao encontrada neste filtro.</p>}</div></section>
        <div className="grid gap-6"><section className="rounded-xl border bg-card shadow-sm"><div className="border-b p-5"><h2 className="font-semibold">Proximos torneios</h2><p className="mt-1 text-xs text-muted-foreground">Agenda dos proximos dias</p></div><div className="divide-y text-sm">{[["Open Paulista de Badminton", "Ginasio do Ibirapuera · 8 categorias", "29 AGO"], ["Circuito Interior — Etapa 3", "Campinas · 5 categorias", "05 SET"], ["Taca Novos Talentos", "Santo Andre · 4 categorias", "12 SET"]].map(([name, location, date]) => <div className="flex items-center justify-between gap-4 p-5" key={name}><div><strong className="text-sm font-medium">{name}</strong><p className="mt-1 text-xs text-muted-foreground">{location}</p></div><span className="rounded-lg bg-primary/10 px-2.5 py-2 text-center text-[10px] font-bold text-primary">{date}</span></div>)}</div></section><section className="rounded-xl border bg-card shadow-sm"><div className="border-b p-5"><h2 className="font-semibold">Ranking — Simples masculino</h2><p className="mt-1 text-xs text-muted-foreground">Atualizado ha 2 horas</p></div><div className="divide-y">{[["01", "RM", "Rafael Martins", "Pinheiros", "2.840"], ["02", "LF", "Lucas Ferreira", "Paulistano", "2.610"], ["03", "CA", "Caio Almeida", "Campinas", "2.405"]].map(([position, initials, name, club, points]) => <div className="flex items-center gap-3 p-4" key={position}><span className="w-6 text-xs font-semibold text-muted-foreground">{position}</span><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{initials}</span><span><strong className="block text-sm font-medium">{name}</strong><small className="text-xs text-muted-foreground">{club}</small></span><strong className="ml-auto text-sm text-primary">{points}</strong></div>)}</div></section><section className="rounded-xl border bg-card shadow-sm"><div className="border-b p-5"><h2 className="font-semibold">Atividade recente</h2><p className="mt-1 text-xs text-muted-foreground">Historico operacional</p></div><div className="divide-y">{activity.slice(0, 5).map((item, index) => <div className="flex gap-3 p-4 text-xs" key={`${item}-${index}`}><span className="mt-1 size-2 shrink-0 rounded-full bg-violet-500" /><span>{item}<small className="mt-1 block text-muted-foreground">Agora · Gabriel</small></span></div>)}</div></section></div>
      </div>
      {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><div className="w-full max-w-lg rounded-xl border bg-card shadow-xl" role="dialog" aria-modal="true" aria-labelledby="edit-registration-title"><div className="flex items-start justify-between border-b p-5"><div><h2 id="edit-registration-title" className="font-semibold">Editar inscricao</h2><p className="mt-1 text-xs text-muted-foreground">{editing.tournamentId} · {editing.display.athleteName}</p></div><button className="rounded-md px-2 text-lg text-muted-foreground" type="button" onClick={() => setEditing(null)} aria-label="Fechar">x</button></div><form className="grid gap-4 p-5" onSubmit={saveRegistration}><label className="grid gap-1.5 text-sm font-medium">Atleta ou dupla<input className="rounded-md border bg-background px-3 py-2 text-sm font-normal" name="name" defaultValue={editing.display.athleteName} required /></label><label className="grid gap-1.5 text-sm font-medium">Categoria<select className="rounded-md border bg-background px-3 py-2 text-sm font-normal" name="category" defaultValue={editing.categoryId}><option>Simples Masculino — A</option><option>Simples Masculino — B</option><option>Simples Feminino — A</option><option>Duplas Femininas — A</option><option>Duplas Mistas — A</option></select></label><label className="grid gap-1.5 text-sm font-medium">Status<select className="rounded-md border bg-background px-3 py-2 text-sm font-normal" name="status" defaultValue={editing.status}><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option></select></label><label className="grid gap-1.5 text-sm font-medium">Observacao interna<textarea className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm font-normal" name="notes" defaultValue={editing.notes ?? ""} placeholder="Ex.: confirmar pagamento ou documento." /></label><div className="flex justify-end gap-2 border-t pt-4"><button className="rounded-md border px-4 py-2 text-sm" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit" disabled={updateMutation.isPending}>Salvar alteracao</button></div></form></div></div>}
    </div>
  );
}
