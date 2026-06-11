"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, Tournament, unwrapList } from "./api";
import { useAuth } from "./auth";

const STORAGE_KEY = "selected_tournament_id";

interface TournamentContextType {
  tournaments: Tournament[];
  selectedTournament: Tournament | null;
  setSelectedTournamentId: (id: number) => void;
  loading: boolean;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

function pickDefault(tournaments: Tournament[], savedId: string | undefined) {
  if (savedId) {
    const saved = tournaments.find((t) => String(t.id) === savedId);
    if (saved) return saved;
  }
  return (
    tournaments.find((t) => t.name === "FIFA World Cup") ||
    tournaments.find((t) => t.name === "Demo Test Cup") ||
    tournaments[0] ||
    null
  );
}

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTournaments = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      const data = await api.getTournaments(accessToken);
      const list = unwrapList(data);
      setTournaments(list);
      const saved = localStorage.getItem(STORAGE_KEY) ?? undefined;
      setSelectedTournament(pickDefault(list, saved));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && user) {
      loadTournaments(token);
    } else {
      setTournaments([]);
      setSelectedTournament(null);
    }
  }, [token, user, loadTournaments]);

  const setSelectedTournamentId = useCallback(
    (id: number) => {
      const tournament = tournaments.find((t) => t.id === id);
      if (!tournament) return;
      setSelectedTournament(tournament);
      localStorage.setItem(STORAGE_KEY, String(id));
    },
    [tournaments]
  );

  return (
    <TournamentContext.Provider
      value={{ tournaments, selectedTournament, setSelectedTournamentId, loading }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error("useTournament must be used within TournamentProvider");
  return ctx;
}
