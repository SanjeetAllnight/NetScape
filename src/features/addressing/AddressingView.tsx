import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Network,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Server,
  Layers,
  Database,
  Info,
} from "lucide-react";
import { ProjectHeader } from "@/features/shell/ProjectHeader";
import { useDesignStore } from "@/stores/designStore";
import { getApplicationContainer } from "@/application/container";
import type { DesignId, DeviceId, SubnetId, IPv4Cidr } from "@/contracts/primitives";
import type { Subnet, Device } from "@/contracts/domain";
import type { VlsmEngineOutput } from "@/contracts/engines";

export function AddressingView() {
  const { designId } = useParams<{ projectId: string; designId: string }>();
  const aggregate = useDesignStore((s) => s.aggregate);

  // Local state for parent CIDR draft
  const currentParentCidr = aggregate?.design.addressing.parentCidr ?? "";
  const [parentCidrDraft, setParentCidrDraft] = useState(currentParentCidr);
  const [cidrError, setCidrError] = useState<string | null>(null);

  // Sync draft when design aggregate updates
  useEffect(() => {
    if (aggregate?.design.addressing.parentCidr) {
      setParentCidrDraft(aggregate.design.addressing.parentCidr);
    } else {
      setParentCidrDraft("");
    }
  }, [aggregate?.design.addressing.parentCidr]);

  // Ensure design is opened in session
  useEffect(() => {
    if (!designId) return;
    const container = getApplicationContainer();
    if (aggregate?.design.id !== designId) {
      container.designSession.open(designId as DesignId);
    }
  }, [designId, aggregate?.design.id]);

  // Subnet creation state
  const [isAddingSubnet, setIsAddingSubnet] = useState(false);
  const [newSubnetName, setNewSubnetName] = useState("");
  const [newSubnetHosts, setNewSubnetHosts] = useState(50);
  const [newServingDeviceId, setNewServingDeviceId] = useState<string>("");
  const [addError, setAddError] = useState<string | null>(null);

  // Subnet inline edit state
  const [editingSubnetId, setEditingSubnetId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editHosts, setEditHosts] = useState(50);
  const [editServingDevice, setEditServingDevice] = useState<string>("");

  // Allocation engine execution state
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [lastVlsmOutput, setLastVlsmOutput] = useState<VlsmEngineOutput | null>(null);

  const devices = useMemo(() => {
    return Object.values(aggregate?.devicesById ?? {}) as Device[];
  }, [aggregate?.devicesById]);

  const subnets = useMemo(() => {
    return Object.values(aggregate?.subnetsById ?? {}) as Subnet[];
  }, [aggregate?.subnetsById]);

  // Validate CIDR syntax and canonical host-bits rule
  const validateCidr = (cidrStr: string): string | null => {
    const container = getApplicationContainer();
    const res = container.addressingService.validateCidr(cidrStr);
    return res.valid ? null : (res.error ?? "Invalid IPv4 CIDR");
  };

  // Commit Parent CIDR change
  const handleSaveParentCidr = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateCidr(parentCidrDraft);
    if (err) {
      setCidrError(err);
      return;
    }
    setCidrError(null);

    const container = getApplicationContainer();
    await container.designSession.dispatch({
      type: "addressing/setParentCidr",
      parentCidr: parentCidrDraft.trim() as IPv4Cidr,
    });
    setLastVlsmOutput(null);
  };

  // Add new subnet requirement
  const handleAddSubnet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubnetName.trim()) {
      setAddError("Subnet name is required");
      return;
    }
    if (newSubnetHosts < 1 || newSubnetHosts > 65534) {
      setAddError("Hosts required must be between 1 and 65534");
      return;
    }

    setAddError(null);
    const container = getApplicationContainer();
    const res = await container.designSession.dispatch({
      type: "subnet/add",
      name: newSubnetName.trim(),
      hostsRequired: Number(newSubnetHosts),
      servedByDeviceId: newServingDeviceId ? (newServingDeviceId as DeviceId) : null,
    });

    if (res.status === "committed") {
      setIsAddingSubnet(false);
      setNewSubnetName("");
      setNewSubnetHosts(50);
      setNewServingDeviceId("");
      setLastVlsmOutput(null);
    } else {
      setAddError(res.issues.map((i) => i.message).join(", "));
    }
  };

  // Save inline edit
  const handleSaveEdit = async (subnetId: string) => {
    if (!editName.trim()) return;
    if (editHosts < 1 || editHosts > 65534) return;

    const container = getApplicationContainer();
    await container.designSession.dispatch({
      type: "subnet/update",
      subnetId: subnetId as SubnetId,
      patch: {
        name: editName.trim(),
        hostsRequired: Number(editHosts),
        servedByDeviceId: editServingDevice ? (editServingDevice as DeviceId) : null,
      },
    });

    setEditingSubnetId(null);
    setLastVlsmOutput(null);
  };

  // Delete subnet
  const handleDeleteSubnet = async (subnetId: string) => {
    const container = getApplicationContainer();
    await container.designSession.dispatch({
      type: "subnet/delete",
      subnetId: subnetId as SubnetId,
    });
    setLastVlsmOutput(null);
  };

  // Run VLSM Address Allocation Engine
  const handleAllocate = async () => {
    if (!aggregate) return;
    const parentCidr = aggregate.design.addressing.parentCidr;
    if (!parentCidr) {
      setAllocationError("Configure a valid Parent IPv4 CIDR first");
      return;
    }

    if (subnets.length === 0) {
      setAllocationError("Add at least one subnet requirement before allocating addresses");
      return;
    }

    setIsAllocating(true);
    setAllocationError(null);

    try {
      const container = getApplicationContainer();
      const output = await container.addressingService.allocate(designId as DesignId);
      setLastVlsmOutput(output);
    } catch (err: unknown) {
      setAllocationError(err instanceof Error ? err.message : "VLSM allocation failed");
    } finally {
      setIsAllocating(false);
    }
  };

  // Summary Metrics calculations
  const totalRequestedHosts = subnets.reduce((sum, s) => sum + s.hostsRequired, 0);
  const totalAllocatedHosts = subnets.reduce((sum, s) => sum + (s.usableHostCapacity ?? 0), 0);
  const totalWastedHosts = subnets.reduce((sum, s) => sum + (s.wastedUsableHosts ?? 0), 0);
  const unallocatedCount = subnets.filter((s) => !s.allocatedCidr).length;

  const allocationStatus = aggregate?.design.addressing.allocationStatus ?? "notAllocated";

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas text-text-primary">
      <ProjectHeader />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Header & Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-brand-electric" />
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                IPv4 Addressing &amp; VLSM Allocation
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Deterministic Variable Length Subnet Masking (VLSM) based on hierarchical host requirements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {allocationStatus === "current" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-status-success/10 text-status-success border border-status-success/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Allocations Up to Date
              </span>
            )}
            {allocationStatus === "outOfDate" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-status-warning/10 text-status-warning border border-status-warning/30">
                <Clock className="w-3.5 h-3.5" />
                Needs Recalculation
              </span>
            )}
            {allocationStatus === "notAllocated" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-panel text-text-muted border border-border-subtle">
                <Info className="w-3.5 h-3.5" />
                Unallocated
              </span>
            )}

            <button
              onClick={handleAllocate}
              disabled={isAllocating || !currentParentCidr || subnets.length === 0}
              className="px-4 py-1.5 rounded bg-brand-electric hover:bg-brand-electric/90 disabled:opacity-50 text-white text-xs font-semibold shadow flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAllocating ? "Allocating..." : allocationStatus === "outOfDate" ? "Recalculate VLSM" : "Allocate Addresses"}
            </button>
          </div>
        </div>

        {/* Allocation Error Banner */}
        {allocationError && (
          <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{allocationError}</span>
          </div>
        )}

        {/* Configuration Strip: Parent CIDR */}
        <div className="p-4 rounded-lg bg-surface-raised border border-border-strong shadow-sm space-y-3">
          <form onSubmit={handleSaveParentCidr} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Parent IPv4 Network Block (CIDR)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={parentCidrDraft}
                  onChange={(e) => {
                    setParentCidrDraft(e.target.value);
                    setCidrError(null);
                  }}
                  placeholder="e.g. 10.0.0.0/16, 172.16.0.0/12, 192.168.0.0/20"
                  className={`w-full font-mono text-xs px-3 py-2 rounded bg-surface-input border ${
                    cidrError ? "border-status-error" : "border-border-subtle"
                  } text-text-primary focus:outline-none focus:border-brand-electric`}
                />
              </div>
            </div>

            <div className="sm:self-end flex gap-2">
              <button
                type="submit"
                disabled={parentCidrDraft === currentParentCidr}
                className="px-3 py-2 rounded bg-surface-panel hover:bg-surface-elevated disabled:opacity-40 text-text-primary border border-border-subtle text-xs font-medium transition-colors"
              >
                Save Parent CIDR
              </button>
            </div>
          </form>

          {cidrError ? (
            <p className="text-[11px] text-status-error flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {cidrError}
            </p>
          ) : (
            <p className="text-[11px] text-text-muted">
              All subnets will be hierarchically packed into this network address using descending block-size VLSM.
            </p>
          )}
        </div>

        {/* Main Content Layout: Table (70%) + Summary Rail (30%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Subnet Requirements Table (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-electric" />
                Subnet Requirements ({subnets.length})
              </h2>

              {!isAddingSubnet && (
                <button
                  onClick={() => setIsAddingSubnet(true)}
                  className="px-2.5 py-1 rounded bg-surface-panel hover:bg-surface-elevated text-brand-electric text-xs font-medium border border-border-subtle flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Subnet
                </button>
              )}
            </div>

            {/* Add Subnet Form */}
            {isAddingSubnet && (
              <form
                onSubmit={handleAddSubnet}
                className="p-4 rounded-lg bg-surface-raised border border-brand-electric/40 shadow-md space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <span className="text-xs font-semibold text-text-primary">Define New Subnet Requirement</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSubnet(false);
                      setAddError(null);
                    }}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {addError && <p className="text-xs text-status-error">{addError}</p>}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-text-secondary mb-1">Subnet Name</label>
                    <input
                      type="text"
                      value={newSubnetName}
                      onChange={(e) => setNewSubnetName(e.target.value)}
                      placeholder="e.g. Sales LAN, Server Farm"
                      className="w-full px-2.5 py-1.5 rounded bg-surface-input border border-border-subtle text-text-primary focus:outline-none focus:border-brand-electric"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-1">Hosts Required</label>
                    <input
                      type="number"
                      min={1}
                      max={65534}
                      value={newSubnetHosts}
                      onChange={(e) => setNewSubnetHosts(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2.5 py-1.5 rounded bg-surface-input border border-border-subtle text-text-primary focus:outline-none focus:border-brand-electric font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary mb-1">Serving Device (Optional)</label>
                    <select
                      value={newServingDeviceId}
                      onChange={(e) => setNewServingDeviceId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-surface-input border border-border-subtle text-text-primary focus:outline-none focus:border-brand-electric"
                    >
                      <option value="">None / Unassigned</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingSubnet(false)}
                    className="px-3 py-1.5 rounded bg-surface-panel text-text-secondary text-xs hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-brand-electric text-white text-xs font-semibold hover:bg-brand-electric/90"
                  >
                    Save Requirement
                  </button>
                </div>
              </form>
            )}

            {/* Table */}
            <div className="rounded-lg bg-surface-raised border border-border-strong overflow-hidden shadow-sm">
              {subnets.length === 0 ? (
                <div className="p-8 text-center text-text-muted space-y-2">
                  <Network className="w-8 h-8 text-text-disabled mx-auto mb-2" />
                  <p className="text-xs font-medium text-text-secondary">No subnet requirements configured</p>
                  <p className="text-[11px]">
                    Define your subnet host requirements above and enter a parent network to compute VLSM blocks.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-panel/50 text-text-secondary font-semibold">
                        <th className="py-2.5 px-3">Subnet</th>
                        <th className="py-2.5 px-3">Hosts Req.</th>
                        <th className="py-2.5 px-3">Serving Device</th>
                        <th className="py-2.5 px-3">Allocated CIDR</th>
                        <th className="py-2.5 px-3">Usable Cap.</th>
                        <th className="py-2.5 px-3">Wastage</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono">
                      {subnets.map((sub) => {
                        const isEditing = editingSubnetId === sub.id;
                        const device = sub.servedByDeviceId ? aggregate?.devicesById[sub.servedByDeviceId] : null;

                        if (isEditing) {
                          return (
                            <tr key={sub.id} className="bg-surface-elevated/40">
                              <td className="p-2 font-sans">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1 rounded bg-surface-input border border-border-subtle text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editHosts}
                                  min={1}
                                  max={65534}
                                  onChange={(e) => setEditHosts(parseInt(e.target.value, 10) || 1)}
                                  className="w-20 px-2 py-1 rounded bg-surface-input border border-border-subtle text-xs"
                                />
                              </td>
                              <td className="p-2 font-sans">
                                <select
                                  value={editServingDevice}
                                  onChange={(e) => setEditServingDevice(e.target.value)}
                                  className="w-full px-2 py-1 rounded bg-surface-input border border-border-subtle text-xs"
                                >
                                  <option value="">None</option>
                                  {devices.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td colSpan={4} className="p-2 text-text-muted font-sans text-[11px]">
                                Editing requirement — click save to update
                              </td>
                              <td className="p-2 text-right space-x-1">
                                <button
                                  onClick={() => handleSaveEdit(sub.id)}
                                  className="p-1 rounded text-status-success hover:bg-status-success/10"
                                  title="Save changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingSubnetId(null)}
                                  className="p-1 rounded text-text-muted hover:bg-surface-panel"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={sub.id} className="hover:bg-surface-elevated/30 transition-colors">
                            <td className="py-2.5 px-3 font-sans font-medium text-text-primary truncate max-w-[140px]">
                              {sub.name}
                            </td>
                            <td className="py-2.5 px-3 text-text-primary">{sub.hostsRequired}</td>
                            <td className="py-2.5 px-3 font-sans text-text-secondary truncate max-w-[120px]">
                              {device ? (
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <Server className="w-3 h-3 text-brand-electric" />
                                  {device.name}
                                </span>
                              ) : (
                                <span className="text-text-disabled">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {sub.allocatedCidr ? (
                                <span className="text-brand-electric font-semibold">{sub.allocatedCidr}</span>
                              ) : (
                                <span className="text-text-disabled">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-text-secondary">
                              {sub.usableHostCapacity !== null ? sub.usableHostCapacity : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-text-muted">
                              {sub.wastedUsableHosts !== null ? sub.wastedUsableHosts : "—"}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {sub.allocationStatus === "current" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-success/10 text-status-success border border-status-success/20">
                                  Allocated
                                </span>
                              )}
                              {sub.allocationStatus === "outOfDate" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-warning/10 text-status-warning border border-status-warning/20">
                                  Out of Date
                                </span>
                              )}
                              {sub.allocationStatus === "notAllocated" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-panel text-text-muted border border-border-subtle">
                                  Unallocated
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-sans space-x-1">
                              <button
                                onClick={() => {
                                  setEditingSubnetId(sub.id);
                                  setEditName(sub.name);
                                  setEditHosts(sub.hostsRequired);
                                  setEditServingDevice(sub.servedByDeviceId ?? "");
                                }}
                                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-panel"
                                title="Edit requirement"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSubnet(sub.id)}
                                className="p-1 rounded text-text-muted hover:text-status-error hover:bg-status-error/10"
                                title="Delete subnet"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Summary Rail (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Database className="w-4 h-4 text-brand-electric" />
              Allocation Summary
            </h2>

            <div className="p-4 rounded-lg bg-surface-raised border border-border-strong space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-text-secondary">Total Subnets</span>
                <span className="font-mono font-semibold text-text-primary">{subnets.length}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-text-secondary">Requested Hosts</span>
                <span className="font-mono font-semibold text-text-primary">{totalRequestedHosts}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-text-secondary">Allocated Usable Capacity</span>
                <span className="font-mono font-semibold text-brand-electric">{totalAllocatedHosts}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                <span className="text-text-secondary">Unused / Wasted Hosts</span>
                <span className="font-mono text-text-muted">{totalWastedHosts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Unallocated Subnets</span>
                <span
                  className={`font-mono font-semibold ${
                    unallocatedCount > 0 ? "text-status-warning" : "text-status-success"
                  }`}
                >
                  {unallocatedCount}
                </span>
              </div>
            </div>

            {/* Free Address Space Blocks */}
            {lastVlsmOutput?.remainingAddressSpace && lastVlsmOutput.remainingAddressSpace.length > 0 && (
              <div className="p-4 rounded-lg bg-surface-raised border border-border-strong space-y-2 text-xs">
                <h3 className="font-semibold text-text-primary text-xs flex items-center justify-between">
                  <span>Available Free Blocks</span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {lastVlsmOutput.remainingAddressSpace.length} blocks
                  </span>
                </h3>
                <div className="space-y-1 font-mono text-[11px] max-h-36 overflow-y-auto pr-1">
                  {lastVlsmOutput.remainingAddressSpace.map((block, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 rounded bg-surface-panel border border-border-subtle text-brand-electric flex items-center justify-between"
                    >
                      <span>{block}</span>
                      <span className="text-[10px] text-text-muted font-sans">Available</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unallocated Subnets Reasons (if any) */}
            {lastVlsmOutput?.unallocated && lastVlsmOutput.unallocated.length > 0 && (
              <div className="p-4 rounded-lg bg-status-error/10 border border-status-error/30 space-y-2 text-xs">
                <h3 className="font-semibold text-status-error text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Space Exhausted
                </h3>
                <p className="text-[11px] text-text-muted">
                  The following subnets could not be allocated within the parent network block:
                </p>
                <div className="space-y-1 font-mono text-[11px]">
                  {lastVlsmOutput.unallocated.map((u, idx) => {
                    const subName = subnets.find((s) => s.id === u.subnetId)?.name ?? u.subnetId;
                    return (
                      <div
                        key={idx}
                        className="px-2 py-1 rounded bg-surface-canvas border border-status-error/30 text-status-error flex items-center justify-between"
                      >
                        <span className="font-sans truncate max-w-[120px]">{subName}</span>
                        <span>
                          {u.hostsRequired} hosts (needs /{u.requiredPrefix})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
