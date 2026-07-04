#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/jdm-world}"
cd "$APP_DIR"

test -f backend/.env || { echo "Missing backend/.env"; exit 1; }
test -s DoAnAI/car_model.keras || { echo "Missing DoAnAI/car_model.keras. Run git lfs pull first."; exit 1; }
if head -n 1 DoAnAI/car_model.keras | grep -q "git-lfs.github.com/spec"; then
    echo "AI model is still a Git LFS pointer. Run git lfs pull first."
    exit 1
fi

cd "$APP_DIR/frontend"
npm ci
npm run build

cd "$APP_DIR/backend"
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
php artisan storage:link || true
php artisan optimize:clear
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

cd "$APP_DIR/DoAnAI"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
sudo mkdir -p /var/cache/jdm-ai/huggingface
HF_HOME=/var/cache/jdm-ai/huggingface .venv/bin/python -c "from transformers import CLIPModel, CLIPProcessor; CLIPModel.from_pretrained('openai/clip-vit-base-patch32'); CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')"

sudo chown -R www-data:www-data "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache" /var/cache/jdm-ai
sudo chmod -R ug+rwX "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache"
sudo systemctl restart php8.3-fpm jdm-ai jdm-queue
sudo nginx -t
sudo systemctl reload nginx

curl --fail --silent http://127.0.0.1:5000/health
echo
echo "Deployment completed. Verify https://YOUR_DOMAIN/up and the website."
