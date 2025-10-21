import { auth } from 'express-openid-connect';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  authorizationParams: {
    scope: 'openid profile email',
    response_mode: 'form_post',
  },
};

const authMiddleware = auth(config);
export { authMiddleware };
