#!/usr/bin/env python3
"""
Multi-Provider Pipeline Router & Auditor for Antigravity, OpenAI Codex & OpenCode Zen.

CRITICAL WINDOWS/POWERSHELL EXECUTION PROTOCOL:
Both `codex exec` and `opencode run` read from stdin by default if not closed.
When invoking from CLI/PowerShell:
1. Always pass `shell=True` on Windows to resolve `.cmd`/`.ps1` binaries.
2. Always pipe empty input (`input=""` or `echo "" | ...`) to prevent processes from hanging on stdin.
3. Use `--sandbox read-only` on Codex to guarantee non-destructive execution.
"""

import sys
import subprocess
import argparse
import json
from pathlib import Path


def load_active_profile(config_path=".pipeline/config.json"):
    config = json.loads(Path(config_path).read_text(encoding="utf-8"))
    profile_name = config.get("active_profile")
    profile = config.get("profiles", {}).get(profile_name)
    if not profile:
        raise ValueError(f"Active pipeline profile '{profile_name}' was not found")
    return profile


def role_settings(profile, role):
    settings = profile.get("roles", {}).get(role)
    if not settings:
        raise ValueError(f"Role '{role}' is not configured in the active pipeline profile")
    return settings

def run_codex_planner(prompt=None, model="gpt-5.6-luna"):
    """
    Invokes OpenAI Codex CLI for Architecture & Planning (Tier 1).
    Uses `--sandbox read-only` to guarantee safe inspection.
    """
    default_prompt = "Actúa como Planner / Architect de TRAZO. Diseña o valida los contratos técnicos y la arquitectura antes de implementar."
    final_prompt = prompt if prompt else default_prompt
    cmd = ["codex", "exec", "--sandbox", "read-only", "-m", model, final_prompt]
    
    print(f"[*] [PLANNER] Invocando OpenAI Codex CLI ({model}): {' '.join(cmd)}")
    try:
        # input="" is mandatory to close stdin stream and avoid hangs in Windows
        result = subprocess.run(cmd, input="", capture_output=True, text=True, check=False, shell=True)
        print("\n=== REPORTE DE ARQUITECTURA (OPENAI CODEX CLI) ===")
        print(result.stdout)
        if result.stderr:
            print(f"[Log/Stderr]: {result.stderr}")
        return result.returncode
    except Exception as e:
        print(f"[Error ejecutando OpenAI Codex CLI]: {e}")
        return 1

