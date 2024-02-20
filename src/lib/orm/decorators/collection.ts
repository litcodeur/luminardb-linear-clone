import { Model } from "@/lib/orm";
import { action, computed, observable } from "mobx";

export class Collection<T extends Model> {
  @observable
  private accessor items = new Map<string, T>();

  constructor() {}

  @action
  set(value: T) {
    this.items.set(value.id, value);
  }

  @action
  remove(id: string) {
    this.items.delete(id);
  }

  @computed
  get length() {
    return this.items.size;
  }

  @computed
  get toArray() {
    return Array.from(this.items.values());
  }

  getModel(id: string) {
    return this.items.get(id);
  }
}
