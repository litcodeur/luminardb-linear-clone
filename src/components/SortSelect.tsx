import clsx from "clsx";
import { ArrowDownUp } from "lucide-react";
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";

const SORT_OPTIONS = [
  {
    label: "Created",
    value: "CREATED",
  },
  {
    label: "Modified",
    value: "MODIFIED",
  },
  {
    label: "Priority",
    value: "PRIORITY",
  },
  {
    label: "Status",
    value: "STATUS",
  },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export function SortSelect({
  selectedOption,
  onSelectedOptionChange,
}: {
  selectedOption: SortOption;
  onSelectedOptionChange: (option: SortOption) => void;
}) {
  return (
    <Select
      aria-label="Sort issues"
      onSelectionChange={function (k) {
        onSelectedOptionChange(k as SortOption);
      }}
      selectedKey={selectedOption}
    >
      <Button
        className={clsx(
          "flex items-center gap-2 rounded-md p-1 px-2 outline-none",
          "hover:bg-neutral-700 focus:bg-neutral-700 ",
        )}
      >
        <SelectValue />
        <ArrowDownUp className="h-4 w-4" />
      </Button>
      <Popover
        className={clsx(
          "rounded-md  p-1",
          "bg-neutral-800/70 backdrop-blur",
          "border border-solid border-neutral-800",
          "overflow-auto",
        )}
      >
        <ListBox selectionMode="single" items={SORT_OPTIONS}>
          {({ label, value }) => {
            return (
              <ListBoxItem
                className={clsx(
                  "w-full min-w-[16ch] rounded-md outline-none",
                  "cursor-pointer p-1.5 text-sm",
                  "hover:bg-neutral-700  focus:bg-neutral-700 ",
                )}
                id={value}
              >
                {label}
              </ListBoxItem>
            );
          }}
        </ListBox>
      </Popover>
    </Select>
  );
}
