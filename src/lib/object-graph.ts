import {
  LDBComment,
  LDBDescription,
  LDBIssue,
  LuminarDB,
} from "@/lib/luminardb";
import { Comment, Issue, Workspace } from "@/lib/models";
import { Description } from "@/lib/models/description";
import { ObjectPool } from "@/lib/orm";
import { isServer } from "@tanstack/react-query";
import { action, computed, observable, runInAction } from "mobx";
import { NextRouter } from "next/router";

function getIssueModel(issue: LDBIssue, workspaceId: string) {
  return new Issue({
    ...issue,
    workspaceId,
  });
}

function getCommentModel(comment: LDBComment) {
  return new Comment(comment);
}

function getDescriptionModel(description: LDBDescription) {
  return new Description(description);
}

function getModel(
  model: "issue" | "comment" | "description",
  data: LDBIssue | LDBComment | LDBDescription,
  workspaceId: string,
) {
  switch (model) {
    case "issue":
      return getIssueModel(data as LDBIssue, workspaceId);
    case "comment":
      return getCommentModel(data as LDBComment);
    case "description":
      return getDescriptionModel(data as LDBDescription);
    default:
      throw new Error(`Unknown model: ${model}`);
  }
}

class ObjectGraph {
  private pool: ObjectPool;
  private _workspace: Workspace;

  @observable
  public accessor isLoaded = false;

  public getPool() {
    return this.pool;
  }

  constructor(
    private workspaceId: string,
    private db: LuminarDB,
  ) {
    this.pool = new ObjectPool(db);
    const workspace = new Workspace({ id: workspaceId });
    this.pool.add(workspace);
    this._workspace = workspace;

    if (!isServer) {
      this.db.initialize().then(() => {
        this.handleDBInitialized();
      });
    }
  }

  private subscribeToChanges() {
    this.db.subscribeToCDC((changes) => {
      for (let change of changes) {
        if (change.action === "CLEAR") {
          continue;
        }

        if (change.collection === "cursorMeta") {
          continue;
        }

        if (change.action === "INSERT") {
          this.pool.add(
            getModel(change.collection, change.value, this.workspaceId),
          );
          continue;
        }

        if (change.action === "DELETE") {
          this.pool.remove(
            getModel(change.collection, change.value, this.workspaceId),
          );
          continue;
        }
      }
    });
  }

  private async handleDBInitialized() {
    this.db
      .batchRead(async (tx) => {
        const issues = await tx.collection("issue").getAll();
        const comments = await tx.collection("comment").getAll();
        const descriptions = await tx.collection("description").getAll();
        return { issues, comments, descriptions };
      })
      .then(({ issues, comments, descriptions }) => {
        runInAction(() => {
          for (let issue of issues) {
            this.pool.add(getIssueModel(issue, this.workspaceId));
          }

          for (let comment of comments) {
            this.pool.add(getCommentModel(comment));
          }

          for (let description of descriptions) {
            this.pool.add(getDescriptionModel(description));
          }
        });
        this.subscribeToChanges();
      })
      .finally(() => {
        runInAction(() => {
          this.isLoaded = true;
        });
      });
  }

  @computed
  public get workspace() {
    return this._workspace;
  }
}

export class ObjectGraphFactory {
  private static instances: Record<string, ObjectGraph> = {};

  public static getInstance(workspaceId: string, db: LuminarDB) {
    if (!this.instances[workspaceId]) {
      this.instances[workspaceId] = new ObjectGraph(workspaceId, db);
    }
    return this.instances[workspaceId]!;
  }
}
