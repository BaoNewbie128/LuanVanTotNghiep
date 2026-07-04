import os


def load_descriptions():

    descriptions = {}

    folder = "descriptions"

    for file_name in os.listdir(folder):

        if not file_name.endswith(".txt"):
            continue

        car_name = file_name.replace(".txt", "")

        file_path = os.path.join(
            folder,
            file_name
        )

        with open(
            file_path,
            encoding="utf-8"
        ) as f:

            lines = []

            for line in f:

                line = line.strip()

                if line:
                    lines.append(line)

        descriptions[car_name] = lines

    return descriptions