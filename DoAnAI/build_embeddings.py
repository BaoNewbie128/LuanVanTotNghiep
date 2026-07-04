import clip_encoder

print(clip_encoder.__file__)

import torch
from clip_encoder import encode_text
from load_descriptions import load_descriptions


car_descriptions = load_descriptions()

database = {}


for car_name, descriptions in car_descriptions.items():

    features = []

    for desc in descriptions:

        feature = encode_text(desc)

        print(type(feature))

        features.append(
            feature.cpu()
        )


    database[car_name] = torch.cat(
        features,
        dim=0
    )


torch.save(
    database,
    "text_database.pt"
)


print("done")