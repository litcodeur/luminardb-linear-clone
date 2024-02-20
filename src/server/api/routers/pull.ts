import { type LuminarDBSchema } from "@/lib/luminardb";
import { db } from "@/server/db";
import {
  commentTable,
  descriptionTable,
  issueTable,
  workspaceChangeTable,
  type Comment,
  type Description,
  type Issue,
  type WorkspaceChange,
} from "@/server/db/schema";
import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import { type PullResponse } from "luminardb";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const DescriptionCursor = z.object({
  model: z.literal("DESCRIPTION"),
  issueId: z.string(),
  createdAt: z.string(),
});

const CommentCursor = z.object({
  model: z.literal("COMMENT"),
  issueId: z.string(),
  createdAt: z.string(),
});

const WorkspaceChangeCursor = z.object({
  lastChangeId: z.number(),
});

const ParsedCursorSchema = z.union([
  z.undefined(),
  DescriptionCursor,
  CommentCursor,
  WorkspaceChangeCursor,
]);

function fromBase64(str: string) {
  return JSON.parse(Buffer.from(str, "base64").toString("utf-8")) as unknown;
}

function toBase64(object: unknown) {
  return Buffer.from(JSON.stringify(object), "utf-8").toString("base64");
}

const CLEAR_OP = {
  action: "CLEAR",
} satisfies PullResponse<LuminarDBSchema>["change"]["issue"][number];

const PARTIAL_SYNC_COMPLETE_OP = {
  action: "CREATED",
  key: "meta",
  value: { status: "PARTIAL_SYNC_COMPLETE" },
} satisfies PullResponse<LuminarDBSchema>["change"]["cursorMeta"][number];

const PARTIAL_SYNC_INCOMPLETE_OP = {
  action: "CREATED",
  key: "meta",
  value: { status: "PARTIAL_SYNC_INCOMPLETE" },
} satisfies PullResponse<LuminarDBSchema>["change"]["cursorMeta"][number];

export const pullRouter = createTRPCRouter({
  pull: publicProcedure
    .input(z.object({ workspaceId: z.string(), cursor: z.string().optional() }))
    .query(async function ({
      input: { cursor, workspaceId },
    }): Promise<PullResponse<LuminarDBSchema>> {
      let parsedCursor: z.infer<typeof ParsedCursorSchema> = undefined;

      if (cursor) {
        const parsingResult = ParsedCursorSchema.safeParse(fromBase64(cursor));

        if (parsingResult.success) {
          parsedCursor = parsingResult.data;
        }
      }

      if (!parsedCursor) {
        const issues = await getWorkspaceIssuesChanges(workspaceId);

        const nextCursor = toBase64({
          issueId: "0",
          createdAt: "",
          model: "DESCRIPTION",
        } satisfies z.infer<typeof DescriptionCursor>);

        return {
          change: {
            comment: [CLEAR_OP],
            description: [CLEAR_OP],
            issue: issues,
            cursorMeta: [CLEAR_OP, PARTIAL_SYNC_INCOMPLETE_OP],
          },
          cursor: nextCursor,
          lastProcessedMutationId: 0,
        };
      }

      const descriptionCursorParsingResult =
        DescriptionCursor.safeParse(parsedCursor);
      if (descriptionCursorParsingResult.success) {
        const [descriptions, nextCursorJSON] =
          await getWorkspaceDescriptionAndNextCursor(
            descriptionCursorParsingResult.data,
            workspaceId,
          );

        return {
          change: {
            comment: [],
            description: descriptions,
            issue: [],
            cursorMeta: [CLEAR_OP, PARTIAL_SYNC_INCOMPLETE_OP],
          },
          cursor: toBase64(nextCursorJSON),
          lastProcessedMutationId: 0,
        };
      }

      const commentCursorParsingResult = CommentCursor.safeParse(parsedCursor);

      if (commentCursorParsingResult.success) {
        const [comments, nextCursorJSON] = await getWorkspaceCommentsAndCursor(
          commentCursorParsingResult.data,
        );

        const isPartialSyncComplete =
          WorkspaceChangeCursor.safeParse(nextCursorJSON).success;

        return {
          change: {
            comment: comments,
            description: [],
            issue: [],
            cursorMeta: isPartialSyncComplete
              ? [CLEAR_OP, PARTIAL_SYNC_COMPLETE_OP]
              : [CLEAR_OP, PARTIAL_SYNC_INCOMPLETE_OP],
          },
          cursor: toBase64(nextCursorJSON),
          lastProcessedMutationId: 0,
        };
      }

      const { lastChangeId } = parsedCursor as z.infer<
        typeof WorkspaceChangeCursor
      >;

      return getWorkspaceChanges(workspaceId, lastChangeId);
    }),
});

