import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import CreateTicketDialog from "../components/CreateTicketDialog.jsx";
import * as AppContext from "../context/AppContext.jsx";

const office = {
  id: 1,
  name: "Harness-1317",
  has_multiple_floors: true,
  floors: [
    { id: 1, label: "2F" },
    { id: 2, label: "3F" },
  ],
};

const singleFloorOffice = {
  id: 2,
  name: "Nimbus-88",
  has_multiple_floors: false,
  floors: [{ id: 3, label: "4F" }],
};

const issueTypes = [
  { id: 10, name: "AC not cooling", is_quick_issue: true },
  { id: 11, name: "Water leakage", is_quick_issue: false },
];

function mockApp(offices) {
  vi.spyOn(AppContext, "useApp").mockReturnValue({
    issueTypes,
    offices,
    departments: [],
    people: [],
    actor: { id: 1, name: "Chaitanya M", office: offices[0].id },
    notify: vi.fn(),
  });
}

describe("CreateTicketDialog", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("blocks submission when no issue is selected and shows a field error", async () => {
    mockApp([office]);
    render(<CreateTicketDialog open onClose={() => {}} onCreated={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Select at least one issue.")).toBeInTheDocument();
  });

  it("requires a floor for a multi-floor office", async () => {
    mockApp([office]);
    render(<CreateTicketDialog open onClose={() => {}} onCreated={() => {}} />);

    // Quick-issue chip autofills the Issue(s) field.
    await userEvent.click(screen.getByText("AC not cooling"));
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText("Select at least one floor.")).toBeInTheDocument();
  });

  it("hides the floor selector for a single-floor office", () => {
    mockApp([singleFloorOffice]);
    render(<CreateTicketDialog open onClose={() => {}} onCreated={() => {}} />);

    expect(screen.queryByText(/Your office has multiple floors/)).not.toBeInTheDocument();
  });
});
