import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEmptySetupValues, setupSchemas } from "@/lib/setup-schemas";
import type { Game, SetupValues } from "@/lib/types";

export type { SetupValues };
export { getEmptySetupValues };

export function SetupValuesFields({
  game,
  values,
  onChange,
}: {
  game: Game;
  values: SetupValues;
  onChange: (key: string, value: string) => void;
}) {
  const groups = setupSchemas[game];

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        Fields below match {game}&apos;s own setup screen.
      </p>
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2.5">
          <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
          <div className="grid grid-cols-2 gap-3">
            {group.fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={field.key} className="text-xs font-normal text-muted-foreground">
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ""}
                  onChange={(e) => onChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
