const BASE = "/api";

async function request(path, { method = "GET", body, actorId } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(actorId ? { "X-Actor-Id": String(actorId) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(flattenError(data) || `Request failed (${response.status})`);
    error.status = response.status;
    error.fields = data && typeof data === "object" ? data : {};
    throw error;
  }
  return data;
}

function flattenError(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join(" ");
  return Object.entries(data)
    .map(([key, value]) => {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      return key === "detail" || key === "non_field_errors" ? text : `${key}: ${text}`;
    })
    .join(" ");
}

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined && v.length !== 0)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

export const api = {
  bootstrap: () => request("/bootstrap/"),
  listTickets: (params) => request(`/tickets/?${qs(params)}`),
  getTicket: (id) => request(`/tickets/${id}/`),
  createTicket: (body) => request("/tickets/", { method: "POST", body }),
  assignWorker: (id, body, actorId) =>
    request(`/tickets/${id}/assign-worker/`, { method: "POST", body, actorId }),
  changeDepartment: (id, department, actorId) =>
    request(`/tickets/${id}/change-department/`, { method: "POST", body: { department }, actorId }),
  submitAssessment: (id, body, actorId) =>
    request(`/tickets/${id}/assessment/`, { method: "POST", body, actorId }),
  markResolved: (id, actorId) =>
    request(`/tickets/${id}/mark-resolved/`, { method: "POST", actorId }),
  reopen: (id, actorId) => request(`/tickets/${id}/reopen/`, { method: "POST", actorId }),
  addComment: (id, body, actorId) =>
    request(`/tickets/${id}/comments/`, { method: "POST", body: { body }, actorId }),
};

export { flattenError };
