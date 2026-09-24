import { httpRouter } from 'convex/server';

import { auth } from './auth';
import { deleteAccountPage, privacyPolicy } from './legal';

const http = httpRouter();

auth.addHttpRoutes(http);

// The two URLs the Play Console listing asks for. See `legal.ts`.
http.route({ path: '/privacy', method: 'GET', handler: privacyPolicy });
http.route({ path: '/delete-account', method: 'GET', handler: deleteAccountPage });

export default http;
