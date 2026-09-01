/**
 * Vercel discovers instrumentation only at the project root. Keep this as a
 * thin deployment entry point while the implementation lives under src/ so it
 * is typechecked, linted, built, and included in the published package.
 */
import "./src/instrumentation.js";
