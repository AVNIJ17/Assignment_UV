import Chip from "@mui/material/Chip";
import PendingIcon from "@mui/icons-material/HourglassEmpty";
import DoneIcon from "@mui/icons-material/CheckCircleOutline";

import { STATUS_META } from "../constants.js";

/** Reusable status pill used on the listing cards and the detail header. */
export default function StatusChip({ status, size = "small" }) {
  const meta = STATUS_META[status] ?? { label: status, color: "default" };
  const closed = status === "RESOLVED" || status === "CLOSED";
  return (
    <Chip
      size={size}
      variant="outlined"
      color={meta.color}
      icon={closed ? <DoneIcon /> : <PendingIcon />}
      label={meta.label}
    />
  );
}
