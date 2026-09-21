import Chip from "@mui/material/Chip";

import { PRIORITY_COLOR } from "../constants.js";

export default function PriorityChip({ priority, label }) {
  return (
    <Chip
      size="small"
      color={PRIORITY_COLOR[priority] ?? "default"}
      label={label ?? priority}
      sx={{ fontWeight: 600 }}
    />
  );
}
