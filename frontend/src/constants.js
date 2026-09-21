export const STATUS_META = {
  PENDING_ASSIGNMENT: { label: "Pending Technician Assignment", color: "warning" },
  PENDING_ASSESSMENT: { label: "Pending Technician Assessment", color: "warning" },
  PENDING_POC_REVIEW: { label: "Pending Department POC Review", color: "info" },
  RESOLVED: { label: "Resolved", color: "success" },
  CLOSED: { label: "Closed", color: "default" },
};

export const PRIORITY_COLOR = {
  UNSET: "default",
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  CRITICAL: "error",
};

export const ASSESSMENT_OPTIONS = [
  {
    value: "FULLY_RESOLVED",
    label: "Mark Fully Resolved",
    help: "This issue has been fully resolved. No further action is needed.",
  },
  {
    value: "PARTIALLY_RESOLVED",
    label: "Mark Partially Resolved",
    help: "I've resolved my part of the issue, but it also involves another department or worker.",
  },
  {
    value: "SUGGEST_CHANGE",
    label: "Suggest Department/Worker Change",
    help: "The issue is outside my scope. Please assign it to the correct department or worker.",
  },
];

/** Which role currently owns the next step. Mirrors Ticket.action_required_for. */
export const ACTION_OWNER = {
  PENDING_ASSIGNMENT: "DEPARTMENT_POC",
  PENDING_ASSESSMENT: "TECHNICIAN",
  PENDING_POC_REVIEW: "DEPARTMENT_POC",
};

export const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
