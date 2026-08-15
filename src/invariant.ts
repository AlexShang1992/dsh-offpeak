/**
 * The plugin's invariant companion: a small runtime assertion used where a
 * violated precondition would corrupt durable state. Kept as its own module so
 * the host entry stays free of test-only machinery, and so the companion can
 * be imported independently (mirroring the harness's invariant convention).
 */
/** Throw when `condition` is false; `message` must name the violated invariant. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[dsh-offpeak] invariant violated: ${message}`)
  }
}
