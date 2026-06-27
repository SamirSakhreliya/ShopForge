import { Request, Response, NextFunction } from 'express';
import { errorNotifier } from './SlackMessageBuilder';

export default function responseEnhancer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const fullUrl = `${req.originalUrl}`;
  console.log({
    url: fullUrl,
    method: req.method,
    body: JSON.stringify(req.body),
    query: req.query,
    params: req.params,
  });
  res.success = (
    message: string,
    data: unknown = {},
    statusCode: number = 200,
  ): void => {
    res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  };

  res.error = (
    message: string,
    error: unknown = null,
    statusCode: number = 500,
  ): void => {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const errorLog = {
      message:
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : message,
      stack:
        typeof error === 'object' && error !== null && 'stack' in error
          ? (error as { stack?: string }).stack
          : undefined,
      method: req.method,
      url: fullUrl,
      body: req.body,
      query: req.query,
      params: req.params,
      code: statusCode,
    };
    console.log(errorLog);
    if (
      statusCode === 404 &&
      (req.originalUrl === '/api/v1/superadmin/login' ||
        req.originalUrl === '/api/v2/users/login')
    ) {
      errorNotifier.sendNotification(errorLog);
    }
    // For all other non-404 errors
    if (statusCode !== 404) {
      errorNotifier.sendNotification(errorLog);
    }

    res.status(statusCode).json({
      success: false,
      message,
      data: {},
      //   error: error ? error.toString() : null,
    });
  };

  next();
}
