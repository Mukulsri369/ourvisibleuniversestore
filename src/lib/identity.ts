import { createAuthClient } from "better-auth/react";
export const identity = createAuthClient({ fetchOptions: { credentials: "include" } });
