import { AppKBarPortal } from "@/components/KBarPortal";
import { useDocument } from "@/lib/luminardb-hooks";
import {
  LuminarDBProvider,
  useLuminarDB,
} from "@/providers/luminardb-provider";
import { PusherProvider, usePusher } from "@/providers/pusher-provider";
import { ONE_YEAR_IN_MS, WORKSPACE_ID_COOKIE_KEY } from "@/utils/constants";
import { generateId, idDetails } from "@/utils/id";
import clsx from "clsx";
import Cookies from "cookies";
import { KBarProvider, useRegisterActions } from "kbar";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import { type GetServerSideProps } from "next";
import { useRouter } from "next/router";
import React from "react";
import { default as ReactLogo } from "../../assets/images/logo.svg";

import { CreateNewIssueModalButton } from "@/components/CreateNewIssueModal";
import { ObservableIssueList } from "@/components/IssueList";
import { ObjectGraphFactory } from "@/lib/object-graph";
import { observer } from "mobx-react-lite";
import { Button, Tooltip, TooltipTrigger } from "react-aria-components";
import { SortOption, SortSelect } from "@/components/SortSelect";
import { Issue } from "@/lib/models";
import _ from "lodash";
import { ObservableIssueModal } from "@/components/IssueModal";

function useURLState<T extends string = string>(key: string, defaultValue: T) {
  const {
    query: { [key]: value },
    replace,
  } = useRouter();

  const currentValue: T = value ? (String(value) as T) : defaultValue;

  const set = React.useCallback(
    (newValue: T) => {
      const url = new URL(window.location.href);
      if (!newValue) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, newValue);
      }

      replace(url, undefined, { shallow: true });
    },
    [key, replace],
  );

  return [currentValue, set] as const;
}

const PRIORITY_VALUE_MAP = {
  NO_PRIORITY: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} satisfies Record<Issue["priority"], number>;

const STATUS_VALUE_MAP = {
  BACKLOG: 0,
  TODO: 1,
  IN_PROGRESS: 2,
  DONE: 3,
  CANCELLED: 4,
} satisfies Record<Issue["status"], number>;

function reverseTimestamp(timestamp: string): string {
  return Math.floor(
    Number.MAX_SAFE_INTEGER - new Date(timestamp).getTime(),
  ).toString();
}

function getSortFn(sortOption: SortOption) {
  return function (issue: Issue) {
    if (sortOption === "MODIFIED") {
      return reverseTimestamp(issue.updatedAt);
    }
    if (sortOption === "PRIORITY") {
      return `${PRIORITY_VALUE_MAP[issue.priority]}-${reverseTimestamp(
        issue.updatedAt,
      )}`;
    }

    if (sortOption === "STATUS") {
      return `${STATUS_VALUE_MAP[issue.status]}-${reverseTimestamp(
        issue.updatedAt,
      )}`;
    }

    return reverseTimestamp(issue.createdAt);
  };
}

