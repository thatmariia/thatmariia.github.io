import argparse
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from folio.content import load
from folio.export import LeakError, export
from folio.sync import sync


def main() -> None:
    parser = argparse.ArgumentParser(prog="folio")
    commands = parser.add_subparsers(dest="command", required=True)
    validate = commands.add_parser("validate", help="check a content directory")
    validate.add_argument("content", type=Path)
    export_ = commands.add_parser("export", help="write the public website data")
    export_.add_argument("content", type=Path)
    export_.add_argument("output", type=Path, help="e.g. site/src/data/public.json")
    sync_ = commands.add_parser("sync", help="add new works from Zenodo, Crossref and ORCID")
    sync_.add_argument("content", type=Path)
    args = parser.parse_args()

    try:
        content = load(args.content)
        if args.command == "export":
            data = export(content)
    except (ValidationError, ValueError, LeakError) as error:
        sys.exit(f"{args.content}: {error}")

    if args.command == "validate":
        print(f"{args.content}: {len(content.items())} items OK")
    elif args.command == "export":
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote {args.output}")
    elif args.command == "sync":
        sync(args.content, content)
        try:
            load(args.content)
        except (ValidationError, ValueError) as error:
            sys.exit(f"added works need a fix: {error}")
