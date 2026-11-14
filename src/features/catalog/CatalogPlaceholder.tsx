import { useState, useEffect } from "react";
import { Database, Search } from "lucide-react";
import { getApplicationContainer } from "@/application/container";
import type { DeviceCatalogItem } from "@/contracts/domain";

export function CatalogPlaceholder() {
  const [items, setItems] = useState<DeviceCatalogItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    const fetchCatalog = async () => {
      try {
        const container = getApplicationContainer();
        const list = await container.repos.catalog.list();
        if (mounted) setItems(list);
      } catch {
        // Fallback
      }
    };
    fetchCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = items.filter(
    (i) =>
      i.label.toLowerCase().includes(search.toLowerCase()) ||
      i.type.toLowerCase().includes(search.toLowerCase()) ||
      (i.brand && i.brand.toLowerCase().includes(search.toLowerCase())) ||
      (i.model && i.model.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full select-none text-xs text-text-primary">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-violet" />
            <h1 className="text-xl font-bold tracking-tight text-text-primary">Device Catalog</h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Seeded equipment definitions, port capabilities, nameplate power consumption, and benchmark rates.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised border border-border-strong text-text-muted font-mono text-[11px]">
          <span>Seeded Items: {items.length}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex items-center gap-2 max-w-sm px-3 py-1.5 rounded-lg bg-surface-panel border border-border-subtle">
        <Search className="w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter equipment by type or vendor..."
          className="bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none w-full"
        />
      </div>

      {/* Catalog Table */}
      <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-raised shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-surface-panel border-b border-border-subtle text-[10px] uppercase font-mono tracking-wider text-text-muted">
            <tr>
              <th className="py-2.5 px-4">Equipment Model</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4">Ports (Cu / Fi / Wi)</th>
              <th className="py-2.5 px-4 text-right">Power Draw</th>
              <th className="py-2.5 px-4 text-right">Lifespan</th>
              <th className="py-2.5 px-4 text-right">Reference Unit Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle font-sans text-xs">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-surface-elevated/40 transition-colors">
                <td className="py-3 px-4 font-semibold text-text-primary">
                  <div>{item.label}</div>
                  <div className="text-[10px] text-text-muted font-mono">
                    {item.brand ?? item.model ?? "Generic"}
                  </div>
                </td>
                <td className="py-3 px-4 capitalize font-mono text-[11px] text-violet">
                  {item.type}
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-text-secondary">
                  {item.specs.ports.copperEthernet} Cu / {item.specs.ports.fiber} Fi /{" "}
                  {item.specs.ports.wireless} Wi
                </td>
                <td className="py-3 px-4 text-right font-mono text-text-secondary">
                  {item.powerW ?? 0} W
                </td>
                <td className="py-3 px-4 text-right font-mono text-text-secondary">
                  {item.lifespanYears ?? 5} yrs
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                  {item.unitPrice ? `₹${item.unitPrice.amount.toLocaleString("en-IN")}` : "Unlisted"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
