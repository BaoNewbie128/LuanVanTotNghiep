"""One-time converter for the deployment-friendly LiteRT image model."""

from pathlib import Path

import tensorflow as tf


BASE_DIR = Path(__file__).resolve().parent
SOURCE_MODEL = BASE_DIR / "car_model.keras"
OUTPUT_MODEL = BASE_DIR / "car_model.tflite"


def main() -> None:
    model = tf.keras.models.load_model(SOURCE_MODEL, compile=False)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    OUTPUT_MODEL.write_bytes(converter.convert())
    print(f"Created {OUTPUT_MODEL.name}: {OUTPUT_MODEL.stat().st_size} bytes")


if __name__ == "__main__":
    main()
