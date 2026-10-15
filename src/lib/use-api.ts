"use client";
import * as React from "react";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "anon" }       // 401: tizimga kirilmagan
  | { status: "offline" }    // server/baza mavjud emas
  | { status: "ready"; data: T };

export function useApi<T>(url: string) {
  const [state, setState] = React.useState<ApiState<T>>({ status: "loading" });
  const load = React.useCallback(() => {
    setState({ status: "loading" });
    fetch(url)
      .then(async (r) => {
        if (r.status === 401) return setState({ status: "anon" });
        if (!r.ok) return setState({ status: "offline" });
        setState({ status: "ready", data: (await r.json()) as T });
      })
      .catch(() => setState({ status: "offline" }));
  }, [url]);
  React.useEffect(load, [load]);
  return [state, load] as const;
}
