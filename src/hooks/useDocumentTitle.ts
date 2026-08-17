import { useEffect } from "react";
import { env } from "@/config/env";

/** Sets document.title for the active route. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title.includes(env.appName) ? title : `${title} | ${env.appName}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
