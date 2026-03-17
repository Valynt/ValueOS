import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, vi } from "vitest";

import {
  AgentResponseCard,
  AgentWorkflowPanel,
  Breadcrumbs,
  ConfirmationDialog,
  DataTable,
  ExpansionBlock,
  InfoBanner,
  ProgressBar,
  ScenarioSelector,
  SDUIForm,
  SideNavigation,
  TabBar,
  TextBlock,
  ValueCommitForm,
} from "./index";

describe("ValyntApp SDUI components", () => {
  it("renders content components", () => {
    render(
      <div>
        <InfoBanner title="Notice" description="Aligned" tone="info" />
        <TextBlock text="Body" />
        <DataTable headers={["A"]} data={[["1"]]} aria-label="table" />
        <ProgressBar value={10} max={100} aria-label="progress" />
      </div>
    );

    expect(screen.getByText("Notice")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "table" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "progress" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("handles navigation interactions", () => {
    const onNavigate = vi.fn();
    const onTab = vi.fn();
    const onSideSelect = vi.fn();
    const onScenarioChange = vi.fn();

    render(
      <div>
        <Breadcrumbs items={[{ id: "1", label: "Home" }]} onNavigate={onNavigate} />
        <TabBar tabs={[{ id: "a", label: "Overview" }]} onChange={onTab} />
        <SideNavigation items={[{ id: "nav", label: "Details" }]} onSelect={onSideSelect} />
        <ScenarioSelector scenarios={[{ id: "base", label: "Base" }]} selectedId="base" onChange={onScenarioChange} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "base" } });

    expect(onNavigate).toHaveBeenCalledWith({ id: "1", label: "Home" });
    expect(onTab).toHaveBeenCalledWith("a");
    expect(onSideSelect).toHaveBeenCalledWith("nav");
    expect(onScenarioChange).toHaveBeenCalledWith("base");
  });

  it("handles workflow and form interactions", () => {
    const onSduiSubmit = vi.fn();
    const onCommitSubmit = vi.fn();
    const onConfirm = vi.fn();

    render(
      <div>
        <AgentResponseCard response="Output" reasoning="Steps" confidence={70} />
        <AgentWorkflowPanel agents={[{ id: "ag", name: "OpportunityAgent", status: "running" }]} />
        <ExpansionBlock title="Details" content="Expanded content" />
        <SDUIForm fields={[{ name: "company", label: "Company", type: "text" }]} onSubmit={onSduiSubmit} submitText="Save form" />
        <ValueCommitForm onSubmit={onCommitSubmit} />
        <ConfirmationDialog open title="Confirm" onConfirm={onConfirm} />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show reasoning" }));
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("OpportunityAgent")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(screen.getByText("Expanded content")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    expect(onSduiSubmit).toHaveBeenCalledWith({ company: "Acme" });

    fireEvent.change(screen.getByPlaceholderText("Owner"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText("Commitment"), { target: { value: "Increase conversion" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onCommitSubmit).toHaveBeenCalledWith({ owner: "Alex", commitment: "Increase conversion" });

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
