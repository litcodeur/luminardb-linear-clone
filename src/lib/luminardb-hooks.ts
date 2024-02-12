import { useLuminarDB } from "@/providers/luminardb-provider";
import {
  type FilterOption,
  type InferSchemaTypeFromCollection,
} from "luminardb";
import React from "react";
import { type LuminarDBSchema } from "./luminardb";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function useCollection<T extends keyof LuminarDBSchema>(
  collection: T,
  options?: FilterOption<LuminarDBSchema[T]>,
  dependencies: React.DependencyList = [],
) {
  const db = useLuminarDB();

  const [data, setData] = React.useState<
    Array<InferSchemaTypeFromCollection<LuminarDBSchema[T]>>
  >([]);

  const [isLoading, setIsLoading] = React.useState(true);

  useIsomorphicLayoutEffect(() => {
    setData([]);

    const unsubscribe = db
      .collection(collection)
      .getAll(options)
      .subscribe((d) => {
        setIsLoading(false);
        if (!d) {
          setData([]);
          return;
        }

        setData(d);
      });

    return () => {
      unsubscribe();
      setData([]);
      setIsLoading(true);
    };
  }, [collection, ...dependencies]);

  return { data, isLoading };
}

export function useDocument<T extends keyof LuminarDBSchema>(
  collection: T,
  key: string | number | null | undefined,
  options: {
    onChange?: (
      data?: InferSchemaTypeFromCollection<LuminarDBSchema[T]>,
    ) => void;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  } = { onChange() {} },
) {
  const db = useLuminarDB();

  const [data, setData] = React.useState<
    InferSchemaTypeFromCollection<LuminarDBSchema[T]> | undefined
  >(undefined);

  const [isLoading, setIsLoading] = React.useState(true);

  useIsomorphicLayoutEffect(() => {
    setData(undefined);
    if (!key) {
      setData(undefined);
      return;
    }

    const unsubscribe = db
      .collection(collection)
      .get(key)
      .subscribe((s) => {
        options.onChange!(s);
        setIsLoading(false);
        setData(s);
      });

    return () => {
      unsubscribe();
      setData(undefined);
      setIsLoading(true);
    };
  }, [collection, key]);

  return { data, isLoading };
}

export function usePrefetchIssueDetails(issueId: string) {
  const db = useLuminarDB();

  useIsomorphicLayoutEffect(() => {
    if (!issueId) {
      return;
    }

    void db.collection("description").get(issueId).execute();
    void db
      .collection("comment")
      .getAll({
        where: { issueId: { eq: issueId } },
      })
      .execute();
  }, [issueId]);
}
