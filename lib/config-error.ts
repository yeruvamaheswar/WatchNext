export class ConfigError extends Error {
  constructor(
    message: string,
    public code: string,
    public hint?: string,
    public status = 503
  ) {
    super(message);
    this.name = "ConfigError";
  }
}
