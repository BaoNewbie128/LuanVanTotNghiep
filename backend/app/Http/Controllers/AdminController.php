<?php

namespace App\Http\Controllers;

use App\Exports\AdminSystemReportExport;
use App\Models\Order;
use App\Models\User;
use App\Models\Coupon;
use App\Models\Returns as ReturnModel;
use App\Models\OrderItem;
use App\Models\ProductImages;
use App\Models\Products;
use App\Models\Payment;
use App\Models\Notification;
use App\Services\ValidationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Carbon\Carbon;
use Maatwebsite\Excel\Facades\Excel;

class AdminController extends Controller
{
    private const REVENUE_ORDER_STATUSES = ['paid', 'completed'];

    private const BLOCKING_ORDER_STATUSES = ['pending', 'pending_payment', 'cod_pending', 'paid', 'shipping'];

    private function adminErrorResponse(string $message, \Throwable $exception, int $status = 422)
    {
        return response()->json([
            'success' => false,
            'message' => $message . ': ' . $exception->getMessage(),
        ], $status);
    }

    private function formatBrandCategory(string $brand): array
    {
        return [
            'id' => $brand,
            'name' => $brand,
        ];
    }

    private function syncCategoryBrand(array &$validated): void
    {
        if (!array_key_exists('brand', $validated)) {
            return;
        }

        $validated['brand'] = trim((string) $validated['brand']);
    }

