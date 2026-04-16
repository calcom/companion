// Thin JS wrapper — imports the pre-compiled handler from dist/ so @vercel/node
// does not have to run TypeScript over the heavy imports in src/vercel-handler.ts.
// The `bun run build` step (executed by Vercel before bundling functions)
// produces dist/vercel-handler.js.
export { default } from "../dist/vercel-handler.js";
