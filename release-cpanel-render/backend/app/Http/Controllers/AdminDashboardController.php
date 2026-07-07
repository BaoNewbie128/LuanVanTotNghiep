<?php

namespace App\Http\Controllers;

use App\Models\Orders;
use App\Models\Products;
use App\Models\Users;
use App\Models\Payments;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    // Get dashboard statistics
    public function getDashboardStats()
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Revenue statistics
            $totalRevenue = Orders::where('status', 'paid')
                ->orWhere('status', 'completed')
                ->sum('total');

            $monthlyRevenue = Orders::where('status', 'paid')
                ->orWhere('status', 'completed')
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->sum('total');

            // Order statistics
            $totalOrders = Orders::count();
            $pendingOrders = Orders::where('status', 'pending')
                ->orWhere('status', 'pending_payment')
                ->count();
            $completedOrders = Orders::where('status', 'completed')->count();

            // Product statistics
            $totalProducts = Products::where('is_active', 1)->count();
            $lowStockProducts = Products::where('stock', '<', DB::raw('low_stock_threshold'))
                ->where('is_active', 1)
                ->count();

            // Top selling products
            $topProducts = DB::table('order_items')
                ->join('products', 'order_items.product_id', '=', 'products.id')
                ->select('products.id', 'products.model', 'products.brand', DB::raw('SUM(order_items.quantity) as total_sold'))
                ->groupBy('products.id', 'products.model', 'products.brand')
                ->orderBy('total_sold', 'desc')
                ->limit(5)
                ->get();

            // Long unsold products
            $longUnsoldProducts = Products::where('is_active', 1)
                ->where('sold_count', 0)
                ->orderBy('created_at', 'asc')
                ->limit(5)
                ->get();

            // User statistics
            $totalUsers = Users::where('role', 'customer')->count();
            $newUsersThisMonth = Users::where('role', 'customer')
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count();

            return response()->json([
                'revenue' => [
                    'total' => $totalRevenue,
                    'monthly' => $monthlyRevenue
                ],
                'orders' => [
                    'total' => $totalOrders,
                    'pending' => $pendingOrders,
                    'completed' => $completedOrders
                ],
                'products' => [
                    'total' => $totalProducts,
                    'low_stock' => $lowStockProducts
                ],
                'top_products' => $topProducts,
                'long_unsold_products' => $longUnsoldProducts,
                'users' => [
                    'total' => $totalUsers,
                    'new_this_month' => $newUsersThisMonth
                ]
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get revenue chart data
    public function getRevenueChart(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $period = $request->query('period', 'month'); // month, year, week
            $year = $request->query('year', now()->year);
            $month = $request->query('month', now()->month);
            $data = []; 
            if ($period === 'month') {
                $data = DB::table('orders')
                    ->select(DB::raw('DAY(created_at) as day'), DB::raw('SUM(total) as revenue'))
                    ->where(function($query){
              $query->where('status', 'paid')
                    ->orWhere('status', 'completed');
                    })
                    ->whereMonth('created_at', $month)
                    ->whereYear('created_at', $year)
                    ->groupBy(DB::raw('DAY(created_at)'))
                    ->get();
            } elseif ($period === 'year') {
                $data = DB::table('orders')
                    ->select(DB::raw('MONTH(created_at) as month'), DB::raw('SUM(total) as revenue'))
                    ->where('status', 'paid')
                    ->orWhere('status', 'completed')
                    ->whereYear('created_at', $year)
                    ->groupBy(DB::raw('MONTH(created_at)'))
                    ->get();
            }

            return response()->json($data, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get order status distribution
    public function getOrderStatusDistribution()
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $distribution = DB::table('orders')
                ->select('status', DB::raw('COUNT(*) as count'))
                ->groupBy('status')
                ->get();

            return response()->json($distribution, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get payment method distribution
    public function getPaymentMethodDistribution()
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $distribution = DB::table('payments')
                ->select('payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as total'))
                ->groupBy('payment_method')
                ->get();

            return response()->json($distribution, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Export report to Excel
    public function exportReport(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $type = $request->query('type', 'orders'); // orders, products, users, revenue
            $startDate = $request->query('start_date');
            $endDate = $request->query('end_date');

            $query = null;

            if ($type === 'orders') {
                $query = Orders::query();
                if ($startDate && $endDate) {
                    $query->whereBetween('created_at', [$startDate, $endDate]);
                }
                $data = $query->get();
            } elseif ($type === 'products') {
                $query = Products::where('is_active', 1);
                $data = $query->get();
            } elseif ($type === 'users') {
                $query = Users::where('role', 'customer');
                if ($startDate && $endDate) {
                    $query->whereBetween('created_at', [$startDate, $endDate]);
                }
                $data = $query->get();
            } elseif ($type === 'revenue') {
                $query = Orders::where('status', 'paid')
                    ->orWhere('status', 'completed');
                if ($startDate && $endDate) {
                    $query->whereBetween('created_at', [$startDate, $endDate]);
                }
                $data = $query->get();
            }

            // Return CSV format
            $filename = $type . '_' . now()->format('Y-m-d_H-i-s') . '.csv';
            $headers = [
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"'
            ];

            return response()->json([
                'message' => 'Export data prepared',
                'data' => $data,
                'filename' => $filename
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
