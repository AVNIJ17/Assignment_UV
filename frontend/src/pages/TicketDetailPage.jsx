import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import ActivityFeed from "../components/ActivityFeed.jsx";
import CtaPanel from "../components/CtaPanel.jsx";
import PersonBadge from "../components/PersonBadge.jsx";
import PriorityChip from "../components/PriorityChip.jsx";
import StateView from "../components/StateView.jsx";
import StatusChip from "../components/StatusChip.jsx";
import { api } from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";
import { ACTION_OWNER, formatDateTime } from "../constants.js";

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
   const { actor, actorId, people, departments, priorities, notify } = useApp();
  const [state, setState] = useState({ loading: true, error: "", ticket: null });
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const ticket = await api.getTicket(id);
      setState({ loading: false, error: "", ticket });
    } catch (e) {
      setState({ loading: false, error: e.message, ticket: null });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (action, payload) => {
    setBusy(true);
    try {
      const calls = {
        assign: () => api.assignWorker(id, payload, actorId),
        changeDepartment: () => api.changeDepartment(id, payload, actorId),
        assessment: () => api.submitAssessment(id, payload, actorId),
        resolve: () => api.markResolved(id, actorId),
        reopen: () => api.reopen(id, actorId),
      };
      const ticket = await calls[action]();
      setState({ loading: false, error: "", ticket });
      notify("Ticket updated.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      const ticket = await api.addComment(id, comment.trim(), actorId);
      setState({ loading: false, error: "", ticket });
      setComment("");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const ticket = state.ticket;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mb: 1 }}>
        Back to tickets
      </Button>

      <StateView loading={state.loading} error={state.error} onRetry={load}>
        {ticket && (
          <>
            {/* Sticky summary header, as in the wireframe. */}
            <Paper
              variant="outlined"
              sx={{ p: 2, position: { md: "sticky" }, top: 8, zIndex: 2, bgcolor: "background.paper" }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
               <Box>
                  <Typography variant="overline" color="text.secondary" fontWeight={700}>
                    Ticket #{ticket.issue_no}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {ticket.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {ticket.location} · {ticket.department?.name ?? "Unassigned department"}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                  <PriorityChip priority={ticket.priority} label={ticket.priority_display} />
                  <StatusChip status={ticket.status} />
                  {ACTION_OWNER[ticket.status] === actor?.role && (
                    <Chip size="small" color="error" label="Action Required" />
                  )}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                  Created
                </Typography>
                <PersonBadge person={ticket.created_by} />
                <Chip size="small" variant="outlined" label={formatDateTime(ticket.created_at)} />
                {ticket.assignees.map((person) => (
                  <PersonBadge key={person.id} person={person} />
                ))}
              </Stack>
            </Paper>

            <CtaPanel
              ticket={ticket}
              actor={actor}
              people={people}
              departments={departments}
              priorities={priorities}
              busy={busy}
              onAction={handleAction}
            />

            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="overline" fontWeight={700}>
                Issue description
              </Typography>
              <Typography variant="body2" color={ticket.description ? "text.primary" : "text.secondary"}>
                {ticket.description || "No description was provided for this ticket."}
              </Typography>
            </Paper>

            <ActivityFeed activities={ticket.activities} />

            {/* Sticky comment composer at the bottom. */}
            <Paper
              variant="outlined"
              sx={{ p: 1.5, mt: 2, position: "sticky", bottom: 8, bgcolor: "background.paper" }}
            >
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Write a comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                />
                <Button variant="contained" onClick={postComment} disabled={!comment.trim() || busy}>
                  Post
                </Button>
              </Stack>
            </Paper>
          </>
        )}
      </StateView>
    </Box>
  );
}
