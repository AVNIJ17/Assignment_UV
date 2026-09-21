import { useState } from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { ASSESSMENT_OPTIONS } from "../constants.js";

/**
 * Role-aware call-to-action panel shown above the description.
 * Which buttons appear depends on the acting user's role and ticket status.
 */
export default function CtaPanel({ ticket, actor, people, departments, priorities, busy, onAction }) {
  const [mode, setMode] = useState(null);
  const [worker, setWorker] = useState("");
  const [priority, setPriority] = useState("");
  const [department, setDepartment] = useState("");
  const [outcome, setOutcome] = useState("FULLY_RESOLVED");
  const [note, setNote] = useState("");

  if (!actor) return null;

  const isCreator = ticket.created_by.id === actor.id;
  // A Department POC can only act on tickets belonging to their own department —
  // the ticket is owned by the department as a group, not by one specific person.
  const isDeptPoc = actor.role === "DEPARTMENT_POC" && actor.department === ticket.department?.id;
  const isAssignedTech = ticket.assignees.some(
    (p) => p.id === actor.id && p.role === "TECHNICIAN"
  );

  const technicians = people.filter(
    (p) => p.role === "TECHNICIAN" && p.department === ticket.department?.id
  );
  const priorityOptions = priorities.filter((p) => p.value !== "UNSET");

  const run = (action, payload) =>
    onAction(action, payload).then(() => {
      setMode(null);
      setNote("");
      setWorker("");
      setPriority("");
      setDepartment("");
    });


  const wrap = (message, children) => (
    <Paper variant="outlined" sx={{ p: 2, mt: 2, textAlign: "center" }}>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        {message}
      </Typography>
      {children}
    </Paper>
  );

  if (!ticket.is_open) {
    return wrap(
      "This ticket is closed.",
      <Button variant="outlined" disabled={busy} onClick={() => run("reopen")}>
        Reopen Ticket
      </Button>
    );
  }

  if (isDeptPoc && (ticket.status === "PENDING_ASSIGNMENT" || ticket.status === "PENDING_POC_REVIEW")) {
    return wrap(
      "Review and proceed with the next step.",
      <Stack spacing={1.5} alignItems="center">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
          <Button
            variant={mode === "worker" ? "contained" : "outlined"}
            onClick={() => setMode(mode === "worker" ? null : "worker")}
          >
            Assign Worker
          </Button>
          <Button
            variant={mode === "department" ? "contained" : "outlined"}
            onClick={() => setMode(mode === "department" ? null : "department")}
          >
            Change Department
          </Button>
          <Button color="success" variant="outlined" disabled={busy} onClick={() => run("resolve")}>
            Close Ticket
          </Button>
        </Stack>

             {mode === "worker" && (
          <Stack spacing={1} sx={{ width: "100%", maxWidth: 420 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="priority-cta-label">Set priority</InputLabel>
              <Select
                labelId="priority-cta-label"
                label="Set priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {priorityOptions.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel id="worker-label">Select worker</InputLabel>
                <Select
                  labelId="worker-label"
                  label="Select worker"
                  value={worker}
                  onChange={(e) => setWorker(e.target.value)}
                >
                  {technicians.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                color="success"
                variant="contained"
                disabled={!worker || !priority || busy}
                onClick={() => run("assign", { technician: worker, priority })}
              >
                Ok
              </Button>
            </Stack>
          </Stack>
        )}
        
        {mode === "department" && (
          <Stack direction="row" spacing={1} sx={{ width: "100%", maxWidth: 420 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="dept-cta-label">Select department</InputLabel>
              <Select
                labelId="dept-cta-label"
                label="Select department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {departments
                  .filter((d) => d.id !== ticket.department?.id)
                  .map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Button
              color="success"
              variant="contained"
              disabled={!department || busy}
              onClick={() => run("changeDepartment", department)}
            >
              Ok
            </Button>
          </Stack>
        )}
      </Stack>
    );
  }

  if (isAssignedTech && ticket.status === "PENDING_ASSESSMENT") {
    return wrap(
      "You have been assigned this ticket. Take action.",
      <Stack spacing={1.5} alignItems="center">
        <Button
          variant={mode === "assessment" ? "contained" : "outlined"}
          onClick={() => setMode(mode === "assessment" ? null : "assessment")}
        >
          Submit Assessment
        </Button>
        {mode === "assessment" && (
          <Stack spacing={1} sx={{ width: "100%", maxWidth: 520, textAlign: "left" }}>
            <RadioGroup value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {ASSESSMENT_OPTIONS.map((option) => (
                <Paper key={option.value} variant="outlined" sx={{ px: 1.5, py: 0.5, mb: 0.75 }}>
                  <FormControlLabel
                    value={option.value}
                    control={<Radio size="small" />}
                    label={
                      <>
                        <Typography variant="body2" fontWeight={600}>
                          {option.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.help}
                        </Typography>
                      </>
                    }
                  />
                </Paper>
              ))}
            </RadioGroup>
            <TextField
              size="small"
              label={outcome === "FULLY_RESOLVED" ? "Note (optional)" : "Note (required)"}
              multiline
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              color="success"
              variant="contained"
              disabled={busy}
              onClick={() => run("assessment", { outcome, note })}
            >
              Ok
            </Button>
          </Stack>
        )}
      </Stack>
    );
  }

  if (isCreator) {
    return wrap(
      "Ticket created successfully. If the issue is resolved, you can mark it as resolved.",
      <Button color="success" variant="outlined" disabled={busy} onClick={() => run("resolve")}>
        Mark Resolved
      </Button>
    );
  }

  return wrap("No action is required from you on this ticket right now.", null);
}
