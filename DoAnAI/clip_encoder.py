import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image


model = CLIPModel.from_pretrained(
    "openai/clip-vit-base-patch32"
)

processor = CLIPProcessor.from_pretrained(
    "openai/clip-vit-base-patch32"
)


def encode_text(text):

    inputs = processor(
        text=[str(text)],
        return_tensors="pt",
        padding=True
    )

    with torch.no_grad():

        output = model.text_model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )

        tensor = output.pooler_output

    return tensor


def encode_image(path):

    image = Image.open(path).convert("RGB")

    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    with torch.no_grad():

        output = model.vision_model(
            pixel_values=inputs["pixel_values"]
        )

        tensor = output.pooler_output


    return tensor
