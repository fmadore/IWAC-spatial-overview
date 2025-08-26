"""
Prepare JSON files from the Hugging Face dataset 'fmadore/islam-west-africa-collection'.

Outputs two files in the Svelte app's static data directory by default:
  - omeka-map-explorer/static/data/articles.json
  - omeka-map-explorer/static/data/index.json

Each file contains an array of objects with the requested fields.

Usage (PowerShell):
  # Optional venv setup and install requirements
  # python -m venv .venv
  # .\.venv\Scripts\Activate.ps1
  # pip install -r scripts/requirements.txt

  # Generate JSON files to default output folder
  # python scripts/prepare_json.py

  # Or specify a custom output directory
  # python scripts/prepare_json.py --out-dir "omeka-map-explorer/static/data"
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from datasets import Dataset, DatasetDict, load_dataset


DATASET_ID = "fmadore/islam-west-africa-collection"


def _pick_first_split(ds_dict: DatasetDict) -> Dataset:
    # Prefer 'train' if present, else first available split
    if "train" in ds_dict:
        return ds_dict["train"]
    # otherwise grab the first
    first_key = next(iter(ds_dict.keys()))
    return ds_dict[first_key]


def load_subset(dataset_id: str, subset_name: str) -> Dataset:
    """Load a subset that may be implemented as a config or a split.

    Tries loading in this order:
      1) load_dataset(dataset_id, subset_name) -> pick a split
      2) load_dataset(dataset_id, split=subset_name)
    """
    # Try config style (multiple configs in one dataset)
    try:
        ds_dict = load_dataset(dataset_id, subset_name)
        if isinstance(ds_dict, DatasetDict):
            return _pick_first_split(ds_dict)
        if isinstance(ds_dict, Dataset):
            return ds_dict
    except Exception:
        pass

    # Try split style (subset exposed as a split name)
    try:
        return load_dataset(dataset_id, split=subset_name)
    except Exception as e:
        raise RuntimeError(
            f"Failed to load subset '{subset_name}' from dataset '{dataset_id}'. "
            f"Tried both config and split styles. Error: {e}"
        )


def to_pipe_separated(value: Any) -> str:
    """Normalize a value to a ' | ' separated string.

    - list/tuple/set -> join items by ' | '
    - dict -> join values if simple, else JSON-dump
    - str/number -> str(value)
    - None -> ''
    """
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        parts = []
        for v in value:
            if v is None:
                continue
            if isinstance(v, (dict, list, tuple, set)):
                parts.append(json.dumps(v, ensure_ascii=False))
            else:
                parts.append(str(v))
        return " | ".join(p for p in parts if p)
    if isinstance(value, dict):
        # best effort: simple flat join of values if they’re primitives
        if all(not isinstance(v, (dict, list, tuple, set)) for v in value.values()):
            return " | ".join(str(v) for v in value.values() if v is not None)
        return json.dumps(value, ensure_ascii=False)
    return str(value)


_ISO_YMD = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_ISO_YM = re.compile(r"^(\d{4})-(\d{2})$")
_ISO_Y = re.compile(r"^(\d{4})$")
_DMY_SLASH = re.compile(r"^(\d{1,2})\/(\d{1,2})\/(\d{4})$")


def normalize_date_ymd(value: Any) -> str:
    """Normalize a date-like value to YYYY-MM-DD. Best-effort, non-failing.

    Examples handled:
      - YYYY-MM-DD -> as is
      - YYYY-MM    -> append -01
      - YYYY       -> append -01-01
      - DD/MM/YYYY -> convert to YYYY-MM-DD
      - otherwise: return original str(value)
    """
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""

    m = _ISO_YMD.match(s)
    if m:
        return s
    m = _ISO_YM.match(s)
    if m:
        y, mth = m.groups()
        return f"{y}-{mth}-01"
    m = _ISO_Y.match(s)
    if m:
        (y,) = m.groups()
        return f"{y}-01-01"
    m = _DMY_SLASH.match(s)
    if m:
        d, mth, y = m.groups()
        return f"{int(y):04d}-{int(mth):02d}-{int(d):02d}"
    return s


def get_first_non_empty(row: Dict[str, Any], keys: Iterable[str]) -> Any:
    for k in keys:
        if k in row:
            v = row[k]
            # consider empty containers as empty
            if v is None:
                continue
            if isinstance(v, (list, tuple, set, dict)) and not v:
                continue
            return v
    return None


def transform_articles_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        # strings
        "o:id": str(get_first_non_empty(row, ["o:id", "o_id", "id"])) or "",
        "title": str(get_first_non_empty(row, ["title", "dcterms:title", "Titre"])) or "",
        "newspaper": str(get_first_non_empty(row, ["newspaper", "dcterms:publisher", "publisher"])) or "",
        "country": str(get_first_non_empty(row, ["country", "pays", "Country"])) or "",
        # dates normalized
        "pub_date": normalize_date_ymd(get_first_non_empty(row, ["pub_date", "date", "dcterms:date"])) or "",
        # pipe-separated
        "subject": to_pipe_separated(get_first_non_empty(row, ["subject", "dcterms:subject"])) or "",
        "spatial": to_pipe_separated(get_first_non_empty(row, ["spatial", "dcterms:spatial"])) or "",
    }


def transform_index_row(row: Dict[str, Any]) -> Dict[str, Any]:
    oid = get_first_non_empty(row, ["o:id", "o_id", "id"])  # keep numeric if possible
    try:
        oid_num: Optional[int] = int(oid) if oid is not None and str(oid).strip() else None
    except Exception:
        oid_num = None

    return {
        "o:id": oid_num if oid_num is not None else None,
        "Titre": str(get_first_non_empty(row, ["Titre", "title", "dcterms:title"])) or "",
        "Type": str(get_first_non_empty(row, ["Type", "type"])) or "",
        "Coordonnées": str(get_first_non_empty(row, ["Coordonnées", "coordinates", "coordonnees", "curation:coordinates"])) or "",
    }


def ensure_out_dir(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, rows: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare JSON files from the IWAC dataset")
    parser.add_argument(
        "--out-dir",
        type=str,
        default=str(Path(__file__).resolve().parents[1] / "omeka-map-explorer" / "static" / "data"),
        help="Directory where JSON files will be written (default: omeka-map-explorer/static/data)",
    )
    parser.add_argument(
        "--dataset-id",
        type=str,
        default=DATASET_ID,
        help="Hugging Face dataset ID",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir).resolve()
    ensure_out_dir(out_dir)

    # Load subsets
    articles_ds = load_subset(args.dataset_id, "articles")
    index_ds = load_subset(args.dataset_id, "index")

    # Transform rows
    articles_rows = [transform_articles_row(r) for r in articles_ds]
    index_rows = [transform_index_row(r) for r in index_ds]

    # Write outputs
    write_json(out_dir / "articles.json", articles_rows)
    write_json(out_dir / "index.json", index_rows)

    print(f"Wrote {len(articles_rows)} articles -> {out_dir / 'articles.json'}")
    print(f"Wrote {len(index_rows)} index entries -> {out_dir / 'index.json'}")


if __name__ == "__main__":
    main()
