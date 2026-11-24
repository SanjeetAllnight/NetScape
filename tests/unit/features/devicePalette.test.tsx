import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DevicePalette } from "@/features/designer/DevicePalette";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import type { CatalogItemId } from "@/contracts/primitives";

describe("DevicePalette Tool Activation", () => {
  beforeEach(() => {
    useEditorStore.getState().resetEditor();
    useDesignStore.setState({ aggregate: null });
  });

  it("activates draw-boundary mode when Boundary button is clicked, even from place-device", () => {
    useEditorStore.getState().setCatalogItemIdToPlace("cat-router" as CatalogItemId);
    expect(useEditorStore.getState().activeTool).toBe("place-device");

    render(<DevicePalette />);

    const boundaryBtn = screen.getByTitle("Draw Planning Boundary (Geoman)");
    fireEvent.click(boundaryBtn);

    expect(useEditorStore.getState().activeTool).toBe("draw-boundary");
    expect(useEditorStore.getState().catalogItemIdToPlace).toBeNull();
    expect(screen.getByText("Click points to draw boundary")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("dispatches finish-draw event on Finish and cancels back to select on Cancel", () => {
    const finishSpy = vi.fn();
    window.addEventListener("netscape:finish-draw", finishSpy);

    render(<DevicePalette />);

    fireEvent.click(screen.getByTitle("Draw Planning Boundary (Geoman)"));
    expect(useEditorStore.getState().activeTool).toBe("draw-boundary");

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(finishSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useEditorStore.getState().activeTool).toBe("select");

    window.removeEventListener("netscape:finish-draw", finishSpy);
  });

  it("activates draw-obstacle mode when Obstacle button is clicked", () => {
    render(<DevicePalette />);

    fireEvent.click(screen.getByTitle("Draw Manual Obstacle Polygon"));

    expect(useEditorStore.getState().activeTool).toBe("draw-obstacle");
    expect(screen.getByText("Click points to draw obstacle")).toBeTruthy();
  });
});
