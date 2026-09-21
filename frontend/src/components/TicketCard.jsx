import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import PersonBadge from "./PersonBadge.jsx";
import PriorityChip from "./PriorityChip.jsx";
import StatusChip from "./StatusChip.jsx";
import { ACTION_OWNER, formatDateTime } from "../constants.js";

/** A single row of the paginated listing. */
export default function TicketCard({ ticket, actorRole, onView }) {
  const actionRequired = ACTION_OWNER[ticket.status] === actorRole;

  return (
    <Paper component="article" variant="outlined" sx={{ p: 2, mb: 1.5 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        {/* <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap title={ticket.title}>
            {ticket.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ticket.location}
          </Typography>
        </Box> */}
{/* 
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block" }}>
            #{ticket.issue_no}
          </Typography>
          <Typography variant="subtitle1" fontWeight={700} noWrap title={ticket.title}>
            {ticket.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ticket.location}
          </Typography>
        </Box> */}

        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            
            <Typography variant="subtitle1" fontWeight={700} noWrap title={ticket.title}>
              {ticket.title}
            </Typography>

            <Box
              sx={{
                bgcolor: "#1976d2",
                color: "#000",
                fontWeight: 700,
                fontSize: 12,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                flexShrink: 0,
                lineHeight: 1.6,
              }}
            >
              #{ticket.issue_no}
            </Box>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {ticket.location}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <PriorityChip priority={ticket.priority} label={ticket.priority_display} />
          <StatusChip status={ticket.status} />
          {actionRequired && <Chip size="small" color="error" label="Action Required" />}
          <Button variant="contained" color="success" size="small" onClick={() => onView(ticket.id)}>
            View
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          Created
        </Typography>
        <PersonBadge person={ticket.created_by} />
        <Chip size="small" variant="outlined" label={formatDateTime(ticket.created_at)} />
        {ticket.assignees.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", ml: 1 }}>
              Current Assignee(s)
            </Typography>
            {ticket.assignees.map((person) => (
              <PersonBadge key={person.id} person={person} />
            ))}
          </>
        )}
      </Stack>
    </Paper>
  );
}
