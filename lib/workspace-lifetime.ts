export const ERASE_WORKSPACE_EVENT = "subtext:erase-workspace";

/** In-memory ownership of async work; no conversation text is persisted. */
export function createWorkspaceLifetime() {
  let generation = 0;
  return {
    start: () => ++generation,
    isCurrent: (ticket: number) => ticket === generation,
    invalidate: () => { generation += 1; },
  };
}