async function getWorkspaceIssuesChanges(
  workspaceId: string,
): Promise<PullResponse<LuminarDBSchema>["change"]["issue"]> {
  const issues = await db.query.issueTable.findMany({
    orderBy: desc(issueTable.createdAt),
  });

  const workspaceChangeIssues = await db.query.workspaceChangeTable.findMany({
    where: and(
      eq(workspaceChangeTable.workspaceId, workspaceId),
      eq(workspaceChangeTable.model, "ISSUE"),
    ),
  });

  const issueMap = new Map<string, Issue>();

  for (const issue of issues) {
    issueMap.set(issue.id, issue);
  }

  for (const change of workspaceChangeIssues) {
    if (change.change.method === "DELETE") {
      issueMap.delete(change.change.key);
    } else {
      const value = change.change.value as Issue;

      issueMap.set(change.change.key, {
        ...value,
        createdAt: new Date(value.createdAt),
        updatedAt: new Date(value.updatedAt),
      });
    }
  }

  return Array.from(issueMap.values()).map(
    (v) =>
      ({
        action: "CREATED",
        key: v.id,
        value: {
          ...v,
          createdAt: new Date(v.createdAt).toISOString(),
          updatedAt: new Date(v.updatedAt).toISOString(),
        },
      }) as PullResponse<LuminarDBSchema>["change"]["issue"][number],
  );
}

const LIMIT = 2000;

async function getWorkspaceDescriptionAndNextCursor(
  cursor: z.infer<typeof DescriptionCursor>,
  workspaceId: string,
): Promise<
  [
    PullResponse<LuminarDBSchema>["change"]["description"],
    z.infer<typeof ParsedCursorSchema>,
  ]
> {
  let q = db.query.descriptionTable.findMany({
    columns: { id: false },
    orderBy: [desc(descriptionTable.createdAt), desc(descriptionTable.issueId)],
    limit: LIMIT,
  });

  if (!!cursor.createdAt) {
    q = db.query.descriptionTable.findMany({
      where: or(
        and(
          eq(descriptionTable.createdAt, new Date(cursor.createdAt)),
          lt(descriptionTable.issueId, cursor.issueId),
        ),
        lt(descriptionTable.createdAt, new Date(cursor.createdAt)),
      ),
      columns: { id: false },
      orderBy: [
        desc(descriptionTable.createdAt),
        desc(descriptionTable.issueId),
      ],
      limit: LIMIT,
    });
  }

  console.log("Executing SQL query to fetch descriptions!");
  console.log(q.toSQL());
  const descriptions = await q.execute();
  console.log("Descriptions fetched!", descriptions.length);

  if (!cursor.createdAt) {
    console.log("Fetching workspace changes for descriptions");
    const workspaceChangeDescriptions =
      await db.query.workspaceChangeTable.findMany({
        where: and(
          eq(workspaceChangeTable.model, "DESCRIPTION"),
          eq(workspaceChangeTable.workspaceId, workspaceId),
        ),
        orderBy: [asc(workspaceChangeTable.createdAt)],
      });

    console.log({
      workspaceChangeDescriptions,
    });

    function convertToDescription(description: Description): Description {
      return {
        ...description,
        createdAt: new Date(description.createdAt),
        updatedAt: new Date(description.updatedAt),
      };
    }

    for (const change of workspaceChangeDescriptions) {
      if (change.change.method === "CREATE") {
        descriptions.push(
          convertToDescription(change.change.value as Description),
        );
      } else if (change.change.method === "UPDATE") {
        const descriptionIndex = descriptions.findIndex(
          (d) => d.issueId === change.change.key,
        );
        const doesDescriptionExist = descriptionIndex !== -1;

        if (!doesDescriptionExist) {
          continue;
        }

        descriptions[descriptionIndex] = convertToDescription(
          change.change.value as Description,
        );
      }
    }
  }

  let nextCursorJSON: z.infer<typeof ParsedCursorSchema>;

  if (descriptions.length === 0) {
    nextCursorJSON = { model: "COMMENT", createdAt: "", issueId: "0" };
  } else {
    const lastDescription = descriptions[descriptions.length - 1]!;

    nextCursorJSON = {
      model: "DESCRIPTION",
      issueId: lastDescription.issueId.toString(),
      createdAt: lastDescription.createdAt.toISOString(),
    } satisfies z.infer<typeof DescriptionCursor>;
  }

  return [
    descriptions.map(
      (d) =>
        ({
          key: d.issueId,
          action: "CREATED",
          value: {
            ...d,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
          },
        }) satisfies PullResponse<LuminarDBSchema>["change"]["description"][number],
    ),
    nextCursorJSON,
  ];
}

