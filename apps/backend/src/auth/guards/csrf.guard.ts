import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";
import { ErrorCodes } from "../../common/types/error-codes";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const header = request.header("x-requested-with");
    if (header?.toLowerCase() === "fetch") {
      return true;
    }

    throw new ForbiddenException({
      code: ErrorCodes.FORBIDDEN,
      message: "Missing X-Requested-With: fetch header",
    });
  }
}
