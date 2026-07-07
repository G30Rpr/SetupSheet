/** A labeled group of dropdown options, e.g. a car class or track pack. */
export interface SelectOptionGroup {
  label: string;
  options: string[];
}

/** Whether `value` appears in any group's options list. */
export function isKnownOption(groups: SelectOptionGroup[] | undefined, value: string): boolean {
  if (!groups) return false;
  return groups.some((g) => g.options.includes(value));
}
