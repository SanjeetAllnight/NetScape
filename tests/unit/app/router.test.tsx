import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createHashRouter } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { ProjectsPlaceholder } from "@/features/projects/ProjectsPlaceholder";
import { CatalogPlaceholder } from "@/features/catalog/CatalogPlaceholder";
import { SettingsPlaceholder } from "@/features/settings/SettingsPlaceholder";
import { MapWorkspacePlaceholder } from "@/features/map/MapWorkspacePlaceholder";
import { TopologyPlaceholder } from "@/features/topology/TopologyPlaceholder";
import { AddressingPlaceholder } from "@/features/addressing/AddressingPlaceholder";
import { CostPlaceholder } from "@/features/cost/CostPlaceholder";
import { SimulationPlaceholder } from "@/features/simulation/SimulationPlaceholder";
import { ReportPlaceholder } from "@/features/reports/ReportPlaceholder";
import { ComparisonPlaceholder } from "@/features/comparison/ComparisonPlaceholder";
import { ProjectRedirectPlaceholder } from "@/features/projects/ProjectRedirectPlaceholder";
import { ProjectDesignsPlaceholder } from "@/features/projects/ProjectDesignsPlaceholder";
import { NotFound } from "@/app/NotFound";

describe("Application Shell and Hash-Router Skeleton", () => {
  function renderWithRoute(initialHash: string) {
    window.location.hash = initialHash;

    const testRouter = createHashRouter([
      {
        path: "/",
        element: <AppShell />,
        errorElement: <NotFound />,
        children: [
          { index: true, element: <ProjectsPlaceholder /> },
          { path: "catalog", element: <CatalogPlaceholder /> },
          { path: "settings", element: <SettingsPlaceholder /> },
          { path: "projects/:projectId", element: <ProjectRedirectPlaceholder /> },
          { path: "projects/:projectId/designs", element: <ProjectDesignsPlaceholder /> },
          { path: "projects/:projectId/designs/:designId/map", element: <MapWorkspacePlaceholder /> },
          { path: "projects/:projectId/designs/:designId/topology", element: <TopologyPlaceholder /> },
          { path: "projects/:projectId/designs/:designId/addressing", element: <AddressingPlaceholder /> },
          { path: "projects/:projectId/designs/:designId/cost", element: <CostPlaceholder /> },
          { path: "projects/:projectId/designs/:designId/simulation", element: <SimulationPlaceholder /> },
          { path: "projects/:projectId/designs/:designId/report", element: <ReportPlaceholder /> },
          { path: "projects/:projectId/compare", element: <ComparisonPlaceholder /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ]);

    return render(<RouterProvider router={testRouter} />);
  }

  it("renders the shell with NetScape identity and Phase 0 status banner", () => {
    renderWithRoute("#/");
    expect(screen.getByText("NetScape")).toBeInTheDocument();
    expect(screen.getByText("Phase 0")).toBeInTheDocument();
    expect(screen.getByText(/Projects dashboard module is not implemented yet/i)).toBeInTheDocument();
  });

  it("resolves catalog route skeleton", () => {
    renderWithRoute("#/catalog");
    expect(screen.getByText("Device Catalog")).toBeInTheDocument();
  });

  it("resolves settings route skeleton", () => {
    renderWithRoute("#/settings");
    expect(screen.getByText("Application Settings")).toBeInTheDocument();
  });

  it("resolves map workspace route with params", () => {
    renderWithRoute("#/projects/p1/designs/d1/map");
    expect(screen.getByText(/Map Workspace \(Project: p1, Design: d1\)/i)).toBeInTheDocument();
  });

  it("resolves topology workspace route with params", () => {
    renderWithRoute("#/projects/p1/designs/d1/topology");
    expect(screen.getByText(/Logical Topology \(Project: p1, Design: d1\)/i)).toBeInTheDocument();
  });

  it("resolves addressing route with params", () => {
    renderWithRoute("#/projects/p1/designs/d1/addressing");
    expect(screen.getByText(/IPv4 Addressing & VLSM \(Project: p1, Design: d1\)/i)).toBeInTheDocument();
  });

  it("resolves cost route with params", () => {
    renderWithRoute("#/projects/p1/designs/d1/cost");
    expect(screen.getByText(/Cost Analysis \(Project: p1, Design: d1\)/i)).toBeInTheDocument();
  });

  it("resolves simulation route with params", () => {
    renderWithRoute("#/projects/p1/designs/d1/simulation");
    expect(screen.getByText(/Network Simulation \(Project: p1, Design: d1\)/i)).toBeInTheDocument();
  });

  it("resolves report route with params", () => {
    renderWithRoute("#/projects/p1/designs/d1/report");
    expect(screen.getByText(/PDF Report Preview \(Project: p1, Design: d1\)/i)).toBeInTheDocument();
  });

  it("resolves compare route with params", () => {
    renderWithRoute("#/projects/p1/compare?a=d1&b=d2");
    expect(screen.getByText(/Design Comparison \(Project: p1\)/i)).toBeInTheDocument();
  });

  it("renders 404 for unknown route", () => {
    renderWithRoute("#/unknown/route");
    expect(screen.getByText(/404 — Page Not Found/i)).toBeInTheDocument();
  });
});
