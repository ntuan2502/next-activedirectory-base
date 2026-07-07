import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public translationKey: string,
    public variables?: Record<string, string | number>
  ) {
    super(translationKey);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(translationKey: string) {
    super(404, translationKey);
  }
}

export class BadRequestError extends AppError {
  constructor(translationKey: string, variables?: Record<string, string | number>) {
    super(400, translationKey, variables);
  }
}

export class PasswordValidationError extends AppError {
  constructor(public errors: { key: string; variables?: Record<string, string | number> }[]) {
    super(400, "errors.passwordValidationFailed");
  }
}

export function handleApiError(
  error: unknown,
  t: (key: string, variables?: Record<string, string | number>) => string,
  defaultErrorKey: string
) {
  if (error instanceof PasswordValidationError) {
    return NextResponse.json(
      {
        error: t(error.errors[0].key, error.errors[0].variables),
        validationErrors: error.errors.map((err) => ({
          message: t(err.key, err.variables) || err.key,
          key: err.key,
        })),
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: t(error.translationKey, error.variables) },
      { status: error.statusCode }
    );
  }

  const rawMessage = error instanceof Error ? error.message : String(error);

  console.error(error);
  return NextResponse.json(
    { error: t(defaultErrorKey, { error: rawMessage }) },
    { status: 500 }
  );
}
