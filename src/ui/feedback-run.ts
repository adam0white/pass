/** Remove only the browser consent key from an explicit unlinked feedback copy. */
export function unlinkedFeedbackRun(run: unknown): unknown {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return run;
  const copy = { ...(run as Record<string, unknown>) };
  if (copy.continuity && typeof copy.continuity === 'object' && !Array.isArray(copy.continuity)) {
    const continuity = { ...(copy.continuity as Record<string, unknown>) };
    delete continuity.recordingKey;
    copy.continuity = continuity;
  }
  return copy;
}
