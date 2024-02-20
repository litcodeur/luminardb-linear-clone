import { useGetAvailableHeight, useGetAvailableWidth } from "@/lib/hooks";
import { type LDBIssue } from "@/lib/luminardb";
import { usePrefetchIssueDetails } from "@/lib/luminardb-hooks";
import { useLuminarDB } from "@/providers/luminardb-provider";
import clsx from "clsx";
import { makeAutoObservable } from "mobx";
import { observer } from "mobx-react-lite";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  DragPreview,
  useDrag,
  useDrop,
  type DragPreviewRenderer,
  type TextDropItem,
} from "react-aria";
import useVirtual from "react-cool-virtual";
import { StatusIcon } from "./StatusIcon";

class DragStore {
  item: IssueDragItem | null = null;

  constructor(currentItem: IssueDragItem | null) {
    this.item = currentItem;
    makeAutoObservable(this);
  }

  get parsed(): LDBIssue | null {
    if (!this.item) return null;

    return JSON.parse(this.item.serializedIssue) as LDBIssue;
  }

  setItem(item: IssueDragItem | null) {
    this.item = item;
  }
}

const store = new DragStore(null);

type IssueDragItem = {
  serializedIssue: string;
};

function IssueCard({ issue }: { issue: LDBIssue }) {
  usePrefetchIssueDetails(issue.id);

  return (
    <div
      key={`issue-card:${issue.id}`}
      className="h-24 w-80 rounded-md bg-neutral-800 p-2 text-sm"
    >
      <div>
        <p className="line-clamp-2 max-w-80 font-semibold text-neutral-200">
          {issue.title}
        </p>
      </div>
    </div>
  );
}

const ObservableIssueCard = observer(IssueCard);

const IssueBoardItem = React.forwardRef<
  HTMLAnchorElement,
  {
    issue: LDBIssue;
    onSelect: (issue: LDBIssue) => void;
  }
>(({ issue, onSelect }, ref) => {
  const previewRef = React.useRef<DragPreviewRenderer>(null);

  const { dragProps, isDragging } = useDrag({
    preview: previewRef,
    getItems() {
      return [
        {
          serializedIssue: JSON.stringify(issue),
          issueId: issue.id,
          type: "issue",
        },
      ];
    },
    onDragStart() {
      store.setItem({
        serializedIssue: JSON.stringify(issue),
      });
    },
    onDragEnd() {
      store.setItem(null);
    },
  });

  const pathname = usePathname();

  return (
    <>
      <Link
        {...dragProps}
        ref={ref}
        href={{ pathname, query: { issueId: issue.id } }}
        onClick={function (e) {
          e.preventDefault();
          onSelect(issue);
        }}
        className={clsx(isDragging ? "hidden" : null)}
      >
        <ObservableIssueCard issue={issue} />
      </Link>
      <DragPreview ref={previewRef}>
        {() => {
          return (
            <div>
              <ObservableIssueCard issue={issue} />
            </div>
          );
        }}
      </DragPreview>
    </>
  );
});

IssueBoardItem.displayName = "IssueBoardItem";

const ObservableIssueBoardItem = observer(IssueBoardItem);

