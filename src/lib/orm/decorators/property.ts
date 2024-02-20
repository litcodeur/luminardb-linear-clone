import { Model } from "@/lib/orm";
import { observable } from "mobx";

export function Property() {
  return function PropertyDecorator<This, Value>(
    target: ClassAccessorDecoratorTarget<This, Value>,
    context: ClassAccessorDecoratorContext<This, Value>,
  ) {
    const observableValue = observable(target, context);

    if (!observableValue) {
      throw new Error(
        `Unable to make property ${context.name.toString()} observable when using the @Property decorator.`,
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

        if (!modelThis.getMeta().getIsInitialized()) {
          return observableValue.set!.call(this, value);
        }

        if (modelThis.getMeta().getIsEditing()) {
          return observableValue.set!.call(this, value);
        }

        modelThis
          .getMeta()
          .setChangedProperty(
            context.name.toString(),
            observableValue.get!.call(this),
            value,
          );

        return;
      },
    };
  };
}
