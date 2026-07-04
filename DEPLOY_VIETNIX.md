# Triển khai JDM WORLD trên Vietnix VPS

Tài liệu này dùng cho Ubuntu 24.04, Nginx, PHP 8.3, MySQL và một dịch vụ AI nội bộ. Thay toàn bộ `YOUR_DOMAIN` trước khi chạy.

## 1. Những gì cần tải lên

Tạo gói từ máy Windows tại thư mục gốc:

```powershell
tar --exclude-from=.deployignore -czf jdm-world-production.tar.gz .
```

Không tải `frontend/node_modules`, `backend/vendor`, `DoAnAI/venv`, `DoAnAI/dataset`, log hoặc file `.env`. Model `DoAnAI/car_model.keras`, `text_database.pt`, thư mục `descriptions` và mã nguồn AI phải có trong gói.

Nếu triển khai bằng GitHub, máy chủ cần Git LFS:

```bash
git lfs install
git lfs pull
```

Kiểm tra `DoAnAI/car_model.keras` có kích thước khoảng 104 MB trước khi chạy dịch vụ AI.

Tải gói lên `/var/www/jdm-world`, sau đó giải nén:

```bash
sudo mkdir -p /var/www/jdm-world
sudo tar -xzf jdm-world-production.tar.gz -C /var/www/jdm-world
sudo chown -R "$USER":www-data /var/www/jdm-world
```

## 2. Cài phần mềm hệ thống

```bash
sudo apt update
sudo apt install -y nginx mysql-server php8.3-fpm php8.3-cli php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-gd php8.3-bcmath unzip curl git python3 python3-venv python3-pip
```

Cài Composer 2 và Node.js LTS từ nguồn chính thức của hai dự án. Kiểm tra bằng `composer --version`, `node --version` và `npm --version`.

## 3. Database

```bash
sudo mysql
```

```sql
CREATE DATABASE jdm_world CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'jdm_user'@'localhost' IDENTIFIED BY 'MAT_KHAU_MANH';
GRANT ALL PRIVILEGES ON jdm_world.* TO 'jdm_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Với database rỗng, chạy migration. Laravel tự tải schema công khai trong `backend/database/schema/mysql-schema.sql`, sau đó áp dụng các migration mới:

```bash
cd /var/www/jdm-world/backend
php artisan migrate --force
```

Schema công khai không chứa tài khoản hay dữ liệu giao dịch. Chỉ chạy `php artisan db:seed` nếu bạn chủ động muốn tạo tài khoản demo; không dùng mật khẩu demo mặc định trên website thật. Hãy sao lưu database trước mọi lần migration về sau.

## 4. Cấu hình Laravel

```bash
cd /var/www/jdm-world/backend
cp .env.production.example .env
php artisan key:generate
nano .env
```

Điền domain, database, SMTP, Vilao và thông tin cổng thanh toán. Giữ `APP_DEBUG=false`. Không đưa `.env` lên Git hoặc gửi công khai.

## 5. Nginx và dịch vụ nền

```bash
cd /var/www/jdm-world
sudo cp deploy/vietnix/nginx-jdm-world.conf /etc/nginx/sites-available/jdm-world
sudo sed -i 's/YOUR_DOMAIN/ten-mien-cua-ban.vn/g' /etc/nginx/sites-available/jdm-world
sudo ln -s /etc/nginx/sites-available/jdm-world /etc/nginx/sites-enabled/jdm-world
sudo rm -f /etc/nginx/sites-enabled/default

sudo cp deploy/vietnix/jdm-ai.service /etc/systemd/system/
sudo cp deploy/vietnix/jdm-queue.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable jdm-ai jdm-queue
```

Cho phép chạy script rồi build/cài dependency:

```bash
cd /var/www/jdm-world
chmod +x deploy/vietnix/deploy.sh
sudo APP_DIR=/var/www/jdm-world deploy/vietnix/deploy.sh
```

## 6. DNS và HTTPS

Trỏ bản ghi `A` của `@` và `www` về IP VPS. Sau khi DNS cập nhật:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ten-mien-cua-ban.vn -d www.ten-mien-cua-ban.vn
```

## 7. Kiểm tra

```bash
curl -I https://ten-mien-cua-ban.vn
curl https://ten-mien-cua-ban.vn/up
curl http://127.0.0.1:5000/health
sudo systemctl status jdm-ai jdm-queue php8.3-fpm nginx
sudo journalctl -u jdm-ai -n 100 --no-pager
tail -n 100 /var/www/jdm-world/backend/storage/logs/laravel.log
```

Kiểm tra thủ công: đăng ký/đăng nhập, tìm sản phẩm, chatbot văn bản và ảnh, giỏ hàng, tạo đơn COD, upload ảnh sản phẩm/bài viết, trang quản trị và callback thanh toán sandbox.

## 8. Cập nhật phiên bản sau

Tải mã nguồn mới lên, giữ nguyên `backend/.env` và dữ liệu trong `backend/storage`, rồi chạy lại `deploy/vietnix/deploy.sh`. Sao lưu MySQL và storage trước khi cập nhật.
