import { Outlet } from "react-router";
import { SkipLink } from "./Sidebar";

/** Public shell — pages keep their own chrome (landing / emergency). */
export function PublicLayout() {
  return (
    <>
      <SkipLink />
      <div id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </div>
    </>
  );
}
