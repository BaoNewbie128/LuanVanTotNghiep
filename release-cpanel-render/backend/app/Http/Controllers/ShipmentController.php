<?php

namespace App\Http\Controllers;

use App\Models\Shipments;
use App\Models\Orders;
use App\Models\Shipment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ShipmentController extends Controller
{
    // Create shipment (Staff/Admin)
    public function createShipment(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $validated = $request->validate([
                'order_id' => 'required|integer|exists:orders,id',
                'tracking_code' => 'required|string|unique:shipments,tracking_code',
                'carrier' => 'required|string|max:100'
            ]);

            $shipment = Shipment::create([
                'order_id' => $validated['order_id'],
                'tracking_code' => $validated['tracking_code'],
                'carrier' => $validated['carrier'],
                'shipped_at' => now()
            ]);

            // Update order status to shipping
            $order = Orders::findOrFail($validated['order_id']);
            $order->update(['status' => 'shipping']);

            return response()->json([
                'message' => 'Shipment created',
                'shipment' => $shipment
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get shipment by order
    public function getShipmentByOrder($orderId)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $order = Orders::findOrFail($orderId);

            // Verify access
            if ($user->id !== $order->user_id && $user->role !== 'admin' && $user->role !== 'staff') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $shipment = Shipment::where('order_id', $orderId)->first();

            if (!$shipment) {
                return response()->json(['message' => 'Shipment not found'], 404);
            }

            return response()->json($shipment, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Update shipment tracking
    public function updateTracking(Request $request, $shipmentId)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $validated = $request->validate([
                'tracking_code' => 'required|string'
            ]);

            $shipment = Shipment::findOrFail($shipmentId);
            $shipment->update(['tracking_code' => $validated['tracking_code']]);

            return response()->json([
                'message' => 'Tracking updated',
                'shipment' => $shipment
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Mark as delivered
    public function markDelivered($shipmentId)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $shipment = Shipment::findOrFail($shipmentId);
            $shipment->update(['delivered_at' => now()]);

            // Update order status to completed
            $order = Orders::findOrFail($shipment->order_id);
            $order->update(['status' => 'completed']);

            return response()->json([
                'message' => 'Shipment marked as delivered',
                'shipment' => $shipment
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get all shipments (Staff/Admin)
    public function getAllShipments(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $shipments = Shipment::with('order')
                ->orderBy('created_at', 'desc')
                ->paginate(20);

            return response()->json($shipments, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Track shipment by tracking code
    public function trackByCode($trackingCode)
    {
        try {
            $shipment = Shipment::where('tracking_code', $trackingCode)
                ->with('order')
                ->first();

            if (!$shipment) {
                return response()->json(['message' => 'Shipment not found'], 404);
            }

            return response()->json($shipment, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
