import argparse
import sys
from pathlib import Path

from pydantic import ValidationError

from folio.content import load


def main() -> None:
    parser = argparse.ArgumentParser(prog="folio")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="check a content directory")
    validate.add_argument("content", type=Path)
    args = parser.parse_args()

    try:
        content = load(args.content)
    except (ValidationError, ValueError) as error:
        sys.exit(f"{args.content}: {error}")
    print(f"{args.content}: {len(content.items())} items OK")