function WorkspacePage() {
  const {
    query: { workspaceId },
  } = useRouter();

  const { data: cursorMeta } = useDocument("cursorMeta", "meta", {
    async onChange(data) {
      if (!data) return;
      if (data.status === "PARTIAL_SYNC_COMPLETE") return;
      await new Promise((resolve) => setTimeout(resolve, 400));
      void db.pull();
    },
  });

  const db = useLuminarDB();

  const [graph] = React.useState(() => {
    return ObjectGraphFactory.getInstance(workspaceId as string, db);
  });

  const pusher = usePusher();

  React.useEffect(() => {
    if (!pusher) return;
    const channel = pusher.subscribe(workspaceId as string);

    channel.bind("poke", async function () {
      await db.pull();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(workspaceId as string);
    };
  }, [db, pusher, workspaceId]);

  const [view, setView] = React.useState<"list" | "board">("list");
  const [sortOrder, setSortOrder] = useURLState<SortOption>("sort", "CREATED");
  const [selectedIssueId, setSelectedIssueId] = useURLState<string>("iss", "");

  const sortedIssues = _.sortBy(graph.workspace.issues.toArray, [
    getSortFn(sortOrder),
  ]);

  const selectedIssueIndex = sortedIssues.findIndex(
    (i) => i.id === selectedIssueId,
  );
  const selectedIssue =
    selectedIssueIndex === -1 ? null : sortedIssues[selectedIssueIndex];
  const nextIssue =
    selectedIssueIndex === -1 ? null : sortedIssues[selectedIssueIndex + 1];
  const previousIssue =
    selectedIssueIndex === -1 ? null : sortedIssues[selectedIssueIndex - 1];

  useRegisterActions(
    sortedIssues.map((i) => ({
      id: `kbar-issue-${i.id}`,
      name: i.title,
      perform() {
        setSelectedIssueId(i.id);
      },
    })),
    [sortedIssues],
  );

  if (!graph.isLoaded) {
    return null;
  }

  return (
    <main>
      <div className="flex h-screen flex-row flex-nowrap">
        <div className="hidden w-[24ch] flex-shrink-0 border-r border-solid border-neutral-200/20 p-4 md:block">
          <div className="flex flex-col gap-4">
            <div>
              <button
                className={clsx(
                  "flex items-center gap-2 p-2",
                  "rounded-md bg-zinc-800/70 hover:bg-zinc-800 focus:bg-zinc-800",
                )}
              >
                <ReactLogo className="h-8 w-8" />
                <span className="text-md mr-4">React</span>
              </button>
            </div>
            <div>
              <CreateNewIssueModalButton />
            </div>
          </div>
        </div>
        <div className="w-full">
          <div className="flex w-full items-center justify-between border-b border-solid border-neutral-200/20 px-4 py-2 text-sm">
            <div className="">
              {graph.workspace.issues.length === 0 ? (
                <p>Syncing...</p>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="">
                    <span>{graph.workspace.issues.length}</span> issues
                  </p>
                  {cursorMeta?.status !== "PARTIAL_SYNC_COMPLETE" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <TooltipTrigger delay={50} closeDelay={50}>
                  <Button
                    onPress={function () {
                      setView("list");
                    }}
                  >
                    <List
                      className={clsx(
                        "h-4 w-4",
                        view === "list"
                          ? "text-neutral-100"
                          : "text-neutral-300",
                      )}
                    />
                  </Button>
                  <Tooltip
                    offset={10}
                    placement="bottom"
                    className={clsx(
                      "bg-neutral-800/50 backdrop-blur",
                      "rounded-md p-1 px-2",
                      "border border-solid border-neutral-500/50",
                      "text-neutral-300",
                      "text-sm",
                    )}
                  >
                    <div className="flex items-baseline">
                      <p>List</p>
                      <span className="ml-2 flex items-baseline gap-1">
                        <kbd className="rounded-md bg-zinc-800/90 p-1 px-2 text-xs">
                          ⌘
                        </kbd>
                        <kbd className="rounded-md bg-zinc-800/90 p-1 px-2 text-xs">
                          b
                        </kbd>
                      </span>
                    </div>
                  </Tooltip>
                </TooltipTrigger>
                <TooltipTrigger delay={50} closeDelay={50}>
                  <Button
                    onPress={function () {
                      setView("board");
                    }}
                  >
                    <LayoutGrid
                      className={clsx(
                        "h-4 w-4",
                        view === "board"
                          ? "text-neutral-100"
                          : "text-neutral-300",
                      )}
                    />
                  </Button>
                  <Tooltip
                    offset={10}
                    placement="bottom"
                    className={clsx(
                      "bg-neutral-800/50 backdrop-blur",
                      "rounded-md p-1 px-2",
                      "border border-solid border-neutral-500/50",
                      "text-neutral-300",
                      "text-sm",
                    )}
                  >
                    <div className="flex items-baseline">
                      <p>Board</p>
                      <span className="ml-2 flex items-baseline gap-1">
                        <kbd className="rounded-md bg-zinc-800/90 p-1 px-2 text-xs">
                          ⌘
                        </kbd>
                        <kbd className="rounded-md bg-zinc-800/90 p-1 px-2 text-xs">
                          b
                        </kbd>
                      </span>
                    </div>
                  </Tooltip>
                </TooltipTrigger>
              </div>
              <SortSelect
                selectedOption={sortOrder}
                onSelectedOptionChange={function (sortOption) {
                  setSortOrder(sortOption);
                }}
              />
            </div>
          </div>
          <div>
            {selectedIssue ? (
              <ObservableIssueModal
                pool={graph.getPool()}
                issue={selectedIssue}
                canGoBackward={!!previousIssue}
                canGoForward={!!nextIssue}
                onOpenChange={function (isOpen) {
                  if (!isOpen) setSelectedIssueId("");
                }}
                handleGoBackward={function () {
                  if (!previousIssue) return;
                  setSelectedIssueId(previousIssue.id);
                }}
                handleGoForward={function () {
                  if (!nextIssue) return;
                  setSelectedIssueId(nextIssue.id);
                }}
                workspaceId={workspaceId as string}
              />
            ) : null}
            {/* {view === "board" ? (
              <ObservableIssueBoard
                onIssueSelect={function (i) {
                  store.setSelectedIssue(i);
                }}
                issuesGroupedByStatus={store.issuesGroupedByStatus}
                onIssueUpdate={function (i) {
                  const issueObservable = store.issues.get(i.id);
                  if (!issueObservable) return;
                  issueObservable.update(i);
                }}
              />
            ) : (
              <ObservableIssueList
                selectedIssueId={store.selectedIssue?.id}
                issues={store.sortedIssues}
                onIssueSelect={function (issue) {
                  store.setSelectedIssue(issue);
                }}
              />
            )} */}

            <ObservableIssueList
              issues={sortedIssues}
              onIssueSelect={(issue) => {
                setSelectedIssueId(issue.id);
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

const ObservableWorkspacePage = observer(WorkspacePage);

export default function WorkspacePageWithProviders() {
  const {
    query: { workspaceId },
    isReady,
  } = useRouter();

  if (!isReady) {
    return null;
  }

  return (
    <LuminarDBProvider workspaceId={workspaceId as string}>
      <PusherProvider>
        <KBarProvider>
          <AppKBarPortal />
          <ObservableWorkspacePage />
        </KBarProvider>
      </PusherProvider>
    </LuminarDBProvider>
  );
}

export const getServerSideProps: GetServerSideProps<
  Record<string, never>,
  { workspaceId: string }
> = async function ({ req, res, params }) {
  const cookie = new Cookies(req, res);

  let workspaceId = cookie.get(WORKSPACE_ID_COOKIE_KEY);

  if (workspaceId === params?.workspaceId) {
    return {
      props: {},
    };
  }

  if (params?.workspaceId.length === idDetails.workspace.length) {
    workspaceId = params?.workspaceId;
    cookie.set(WORKSPACE_ID_COOKIE_KEY, workspaceId, {
      expires: new Date(Date.now() + ONE_YEAR_IN_MS),
    });
  }

  if (!workspaceId) {
    workspaceId = generateId("workspace");
    cookie.set(WORKSPACE_ID_COOKIE_KEY, workspaceId, {
      expires: new Date(Date.now() + ONE_YEAR_IN_MS),
    });
  }

  return {
    props: {},
    redirect: {
      destination: `/s/${workspaceId}`,
    },
  };
};
