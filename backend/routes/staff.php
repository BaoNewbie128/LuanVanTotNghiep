<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StaffController;
use App\Http\Controllers\StaffSupportController;

Route::middleware(['auth:sanctum', 'role:staff'])->prefix('staff')->group(function () {
    Route::get('/orders', [StaffController::class, 'getOrders']);
    Route::put('/orders/{id}/status', [StaffController::class, 'updateOrderStatus']);
    Route::get('/notifications', [StaffController::class, 'getOperationalNotifications']);

    Route::get('/stock', [StaffController::class, 'getStockStatus']);
    Route::get('/stock/products', [StaffController::class, 'getStockProductOptions']);
    Route::get('/stock/movements', [StaffController::class, 'getStockMovements']);
    Route::post('/stock/import', [StaffController::class, 'importStock']);
    Route::post('/stock/export', [StaffController::class, 'exportStock']);
    Route::post('/stock/import-excel', [StaffController::class, 'importExcel']);

    Route::post('/shipments', [StaffController::class, 'createShipment']);
    Route::put('/shipments/{id}', [StaffController::class, 'updateShipment']);
    Route::get('/shipments', [StaffController::class, 'getShipments']);

    Route::get('/returns', [StaffController::class, 'getReturns']);
    Route::put('/returns/{id}/status', [StaffController::class, 'updateReturnStatus']);

    Route::get('/tickets', [StaffSupportController::class, 'index']);
    Route::post('/tickets/{id}/reply', [StaffSupportController::class, 'reply']);
    Route::put('/tickets/{id}/status', [StaffSupportController::class, 'updateStatus']);

    Route::get('/posts', [StaffController::class, 'getPosts']);
    Route::get('/posts/taxonomy', [StaffController::class, 'getBlogTaxonomy']);
    Route::post('/posts', [StaffController::class, 'createPost']);
    Route::match(['put', 'post'], '/posts/{id}', [StaffController::class, 'updatePost']);
    Route::delete('/posts/{id}', [StaffController::class, 'deletePost']);
});
