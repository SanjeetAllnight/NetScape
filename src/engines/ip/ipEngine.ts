/**
 * Pure deterministic IPv4 and VLSM Engine.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §11, §19.1
 *
 * Implements:
 * - CIDR parsing and format validation
 * - Canonical network address alignment checks
 * - Traditional host model arithmetic (/31 and /32 yield 0 usable hosts)
 * - VLSM power-of-two block allocation (descending size, then lexical subnetId)
 * - Remaining unallocated address space computation
 */

import type { IPv4Address, IPv4Cidr, SubnetId } from "@/contracts/primitives";
import type {
  ParsedIPv4Cidr,
  VlsmEngineInput,
  VlsmEngineOutput,
  VlsmSubnetAllocation,
  UnallocatedSubnet,
  IpEngine,
} from "@/contracts/engines";
import { EngineInputError } from "@/contracts/errors";

export class IpError extends EngineInputError {
  readonly issueCode: "INVALID_CIDR" | "HOST_REQUIREMENT_INVALID" | "INSUFFICIENT_ADDRESS_SPACE";

  constructor(
    issueCode: "INVALID_CIDR" | "HOST_REQUIREMENT_INVALID" | "INSUFFICIENT_ADDRESS_SPACE",
    message: string
  ) {
    super(message, { issueCode });
    this.name = "IpError";
    this.issueCode = issueCode;
  }
}

/**
 * Converts a dotted-decimal IPv4 string to an unsigned 32-bit integer.
 */
export function ipv4ToUint32(ip: string): number {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) {
    throw new IpError("INVALID_CIDR", `Invalid IPv4 address format: "${ip}"`);
  }

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const partStr = parts[i];
    if (partStr === undefined || partStr === "" || !/^\d+$/.test(partStr)) {
      throw new IpError("INVALID_CIDR", `Invalid IPv4 octet: "${partStr}"`);
    }
    const octet = Number(partStr);
    if (octet < 0 || octet > 255) {
      throw new IpError("INVALID_CIDR", `IPv4 octet out of range [0, 255]: ${octet}`);
    }
    result = ((result << 8) | octet) >>> 0;
  }
  return result;
}

/**
 * Converts an unsigned 32-bit integer to a dotted-decimal IPv4 string.
 */
export function uint32ToIpv4(uint32: number): IPv4Address {
  const o1 = (uint32 >>> 24) & 255;
  const o2 = (uint32 >>> 16) & 255;
  const o3 = (uint32 >>> 8) & 255;
  const o4 = uint32 & 255;
  return `${o1}.${o2}.${o3}.${o4}` as IPv4Address;
}

/**
 * Computes the 32-bit subnet mask for a given prefix length [0, 32].
 */
