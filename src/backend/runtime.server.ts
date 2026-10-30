import { createIndependentAuth } from "./auth.server";
let auth: ReturnType<typeof createIndependentAuth> | undefined;
export function independentAuth() {
  return (auth ??= createIndependentAuth());
}
