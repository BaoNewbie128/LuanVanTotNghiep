<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\WishlistController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\ReturnController;
use App\Http\Controllers\ShipmentController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SupportController;
use App\Http\Controllers\SupportTicketController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\AIChatController;

// Public routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/auth/verify-otp', [AuthController::class, 'verifyOTP']);
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);
Route::post('/auth/verify-email', [AuthController::class, 'verifyEmail']);
Route::post('/auth/resend-otp', [AuthController::class, 'resendOTP']);
Route::get('/faqs', [SupportController::class, 'faqs']);
Route::post('/support', [SupportController::class, 'store']);
Route::post('/support-tickets', [SupportController::class, 'store']);
Route::post('/ai/chat', [AIChatController::class, 'chat'])->middleware('throttle:20,1');

// Payment providers call these URLs without the customer's login token.
Route::match(['get', 'post'], '/payments/momo/callback', [PaymentController::class, 'momoCallback']);
Route::post('/payments/momo/notify', [PaymentController::class, 'momoNotify']);
Route::match(['get', 'post'], '/payments/vnpay/callback', [PaymentController::class, 'vnpayCallback']);

// Guest cart routes (public - no auth required)
Route::post('/cart/add-guest', [CartController::class, 'addToCartGuest']);

// Guest/auth wishlist read routes (public methods support Session for guests)
Route::get('/wishlist', [WishlistController::class, 'getWishlist']);
Route::get('/wishlist/check/{productId}', [WishlistController::class, 'check']);
Route::get('/wishlist/count', [WishlistController::class, 'count']);
Route::post('/wishlist/add', [WishlistController::class, 'addToWishlist']);
Route::delete('/wishlist/remove/{productId}', [WishlistController::class, 'removeFromWishlist']);
Route::delete('/wishlist/{productId}', [WishlistController::class, 'removeFromWishlist']);

// Product routes (public)
Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/search/filter', [ProductController::class, 'filter']);
Route::get('/products/{id}', [ProductController::class, 'show']);
Route::get('/products/{id}/reviews', [ProductController::class, 'getReviews']);
Route::get('/products/{id}/recommendations', [ProductController::class, 'getRecommendations']);
Route::get('/products/{id}/variants', [ProductController::class, 'getColorVariants']);
Route::get('/filters', [ProductController::class, 'getFilters']);

// Blog routes (public)
Route::get('/posts', [PostController::class, 'index']);
Route::get('/posts/slug/{slug}', [PostController::class, 'showBySlug']);

// Search routes (public)
Route::get('/search', [SearchController::class, 'search']);
Route::get('/search/suggestions', [SearchController::class, 'suggestions']);
Route::get('/search/trending', [SearchController::class, 'trendingSearches']);
Route::post('/search/semantic', [SearchController::class, 'semanticSearch']);
Route::post('/search/visual', [SearchController::class, 'visualSearch']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);

    // User profile routes
    Route::get('/user/profile', [UserController::class, 'getProfile']);
    Route::put('/user/profile', [UserController::class, 'updateProfile']);
    Route::put('/user/password', [UserController::class, 'changePassword']);
    Route::get('/support-tickets/mine', [SupportTicketController::class, 'mine']);

