<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class PaymentController extends Controller
{
    public function processCOD(Request $request)
    {
        $validated = $request->validate(['order_id' => 'required|integer|exists:orders,id']);
        $order = Order::whereKey($validated['order_id'])->where('user_id', $request->user()->id)->firstOrFail();

        $payment = Payment::firstOrCreate(
            ['order_id' => $order->id, 'payment_method' => 'cod'],
            ['amount' => $order->total - $order->discount, 'status' => 'pending']
        );

        return response()->json(['success' => true, 'data' => $payment]);
    }

    public function processMomo(Request $request)
    {
        return $this->initiateMomoPayment($request);
    }

    public function processVNPay(Request $request)
    {
        return $this->initiateVNPayPayment($request);
    }

    // Initiate Momo payment
    public function initiateMomoPayment(Request $request)
    {
        try {
            $validated = $request->validate([
                'order_id' => 'required|integer|exists:orders,id'
            ]);

            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $order = Order::where('id', $validated['order_id'])
                ->where('user_id', $user->id)
                ->firstOrFail();

            // Create payment record
            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => 'momo',
                'amount' => $order->total - $order->discount,
                'status' => 'pending'
            ]);

            // Momo API configuration
            $endpoint = config('services.momo.endpoint');
            $partnerCode = config('services.momo.partner_code');
            $accessKey = config('services.momo.access_key');
            $secretKey = config('services.momo.secret_key');

            if (!$partnerCode || !$accessKey || !$secretKey) {
                return response()->json(['message' => 'Chưa cấu hình thông tin MoMo trên máy chủ.'], 503);
            }

            $orderId = "ORDER_" . $order->id . "_" . time();
            $amount = (int)($order->total - $order->discount);
            $orderInfo = "Payment for order #" . $order->id;
            $returnUrl = rtrim(config('app.url'), '/') . "/api/payments/momo/callback";
            $notifyUrl = rtrim(config('app.url'), '/') . "/api/payments/momo/notify";
            $extraData = base64_encode(json_encode(['order_id' => $order->id, 'payment_id' => $payment->id]));

            $requestId = time() . "";
            $requestType = "captureWallet";

            $rawHash = "accessKey=" . $accessKey . "&amount=" . $amount . "&extraData=" . $extraData . "&ipnUrl=" . $notifyUrl . "&orderId=" . $orderId . "&orderInfo=" . $orderInfo . "&partnerCode=" . $partnerCode . "&redirectUrl=" . $returnUrl . "&requestId=" . $requestId . "&requestType=" . $requestType;

            $signature = hash_hmac("sha256", $rawHash, $secretKey);

            $data = [
                'partnerCode' => $partnerCode,
                'partnerName' => 'JDM Model Store',
                'storeId' => 'JDM001',
                'requestId' => $requestId,
                'amount' => $amount,
                'orderId' => $orderId,
                'orderInfo' => $orderInfo,
                'redirectUrl' => $returnUrl,
                'ipnUrl' => $notifyUrl,
                'lang' => 'vi',
                'extraData' => $extraData,
                'requestType' => $requestType,
                'signature' => $signature
            ];

            $gatewayResponse = Http::timeout(20)->asJson()->post($endpoint, $data);
            if (!$gatewayResponse->successful() || !$gatewayResponse->json('payUrl')) {
                Log::error('MoMo gateway rejected request', ['response' => $gatewayResponse->json()]);
                return response()->json(['message' => 'Không thể khởi tạo thanh toán MoMo.'], 502);
            }

            return response()->json([
                'message' => 'Payment initiated',
                'payment_url' => $gatewayResponse->json('payUrl')
            ], 200);
        } catch (\Exception $e) {
            Log::error('Momo payment error: ' . $e->getMessage());
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Momo payment callback
    public function momoCallback(Request $request)
    {
        try {
            $resultCode = $request->input('resultCode');
            $orderId = $request->input('orderId');
            $extraData = json_decode(base64_decode($request->input('extraData')), true);

            if ($resultCode == 0) {
                // Payment successful
                $payment = Payment::find($extraData['payment_id'] ?? null);
                if ($payment) {
                    $payment->update([
                        'status' => 'success',
                        'transaction_code' => $orderId,
                        'paid_at' => now()
                    ]);

                    $order = Order::find($payment->order_id);
                    $order->update(['status' => 'paid']);
                }

                return redirect(config('cors.frontend_url') . '/order-confirmation/' . ($extraData['order_id'] ?? ''));
            } else {
                // Payment failed
                $payment = Payment::find($extraData['payment_id'] ?? null);
                if ($payment) {
                    $payment->update(['status' => 'failed']);
                }

                return redirect(config('cors.frontend_url') . '/checkout?payment=failed');
            }
        } catch (\Exception $e) {
            Log::error('Momo callback error: ' . $e->getMessage());
            return redirect(config('cors.frontend_url') . '/checkout?payment=error');
        }
    }

    // Momo IPN (Instant Payment Notification)
    public function momoNotify(Request $request)
    {
        try {
            $resultCode = $request->input('resultCode');
            $orderId = $request->input('orderId');
            $extraData = json_decode(base64_decode($request->input('extraData')), true);

            if ($resultCode == 0) {
                $payment = Payment::find($extraData['payment_id'] ?? null);
                if ($payment && $payment->status === 'pending') {
                    $payment->update([
                        'status' => 'success',
                        'transaction_code' => $orderId,
                        'paid_at' => now()
                    ]);

                    $order = Order::find($payment->order_id);
                    $order->update(['status' => 'paid']);
                }
            }

            return response()->json(['message' => 'Received'], 200);
        } catch (\Exception $e) {
            Log::error('Momo notify error: ' . $e->getMessage());
            return response()->json(['message' => 'Error'], 500);
        }
    }

    // Initiate VNPay payment
    public function initiateVNPayPayment(Request $request)
    {
        try {
            $validated = $request->validate([
                'order_id' => 'required|integer|exists:orders,id'
            ]);

            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $order = Order::where('id', $validated['order_id'])
                ->where('user_id', $user->id)
                ->firstOrFail();

            // Create payment record
            $payment = Payment::create([
                'order_id' => $order->id,
                'payment_method' => 'vnpay',
                'amount' => $order->total - $order->discount,
                'status' => 'pending'
            ]);

            // VNPay configuration
            $vnp_Url = "https://sandbox.vnpayment.vn/paygate";
            $vnp_Returnurl = rtrim(config('app.url'), '/') . "/api/payments/vnpay/callback";
            $vnp_TmnCode = config('services.vnpay.tmn_code');
            $vnp_HashSecret = config('services.vnpay.hash_secret');

            if (!$vnp_TmnCode || !$vnp_HashSecret) {
                return response()->json(['message' => 'Chưa cấu hình thông tin VNPay trên máy chủ.'], 503);
            }

            $vnp_TxnRef = "ORDER_" . $order->id . "_" . time();
            $vnp_OrderInfo = "Payment for order #" . $order->id;
            $vnp_OrderType = "other";
            $vnp_Amount = (int)(($order->total - $order->discount) * 100);
            $vnp_Locale = "vn";
            $vnp_BankCode = "NCB";
            $vnp_IpAddr = $_SERVER['REMOTE_ADDR'];

            $inputData = array(
                "vnp_Version" => "2.1.0",
                "vnp_TmnCode" => $vnp_TmnCode,
                "vnp_Amount" => $vnp_Amount,
                "vnp_Command" => "pay",
                "vnp_CreateDate" => date('YmdHis'),
                "vnp_CurrCode" => "VND",
                "vnp_IpAddr" => $vnp_IpAddr,
                "vnp_Locale" => $vnp_Locale,
                "vnp_OrderInfo" => $vnp_OrderInfo,
                "vnp_OrderType" => $vnp_OrderType,
                "vnp_ReturnUrl" => $vnp_Returnurl,
                "vnp_TxnRef" => $vnp_TxnRef,
                "vnp_BankCode" => $vnp_BankCode
            );

            ksort($inputData);
            $query = "";
            $i = 0;
            $hashdata = "";
            foreach ($inputData as $key => $value) {
                if ($i == 1) $query .= "&";
                $query .= urlencode($key) . "=" . urlencode($value);
                $hashdata .= $key . '=' . $value;
                if ($i == 0) $hashdata .= "&";
                $i = 1;
            }

            $vnp_Url = $vnp_Url . "?" . $query;
            $vnpay_hash = hash_hmac('sha512', $hashdata, $vnp_HashSecret);
            $vnp_Url .= '&vnp_SecureHash=' . $vnpay_hash;

            return response()->json([
                'message' => 'Payment initiated',
                'payment_url' => $vnp_Url
            ], 200);
        } catch (\Exception $e) {
            Log::error('VNPay payment error: ' . $e->getMessage());
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // VNPay payment callback
    public function vnpayCallback(Request $request)
    {
        try {
            $vnp_HashSecret = config('services.vnpay.hash_secret');
            $vnp_SecureHash = $request->input('vnp_SecureHash');
            $inputData = $request->all();
            unset($inputData['vnp_SecureHash']);
            ksort($inputData);

            $hashdata = "";
            $i = 0;
            foreach ($inputData as $key => $value) {
                if ($i == 1) $hashdata .= "&";
                $hashdata .= $key . '=' . $value;
                $i = 1;
            }

            $secureHash = hash_hmac('sha512', $hashdata, $vnp_HashSecret);

            if ($secureHash == $vnp_SecureHash) {
                if ($request->input('vnp_ResponseCode') == '00') {
                    // Payment successful
                    $txnRef = $request->input('vnp_TxnRef');
                    preg_match('/ORDER_(\d+)_/', $txnRef, $matches);
                    $orderId = $matches[1] ?? null;

                    if ($orderId) {
                        $order = Order::find($orderId);
                        if ($order) {
                            $payment = Payment::where('order_id', $orderId)
                                ->where('payment_method', 'vnpay')
                                ->first();

                            if ($payment) {
                                $payment->update([
                                    'status' => 'success',
                                    'transaction_code' => $txnRef,
                                    'paid_at' => now()
                                ]);

                                $order->update(['status' => 'paid']);
                            }
                        }
                    }

                    return redirect(config('cors.frontend_url') . '/order-confirmation/' . $orderId);
                } else {
                    return redirect(config('cors.frontend_url') . '/checkout?payment=failed');
                }
            } else {
                return redirect(config('cors.frontend_url') . '/checkout?payment=error');
            }
        } catch (\Exception $e) {
            Log::error('VNPay callback error: ' . $e->getMessage());
            return redirect(config('cors.frontend_url') . '/checkout?payment=error');
        }
    }

    // Get payment status
    public function getPaymentStatus($orderId)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $order = Order::where('id', $orderId)
                ->where('user_id', $user->id)
                ->firstOrFail();

            $payment = Payment::where('order_id', $orderId)->first();

            return response()->json([
                'order_id' => $order->id,
                'order_status' => $order->status,
                'payment' => $payment
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
