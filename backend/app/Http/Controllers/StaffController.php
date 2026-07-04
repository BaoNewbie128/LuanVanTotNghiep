<?php

namespace App\Http\Controllers;

use App\Imports\StaffProductStockImport;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Post;
use App\Models\Products;
use App\Models\Returns as ReturnModel;
use App\Models\Shipment;
use App\Models\StockExport;
use App\Models\StockExportItem;
use App\Models\StockImport;
use App\Models\StockImportItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StaffController extends Controller
{
    private const STATUS_TRANSITIONS = [
        'pending' => ['paid', 'cancelled'],
        'pending_payment' => ['paid', 'cancelled'],
        'cod_pending' => ['shipping', 'cancelled'],
        'paid' => ['shipping', 'cancelled'],
        'shipping' => ['completed'],
        'completed' => [],
        'cancelled' => [],
    ];

    public function getOrders(Request $request)
    {
        try {
            $status = $request->input('status');
            $search = $request->input('search');
            $perPage = (int) $request->input('per_page', 15);
            $perPage = max(1, min($perPage, 100));
            $validStatuses = ['pending', 'paid', 'shipping', 'completed', 'cancelled', 'pending_payment', 'cod_pending'];

            $query = Order::with(['user', 'items.product', 'payment', 'shipment']);

            if ($status && in_array($status, $validStatuses, true)) {
                $query->where('status', $status);
            }

            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('id', $search)
                        ->orWhereHas('user', function ($user) use ($search) {
                            $user->where('username', 'like', "%{$search}%")
                                ->orWhere('email', 'like', "%{$search}%");
                        });
                });
            }

            $orders = $query->orderByDesc('created_at')->paginate($perPage);
            $orders->getCollection()->transform(function (Order $order) {
                $order->allowed_transitions = self::STATUS_TRANSITIONS[$order->status] ?? [];

                return $order;
            });

            $summary = [
                'total' => Order::count(),
                'pending' => Order::where('status', 'pending')->count(),
                'paid' => Order::where('status', 'paid')->count(),
                'shipping' => Order::where('status', 'shipping')->count(),
                'completed' => Order::where('status', 'completed')->count(),
                'cancelled' => Order::where('status', 'cancelled')->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => $orders,
                'summary' => $summary,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch orders: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateOrderStatus(Request $request, int $id)
    {
        try {
            $order = Order::with('shipment', 'user')->findOrFail($id);

            $validated = $request->validate([
                'status' => 'required|in:pending,paid,shipping,completed,cancelled,pending_payment,cod_pending'
            ]);

            $currentStatus = $order->status;
            $nextStatus = $validated['status'];

            if ($currentStatus === $nextStatus) {
                return response()->json([
                    'success' => true,
                    'message' => 'Order status is already up to date.',
                    'data' => $order,
                    'allowed_transitions' => self::STATUS_TRANSITIONS[$currentStatus] ?? [],
                ]);
            }

            $allowedTransitions = self::STATUS_TRANSITIONS[$currentStatus] ?? [];

            if (!in_array($nextStatus, $allowedTransitions, true)) {
                return response()->json([
                    'success' => false,
                    'message' => "Invalid status transition from {$currentStatus} to {$nextStatus}.",
                    'allowed_transitions' => $allowedTransitions,
                ], 422);
            }

            if ($nextStatus === 'shipping' && !$order->shipment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot move order to shipping before a shipment is created.',
                    'allowed_transitions' => $allowedTransitions,
                ], 422);
            }

            $order->update($validated);
            $order->refresh();

            Notification::create([
                'user_id' => $order->user_id,
                'title' => 'Cập nhật trạng thái đơn hàng',
                'content' => "Đơn hàng #{$order->id} của bạn đã được chuyển sang trạng thái: {$nextStatus}",
                'is_read' => 0,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Order status updated successfully',
                'data' => $order,
                'allowed_transitions' => self::STATUS_TRANSITIONS[$order->status] ?? [],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update order status: ' . $e->getMessage()
            ], 422);
        }
    }

    public function getStockStatus(Request $request)
    {
        try {
            $validated = $request->validate([
                'threshold' => ['nullable', 'integer', 'min:1'],
                'page' => ['nullable', 'integer', 'min:1'],
                'brand' => ['nullable', 'string', 'max:50'],
                'color' => ['nullable', 'string', 'max:100'],
                'search' => ['nullable', 'string', 'max:255'],
                'stock_status' => ['nullable', 'in:low,medium,high'],
            ]);

            $threshold = (int) ($validated['threshold'] ?? 5);
            $search = trim((string) ($validated['search'] ?? ''));
            $brand = trim((string) ($validated['brand'] ?? ''));
            $color = trim((string) ($validated['color'] ?? ''));
            $stockStatus = $validated['stock_status'] ?? null;

            $stockStatusSql = 'CASE WHEN stock <= COALESCE(low_stock_threshold, ?) THEN "low" WHEN stock <= COALESCE(low_stock_threshold, ?) * 2 THEN "medium" ELSE "high" END';

            $products = Products::where('is_active', 1)
                ->selectRaw("products.*, {$stockStatusSql} as stock_status", [$threshold, $threshold]);

            if ($brand !== '') {
                $products->where('brand', $brand);
            }

            if ($color !== '') {
                $products->where('color', $color);
            }

            if ($search !== '') {
                $keywords = collect(preg_split('/\s+/', Str::lower($search), -1, PREG_SPLIT_NO_EMPTY))
                    ->map(fn ($keyword) => trim($keyword))
                    ->filter()
                    ->values();

                foreach ($keywords as $keyword) {
                    $products->where(function ($query) use ($keyword) {
                        $query->whereRaw('LOWER(brand) LIKE ?', ["%{$keyword}%"])
                            ->orWhereRaw('LOWER(model) LIKE ?', ["%{$keyword}%"])
                            ->orWhereRaw('LOWER(color) LIKE ?', ["%{$keyword}%"])
                            ->orWhereRaw('LOWER(scale) LIKE ?', ["%{$keyword}%"])
                            ->orWhereRaw('CAST(id AS CHAR) LIKE ?', ["%{$keyword}%"]);
                    });
                }
            }

            if ($stockStatus) {
                $products->having('stock_status', '=', $stockStatus);
            }

            $products = $products
                ->orderBy('stock', 'asc')
                ->paginate(20)
                ->appends($request->query());

            $filters = [
                'brands' => Products::where('is_active', 1)
                    ->whereNotNull('brand')
                    ->distinct()
                    ->orderBy('brand')
                    ->pluck('brand')
                    ->values(),
                'colors' => Products::where('is_active', 1)
                    ->whereNotNull('color')
                    ->distinct()
                    ->orderBy('color')
                    ->pluck('color')
                    ->values(),
            ];

            return response()->json([
                'success' => true,
                'data' => $products,
                'filters' => $filters,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch stock status: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getStockProductOptions()
    {
        try {
            $products = Products::query()
                ->where('is_active', 1)
                ->whereNull('deleted_at')
                ->select(['id', 'brand', 'model', 'color', 'scale', 'image', 'stock'])
                ->orderBy('brand')
                ->orderBy('model')
                ->orderBy('color')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $products,
                'total' => $products->count(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch stock product options: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function importStock(Request $request)
    {
        try {
            $validated = $request->validate([
                'items' => 'required|array',
                'items.*.product_id' => 'required|integer|exists:products,id',
                'items.*.quantity' => 'required|integer|min:1',
                'items.*.import_price' => 'required|numeric|min:0',
                'note' => 'nullable|string'
            ]);

            DB::beginTransaction();

            $stockImport = StockImport::create([
                'staff_id' => Auth::id(),
                'note' => $validated['note'] ?? null
            ]);

            foreach ($validated['items'] as $item) {
                StockImportItem::create([
                    'import_id' => $stockImport->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'import_price' => $item['import_price']
                ]);

                $product = Products::findOrFail($item['product_id']);
                $product->increment('stock', $item['quantity']);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Stock imported successfully',
                'data' => $stockImport
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to import stock: ' . $e->getMessage()
            ], 422);
        }
    }

    public function exportStock(Request $request)
    {
        try {
            $validated = $request->validate([
                'items' => 'required|array',
                'items.*.product_id' => 'required|integer|exists:products,id',
                'items.*.quantity' => 'required|integer|min:1',
                'note' => 'nullable|string'
            ]);

            DB::beginTransaction();

            $stockExport = StockExport::create([
                'staff_id' => Auth::id(),
                'note' => $validated['note'] ?? null
            ]);

            foreach ($validated['items'] as $item) {
                $product = Products::findOrFail($item['product_id']);

                if ($product->stock < $item['quantity']) {
                    throw new \Exception("Insufficient stock for product {$product->model}");
                }

                StockExportItem::create([
                    'export_id' => $stockExport->id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity']
                ]);

                $product->decrement('stock', $item['quantity']);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Stock exported successfully',
                'data' => $stockExport
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to export stock: ' . $e->getMessage()
            ], 422);
        }
    }

    public function getStockMovements(Request $request)
    {
        try {
            $imports = StockImport::with(['items.product', 'staff'])
                ->orderByDesc('created_at')
                ->get()
                ->map(function (StockImport $import) {
                    return [
                        'id' => $import->id,
                        'type' => 'import',
                        'note' => $import->note,
                        'created_at' => $import->created_at,
                        'staff' => $import->staff,
                        'items' => $import->items,
                    ];
                });

            $exports = StockExport::with(['items.product', 'staff'])
                ->orderByDesc('created_at')
                ->get()
                ->map(function (StockExport $export) {
                    return [
                        'id' => $export->id,
                        'type' => 'export',
                        'note' => $export->note,
                        'created_at' => $export->created_at,
                        'staff' => $export->staff,
                        'items' => $export->items,
                    ];
                });

            $movements = $imports
                ->concat($exports)
                ->sortByDesc('created_at')
                ->values();

            return response()->json([
                'success' => true,
                'data' => $movements,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch stock movements: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getOperationalNotifications(Request $request)
    {
        try {
            $thresholdHours = (int) $request->input('pending_hours', 24);

            $lowStockProducts = Products::where('is_active', 1)
                ->whereColumn('stock', '<=', 'low_stock_threshold')
                ->orderBy('stock', 'asc')
                ->get()
                ->map(function (Products $product) {
                    return [
                        'id' => 'low-stock-' . $product->id,
                        'type' => 'low_stock',
                        'title' => 'Cảnh báo tồn kho thấp',
                        'message' => "{$product->brand} {$product->model} chỉ còn {$product->stock} sản phẩm trong kho.",
                        'created_at' => $product->created_at,
                        'metadata' => [
                            'product_id' => $product->id,
                            'stock' => $product->stock,
                            'low_stock_threshold' => $product->low_stock_threshold,
                        ],
                    ];
                });

            $pendingOrders = Order::with('user')
                ->whereIn('status', ['pending', 'pending_payment', 'cod_pending'])
                ->where('created_at', '<=', now()->subHours($thresholdHours))
                ->orderBy('created_at', 'asc')
                ->get()
                ->map(function (Order $order) {
                    $statusLabel = match ($order->status) {
                        'pending' => 'chờ xử lý',
                        'pending_payment' => 'chờ thanh toán',
                        'cod_pending' => 'chờ xác nhận COD',
                        default => $order->status,
                    };

                    return [
                        'id' => 'pending-order-' . $order->id,
                        'type' => 'pending_order',
                        'title' => 'Đơn hàng chờ xử lý quá lâu',
                        'message' => "Đơn #{$order->id} của {$order->user?->username} đang ở trạng thái {$statusLabel} quá thời gian xử lý.",
                        'created_at' => $order->created_at,
                        'metadata' => [
                            'order_id' => $order->id,
                            'status' => $order->status,
                            'customer' => $order->user?->username,
                        ],
                    ];
                });

            $shipmentIssues = Order::with(['shipment', 'user'])
                ->whereIn('status', ['paid', 'shipping'])
                ->orderBy('created_at', 'desc')
                ->get()
                ->filter(function (Order $order) {
                    if ($order->status === 'paid') {
                        return !$order->shipment;
                    }

                    return $order->status === 'shipping'
                        && (!$order->shipment || empty($order->shipment->tracking_code));
                })
                ->map(function (Order $order) {
                    $message = $order->status === 'paid'
                        ? "Đơn #{$order->id} chưa được tạo vận đơn dù đã thanh toán."
                        : "Đơn #{$order->id} đang giao nhưng thiếu mã theo dõi hợp lệ.";

                    return [
                        'id' => 'shipment-issue-' . $order->id,
                        'type' => 'shipment_issue',
                        'title' => 'Cảnh báo vận chuyển',
                        'message' => $message,
                        'created_at' => $order->created_at,
                        'metadata' => [
                            'order_id' => $order->id,
                            'status' => $order->status,
                            'customer' => $order->user?->username,
                        ],
                    ];
                });

            $notifications = $lowStockProducts
                ->concat($pendingOrders)
                ->concat($shipmentIssues)
                ->sortByDesc('created_at')
                ->values();

            return response()->json([
                'success' => true,
                'data' => $notifications,
                'summary' => [
                    'total' => $notifications->count(),
                    'low_stock' => $lowStockProducts->count(),
                    'pending_order' => $pendingOrders->count(),
                    'shipment_issue' => $shipmentIssues->count(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch operational notifications: ' . $e->getMessage()
            ], 500);
        }
    }

    public function importExcel(Request $request)
    {
        try {
            $request->validate([
                'file' => 'required|file|mimes:xlsx,xls,csv'
            ]);

            Excel::import(new StaffProductStockImport(), $request->file('file'));

            return response()->json([
                'success' => true,
                'message' => 'Excel import completed successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to import Excel: ' . $e->getMessage()
            ], 422);
        }
    }

    public function createShipment(Request $request)
    {
        try {
            $request->merge([
                'carrier' => trim((string) $request->input('carrier')),
                'tracking_code' => Str::upper(trim((string) $request->input('tracking_code'))),
            ]);

            $validated = $request->validate([
                'order_id' => 'required|integer|exists:orders,id',
                'carrier' => 'required|string|max:100',
                'tracking_code' => ['required', 'string', 'max:100', 'regex:/^[A-Z0-9._-]+$/', 'unique:shipments,tracking_code'],
            ], [
                'carrier.required' => 'Vui lòng chọn đơn vị vận chuyển.',
                'tracking_code.required' => 'Vui lòng nhập mã theo dõi.',
                'tracking_code.regex' => 'Mã theo dõi chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.',
                'tracking_code.unique' => 'Mã theo dõi này đã được sử dụng cho vận đơn khác.',
            ]);

            $order = Order::with('shipment', 'user')->findOrFail($validated['order_id']);

            if ($order->shipment) {
                return response()->json([
                    'success' => false,
                    'message' => 'Đơn hàng này đã có vận đơn. Vui lòng chỉnh sửa vận đơn hiện tại.',
                    'data' => $order->shipment,
                ], 422);
            }

            if (!in_array($order->status, ['paid', 'cod_pending'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Chỉ có thể tạo vận đơn cho đơn đã thanh toán hoặc đang chờ xác nhận COD.',
                ], 422);
            }

            [$shipment, $order] = DB::transaction(function () use ($validated, $order) {

                $shipment = Shipment::create([
                    'order_id' => $validated['order_id'],
                    'carrier' => $validated['carrier'],
                    'tracking_code' => $validated['tracking_code'],
                    'shipped_at' => now(),
                ]);

                $order->update(['status' => 'shipping']);
                Notification::create([
                    'user_id' => $order->user_id,
                    'title' => 'Đơn hàng đang được giao',
                    'content' => "Đơn #{$order->id} đã được bàn giao cho {$shipment->carrier}. Mã theo dõi: {$shipment->tracking_code}.",
                    'is_read' => false,
                    'created_at' => now(),
                ]);

                $order->refresh()->load(['shipment', 'user', 'items.product']);
                $order->allowed_transitions = self::STATUS_TRANSITIONS[$order->status] ?? [];

                return [$shipment, $order];
            });

            return response()->json([
                'success' => true,
                'message' => 'Đã tạo vận đơn và chuyển đơn hàng sang trạng thái đang giao.',
                'data' => [
                    'shipment' => $shipment,
                    'order' => $order,
                ]
            ], 201);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể tạo vận đơn: ' . $e->getMessage()
            ], 422);
        }
    }

    public function updateShipment(Request $request, int $id)
    {
        try {
            if ($request->has('tracking_code')) {
                $request->merge(['tracking_code' => Str::upper(trim((string) $request->input('tracking_code')))]);
            }
            if ($request->has('carrier')) {
                $request->merge(['carrier' => trim((string) $request->input('carrier'))]);
            }

            $shipment = Shipment::with('order.user')->findOrFail($id);

            $validated = $request->validate([
                'tracking_code' => ['sometimes', 'string', 'max:100', 'regex:/^[A-Z0-9._-]+$/', 'unique:shipments,tracking_code,' . $shipment->id],
                'carrier' => 'sometimes|string|max:100',
                'delivered_at' => 'sometimes|date'
            ], [
                'tracking_code.regex' => 'Mã theo dõi chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.',
                'tracking_code.unique' => 'Mã theo dõi này đã được sử dụng cho vận đơn khác.',
                'delivered_at.date' => 'Thời điểm giao hàng không hợp lệ.',
            ]);

            DB::transaction(function () use ($shipment, $validated) {
                $shipment->update($validated);

                if (isset($validated['delivered_at'])) {
                    $shipment->order->update(['status' => 'completed']);
                    Notification::create([
                        'user_id' => $shipment->order->user_id,
                        'title' => 'Đơn hàng đã giao thành công',
                        'content' => "Đơn #{$shipment->order_id} đã được xác nhận giao thành công.",
                        'is_read' => false,
                        'created_at' => now(),
                    ]);
                } elseif (isset($validated['tracking_code']) || isset($validated['carrier'])) {
                    Notification::create([
                        'user_id' => $shipment->order->user_id,
                        'title' => 'Cập nhật thông tin vận chuyển',
                        'content' => "Đơn #{$shipment->order_id}: {$shipment->carrier} - mã theo dõi {$shipment->tracking_code}.",
                        'is_read' => false,
                        'created_at' => now(),
                    ]);
                }
            });

            $shipment->refresh()->load('order.user');
            $shipment->order->allowed_transitions = self::STATUS_TRANSITIONS[$shipment->order->status] ?? [];

            return response()->json([
                'success' => true,
                'message' => isset($validated['delivered_at']) ? 'Đã xác nhận giao hàng thành công.' : 'Đã cập nhật vận đơn.',
                'data' => $shipment
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Không thể cập nhật vận đơn: ' . $e->getMessage()
            ], 422);
        }
    }

    public function getShipments(Request $request)
    {
        try {
            $shipments = Shipment::with('order')->paginate(15);

            return response()->json([
                'success' => true,
                'data' => $shipments
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch shipments: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getReturns(Request $request)
    {
        try {
            $query = ReturnModel::with(['user', 'order'])->orderByDesc('created_at');
            if ($request->filled('status') && $request->status !== 'all') $query->where('status', $request->status);
            $returns = $query->paginate(15);

            return response()->json([
                'success' => true,
                'data' => $returns
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch returns: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateReturnStatus(Request $request, int $id)
    {
        try {
            $return = ReturnModel::findOrFail($id);
            $validated = $request->validate([
                'status' => 'required|in:pending,approved,rejected,completed',
                'resolution_note' => 'nullable|string|max:2000',
            ]);

            $return->update($validated);

            $typeLabel = match ($return->request_type) {
                'refund' => 'hoàn tiền',
                'exchange' => 'đổi hàng',
                default => 'trả hàng',
            };
            $statusLabel = match ($return->status) {
                'approved' => 'đã được duyệt',
                'rejected' => 'đã bị từ chối',
                'completed' => 'đã hoàn tất',
                default => 'đang chờ xử lý',
            };
            Notification::create([
                'user_id' => $return->user_id,
                'title' => "Yêu cầu {$typeLabel} #{$return->id} {$statusLabel}",
                'content' => $return->resolution_note ?: "Yêu cầu cho đơn hàng #{$return->order_id} {$statusLabel}.",
                'is_read' => false,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Return status updated successfully',
                'data' => $return
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update return status: ' . $e->getMessage()
            ], 422);
        }
    }

    public function getPosts(Request $request)
    {
        try {
            $posts = Post::with(['category', 'tags'])->orderByDesc('created_at')->paginate(15);
            $posts->getCollection()->transform(function (Post $post) {
                $post->thumbnail_url = $this->resolveThumbnailUrl($post->thumbnail);

                return $post;
            });

            return response()->json([
                'success' => true,
                'data' => $posts
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch posts: ' . $e->getMessage()
            ], 500);
        }
    }

    public function createPost(Request $request)
    {
        try {
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'slug' => 'nullable|string|max:255|unique:posts,slug',
                'content' => 'required|string',
                'thumbnail' => 'nullable',
                'meta_title' => 'nullable|string|max:255',
                'meta_description' => 'nullable|string|max:500',
                'blog_category_id' => 'nullable|integer|exists:blog_categories,id',
                'tags' => 'nullable|array',
                'tags.*' => 'string|max:100',
                'status' => 'required|in:published,draft'
            ]);

            $validated['slug'] = $this->generateUniquePostSlug($validated['slug'] ?? null, $validated['title']);

            if (is_string($validated['thumbnail'] ?? null)) {
                $validated['thumbnail'] = trim($validated['thumbnail']);
            }

            if ($request->hasFile('thumbnail')) {
                $validated['thumbnail'] = $this->storePostThumbnail($request->file('thumbnail'));
            }

            $post = Post::create($validated);
            $this->syncPostTags($post, $validated['tags'] ?? []);
            $post->load(['category', 'tags']);
            $post->thumbnail_url = $this->resolveThumbnailUrl($post->thumbnail);

            return response()->json([
                'success' => true,
                'message' => 'Post created successfully',
                'data' => $post
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create post: ' . $e->getMessage()
            ], 422);
        }
    }

    public function updatePost(Request $request, int $id)
    {
        try {
            $post = Post::findOrFail($id);
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'slug' => 'nullable|string|max:255|unique:posts,slug,' . $post->id,
                'content' => 'sometimes|string',
                'thumbnail' => 'nullable',
                'meta_title' => 'nullable|string|max:255',
                'meta_description' => 'nullable|string|max:500',
                'blog_category_id' => 'nullable|integer|exists:blog_categories,id',
                'tags' => 'nullable|array',
                'tags.*' => 'string|max:100',
                'status' => 'sometimes|in:published,draft'
            ]);

            $validated['slug'] = $this->generateUniquePostSlug(
                $validated['slug'] ?? $post->slug,
                $validated['title'] ?? $post->title,
                $post->id
            );

            if (is_string($validated['thumbnail'] ?? null)) {
                $validated['thumbnail'] = trim($validated['thumbnail']);
            }

            if ($request->hasFile('thumbnail')) {
                $this->deletePostThumbnail($post->thumbnail);
                $validated['thumbnail'] = $this->storePostThumbnail($request->file('thumbnail'));
            }

            $post->update($validated);
            $this->syncPostTags($post, $validated['tags'] ?? $post->tags->pluck('name')->all());
            $post->refresh();
            $post->load(['category', 'tags']);
            $post->thumbnail_url = $this->resolveThumbnailUrl($post->thumbnail);

            return response()->json([
                'success' => true,
                'message' => 'Post updated successfully',
                'data' => $post
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update post: ' . $e->getMessage()
            ], 422);
        }
    }

    public function deletePost(int $id)
    {
        try {
            $post = Post::findOrFail($id);

            $this->deletePostThumbnail($post->thumbnail);

            $post->delete();

            return response()->json([
                'success' => true,
                'message' => 'Post deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete post: ' . $e->getMessage()
            ], 422);
        }
    }

    private function generateUniquePostSlug(?string $slug, string $title, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($slug ?: $title);
        $baseSlug = $baseSlug !== '' ? $baseSlug : 'post';
        $candidate = $baseSlug;
        $counter = 1;

        while (Post::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('slug', $candidate)
            ->exists()) {
            $candidate = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $candidate;
    }

    private function resolveThumbnailUrl(?string $thumbnail): ?string
    {
        if (!$thumbnail) {
            return null;
        }

        if (Str::startsWith($thumbnail, ['http://', 'https://', '/storage/', '/images/'])) {
            return $thumbnail;
        }

        if (!Str::contains($thumbnail, '/')) {
            return '/images/' . ltrim($thumbnail, '/');
        }

        return Storage::url($thumbnail);
    }

    private function storePostThumbnail($file): string
    {
        $filename = time() . '_' . preg_replace('/\s+/', '_', $file->getClientOriginalName());
        return $file->storeAs('posts', $filename, 'public');
    }

    private function deletePostThumbnail(?string $thumbnail): void
    {
        if (!$thumbnail) {
            return;
        }

        if (Storage::disk('public')->exists($thumbnail)) {
            Storage::disk('public')->delete($thumbnail);
            return;
        }

        $basename = basename($thumbnail);
        $legacyPaths = [
            dirname(base_path()) . DIRECTORY_SEPARATOR . 'frontend' . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'images' . DIRECTORY_SEPARATOR . $basename,
            public_path('images/' . $basename),
        ];
        foreach ($legacyPaths as $legacyPath) {
            if (File::exists($legacyPath)) File::delete($legacyPath);
        }
    }

    private function syncPostTags(Post $post, array $tags): void
    {
        $tagIds = collect($tags)
            ->map(fn ($tag) => trim((string) $tag))
            ->filter()
            ->unique()
            ->map(function (string $tagName) {
                $tag = BlogTag::firstOrCreate(
                    ['slug' => Str::slug($tagName)],
                    ['name' => $tagName]
                );

                return $tag->id;
            })
            ->values()
            ->all();

        $post->tags()->sync($tagIds);
    }

    public function getBlogTaxonomy()
    {
        try {
            return response()->json([
                'success' => true,
                'data' => [
                    'categories' => BlogCategory::orderBy('name')->get(),
                    'tags' => BlogTag::orderBy('name')->get(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch blog taxonomy: ' . $e->getMessage(),
            ], 500);
        }
    }
}
