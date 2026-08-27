export interface Registration {
  id: string;
  tournamentId: string;
  athleteId: string;
  pairId: string | null;
  categoryId: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  display: { athleteName: string };
}

export interface RegistrationsListResponse {
  data: Registration[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchRegistrations(tournamentId: string, page: number, pageSize: number, status?: "pending" | "approved" | "rejected"): Promise<RegistrationsListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set("status", status);
  const res = await fetch(`/api/registrations/tournament/${encodeURIComponent(tournamentId)}?${params}`);
  if (!res.ok) throw new Error("Falha ao carregar inscricoes.");
  return res.json();
}

export async function updateRegistration(registrationId: string, body: { categoryId?: string; status?: "pending" | "approved" | "rejected"; notes?: string | null }): Promise<Registration> {
  const res = await fetch(`/api/registrations/${encodeURIComponent(registrationId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Falha ao atualizar inscricao.");
  return res.json();
}

export async function approveRegistration(registrationId: string, notes?: string | null): Promise<Registration> {
  const res = await fetch(`/api/registrations/${encodeURIComponent(registrationId)}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
  if (!res.ok) throw new Error("Falha ao aprovar inscricao.");
  return res.json();
}
