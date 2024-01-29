import { type LuminarDBSchema } from "@/lib/luminardb";
import { useCollection, useDocument } from "@/lib/luminardb-hooks";
import { useLuminarDB } from "@/providers/luminardb-provider";
import { generateId } from "@/utils/id";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import {
  Priority,
  VisualState,
  useKBar,
  useRegisterActions,
  type Action,
} from "kbar";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import React from "react";
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  TextArea,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import { Remark } from "react-remark";
import { type InferSchemaTypeFromCollection } from "luminardb";
import { PRIORITY_LIST, PriorityButton } from "./PriorityButton";
import { STATUS_LIST, StatusButton } from "./StatusButton";
import { observer } from "mobx-react-lite";
import { FocusScope } from "react-aria";

function IssueModal({
  issue,
  canGoBackward,
  canGoForward,
  handleGoBackward,
  handleGoForward,
  onOpenChange,
  workspaceId,
}: {
  issue: InferSchemaTypeFromCollection<LuminarDBSchema["issue"]>;
  onOpenChange: (isOpen: boolean) => void;
  handleGoForward: () => void;
  handleGoBackward: () => void;
  canGoForward: boolean;
  canGoBackward: boolean;
  workspaceId: string;
}) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);

  const { isVisible } = useKBar((s) => ({
    isVisible: s.visualState !== VisualState.hidden,
  }));

  const { data: description } = useDocument("description", issue.id);

  React.useEffect(() => {
    function handleResize() {
      if (!outerRef.current) return;
      if (!innerRef.current) return;

      const innerElement = innerRef.current;

      // Reset inner elemnts height and width
      innerElement.style.height = "0px";
      innerElement.style.width = "0px";

      const outerElement = outerRef.current;

      innerRef.current.style.height =
        outerElement.getBoundingClientRect().height + "px";
      innerRef.current.style.width =
        outerElement.getBoundingClientRect().width + "px";
    }

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [description]);

  function getActions() {
    const actions: Array<Action> = [];

    if (canGoBackward) {
      actions.push({
        id: "go-to-previous-issue",
        name: "Go to previous issue",
        priority: Priority.HIGH,
        shortcut: ["k"],
        perform: handleGoBackward,
        keywords: "previous, back, issue",
      });
    }

    if (canGoForward) {
      actions.push({
        id: "go-to-next-issue",
        name: "Go to next issue",
        priority: Priority.HIGH,
        shortcut: ["j"],
        perform: handleGoForward,
        keywords: "forward, next, issue",
      });
    }
    actions.push({
      id: `change-issue-${issue.id}-status`,
      name: "Change issue status",
    });

    STATUS_LIST.forEach(({ label, value }) => {
      actions.push({
        id: `change-issue-${issue.id}-status-to-${value}`,
        name: label,
        parent: `change-issue-${issue.id}-status`,
        async perform() {
          void db.mutate.update({
            collection: "issue",
            key: issue.id,
            delta: { status: value, updatedAt: new Date().toISOString() },
          });
        },
      });
    });

    actions.push({
      id: `change-issue-${issue.id}-priority`,
      name: "Change issue priority",
    });

    PRIORITY_LIST.forEach(({ label, value }) => {
      actions.push({
        id: `change-issue-${issue.id}-priority-to-${value}`,
        name: label,
        parent: `change-issue-${issue.id}-priority`,
        async perform() {
          void db.mutate.update({
            collection: "issue",
            key: issue.id,
            delta: { priority: value, updatedAt: new Date().toISOString() },
          });
        },
      });
    });

    if (issue.creator === workspaceId) {
      actions.push({
        id: `delete-issue-${issue.id}`,
        name: "Delete issue",
        shortcut: ["d"],
        priority: Priority.HIGH,
        async perform() {
          await db.mutate.delete({
            collection: "issue",
            key: issue.id,
          });
          onOpenChange(false);
        },
      });
    }

    return actions;
  }

  useRegisterActions(getActions(), [canGoBackward, canGoForward, issue.id]);

  const { data: comments } = useCollection(
    "comment",
    {
      where: { issueId: { eq: issue.id } },
    },
    [issue.id],
  );

  const db = useLuminarDB();

  const childBaseClassName = clsx("issue-modal-grid-item");

  const [isEditing, setIsEditing] = React.useState(false);

  const [descriptionBody, setDescriptionBody] = React.useState(
    description?.body,
  );

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isVisible}
      isKeyboardDismissDisabled={isVisible}
      onOpenChange={onOpenChange}
      className={clsx(
        "absolute left-0 top-0  h-screen w-screen bg-neutral-950/50 backdrop-blur-sm",
        "px-4 py-4 md:px-8 md:py-8",
      )}
    >
      <Modal className={"mx-auto max-w-screen-lg"}>
        <Dialog
          className={clsx(
            "border-collapse rounded-md border border-solid border-gray-300/40",
            "bg-zinc-900 shadow  shadow-neutral-600/90",
            "outline-none",
            "min-w-screen-lg h-[95vh] max-w-screen-lg",
          )}
          aria-label={`Issue: ${issue.title}`}
        >
          <div
            className={clsx(
              "w-ful h-full",
              "grid md:grid-cols-[8fr_1fr] md:grid-rows-[auto_1fr]",
              "grid grid-cols-[auto] grid-rows-[auto_auto_auto_1fr]",
              "gap-[1px]",
            )}
          >
            <div
              className={clsx(
                childBaseClassName,
                "p-4",
                "md:col-start-1 md:row-start-1",
                "row-start-2",
                "md:rounded-tl-md",
              )}
            >
              <h1 className="font-extrabold md:text-lg">{issue.title}</h1>
            </div>
            <div
              className={clsx(
                childBaseClassName,
                "bg-zinc-950",
                "md:col-start-2 md:row-start-1",
                "row-start-1",
                "rounded-t-md md:rounded-tr-md",
                "py-4 md:py-0",
              )}
            >
              <div className="flex h-full items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <button
                    disabled={!canGoBackward}
                    onClick={handleGoBackward}
                    className="rounded-md border border-solid border-neutral-500/50 p-1 disabled:bg-zinc-700"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </button>
                  <button
                    disabled={!canGoForward}
                    onClick={handleGoForward}
                    className="rounded-md border border-solid border-neutral-500/50 p-1 disabled:bg-zinc-700"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </button>
                </div>
                <div className="flex items-center">
                  <button
                    className="rounded-md border border-solid border-neutral-500/50 p-1 disabled:bg-zinc-700"
                    onClick={function () {
                      onOpenChange(false);
                    }}
                  >
                    <X />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={clsx(
                childBaseClassName,
                "h-full rounded-b-md md:rounded-bl-md",
                "md:col-start-1 md:row-start-2",
                "row-start-4",
              )}
              ref={outerRef}
            >
              <div ref={innerRef} className="overflow-hidden py-4">
                <div className="h-full w-full overflow-scroll overflow-x-hidden p-4">
                  <FocusScope contain={isEditing}>
                    {issue.creator === workspaceId ? (
                      <div className="mb-2">
                        <div className="flex justify-end">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button
                                className={clsx(
                                  "text-sm",
                                  "rounded-md p-1 px-2",
                                  "outline-none",
                                  "text-red-500 hover:bg-red-400/10 hover:text-red-600",
                                  "hover:text-red-600 focus:bg-red-400/10",
                                )}
                                onPress={function () {
                                  setIsEditing(false);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                className={clsx(
                                  "text-sm",
                                  "rounded-md p-1 px-2",
                                  "border border-solid border-neutral-500/50",
                                  "hover:bg-neutral-700 focus:bg-neutral-700",
                                )}
                                onPress={async function () {
                                  await db.mutate.update({
                                    collection: "description",
                                    delta: {
                                      body: descriptionBody,
                                      updatedAt: new Date().toISOString(),
                                    },
                                    key: description!.issueId,
                                  });
                                  setIsEditing(false);
                                }}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <Button
                              className={clsx(
                                "rounded-md border border-solid border-neutral-500/50 p-1 px-2",
                                "hover:bg-neutral-700 focus:bg-neutral-700",
                              )}
                              isDisabled={isEditing}
                              onPress={function () {
                                setIsEditing(true);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <div className="overflow-x-scroll rounded-md border border-solid border-neutral-500/50 bg-zinc-800 p-4">
                      {description ? (
                        isEditing ? (
                          <TextArea
                            className={clsx(
                              "w-full resize-none bg-transparent outline-none",
                            )}
                            autoFocus
                            rows={4}
                            value={descriptionBody ?? description?.body}
                            onChange={function (e) {
                              setDescriptionBody(e.target.value);
                            }}
                          />
                        ) : (
                          <Remark>{description.body}</Remark>
                        )
                      ) : (
                        <div>Loading...</div>
                      )}
                    </div>
                  </FocusScope>
                  <hr className="my-8 bg-neutral-400" />
                  <h3 className="text-lg font-bold">Comments</h3>
                  <div className="mt-4 flex flex-col gap-4">
                    {comments
                      .sort(function (a, b) {
                        return (
                          new Date(a.createdAt).getTime() -
                          new Date(b.createdAt).getTime()
                        );
                      })
                      .map((comment) => {
                        return (
                          <div
                            key={comment.id}
                            className="w-full overflow-x-scroll rounded-md border border-solid border-neutral-500/50 bg-zinc-800"
                          >
                            <div className="w-full">
                              <div className="w-full border-b border-solid border-neutral-500/40 px-4 py-2">
                                <div className="flex w-full items-center justify-between text-sm">
                                  <div className="mr-2 font-bold">
                                    {comment.creator === workspaceId
                                      ? "Me"
                                      : comment.creator}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-gray-400">
                                      {formatDistanceToNow(
                                        new Date(comment.createdAt),
                                        { addSuffix: true },
                                      )}
                                    </div>
                                    {comment.creator === workspaceId ? (
                                      <TooltipTrigger
                                        delay={50}
                                        closeDelay={50}
                                      >
                                        <Button
                                          onPress={async function () {
                                            void db.mutate.delete({
                                              collection: "comment",
                                              key: comment.id,
                                            });
                                          }}
                                        >
                                          <X className="h-4 w-4" />
                                          <Tooltip
                                            className={clsx(
                                              "bg-neutral-800/50 backdrop-blur",
                                              "rounded-md p-1 px-2",
                                              "border border-solid border-neutral-500/50",
                                              "text-neutral-300",
                                            )}
                                          >
                                            Delete comment
                                          </Tooltip>
                                        </Button>
                                      </TooltipTrigger>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                              <div className="px-4 py-2">
                                <Remark>{comment.body}</Remark>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    <CommentForm issueId={issue.id} workspaceId={workspaceId} />
                  </div>
                </div>
              </div>
            </div>
            <div
              className={clsx(
                childBaseClassName,
                "bg-zinc-950 md:rounded-br-md",
                "md:col-start-2 md:row-start-2",
                "row-start-3",
                "py-4 md:py-0",
              )}
            >
              <div className="flex min-w-[20ch] flex-col gap-4 px-4 md:pt-4">
                <PriorityButton
                  priority={issue.priority}
                  onPriorityChange={async function (priority) {
                    void db.mutate.update({
                      collection: "issue",
                      key: issue.id,
                      delta: {
                        priority,
                        updatedAt: new Date().toISOString(),
                      },
                    });
                  }}
                  showLabel
                />

                <StatusButton
                  status={issue.status}
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
                  showLabel
                />

                {issue.creator === workspaceId ? (
                  <Button
                    className={clsx(
                      "flex items-center gap-2 rounded-md outline-none",
                      "hover:bg-neutral-700 focus:bg-neutral-700",
                      "w-full px-2 py-1",
                    )}
                    onPress={async function () {
                      await db.mutate.delete({
                        collection: "issue",
                        key: issue.id,
                      });
                      onOpenChange(false);
                    }}
                  >
                    Delete Issue
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function CommentForm({
  issueId,
  workspaceId,
}: {
  issueId: string;
  workspaceId: string;
}) {
  const [commentBody, setCommentBody] = React.useState("");
  const db = useLuminarDB();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!commentBody) return;
    const commentId = generateId("comment");
    await db.mutate.create({
      collection: "comment",
      key: commentId,
      value: {
        id: commentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creator: workspaceId,
        body: commentBody,
        issueId: issueId,
      },
    });
    setCommentBody("");
  }
  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        "rounded-md border border-solid border-neutral-500/50 bg-zinc-800 p-4",
      )}
    >
      <textarea
        rows={4}
        className="w-full resize-none bg-transparent outline-none"
        placeholder="Write a comment..."
        value={commentBody}
        onChange={function (e) {
          setCommentBody(e.target.value);
        }}
      />
      <div className="flex w-full justify-end">
        <button className="rounded-md bg-zinc-700 p-1 px-2">Comment</button>
      </div>
    </form>
  );
}

export const ObservableIssueModal = observer(IssueModal);
