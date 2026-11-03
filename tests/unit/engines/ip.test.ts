import { describe, it, expect } from "vitest";
import { parseCidr, allocateVlsm, IpError } from "@/engines/ip/ipEngine";
import {
  IP_01_VECTOR,
  IP_02_VECTOR,
  IP_03_VECTOR,
  IP_04_VECTOR,
  IP_05_VECTOR,
  IP_06_VECTOR,
} from "../../vectors/ip.vectors";
import type { IPv4Cidr, SubnetId } from "@/contracts/primitives";

describe("IPv4 & VLSM Engine (P1-03)", () => {
  describe("parseCidr", () => {
    it("parses normative IP-01 vector (192.168.10.0/24)", () => {
      const parsed = parseCidr(IP_01_VECTOR.input);
      expect(parsed.networkAddress).toBe(IP_01_VECTOR.expected.network);
      expect(parsed.broadcastAddress).toBe(IP_01_VECTOR.expected.broadcast);
      expect(parsed.totalAddresses).toBe(IP_01_VECTOR.expected.totalAddresses);
      expect(parsed.usableHostCount).toBe(IP_01_VECTOR.expected.usableHosts);
    });

    it("parses normative IP-06 vectors (/31 and /32 yield 0 usable hosts)", () => {
      for (const item of IP_06_VECTOR.prefixes) {
        const parsed = parseCidr(item.cidr);
        expect(parsed.totalAddresses).toBe(item.expectedTotal);
        expect(parsed.usableHostCount).toBe(item.expectedUsable);
      }
    });

    it("throws on invalid CIDR format or out-of-range prefix", () => {
      expect(() => parseCidr("192.168.1.1")).toThrowError(IpError);
      expect(() => parseCidr("192.168.1.1/33")).toThrowError(IpError);
      expect(() => parseCidr("192.168.1.300/24")).toThrowError(IpError);
      expect(() => parseCidr("abc.def.ghi.jkl/24")).toThrowError(IpError);
    });
  });

  describe("allocateVlsm", () => {
    it("allocates subnets matching normative IP-02 vector", () => {
      const result = allocateVlsm({
        parentCidr: IP_02_VECTOR.parentCidr,
        subnets: IP_02_VECTOR.requirements,
      });

      expect(result.isComplete).toBe(IP_02_VECTOR.expectedIsComplete);
      expect(result.totalAllocatedAddresses).toBe(IP_02_VECTOR.expectedTotalAllocatedAddresses);
      expect(result.totalWastedUsableHosts).toBe(IP_02_VECTOR.expectedTotalWastedUsableHosts);
      expect(result.remainingAddressSpace).toEqual(IP_02_VECTOR.expectedRemaining);
      expect(result.allocations).toHaveLength(IP_02_VECTOR.expectedAllocations.length);

      for (let i = 0; i < IP_02_VECTOR.expectedAllocations.length; i++) {
        const expected = IP_02_VECTOR.expectedAllocations[i];
        const actual = result.allocations[i];
        expect(actual).toBeDefined();
        if (expected && actual) {
          expect(actual.subnetId).toBe(expected.subnetId);
          expect(actual.cidr).toBe(expected.cidr);
          expect(actual.usableHostCapacity).toBe(expected.usableCapacity);
          expect(actual.wastedUsableHosts).toBe(expected.wastedUsableHosts);
        }
      }
    });

    it("handles insufficient address space matching normative IP-03 vector", () => {
      const result = allocateVlsm({
        parentCidr: IP_03_VECTOR.parentCidr,
        subnets: IP_03_VECTOR.requirements,
      });

      expect(result.isComplete).toBe(false);
      expect(result.allocations).toHaveLength(1);
      expect(result.allocations[0]?.cidr).toBe(IP_03_VECTOR.expectedFirstAllocationCidr);
      expect(result.unallocated).toHaveLength(1);
      expect(result.unallocated[0]?.reason).toBe("INSUFFICIENT_SPACE");
      expect(result.unallocated[0]?.subnetId).toBe(IP_03_VECTOR.expectedUnallocated[0]?.subnetId);
      expect(result.unallocated[0]?.requiredPrefix).toBe(
        IP_03_VECTOR.expectedUnallocated[0]?.requiredPrefix
      );
      expect(result.remainingAddressSpace).toEqual([]);
    });

    it("rejects non-canonical parent CIDR with host bits set matching IP-04", () => {
      expect(() =>
        allocateVlsm({
          parentCidr: IP_04_VECTOR.invalidParentCidr as IPv4Cidr,
          subnets: [],
        })
      ).toThrowError(IpError);

      try {
        allocateVlsm({
          parentCidr: IP_04_VECTOR.invalidParentCidr as IPv4Cidr,
          subnets: [],
        });
      } catch (err: unknown) {
        expect((err as IpError).issueCode).toBe(IP_04_VECTOR.expectedErrorCode);
      }
    });

    it("respects host boundaries from IP-05 (smallest allocatable subnet is /30)", () => {
      for (const c of IP_05_VECTOR.cases) {
        const result = allocateVlsm({
          parentCidr: "192.168.1.0/24" as IPv4Cidr,
          subnets: [
            {
              subnetId: "snt-1" as SubnetId,
              name: "Test",
              hostsRequired: c.hostsRequired,
            },
          ],
        });
        expect(result.allocations[0]?.cidr.endsWith(`/${c.expectedPrefix}`)).toBe(true);
        expect(result.allocations[0]?.usableHostCapacity).toBe(c.expectedUsable);
      }
    });

    it("rejects duplicate subnet IDs and non-positive host counts", () => {
      expect(() =>
        allocateVlsm({
          parentCidr: "192.168.1.0/24" as IPv4Cidr,
          subnets: [
            { subnetId: "snt-dup" as SubnetId, name: "S1", hostsRequired: 10 },
            { subnetId: "snt-dup" as SubnetId, name: "S2", hostsRequired: 10 },
          ],
        })
      ).toThrowError(/duplicate subnet id/i);

      expect(() =>
        allocateVlsm({
          parentCidr: "192.168.1.0/24" as IPv4Cidr,
          subnets: [{ subnetId: "snt-1" as SubnetId, name: "S1", hostsRequired: 0 }],
        })
      ).toThrowError(/requires at least 1 host/i);
    });
  });
});

