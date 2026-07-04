# JDM AI service

Dịch vụ Flask nhận diện 14 dòng xe JDM từ ảnh và tìm kiếm mô tả bằng CLIP.

## Tệp runtime

- `car_model.keras`: model nhận diện ảnh, được quản lý bằng Git LFS.
- `text_database.pt`: vector mô tả dùng cho tìm kiếm văn bản.
- `descriptions/`: dữ liệu mô tả nguồn.

Thư mục `dataset/`, model thử nghiệm, log, cache và môi trường ảo không thuộc mã nguồn runtime nên không được commit.

## Chạy local trên Windows

```powershell
cd DoAnAI
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

Kiểm tra tại `http://127.0.0.1:5000/health`.

Sau khi clone repository, chạy `git lfs pull` trước khi khởi động để tải model thật thay cho file pointer LFS.