async function getWorkspaceCommentsAndCursor(
  cursor: z.infer<typeof CommentCursor>,
): Promise<
  [
    PullResponse<LuminarDBSchema>["change"]["comment"],
    z.infer<typeof ParsedCursorSchema>,
  ]
> {
  let q = db.query.commentTable.findMany({
    orderBy: [desc(commentTable.createdAt), desc(commentTable.issueId)],
    limit: LIMIT,
  });

  if (cursor.createdAt) {
    q = db.query.commentTable.findMany({
      where: or(
        and(
          eq(commentTable.createdAt, new Date(cursor.createdAt)),
          lt(commentTable.issueId, cursor.issueId),
        ),
        lt(commentTable.createdAt, new Date(cursor.createdAt)),
      ),
      orderBy: [desc(commentTable.createdAt), desc(commentTable.issueId)],
      limit: LIMIT,
    });
  }

  const comments = await q.execute();

  console.log("Executing SQL query to fetch comments");
  console.log(q.toSQL());
  console.log("Comments fetched!", comments.length);

  let nextCursorJSON: z.infer<typeof ParsedCursorSchema>;

  if (comments.length === 0) {
    nextCursorJSON = { lastChangeId: 0 };
  } else {
    const lastComment = comments[comments.length - 1]!;

    nextCursorJSON = {
      model: "COMMENT",
      issueId: lastComment.issueId.toString(),
      createdAt: lastComment.createdAt.toISOString(),
    };
  }

  return [
    comments.map((c) => ({
      key: c.id,
      action: "CREATED",
      value: {
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      },
    })),
    nextCursorJSON,
  ];
}

