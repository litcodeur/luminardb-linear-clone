import { LDBIssue, LuminarDBSchema } from "@/lib/luminardb";
import { Comment, Description, Workspace } from "@/lib/models";
import {
  Collection,
  Immutable,
  ManyToOne,
  Model,
  OneToMany,
  Property,
  Relation,
} from "@/lib/orm";
import { generateId } from "@/utils/id";

export class Issue extends Model {
  protected _model: keyof LuminarDBSchema = "issue";

  @Immutable()
  public accessor id: string = generateId("issue");

  @Property()
  public accessor title = "";

  @Property()
  public accessor status: LDBIssue["status"] = "BACKLOG";

  @Property()
  public accessor priority: LDBIssue["priority"] = "NO_PRIORITY";

  @Immutable()
  public accessor createdAt: string = new Date().toISOString();

  @Property()
  public accessor updatedAt: string = new Date().toISOString();

  @Immutable()
  public accessor creator = "";

  @ManyToOne<Workspace>("workspace", "issues")
  public accessor workspaceId: string = "";

  @Relation("workspace")
  public accessor workspace!: Workspace;

  @OneToMany<Comment>(true)
  public readonly comments = new Collection<Comment>();

  @Immutable()
  public accessor descriptionId: string = "";

  @Relation("description")
  public accessor description!: Description;

  constructor(initialValue: IssueModelArgs) {
    super();
    this.id = initialValue.id;
    this.workspaceId = initialValue.workspaceId;
    this.title = initialValue.title;
    this.status = initialValue.status;
    this.priority = initialValue.priority;
    this.createdAt = initialValue.createdAt;
    this.updatedAt = initialValue.updatedAt;
    this.creator = initialValue.creator;
    this.descriptionId = initialValue.id;
    this.isInitialized = true;
  }

  serialize(): LDBIssue {
    return {
      id: this.id,
      title: this.title,
      status: this.status,
      priority: this.priority,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      creator: this.creator,
    };
  }
}

export type IssueModelArgs = Pick<
  Issue,
  | "id"
  | "title"
  | "status"
  | "priority"
  | "createdAt"
  | "updatedAt"
  | "creator"
  | "workspaceId"
>;
