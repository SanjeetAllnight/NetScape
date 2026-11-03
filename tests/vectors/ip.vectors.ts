/**
 * Normative IPv4 and VLSM test vectors.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §19.1
 */

import type { IPv4Address, IPv4Cidr, SubnetId } from "@/contracts/primitives";
import type { IpFactExpected } from "@/contracts/vectors";

export interface IpFactVector {
  id: "IP-01";
  input: string;
  expected: IpFactExpected;
}

export const IP_01_VECTOR: IpFactVector = {
  id: "IP-01",
  input: "192.168.10.0/24",
  expected: {
    network: "192.168.10.0" as IPv4Address,
    broadcast: "192.168.10.255" as IPv4Address,
    totalAddresses: 256,
    usableHosts: 254,
    firstUsable: "192.168.10.1" as IPv4Address,
    lastUsable: "192.168.10.254" as IPv4Address,
  },
};

export const IP_02_VECTOR = {
  id: "IP-02" as const,
  parentCidr: "192.168.10.0/24" as IPv4Cidr,
  requirements: [
    { subnetId: "snt_00000000-0000-4000-8000-00000000000a" as SubnetId, name: "Subnet A", hostsRequired: 100 },
    { subnetId: "snt_00000000-0000-4000-8000-00000000000b" as SubnetId, name: "Subnet B", hostsRequired: 50 },
    { subnetId: "snt_00000000-0000-4000-8000-00000000000c" as SubnetId, name: "Subnet C", hostsRequired: 20 },
    { subnetId: "snt_00000000-0000-4000-8000-00000000000d" as SubnetId, name: "Subnet D", hostsRequired: 10 },
  ],
  expectedAllocations: [
    {
      subnetId: "snt_00000000-0000-4000-8000-00000000000a" as SubnetId,
      cidr: "192.168.10.0/25" as IPv4Cidr,
      usableCapacity: 126,
      wastedUsableHosts: 26,
    },
    {
      subnetId: "snt_00000000-0000-4000-8000-00000000000b" as SubnetId,
      cidr: "192.168.10.128/26" as IPv4Cidr,
      usableCapacity: 62,
      wastedUsableHosts: 12,
    },
    {
      subnetId: "snt_00000000-0000-4000-8000-00000000000c" as SubnetId,
      cidr: "192.168.10.192/27" as IPv4Cidr,
      usableCapacity: 30,
      wastedUsableHosts: 10,
    },
    {
      subnetId: "snt_00000000-0000-4000-8000-00000000000d" as SubnetId,
      cidr: "192.168.10.224/28" as IPv4Cidr,
      usableCapacity: 14,
      wastedUsableHosts: 4,
    },
  ],
  expectedRemaining: ["192.168.10.240/28" as IPv4Cidr],
  expectedTotalAllocatedAddresses: 240,
  expectedTotalWastedUsableHosts: 52,
  expectedIsComplete: true,
};

export const IP_03_VECTOR = {
  id: "IP-03" as const,
  parentCidr: "10.0.0.0/29" as IPv4Cidr,
  requirements: [
    { subnetId: "snt_00000000-0000-4000-8000-00000000000a" as SubnetId, name: "Subnet A", hostsRequired: 6 },
    { subnetId: "snt_00000000-0000-4000-8000-00000000000b" as SubnetId, name: "Subnet B", hostsRequired: 6 },
  ],
  expectedFirstAllocationCidr: "10.0.0.0/29" as IPv4Cidr,
  expectedUnallocated: [
    {
      subnetId: "snt_00000000-0000-4000-8000-00000000000b" as SubnetId,
      reason: "INSUFFICIENT_SPACE" as const,
      hostsRequired: 6,
      requiredPrefix: 29,
    },
  ],
  expectedRemaining: [] as IPv4Cidr[],
  expectedIsComplete: false,
};

export const IP_04_VECTOR = {
  id: "IP-04" as const,
  invalidParentCidr: "192.168.10.1/24",
  expectedErrorCode: "INVALID_CIDR" as const,
};

export const IP_05_VECTOR = {
  id: "IP-05" as const,
  cases: [
    { hostsRequired: 1, expectedPrefix: 30, expectedUsable: 2 },
    { hostsRequired: 2, expectedPrefix: 30, expectedUsable: 2 },
  ],
};

export const IP_06_VECTOR = {
  id: "IP-06" as const,
  prefixes: [
    { cidr: "10.0.0.0/31" as IPv4Cidr, expectedTotal: 2, expectedUsable: 0 },
    { cidr: "10.0.0.1/32" as IPv4Cidr, expectedTotal: 1, expectedUsable: 0 },
  ],
};

