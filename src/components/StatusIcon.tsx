import { type LDBIssue } from "@/lib/luminardb";
import CancelIcon from "../assets/icons/cancel.svg";
import BacklogIcon from "../assets/icons/circle-dot.svg";
import TodoIcon from "../assets/icons/circle.svg";
import DoneIcon from "../assets/icons/done.svg";
import InProgressIcon from "../assets/icons/half-circle.svg";

type Status = LDBIssue["status"];

type SVGELement = React.FunctionComponent<
  React.ComponentPropsWithoutRef<"svg">
>;

const StatusToIconMap: Record<Status, SVGELement> = {
  BACKLOG: BacklogIcon as SVGELement,
  CANCELLED: CancelIcon as SVGELement,
  DONE: DoneIcon as SVGELement,
  IN_PROGRESS: InProgressIcon as SVGELement,
  TODO: TodoIcon as SVGELement,
};

export function StatusIcon({ status }: { status: Status }) {
  const Icon = StatusToIconMap[status] as unknown as React.FunctionComponent<
    React.ComponentPropsWithoutRef<"svg">
  >;

  return <Icon className="text-gray-50" />;
}
