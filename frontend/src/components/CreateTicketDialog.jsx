import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import InfoIcon from "@mui/icons-material/InfoOutlined";

import { api } from "../api/client.js";
import { useApp } from "../context/AppContext.jsx";

const EMPTY = { issues: [], floors: [], description: "", office: "" };

/** "Create New Ticket" form: quick-issue chips, multi-select issues and floors. */
export default function CreateTicketDialog({ open, onClose, onCreated }) {
  const { issueTypes, offices, actor, notify } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const defaultOfficeId = actor?.office ?? offices[0]?.id ?? "";
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, office: defaultOfficeId });
      setErrors({});
    }
  }, [open, defaultOfficeId]);

  const office = useMemo(
    () => offices.find((o) => o.id === form.office) ?? null,
    [offices, form.office]
  );
  const quickIssues = issueTypes.filter((i) => i.is_quick_issue);

  const toggleQuickIssue = (issue) => {
    setForm((f) => ({
      ...f,
      issues: f.issues.some((i) => i.id === issue.id)
        ? f.issues.filter((i) => i.id !== issue.id)
        : [...f.issues, issue],
    }));
  };

  const validate = () => {
    const next = {};
    if (!form.office) next.office = "Select an office.";
    if (form.issues.length === 0) next.issues = "Select at least one issue.";
    if (office?.has_multiple_floors && form.floors.length === 0) {
      next.floors = "Select at least one floor.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const ticket = await api.createTicket({
        office: form.office,
        issues: form.issues.map((i) => i.id),
        floors: form.floors,
        description: form.description,
        created_by: actor.id,
      });
      notify("Ticket created successfully.");
      onCreated(ticket);
    } catch (e) {
      // Server-side validation wins: surface field errors next to the fields.
      setErrors({ ...e.fields, _form: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create New Ticket</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {errors._form && <Alert severity="error">{errors._form}</Alert>}

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" align="center" gutterBottom>
              Quick Issues — tap to autofill
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
              {quickIssues.map((issue) => (
                <Chip
                  key={issue.id}
                  label={issue.name}
                  onClick={() => toggleQuickIssue(issue)}
                  color={form.issues.some((i) => i.id === issue.id) ? "primary" : "default"}
                  variant={form.issues.some((i) => i.id === issue.id) ? "filled" : "outlined"}
                />
              ))}
            </Stack>
          </Paper>

          <FormControl fullWidth error={Boolean(errors.office)}>
            <InputLabel id="office-label">Office *</InputLabel>
            <Select
              labelId="office-label"
              label="Office *"
              value={form.office}
              onChange={(e) => setForm((f) => ({ ...f, office: e.target.value, floors: [] }))}
            >
              {offices.map((o) => (
                <MenuItem key={o.id} value={o.id}>
                  {o.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Autocomplete
            multiple
            options={issueTypes}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={form.issues}
            onChange={(_, value) => setForm((f) => ({ ...f, issues: value }))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Issue(s) *"
                placeholder="Type or search issue"
                error={Boolean(errors.issues)}
                helperText={errors.issues}
              />
            )}
          />

          {/* Floor selection only appears when the office actually has multiple floors. */}
          {office?.has_multiple_floors && (
            <FormControl fullWidth error={Boolean(errors.floors)}>
              <InputLabel id="floors-label">Floor(s)</InputLabel>
              <Select
                labelId="floors-label"
                multiple
                value={form.floors}
                onChange={(e) => setForm((f) => ({ ...f, floors: e.target.value }))}
                input={<OutlinedInput label="Floor(s) *" />}
                renderValue={(selected) =>
                  office.floors
                    .filter((f) => selected.includes(f.id))
                    .map((f) => f.label)
                    .join(", ")
                }
              >
                {office.floors.map((floor) => (
                  <MenuItem key={floor.id} value={floor.id}>
                    {floor.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography
                variant="caption"
                color={errors.floors ? "error" : "text.secondary"}
                sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}
              >
                <InfoIcon fontSize="inherit" />
                {errors.floors ?? "Your office has multiple floors — select where the issue is."}
              </Typography>
            </FormControl>
          )}

          <TextField
            label="Description"
            placeholder="Describe the issue (optional)"
            multiline
            minRows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button color="error" variant="contained" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button color="success" variant="contained" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
