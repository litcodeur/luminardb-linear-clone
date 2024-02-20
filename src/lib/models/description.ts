import { LDBDescription, LuminarDBSchema } from "@/lib/luminardb";
import { Issue } from "@/lib/models";
import { Immutable, Model, Property, Relation } from "@/lib/orm";
import { generateId } from "@/utils/id";

export class Description extends Model {
  protected _model: keyof LuminarDBSchema = "description";

  @Immutable()
  public accessor id: string = generateId("description");

  @Immutable()
  public accessor createdAt: string = new Date().toISOString();

  @Property()
  public accessor updatedAt: string = new Date().toISOString();

  @Property()
  public accessor body: string = "";

  @Immutable()
  public accessor issueId: string = "";

  @Relation("issue")
  public accessor issue!: Issue;

  constructor(args: DescriptionModelArgs) {
    super();
    this.id = args.issueId;
    this.createdAt = args.createdAt;
    this.updatedAt = args.updatedAt;
    this.body = args.body;
    this.issueId = args.issueId;
    this.isInitialized = true;
  }

  serialize(): LDBDescription {
    return {
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      body: this.body,
      issueId: this.issueId,
    };
  }
}

export type DescriptionModelArgs = Pick<
  Description,
  "body" | "createdAt" | "updatedAt" | "issueId"
>;
