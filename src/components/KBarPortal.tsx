import clsx from "clsx";
import {
  type ActionId,
  type ActionImpl,
  KBarAnimator,
  KBarPositioner,
  KBarSearch,
  KBarResults,
  useKBar,
  useMatches,
  VisualState,
} from "kbar";
import React from "react";
import { Modal, ModalOverlay } from "react-aria-components";
// import { KBarResults } from "./KBarResults";

function getResultItemClassName(active = false) {
  return clsx(
    "px-4 py-3 cursor-pointer text-sm",
    active && "bg-neutral-800/70",
  );
}

const ResultItem = React.forwardRef(
  (
    {
      action,
      active,
      currentRootActionId,
    }: {
      action: ActionImpl;
      active: boolean;
      currentRootActionId?: ActionId | null;
    },
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const ancestors = React.useMemo(() => {
      if (!currentRootActionId) return action.ancestors;
      const index = action.ancestors.findIndex(
        (ancestor) => ancestor.id === currentRootActionId,
      );
      // +1 removes the currentRootAction; e.g.
      // if we are on the "Set theme" parent action,
      // the UI should not display "Set theme… > Dark"
      // but rather just "Dark"
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    return (
      <div
        ref={ref}
        className={clsx(
          getResultItemClassName(active),
          "flex cursor-pointer items-center justify-between",
          "min-h-[48px]",
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          {action.icon && action.icon}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div>
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span
                      style={{
                        opacity: 0.5,
                        marginRight: 8,
                      }}
                    >
                      {ancestor.name}
                    </span>
                    <span
                      style={{
                        marginRight: 8,
                      }}
                    >
                      &rsaquo;
                    </span>
                  </React.Fragment>
                ))}
              <span>{action.name}</span>
            </div>
            {action.subtitle && (
              <span style={{ fontSize: 12 }}>{action.subtitle}</span>
            )}
          </div>
        </div>
        {action.shortcut?.length ? (
          <div aria-hidden className="flex gap-1">
            {action.shortcut.map((sc) =>
              sc.split("+").map((key) => {
                return (
                  <kbd
                    key={sc + key}
                    className="flex items-center rounded-md bg-zinc-800/90 p-1 px-2 text-sm"
                  >
                    {key === "$mod" ? "⌘" : key}
                  </kbd>
                );
              }),
            )}
          </div>
        ) : null}
      </div>
    );
  },
);

ResultItem.displayName = "ResultItem";

function RenderResults() {
  const { results, rootActionId } = useMatches();
  const { q } = useKBar((s) => ({ q: s.searchQuery }));

  if (results.length === 0) {
    return (
      <div className={clsx(getResultItemClassName(false), "text-orange-400")}>
        No result found for {q}
      </div>
    );
  }

  return (
    <KBarResults
      items={results}
      onRender={function ({ item, active }) {
        return typeof item === "string" ? (
          <div className={getResultItemClassName(active)}>{item}</div>
        ) : (
          <ResultItem
            action={item}
            active={active}
            currentRootActionId={rootActionId}
          />
        );
      }}
    />
  );
}

export function AppKBarPortal() {
  const { state, query } = useKBar((s) => ({ state: s.visualState }));
  return (
    <ModalOverlay
      isEntering={state === VisualState.animatingIn}
      isExiting={state === VisualState.animatingOut}
      onOpenChange={function () {
        query.toggle();
      }}
      isOpen={state !== VisualState.hidden}
      className="absolute left-0 top-0 h-screen w-screen bg-zinc-900/50 backdrop-blur-sm"
    >
      <Modal>
        <KBarPositioner>
          <KBarAnimator
            className={clsx(
              "w-full max-w-[762px] overflow-hidden rounded-md bg-zinc-950/80 text-neutral-200 backdrop-blur-sm ",
              "border border-solid border-neutral-500/50",
            )}
          >
            <KBarSearch
              className={clsx(
                "box-border w-full border-none bg-transparent px-4 py-3 outline-none",
              )}
            />
            <div className="border-b border-solid border-neutral-500/50" />
            <div className="relative pb-2">
              <RenderResults />
            </div>
          </KBarAnimator>
        </KBarPositioner>
      </Modal>
    </ModalOverlay>
  );
}
