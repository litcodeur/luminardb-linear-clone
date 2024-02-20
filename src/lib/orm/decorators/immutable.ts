import { Model } from "@/lib/orm";
import { observable } from "mobx";

export function Immutable() {
  return function ImmutableDecorator<This, Value>(
    target: ClassAccessorDecoratorTarget<This, Value>,
    context: ClassAccessorDecoratorContext<This, Value>,
  ) {
    const observableValue = observable(target, context);

    if (!observableValue) {
      throw new Error(
        `Unable to make immutable ${context.name.toString()} observable when using the @Immutable decorator.`,
      );
    }

    return {
      get() {
        return observableValue.get!.call(this);
      },
      set(value: Value) {
        const that = this;

        if (!(that instanceof Model)) {
          throw new Error("Cannot set Property decorator on non-model class.");
        }

        const modelThis = that as Model;

        if (modelThis.getMeta().getIsInitialized()) {
          throw new Error(
            "Cannot set immutable property on initialized model.",
          );
        }

        return observableValue.set!.call(this, value);
      },
    };
  };
}
