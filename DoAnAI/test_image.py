from tensorflow.keras.models import load_model
from tensorflow.keras.applications.efficientnet import preprocess_input
import numpy as np
from PIL import Image

IMG_SIZE = 300

model = load_model("car_model.keras")

classes = [
    '350z','ae86_trueno','civic_eg6','gtr_r34','gtr_r35','impreza',
    'lancer_evo_VI','nsx','rx7_fc','rx7_fd','s2000','silvia_s15',
    'supra_mk4','supra_mk5'
]

def predict_image(path):
    img = Image.open(path).convert("RGB")

    # resize chuẩn (KHÔNG cần giữ size gốc)
    img = img.resize((IMG_SIZE, IMG_SIZE))

    img = np.array(img)
    img = preprocess_input(img)
    img = np.expand_dims(img, axis=0)

    pred = model.predict(img)[0]
    idx = np.argmax(pred)

    return classes[idx], pred[idx]

label, conf = predict_image("test.jpg")
print(label, conf)