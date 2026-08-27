"use client";

import {
  USER_MODE_METADATA,
  USER_MODES,
  type UserMode,
  useUserMode,
} from "@/contexts/user-mode";

export function UserSwitcher() {
  const { mode, setMode } = useUserMode();

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="hidden sm:inline">Visualizar como</span>
      <select
        aria-label="Selecionar modo de visualização"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
        value={mode}
        onChange={(event) => setMode(event.target.value as UserMode)}
      >
        {USER_MODES.map((userMode) => (
          <option key={userMode} value={userMode}>
            {USER_MODE_METADATA[userMode].icon} {USER_MODE_METADATA[userMode].label}
          </option>
        ))}
      </select>
    </label>
  );
}
