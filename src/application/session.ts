/**
 * Application session and active-project lifecycle state.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17
 */

import type { ProjectId, DesignId } from "@/contracts/primitives";
import type { Project, Design } from "@/contracts/domain";

export interface SessionState {
  activeProjectId: ProjectId | null;
  activeDesignId: DesignId | null;
  project: Project | null;
  designs: Design[];
}

export class SessionManager {
  private state: SessionState = {
    activeProjectId: null,
    activeDesignId: null,
    project: null,
    designs: [],
  };

  private listeners = new Set<(state: SessionState) => void>();

  getState(): SessionState {
    return { ...this.state };
  }

  setSession(project: Project, designs: Design[], activeDesignId: DesignId): void {
    this.state = {
      activeProjectId: project.id,
      activeDesignId,
      project,
      designs,
    };
    this.notify();
  }

  setActiveDesign(designId: DesignId): void {
    if (this.state.activeDesignId !== designId) {
      this.state.activeDesignId = designId;
      this.notify();
    }
  }

  clear(): void {
    this.state = {
      activeProjectId: null,
      activeDesignId: null,
      project: null,
      designs: [],
    };
    this.notify();
  }

  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }
}

export { DefaultDesignSession } from "./session/DesignSession";


