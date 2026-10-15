import asyncio

from core.logging import log_main

_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 3.0  # seconds; doubles each attempt (3s, 6s, 12s)

_NOT_LOGGED_IN_MARKERS = ("not logged in", "/login")


class ClaudeNotConfiguredError(RuntimeError):
    """The `claude` CLI isn't installed, or isn't logged into a Pro/Max
    account — not retryable, and worth a distinct message from a generic
    LLM failure so the API can tell the user exactly what to fix."""


async def _run_once(prompt: str, timeout: float) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            "claude",
            "-p",
            prompt,
            "--output-format",
            "text",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise ClaudeNotConfiguredError("claude CLI is not installed") from None

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except TimeoutError:
        proc.kill()
        raise RuntimeError("claude CLI timed out") from None

    if proc.returncode != 0:
        stderr_text = stderr.decode().strip()
        if any(marker in stderr_text.lower() for marker in _NOT_LOGGED_IN_MARKERS):
            raise ClaudeNotConfiguredError(
                "claude CLI is not logged in — run `claude login` (or, in Docker, "
                "`docker exec -it -u appuser job-scrapper claude login`)"
            )
        raise RuntimeError(f"claude CLI exited {proc.returncode}: {stderr_text}")

    output = stdout.decode().strip()
    if not output:
        raise RuntimeError("claude CLI returned empty output")
    return output


async def invoke_claude_cli(prompt: str, *, timeout: float = 120.0) -> str:
    """Headless Claude Code CLI call (`claude -p`) — consumes the host's
    Pro/Max subscription quota instead of pay-per-token API billing. Separate
    retry loop from provider.py's since the failure modes here (nonzero exit,
    timeout, empty stdout) aren't langchain exceptions."""
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return await _run_once(prompt, timeout)
        except ClaudeNotConfiguredError:
            raise  # not retryable — retrying a missing login wastes ~21s for nothing
        except Exception as exc:
            last_exc = exc
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (2**attempt)
                log_main(
                    f"claude cli: {exc}, retrying in {delay:.0f}s ({attempt + 1}/{_MAX_RETRIES})"
                )
                await asyncio.sleep(delay)
                continue
            break
    assert last_exc is not None
    raise last_exc
