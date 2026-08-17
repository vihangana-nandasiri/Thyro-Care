import { RouterProvider } from "react-router";
import { AppProviders } from "./providers";
import { router } from "./router";

/**
 * Phase 2 root: thin application shell — providers + router only.
 */
export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
