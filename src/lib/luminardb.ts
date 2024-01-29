import { apiClient } from "@/utils/api";
import { generateId } from "@/utils/id";
import { TRPCClientError } from "@trpc/client";
import {
  Collection,
  createIDBStorageEngine,
  type AnyDatabaseSchema,
  type CollectionMetadata,
  type Database,
  type InferSchemaTypeFromCollection,
  type Mutators,
  type RetryConfig,
  type WriteTransaction,
} from "luminardb";

export type Issue = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  creator: string;
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "NO_PRIORITY" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

const issueCollectionMetadata = {
  indexes: {},
} satisfies CollectionMetadata<Issue>;

const issueCollection = new Collection<Issue, typeof issueCollectionMetadata>(
  "issue",
  issueCollectionMetadata,
);

type Comment = {
  id: string;
  createdAt: string;
  updatedAt: string;
  creator: string;
  body: string;
  issueId: string;
};

const commentCollectionMetadata = {
  indexes: { issueId: true },
} satisfies CollectionMetadata<Comment>;

const commentCollection = new Collection<
  Comment,
  typeof commentCollectionMetadata
>("comment", commentCollectionMetadata);

type Description = {
  createdAt: string;
  updatedAt: string;
  body: string;
  issueId: string;
};

const descriptionCollectionMetadata = {
  indexes: { issueId: true },
} satisfies CollectionMetadata<Description>;

const descriptionCollection = new Collection<
  Description,
  typeof descriptionCollectionMetadata
>("description", descriptionCollectionMetadata);

const cursorMetaCollection = new Collection<{
  status: "PARTIAL_SYNC_COMPLETE" | "PARTIAL_SYNC_INCOMPLETE";
}>("cursor_meta", { indexes: {} });

const schema = {
  issue: issueCollection,
  comment: commentCollection,
  description: descriptionCollection,
  cursorMeta: cursorMetaCollection,
} as const satisfies AnyDatabaseSchema;

export type LuminarDBSchema = typeof schema;

function getMutators(workspaceId: string) {
  return {
    create: createMutationResolver(workspaceId),
    update: updateMutationResolver(workspaceId),
    delete: deleteMutationResolver(workspaceId),
    createNewIssue: function ({
      descriptionBody,
      priority,
      status,
      title,
    }: {
      descriptionBody: string;
      priority: Issue["priority"];
      status: Issue["status"];
      title: string;
    }) {
      return resolver({
        async localResolver(tx) {
          const issue = {
            id: generateId("issue"),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            creator: workspaceId,
            priority,
            status,
            title,
          } satisfies Issue;

          const description = {
            body: descriptionBody,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            issueId: issue.id,
          } satisfies Description;

          await tx.collection("issue").insert(issue.id, issue);
          await tx
            .collection("description")
            .insert(description.issueId, description);

          return issue;
        },
        remoteResolver: {
          async mutationFn(data) {
            return apiClient.mutate.createNewIssue.mutate({
              workspaceId,
              issue: {
                id: data.id,
                priority,
                status,
                title: title,
              },
              description: { body: descriptionBody },
            });
          },
          shouldRetry: shouldRetryFn,
        },
      });
    },
  } as const satisfies Mutators<LuminarDBSchema>;
}

export function getDatabaseParams(
  workspaceId: string,
): ConstructorParameters<
  typeof Database<LuminarDBSchema, ReturnType<typeof getMutators>>
>[0] {
  const engine = createIDBStorageEngine({
    name: workspaceId,
    schema,
    version: 1,
  });
  return {
    storageEngine: engine,
    puller: async (cursor) => {
      return apiClient.pull.pull.query({
        workspaceId,
        cursor: cursor as string,
      });
    },
    mutators: getMutators(workspaceId),
  };
}

const shouldRetryFn = (_: number, error: unknown) => {
  if (error instanceof TRPCClientError) {
    if (!error.data) {
      return true;
    }
    if ((error.data as Record<"httpStatus", number>).httpStatus === 429) {
      return true;
    }
    if (
      (error.data as Record<"code", string>).code === "INTERNAL_SERVER_ERROR"
    ) {
      return true;
    }
    return false;
  }
  return true;
};

function createMutationResolver(workspaceId: string) {
  return function <T extends keyof Pick<LuminarDBSchema, "comment">>({
    collection,
    key,
    value,
  }: {
    collection: T;
    key: string;
    value: InferSchemaTypeFromCollection<LuminarDBSchema[T]>;
  }) {
    return {
      localResolver(tx) {
        return tx.collection(collection).insert(key, value);
      },
      remoteResolver: {
        mutationFn() {
          return apiClient.mutate.create.mutate({
            collection,
            params: value,
            workspaceId,
          });
        },
        shouldRetry: shouldRetryFn,
      },
    } satisfies ReturnType<Mutators<LuminarDBSchema>[string]>;
  };
}

function updateMutationResolver(workspaceId: string) {
  return function <
    T extends keyof Pick<LuminarDBSchema, "comment" | "issue" | "description">,
  >({
    collection,
    key,
    delta,
  }: {
    collection: T;
    key: string;
    delta: Partial<InferSchemaTypeFromCollection<LuminarDBSchema[T]>>;
  }) {
    return {
      localResolver(tx) {
        return tx.collection(collection).update(key, delta);
      },
      remoteResolver: {
        mutationFn() {
          return apiClient.mutate.update.mutate({
            collection,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            params: { id: key, delta: delta as any },
            workspaceId,
          });
        },
        shouldRetry: shouldRetryFn,
      },
    } as const satisfies ReturnType<Mutators<LuminarDBSchema>[string]>;
  };
}

function deleteMutationResolver(workspaceId: string) {
  return function <T extends keyof Pick<LuminarDBSchema, "issue" | "comment">>({
    collection,
    key,
  }: {
    collection: T;
    key: string;
  }) {
    return {
      localResolver(tx) {
        return tx.collection(collection).delete(key);
      },
      remoteResolver: {
        mutationFn() {
          return apiClient.mutate.delete.mutate({
            collection,
            key: key,
            workspaceId,
          });
        },
        shouldRetry: shouldRetryFn,
      },
    } as const satisfies ReturnType<Mutators<LuminarDBSchema>[string]>;
  };
}

function resolver<TLocalResolverData>(config: {
  localResolver: (
    tx: WriteTransaction<LuminarDBSchema>,
  ) => Promise<TLocalResolverData>;
  remoteResolver: {
    mutationFn: (
      data: TLocalResolverData,
    ) => Promise<{ serverMutationId: number }>;
    shouldRetry: RetryConfig;
  };
}) {
  return config;
}

export type LuminarDBMutators = ReturnType<typeof getMutators>;

export type LuminarDB = Database<LuminarDBSchema, LuminarDBMutators>;
