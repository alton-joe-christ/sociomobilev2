export const STAGES = {
  "scanner.prepare": ["Initializing scanner", "Preparing camera", "Verifying access"],
  "scanner.verify": ["Reading code", "Verifying attendee", "Marking attendance"],
  "event.update": ["Saving changes", "Syncing event data", "Updating attendance"],
  "auth.restore": ["Restoring your session", "Verifying campus"],
  "auth.switch": ["Switching profiles", "Applying secure context"],
  "events.sync": ["Syncing events", "Updating cache"],
  "offline.recover": ["Reconnecting", "Syncing cached operations", "Offline cache ready"],
  "launch.first": [
    "Restoring your campus",
    "Preparing scanner",
    "Loading events",
    "Optimizing offline storage",
    "Almost ready",
  ],
  "cache.restore": ["Restoring cached session"],
  generic: ["Working"],
} as const;

export type OperationKey = keyof typeof STAGES;

export const TITLES: Record<OperationKey, string> = {
  "scanner.prepare": "Preparing Scanner",
  "scanner.verify": "Verifying Attendance",
  "event.update": "Updating Your Event",
  "auth.restore": "Restoring Session",
  "auth.switch": "Switching Profiles",
  "events.sync": "Syncing Events",
  "offline.recover": "Reconnecting",
  "launch.first": "Welcome to SOCIO",
  "cache.restore": "Restoring Cache",
  generic: "Working",
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
