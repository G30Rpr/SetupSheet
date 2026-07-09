import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isKnownOption, type SelectOptionGroup } from "@/lib/select-options";

/**
 * A dropdown grouped into labeled sections (e.g. car class, track pack)
 * with a manual-entry escape hatch, falling back to plain free text when
 * there's no known roster for the current game at all.
 */
export function GroupedSelectField({
  id,
  groups,
  useManual,
  onToggleManual,
  defaultValue,
  selectPlaceholder,
  inputPlaceholder,
  maxLength,
}: {
  id: string;
  groups: SelectOptionGroup[] | undefined;
  useManual: boolean;
  onToggleManual: (manual: boolean) => void;
  defaultValue?: string;
  selectPlaceholder: string;
  inputPlaceholder: string;
  maxLength?: number;
}) {
  if (groups && !useManual) {
    return (
      <>
        <Select
          name={id}
          required
          defaultValue={defaultValue && isKnownOption(groups, defaultValue) ? defaultValue : undefined}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={selectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => onToggleManual(true)}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Not listed? Enter it manually
        </button>
      </>
    );
  }

  return (
    <>
      <Input
        id={id}
        name={id}
        placeholder={inputPlaceholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required
      />
      {groups && (
        <button
          type="button"
          onClick={() => onToggleManual(false)}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Choose from the list instead
        </button>
      )}
    </>
  );
}