export function prefixToNetmask(prefix: number): number {
  if (prefix === 0) {
    return 0;
  }
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Parses an IPv4 CIDR string (e.g. "192.168.10.0/24").
 */
export function parseCidr(cidr: string): ParsedIPv4Cidr {
  const parts = cidr.trim().split("/");
  if (parts.length !== 2) {
    throw new IpError("INVALID_CIDR", `Invalid CIDR format (missing slash): "${cidr}"`);
  }

  const [ipStr, prefixStr] = parts;
  if (!ipStr || !prefixStr || !/^\d+$/.test(prefixStr)) {
    throw new IpError("INVALID_CIDR", `Invalid CIDR prefix: "${prefixStr}"`);
  }

  const prefix = Number(prefixStr);
  if (prefix < 0 || prefix > 32) {
    throw new IpError("INVALID_CIDR", `CIDR prefix must be between 0 and 32: ${prefix}`);
  }

  const ipUint = ipv4ToUint32(ipStr);
  const netmask = prefixToNetmask(prefix);
  const hostMask = ~netmask >>> 0;

  const networkUint = (ipUint & netmask) >>> 0;
  const broadcastUint = (ipUint | hostMask) >>> 0;

  const totalAddresses = prefix === 0 ? 4294967296 : Math.pow(2, 32 - prefix);
  const usableHostCount = prefix >= 31 ? 0 : Math.max(0, totalAddresses - 2);

  return {
    address: uint32ToIpv4(ipUint),
    prefix,
    networkAddress: uint32ToIpv4(networkUint),
    broadcastAddress: uint32ToIpv4(broadcastUint),
    totalAddresses,
    usableHostCount,
  };
}

interface FreeBlock {
  start: number;
  prefix: number;
}

/**
 * Allocates subnets using Variable Length Subnet Masking (VLSM).
 */
export function allocateVlsm(input: VlsmEngineInput): VlsmEngineOutput {
  const parsedParent = parseCidr(input.parentCidr);
  const parentUint = ipv4ToUint32(parsedParent.address);
  const parentNetmask = prefixToNetmask(parsedParent.prefix);
  const hostBits = (parentUint & (~parentNetmask >>> 0)) >>> 0;

  if (hostBits !== 0) {
    throw new IpError(
      "INVALID_CIDR",
      `Parent CIDR must be a canonical network address with no host bits set: ${input.parentCidr}`
    );
  }

  // Validate subnet requirements
  const seenIds = new Set<SubnetId>();
  for (const req of input.subnets) {
    if (seenIds.has(req.subnetId)) {
      throw new IpError("HOST_REQUIREMENT_INVALID", `Duplicate subnet ID: ${req.subnetId}`);
    }
    seenIds.add(req.subnetId);

    if (!Number.isInteger(req.hostsRequired) || req.hostsRequired < 1) {
      throw new IpError(
        "HOST_REQUIREMENT_INVALID",
        `Subnet ${req.subnetId} requires at least 1 host, got: ${req.hostsRequired}`
      );
    }
  }

  // Sort subnets: descending required block size, then ascending lexical subnetId
  // Smallest allocatable host subnet is /30 (power of two for hostsRequired + 2)
  interface SizedRequirement {
    subnetId: SubnetId;
    name: string;
    hostsRequired: number;
    requiredBlockSize: number;
    requiredPrefix: number;
  }

  const sortedReqs: SizedRequirement[] = input.subnets.map((s) => {
    // hostsRequired + 2 for network & broadcast
    const needed = s.hostsRequired + 2;
    // Smallest power of 2 >= needed
    let blockSize = 4;
    let prefix = 30;
    while (blockSize < needed && prefix > 0) {
      blockSize *= 2;
      prefix -= 1;
    }
    return {
      subnetId: s.subnetId,
      name: s.name,
      hostsRequired: s.hostsRequired,
      requiredBlockSize: blockSize,
      requiredPrefix: prefix,
    };
  });

  sortedReqs.sort((a, b) => {
    if (b.requiredBlockSize !== a.requiredBlockSize) {
      return b.requiredBlockSize - a.requiredBlockSize;
    }
    return a.subnetId.localeCompare(b.subnetId);
  });

  // Maintain available free blocks, starting with the entire parent
  const freeBlocks: FreeBlock[] = [
    {
      start: parentUint,
      prefix: parsedParent.prefix,
    },
  ];

  const allocations: VlsmSubnetAllocation[] = [];
  const unallocated: UnallocatedSubnet[] = [];

  for (const req of sortedReqs) {
    // Find the first free block that is large enough (prefix <= req.requiredPrefix)
    let foundIndex = -1;
    for (let i = 0; i < freeBlocks.length; i++) {
      const block = freeBlocks[i];
      if (block && block.prefix <= req.requiredPrefix) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex === -1) {
      unallocated.push({
        subnetId: req.subnetId,
        reason: "INSUFFICIENT_SPACE",
        hostsRequired: req.hostsRequired,
        requiredPrefix: req.requiredPrefix,
      });
      continue;
    }

    // Split block down to requiredPrefix
    let currentBlock = freeBlocks.splice(foundIndex, 1)[0];
    if (!currentBlock) {
      continue;
    }

    while (currentBlock.prefix < req.requiredPrefix) {
      const nextPrefix = currentBlock.prefix + 1;
      const halfSize = Math.pow(2, 32 - nextPrefix);
      const leftBuddy: FreeBlock = {
        start: currentBlock.start,
        prefix: nextPrefix,
      };
      const rightBuddy: FreeBlock = {
        start: (currentBlock.start + halfSize) >>> 0,
        prefix: nextPrefix,
      };

      // We take leftBuddy as our candidate and put rightBuddy back into freeBlocks
      freeBlocks.splice(foundIndex, 0, rightBuddy);
      currentBlock = leftBuddy;
    }

    // Allocate currentBlock
    const blockSize = Math.pow(2, 32 - currentBlock.prefix);
    const netUint = currentBlock.start;
    const bcastUint = (netUint + blockSize - 1) >>> 0;
    const firstUsableUint = (netUint + 1) >>> 0;
    const lastUsableUint = (bcastUint - 1) >>> 0;
    const usableHostCapacity = blockSize - 2;
    const wastedUsableHosts = usableHostCapacity - req.hostsRequired;

    const netAddr = uint32ToIpv4(netUint);
    const bcastAddr = uint32ToIpv4(bcastUint);
    const firstUsable = uint32ToIpv4(firstUsableUint);
    const lastUsable = uint32ToIpv4(lastUsableUint);
    const cidr = `${netAddr}/${currentBlock.prefix}` as IPv4Cidr;

    allocations.push({
      subnetId: req.subnetId,
      cidr,
      networkAddress: netAddr,
      broadcastAddress: bcastAddr,
      firstUsableAddress: firstUsable,
      lastUsableAddress: lastUsable,
      allocatedAddressCount: blockSize,
      usableHostCapacity,
      hostsRequired: req.hostsRequired,
      wastedUsableHosts,
    });
  }

  // Format remaining free blocks
  // Sort free blocks by start address
  freeBlocks.sort((a, b) => a.start - b.start);
  const remainingAddressSpace: IPv4Cidr[] = freeBlocks.map(
    (b) => `${uint32ToIpv4(b.start)}/${b.prefix}` as IPv4Cidr
  );

  const totalAllocatedAddresses = allocations.reduce(
    (sum, a) => sum + a.allocatedAddressCount,
    0
  );
  const totalWastedUsableHosts = allocations.reduce(
    (sum, a) => sum + a.wastedUsableHosts,
    0
  );

  return {
    parentCidr: input.parentCidr,
    allocations,
    unallocated,
    remainingAddressSpace,
    totalAllocatedAddresses,
    totalWastedUsableHosts,
    isComplete: unallocated.length === 0,
  };
}

export const defaultIpEngine: IpEngine = {
  parseCidr,
  allocateVlsm,
};
