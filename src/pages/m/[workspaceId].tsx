import { AppKBarPortal } from "@/components/KBarPortal";
import { SortSelect, type SortOption } from "@/components/SortSelect";
import { type Issue, type LuminarDBSchema } from "@/lib/luminardb";
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
import _ from "lodash";
import { LayoutGrid, List, Loader2 } from "lucide-react";
import {
  type InferSchemaTypeFromCollection,
  type QueryResultChange,
} from "luminardb";
import { type GetServerSideProps } from "next";
import { useRouter, type NextRouter } from "next/router";
import React from "react";
import { default as ReactLogo } from "../../assets/images/logo.svg";

import { CreateNewIssueModalButton } from "@/components/CreateNewIssueModal";
import { ObservableIssueBoard } from "@/components/IssueBoard";
import { ObservableIssueList } from "@/components/IssueList";
import { ObservableIssueModal } from "@/components/IssueModal";
import { isServer } from "@tanstack/react-query";
import {
  action,
  computed,
  makeAutoObservable,
  observable,
  transaction,
} from "mobx";
import { observer } from "mobx-react-lite";
import { Button, Tooltip, TooltipTrigger } from "react-aria-components";

const PRIORITY_VALUE_MAP = {
  NO_PRIORITY: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
} satisfies Record<
  InferSchemaTypeFromCollection<LuminarDBSchema["issue"]>["priority"],
  number
>;

const STATUS_VALUE_MAP = {
  BACKLOG: 0,
  TODO: 1,
  IN_PROGRESS: 2,
  DONE: 3,
  CANCELLED: 4,
} satisfies Record<
  InferSchemaTypeFromCollection<LuminarDBSchema["issue"]>["status"],
  number
>;

export class IssueObservable {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  creator: string;
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  constructor(issue: Issue) {
    this.id = issue.id;
    this.title = issue.title;
    this.createdAt = issue.createdAt;
    this.updatedAt = issue.updatedAt;
    this.creator = issue.creator;
    this.status = issue.status;
    this.priority = issue.priority;
    makeAutoObservable(this);
  }

  update(issue: Issue) {
    this.title = issue.title;
    this.createdAt = issue.createdAt;
    this.updatedAt = issue.updatedAt;
    this.creator = issue.creator;
    this.status = issue.status;
    this.priority = issue.priority;
  }
}

function reverseTimestamp(timestamp: string): string {
  return Math.floor(
    Number.MAX_SAFE_INTEGER - new Date(timestamp).getTime(),
  ).toString();
}

class Store {
  issues = new Map<string, IssueObservable>();
  sortOption: SortOption;
  selectedIssue: Issue | null = null;

  private getSearchParams<T = string>(key: string): T {
    let value = this.router.query[key] as T;
    if (!isServer) {
      const url = new URL(window.location.href);
      value = url.searchParams.get(key) as T;
    }
    return value;
  }

  private setSearchParams(key: string, value: string) {
    const url = new URL(window.location.href);
    if (!value) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    void this.router.replace(url, undefined, { shallow: true });
  }

  private getSortValueFromURL() {
    const sortOption = this.getSearchParams<SortOption>("sort");
    if (
      sortOption === "CREATED" ||
      sortOption === "MODIFIED" ||
      sortOption === "PRIORITY" ||
      sortOption === "STATUS"
    ) {
      return sortOption;
    }
    return "CREATED";
  }

  constructor(private router: NextRouter) {
    this.sortOption = this.getSortValueFromURL();
    makeAutoObservable(this, {
      issues: observable,
      sortOption: observable,
      sortedIssues: computed,
      handleChange: action,
      setSortOption: action,
    });
  }

  handleChange(changes: Array<QueryResultChange>) {
    transaction(() => {
      for (const change of changes) {
        switch (change.action) {
          case "INSERT":
            const observable = new IssueObservable(change.value as Issue);
            this.issues.set(change.key as string, observable);
            break;
          case "UPDATE":
            const issue = this.issues.get(change.key as string);
            if (!issue) break;
            issue.update({ ...issue, ...change.delta } as Issue);
            break;
          case "DELETE":
            this.issues.delete(change.key as string);
            break;
          default:
            throw new Error("Invalid query change method");
        }

        if (change.key === this.getSearchParams("issueId")) {
          const issue = this.issues.get(change.key);
          if (!issue) continue;
          this.setSelectedIssue(issue);
        }
      }
    });
  }

