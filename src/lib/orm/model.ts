import { action } from "mobx";
import { ObjectPool } from "./object-pool";

export abstract class Model {
  abstract id: string;

  protected abstract _model: string;

  protected pool: ObjectPool | null = null;
  protected onObjectPoolSetCallbacks: Array<(pool: ObjectPool) => void> = [];
  protected onRemoveFromPoolCallbacks: Array<(pool: ObjectPool) => void> = [];

  protected changedProperties = new Map<
    string,
    { oldValue: any; newValue: any }
  >();

  protected isInitialized: boolean = false;

  private isEditing = false;

  getMeta() {
    let that = this;
    return {
      setPool: (pool: ObjectPool | null) => {
        if (!pool) {
          const currentlySetPool = this.pool;
          if (currentlySetPool) {
            this.onRemoveFromPoolCallbacks.forEach((cb) =>
              cb(currentlySetPool),
            );
          }
          this.pool = pool;
          return;
        }

        this.pool = pool;
        this.onObjectPoolSetCallbacks.forEach((cb) => cb(pool));
      },
      getPool: () => {
        return this.pool;
      },
      onPoolSet: (cb: (pool: ObjectPool) => void) => {
        this.onObjectPoolSetCallbacks.push(cb);
      },
      setChangedProperty: <T = unknown>(
        propertyName: string,
        oldValue: T,
        newValue: T,
      ) => {
        if (!this.isInitialized) {
          return;
        }
        this.changedProperties.set(propertyName, { oldValue, newValue });
      },
      getIsInitialized: () => {
        return this.isInitialized;
      },
      getIsEditing: () => {
        return this.isEditing;
      },
      getModelName: () => {
        return this._model;
      },
      onRemoveFromPool(cb: (pool: ObjectPool) => void) {
        that.onRemoveFromPoolCallbacks.push(cb);
      },
      getChangedProperties: () => {
        return this.changedProperties;
      },
    };
  }

  @action
  save(shouldUpdateRemote = true) {
    if (!this.pool) {
      throw new Error(
        `Cannot save model: ${this._model} without it being in a pool.`,
      );
    }

    let that = this;

    if ("updatedAt" in that) {
      that.updatedAt = new Date().toISOString();
    }

    this.isEditing = true;
    this.changedProperties.forEach(({ newValue }, key) => {
      const typedKey = key as keyof typeof that;
      that[typedKey] = newValue;
    });

    if (shouldUpdateRemote) {
      this.pool.remoteOps.update(this);
    }

    this.isEditing = false;
  }

  delete() {
    if (!this.pool) {
      throw new Error(
        "Cannot remove model from pool without it being in a pool.",
      );
    }

    this.pool.remoteOps.delete(this);
  }

  abstract serialize(): Record<string, unknown>;
}