async function getWorkspaceChanges(
  workspaceId: string,
  lastChangeId: number,
): Promise<PullResponse<LuminarDBSchema>> {
  const workspaceChanges = await db.query.workspaceChangeTable.findMany({
    where: and(
      gt(workspaceChangeTable.id, lastChangeId),
      eq(workspaceChangeTable.workspaceId, workspaceId),
    ),
    orderBy: asc(workspaceChangeTable.createdAt),
  });

  if (workspaceChanges.length === 0) {
    return {
      change: {
        description: [],
        comment: [],
        issue: [],
        cursorMeta: [],
      },
      cursor: toBase64({ lastChangeId } satisfies z.infer<
        typeof WorkspaceChangeCursor
      >),
      lastProcessedMutationId: lastChangeId,
    };
  }

  const commentChange: Array<WorkspaceChange> = [];

  const issueChanges: Array<WorkspaceChange> = [];

  const descriptionChanges: Array<WorkspaceChange> = [];

  workspaceChanges.forEach((c) => {
    if (c.model === "ISSUE") {
      issueChanges.push(c);
    } else if (c.model === "COMMENT") {
      commentChange.push(c);
    } else if (c.model === "DESCRIPTION") {
      descriptionChanges.push(c);
    }
  });

  const parsedCommentChanges: PullResponse<LuminarDBSchema>["change"]["comment"] =
    commentChange.map((c) => {
      if (c.change.method === "DELETE") {
        return {
          key: c.change.key,
          action: "DELETED",
        } satisfies PullResponse<LuminarDBSchema>["change"]["comment"][number];
      }

      const comment = c.change.value as Comment;

      if (c.change.method === "CREATE") {
        return {
          action: "CREATED",
          key: c.change.key,
          value: {
            ...comment,
            createdAt: new Date(comment.createdAt).toISOString(),
            updatedAt: new Date(comment.updatedAt).toISOString(),
          },
        } satisfies PullResponse<LuminarDBSchema>["change"]["comment"][number];
      }

      return {
        key: c.change.key,
        action: "UPDATED",
        value: {
          ...comment,
          createdAt: new Date(comment.createdAt).toISOString(),
          updatedAt: new Date(comment.updatedAt).toISOString(),
        },
      } satisfies PullResponse<LuminarDBSchema>["change"]["comment"][number];
    });

  const parsedIssueChanges: PullResponse<LuminarDBSchema>["change"]["issue"] =
    issueChanges.map((c) => {
      if (c.change.method === "DELETE") {
        return {
          key: c.change.key,
          action: "DELETED",
        } satisfies PullResponse<LuminarDBSchema>["change"]["issue"][number];
      }

      const issue = c.change.value as Issue;

      if (c.change.method === "CREATE") {
        return {
          action: "CREATED",
          key: c.change.key,
          value: {
            ...issue,
            createdAt: new Date(issue.createdAt).toISOString(),
            updatedAt: new Date(issue.updatedAt).toISOString(),
          },
        } satisfies PullResponse<LuminarDBSchema>["change"]["issue"][number];
      }

      return {
        key: c.change.key,
        action: "UPDATED",
        value: {
          ...issue,
          createdAt: new Date(issue.createdAt).toISOString(),
          updatedAt: new Date(issue.updatedAt).toISOString(),
        },
      } satisfies PullResponse<LuminarDBSchema>["change"]["issue"][number];
    });

  const parsedDescriptionChanges: PullResponse<LuminarDBSchema>["change"]["description"] =
    descriptionChanges.map((c) => {
      if (c.change.method === "DELETE") {
        return {
          key: c.change.key,
          action: "DELETED",
        } satisfies PullResponse<LuminarDBSchema>["change"]["description"][number];
      }

      const issue = c.change.value as Description;

      if (c.change.method === "CREATE") {
        return {
          action: "CREATED",
          key: c.change.key,
          value: {
            ...issue,
            createdAt: new Date(issue.createdAt).toISOString(),
            updatedAt: new Date(issue.updatedAt).toISOString(),
          },
        } satisfies PullResponse<LuminarDBSchema>["change"]["description"][number];
      }

      return {
        key: c.change.key,
        action: "UPDATED",
        value: {
          ...issue,
          createdAt: new Date(issue.createdAt).toISOString(),
          updatedAt: new Date(issue.updatedAt).toISOString(),
        },
      } satisfies PullResponse<LuminarDBSchema>["change"]["description"][number];
    });

  const lastWorkspaceChangeId =
    workspaceChanges[workspaceChanges.length - 1]!.id;

  const nextCursorJSON = {
    lastChangeId: lastWorkspaceChangeId,
  } satisfies z.infer<typeof WorkspaceChangeCursor>;

  const nextCursorString = toBase64(nextCursorJSON);

  return {
    change: {
      description: parsedDescriptionChanges,
      cursorMeta: [],
      comment: parsedCommentChanges,
      issue: parsedIssueChanges,
    },
    cursor: nextCursorString,
    lastProcessedMutationId: lastWorkspaceChangeId,
  };
}