def run_opencode_red_team(prompt=None, model="opencode/deepseek-v4-flash-free"):
    """
    Invokes OpenCode Zen CLI for Adversarial Red Team Auditing (Tier 0 Free - Unbiased).
    """
    default_prompt = "Actúa como Red Team Auditor de TRAZO. Audita el repositorio buscando vulnerabilidades, bypasses de validación y anti-slop."
    final_prompt = prompt if prompt else default_prompt
    cmd = ["opencode", "run", "-m", model, final_prompt]
    
    print(f"[*] [RED TEAM] Invocando OpenCode Zen ({model}): {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, input="", capture_output=True, text=True, check=False, shell=True)
        print("\n=== REPORTE DE AUDITORÍA ADVERSARIAL (DEEPSEEK FLASH FREE) ===")
        print(result.stdout)
        if result.stderr:
            print(f"[Log/Stderr]: {result.stderr}")
        return result.returncode
    except Exception as e:
        print(f"[Error ejecutando OpenCode Zen]: {e}")
        return 1

def run_opencode_tester(prompt=None, model="opencode/mimo-v2.5-free"):
    """
    Invokes OpenCode Zen CLI for QA, Accessibility & Testing (Tier 0 Free).
    """
    default_prompt = "Actúa como Tester / QA de TRAZO. Valida la suite de tests, accesibilidad funcional y cumplimiento de calidad."
    final_prompt = prompt if prompt else default_prompt
    cmd = ["opencode", "run", "-m", model, final_prompt]
    
    print(f"[*] [QA / TESTER] Invocando OpenCode Zen ({model}): {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, input="", capture_output=True, text=True, check=False, shell=True)
        print("\n=== REPORTE DE QA & ACCESIBILIDAD (MIMO V2.5 FREE) ===")
        print(result.stdout)
        if result.stderr:
            print(f"[Log/Stderr]: {result.stderr}")
        return result.returncode
    except Exception as e:
        print(f"[Error ejecutando OpenCode Zen]: {e}")
        return 1


def run_agy_developer(prompt=None, model="gemini-3.7-flash-high", mode="accept-edits"):
    """
    Invokes the configured Antigravity CLI for bounded implementation work.
    Authentication is provided by the local agy installation; no API key is passed here.
    """
    default_prompt = "Actúa como Developer de TRAZO. Implementa únicamente la tarea acotada indicada y conserva la arquitectura existente."
    final_prompt = prompt if prompt else default_prompt
    cmd = [
        "agy",
        "--print",
        final_prompt,
        "--mode",
        mode,
        "--model",
        model,
        "--output-format",
        "text",
    ]

    print(f"[*] [DEVELOPER] Invocando Antigravity CLI ({model}, {mode}): {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, input="", capture_output=True, text=True, check=False, shell=True)
        print("\n=== REPORTE DE IMPLEMENTACIÓN (ANTIGRAVITY / AGY) ===")
        print(result.stdout)
        if result.stderr:
            print(f"[Log/Stderr]: {result.stderr}")
        return result.returncode
    except FileNotFoundError:
        print("[Error] No se encontró 'agy' en PATH. Instala o habilita el CLI de Antigravity.")
        return 1
    except Exception as e:
        print(f"[Error ejecutando Antigravity CLI]: {e}")
        return 1

def main():
    parser = argparse.ArgumentParser(description="Multi-Provider Pipeline Router & Auditor")
    parser.add_argument("--role", choices=["planner", "developer", "red_team", "tester", "all"], default="all",
                        help="Rol especializado a ejecutar (planner, developer [agy], red_team, tester, all)")
    parser.add_argument("--prompt", type=str, default=None,
                        help="Instrucción específica a enviar al modelo")
    parser.add_argument("--codex-model", type=str, default=None,
                        help="Modelo específico de Codex (gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol)")
    parser.add_argument("--agy-model", type=str, default=None,
                        help="Modelo específico de agy (por defecto, el del perfil activo)")
    parser.add_argument("--agy-mode", choices=["plan", "accept-edits"], default=None,
                        help="Modo de agy: plan o accept-edits")
    parser.add_argument("--opencode-model", type=str, default=None,
                        help="Modelo específico de OpenCode para Red Team")
    parser.add_argument("--config", type=str, default=".pipeline/config.json",
                        help="Ruta al config del pipeline")
    args = parser.parse_args()

    profile = load_active_profile(args.config)
    planner = role_settings(profile, "planner")
    developer = role_settings(profile, "developer")
    red_team = role_settings(profile, "red_team")
    tester = role_settings(profile, "tester")

    codex_model = args.codex_model or planner.get("model", "gpt-5.6-luna")
    agy_model = args.agy_model or developer.get("model", "gemini-3.7-flash-high")
    agy_mode = args.agy_mode or developer.get("mode", "accept-edits")
    opencode_model = args.opencode_model or red_team.get("model", "opencode/deepseek-v4-flash-free")

    if args.role in ["planner", "all"]:
        run_codex_planner(args.prompt, model=codex_model)
    if args.role == "developer":
        run_agy_developer(args.prompt, model=agy_model, mode=agy_mode)
    if args.role in ["red_team", "all"]:
        run_opencode_red_team(args.prompt, model=opencode_model)
    if args.role in ["tester", "all"]:
        run_opencode_tester(args.prompt, model=tester.get("model", "opencode/mimo-v2.5-free"))

if __name__ == "__main__":
    main()