function Column({
  status,
  title,
  issues,
  onIssueSelect,
  onIssueUpdate,
}: {
  status: LDBIssue["status"];
  title: string;
  issues: Array<LDBIssue>;
  onIssueSelect: (issue: LDBIssue) => void;
  onIssueUpdate: (issue: LDBIssue) => void;
}) {
  const db = useLuminarDB();

  const { innerRef, outerRef, items } = useVirtual<
    HTMLDivElement,
    HTMLDivElement
  >({
    itemCount: issues.length,
    itemSize: 96,
  });

  const height = useGetAvailableHeight(outerRef);

  const { dropProps, isDropTarget } = useDrop({
    ref: outerRef,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onDrop: async (e) => {
      const items = await Promise.all(
        e.items.map(async (i) => {
          const typedItem = i as TextDropItem;

          const key: keyof IssueDragItem = "serializedIssue";

          const text = await typedItem.getText(key);

          return text;
        }),
      );

      const serializedIssue = items[0];

      if (!serializedIssue) return;

      const issue = JSON.parse(serializedIssue) as LDBIssue;

      const delta = {
        status,
        updatedAt: new Date().toISOString(),
      };

      /**
       * Updating issue observable before writing to db
       * because it prevents jitters as it might take a few ms for the write
       * to commit and update the observable
       */
      onIssueUpdate({
        ...issue,
        ...delta,
      });

      await db.mutate
        .update({
          collection: "issue",
          key: issue.id,
          delta,
        })
        .catch(() => {
          onIssueUpdate(issue);
        });
    },
  });

  return (
    <div>
      <div className="relative max-w-80 flex-shrink-0">
        <div className="flex items-center gap-2 pb-2 pl-1 pt-4">
          <div>
            <StatusIcon status={status} />
          </div>
          <p>{title}</p>
        </div>

        <div className="relative">
          <div
            {...dropProps}
            ref={outerRef}
            className="relative"
            style={{ height, overflow: "auto" }}
          >
            <div
              className={clsx(
                "absolute h-full w-full rounded-md bg-neutral-950/75 backdrop-blur-sm",
                "left-0 z-10",
                isDropTarget ? "block" : "hidden",
              )}
              style={{ height, top: 0 + (outerRef.current?.scrollTop ?? 0) }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <div className="rounded-md border border-solid border-neutral-500 bg-neutral-950 ">
                  <div className="px-4 py-2 text-sm">
                    {store.parsed?.status === status ? (
                      <p>
                        This board is ordered by{" "}
                        <strong className="capitalize">Priority</strong>
                      </p>
                    ) : (
                      <p className="flex flex-col gap-2 p-2">
                        <span>Drop here to move to this column</span>
                        <span>
                          This board is ordered by{" "}
                          <strong className="capitalize">Priority</strong>
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div
              ref={innerRef}
              className={clsx(
                "flex flex-col gap-4",
                "relative h-full min-w-80",
              )}
            >
              {items.map(({ index, measureRef }) => {
                const issue = issues[index]!;

                if (!issue) return null;

                return (
                  <ObservableIssueBoardItem
                    onSelect={onIssueSelect}
                    ref={measureRef}
                    key={`issue-board-item:${issue.id}`}
                    issue={issue}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ObserableColumn = observer(Column);

function IssueBoard({
  issuesGroupedByStatus,
  onIssueSelect,
  onIssueUpdate,
}: {
  issuesGroupedByStatus: Record<LDBIssue["status"], Array<LDBIssue>>;
  onIssueSelect: (issue: LDBIssue) => void;
  onIssueUpdate: (issue: LDBIssue) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const width = useGetAvailableWidth(ref);

  return (
    <div className="px-2">
      <div
        className="flex gap-4"
        ref={ref}
        style={{
          width,
          overflow: "auto",
        }}
      >
        {columns.map((c) => {
          return (
            <ObserableColumn
              onIssueUpdate={onIssueUpdate}
              onIssueSelect={onIssueSelect}
              issues={issuesGroupedByStatus[c.status] ?? []}
              title={c.title}
              status={c.status}
              key={`issue-draggable-column-${c.status}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export const ObservableIssueBoard = observer(IssueBoard);

const columns: Array<{ status: LDBIssue["status"]; title: string }> = [
  {
    status: "BACKLOG",
    title: "Backlog",
  },
  {
    status: "TODO",
    title: "To do",
  },
  {
    status: "IN_PROGRESS",
    title: "In progress",
  },
  {
    status: "DONE",
    title: "Done",
  },
  {
    status: "CANCELLED",
    title: "Cancelled",
  },
];
