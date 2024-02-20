import { LDBComment, LuminarDBSchema } from "@/lib/luminardb";
import { Issue } from "@/lib/models";
import { Immutable, ManyToOne, Model, Property, Relation } from "@/lib/orm";
import { generateId } from "@/utils/id";

export class Comment extends Model {
  protected _model: keyof LuminarDBSchema = "comment";

  @Immutable()
  public accessor id: string = generateId("comment");

  @Immutable()
  public accessor createdAt: string = new Date().toISOString();

  @Property()
  public accessor updatedAt: string = new Date().toISOString();

  @Immutable()
  public accessor creator: string = "";

  @Property()
  public accessor body: string = "";

  @ManyToOne<Issue>("issue", "comments")
  public accessor issueId: string = "";

  @Relation("issue")
  public accessor issue!: Issue;

  constructor(initialValue: CommentModelArgs) {
    super();
    this.id = initialValue.id;
    this.createdAt = initialValue.createdAt;
    this.updatedAt = initialValue.updatedAt;
    this.creator = initialValue.creator;
    this.body = initialValue.body;
    this.issueId = initialValue.issueId;
    this.isInitialized = true;
  }

  serialize(): LDBComment {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      creator: this.creator,
      body: this.body,
      issueId: this.issueId,
    };
  }
}

export type CommentModelArgs = Pick<
  Comment,
  "id" | "createdAt" | "updatedAt" | "creator" | "body" | "issueId"
>;
