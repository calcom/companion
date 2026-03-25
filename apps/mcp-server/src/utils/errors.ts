export class CalApiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "CalApiError";
    this.status = status;
    this.body = body;
  }
}
