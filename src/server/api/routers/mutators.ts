import { env } from "@/env";
import { db } from "@/server/db";
import {
  commentTable,
  descriptionTable,
  issueTable,
  workspaceChangeTable,
  type Comment,
  type Description,
  type Issue,
} from "@/server/db/schema";
import { noop } from "@/utils/utils";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import Pusher from "pusher";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const pusher = new Pusher({
  appId: env.PUSHER_APP_ID,
  key: env.PUSHER_APP_KEY,
  secret: env.PUSHER_APP_SECRET,
  host: env.PUSHER_APP_HOST,
  port: env.PUSHER_APP_PORT,
});

function poke(workspaceId: string) {
  pusher
    .trigger(workspaceId, "poke", {})
    .then(noop)
    .catch(function (e) {
      console.log(`Error poking workspace: ${workspaceId}`, e);
    });
}

const DeleteInputSchema = {
  COMMENT: z.object({
    collection: z.literal("comment"),
    key: z.string(),
    workspaceId: z.string(),
  }),
  ISSUE: z.object({
    collection: z.literal("issue"),
    key: z.string(),
    workspaceId: z.string(),
  }),
};

const UpdateInputSchema = {
  ISSUE: z.object({
    collection: z.literal("issue"),
    workspaceId: z.string(),
    params: z.object({
      id: z.string(),
      delta: z.object({
        status: z.string().optional(),
        priority: z.string().optional(),
      }),
    }),
  }),
  COMMENT: z.object({
    collection: z.literal("comment"),
    workspaceId: z.string(),
    params: z.object({
      id: z.string(),
      delta: z.object({
        body: z.string().optional(),
      }),
    }),
  }),
  DESCRIPTION: z.object({
    collection: z.literal("description"),
    workspaceId: z.string(),
    params: z.object({
      id: z.string(),
      delta: z.object({
        body: z.string().optional(),
      }),
    }),
  }),
};

const CreateInputSchema = {
  COMMENT: z.object({
    collection: z.literal("comment"),
    workspaceId: z.string(),
    params: z.object({
      id: z.string(),
      body: z.string(),
      creator: z.string(),
      issueId: z.string(),
    }),
  }),
  ISSUE: z.object({
    collection: z.literal("issue"),
    workspaceId: z.string(),
    params: z.object({
      status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
      id: z.string(),
      priority: z.enum(["NO_PRIORITY", "LOW", "MEDIUM", "HIGH", "URGENT"]),
      title: z.string(),
      creator: z.string(),
    }),
  }),
  DESCRIPTION: z.object({
    collection: z.literal("description"),
    workspaceId: z.string(),
    params: z.object({
      id: z.string(),
      body: z.string(),
      issueId: z.string(),
    }),
  }),
};

