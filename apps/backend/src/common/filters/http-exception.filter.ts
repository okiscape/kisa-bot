import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiErrorResponse } from "../types/api-response";
import { ErrorCodes } from "../types/error-codes";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId || "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL_ERROR;
    let message = "Internal server error";
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const obj = body as Record<string, unknown>;
        message =
          (typeof obj.message === "string" && obj.message) ||
          (Array.isArray(obj.message) ? obj.message.join("; ") : exception.message);
        details = obj.details ?? (Array.isArray(obj.message) ? obj.message : null);
        if (typeof obj.code === "string") {
          code = obj.code;
        }
      }

      if (status === HttpStatus.UNAUTHORIZED) {
        code = code === ErrorCodes.INTERNAL_ERROR ? ErrorCodes.UNAUTHENTICATED : code;
      } else if (status === HttpStatus.FORBIDDEN) {
        code = code === ErrorCodes.INTERNAL_ERROR ? ErrorCodes.FORBIDDEN : code;
      } else if (status === HttpStatus.NOT_FOUND) {
        code = code === ErrorCodes.INTERNAL_ERROR ? ErrorCodes.NOT_FOUND : code;
      } else if (status === HttpStatus.CONFLICT) {
        code = code === ErrorCodes.INTERNAL_ERROR ? ErrorCodes.CONFLICT : code;
      } else if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.UNPROCESSABLE_ENTITY) {
        code =
          code === ErrorCodes.INTERNAL_ERROR ? ErrorCodes.VALIDATION_ERROR : code;
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code =
          code === ErrorCodes.INTERNAL_ERROR
            ? ErrorCodes.DISCORD_RATE_LIMITED
            : code;
      } else if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        code =
          code === ErrorCodes.INTERNAL_ERROR
            ? ErrorCodes.SERVICE_UNAVAILABLE
            : code;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        code = ErrorCodes.CONFLICT;
        message = "Resource already exists";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        code = ErrorCodes.NOT_FOUND;
        message = "Resource not found";
      } else {
        message = "Database error";
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = ErrorCodes.SERVICE_UNAVAILABLE;
      message = "Database unavailable";
    }

    const isProd = process.env.NODE_ENV === "production";
    if (!isProd && exception instanceof Error && status >= 500) {
      details = { name: exception.name, message: exception.message };
    }

    this.logger.error(
      JSON.stringify({
        requestId,
        method: request.method,
        path: request.originalUrl,
        status,
        code,
        message,
        err:
          exception instanceof Error
            ? { name: exception.name, message: exception.message }
            : String(exception),
      }),
    );

    const payload: ApiErrorResponse = {
      error: { code, message, details },
      meta: { requestId },
    };

    response.status(status).json(payload);
  }
}
