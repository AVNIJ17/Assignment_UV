import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

/**
 * One component for the loading / error / empty states so every screen
 * handles them the same way.
 */
export default function StateView({ loading, error, empty, emptyText, onRetry, children }) {
  if (loading) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }} role="status" aria-live="polite">
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading…
        </Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ my: 2 }}
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      >
        {error}
      </Alert>
    );
  }
  if (empty) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
        <Typography variant="h6">Nothing here yet</Typography>
        <Typography variant="body2">{emptyText ?? "No records match your filters."}</Typography>
      </Box>
    );
  }
  return children;
}
