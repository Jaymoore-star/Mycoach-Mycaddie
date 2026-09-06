import { env } from './_generated/server';

export default {
  providers: [
    {
      // Convex Auth issues tokens against this deployment's own domain.
      // CONVEX_SITE_URL is platform-provided, so it is read from the typed
      // `env` export rather than process.env.
      domain: env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
