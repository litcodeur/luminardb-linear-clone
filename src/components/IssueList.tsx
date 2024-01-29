import { type Issue, type LuminarDBSchema } from "@/lib/luminardb";
import { usePrefetchIssueDetails } from "@/lib/luminardb-hooks";
import { useLuminarDB } from "@/providers/luminardb-provider";
import clsx from "clsx";
import { format } from "date-fns";
import { type InferSchemaTypeFromCollection } from "luminardb";
import { observer } from "mobx-react-lite";
import React from "react";
import { useFocus, usePress } from "react-aria";
import useVirtual from "react-cool-virtual";
import { PriorityButton } from "./PriorityButton";
import { StatusButton } from "./StatusButton";

const IssueListItem = React.forwardRef<
  HTMLDivElement,
  {
    issue: InferSchemaTypeFromCollection<LuminarDBSchema["issue"]>;
    onSelect: (issue: Issue) => void;
    style?: React.CSSProperties;
  }
>(function ({ issue, onSelect, style }, ref) {
  const { focusProps } = useFocus({});
  const { pressProps } = usePress({
    onPress() {
      onSelect(issue);
    },
  });
  const db = useLuminarDB();

  usePrefetchIssueDetails(issue.id);

  return (
    <div
      {...focusProps}
      {...pressProps}
      ref={ref}
      style={style}
      className={clsx(
        "flex w-full hover:bg-neutral-800",
        "cursor-pointer p-2  text-sm",
        "border-collapse border-b border-solid border-neutral-200/20",
      )}
    >
      <div className="flex w-full gap-2">
        <div className="flex items-center gap-2">
          <PriorityButton
            onPriorityChange={function (priority) {
              void db.mutate.update({
                collection: "issue",
                delta: {
                  priority,
                  updatedAt: new Date().toISOString(),
                },
                key: issue.id,
              });
            }}
            priority={issue.priority}
          />
          <StatusButton
            onSelectedStatusChange={async function (status) {
              void db.mutate.update({
                collection: "issue",
                delta: {
                  status,
                  updatedAt: new Date().toISOString(),
                },
                key: issue.id,
              });
            }}
            status={issue.status}
          />
        </div>
        <div className="flex w-full flex-nowrap items-center justify-between overflow-hidden">
          <div className="line-clamp-1 w-full overflow-hidden text-ellipsis">
            {issue.title}
          </div>
          <div className="mr-2 min-w-[13ch] text-right text-gray-300">
            {format(new Date(issue.updatedAt), "MMM d")}
          </div>
        </div>
      </div>
    </div>
  );
});

IssueListItem.displayName = "IssueListItem";

export const ObservableIssueListItem = observer(IssueListItem);

function useGetAvailableHeight<T extends React.RefObject<HTMLElement>>(ref: T) {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    // Calculate the available height on screen from where the outer ref element is placed
    if (!ref.current) return;

    function handleResize() {
      if (!ref.current) return;

      const availableHeight =
        window.innerHeight - ref.current.getBoundingClientRect().top ?? 0;

      setHeight(availableHeight);
    }

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ref]);

  return height;
}

function IssueList({
  issues,
  onIssueSelect,
}: {
  issues: Array<InferSchemaTypeFromCollection<LuminarDBSchema["issue"]>>;
  onIssueSelect: (issue: Issue) => void;
  selectedIssueId?: string;
}) {
  const { outerRef, innerRef, items } = useVirtual<
    HTMLDivElement,
    HTMLDivElement
  >({ itemCount: issues.length, itemSize: 32 });

  const height = useGetAvailableHeight(outerRef);

  return (
    <div
      className="box-border"
      ref={outerRef}
      style={{ height: height, width: "100%", overflow: "auto" }}
    >
      <div ref={innerRef} className="relative">
        {items.map(({ index, measureRef }) => {
          const issue = issues[index]!;

          return (
            <ObservableIssueListItem
              onSelect={onIssueSelect}
              key={`issue-list-issue:${issue.id}`}
              issue={issue}
              ref={measureRef}
            />
          );
        })}
      </div>
    </div>
  );
}

export const ObservableIssueList = observer(IssueList);
