import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderPlus,
  Network,
  Copy,
  Trash2,
  Calendar,
  MapPin,
  Loader2,
  ArrowRight,
  Sparkles,
  Layers,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApplicationContainer } from "@/application/container";
import { CreateProjectModal } from "./CreateProjectModal";
import { loadDemoProject } from "@/demo/demoProject";
import type { Project } from "@/contracts/domain";

export function ProjectsView() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const container = getApplicationContainer();
      const list = await container.projectService.listProjects();
      // Sort by lastOpenedAt descending
      list.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
      setProjects(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreated = (projectId: string, baselineDesignId: string) => {
    navigate(`/projects/${projectId}/designs/${baselineDesignId}/map`);
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    setError(null);
    try {
      const container = getApplicationContainer();
      const { projectId, baselineDesignId } = await loadDemoProject(
        container.projectService,
        container.repos
      );
      await loadProjects();
      navigate(`/projects/${projectId}/designs/${baselineDesignId}/map`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load demo project");
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleDuplicate = async (project: Project) => {
    const copyName = `${project.name} (Copy)`;
    try {
      const container = getApplicationContainer();
      await container.projectService.duplicateProject({
        sourceProjectId: project.id,
        name: copyName,
      });
      await loadProjects();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to duplicate project");
    }
  };

  const handleDelete = async (projectId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(projectId);
    try {
      const container = getApplicationContainer();
      await container.projectService.deleteProject(projectId as never);
      await loadProjects();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
  });

  return (
    <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full select-none">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">Network Projects</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-elevated text-text-secondary border border-border-subtle">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Local-first engineering workstation. All authored network plans persist directly in your browser.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleLoadDemo}
            disabled={isLoadingDemo}
            variant="secondary"
            size="sm"
            className="gap-2 border-violet/30 text-violet hover:bg-violet/10 hover:border-violet/50 transition-colors"
          >
            {isLoadingDemo ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-violet" />
            )}
            <span>Load Demo Project</span>
          </Button>

          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            size="sm"
            className="gap-2 shadow-lg shadow-violet/10 font-semibold"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </Button>
        </div>
      </div>

      {/* Filter and Quick Stats Bar */}
      {projects.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-6 bg-surface-panel p-2.5 rounded-lg border border-border-subtle">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter projects by title or scope..."
              className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-text-muted">
            <span>IndexedDB: Active</span>
            <span className="text-border-strong">•</span>
            <span>Zero Sync Required</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-xs">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-violet mb-3" />
          <span className="text-xs">Reading local project storage...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="py-16 px-4 rounded-xl border border-dashed border-border-strong bg-surface-raised/40 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center text-violet mb-4">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary">No Projects In Local Storage</h2>
          <p className="text-xs text-text-muted max-w-sm mt-1 mb-6">
            Get started by loading the pre-configured Engineering Campus demo workstation or create your first planning project.
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleLoadDemo}
              disabled={isLoadingDemo}
              variant="secondary"
              size="sm"
              className="gap-1.5 border-violet/30 text-violet hover:bg-violet/10"
            >
              {isLoadingDemo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-violet" />
              )}
              Load Demo Project
            </Button>
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="primary"
              size="sm"
              className="gap-2 font-semibold"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Create First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="group flex flex-col justify-between p-5 rounded-xl border border-border-subtle bg-surface-raised hover:border-violet/50 transition-all hover:shadow-xl hover:shadow-black/60"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-surface-elevated border border-border-subtle text-violet group-hover:border-violet/40 transition-colors">
                      <Network className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-text-primary line-clamp-1">{project.name}</h3>
                  </div>
                </div>

                {project.description ? (
                  <p className="text-xs text-text-muted mt-2.5 line-clamp-2">{project.description}</p>
                ) : (
                  <p className="text-xs text-text-disabled italic mt-2.5">No scope description provided.</p>
                )}

                <div className="mt-4 pt-3 border-t border-border-subtle/70 space-y-1.5 text-[11px] text-text-muted">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Last opened</span>
                    </span>
                    <span className="font-mono text-text-secondary">
                      {project.lastOpenedAt
                        ? new Date(project.lastOpenedAt).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Origin</span>
                    </span>
                    <span className="font-mono text-text-secondary">
                      {project.frame.origin.coordinates[1].toFixed(4)}°,{" "}
                      {project.frame.origin.coordinates[0].toFixed(4)}°
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleDuplicate(project)}
                    title="Duplicate project"
                    className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    disabled={deletingId === project.id}
                    title="Delete project"
                    className="p-1.5 rounded-md text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                  >
                    {deletingId === project.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <Button
                  onClick={() => navigate(`/projects/${project.id}`)}
                  variant="secondary"
                  size="xs"
                  className="gap-1.5 text-xs text-violet group-hover:bg-violet group-hover:text-carbon-deep font-semibold transition-colors border border-violet/30"
                >
                  <span>Open Workstation</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
