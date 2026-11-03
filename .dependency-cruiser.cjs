/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are forbidden across architectural modules.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "contracts-no-internal-imports",
      severity: "error",
      comment: "contracts/ cannot import any internal layer",
      from: { path: "^src/contracts" },
      to: { path: "^src/(kernel|domain|engines|storage|workers|stores|application|services|features|app|components|hooks|lib|pwa)" },
    },
    {
      name: "kernel-boundary",
      severity: "error",
      comment: "kernel/ imports only contracts/",
      from: { path: "^src/kernel" },
      to: { path: "^src/(domain|engines|storage|workers|stores|application|services|features|app|components|hooks|lib|pwa)" },
    },
    {
      name: "domain-boundary",
      severity: "error",
      comment: "domain/ cannot import engines, storage, workers, stores, application, services, features, app",
      from: { path: "^src/domain" },
      to: { path: "^src/(engines|storage|workers|stores|application|services|features|app|components|hooks|pwa)" },
    },
    {
      name: "engines-boundary",
      severity: "error",
      comment: "engines/ imports only contracts/ and kernel/",
      from: { path: "^src/engines" },
      to: { path: "^src/(domain|storage|workers|stores|application|services|features|app|components|hooks|pwa)" },
    },
    {
      name: "storage-boundary",
      severity: "error",
      comment: "storage/ imports only contracts/",
      from: { path: "^src/storage" },
      to: { path: "^src/(kernel|domain|engines|workers|stores|application|services|features|app|components|hooks|pwa)" },
    },
    {
      name: "workers-boundary",
      severity: "error",
      comment: "workers/ imports only contracts, kernel, engines",
      from: { path: "^src/workers" },
      to: { path: "^src/(domain|storage|stores|application|services|features|app|components|hooks|pwa)" },
    },
    {
      name: "features-forbidden-direct-imports",
      severity: "error",
      comment: "features/** cannot import storage/**, workers/**, services/** adapters or engines/** directly",
      from: { path: "^src/features" },
      to: { path: "^src/(storage|workers|engines|services)" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
