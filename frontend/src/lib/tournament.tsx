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
import { isStaff } from "./staff";

const STORAGE_KEY = "selected_tournament_id";

interface TournamentContextType {
  tournaments: Tournament[];
  selectedTournament: Tournament | null;
  setSelectedTournamentId: (id: number) => void;
  clearSelectedTournament: () => void;
  loading: boolean;
  error: string | null;
  reloadTournaments: () => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTournaments = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTournaments(accessToken);
      const list = unwrapList(data);
      setTournaments(list);

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedTournament = list.find((t) => String(t.id) === saved);
        if (savedTournament) {
          setSelectedTournament(savedTournament);
        } else {
          localStorage.removeItem(STORAGE_KEY);
          setSelectedTournament(null);
        }
      } else {
        setSelectedTournament(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments");
      setTournaments([]);
      setSelectedTournament(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token && user && !isStaff(user)) {
      loadTournaments(token);
    } else {
      setTournaments([]);
      setSelectedTournament(null);
      setError(null);
      setLoading(false);
      if (user && isStaff(user)) {
        localStorage.removeItem(STORAGE_KEY);
      }
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

  const clearSelectedTournament = useCallback(() => {
    setSelectedTournament(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const reloadTournaments = useCallback(() => {
    if (token) loadTournaments(token);
  }, [token, loadTournaments]);

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        selectedTournament,
        setSelectedTournamentId,
        clearSelectedTournament,
        loading,
        error,
        reloadTournaments,
      }}
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
