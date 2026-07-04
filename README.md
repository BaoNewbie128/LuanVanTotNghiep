# JDM WORLD

Website thương mại điện tử bán mô hình xe JDM, gồm giao diện khách hàng, cổng nhân viên, trang quản trị và dịch vụ AI nhận diện/tìm kiếm xe.

## Kiến trúc

| Thành phần | Công nghệ | Thư mục |
|---|---|---|
| Giao diện | React 19, Vite 8 | `frontend/` |
| API | Laravel 13, Sanctum, MySQL | `backend/` |
| AI | Flask, TensorFlow, CLIP/PyTorch | `DoAnAI/` |
| Triển khai | Nginx, systemd, PHP-FPM | `deploy/vietnix/` |

## Yêu cầu

- Git và [Git LFS](https://git-lfs.com/)
- Node.js 22.12 trở lên
- PHP 8.3, Composer 2 và các extension Laravel/MySQL thông dụng
- MySQL 8
- Python 3.10

## Cài đặt local

### 1. Clone và tải model AI

```bash
git clone <REPOSITORY_URL>
cd LuanVanTotNghiep-VongThanhBao
git lfs pull
```

Nếu `DoAnAI/car_model.keras` chỉ là một file văn bản nhỏ chứa dòng `git-lfs`, model chưa được tải thành công.

### 2. Backend

Tạo database MySQL rỗng tên `jdm_world`, sau đó:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

Schema công khai tại `backend/database/schema/mysql-schema.sql` tự tạo cấu trúc và catalog mẫu khi migrate database mới. Nó không chứa tài khoản, OTP, token, đơn hàng hay dữ liệu khách hàng thật.

Ba tài khoản local được tạo bởi seeder:

- `admin@example.com`
- `staff@example.com`
- `customer@example.com`

Mật khẩu lấy từ `DEMO_USER_PASSWORD` trong `.env`. Không dùng mật khẩu demo mặc định trên môi trường công khai.

### 3. Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Frontend chạy tại `http://localhost:5173`, API Laravel tại `http://localhost:8000`.

### 4. AI

Xem hướng dẫn trong [`DoAnAI/README.md`](DoAnAI/README.md). Sau khi cài, chạy dịch vụ tại `http://127.0.0.1:5000`.

## Kiểm tra chất lượng

```bash
cd frontend
npm run lint
npm run build

cd ../backend
php artisan test

cd ..
python -m compileall -q DoAnAI
```

GitHub Actions cũng tự chạy các kiểm tra trên cho mỗi push và pull request.

## Dữ liệu và file không commit

- `.env`, khóa API, thông tin SMTP/cổng thanh toán
- `jdm (1).sql` vì chứa dữ liệu người dùng cục bộ
- `node_modules`, `vendor`, môi trường Python, build và log
- `DoAnAI/dataset` và model thử nghiệm
- ảnh người dùng upload trong `backend/storage/app/public`

Model runtime `DoAnAI/car_model.keras` được commit bằng Git LFS.

## Triển khai

Hướng dẫn Vietnix VPS nằm tại [`DEPLOY_VIETNIX.md`](DEPLOY_VIETNIX.md). Luôn thay placeholder domain, tạo `.env` riêng và sao lưu MySQL/storage trước khi cập nhật.

