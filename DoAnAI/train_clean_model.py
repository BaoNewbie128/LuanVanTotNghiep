import argparse
import json
import os
import random
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, regularizers
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras.callbacks import CSVLogger, EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.optimizers import Adam


BASE_DIR = Path(__file__).resolve().parent
MANIFEST_PATH = BASE_DIR / "clean_split.json"
MODEL_PATH = BASE_DIR / "car_model_clean_best.keras"
HEAD_MODEL_PATH = BASE_DIR / "car_model_clean_head.keras"
FINE_MODEL_PATH = BASE_DIR / "car_model_clean_fine.keras"
REPORT_PATH = BASE_DIR / "clean_training_report.json"
LOG_PATH = BASE_DIR / "clean_training.csv"
IMG_SIZE = 300
SEED = 20260702


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--head-epochs", type=int, default=8)
    parser.add_argument("--fine-epochs", type=int, default=4)
    parser.add_argument("--fine-layers", type=int, default=40)
    return parser.parse_args()


def configure_runtime():
    random.seed(SEED)
    np.random.seed(SEED)
    tf.random.set_seed(SEED)
    tf.config.threading.set_inter_op_parallelism_threads(max(1, (os.cpu_count() or 4) // 2))
    tf.config.threading.set_intra_op_parallelism_threads(max(1, os.cpu_count() or 4))


def load_manifest():
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError("Run prepare_clean_dataset.py before training")
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def decode_image(path, label):
    image = tf.io.read_file(path)
    image = tf.io.decode_image(image, channels=3, expand_animations=False)
    image.set_shape([None, None, 3])
    image = tf.image.resize(image, [IMG_SIZE, IMG_SIZE], antialias=True)
    return tf.cast(image, tf.float32), label


def make_dataset(records, class_to_index, batch_size, training):
    paths = [record["path"] for record in records]
    labels = [class_to_index[record["label"]] for record in records]
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))
    if training:
        dataset = dataset.shuffle(min(len(paths), 4096), seed=SEED, reshuffle_each_iteration=True)
    dataset = dataset.map(decode_image, num_parallel_calls=tf.data.AUTOTUNE)
    dataset = dataset.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return dataset


def build_model(class_count):
    augmentation = models.Sequential([
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.06),
        layers.RandomZoom(0.12),
        layers.RandomTranslation(0.08, 0.08),
        layers.RandomContrast(0.10),
    ], name="augmentation")
    base_model = EfficientNetB3(
        weights="imagenet",
        include_top=False,
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
    )
    base_model.trainable = False

    inputs = layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = augmentation(inputs)
    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(512, activation="relu", kernel_regularizer=regularizers.l2(0.0005))(x)
    x = layers.Dropout(0.45)(x)
    x = layers.Dense(256, activation="relu", kernel_regularizer=regularizers.l2(0.0005))(x)
    x = layers.Dropout(0.30)(x)
    outputs = layers.Dense(class_count, activation="softmax")(x)
    return models.Model(inputs, outputs), base_model


def compile_model(model, learning_rate):
    model.compile(
        optimizer=Adam(learning_rate),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )


def callbacks(checkpoint_path, append_log=False):
    return [
        ModelCheckpoint(checkpoint_path, monitor="val_accuracy", mode="max", save_best_only=True, verbose=1),
        EarlyStopping(monitor="val_accuracy", mode="max", patience=3, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.4, patience=2, min_lr=1e-7, verbose=1),
        CSVLogger(LOG_PATH, append=append_log),
    ]


def main():
    args = parse_args()
    configure_runtime()
    manifest = load_manifest()
    classes = manifest["classes"]
    class_to_index = {label: index for index, label in enumerate(classes)}
    train_ds = make_dataset(manifest["splits"]["train"], class_to_index, args.batch_size, True)
    val_ds = make_dataset(manifest["splits"]["val"], class_to_index, args.batch_size, False)
    test_ds = make_dataset(manifest["splits"]["test"], class_to_index, args.batch_size, False)

    model, base_model = build_model(len(classes))
    compile_model(model, 3e-4)
    head_history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.head_epochs,
        callbacks=callbacks(HEAD_MODEL_PATH),
    )

    model = tf.keras.models.load_model(HEAD_MODEL_PATH)
    base_model = model.get_layer("efficientnetb3")
    base_model.trainable = True
    for layer in base_model.layers[:-args.fine_layers]:
        layer.trainable = False
    for layer in base_model.layers:
        if isinstance(layer, layers.BatchNormalization):
            layer.trainable = False

    compile_model(model, 1e-5)
    fine_history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.head_epochs + args.fine_epochs,
        initial_epoch=args.head_epochs,
        callbacks=callbacks(FINE_MODEL_PATH, append_log=True),
    )

    head_model = tf.keras.models.load_model(HEAD_MODEL_PATH)
    fine_model = tf.keras.models.load_model(FINE_MODEL_PATH)
    head_val_loss, head_val_accuracy = head_model.evaluate(val_ds, verbose=0)
    fine_val_loss, fine_val_accuracy = fine_model.evaluate(val_ds, verbose=0)
    best_stage = "fine_tune" if fine_val_accuracy >= head_val_accuracy else "frozen_head"
    best_model = fine_model if best_stage == "fine_tune" else head_model
    best_model.save(MODEL_PATH)
    test_loss, test_accuracy = best_model.evaluate(test_ds, verbose=1)
    report = {
        "model": MODEL_PATH.name,
        "classes": classes,
        "split_summary": manifest["summary"],
        "test_loss": float(test_loss),
        "test_accuracy": float(test_accuracy),
        "selected_stage": best_stage,
        "head_checkpoint_val_accuracy": float(head_val_accuracy),
        "fine_checkpoint_val_accuracy": float(fine_val_accuracy),
        "head_best_val_accuracy": float(max(head_history.history["val_accuracy"])),
        "fine_best_val_accuracy": float(max(fine_history.history["val_accuracy"])),
        "batch_size": args.batch_size,
        "head_epochs_requested": args.head_epochs,
        "fine_epochs_requested": args.fine_epochs,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