export const mutationRouter = createTRPCRouter({
  create: publicProcedure
    .input(CreateInputSchema.COMMENT)
    .mutation(
      async ({ ctx: { db }, input }): Promise<{ serverMutationId: number }> => {
        const { params, workspaceId } = input;

        const existingComment = await getComment(params.id, workspaceId);

        if (existingComment) {
          throw new TRPCError({
            code: "BAD_REQUEST",
          });
        }

        const comment = {
          ...params,
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Comment;

        const [result] = await db.insert(workspaceChangeTable).values({
          model: "COMMENT",
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: workspaceId,
          change: {
            method: "CREATE",
            key: params.id,
            value: comment,
          },
        });

        poke(workspaceId);

        return { serverMutationId: result.insertId };
      },
    ),
  update: publicProcedure
    .input(
      z.union([
        UpdateInputSchema.ISSUE,
        UpdateInputSchema.COMMENT,
        UpdateInputSchema.DESCRIPTION,
      ]),
    )
    .mutation(
      async ({ ctx: { db }, input }): Promise<{ serverMutationId: number }> => {
        const updateIssueSchemaParsingResult =
          UpdateInputSchema.ISSUE.safeParse(input);

        const isInputUpdateIssueType = updateIssueSchemaParsingResult.success;

        if (isInputUpdateIssueType) {
          const { params, workspaceId } = updateIssueSchemaParsingResult.data;

          const issue = await getIssue(params.id, workspaceId);

          if (!issue) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Issue with id ${params.id} does not exist`,
            });
          }

          const updatedIssue = {
            ...issue,
            ...params.delta,
            updatedAt: new Date(),
          } as Issue;

          const [result] = await db.insert(workspaceChangeTable).values({
            model: "ISSUE",
            change: {
              method: "UPDATE",
              key: params.id,
              value: updatedIssue,
            },
            workspaceId: workspaceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          poke(workspaceId);

          return { serverMutationId: result.insertId };
        }

        const updateCommentSchemaParsingResult =
          UpdateInputSchema.COMMENT.safeParse(input);

        const isInputUpdateCommentType =
          updateCommentSchemaParsingResult.success;

        if (isInputUpdateCommentType) {
          const { params, workspaceId } = updateCommentSchemaParsingResult.data;
          const comment = await getComment(params.id, workspaceId);

          if (!comment) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Comment with id ${params.id} does not exist`,
            });
          }

          const updatedComment = {
            ...comment,
            ...params.delta,
            updatedAt: new Date(),
          } as Comment;

          const [result] = await db.insert(workspaceChangeTable).values({
            model: "COMMENT",
            change: {
              method: "UPDATE",
              key: params.id,
              value: updatedComment,
            },
            workspaceId: workspaceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          poke(workspaceId);

          return { serverMutationId: result.insertId };
        }

        const updateDescriptionSchemaParsingResult =
          UpdateInputSchema.DESCRIPTION.safeParse(input);

        const isInputUpdateDescriptionType =
          updateDescriptionSchemaParsingResult.success;

        if (isInputUpdateDescriptionType) {
          const { params, workspaceId } =
            updateDescriptionSchemaParsingResult.data;

          const description = await getDescription(params.id, workspaceId);

          if (!description) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Description with id ${params.id} does not exist`,
            });
          }

          const updatedDescription = {
            ...description,
            ...params.delta,
            updatedAt: new Date(),
          } as Description;

          const [result] = await db.insert(workspaceChangeTable).values({
            model: "DESCRIPTION",
            change: {
              method: "UPDATE",
              key: params.id,
              value: updatedDescription,
            },
            workspaceId: workspaceId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          poke(workspaceId);

          return { serverMutationId: result.insertId };
        }

        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
        });
      },
    ),

  delete: publicProcedure
    .input(z.union([DeleteInputSchema.COMMENT, DeleteInputSchema.ISSUE]))
    .mutation(
      async ({ ctx: { db }, input }): Promise<{ serverMutationId: number }> => {
        const deleteCommentSchemaParsingResult =
          DeleteInputSchema.COMMENT.safeParse(input);

        const isInputDeleteCommentType =
          deleteCommentSchemaParsingResult.success;

        if (isInputDeleteCommentType) {
          const { key, workspaceId } = deleteCommentSchemaParsingResult.data;

          const comment = await getComment(key, workspaceId);

          if (!comment || comment.creator !== workspaceId) {
            throw new TRPCError({ code: "BAD_REQUEST" });
          }

          const [result] = await db.insert(workspaceChangeTable).values({
            model: "COMMENT",
            createdAt: new Date(),
            updatedAt: new Date(),
            workspaceId: workspaceId,
            change: {
              method: "DELETE",
              key,
            },
          });

          poke(workspaceId);

          return { serverMutationId: result.insertId };
        }

        const deleteIssueSchemaParsingResult =
          DeleteInputSchema.ISSUE.safeParse(input);

        const isInputDeleteIssueType = deleteIssueSchemaParsingResult.success;

        if (isInputDeleteIssueType) {
          const { key, workspaceId } = deleteIssueSchemaParsingResult.data;

          const issue = await getIssue(key, workspaceId);

          if (!issue || issue.creator !== workspaceId) {
            throw new TRPCError({ code: "BAD_REQUEST" });
          }

          const [result] = await db.insert(workspaceChangeTable).values({
            model: "ISSUE",
            createdAt: new Date(),
            updatedAt: new Date(),
            workspaceId: workspaceId,
            change: {
              method: "DELETE",
              key,
            },
          });

          poke(workspaceId);

          return { serverMutationId: result.insertId };
        }

        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
        });
      },
    ),

  createNewIssue: publicProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        issue: z.object({
          id: z.string(),
          title: z.string(),
          priority: z.enum(["NO_PRIORITY", "LOW", "MEDIUM", "HIGH", "URGENT"]),
          status: z.enum([
            "BACKLOG",
            "TODO",
            "IN_PROGRESS",
            "DONE",
            "CANCELLED",
          ]),
        }),
        description: z.object({
          body: z.string(),
        }),
      }),
    )
    .mutation(
      async ({ ctx: { db }, input: { issue, description, workspaceId } }) => {
        return await db.transaction(async (tx) => {
          const issueToInsert = {
            ...issue,
            createdAt: new Date(),
            updatedAt: new Date(),
            creator: workspaceId,
          } satisfies Issue;

          const descriptionToInsert = {
            ...description,
            id: issue.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            issueId: issue.id,
          } satisfies Description;

          await tx.insert(workspaceChangeTable).values({
            workspaceId,
            createdAt: new Date(),
            updatedAt: new Date(),
            model: "ISSUE",
            change: {
              method: "CREATE",
              key: issue.id,
              value: issueToInsert,
            },
          });

          const [result] = await tx.insert(workspaceChangeTable).values({
            workspaceId,
            createdAt: new Date(),
            updatedAt: new Date(),
            model: "DESCRIPTION",
            change: {
              method: "CREATE",
              key: issue.id,
              value: descriptionToInsert,
            },
          });

          poke(workspaceId);

          return { serverMutationId: result.insertId };
        });
      },
    ),
});

async function getIssue(issueId: string, workspaceId: string) {
  const issueFromDb = await db.query.issueTable.findFirst({
    where: eq(issueTable.id, issueId),
  });

  const workspaceChanges = await db.query.workspaceChangeTable.findMany({
    where: and(
      eq(workspaceChangeTable.workspaceId, workspaceId),
      eq(workspaceChangeTable.model, "ISSUE"),
    ),
    orderBy: asc(workspaceChangeTable.createdAt),
  });

  const issueChanges = workspaceChanges.filter((c) => {
    return c.change.key === issueId;
  });

  let issueToReturn = issueFromDb;

  for (const c of issueChanges) {
    if (c.change.method === "DELETE") {
      return null;
    }

    if (!issueToReturn && c.change.method === "UPDATE") {
      return null;
    }

    if (c.change.method === "CREATE" || c.change.method === "UPDATE") {
      issueToReturn = c.change.value as Issue;
    }
  }

  return issueToReturn;
}

async function getComment(commentId: string, workspaceId: string) {
  const commentFromDb = await db.query.commentTable.findFirst({
    where: eq(commentTable.id, commentId),
  });

  const workspaceChanges = await db.query.workspaceChangeTable.findMany({
    where: and(
      eq(workspaceChangeTable.workspaceId, workspaceId),
      eq(workspaceChangeTable.model, "COMMENT"),
    ),
    orderBy: asc(workspaceChangeTable.createdAt),
  });

  const commentChanges = workspaceChanges.filter((c) => {
    return c.change.key === commentId;
  });

  let commentToReturn = commentFromDb;

  for (const c of commentChanges) {
    if (c.change.method === "DELETE") {
      return null;
    }

    if (!commentToReturn && c.change.method === "UPDATE") {
      return null;
    }

    if (c.change.method === "CREATE" || c.change.method === "UPDATE") {
      commentToReturn = c.change.value as Comment;
    }
  }

  return commentToReturn;
}

async function getDescription(id: string, workspaceId: string) {
  const descriptionFromDb = await db.query.descriptionTable.findFirst({
    where: eq(descriptionTable.id, id),
  });

  const workspaceChanges = await db.query.workspaceChangeTable.findMany({
    where: and(
      eq(workspaceChangeTable.workspaceId, workspaceId),
      eq(workspaceChangeTable.model, "DESCRIPTION"),
    ),
    orderBy: asc(workspaceChangeTable.createdAt),
  });

  const descriptionChanges = workspaceChanges.filter((c) => {
    return c.change.key === id;
  });

  let descriptionToReturn = descriptionFromDb;

  for (const c of descriptionChanges) {
    if (c.change.method === "DELETE") {
      return null;
    }

    if (!descriptionToReturn && c.change.method === "UPDATE") {
      return null;
    }

    if (c.change.method === "CREATE" || c.change.method === "UPDATE") {
      descriptionToReturn = c.change.value as Description;
    }
  }

  return descriptionToReturn;
}
