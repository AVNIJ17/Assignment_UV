import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

import { api } from "../api/client.js";

const AppContext = createContext(null);

/**
 * Holds the reference data (people, offices, issue types) and the "acting user".
 * Authentication is out of scope, so the role is switched from the app bar.
 */
export function AppProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actorId, setActorId] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.bootstrap();
      setData(result);
      setActorId((current) => current ?? result.people[0]?.id ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notify = useCallback((message, severity = "success") => {
    setToast({ message, severity });
  }, []);

  const value = useMemo(() => {
    const people = data?.people ?? [];
    return {
      loading,
      error,
      reload: load,
      people,
      departments: data?.departments ?? [],
      offices: data?.offices ?? [],
      issueTypes: data?.issue_types ?? [],
      priorities: data?.priorities ?? [],
      actorId,
      setActorId,
      actor: people.find((p) => p.id === actorId) ?? null,
      notify,
    };
  }, [data, loading, error, load, actorId, notify]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
