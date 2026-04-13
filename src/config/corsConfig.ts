import config from './envConfig';

const allowedOrigins = [config.clientUrl, 'http://localhost:3000', 'https://localhost:3000', 'http://localhost:3001', 'https://localhost:3001', '*'];

const origin = (origin: any, callback: (error: Error | null, allowed?: boolean) => void) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

const corsConfig = {
  origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};

export default corsConfig;
