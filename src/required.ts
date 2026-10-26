/** Check an expected host invariant before using its value. */
export function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error('Expected a host value to be present.');
  return value;
}
