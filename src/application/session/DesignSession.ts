/**
 * DesignSession implementation.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §7.4, §17.4
 *
 * Requirements:
 * - Serialize commands via per-design promise queue
 * - Injects CommandStamp, IDs, and current time before applyCommand
 * - Enforces commit-then-project pattern: projects to Zustand only after successful Dexie commit
 * - Never leaves partial or optimistic state on transaction failure
 * - Emits typed design lifecycle events
 */

import type {
  DesignSession,
  DesignCommand,
  DispatchResult,
  CommandStamp,
  GeneratedCommandIds,
} from "@/contracts/commands";
import type {
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  FlowId,
  FailureScenarioId,
  EpochMs,
} from "@/contracts/primitives";
import type { DesignAggregate } from "@/contracts/domain";
import type { Repositories, RevisionExpectation } from "@/contracts/storage";
import type { DesignCommittedEvent } from "@/contracts/services";
import type { ValidationIssue } from "@/contracts/errors";
import { applyCommand } from "@/domain/commands/applyCommand";
import { useDesignStore } from "@/stores/designStore";

export class DefaultDesignSession implements DesignSession {
  private currentAggregate: DesignAggregate | null = null;
  private currentDesignId: DesignId | null = null;
  private queue: Promise<any> = Promise.resolve();

  private readonly listeners = {
    committed: new Set<(event: DesignCommittedEvent) => void>(),
    opened: new Set<(payload: { designId: DesignId }) => void>(),
    closed: new Set<(payload: { designId: DesignId }) => void>(),
    rejected: new Set<(payload: { command: DesignCommand; issues: ValidationIssue[] }) => void>(),
  };

  constructor(private readonly repos: Repositories) {}

  getAggregate(): DesignAggregate | null {
    return this.currentAggregate;
  }

  getActiveDesignId(): DesignId | null {
    return this.currentDesignId;
  }

  async open(designId: DesignId): Promise<DesignAggregate> {
    useDesignStore.getState().setSaveStatus("saving");
    try {
      const aggregate = await this.repos.designs.loadAggregate(designId);
      if (!aggregate) {
        throw new Error(`Design aggregate not found for design '${designId}'`);
      }

      this.currentAggregate = aggregate;
      this.currentDesignId = designId;

      useDesignStore.getState().setAggregate(aggregate);
      useDesignStore.getState().setSaveStatus("saved");

      for (const listener of this.listeners.opened) {
        listener({ designId });
      }

      return aggregate;
    } catch (err: any) {
      useDesignStore.getState().setSaveStatus("error", err?.message ?? "Failed to open design");
      throw err;
    }
  }

  dispatch(command: DesignCommand): Promise<DispatchResult> {
    const execute = async (): Promise<DispatchResult> => {
      if (!this.currentAggregate || !this.currentDesignId) {
        throw new Error("No active design session. Call open() first.");
      }

      useDesignStore.getState().setSaveStatus("saving");

      const now = Date.now() as EpochMs;
      const stamp: CommandStamp = {
        commandId: `cmd_${crypto.randomUUID()}`,
        committedAt: now,
      };

      const generatedIds: GeneratedCommandIds = {
        device: [`dev_${crypto.randomUUID()}` as DeviceId],
        link: [`link_${crypto.randomUUID()}` as LinkId],
        subnet: [`sub_${crypto.randomUUID()}` as SubnetId],
        obstacle: [`obs_${crypto.randomUUID()}` as ObstacleId],
        flow: [`flow_${crypto.randomUUID()}` as FlowId],
        failureScenario: [`fail_${crypto.randomUUID()}` as FailureScenarioId],
      };

      const result = applyCommand(this.currentAggregate, {
        command,
        stamp,
        generatedIds,
      });

      if (!result.ok) {
        useDesignStore.getState().setSaveStatus("saved");
        for (const listener of this.listeners.rejected) {
          listener({ command, issues: result.issues });
        }
        return {
          status: "rejected",
          issues: result.issues,
        };
      }

      // Commit to Dexie IndexedDB
      try {
        const expected: RevisionExpectation = {
          projectRevision: this.currentAggregate.project.revision,
          designRevision: this.currentAggregate.design.revision,
        };
        await this.repos.designs.commit(result.changeSet, expected);
      } catch (err: any) {
        useDesignStore.getState().setSaveStatus("error", err?.message ?? "Storage commit failed");
        throw err;
      }

      // Successful commit! Update internal aggregate and project to Zustand store
      this.currentAggregate = result.nextAggregate;
      useDesignStore.getState().setAggregate(result.nextAggregate);
      useDesignStore.getState().setSaveStatus("saved");

      const committedEvent: DesignCommittedEvent = {
        projectId: result.nextAggregate.project.id,
        designId: result.nextAggregate.design.id,
        changeSet: result.changeSet,
        projectRevision: result.nextAggregate.project.revision,
        designRevision: result.nextAggregate.design.revision,
      };

      for (const listener of this.listeners.committed) {
        listener(committedEvent);
      }

      const warnings = result.changeSet.validationIssues.filter((i) => i.severity === "warning");

      return {
        status: "committed",
        designRevision: result.nextAggregate.design.revision,
        projectRevision: result.nextAggregate.project.revision,
        changeSet: result.changeSet,
        warnings,
      };
    };

    // Chain serialized promise
    this.queue = this.queue.then(execute, execute);
    return this.queue;
  }

  async close(): Promise<void> {
    await this.flushPendingDrafts();
    const prevDesignId = this.currentDesignId;
    this.currentAggregate = null;
    this.currentDesignId = null;
    useDesignStore.getState().reset();

    if (prevDesignId) {
      for (const listener of this.listeners.closed) {
        listener({ designId: prevDesignId });
      }
    }
  }

  async flushPendingDrafts(): Promise<void> {
    await this.queue;
  }

  on(event: "committed", listener: (payload: DesignCommittedEvent) => void): () => void;
  on(event: "opened", listener: (payload: { designId: DesignId }) => void): () => void;
  on(event: "closed", listener: (payload: { designId: DesignId }) => void): () => void;
  on(
    event: "rejected",
    listener: (payload: { command: DesignCommand; issues: ValidationIssue[] }) => void
  ): () => void;
  on(event: string, listener: (...args: any[]) => void): () => void {
    const set = (this.listeners as any)[event] as Set<any> | undefined;
    if (set) {
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    }
    return () => {};
  }
}
