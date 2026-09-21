import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";

import CreateTicketDialog from "./components/CreateTicketDialog.jsx";
import StateView from "./components/StateView.jsx";
import TicketDetailPage from "./pages/TicketDetailPage.jsx";
import TicketListPage from "./pages/TicketListPage.jsx";
import { useApp } from "./context/AppContext.jsx";

export default function App() {
  const { loading, error, reload, people, actorId, setActorId } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: 1 }}>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Ticket Desk
          </Typography>

          {/* No authentication in this assignment: the acting user is switched here. */}
          <FormControl size="small" sx={{ minWidth: 230 }}>
            <InputLabel id="actor-label">Acting as</InputLabel>
            <Select
              labelId="actor-label"
              label="Acting as"
              value={actorId ?? ""}
              onChange={(e) => setActorId(e.target.value)}
            >
              {people.map((person) => (
                <MenuItem key={person.id} value={person.id}>
                  {person.name} — {person.role_display}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Create New Ticket
          </Button>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ py: 3 }}>
        <StateView loading={loading} error={error} onRetry={reload}>
          <Stack>
            <Routes>
              <Route path="/" element={<TicketListPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Stack>
        </StateView>
      </Container>

      <CreateTicketDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(ticket) => {
          setDialogOpen(false);
          navigate(`/tickets/${ticket.id}`);
        }}
      />
    </Box>
  );
}
