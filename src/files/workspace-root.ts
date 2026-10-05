/** The local launcher pins writable evidence separately from standalone assets. */
export function defaultWorkspaceRoot(): string {
  return process.env.CAREER_WORKBENCH_WORKSPACE_ROOT ?? process.cwd();
}
