import { Collection, Model, ObjectPool } from "@/lib/orm";
import { observable } from "mobx";

type CollectionFieldNameImpl<T, K extends keyof T> = K extends string
  ? T[K] extends Collection<infer U>
    ? K
    : never
  : never;

type CollectionFieldNames<T> = CollectionFieldNameImpl<T, keyof T>;

export function ManyToOne<
  TModel extends Model,
  TModelNames extends string = string,
>(modelName: TModelNames, field: CollectionFieldNames<TModel>) {
  return function ManyToOneDecorator<This, Value extends string>(
    target: ClassAccessorDecoratorTarget<This, Value>,
    context: ClassAccessorDecoratorContext<This, Value>,
  ) {
    const observableValue = observable(target, context)!;

    if (!observableValue) {
      throw new Error(
        `Unable to make property ${context.name.toString()} observable when using the @ManyToOne decorator.`,
      );
    }

    const returnValue: ClassAccessorDecoratorResult<This, Value> = {
      get() {
        return observableValue.get!.call(this);
      },
      set(value) {
        const that = this as any;

        if (!(that instanceof Model)) {
          throw new Error("Cannot set ManyToOne value on non-model class.");
        }

        const model = that as Model;

        const pool = model.getMeta().getPool();

        const addSelfToPoolValue = (pool: ObjectPool) => {
          const item = pool.get(modelName, value);

          if (!item) {
            return;
          }

          // @ts-expect-error
          const collection = item[field];

          const typedCollection = collection as Collection<TModel>;

          typedCollection.set(model as TModel);
        };

        if (!pool) {
          model.getMeta().onPoolSet((pool) => {
            addSelfToPoolValue(pool);
          });
        } else {
          addSelfToPoolValue(pool);
        }

        model.getMeta().onRemoveFromPool((pool) => {
          const item = pool.get(modelName, observableValue.get!.call(this));

          if (!item) {
            return;
          }

          // @ts-expect-error
          const collection = item[field];

          const typedCollection = collection as Collection<TModel>;

          typedCollection.remove(model.id);
        });

        return observableValue.set!.call(this, value);
      },
    };

    return returnValue;
  };
}
