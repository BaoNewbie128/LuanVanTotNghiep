import torch
import torch.nn.functional as F
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

database = None


def get_database():
    global database
    if database is None:
        database = torch.load(
            BASE_DIR / "text_database.pt",
            map_location="cpu",
            weights_only=True
        )
    return database


def predict_text(
    text,
    top_k=3
):
    from clip_encoder import encode_text

    text_feature = encode_text(text)

    scores = []


    for label, db_features in get_database().items():

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
