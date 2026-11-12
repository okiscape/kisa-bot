import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request, Response } from "express";
import { Observable, map } from "rxjs";
import { ApiSuccessResponse } from "../types/api-response";
import { SKIP_ENVELOPE_KEY } from "../decorators/skip-envelope.decorator";

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (skip || data instanceof StreamableFile) {
          return data;
        }

        if (
          response.headersSent ||
          (response.statusCode >= 300 && response.statusCode < 400)
        ) {
          return data;
        }

        if (
          data &&
          typeof data === "object" &&
          ("data" in data || "error" in data) &&
          "meta" in data
        ) {
          return data;
        }

        const payload: ApiSuccessResponse<unknown> = {
          data,
          meta: { requestId: request.requestId || "unknown" },
        };
        return payload;
      }),
    );
  }
}
