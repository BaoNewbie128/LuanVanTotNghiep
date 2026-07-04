import hashlib
import json
import random
from collections import defaultdict
from pathlib import Path
from PIL import Image


BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"
OUTPUT_PATH = BASE_DIR / "clean_split.json"
SEED = 20260702
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    records_by_hash = defaultdict(list)
    invalid_files = []

    for split_dir in sorted(path for path in DATASET_DIR.iterdir() if path.is_dir()):
        for class_dir in sorted(path for path in split_dir.iterdir() if path.is_dir()):
            for image_path in sorted(path for path in class_dir.iterdir() if path.is_file()):
                if image_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                    invalid_files.append({"path": str(image_path), "reason": "unsupported_extension"})
                    continue
                try:
                    with Image.open(image_path) as image:
                        image.verify()
                except Exception as exception:
                    invalid_files.append({"path": str(image_path), "reason": str(exception)})
                    continue
                records_by_hash[file_hash(image_path)].append({
                    "path": image_path.resolve().as_posix(),
                    "label": class_dir.name,
                    "source_split": split_dir.name,
                })

    conflicts = []
    unique_by_class = defaultdict(list)
    duplicate_files = 0

    for digest, records in records_by_hash.items():
        labels = sorted({record["label"] for record in records})
        duplicate_files += max(0, len(records) - 1)

        if len(labels) != 1:
            conflicts.append({"sha256": digest, "labels": labels, "files": records})
            continue

        preferred = next((record for record in records if record["source_split"] == "train"), records[0])
        unique_by_class[labels[0]].append({
            "path": preferred["path"],
            "label": labels[0],
            "sha256": digest,
        })

    rng = random.Random(SEED)
    clean_splits = {"train": [], "val": [], "test": []}
    class_counts = {}

    for label in sorted(unique_by_class):
        records = unique_by_class[label]
        rng.shuffle(records)
        total = len(records)
        test_count = max(1, round(total * 0.10))
        val_count = max(1, round(total * 0.10))
        train_count = total - val_count - test_count

        clean_splits["train"].extend(records[:train_count])
        clean_splits["val"].extend(records[train_count:train_count + val_count])
        clean_splits["test"].extend(records[train_count + val_count:])
        class_counts[label] = {
            "total_unique": total,
            "train": train_count,
            "val": val_count,
            "test": test_count,
        }

    manifest = {
        "seed": SEED,
        "strategy": "sha256_deduplicated_stratified_80_10_10",
        "classes": sorted(unique_by_class),
        "summary": {
            "unique_images": sum(len(records) for records in unique_by_class.values()),
            "duplicate_files_removed": duplicate_files,
            "conflicting_hashes_removed": len(conflicts),
            "invalid_or_unsupported_files_removed": len(invalid_files),
            "train": len(clean_splits["train"]),
            "val": len(clean_splits["val"]),
            "test": len(clean_splits["test"]),
        },
        "class_counts": class_counts,
        "splits": clean_splits,
        "conflicts": conflicts,
        "invalid_files": invalid_files,
    }

    OUTPUT_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))
    print(f"Manifest saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
