import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Option = { id: string; name: string; active: boolean };

export function CategorySelect({
  categories,
  value,
  onChange,
  error,
}: {
  categories: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string | undefined;
}) {
  const selected = value.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">
        Categories <span className="text-primary">*</span>
      </legend>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="Select categories"
            aria-invalid={!!error}
            className="h-auto min-h-11 w-full justify-between bg-secondary/50 px-3 py-2 text-left font-normal"
          >
            <span className="min-w-0 whitespace-normal break-words">
              {selected.length ? selected.join(", ") : "Select categories"}
            </span>
            <ChevronDown className="shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-1"
        >
          <div className="max-h-72 overflow-y-auto">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-secondary"
              >
                <Checkbox
                  checked={value.includes(c.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true ? [...value, c.id] : value.filter((id) => id !== c.id),
                    )
                  }
                />
                <span className="min-w-0 break-words">
                  {c.name}
                  {c.active ? "" : " (inactive)"}
                </span>
              </label>
            ))}
            {!categories.length && (
              <p className="p-3 text-sm text-muted-foreground">No categories available.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
