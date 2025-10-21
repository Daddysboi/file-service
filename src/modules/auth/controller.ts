import { Response, Request } from 'express';
import httpStatus from 'http-status';
import catchAsyncError from '../../utils/catchAsyncError';
import { authService } from './service';

const refreshToken = catchAsyncError(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!refreshToken) return res.status(httpStatus.BAD_REQUEST).send({ message: 'Refresh token is required' });
  const tokens = await authService.refreshAuthToken(res, refreshToken);

  res.status(httpStatus.OK).send({
    message: 'Tokens refreshed successfully',
    tokens,
  });
});

const validateToken = catchAsyncError(async (req: { query: { token?: string } }, res: Response) => {
  const { token } = req.query;
  if (!token) return;

  await authService.verify(token);
  res.status(httpStatus.CREATED).send({
    message: 'Your account verification is successful, Please login.',
  });
});

export const authController = {
  refreshToken,
  validateToken,
};
