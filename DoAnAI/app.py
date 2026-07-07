import base64
import os
from io import BytesIO
from threading import Lock

import numpy as np
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS
from PIL import Image


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_SIZE = 300

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = (
    int(os.environ.get("AI_MAX_UPLOAD_MB", "8")) * 1024 * 1024
)

classes = [
    "350z",
    "ae86_trueno",
    "civic_eg6",
    "gtr_r34",
    "gtr_r35",
    "impreza",
    "lancer_evo_VI",
    "nsx",
    "rx7_fc",
    "rx7_fd",
    "s2000",
    "silvia_s15",
    "supra_mk4",
    "supra_mk5",
]

image_interpreter = None
image_input = None
image_output = None
image_model_lock = Lock()


def get_image_model():
    global image_interpreter, image_input, image_output

    if image_interpreter is None:
        from ai_edge_litert.interpreter import Interpreter

        image_interpreter = Interpreter(
            model_path=os.path.join(BASE_DIR, "car_model.tflite"),
            num_threads=max(1, int(os.environ.get("AI_LITERT_THREADS", "2"))),
        )
        image_interpreter.allocate_tensors()
        image_input = image_interpreter.get_input_details()[0]
        image_output = image_interpreter.get_output_details()[0]

    return image_interpreter, image_input, image_output


def predict_image(img, threshold=0.20):
    img = img.resize((IMG_SIZE, IMG_SIZE))
    batch = np.expand_dims(np.asarray(img, dtype=np.float32), axis=0)

    interpreter, input_details, output_details = get_image_model()
    batch = batch.astype(input_details["dtype"], copy=False)

    with image_model_lock:
        interpreter.set_tensor(input_details["index"], batch)
        interpreter.invoke()
        prediction = interpreter.get_tensor(output_details["index"])[0]

    results = [
        {
            "label": classes[index],
            "confidence": round(float(score) * 100, 2),
        }
        for index, score in enumerate(prediction)
        if score >= threshold
    ]
    results.sort(key=lambda item: item["confidence"], reverse=True)

    if not results:
        best_index = int(np.argmax(prediction))
        results.append(
            {
                "label": classes[best_index],
                "confidence": round(float(prediction[best_index]) * 100, 2),
            }
        )

    return results


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "service": "jdm-car-recognition",
            "classes": len(classes),
            "image_engine": "litert",
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    try:
        file = request.files.get("image")
        if file is None or not file.filename:
            return jsonify({"error": "Vui lòng gửi một tệp ảnh."}), 422

        image = Image.open(file).convert("RGB")
        return jsonify({"results": predict_image(image)})
    except Exception as exception:
        app.logger.exception("Image prediction failed")
        return jsonify({"error": str(exception)}), 500


@app.route("/predict_camera", methods=["POST"])
def predict_camera():
    try:
        data = request.get_json(silent=True) or {}
        image_data = data.get("image", "")
        if "," not in image_data:
            return jsonify({"error": "Dữ liệu ảnh base64 không hợp lệ."}), 422

        encoded_image = image_data.split(",", 1)[1]
        image = Image.open(BytesIO(base64.b64decode(encoded_image))).convert("RGB")
        return jsonify({"results": predict_image(image)})
    except Exception as exception:
        app.logger.exception("Camera prediction failed")
        return jsonify({"error": str(exception)}), 500


@app.route("/predict_text", methods=["POST"])
def predict_text_api():
    data = request.get_json(silent=True) or {}
    description = str(data.get("description", "")).strip()
    if not description:
        return jsonify({"error": "Vui lòng nhập mô tả cần tìm."}), 422

    # Laravel already has local matching and an LLM fallback. Loading Torch
    # and CLIP in this small Render instance would exhaust its memory.
    return jsonify(
        {"error": "Text prediction is handled by the application fallback."}
    ), 503


if __name__ == "__main__":
    app.run(
        host=os.environ.get("AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", os.environ.get("AI_PORT", "5000"))),
        debug=os.environ.get("AI_DEBUG", "false").lower() == "true",
    )
