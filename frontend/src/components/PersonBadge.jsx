import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";

/** Small avatar + name chip, e.g. "CM Chaitanya M (Client POC)". */
export default function PersonBadge({ person, showRole = true }) {
  if (!person) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      avatar={<Avatar sx={{ fontSize: 11 }}>{person.initials}</Avatar>}
      label={showRole ? `${person.name} (${person.role_display})` : person.name}
    />
  );
}
