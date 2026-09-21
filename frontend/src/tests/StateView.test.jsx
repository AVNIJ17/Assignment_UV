import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import StateView from "../components/StateView.jsx";

describe("StateView", () => {
  it("shows a spinner while loading and hides the children", () => {
    render(
      <StateView loading>
        <p>content</p>
      </StateView>
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("shows the API error and retries on demand", async () => {
    const onRetry = vi.fn();
    render(
      <StateView error="Network unreachable" onRetry={onRetry}>
        <p>content</p>
      </StateView>
    );
    expect(screen.getByText("Network unreachable")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state message when there are no records", () => {
    render(
      <StateView empty emptyText="No open tickets match your filters.">
        <p>content</p>
      </StateView>
    );
    expect(screen.getByText("No open tickets match your filters.")).toBeInTheDocument();
  });

  it("renders children when there is data", () => {
    render(
      <StateView>
        <p>content</p>
      </StateView>
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
