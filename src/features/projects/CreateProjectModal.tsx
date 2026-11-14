import React, { useState } from "react";
import { X, Search, MapPin, Loader2, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApplicationContainer } from "@/application/container";
import { makeGeoPoint } from "@/domain/geo/localFrame";
import type { GeocodeResult } from "@/contracts/services";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (projectId: string, baselineDesignId: string) => void;
}

export function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [regionLabel, setRegionLabel] = useState("Main Campus");
  const [latitude, setLatitude] = useState("12.9716");
  const [longitude, setLongitude] = useState("77.5946");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    try {
      const container = getApplicationContainer();
      const results = await container.geocodingService.search(searchQuery.trim());
      setSearchResults(results);
      if (results.length === 0) {
        setError("No locations found. You can enter coordinates manually.");
      }
    } catch {
      setError("Location search unavailable. Enter coordinates manually.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: GeocodeResult) => {
    setLongitude(item.center.coordinates[0].toFixed(5));
    setLatitude(item.center.coordinates[1].toFixed(5));
    if (!regionLabel || regionLabel === "Main Campus") {
      setRegionLabel(item.label.split(",")[0]?.trim() || "Main Campus");
    }
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required");
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      setError("Please provide valid coordinates (-90..90 latitude, -180..180 longitude)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const container = getApplicationContainer();
      const res = await container.projectService.createProject({
        name: trimmedName,
        description: description.trim() || null,
        initialRegion: {
          label: regionLabel.trim() || "Main Campus",
          center: makeGeoPoint(lng, lat),
          bbox: null,
        },
      });

      onCreated(res.projectId, res.baselineDesignId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-100">
      <div className="w-full max-w-lg bg-surface-raised border border-border-strong rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-t-violet/40">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-panel/70">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-violet" />
            <h2 className="text-sm font-bold text-text-primary">Create New Network Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error">
              {error}
            </div>
          )}

          <div>
            <label className="block font-medium text-text-secondary mb-1">Project Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. South Campus Network Overhaul"
              className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded-lg text-text-primary focus:border-violet focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-text-secondary mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or project scope definition"
              className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded-lg text-text-primary focus:border-violet focus:outline-none resize-none"
            />
          </div>

          {/* Location Search Bar */}
          <div>
            <label className="block font-medium text-text-secondary mb-1">
              Geographic Region Origin (Search Online)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search place, city, or address..."
                className="flex-1 px-3 py-2 bg-surface-input border border-border-subtle rounded-lg text-text-primary focus:border-violet focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch(e);
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-violet" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 border border-border-strong rounded-lg bg-surface-panel max-h-40 overflow-y-auto divide-y divide-border-subtle shadow-xl">
                {searchResults.map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectSearchResult(item)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-elevated text-text-primary flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-violet shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-text-secondary mb-1">Latitude</label>
              <input
                type="text"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded-lg text-text-primary focus:border-violet focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-text-secondary mb-1">Longitude</label>
              <input
                type="text"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded-lg text-text-primary focus:border-violet focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-text-secondary mb-1">Region Label</label>
            <input
              type="text"
              required
              value={regionLabel}
              onChange={(e) => setRegionLabel(e.target.value)}
              className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded-lg text-text-primary focus:border-violet focus:outline-none"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-border-subtle flex items-center justify-end space-x-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting} className="font-semibold">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating Project...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
