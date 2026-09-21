import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TicketCard from "../components/TicketCard.jsx";

const ticket = {
  id: 7,
  title: "AC not cooling",
  location: "Harness-1317; 2F, 3F",
  status: "PENDING_ASSIGNMENT",
  status_display: "Pending Technician Assignment",
  priority: "HIGH",
  priority_display: "High",
  is_open: true,
  created_at: "2025-10-27T11:40:00Z",
  created_by: { id: 1, name: "Chaitanya M", role_display: "Client POC", initials: "CM" },
  assignees: [
    { id: 3, name: "Dhananjaya Murthy", role_display: "Technical Manager", initials: "DM" },
  ],
};

describe("TicketCard", () => {
  it("renders the ticket summary, status and assignees", () => {
    render(<TicketCard ticket={ticket} actorRole="CLIENT_POC" onView={() => {}} />);

    expect(screen.getByText("AC not cooling")).toBeInTheDocument();
    expect(screen.getByText("Harness-1317; 2F, 3F")).toBeInTheDocument();
    expect(screen.getByText("Pending Technician Assignment")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText(/Dhananjaya Murthy/)).toBeInTheDocument();
  });

  it("shows 'Action Required' only for the role that owns the next step", () => {
    const { rerender } = render(
      <TicketCard ticket={ticket} actorRole="CLIENT_POC" onView={() => {}} />
    );
    expect(screen.queryByText("Action Required")).not.toBeInTheDocument();

    // PENDING_ASSIGNMENT is owned by the Department POC.
    rerender(<TicketCard ticket={ticket} actorRole="DEPARTMENT_POC" onView={() => {}} />);
    expect(screen.getByText("Action Required")).toBeInTheDocument();
  });

  it("calls onView with the ticket id when View is clicked", async () => {
    const onView = vi.fn();
    render(<TicketCard ticket={ticket} actorRole="CLIENT_POC" onView={onView} />);

    await userEvent.click(screen.getByRole("button", { name: /view/i }));
    expect(onView).toHaveBeenCalledWith(7);
  });
});