    private function hasBlockingActiveOrdersForProduct(int $productId): bool
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.product_id', $productId)
            ->whereIn('orders.status', self::BLOCKING_ORDER_STATUSES)
            ->exists();
    }

    private function hasBlockingActiveOrdersForProducts($productIds): bool
    {
        $ids = collect($productIds)
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values();

        if ($ids->isEmpty()) {
            return false;
        }

        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.product_id', $ids)
            ->whereIn('orders.status', self::BLOCKING_ORDER_STATUSES)
            ->exists();
    }

    private function hasBlockingActiveOrdersForBrand(string $brand): bool
    {
        return OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('products.brand', $brand)
            ->whereIn('orders.status', self::BLOCKING_ORDER_STATUSES)
            ->exists();
    }

    private function validateAdminCatalogPayload(Request $request, bool $isUpdate = false): array
    {
        $rules = [
            'brand' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:50', 'regex:/^[\pL\s0-9-]+$/u'],
            'model' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:100', 'regex:/^[\pL\s0-9:-]+$/u'],
            'scale' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:10'],
            'price' => [$isUpdate ? 'sometimes' : 'required', 'numeric'],
            'color' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:100', 'regex:/^[\pL\s0-9-]+$/u'],
            'stock' => [$isUpdate ? 'sometimes' : 'required', 'integer', 'min:0'],
            'description' => [$isUpdate ? 'sometimes' : 'required', 'string'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
            'image' => [$isUpdate ? 'nullable' : 'required', 'image', 'mimes:jpeg,png,jpg', 'max:2048'],
            'images' => ['nullable', 'array'],
            'images.*' => ['image', 'mimes:jpeg,png,jpg', 'max:2048'],
            'removed_image_ids' => ['nullable', 'array'],
            'removed_image_ids.*' => ['integer'],
        ];

        $validated = $request->validate($rules);

        if (array_key_exists('price', $validated)) {
            $priceCheck = ValidationService::validateProductPrice($validated['price']);
            if (!$priceCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $priceCheck['message'] ?? 'Invalid product price',
                ], 422));
            }
        }

        if (array_key_exists('stock', $validated)) {
            $stockCheck = ValidationService::validateStockQuantity($validated['stock']);
            if (!$stockCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $stockCheck['message'] ?? 'Invalid stock quantity',
                ], 422));
            }
        }

        if (array_key_exists('model', $validated)) {
            $modelCheck = ValidationService::validateString($validated['model'], 1, 100, '/^[\pL\s0-9:-]+$/u');
            if (!$modelCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $modelCheck['message'] ?? 'Invalid product model',
                ], 422));
            }
        }

        if (array_key_exists('color', $validated)) {
            $colorCheck = ValidationService::validateString($validated['color'], 1, 100, '/^[\pL\s0-9-]+$/u');
            if (!$colorCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $colorCheck['message'] ?? 'Invalid product color',
                ], 422));
            }
        }

        if (array_key_exists('brand', $validated)) {
            $brandCheck = ValidationService::validateString($validated['brand'], 1, 50, '/^[\pL\s0-9-]+$/u');
            if (!$brandCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $brandCheck['message'] ?? 'Invalid brand/category name',
                ], 422));
            }
        }

        $this->syncCategoryBrand($validated);

        return $validated;
    }

    private function validateAdminCatalogVariantsPayload(Request $request): array
    {
        $validated = $request->validate([
            'brand' => ['required', 'string', 'max:50', 'regex:/^[\pL\s0-9-]+$/u'],
            'model' => ['required', 'string', 'max:100', 'regex:/^[\pL\s0-9:-]+$/u'],
            'scale' => ['required', 'string', 'max:10'],
            'description' => ['required', 'string'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.color' => ['required', 'string', 'max:100', 'regex:/^[\pL\s0-9-]+$/u'],
            'variants.*.price' => ['required', 'numeric'],
            'variants.*.stock' => ['required', 'integer', 'min:0'],
            'variants.*.image' => ['required', 'image', 'mimes:jpeg,png,jpg', 'max:2048'],
        ]);

        $this->syncCategoryBrand($validated);

        $brandCheck = ValidationService::validateString($validated['brand'], 1, 50, '/^[\pL\s0-9-]+$/u');
        if (!$brandCheck['valid']) {
            abort(response()->json([
                'success' => false,
                'message' => $brandCheck['message'] ?? 'Invalid brand/category name',
            ], 422));
        }

        $modelCheck = ValidationService::validateString($validated['model'], 1, 100, '/^[\pL\s0-9:-]+$/u');
        if (!$modelCheck['valid']) {
            abort(response()->json([
                'success' => false,
                'message' => $modelCheck['message'] ?? 'Invalid product model',
            ], 422));
        }

        foreach ($validated['variants'] as $variant) {
            $priceCheck = ValidationService::validateProductPrice($variant['price']);
            if (!$priceCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $priceCheck['message'] ?? 'Invalid product price',
                ], 422));
            }

            $stockCheck = ValidationService::validateStockQuantity($variant['stock']);
            if (!$stockCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $stockCheck['message'] ?? 'Invalid stock quantity',
                ], 422));
            }

            $colorCheck = ValidationService::validateString($variant['color'], 1, 100, '/^[\pL\s0-9-]+$/u');
            if (!$colorCheck['valid']) {
                abort(response()->json([
                    'success' => false,
                    'message' => $colorCheck['message'] ?? 'Invalid product color',
                ], 422));
            }
        }

        return $validated;
    }

    private function storeCatalogImage($file): string
    {
        $imageValidation = ValidationService::validateImage($file);
        if (!$imageValidation['valid']) {
            abort(response()->json([
                'success' => false,
                'message' => $imageValidation['message'],
            ], 422));
        }

        $fileName = time() . '_' . Str::random(8) . '_' . preg_replace('/\s+/', '_', $file->getClientOriginalName());
        return $file->storeAs('products', $fileName, 'public');
    }

    private function attachProductImages(Products $product, array $files = []): void
    {
        foreach ($files as $file) {
            ProductImages::create([
                'product_id' => $product->id,
                'image_url' => $this->storeCatalogImage($file),
            ]);
        }
    }

    private function deleteStoredImage(?string $path): void
    {
        if (!$path) {
            return;
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
            return;
        }

        // Preserve compatibility with images created before storage was centralized.
        $legacyImagePath = base_path('../frontend/public/images/' . basename($path));
        if (file_exists($legacyImagePath)) {
            unlink($legacyImagePath);
        }
    }

    private function getCatalogImageUrl(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        return Str::startsWith($path, 'products/') ? Storage::url($path) : '/images/' . basename($path);
    }

    private function transformAdminProduct(Products $product): Products
    {
        $product->primary_image_url = $this->getCatalogImageUrl($product->image);
        $product->gallery = $product->images->map(function ($image) {
            return [
                'id' => $image->id,
                'image_url' => $image->image_url,
                'full_url' => $this->getCatalogImageUrl($image->image_url),
            ];
        })->values();

        return $product;
    }

    public function getBrands(Request $request)
    {
        try {
            $brands = Products::query()
                ->selectRaw('brand as name, COUNT(*) as products_count')
                ->whereNotNull('brand')
                ->where('brand', '!=', '')
                ->groupBy('brand')
                ->orderBy('brand', 'asc')
                ->get()
                ->map(fn ($brand) => $this->formatBrandCategory($brand->name) + ['products_count' => (int) $brand->products_count])
                ->values();

            return response()->json([
                'success' => true,
                'data' => $brands,
            ]);
        } catch (\Exception $e) {
            return $this->adminErrorResponse('Failed to fetch brand groups', $e, 500);
        }
    }

    public function updateCategory(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:50',
                'regex:/^[\pL\s0-9-]+$/u',
            ],
        ]);

        $currentBrand = trim((string) $id);
        $newBrand = trim($validated['name']);

        $nameCheck = ValidationService::validateString($newBrand, 1, 50, '/^[\pL\s0-9-]+$/u');
        if (!$nameCheck['valid']) {
            return response()->json([
                'success' => false,
                'message' => $nameCheck['message'] ?? 'Tên danh mục không hợp lệ.',
            ], 422);
        }

        if (
            Str::lower($currentBrand) !== Str::lower($newBrand)
            && Products::withTrashed()->whereRaw('LOWER(brand) = ?', [Str::lower($newBrand)])->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Danh mục/hãng xe đích đã tồn tại.',
            ], 422);
        }

        $products = Products::withTrashed()
            ->whereRaw('LOWER(brand) = ?', [Str::lower($currentBrand)])
            ->get();
        if ($products->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy danh mục/hãng xe cần cập nhật.',
            ], 404);
        }

        DB::transaction(function () use ($products, $newBrand) {
            foreach ($products as $product) {
                $product->update(['brand' => $newBrand]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Đã cập nhật danh mục/hãng xe.',
            'data' => $this->formatBrandCategory($newBrand) + ['products_count' => $products->count()],
        ]);
    }

    public function deleteCategory($id)
    {
        $brand = trim((string) $id);
        $products = Products::whereRaw('LOWER(brand) = ?', [Str::lower($brand)])->get();

        if ($products->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy danh mục/hãng xe cần xóa.',
            ], 404);
        }

        if ($this->hasBlockingActiveOrdersForBrand($brand)) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể xóa danh mục vì có sản phẩm thuộc đơn hàng đang xử lý (chờ xử lý, đã thanh toán, đang giao hàng).',
            ], 400);
        }

        DB::transaction(function () use ($products) {
            foreach ($products as $product) {
                $product->update(['is_active' => false]);
                if (!$product->trashed()) {
                    $product->delete();
                }
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Đã xóa mềm danh mục/hãng xe và các sản phẩm liên quan.',
        ]);
    }

    public function getProducts(Request $request)
    {
        try {
            $status = $request->input('status');
            $search = trim((string) $request->input('search', ''));
            $brand = trim((string) $request->input('brand', ''));
            $perPage = min((int) $request->input('per_page', 15), 50);

            $query = Products::withTrashed()->with('images')->orderByDesc('created_at');

            if ($status === 'active') {
                $query->whereNull('deleted_at')->where('is_active', true);
            } elseif ($status === 'inactive') {
                $query->whereNull('deleted_at')->where('is_active', false);
            } elseif ($status === 'deleted') {
                $query->onlyTrashed();
            }

            if ($search !== '') {
                $query->where(function ($builder) use ($search) {
                    $builder
                        ->where('brand', 'like', "%{$search}%")
                        ->orWhere('model', 'like', "%{$search}%")
                        ->orWhere('color', 'like', "%{$search}%");
                });
            }

            if ($brand !== '') {
                $query->where('brand', $brand);
            }

            $products = $query->paginate($perPage);
            $products->getCollection()->transform(fn (Products $product) => $this->transformAdminProduct($product));

            return response()->json([
                'success' => true,
                'data' => $products->items(),
                'pagination' => [
                    'current_page' => $products->currentPage(),
                    'last_page' => $products->lastPage(),
                    'per_page' => $products->perPage(),
                    'total' => $products->total(),
                ],
            ]);
        } catch (\Exception $e) {
            return $this->adminErrorResponse('Failed to fetch products', $e, 500);
        }
    }

    public function store(Request $request)
    {
        $storedImages = [];

        try {
            $validated = $this->validateAdminCatalogVariantsPayload($request);
            DB::beginTransaction();

            $commonData = $request->only(['brand', 'model', 'scale', 'description']);
            $commonData = [
                'brand' => trim((string) ($commonData['brand'] ?? '')),
                'model' => trim((string) ($commonData['model'] ?? '')),
                'scale' => trim((string) ($commonData['scale'] ?? '')),
                'description' => trim((string) ($commonData['description'] ?? '')),
            ];

            $createdProducts = [];

            foreach ($request->variants as $index => $variant) {
                $imageFile = $request->file("variants.{$index}.image") ?? ($variant['image'] ?? null);

                if (!$imageFile) {
                    throw new \RuntimeException("Missing image for variant at index {$index}.");
                }

                $storedImage = $this->storeCatalogImage($imageFile);
                $storedImages[] = $storedImage;

                $productData = array_merge($commonData, [
                    'color' => trim((string) $variant['color']),
                    'price' => $variant['price'],
                    'stock' => $variant['stock'],
                    'image' => $storedImage,
                ]);

                $createdProducts[] = Products::create($productData);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Đã tạo các biến thể sản phẩm.',
                'data' => collect($createdProducts)
                    ->map(fn (Products $product) => $this->transformAdminProduct($product->fresh()->load('images')))
                    ->values(),
            ], 201);
        } catch (\Throwable $e) {
            DB::rollBack();

            if (!empty($storedImages ?? [])) {
                foreach ($storedImages as $storedImage) {
                    $this->deleteStoredImage($storedImage);
                }
            }

            return $this->adminErrorResponse('Không thể tạo sản phẩm', $e);
        }
    }

    public function createProduct(Request $request)
    {
        return $this->store($request);
    }

    public function updateProduct(Request $request, $id)
    {
        try {
            $product = Products::withTrashed()->with('images')->findOrFail($id);
            $validated = $this->validateAdminCatalogPayload($request, true);

            DB::beginTransaction();

            if ($request->hasFile('image')) {
                $this->deleteStoredImage($product->image);
                $validated['image'] = $this->storeCatalogImage($request->file('image'));
            }

            $product->update($validated);

            $removedIds = collect($request->input('removed_image_ids', []))->map(fn ($value) => (int) $value)->filter();
            if ($removedIds->isNotEmpty()) {
                $product->images->whereIn('id', $removedIds)->each(function ($image) {
                    $this->deleteStoredImage($image->image_url);
                    $image->delete();
                });
            }

            $this->attachProductImages($product, $request->file('images', []));

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Đã cập nhật sản phẩm.',
                'data' => $this->transformAdminProduct($product->fresh()->load('images')),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->adminErrorResponse('Không thể cập nhật sản phẩm', $e);
        }
    }

    public function deleteProduct($id)
    {
        try {
            $product = Products::withTrashed()->with('images')->findOrFail($id);

            $brand = $product->brand;
            $model = $product->model;

            $variantIds = Products::withTrashed()
                ->where('brand', $brand)
                ->where('model', $model)
                ->where('scale', $product->scale)
                ->where('description', $product->description)
                ->pluck('id');

            if ($this->hasBlockingActiveOrdersForProducts($variantIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không thể xóa nhóm sản phẩm vì đang tồn tại trong đơn hàng chưa hoàn tất (chờ xử lý, đã thanh toán, đang giao hàng).',
                ], 400);
            }

            DB::transaction(function () use ($variantIds) {
                Products::withTrashed()
                    ->whereIn('id', $variantIds)
                    ->update(['is_active' => false]);

                Products::whereIn('id', $variantIds)->delete();
            });

            return response()->json([
                'success' => true,
                'message' => 'Đã xóa mềm nhóm sản phẩm.',
            ]);
        } catch (\Exception $e) {
            return $this->adminErrorResponse('Không thể xóa sản phẩm', $e);
        }
    }

    public function uploadProductImages(Request $request, $id)
    {
        try {
            $product = Products::withTrashed()->findOrFail($id);
            $validated = $request->validate([
                'images' => ['required', 'array'],
                'images.*' => ['image', 'mimes:jpeg,png,jpg', 'max:2048'],
            ]);

            $this->attachProductImages($product, $request->file('images', []));

            return response()->json([
                'success' => true,
                'message' => 'Đã cập nhật bộ sưu tập ảnh sản phẩm.',
                'data' => $this->transformAdminProduct($product->fresh()->load('images')),
            ]);
        } catch (\Exception $e) {
            return $this->adminErrorResponse('Không thể tải ảnh sản phẩm lên', $e);
        }
    }

    public function getCoupons(Request $request)
    {
        return response()->json(['success' => true, 'data' => Coupon::orderByDesc('created_at')->get()]);
    }

    public function createCoupon(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9_-]+$/', 'unique:coupons,code'],
            'type' => 'required|in:fixed,percent',
            'discount' => 'required|numeric|min:0',
            'expiry_date' => 'nullable|date',
        ]);

        $validated['code'] = Str::upper(trim($validated['code']));

        if ($validated['type'] === 'percent' && $validated['discount'] > 100) {
            return response()->json([
                'success' => false,
                'message' => 'Mã giảm giá theo phần trăm không được vượt quá 100%.',
            ], 422);
        }

        return response()->json(['success' => true, 'data' => Coupon::create($validated)], 201);
    }

    public function updateCoupon(Request $request, $id)
    {
        $coupon = Coupon::findOrFail($id);
        $validated = $request->validate([
            'code' => ['sometimes', 'string', 'max:50', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('coupons', 'code')->ignore($coupon->id)],
            'type' => 'sometimes|in:fixed,percent',
            'discount' => 'sometimes|numeric|min:0',
            'expiry_date' => 'nullable|date',
        ]);

        if (array_key_exists('code', $validated)) {
            $validated['code'] = Str::upper(trim($validated['code']));
        }

        $couponType = $validated['type'] ?? $coupon->type;
        $couponDiscount = $validated['discount'] ?? $coupon->discount;

        if ($couponType === 'percent' && $couponDiscount > 100) {
            return response()->json([
                'success' => false,
                'message' => 'Mã giảm giá theo phần trăm không được vượt quá 100%.',
            ], 422);
        }

        $coupon->update($validated);
        return response()->json(['success' => true, 'data' => $coupon]);
    }

    public function deleteCoupon($id)
    {
        Coupon::findOrFail($id)->delete();
        return response()->json(['success' => true, 'message' => 'Đã xóa mã giảm giá.']);
    }

    public function getUsers(Request $request)
    {
        return response()->json(['success' => true, 'data' => User::orderByDesc('created_at')->paginate(20)]);
    }

    public function lockUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ((int) $request->user()->id === (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Bạn không thể khóa chính tài khoản admin đang đăng nhập.',
            ], 422);
        }

        $user->update(['is_active' => false]);
        return response()->json(['success' => true, 'message' => 'Đã khóa người dùng.']);
    }

    public function unlockUser($id)
    {
        $user = User::findOrFail($id);
        $user->update(['is_active' => true]);
        return response()->json(['success' => true, 'message' => 'Đã mở khóa người dùng.']);
    }

    public function getReturns(Request $request)
    {
        $query = ReturnModel::with(['order', 'user'])->orderByDesc('created_at');
        if ($request->filled('status') && $request->status !== 'all') $query->where('status', $request->status);
        if ($request->filled('request_type') && $request->request_type !== 'all') $query->where('request_type', $request->request_type);
        if ($request->filled('search')) {
            $keyword = $request->search;
            $query->where(function ($q) use ($keyword) {
                $q->where('reason', 'like', "%{$keyword}%")
                    ->orWhereHas('user', fn ($user) => $user->where('username', 'like', "%{$keyword}%")->orWhere('email', 'like', "%{$keyword}%"));
            });
        }

        return response()->json(['success' => true, 'data' => $query->paginate(20), 'summary' => ReturnModel::selectRaw('status, COUNT(*) total')->groupBy('status')->pluck('total', 'status')]);
    }

    public function updateReturnStatus(Request $request, $id)
    {
        $return = ReturnModel::findOrFail($id);
        $validated = $request->validate([
            'status' => 'required|in:pending,approved,rejected,completed',
            'resolution_note' => 'nullable|string|max:2000',
        ]);
        $return->update($validated);

        Notification::create([
            'user_id' => $return->user_id,
            'title' => "Yêu cầu hoàn tiền/đổi trả #{$return->id} đã cập nhật",
            'content' => $return->resolution_note ?: "Trạng thái mới: {$return->status}",
            'is_read' => false,
        ]);
        return response()->json(['success' => true, 'data' => $return]);
    }

    public function deleteReturn($id)
    {
        $return = ReturnModel::findOrFail($id);
        if ($return->image) Storage::disk('public')->delete($return->image);
        $return->delete();
        return response()->json(['success' => true, 'message' => 'Đã xóa yêu cầu hoàn tiền/đổi trả.']);
    }

    public function getReportKpis()
    {
        $orders = Order::query();
        $totalOrders = (clone $orders)->count();
        $revenueOrders = (clone $orders)->whereIn('status', self::REVENUE_ORDER_STATUSES);
        $revenue = (float) (clone $revenueOrders)->sum(DB::raw('total - discount'));
        $successfulPayments = Payment::where('status', 'success')->count();
        $totalPayments = Payment::count();

        return response()->json(['success' => true, 'data' => [
            'revenue' => $revenue,
            'average_order_value' => (clone $revenueOrders)->count() ? $revenue / (clone $revenueOrders)->count() : 0,
            'completion_rate' => $totalOrders ? round(Order::where('status', 'completed')->count() / $totalOrders * 100, 1) : 0,
            'cancellation_rate' => $totalOrders ? round(Order::where('status', 'cancelled')->count() / $totalOrders * 100, 1) : 0,
            'payment_success_rate' => $totalPayments ? round($successfulPayments / $totalPayments * 100, 1) : 0,
            'return_rate' => $totalOrders ? round(ReturnModel::count() / $totalOrders * 100, 1) : 0,
            'inventory_value' => (float) Products::whereNull('deleted_at')->sum(DB::raw('stock * price')),
            'pending_returns' => ReturnModel::where('status', 'pending')->count(),
        ]]);
    }

    public function getSystemNotifications()
    {
        $items = collect();
        Products::whereNull('deleted_at')->where('is_active', 1)->whereColumn('stock', '<=', 'low_stock_threshold')->orderBy('stock')->get()->each(function ($product) use ($items) {
            $items->push(['id' => "stock-{$product->id}", 'type' => 'low_stock', 'severity' => $product->stock <= 0 ? 'critical' : 'warning', 'title' => 'Sản phẩm sắp hết hàng', 'message' => "{$product->brand} {$product->model} chỉ còn {$product->stock} sản phẩm (ngưỡng {$product->low_stock_threshold}).", 'created_at' => $product->created_at]);
        });
        Payment::with('order.user')->where('status', 'failed')->get()->each(function ($payment) use ($items) {
            $items->push(['id' => "payment-{$payment->id}", 'type' => 'payment_failed', 'severity' => 'critical', 'title' => 'Thanh toán thất bại', 'message' => "Đơn #{$payment->order_id} · {$payment->order?->user?->username} · " . number_format((float) $payment->amount, 0, ',', '.') . '₫', 'created_at' => $payment->paid_at]);
        });
        Order::whereIn('status', ['pending', 'pending_payment', 'cod_pending'])->where('created_at', '<=', now()->subDay())->get()->each(function ($order) use ($items) {
            $items->push(['id' => "order-{$order->id}", 'type' => 'system', 'severity' => 'warning', 'title' => 'Đơn hàng xử lý quá hạn', 'message' => "Đơn #{$order->id} đang ở trạng thái {$order->status} quá 24 giờ.", 'created_at' => $order->created_at]);
        });
        ReturnModel::where('status', 'pending')->where('created_at', '<=', now()->subDays(2))->get()->each(function ($return) use ($items) {
            $items->push(['id' => "return-{$return->id}", 'type' => 'system', 'severity' => 'warning', 'title' => 'Yêu cầu đổi trả chờ lâu', 'message' => "Yêu cầu #{$return->id} của đơn #{$return->order_id} chưa xử lý sau 48 giờ.", 'created_at' => $return->created_at]);
        });

        return response()->json(['success' => true, 'data' => $items->sortByDesc('created_at')->values(), 'summary' => ['total' => $items->count(), 'critical' => $items->where('severity', 'critical')->count(), 'low_stock' => $items->where('type', 'low_stock')->count(), 'payment_failed' => $items->where('type', 'payment_failed')->count(), 'system' => $items->where('type', 'system')->count()]]);
    }

    public function getDashboardStats(Request $request)
    {
        try {
            $startDate = $request->input('start_date')
                ? Carbon::parse($request->input('start_date'))->startOfDay()
                : now()->subDays(30);
            $endDate = $request->input('end_date')
                ? Carbon::parse($request->input('end_date'))->endOfDay()
                : now();

            if ($startDate > $endDate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'
                ], 422);
            }

            $totalRevenue = Order::whereBetween('created_at', [$startDate, $endDate])
                ->whereIn('status', self::REVENUE_ORDER_STATUSES)
                ->sum(DB::raw('total - discount'));

            $totalOrders = Order::whereBetween('created_at', [$startDate, $endDate])->count();
            $totalCustomers = User::where('role', 'customer')->whereBetween('created_at', [$startDate, $endDate])->count();
            $orderStats = Order::query()
                ->whereBetween('created_at', [$startDate, $endDate])
                ->select('status', DB::raw('COUNT(*) as total'))
                ->groupBy('status')
                ->orderBy('status')
                ->pluck('total', 'status')
                ->map(fn ($total) => (int) $total)
                ->all();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_revenue' => $totalRevenue,
                    'total_orders' => $totalOrders,
                    'total_customers' => $totalCustomers,
                    'order_stats' => $orderStats,
                    'date_range' => [
                        'start' => $startDate->format('Y-m-d'),
                        'end' => $endDate->format('Y-m-d')
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể tải số liệu tổng quan: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getRevenueStats(Request $request)
    {
        try {
            $validated = $request->validate([
                'period' => ['nullable', Rule::in(['daily', 'weekly', 'monthly'])],
            ]);
            $period = $validated['period'] ?? 'monthly';
            $stats = [];

            if ($period === 'daily') {
                $stats = Order::whereIn('status', self::REVENUE_ORDER_STATUSES)
                    ->whereBetween('created_at', [now()->subDays(30), now()])
                    ->selectRaw('DATE(created_at) as date, SUM(total - discount) as revenue')
                    ->groupBy('date')
                    ->orderBy('date', 'asc')
                    ->get();
            } elseif ($period === 'weekly') {
                $stats = Order::whereIn('status', self::REVENUE_ORDER_STATUSES)
                    ->whereBetween('created_at', [now()->subMonths(3), now()])
                    ->selectRaw('WEEK(created_at) as week, YEAR(created_at) as year, SUM(total - discount) as revenue')
                    ->groupByRaw('YEAR(created_at), WEEK(created_at)')
                    ->orderByRaw('YEAR(created_at), WEEK(created_at)')
                    ->get();
            } else {
                $stats = Order::whereIn('status', self::REVENUE_ORDER_STATUSES)
                    ->whereBetween('created_at', [now()->subYear(), now()])
                    ->selectRaw('MONTH(created_at) as month, YEAR(created_at) as year, SUM(total - discount) as revenue')
                    ->groupByRaw('YEAR(created_at), MONTH(created_at)')
                    ->orderByRaw('YEAR(created_at), MONTH(created_at)')
                    ->get();
            }

            return response()->json(['success' => true, 'data' => $stats]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Không thể tải thống kê doanh thu: ' . $e->getMessage()], 500);
        }
    }

    public function getTopProducts()
    {
        try {
            $products = Products::query()
                ->join('order_items', 'products.id', '=', 'order_items.product_id')
                ->join('orders', 'order_items.order_id', '=', 'orders.id')
                ->whereIn('orders.status', self::REVENUE_ORDER_STATUSES)
                ->select(
                    'products.id',
                    'products.brand',
                    'products.model',
                    'products.scale',
                    'products.color',
                    'products.price',
                    'products.stock',
                    'products.image',
                    DB::raw('SUM(order_items.quantity) as total_quantity_sold'),
                    DB::raw('SUM(order_items.quantity * order_items.price) as total_revenue'),
                    DB::raw('MAX(orders.created_at) as last_sold_at')
                )
                ->groupBy(
                    'products.id',
                    'products.brand',
                    'products.model',
                    'products.scale',
                    'products.color',
                    'products.price',
                    'products.stock',
                    'products.image'
                )
                ->orderByDesc('total_quantity_sold')
                ->orderByDesc('total_revenue')
                ->limit(10)
                ->get();

            return response()->json(['success' => true, 'data' => $products]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Không thể tải sản phẩm bán chạy: ' . $e->getMessage()], 500);
        }
    }

    public function getLowStockProducts()
    {
        try {
            $products = Products::query()
                ->whereNull('deleted_at')
                ->where('is_active', 1)
                ->whereColumn('stock', '<=', 'low_stock_threshold')
                ->orderBy('stock')
                ->limit(10)
                ->get();

            return response()->json(['success' => true, 'data' => $products]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Không thể tải sản phẩm sắp hết hàng: ' . $e->getMessage()], 500);
        }
    }

    public function getStaleInventoryProducts()
    {
        try {
            $products = Products::query()
                ->leftJoin('order_items', 'products.id', '=', 'order_items.product_id')
                ->leftJoin('orders', function ($join) {
                    $join->on('order_items.order_id', '=', 'orders.id')
                        ->whereIn('orders.status', self::REVENUE_ORDER_STATUSES);
                })
                ->whereNull('products.deleted_at')
                ->where('products.is_active', 1)
                ->where('products.stock', '>', 0)
                ->select(
                    'products.id',
                    'products.brand',
                    'products.model',
                    'products.scale',
                    'products.color',
                    'products.price',
                    'products.stock',
                    'products.image',
                    'products.created_at',
                    DB::raw('COALESCE(SUM(CASE WHEN orders.id IS NOT NULL THEN order_items.quantity ELSE 0 END), 0) as total_quantity_sold'),
                    DB::raw('MAX(orders.created_at) as last_sold_at'),
                    DB::raw('DATEDIFF(CURDATE(), COALESCE(MAX(orders.created_at), products.created_at)) as idle_days')
                )
                ->groupBy(
                    'products.id',
                    'products.brand',
                    'products.model',
                    'products.scale',
                    'products.color',
                    'products.price',
                    'products.stock',
                    'products.image',
                    'products.created_at'
                )
                ->orderByDesc('idle_days')
                ->orderByDesc('products.stock')
                ->limit(10)
                ->get();

            return response()->json(['success' => true, 'data' => $products]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Không thể tải sản phẩm tồn kho lâu ngày: ' . $e->getMessage()], 500);
        }
    }

    public function exportReport(Request $request)
    {
        $validated = $request->validate([
            'type' => ['nullable', Rule::in(['orders', 'returns', 'payments', 'products', 'customers'])],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ]);

        $type = $validated['type'] ?? 'orders';
        return Excel::download(new AdminSystemReportExport($type, $validated['start_date'] ?? null, $validated['end_date'] ?? null), "bao-cao-{$type}-" . now()->format('Ymd-His') . '.xlsx');
    }
}
