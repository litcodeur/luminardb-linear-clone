import { LuminarDBSchema } from "@/lib/luminardb";
import { Issue } from "@/lib/models";
import { Collection, Immutable, Model, OneToMany } from "@/lib/orm";
import { generateId } from "@/utils/id";

export class Workspace extends Model {
  protected _model = "workspace";

  @Immutable()
  public accessor id: string = generateId("workspace");

  @OneToMany<Issue>()
  public readonly issues = new Collection<Issue>();

  constructor(initialValue: WorkspaceModelArgs) {
    super();
    this.id = initialValue.id;
    this.isInitialized = true;
  }
}

export type WorkspaceModelArgs = Pick<Workspace, "id">;
