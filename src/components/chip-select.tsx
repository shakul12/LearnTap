"use client";

export function ChipSelect({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              active
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-indigo-400"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
