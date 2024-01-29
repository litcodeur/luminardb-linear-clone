import React from "react";

export function useGetAvailableWidth<T extends React.RefObject<HTMLElement>>(
  ref: T,
) {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    // Calculate the available width on screen from where the outer ref element is placed
    if (!ref.current) return;

    function handleResize() {
      if (!ref.current) return;

      const availableWidth =
        window.innerWidth - ref.current.getBoundingClientRect().left ?? 0;

      setWidth(availableWidth);
    }

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ref]);

  return width;
}

export function useGetAvailableHeight<T extends React.RefObject<HTMLElement>>(
  ref: T,
) {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    // Calculate the available height on screen from where the outer ref element is placed
    if (!ref.current) return;

    function handleResize() {
      if (!ref.current) return;

      const availableHeight =
        window.innerHeight - ref.current.getBoundingClientRect().top ?? 0;

      setHeight(availableHeight);
    }

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ref]);

  return height;
}

export function useMergeRef<T extends HTMLElement>(
  ...refs: Array<React.Ref<T>>
) {
  const targetRef = React.useRef<T>(null);

  React.useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) return;

      if (typeof ref === "function") {
        ref(targetRef.current);
      } else {
        (ref as React.MutableRefObject<T | null>).current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
}
