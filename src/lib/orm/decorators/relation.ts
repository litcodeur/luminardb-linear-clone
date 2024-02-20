import { Model } from "@/lib/orm";

export function Relation<TModelNames extends string = string>(
  modelName: TModelNames,
) {
  return function RelationDecorator<T, V>(
    _: ClassAccessorDecoratorTarget<T, V>,
    context: ClassAccessorDecoratorContext<T, V>,
  ) {
    const returnValue: ClassAccessorDecoratorResult<T, V> = {
      get() {
        const that = this as any;

        if (!(that instanceof Model)) {
          throw new Error("Cannot get relation value on non-model class.");
        }

        const model = that as Model;

        const pool = model.getMeta().getPool();

        if (!pool) {
          throw new Error(
            "Cannot resolve relation without class instance being in an object pool.",
          );
        }

        const fieldName = context.name.toString();

        const idFieldName = `${fieldName}Id`;

        if (!(idFieldName in model)) {
          throw new Error(
            `Model does not have field ${idFieldName} to resolve relation: ${fieldName}.`,
          );
        }

        const id = model[
          idFieldName as keyof typeof model
        ] as unknown as string;

        const item = pool.get(modelName, id);

        if (!item) {
          // if (!option.isNullable) {
          throw new Error(
            `Could not find model: ${modelName} with id: ${id} in pool.`,
          );
          // }

          // if (option.shouldDeferRelationResolution) {
          //   pool.addDefferedResolution(modelName, id, (pool) => {
          //     const item = pool.get(modelName, id);
          //     if (item) {
          //       // @ts-expect-error
          //       model[idFieldName] = "";
          //       // @ts-expect-error
          //       model[idFieldName] = id;
          //     }
          //   });
          // }
        }

        return item as V;
      },
      set() {
        throw new Error("Cannot set relation value.");
      },
    };

    return returnValue;
  };
}
