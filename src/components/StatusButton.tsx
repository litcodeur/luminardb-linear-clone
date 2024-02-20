import { type LDBIssue } from "@/lib/luminardb";
import clsx from "clsx";
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
} from "react-aria-components";
import { StatusIcon } from "./StatusIcon";

type Status = LDBIssue["status"];

export const STATUS_LIST: Array<{ value: Status; label: string }> = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "CANCELLED", label: "Cancelled" },
];

type StatusButtonProps = {
  status: Status;
  onSelectedStatusChange: (status: Status) => void;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export const StatusButton = ({
  status,
  onSelectedStatusChange,
  showLabel = false,
  size = "md",
}: StatusButtonProps) => {
  return (
    <Select
      aria-label="Update status"
      onSelectionChange={function (k) {
        onSelectedStatusChange(k as Status);
      }}
      selectedKey={status}
    >
      <Button
        excludeFromTabOrder
        className={clsx(
          "flex items-center gap-2 rounded-md outline-none",
          "hover:bg-neutral-700 focus:bg-neutral-700",
          showLabel ? "w-full p-4" : "h-6 w-6",
          size === "sm" ? "h-4 w-4 px-2 py-3 text-sm" : "text-md h-6 w-6 p-1",
        )}
      >
        <StatusIcon status={status} />
        {showLabel ? (
          <p>{STATUS_LIST.find((i) => i.value === status)!.label}</p>
        ) : null}
      </Button>
      <Popover
        className={clsx(
          "rounded-md  p-1",
          "bg-neutral-800/70 backdrop-blur",
          "border border-solid border-neutral-800",
          "overflow-auto",
        )}
      >
        <ListBox selectionMode="single" items={STATUS_LIST}>
          {({ label, value }) => {
            return (
              <ListBoxItem
                className={clsx(
                  "w-full min-w-[20ch] rounded-md outline-none",
                  "cursor-pointer p-1.5 text-sm",
                  "hover:bg-neutral-700  focus:bg-neutral-700",
                  "flex items-center gap-2",
                )}
                id={value}
                textValue={label}
              >
                <StatusIcon status={value} />
                {label}
              </ListBoxItem>
            );
          }}
        </ListBox>
      </Popover>
    </Select>
  );
};
