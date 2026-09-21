import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import FiltersBar from "../components/FiltersBar.jsx";
import StateView from "../components/StateView.jsx";
import TicketCard from "../components/TicketCard.jsx";
import { api } from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";

const PAGE_SIZE = 10;
const DEFAULT_FILTERS = { search: "", priority: [], department: "", sort: "newest" };

export default function TicketListPage() {
  const navigate = useNavigate();
  const { departments, priorities, actor } = useApp();

  const [tab, setTab] = useState("open");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await api.listTickets({
        tab,
        page,
        search: filters.search,
        priority: filters.priority.join(","),
        department: filters.department,
        sort: filters.sort,
      });
      setState({ loading: false, error: "", data });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [tab, page, filters]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, filters]);

  const results = state.data?.results ?? [];
  const pageCount = Math.ceil((state.data?.count ?? 0) / PAGE_SIZE);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2 }}
        aria-label="Ticket status tabs"
      >
        <Tab value="open" label="Open Tickets" />
        <Tab value="closed" label="Closed Tickets" />
      </Tabs>

      <FiltersBar
        value={filters}
        onChange={setFilters}
        departments={departments}
        priorities={priorities}
      />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: "transparent" }}>
        <StateView
          loading={state.loading}
          error={state.error}
          empty={results.length === 0}
          emptyText={
            tab === "open"
              ? "No open tickets match your filters."
              : "No closed tickets match your filters."
          }
          onRetry={load}
        >
          <>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 1.5 }}
            >
              <Typography variant="body2" color="text.secondary">
                {state.data?.count} ticket(s) — page {page} of {pageCount}
              </Typography>
            </Stack>

            {results.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                actorRole={actor?.role}
                onView={(id) => navigate(`/tickets/${id}`)}
              />
            ))}

            {pageCount > 1 && (
              <Stack alignItems="center" sx={{ mt: 2 }}>
                <Pagination
                  count={pageCount}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                  siblingCount={0}
                />
              </Stack>
            )}
          </>
        </StateView>
      </Paper>
    </Box>
  );
}
