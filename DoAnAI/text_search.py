import torch
import torch.nn.functional as F
from pathlib import Path

from clip_encoder import encode_text


BASE_DIR = Path(__file__).resolve().parent

database = torch.load(
    BASE_DIR / "text_database.pt",
    map_location="cpu",
    weights_only=True
)


def predict_text(
    text,
    top_k=3
):

    text_feature = encode_text(text)

    scores = []


    for label, db_features in database.items():

        best_score = -1


        for db_feature in db_features:

            score = F.cosine_similarity(
                text_feature,
                db_feature.unsqueeze(0)
            ).item()


            if score > best_score:
                best_score = score


        scores.append({
            "label": label,
            "score": best_score
        })


        scores.sort(
        key=lambda x: x["score"],
        reverse=True
    )


    return scores[:max(1, int(top_k))]
