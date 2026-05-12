/**
 * Premaccess frontend extension entry point.
 *
 * Imported via a single line in upstream's `App.tsx` — the second of two
 * allowed-modify upstream files (the first is the backend `app.module.ts`).
 *
 * The extension contributes a route subtree mounted at `/_premaccess/*` and
 * (in a follow-up) a record-detail right-rail panel slot for the
 * `InferredEdgesReview` component.
 */

export { PremaccessRoutes } from './routes';
export { ConnectorsList } from './components/ConnectorsList';
export { ConnectorMapping } from './components/ConnectorMapping';
export { SyncTrigger } from './components/SyncTrigger';
export { InferredEdgesReview } from './components/InferredEdgesReview';
