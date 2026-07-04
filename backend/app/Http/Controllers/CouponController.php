<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Services\ValidationService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class CouponController extends Controller
{
    protected $validationService;

    public function __construct(ValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    // Validate coupon code
    public function validateCoupon(Request $request)
    {
        try {
            $validated = $request->validate([
                'code' => 'required|string',
                'total' => 'required|numeric|min:0'
            ]);

            // Validate code format
            $this->validationService->validateCouponCode($validated['code']);

            $coupon = Coupon::where('code', $validated['code'])->first();

            if (!$coupon) {
                return response()->json(['message' => 'Coupon not found'], 404);
            }

            // Check if coupon is expired
            if ($coupon->expiry_date && Carbon::parse($coupon->expiry_date)->isPast()) {
                return response()->json(['message' => 'Coupon has expired'], 400);
            }

            // Calculate discount
            $discount = 0;
            if ($coupon->type === 'fixed') {
                $discount = $coupon->discount;
            } elseif ($coupon->type === 'percent') {
                $discount = ($validated['total'] * $coupon->discount) / 100;
            }

            return response()->json([
                'message' => 'Coupon is valid',
                'coupon' => $coupon,
                'discount' => $discount,
                'final_total' => $validated['total'] - $discount
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get all coupons (admin)
    public function getCoupons()
    {
        try {
            $coupons = Coupon::all();
            return response()->json($coupons, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Create coupon (admin)
    public function createCoupon(Request $request)
    {
        try {
            $validated = $request->validate([
                'code' => 'required|string|unique:coupons',
                'type' => 'required|in:fixed,percent',
                'discount' => 'required|numeric|min:0',
                'expiry_date' => 'required|date|after:today'
            ]);

            // Validate coupon code format
            $this->validationService->validateCouponCode($validated['code']);

            // Validate expiry date is in future
            $this->validationService->validateFutureDate($validated['expiry_date']);

            $coupon = Coupon::create($validated);

            return response()->json([
                'message' => 'Coupon created successfully',
                'coupon' => $coupon
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Update coupon (admin)
    public function updateCoupon(Request $request, $id)
    {
        try {
            $coupon = Coupon::findOrFail($id);

            $validated = $request->validate([
                'code' => 'sometimes|string|unique:coupons,code,' . $id,
                'type' => 'sometimes|in:fixed,percent',
                'discount' => 'sometimes|numeric|min:0',
                'expiry_date' => 'sometimes|date|after:today'
            ]);

            if (isset($validated['code'])) {
                $this->validationService->validateCouponCode($validated['code']);
            }

            if (isset($validated['expiry_date'])) {
                $this->validationService->validateFutureDate($validated['expiry_date']);
            }

            $coupon->update($validated);

            return response()->json([
                'message' => 'Coupon updated successfully',
                'coupon' => $coupon
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Delete coupon (admin)
    public function deleteCoupon($id)
    {
        try {
            $coupon = Coupon::findOrFail($id);
            $coupon->delete();

            return response()->json(['message' => 'Coupon deleted successfully'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
