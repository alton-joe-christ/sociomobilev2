export const STAGES = {
  "scanner.prepare": ["Preparing scanner terminal", "Initializing camera", "Verifying access"],
  "scanner.verify": ["Verifying attendee channel", "Marking attendance"],
  "event.update": ["Saving changes", "Synchronizing event data", "Updating attendance"],
  "auth.restore": ["Refreshing your campus identity"],
  "auth.switch": ["Refreshing your campus identity"],
  "events.sync": ["Synchronizing campus systems", "Updating live context"],
  "offline.recover": ["Restoring cached operations", "Syncing offline queue", "Live context ready"],
  "launch.first": [
    "Building your campus workspace",
    "Loading event data",
    "Optimizing offline access",
    "Almost ready",
  ],
  "cache.restore": ["Rebuilding live context"],
  generic: ["Refreshing operational state"],
} as const;

export type OperationKey = keyof typeof STAGES;

export const TITLES: Record<OperationKey, string> = {
  "scanner.prepare": "Preparing Scanner Terminal",
  "scanner.verify": "Verifying Attendance",
  "event.update": "Updating Your Event",
  "auth.restore": "Refreshing Campus Identity",
  "auth.switch": "Refreshing Campus Identity",
  "events.sync": "Synchronizing Campus Systems",
  "offline.recover": "Restoring Cached Operations",
  "launch.first": "Building Your Campus Workspace",
  "cache.restore": "Rebuilding Live Context",
  generic: "Refreshing Operational State",
};

export function stageMessage(operation: OperationKey, index: number): string {
  const list = STAGES[operation];
  if (!list || list.length === 0) return "";
  const clamped = Math.max(0, Math.min(list.length - 1, index));
  return list[clamped];
}

export function stageCount(operation: OperationKey): number {
  return STAGES[operation]?.length ?? 1;
}
