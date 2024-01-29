import { type InferSelectModel } from "drizzle-orm";
import {
  datetime,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTableCreator,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const mysqlTable = mysqlTableCreator((name) => `${name}`);

export const issueTable = mysqlTable("issue", {
  id: varchar("id", { length: 10 }).notNull().primaryKey(),
  title: text("title").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
  creator: varchar("creator", { length: 255 }).notNull(),
  status: varchar("state", {
    length: 20,
    enum: ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELLED"],
  }).notNull(),
  priority: varchar("priority", {
    length: 20,
    enum: ["NO_PRIORITY", "LOW", "MEDIUM", "HIGH", "URGENT"],
  }).notNull(),
});

export const commentTable = mysqlTable("comment", {
  id: varchar("id", { length: 10 }).notNull().primaryKey(),
  body: mediumtext("body").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
  issueId: varchar("issue_id", { length: 10 }).notNull(),
  creator: varchar("creator", { length: 255 }).notNull(),
});

export const descriptionTable = mysqlTable("description", {
  id: varchar("id", { length: 10 }).notNull().primaryKey(),
  body: mediumtext("body").notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
  issueId: varchar("issue_id", { length: 10 }).notNull(),
});

type DeleteChange = {
  method: "DELETE";
  key: string;
};

type CreateOrUpdateChange = {
  value: Issue | Comment | Description;
  key: string;
  method: "CREATE" | "UPDATE";
};

type Change = DeleteChange | CreateOrUpdateChange;

export const workspaceChangeTable = mysqlTable("workspace_change", {
  id: int("id").primaryKey().autoincrement(),
  model: mysqlEnum("model", ["ISSUE", "COMMENT", "DESCRIPTION"]).notNull(),
  change: json("change").notNull().$type<Change>(),
  createdAt: datetime("created_at", { mode: "date" }).notNull(),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull(),
  workspaceId: varchar("workspace_id", { length: 16 }).notNull(),
});

export type Issue = InferSelectModel<typeof issueTable>;

export type Comment = InferSelectModel<typeof commentTable>;

export type Description = InferSelectModel<typeof descriptionTable>;

export type WorkspaceChange = InferSelectModel<typeof workspaceChangeTable>;
