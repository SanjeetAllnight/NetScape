import { createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { NotFound } from "./NotFound";
import { ProjectsView } from "@/features/projects/ProjectsView";
import { ProjectRedirectPlaceholder } from "@/features/projects/ProjectRedirectPlaceholder";
import { ProjectDesignsPlaceholder } from "@/features/projects/ProjectDesignsPlaceholder";
import { CatalogPlaceholder } from "@/features/catalog/CatalogPlaceholder";
import { SettingsPlaceholder } from "@/features/settings/SettingsPlaceholder";
import { MapWorkspaceView } from "@/features/map/MapWorkspaceView";
import { TopologyView } from "@/features/topology/TopologyView";
import { AddressingView } from "@/features/addressing/AddressingView";
import { CostView } from "@/features/cost/CostView";
import { SimulationPlaceholder } from "@/features/simulation/SimulationPlaceholder";
import { ReportPlaceholder } from "@/features/reports/ReportPlaceholder";
import { ComparisonPlaceholder } from "@/features/comparison/ComparisonPlaceholder";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFound />,
    children: [
      {
        index: true,
        element: <ProjectsView />,
      },
      {
        path: "catalog",
        element: <CatalogPlaceholder />,
      },
      {
        path: "settings",
        element: <SettingsPlaceholder />,
      },
      {
        path: "projects/:projectId",
        element: <ProjectRedirectPlaceholder />,
      },
      {
        path: "projects/:projectId/designs",
        element: <ProjectDesignsPlaceholder />,
      },
      {
        path: "projects/:projectId/designs/:designId/map",
        element: <MapWorkspaceView />,
      },
      {
        path: "projects/:projectId/designs/:designId/topology",
        element: <TopologyView />,
      },
      {
        path: "projects/:projectId/designs/:designId/addressing",
        element: <AddressingView />,
      },
      {
        path: "projects/:projectId/designs/:designId/cost",
        element: <CostView />,
      },
      {
        path: "projects/:projectId/designs/:designId/simulation",
        element: <SimulationPlaceholder />,
      },
      {
        path: "projects/:projectId/designs/:designId/report",
        element: <ReportPlaceholder />,
      },
      {
        path: "projects/:projectId/compare",
        element: <ComparisonPlaceholder />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

