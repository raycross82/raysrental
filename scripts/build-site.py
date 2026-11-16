"""Run the exact Netlify build locally and in CI (Python 3.11+)."""
import pathlib
import subprocess
import tomllib

root = pathlib.Path(__file__).resolve().parents[1]
with (root / 'netlify.toml').open('rb') as f:
    config = tomllib.load(f)
raise SystemExit(subprocess.run(config['build']['command'], cwd=root, shell=True, executable='/bin/bash').returncode)
