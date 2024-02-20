import { LuminarDB } from "@/lib/luminardb";
import { Model } from "./model";

export class ObjectPool {
  constructor(private db: LuminarDB) {}

  private pool = new Map<string, Map<string, Model>>();

  private getOrCreateCollection<T extends string>(
    model: T,
  ): Map<string, Model> {
    if (!this.pool.has(model)) {
      this.pool.set(model, new Map<string, Model>());
    }

    return this.pool.get(model) as Map<string, Model>;
  }

  get<V extends Model, T extends string>(model: T, id: string): V | undefined {
    const collection = this.getOrCreateCollection(model);
    return collection.get(id) as V | undefined;
  }

  add<V extends Model>(value: V): void {
    const model = value.getMeta().getModelName();
    const collection = this.getOrCreateCollection(model);
    collection.set(value.id, value);
    value.getMeta().setPool(this);
  }

  addMany<V extends Model>(values: V[]): void {
    for (let value of values) {
      const model = value.getMeta().getModelName();
      const pool = this.getOrCreateCollection(model);
      pool.set(value.id, value);
    }

    for (let value of values) {
      value.getMeta().setPool(this);
    }
  }

  remove<V extends Model>(value: V): V | undefined {
    const model = value.getMeta().getModelName();
    const id = value.id;
    const collection = this.getOrCreateCollection(model);

    const item = collection.get(id) as V | undefined;

    if (item) {
      item.getMeta().setPool(null);
    }

    collection.delete(id);
    return item;
  }

  get remoteOps() {
    const that = this;
    return {
      create<V extends Model>(value: V) {
        const model = value.getMeta().getModelName();
        const id = value.id;
        that.add(value);
        void that.db.mutate
          .create({
            collection: model,
            key: id,
            value: value.serialize(),
          } as any)
          .catch(() => {
            that.remove(value);
          });
      },
      update<V extends Model>(value: V) {
        const changedProperties = value.getMeta().getChangedProperties();

        const delta: Record<string, any> = {};
        changedProperties.forEach(({ newValue }, key) => {
          delta[key] = newValue;
        });

        const model = value.getMeta().getModelName();
        const id = value.id;
        void that.db.mutate.update({
          collection: model,
          key: id,
          delta,
        } as any);
      },
      delete<V extends Model>(value: V) {
        const model = value.getMeta().getModelName();
        const id = value.id;
        that.remove(value);
        void that.db.mutate
          .delete({
            collection: model,
            key: id,
          } as any)
          .catch(() => {
            that.add(value);
          });
      },
    };
  }
}
