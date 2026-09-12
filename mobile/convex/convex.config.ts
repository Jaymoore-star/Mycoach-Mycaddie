import { defineApp } from 'convex/server';
import agent from '@convex-dev/agent/convex.config';

/**
 * The agent component owns the coach chat's message storage, ordering and
 * pagination. `convex/coachChat.ts` wraps it so the client never talks to the
 * component directly - authorization happens in our own functions first.
 */
const app = defineApp();
app.use(agent);

export default app;
