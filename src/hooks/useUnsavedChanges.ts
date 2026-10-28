import { useEffect, useCallback } from "react";

/**
 * Warns the user when they try to leave/reload a page with unsaved form data.
 * @param hasUnsavedChanges - whether the form has data worth preserving
 */
export function useUnsavedChanges(hasUnsavedChanges: boolean) {
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore custom messages but still show a prompt
        e.returnValue = "";
      }
    },
    [hasUnsavedChanges]
  );

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleBeforeUnload]);
}
