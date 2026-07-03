import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SetupValues } from "@/lib/types";

export type { SetupValues };

export const emptySetupValues: SetupValues = {
  frontTirePressure: "",
  rearTirePressure: "",
  frontCamber: "",
  rearCamber: "",
  frontArb: "",
  rearArb: "",
  frontRideHeight: "",
  rearRideHeight: "",
  frontAero: "",
  rearAero: "",
  diffPreload: "",
  diffPower: "",
  brakeBias: "",
  finalDrive: "",
};

interface FieldSpec {
  key: keyof SetupValues;
  label: string;
  placeholder: string;
}

interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

const groups: FieldGroup[] = [
  {
    title: "Tires",
    fields: [
      { key: "frontTirePressure", label: "Front pressure", placeholder: "e.g. 28.5 psi" },
      { key: "rearTirePressure", label: "Rear pressure", placeholder: "e.g. 27.0 psi" },
      { key: "frontCamber", label: "Front camber", placeholder: "e.g. -3.5°" },
      { key: "rearCamber", label: "Rear camber", placeholder: "e.g. -2.0°" },
    ],
  },
  {
    title: "Suspension",
    fields: [
      { key: "frontArb", label: "Front anti-roll bar", placeholder: "e.g. 3 clicks" },
      { key: "rearArb", label: "Rear anti-roll bar", placeholder: "e.g. 5 clicks" },
      { key: "frontRideHeight", label: "Front ride height", placeholder: "e.g. 55 mm" },
      { key: "rearRideHeight", label: "Rear ride height", placeholder: "e.g. 65 mm" },
    ],
  },
  {
    title: "Aero",
    fields: [
      { key: "frontAero", label: "Front splitter/wing", placeholder: "e.g. 2" },
      { key: "rearAero", label: "Rear wing", placeholder: "e.g. 4" },
    ],
  },
  {
    title: "Differential",
    fields: [
      { key: "diffPreload", label: "Preload", placeholder: "e.g. 20 Nm" },
      { key: "diffPower", label: "Power / coast", placeholder: "e.g. 45% / 30%" },
    ],
  },
  {
    title: "Brakes & Gearing",
    fields: [
      { key: "brakeBias", label: "Brake bias", placeholder: "e.g. 54% front" },
      { key: "finalDrive", label: "Final drive", placeholder: "e.g. 3.44" },
    ],
  },
];

export function SetupValuesFields({
  values,
  onChange,
}: {
  values: SetupValues;
  onChange: (key: keyof SetupValues, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
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
                  value={values[field.key]}
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
