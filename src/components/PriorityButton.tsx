import { type LuminarDBSchema } from "@/lib/luminardb";
import clsx from "clsx";
import React from "react";
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
} from "react-aria-components";
import { type InferSchemaTypeFromCollection } from "luminardb";
import NoPriorityIcon from "../assets/icons/dots.svg";
import UrgentPriorityIcon from "../assets/icons/rounded-claim.svg";
import MediumPriorityIcon from "../assets/icons/signal-medium.svg";
import HighPriorityIcon from "../assets/icons/signal-strong.svg";
import LowPriorityIcon from "../assets/icons/signal-weak.svg";

type Priority = InferSchemaTypeFromCollection<
  LuminarDBSchema["issue"]
>["priority"];

type SVGELement = React.FunctionComponent<
  React.ComponentPropsWithoutRef<"svg">
>;

const priorityIconSrc: Record<Priority, SVGELement> = {
  NO_PRIORITY: NoPriorityIcon as SVGELement,

  LOW: LowPriorityIcon as SVGELement,

  MEDIUM: MediumPriorityIcon as SVGELement,

  HIGH: HighPriorityIcon as SVGELement,

  URGENT: UrgentPriorityIcon as SVGELement,
};

function PriorityIcon({ priority }: { priority: Priority }) {
  const Icon = priorityIconSrc[priority] as unknown as React.FunctionComponent<
    React.ComponentPropsWithoutRef<"svg">
  >;

  return <Icon className="h-4 w-4 text-gray-50" />;
}

export const PRIORITY_LIST: Array<{ value: Priority; label: string }> = [
  { value: "NO_PRIORITY", label: "No priority" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

type PriorityButtonProps = {
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export const PriorityButton = ({
  priority,
  onPriorityChange,
  showLabel = false,
  size = "md",
}: PriorityButtonProps) => {
  return (
    <Select
      excludeFromTabOrder
      aria-label="Update priority"
      onSelectionChange={function (k) {
        onPriorityChange(k as Priority);
      }}
      selectedKey={priority}
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
        <PriorityIcon priority={priority} />
        {showLabel ? (
          <p>{PRIORITY_LIST.find((i) => i.value === priority)!.label}</p>
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
        <ListBox selectionMode="single" items={PRIORITY_LIST}>
          {({ label, value }) => {
            return (
              <ListBoxItem
                className={clsx(
                  "w-full min-w-[16ch] rounded-md outline-none ",
                  "cursor-pointer p-1.5  text-sm",
                  "hover:bg-neutral-700  focus:bg-neutral-700 ",
                  "flex items-center gap-2",
                )}
                id={value}
                textValue={label}
              >
                <PriorityIcon priority={value} />
                {label}
              </ListBoxItem>
            );
          }}
        </ListBox>
      </Popover>
    </Select>
  );
};
