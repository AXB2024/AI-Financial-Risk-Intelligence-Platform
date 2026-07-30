import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthUser } from '../auth/auth-user';
import { AuditLogService } from '../services/audit-log.service';

interface AuditedRequest extends Request {
  user?: AuthUser;
}

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<AuditedRequest>();
    const response = http.getResponse<Response>();

    const record = (statusCode: number) =>
      void this.auditLogService.record({
        userId: request.user?.id ?? null,
        tenantId: request.user?.tenantId ?? null,
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode,
        durationMs: Date.now() - startedAt,
        ipAddress: request.ip ?? null,
        userAgent: request.headers['user-agent'] ?? null,
      });

    return next.handle().pipe(
      tap(() => record(response.statusCode)),
      catchError((error) => {
        record(error?.status ?? 500);
        return throwError(() => error);
      }),
    );
  }
}
