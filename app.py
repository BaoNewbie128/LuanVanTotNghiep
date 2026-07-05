from flask import Flask, request, jsonify, render_template
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.efficientnet import preprocess_input
import numpy as np
from PIL import Image
import os
import base64
from io import BytesIO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('AI_MAX_UPLOAD_MB', '8')) * 1024 * 1024

IMG_SIZE = 300
model = None

classes = [
    '350z','ae86_trueno','civic_eg6','gtr_r34','gtr_r35','impreza',
    'lancer_evo_VI','nsx','rx7_fc','rx7_fd','s2000','silvia_s15',
    'supra_mk4','supra_mk5'
]

def get_image_model():
    global model
    if model is None:
        model = load_model(os.path.join(BASE_DIR, "car_model.keras"))
    return model


def predict_image(
    img,
    threshold=0.20
):

    img = img.resize(
        (IMG_SIZE, IMG_SIZE)
    )

    img = np.array(
        img
    ).astype("float32")

    img = np.expand_dims(
        img,
        axis=0
    )

    pred = get_image_model().predict(
        img,
        verbose=0
    )[0]


    results = []


    for idx, score in enumerate(pred):

        if score >= threshold:

            results.append({

                "label":
                    classes[idx],

                "confidence":
                    round(
                        float(score) * 100,
                        2
                    )
            })


    results.sort(
        key=lambda x:
            x["confidence"],
        reverse=True
    )


    # nếu không xe nào đủ ngưỡng
    if len(results) == 0:

        best_idx = np.argmax(pred)

        results.append({

            "label":
                classes[best_idx],

            "confidence":
                round(
                    float(
                        pred[best_idx]
                    ) * 100,
                    2
                )
        })


    return results


@app.route('/')
def home():
    return render_template("index.html")


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "service": "jdm-car-recognition",
        "classes": len(classes)
    })


@app.route('/predict', methods=['POST'])
def predict():
    try:
        file = request.files.get('image')
        if file is None or not file.filename:
            return jsonify({"error": "Vui lòng gửi một tệp ảnh."}), 422
        img = Image.open(file).convert("RGB")

        results = predict_image(img)

        return jsonify({
             "results": results
        })

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"error": str(e)}), 500
        
@app.route('/predict_camera', methods=['POST'])
def predict_camera():
    data = request.get_json(silent=True) or {}
    image_data = data.get('image', '')
    if ',' not in image_data:
        return jsonify({"error": "Dữ liệu ảnh base64 không hợp lệ."}), 422

    # bỏ header "data:image/jpeg;base64,..."
    image_data = image_data.split(",")[1]

    img = Image.open(BytesIO(base64.b64decode(image_data))).convert("RGB")

    return jsonify({"results": predict_image(img)})

@app.route('/predict_text', methods=['POST'])
def predict_text_api():
    from text_search import predict_text

    data = request.get_json(silent=True) or {}
    description = str(data.get("description", "")).strip()
    if not description:
        return jsonify({"error": "Vui lòng nhập mô tả cần tìm."}), 422

    results = predict_text(description)

    return jsonify({
        "results": results
    })
    
if __name__ == '__main__':
    app.run(
        host=os.environ.get("AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", os.environ.get("AI_PORT", "5000"))),
        debug=os.environ.get("AI_DEBUG", "false").lower() == "true"
    )

