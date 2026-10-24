export type AgentProgressStatus = "PENDING" | "ACTIVE" | "COMPLETE" | "WARNING" | "FAILED";

export type AgentProgressStage = "DISCOVERY" | "MATCHING" | "OPTIMIZATION" | "CART";

export interface AgentProgressEvent {
  stage: AgentProgressStage;
  label: string;
  detail?: string;
  status: AgentProgressStatus;
  timestamp: string;
}

export type ProgressReporter = (event: AgentProgressEvent) => void;

export function progress(
  stage: AgentProgressStage,
  label: string,
  status: AgentProgressStatus,
  detail?: string,
): AgentProgressEvent {
  return { stage, label, detail, status, timestamp: new Date().toISOString() };
}

export function eventKey(event: AgentProgressEvent) {
  return `${event.timestamp}|${event.stage}|${event.status}|${event.label}|${event.detail ?? ""}`;
}

export function mergeAgentEvents(...groups: AgentProgressEvent[][]) {
  const seen = new Set<string>();
  const merged: AgentProgressEvent[] = [];
  for (const group of groups) {
    for (const event of group) {
      const key = eventKey(event);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(event);
    }
  }
  return merged;
}

/** Keep the original event for Advanced details; map known agent actions into shopper-facing copy. */
export function humanizeAgentEvent(event: AgentProgressEvent): AgentProgressEvent {
  const label = event.label.trim();
  const searching = label.match(/^Searching(?:[\w\s]+)? for (.+)$/i);
  const adding = label.match(/^Adding (.+?)(?: to cart)?$/i);
  const moving = label.match(/^Moving to (.+)$/i);
  let next = label;
  if (/opening the protected|starting shopping|shopping browser ready|preview opened/i.test(label)) next = "Starting shopping session";
  else if (searching) next = `Searching for ${searching[1]}`;
  else if (moving) next = `Moving to ${moving[1]}`;
  else if (/results inspected|\bmatched\b/i.test(label) && !/needs attention/i.test(label)) next = "Found possible matches";
  else if (/product review ready|waiting for approval/i.test(label)) next = "Waiting for approval";
  else if (adding) next = `Adding ${adding[1].replace(/ to cart$/i, "")} to cart`;
  else if (/inspecting cart|cart inspection|verifying cart/i.test(label)) next = "Verifying cart";
  else if (/cart build complete|shopping complete/i.test(label)) next = "Shopping complete";
  return next === event.label ? event : { ...event, label: next };
}
