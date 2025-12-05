# Security Monitoring and Dashboards

The following lightweight monitoring hooks are available in the frontend to surface security events:

- **Authentication events**: Rate limiting, failed login attempts, and successful logins are captured through `SecurityLogger`.
- **Formula execution guards**: Timeout and recursion depth errors are captured as security events to help identify malicious input.
- **LLM sanitization**: Sanitized completions prevent rendering of untrusted HTML and script content.

## Dashboards

Feed the `SecurityLogger.getRecentEvents()` output into your preferred telemetry collector. Recommended visualizations include:

1. **Authentication heatmap**: Time-bucketed counts of failed vs. successful logins with rate-limit hits highlighted.
2. **Formula safety monitor**: Volume of formula execution timeouts or depth violations by user action.
3. **LLM hygiene**: Counts of responses sanitized due to unsafe HTML content.

Each widget should track the `timestamp`, `category`, and `action` fields to allow filtering by severity or metadata (such as email for authentication flows).
