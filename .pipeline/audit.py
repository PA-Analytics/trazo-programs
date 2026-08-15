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

def main():
    parser = argparse.ArgumentParser(description="Multi-Provider Pipeline Router & Auditor")
    parser.add_argument("--role", choices=["planner", "red_team", "tester", "all"], default="all",
                        help="Rol especializado a ejecutar (planner [Codex], red_team [DeepSeek Free], tester [MiMo Free], all)")
    parser.add_argument("--prompt", type=str, default=None,
                        help="Instrucción específica a enviar al modelo")
    parser.add_argument("--codex-model", type=str, default="gpt-5.6-luna",
                        help="Modelo específico de Codex (gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol)")
    parser.add_argument("--opencode-model", type=str, default="opencode/deepseek-v4-flash-free",
                        help="Modelo específico de OpenCode para Red Team")
    args = parser.parse_args()

    if args.role in ["planner", "all"]:
        run_codex_planner(args.prompt, model=args.codex_model)
    if args.role in ["red_team", "all"]:
        run_opencode_red_team(args.prompt, model=args.opencode_model)
    if args.role in ["tester", "all"]:
        run_opencode_tester(args.prompt)

if __name__ == "__main__":
    main()
