import type {
  AddressingService,
  AddressingSnapshot,
} from "@/contracts/services";
import type { DesignSession, DispatchResult } from "@/contracts/commands";
import type { ValidationIssue } from "@/contracts/errors";
import type { Repositories } from "@/contracts/storage";
import type { DesignId, IPv4Cidr, EpochMs } from "@/contracts/primitives";
import type { VlsmEngineOutput, ParsedIPv4Cidr } from "@/contracts/engines";
import { allocateVlsm } from "@/engines/ip";
import { parseCidr, ipv4ToUint32, prefixToNetmask } from "@/engines/ip/ipEngine";

export class DefaultAddressingService implements AddressingService {
  constructor(
    private readonly repos: Repositories,
    private readonly designSession: DesignSession
  ) {}

  async getSnapshot(designId: DesignId): Promise<AddressingSnapshot> {
    const aggregate = await this.repos.designs.loadAggregate(designId);
    if (!aggregate) {
      throw new Error(`Design '${designId}' not found`);
    }

    const { design, subnetsById } = aggregate;
    const subnets = Object.values(subnetsById);
    const parentCidr = design.addressing.parentCidr;

    let preview: VlsmEngineOutput | null = null;
    let isPreviewCurrent = false;

    if (parentCidr) {
      try {
        preview = allocateVlsm({
          parentCidr,
          subnets: subnets.map((s) => ({
            subnetId: s.id,
            name: s.name,
            hostsRequired: s.hostsRequired,
          })),
        });
        isPreviewCurrent = design.addressing.allocationStatus === "current";
      } catch {
        preview = null;
        isPreviewCurrent = false;
      }
    }

    return {
      designId,
      parentCidr,
      allocationStatus: design.addressing.allocationStatus,
      subnets,
      preview,
      isPreviewCurrent,
    };
  }

  async setParentCidr(
    _designId: DesignId,
    parentCidr: IPv4Cidr | null
  ): Promise<DispatchResult> {
    return this.designSession.dispatch({
      type: "addressing/setParentCidr",
      parentCidr,
    });
  }

  async allocate(designId: DesignId): Promise<VlsmEngineOutput> {
    const aggregate = await this.repos.designs.loadAggregate(designId);
    if (!aggregate) {
      throw new Error(`Design '${designId}' not found`);
    }

    const parentCidr = aggregate.design.addressing.parentCidr;
    if (!parentCidr) {
      throw new Error("Cannot allocate VLSM: parent CIDR is not configured.");
    }

    const subnets = Object.values(aggregate.subnetsById);
    const output = allocateVlsm({
      parentCidr,
      subnets: subnets.map((s) => ({
        subnetId: s.id,
        name: s.name,
        hostsRequired: s.hostsRequired,
      })),
    });

    const dispatchResult = await this.designSession.dispatch({
      type: "addressing/applyAllocation",
      parentCidr,
      allocations: output.allocations,
      allocatedAt: Date.now() as EpochMs,
    });

    if (dispatchResult.status === "rejected") {
      throw new Error(
        `Failed to commit VLSM allocation: ${dispatchResult.issues
          .map((i: ValidationIssue) => i.message)
          .join(", ")}`
      );
    }

    return output;
  }

  validateCidr(cidr: string): { valid: boolean; error?: string; parsed?: ParsedIPv4Cidr } {
    const trimmed = cidr.trim();
    if (!trimmed) {
      return { valid: false, error: "Parent network CIDR is required" };
    }
    const match = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(trimmed);
    if (!match || !match[1] || !match[2]) {
      return { valid: false, error: "Must be a valid IPv4 CIDR string (e.g. 192.168.1.0/24)" };
    }
    const prefix = parseInt(match[2], 10);
    if (prefix < 8 || prefix > 30) {
      return { valid: false, error: "Prefix length must be between /8 and /30" };
    }
    try {
      const parsed = parseCidr(trimmed as IPv4Cidr);
      const uint = ipv4ToUint32(parsed.address);
      const mask = prefixToNetmask(parsed.prefix);
      if ((uint & (~mask >>> 0)) !== 0) {
        return {
          valid: false,
          error: `Non-canonical network address. Host bits must be zero (did you mean ${parsed.networkAddress}/${parsed.prefix}?)`,
        };
      }
      return { valid: true, parsed };
    } catch (e: unknown) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid IPv4 CIDR" };
    }
  }
}
