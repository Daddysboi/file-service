import express from 'express';
import validate from '../../validators/validate';
import { commonValidation } from '../../validators/commonValidation';
import { authController } from './controller';

const authRouter = express.Router();

authRouter.post('/refresh-token', authController.refreshToken);
authRouter.route('/validate-token').post(validate({ query: commonValidation.tokenSchema }), authController.validateToken);

export default authRouter;
