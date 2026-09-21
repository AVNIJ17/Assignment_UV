import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import { formatDateTime } from "../constants.js";

export default function ActivityFeed({ activities }) {
  const [filter, setFilter] = useState("ALL");
  const visible = activities.filter((a) => filter === "ALL" || a.kind === filter);

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="overline" fontWeight={700}>
          Activity
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {activities.length} events
        </Typography>
      </Stack>

      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        sx={{ minHeight: 34, mb: 1 }}
        aria-label="Activity filter"
      >
        <Tab value="ALL" label="All" sx={{ minHeight: 34 }} />
        <Tab value="ACTION" label="Actions" sx={{ minHeight: 34 }} />
        <Tab value="COMMENT" label="Comments" sx={{ minHeight: 34 }} />
      </Tabs>

      <Stack component="ol" spacing={2} sx={{ listStyle: "none", p: 0, m: 0 }}>
        {visible.map((item) => (
          <Box component="li" key={item.id}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Avatar sx={{ width: 32, height: 32, fontSize: 12 }}>
                {item.actor ? item.actor.initials : "S"}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                {item.kind === "COMMENT" ? (
                  <>
                    <Typography variant="body2" fontWeight={600}>
                      {item.actor ? `${item.actor.name} (${item.actor.role_display})` : "System"}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {formatDateTime(item.created_at)}
                      </Typography>
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1.25, mt: 0.5, bgcolor: "grey.50" }}>
                      <Typography variant="body2">{item.body}</Typography>
                    </Paper>
                  </>
                ) : (
                  <>
                    <Typography variant="body2">
                      <strong>
                        {item.actor
                          ? `${item.actor.name} (${item.actor.role_display})`
                          : "System"}
                      </strong>{" "}
                      <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>
                        {item.verb || "updated"}
                      </Box>{" "}
                      the ticket.
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {formatDateTime(item.created_at)}
                      </Typography>
                    </Typography>
                    {(item.from_value || item.to_value) && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip size="small" label={item.from_value || "—"} variant="outlined" />
                        <span aria-hidden>→</span>
                        <Chip size="small" label={item.to_value || "—"} color="primary" variant="outlined" />
                      </Stack>
                    )}
                  </>
                )}
              </Box>
            </Stack>
          </Box>
        ))}
        {visible.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No events to show.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
