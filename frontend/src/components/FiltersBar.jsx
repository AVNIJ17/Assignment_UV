import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";

/** Search + filters + sort controls for the listing. Fully controlled. */
export default function FiltersBar({ value, onChange, departments, priorities }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2 }}>
      <TextField
        fullWidth
        size="small"
        label="Search bar"
        placeholder="Search by issue, description or office"
        value={value.search}
        onChange={(e) => set({ search: e.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel id="priority-label">Priority</InputLabel>
        <Select
          labelId="priority-label"
          multiple
          value={value.priority}
          onChange={(e) => set({ priority: e.target.value })}
          input={<OutlinedInput label="Priority" />}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {selected.map((p) => (
                <Chip key={p} label={p} size="small" />
              ))}
            </Box>
          )}
        >
          {priorities.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="dept-label">Department</InputLabel>
        <Select
          labelId="dept-label"
          label="Department"
          value={value.department}
          onChange={(e) => set({ department: e.target.value })}
        >
          <MenuItem value="">All</MenuItem>
          {departments.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="sort-label">Sort</InputLabel>
        <Select
          labelId="sort-label"
          label="Sort"
          value={value.sort}
          onChange={(e) => set({ sort: e.target.value })}
        >
          <MenuItem value="newest">Newest first</MenuItem>
          <MenuItem value="oldest">Oldest first</MenuItem>
          <MenuItem value="recently_updated">Recently updated</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}
