from PIL import Image
import os

def resize_folder(folder):
    for root, dirs, files in os.walk(folder):
        for file in files:
            path = os.path.join(root, file)
            try:
                img = Image.open(path).convert("RGB")
                img = img.resize((224, 224))
                img.save(path)
            except:
                print("Xoá ảnh lỗi:", path)
                os.remove(path)

# Resize toàn bộ dataset
# resize_folder("dataset/train")
# resize_folder("dataset/val")
# resize_folder("dataset/test")

print("DONE RESIZE")