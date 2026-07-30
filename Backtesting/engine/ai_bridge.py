"""AI hookup for the arena — asks a model one question, returns its text.

Providers:
    mock-momentum  deterministic baseline, no AI: predicts continuation of the prior
                   session (used to prove the harness and as the floor to beat)
    mock-flat      deterministic: always predicts nothing happening (the null floor)
    claude         Claude subscription CLI (claude -p), same login the app uses
    codex          Codex subscription CLI (codex exec), same login the app uses

Subscription CLIs cost nothing extra per run. No API keys are handled here.
"""
import shutil
import subprocess

CLI_TIMEOUT_SECONDS = 300


def _run_cli(argv: list, prompt: str) -> str:
    executable = shutil.which(argv[0])
    if not executable:
        raise RuntimeError(f"{argv[0]} CLI not found on PATH — install/login or use a mock provider.")
    result = subprocess.run([executable, *argv[1:]], input=prompt, capture_output=True,
                            text=True, encoding="utf-8", timeout=CLI_TIMEOUT_SECONDS)
    if result.returncode != 0:
        raise RuntimeError(f"{argv[0]} exited {result.returncode}: {result.stderr[:500]}")
    return result.stdout


def ask(provider: str, prompt: str, context: dict | None = None) -> str:
    """Return the model's raw text answer. `context` feeds the mock providers only."""
    context = context or {}
    if provider == "mock-flat":
        return '{"direction": "flat", "expansion": "no", "gap": "no", "severity": 0}'
    if provider == "mock-momentum":
        prior = context.get("prior_session_ret_pct", 0.0)
        direction = "up" if prior > 0 else "down" if prior < 0 else "flat"
        big = abs(prior) >= 1.0
        severity = 3 if big else 1 if abs(prior) >= 0.5 else 0
        return (f'{{"direction": "{direction}", "expansion": "{"yes" if big else "no"}", '
                f'"gap": "{"yes" if big else "no"}", "severity": {severity}}}')
    if provider == "claude":
        return _run_cli(["claude", "-p"], prompt)
    if provider == "codex":
        return _run_cli(["codex", "exec", "--full-auto", "--skip-git-repo-check"], prompt)
    raise KeyError(f"Unknown provider '{provider}'. Available: mock-flat, mock-momentum, claude, codex.")
