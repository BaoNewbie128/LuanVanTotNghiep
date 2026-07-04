import argparse
import json
from pathlib import Path

import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.callbacks import CSVLogger, EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam

from train_clean_model import (
    BASE_DIR,
    MANIFEST_PATH,
    MODEL_PATH,
    SEED,
    configure_runtime,
    make_dataset,
)


SOURCE_MODEL = MODEL_PATH
CONTINUED_MODEL = BASE_DIR / "car_model_clean_continued.keras"
REPORT_PATH = BASE_DIR / "clean_continued_report.json"
LOG_PATH = BASE_DIR / "clean_continued_training.csv"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--epochs", type=int, default=6)
    parser.add_argument("--fine-layers", type=int, default=80)
    return parser.parse_args()


def main():
    args = parse_args()
    configure_runtime()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    classes = manifest["classes"]
    class_to_index = {label: index for index, label in enumerate(classes)}
    train_ds = make_dataset(manifest["splits"]["train"], class_to_index, args.batch_size, True)
    val_ds = make_dataset(manifest["splits"]["val"], class_to_index, args.batch_size, False)
    test_ds = make_dataset(manifest["splits"]["test"], class_to_index, args.batch_size, False)

    model = tf.keras.models.load_model(SOURCE_MODEL)
    base_model = model.get_layer("efficientnetb3")
    base_model.trainable = True
    for layer in base_model.layers[:-args.fine_layers]:
        layer.trainable = False
    for layer in base_model.layers:
        if isinstance(layer, layers.BatchNormalization):
            layer.trainable = False

    model.compile(
        optimizer=Adam(5e-6),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=[
            ModelCheckpoint(CONTINUED_MODEL, monitor="val_accuracy", mode="max", save_best_only=True, verbose=1),
            EarlyStopping(monitor="val_accuracy", mode="max", patience=3, restore_best_weights=True, verbose=1),
            ReduceLROnPlateau(monitor="val_loss", factor=0.4, patience=2, min_lr=1e-7, verbose=1),
            CSVLogger(LOG_PATH),
        ],
    )

    candidate = tf.keras.models.load_model(CONTINUED_MODEL)
    current = tf.keras.models.load_model(MODEL_PATH)
    candidate_val_loss, candidate_val_accuracy = candidate.evaluate(val_ds, verbose=0)
    current_val_loss, current_val_accuracy = current.evaluate(val_ds, verbose=0)
    selected = "continued" if candidate_val_accuracy > current_val_accuracy else "previous"
    best = candidate if selected == "continued" else current
    if selected == "continued":
        best.save(MODEL_PATH)
    test_loss, test_accuracy = best.evaluate(test_ds, verbose=1)

    report = {
        "source_model": SOURCE_MODEL.name,
        "selected": selected,
        "candidate_val_accuracy": float(candidate_val_accuracy),
        "previous_val_accuracy": float(current_val_accuracy),
        "test_accuracy": float(test_accuracy),
        "test_loss": float(test_loss),
        "best_epoch_val_accuracy": float(max(history.history["val_accuracy"])),
        "epochs_completed": len(history.history["loss"]),
        "fine_layers": args.fine_layers,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
