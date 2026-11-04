import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FolderPlus, Network, Copy, Trash2, Calendar, MapPin, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApplicationContainer } from "@/application/container";
import { CreateProjectModal } from "./CreateProjectModal";
import type { Project } from "@/contracts/domain";

export function ProjectsView() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Network Projects</h1>
          <p className="text-xs text-text-secondary mt-1">
            Local-first network design workstation. All data is persisted directly in your browser.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size="md"
          className="gap-2 shadow-lg shadow-brand-electric/10"
        >
          <FolderPlus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded bg-status-error/10 border border-status-error/30 text-status-error text-xs">
          {error}
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-brand-electric mb-3" />
          <span className="text-xs">Loading projects from IndexedDB...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border-strong rounded-lg bg-surface-raised">
          <div className="w-12 h-12 rounded-full bg-surface-elevated border border-border-subtle flex items-center justify-center text-brand-electric mb-4">
            <Network className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary">No Projects Yet</h2>
          <p className="text-xs text-text-muted max-w-sm mt-1 mb-6">
            Get started by creating your first network infrastructure planning project.
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="primary" size="sm" className="gap-2">
            <FolderPlus className="w-4 h-4" />
            Create First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group flex flex-col justify-between p-5 rounded-lg border border-border-subtle bg-surface-raised hover:border-brand-electric/50 transition-all hover:shadow-xl hover:shadow-brand-midnight/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-surface-elevated border border-border-subtle text-brand-electric">
                      <Network className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm text-text-primary line-clamp-1">{project.name}</h3>
                  </div>
                </div>

                {project.description && (
                  <p className="text-xs text-text-muted mt-2.5 line-clamp-2">{project.description}</p>
                )}

                <div className="mt-4 pt-3 border-t border-border-subtle space-y-1.5 text-[11px] text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {project.lastOpenedAt
                        ? `Opened ${new Date(project.lastOpenedAt).toLocaleDateString()}`
                        : "Never opened"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="font-mono">
                      {project.frame.origin.coordinates[1].toFixed(4)}, {project.frame.origin.coordinates[0].toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between gap-2">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleDuplicate(project)}
                    title="Duplicate project"
                    className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    disabled={deletingId === project.id}
                    title="Delete project"
                    className="p-1.5 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
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
                  size="sm"
                  className="gap-1.5 text-xs text-brand-electric group-hover:bg-brand-electric group-hover:text-white transition-colors"
                >
                  Open
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