  private getSortFn(sortOption: SortOption) {
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

  get sortedIssues() {
    const sortOption = this.sortOption;

    const arrayOfIssues = Array.from(this.issues.values());

    const result = _.sortBy(arrayOfIssues, [this.getSortFn(sortOption)]);

    return result;
  }

  setSortOption(sortOption: SortOption) {
    this.sortOption = sortOption;
    this.setSearchParams("sort", sortOption);
  }

  setSelectedIssue(issue: Issue | null) {
    if (!issue) {
      this.selectedIssue = null;
      this.setSearchParams("issueId", "");
      return;
    }
    this.selectedIssue = issue;
    this.setSearchParams("issueId", issue.id);
  }

  get issuesGroupedByStatus() {
    return _.groupBy(
      _.sortBy(this.sortedIssues, [this.getSortFn("PRIORITY")]),
      "status",
    ) as unknown as Record<Issue["status"], Array<Issue>>;
  }

  get nextIssue() {
    const index = this.sortedIssues.findIndex(
      (i) => i.id === this.selectedIssue?.id,
    );
    if (index === -1) return null;
    return this.sortedIssues[index + 1]!;
  }

  get prevIssue() {
    const index = this.sortedIssues.findIndex(
      (i) => i.id === this.selectedIssue?.id,
    );
    if (index === -1) return null;
    return this.sortedIssues[index - 1]!;
  }
}

function WorkspacePage() {
  const {
    query: { workspaceId },
  } = useRouter();

  const router = useRouter();

  const { data: cursorMeta } = useDocument("cursorMeta", "meta", {
    async onChange(data) {
      if (!data) return;
      if (data.status === "PARTIAL_SYNC_COMPLETE") return;
      await new Promise((resolve) => setTimeout(resolve, 400));
      void db.pull();
    },
  });

  const db = useLuminarDB();

  const [store] = React.useState(() => {
    return new Store(router);
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

  const [isLoading, setIsLoading] = React.useState(true);
  const [view, setView] = React.useState<"list" | "board">("list");

  React.useEffect(() => {
    return db
      .collection("issue")
      .getAll()
      .watch((changes) => {
        setIsLoading(false);
        store.handleChange(changes);
      });
  }, [db, store]);

  useRegisterActions(
    Array.from(store.issues.values()).map((i) => ({
      id: `issue:${i.id}`,
      name: i.title,
      perform() {
        store.setSelectedIssue(i);
      },
    })),
    [store.issues.size],
  );

  useRegisterActions([
    {
      id: "toggle-view",
      name: "Toggle view",
      shortcut: ["$mod+b"],
      perform() {
        setView((v) => (v === "list" ? "board" : "list"));
      },
    },
  ]);

  if (isLoading) {
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
              {store.sortedIssues.length === 0 ? (
                <p>Syncing...</p>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="">
                    <span>{store.sortedIssues.length}</span> issues
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
                selectedOption={store.sortOption}
                onSelectedOptionChange={function (sortOption) {
                  store.setSortOption(sortOption);
                }}
              />
            </div>
          </div>
          <div>
            {store.selectedIssue ? (
              <ObservableIssueModal
                issue={store.selectedIssue}
                canGoBackward={!!store.prevIssue}
                canGoForward={!!store.nextIssue}
                onOpenChange={function (isOpen) {
                  if (!isOpen) store.setSelectedIssue(null);
                }}
                handleGoBackward={function () {
                  if (!store.prevIssue) return;
                  store.setSelectedIssue(store.prevIssue);
                }}
                handleGoForward={function () {
                  if (!store.nextIssue) return;
                  store.setSelectedIssue(store.nextIssue);
                }}
                workspaceId={workspaceId as string}
              />
            ) : null}
            {view === "board" ? (
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
            )}
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
  } = useRouter();

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
      destination: `/m/${workspaceId}`,
    },
  };
};
