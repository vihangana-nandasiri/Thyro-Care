import { Outlet } from "react-router";
import { SkipLink } from "./Sidebar";

/** Auth shell — login / register keep their existing full-page layouts. */
export function AuthLayout() {
  return (
    <>
      <SkipLink />
      <Outlet />
    </>
  );
}