// Cart routes
Route::get('/cart', [CartController::class, 'getCart']);
Route::post('/cart/add', [CartController::class, 'addToCart']);
Route::post('/cart/merge', [CartController::class, 'mergeGuestCart']);
Route::put('/cart/update/{itemId}', [CartController::class, 'updateCartItem']);
Route::delete('/cart/remove/{itemId}', [CartController::class, 'removeFromCart']);
Route::delete('/cart/clear', [CartController::class, 'clearCart']);

    // Order routes
    Route::post('/orders', [OrderController::class, 'createOrder']);
    Route::post('/orders/create', [OrderController::class, 'createOrder']);
    Route::get('/orders', [OrderController::class, 'getOrders']);
    Route::get('/orders/{id}', [OrderController::class, 'getOrderDetail']);
    Route::post('/orders/{id}/cancel', [OrderController::class, 'cancelOrder']);
    Route::put('/orders/{id}/cancel', [OrderController::class, 'cancelOrder']);

    // Review routes
    Route::post('/reviews', [ReviewController::class, 'store']);
    Route::get('/reviews/product/{productId}', [ReviewController::class, 'getProductReviews']);
    Route::put('/reviews/{id}', [ReviewController::class, 'update']);
    Route::delete('/reviews/{id}', [ReviewController::class, 'destroy']);

    // Wishlist merge route
    Route::post('/wishlist/merge', [WishlistController::class, 'mergeGuestWishlist']);

    // Coupon routes
    Route::post('/coupons/validate', [CouponController::class, 'validateCoupon']);

    // Payment routes
    Route::post('/payments/cod', [PaymentController::class, 'processCOD']);
    Route::post('/payments/momo', [PaymentController::class, 'processMomo']);
    Route::post('/payments/vnpay', [PaymentController::class, 'processVNPay']);

    // Notification routes
    Route::get('/notifications', [NotificationController::class, 'getNotifications']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
    Route::delete('/notifications', [NotificationController::class, 'deleteAll']);

    // Chat routes
    Route::get('/chat/rooms', [ChatController::class, 'getRooms']);
    Route::post('/chat/rooms', [ChatController::class, 'createRoom']);
    Route::get('/chat/rooms/{roomId}/messages', [ChatController::class, 'getMessages']);
    Route::post('/chat/messages', [ChatController::class, 'sendMessage']);

    // Return request routes
    Route::post('/returns', [ReturnController::class, 'createReturn']);
    Route::get('/returns', [ReturnController::class, 'getReturns']);
    Route::get('/returns/{id}', [ReturnController::class, 'getReturnDetail']);

    // Admin routes
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        // Brand grouping management
        Route::get('/brands', [AdminController::class, 'getBrands']);
        Route::put('/brands/{id}', [AdminController::class, 'updateCategory']);
        Route::delete('/brands/{id}', [AdminController::class, 'deleteCategory']);

        // Product management
        Route::get('/products', [AdminController::class, 'getProducts']);
        Route::post('/products', [AdminController::class, 'createProduct']);
        Route::put('/products/{id}', [AdminController::class, 'updateProduct']);
        Route::delete('/products/{id}', [AdminController::class, 'deleteProduct']);
        Route::post('/products/{id}/images', [AdminController::class, 'uploadProductImages']);

        // Coupon management
        Route::get('/coupons', [AdminController::class, 'getCoupons']);
        Route::post('/coupons', [AdminController::class, 'createCoupon']);
        Route::put('/coupons/{id}', [AdminController::class, 'updateCoupon']);
        Route::delete('/coupons/{id}', [AdminController::class, 'deleteCoupon']);

        // User management
        Route::get('/users', [AdminController::class, 'getUsers']);
        Route::put('/users/{id}/lock', [AdminController::class, 'lockUser']);
        Route::put('/users/{id}/unlock', [AdminController::class, 'unlockUser']);

        // Return management
        Route::get('/returns', [AdminController::class, 'getReturns']);
        Route::put('/returns/{id}', [AdminController::class, 'updateReturnStatus']);
        Route::delete('/returns/{id}', [AdminController::class, 'deleteReturn']);

        // Dashboard
        Route::get('/dashboard/stats', [AdminController::class, 'getDashboardStats']);
        Route::get('/dashboard/revenue', [AdminController::class, 'getRevenueStats']);
        Route::get('/dashboard/top-products', [AdminController::class, 'getTopProducts']);
        Route::get('/dashboard/low-stock', [AdminController::class, 'getLowStockProducts']);
        Route::get('/dashboard/stale-inventory', [AdminController::class, 'getStaleInventoryProducts']);

        // Reports
        Route::get('/reports/export', [AdminController::class, 'exportReport']);
        Route::get('/reports/kpis', [AdminController::class, 'getReportKpis']);
        Route::get('/notifications/system', [AdminController::class, 'getSystemNotifications']);
    });

});

require __DIR__ . '/staff.php';
