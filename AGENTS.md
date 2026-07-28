# Codex Project Guidance

## Reasoning-effort policy

- Automatically use the lowest reasoning effort sufficient to produce a reliable result.
- Prefer Light for simple, well-scoped, low-risk work and Medium for ordinary development tasks.
- Increase to High or Extra High when the task involves ambiguity, complex multi-step reasoning, cross-file changes, important tradeoffs, high-risk decisions, or failed validation.
- Use Max only when the problem is exceptionally difficult and correctness matters substantially more than latency or usage.
- Use Ultra only when the task can be divided into meaningful independent parts whose parallel execution provides a clear benefit.
- Do not increase reasoning effort merely because the input or output is long.
- Treat this policy as a default, not a fixed setting. The user's current prompt and any reasoning mode, speed preference, or quality preference they explicitly select for the current task always take precedence.
- If a temporary instruction conflicts with this default, follow the temporary instruction for that task and return to this policy afterward.
