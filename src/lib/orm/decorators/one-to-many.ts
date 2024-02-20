import { Collection, Model } from "@/lib/orm";

export function OneToMany<TModel extends Model>(onDeleteCascade = false) {
  return function OneToManyDecorator<This, Value extends Collection<TModel>>(
    _target: undefined,
    _context: ClassFieldDecoratorContext<This, Value>,
  ) {
    return function (args: Value) {
      // @ts-expect-error
      const that = this;

      if (!(that instanceof Model)) {
        throw new Error("Cannot set OneToMany value on non-model class.");
      }

      if (onDeleteCascade) {
        const model = that as Model;

        model.getMeta().onRemoveFromPool((pool) => {
          args.toArray.forEach((i) => {
            pool.remove(i);
          });
        });
      }

      return args;
    };
  };
}
