<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\PasswordReset;
use App\Models\Cart;
use App\Models\CartItems;
use App\Http\Controllers\WishlistController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Carbon\Carbon;

class AuthController extends Controller
{
    private const OTP_EXPIRATION_MINUTES = 5;

    private function getDefaultRouteByRole(string $role): string
    {
        return match ($role) {
            'admin' => '/admin/dashboard',
            'staff' => '/staff/orders',
            default => '/',
        };
    }

    /**
     * Merge guest cart to user cart after login
     */
    private function mergeGuestCart($user)
    {
        $guestCart = Session::get('guest_cart', []);
        
        if (empty($guestCart)) {
            return;
        }

        // Get or create user cart
        $cart = Cart::firstOrCreate(['user_id' => $user->id]);

        foreach ($guestCart as $guestItem) {
            $productId = $guestItem['product_id'];
            $quantity = $guestItem['quantity'];

            // Get product
            $product = \App\Models\Products::find($productId);
            if (!$product) {
                continue;
            }

            // Check if item already in cart
            $cartItem = CartItems::where('cart_id', $cart->id)
                ->where('product_id', $productId)
                ->first();

            if ($cartItem) {
                $newQuantity = $cartItem->quantity + $quantity;
                $cartItem->update(['quantity' => $newQuantity]);
            } else {
                CartItems::create([
                    'cart_id' => $cart->id,
                    'product_id' => $productId,
                    'quantity' => $quantity
                ]);
            }
        }

        // Clear guest cart from session
        Session::forget('guest_cart');
    }

    /**
     * Merge guest wishlist to user wishlist after login
     */
    private function mergeGuestWishlist($user)
    {
        $guestWishlist = Session::get('guest_wishlist', []);

        if (empty($guestWishlist)) {
            return 0;
        }

        $mergedCount = WishlistController::mergeGuestWishlistForUser($user, $guestWishlist);
        Session::forget('guest_wishlist');

        return $mergedCount;
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100', 'regex:/^[\pL\s0-9-]+$/u'],
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|unique:users,phone|regex:/^0[0-9]{9,10}$/',
            'password' => 'required|string|min:8|confirmed',
            'address' => 'required|string',
        ], [
            'username.required' => 'Vui lòng nhập tên người dùng.',
            'username.max' => 'Tên người dùng không được vượt quá 100 ký tự.',
            'username.regex' => 'Tên người dùng chỉ được chứa chữ cái, chữ số, khoảng trắng và dấu gạch ngang.',
            'email.required' => 'Vui lòng nhập địa chỉ email.',
            'email.email' => 'Địa chỉ email không đúng định dạng.',
            'email.unique' => 'Địa chỉ email này đã được sử dụng.',
            'phone.required' => 'Vui lòng nhập số điện thoại.',
            'phone.unique' => 'Số điện thoại này đã được sử dụng.',
            'phone.regex' => 'Số điện thoại phải bắt đầu bằng số 0 và gồm 10 đến 11 chữ số.',
            'password.required' => 'Vui lòng nhập mật khẩu.',
            'password.min' => 'Mật khẩu phải có ít nhất 8 ký tự.',
            'password.confirmed' => 'Xác nhận mật khẩu không khớp.',
            'address.required' => 'Vui lòng nhập địa chỉ.',
        ]);

        $user = User::create([
            'username' => $validated['username'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'password' => Hash::make($validated['password']),
            'address' => $validated['address'],
            'role' => 'customer',
            'is_active' => true,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully',
            'user' => $user,
            'token' => $token,
            'redirect_to' => $this->getDefaultRouteByRole($user->role),
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            return response()->json([
                'message' => 'Sai thông tin đăng nhập',
            ], 401);
        }

        // Check password - support both bcrypt (Hash::make) and MD5
        $passwordValid = false;
        
        // Try bcrypt first (new passwords)
        if (Hash::check($validated['password'], $user->password)) {
            $passwordValid = true;
        }
        // Try MD5 (legacy passwords)
        elseif (md5($validated['password']) === $user->password) {
            $passwordValid = true;
        }

        if (!$passwordValid) {
            return response()->json([
                'message' => 'Sai thông tin đăng nhập',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Tài khoản đã bị khóa,vui lòng liên hệ với admin theo số điện thoại 0378884120',
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $hadGuestCart = !empty(Session::get('guest_cart', []));
        $hadGuestWishlist = !empty(Session::get('guest_wishlist', []));

        // Merge guest cart/wishlist to user data after successful login
        $this->mergeGuestCart($user);
        $wishlistMergedCount = $this->mergeGuestWishlist($user);

        return response()->json([
            'message' => 'Login successful',
            'user' => $user,
            'token' => $token,
            'redirect_to' => $this->getDefaultRouteByRole($user->role),
            'cart_merged' => $hadGuestCart,
            'wishlist_merged' => $hadGuestWishlist,
            'wishlist_merged_count' => $wishlistMergedCount,
        ], 200);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful',
        ], 200);
    }

    public function refresh(Request $request)
    {
        $user = $request->user();
        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Token refreshed',
            'token' => $token,
        ], 200);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email first before resetting password',
                'requires_verification' => true,
            ], 403);
        }

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = Carbon::now()->addMinutes(self::OTP_EXPIRATION_MINUTES);

        PasswordReset::updateOrCreate(
            ['email' => $validated['email']],
            [
                'otp' => Hash::make($otp),
                'expires_at' => $expiresAt,
                'attempts' => 0,
                'last_sent_at' => Carbon::now(),
                'request_ip' => $request->ip(),
            ]
        );

        $otpLifetime = self::OTP_EXPIRATION_MINUTES;
        Mail::raw("Your OTP is: $otp. Valid for $otpLifetime minutes.", function ($message) use ($validated) {
            $message->to($validated['email'])
                ->subject('Password Reset OTP - JDM WORLD');
        });

        return response()->json([
            'message' => 'OTP sent to email',
            'email' => $validated['email'],
        ], 200);
    }

    public function verifyOTP(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string|size:6',
        ]);

        $reset = PasswordReset::where('email', $validated['email'])->first();

        if (!$reset || Carbon::now()->isAfter($reset->expires_at)) {
            return response()->json([
                'message' => 'OTP expired or invalid. Please request a new OTP.',
            ], 400);
        }

        if (!Hash::check($validated['otp'], $reset->otp)) {
            $reset->increment('attempts');
            if ($reset->attempts >= 5) {
                $reset->delete();
                return response()->json([
                    'message' => 'Too many attempts. Please request a new OTP.',
                ], 429);
            }
            return response()->json([
                'message' => 'Invalid OTP. ' . (5 - $reset->attempts) . ' attempts remaining.',
            ], 400);
        }

        $reset->update(['verified' => true]);

        return response()->json([
            'message' => 'OTP verified successfully. You can now reset your password.',
            'verified' => true,
        ], 200);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
            'otp' => 'required|string|size:6',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $reset = PasswordReset::where('email', $validated['email'])->first();

        if (!$reset || Carbon::now()->isAfter($reset->expires_at)) {
            return response()->json([
                'message' => 'OTP expired or invalid. Please request a new OTP.',
            ], 400);
        }

        if (!Hash::check($validated['otp'], $reset->otp)) {
            return response()->json([
                'message' => 'Invalid OTP',
            ], 400);
        }

        $user = User::where('email', $validated['email'])->first();
        $user->update(['password' => Hash::make($validated['password'])]);

        $reset->delete();

        return response()->json([
            'message' => 'Password reset successfully. Please login with your new password.',
        ], 200);
    }

    public function verifyEmail(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string|size:6',
        ]);

        $reset = PasswordReset::where('email', $validated['email'])->first();

        if (!$reset || Carbon::now()->isAfter($reset->expires_at)) {
            return response()->json([
                'message' => 'OTP expired or invalid',
            ], 400);
        }

        if (!Hash::check($validated['otp'], $reset->otp)) {
            $reset->increment('attempts');
            if ($reset->attempts >= 5) {
                $reset->delete();
                return response()->json([
                    'message' => 'Too many attempts. Please request a new OTP.',
                ], 429);
            }
            return response()->json([
                'message' => 'Invalid OTP',
            ], 400);
        }

        $user = User::where('email', $validated['email'])->first();
        $user->update(['email_verified_at' => Carbon::now()]);

        $reset->delete();

        return response()->json([
            'message' => 'Email verified successfully',
        ], 200);
    }

    public function resendOTP(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'purpose' => 'required|in:email_verification,password_reset',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found',
            ], 404);
        }

        $reset = PasswordReset::where('email', $validated['email'])
            ->where('last_sent_at', '>', Carbon::now()->subMinute())
            ->first();

        if ($reset) {
            return response()->json([
                'message' => 'Please wait 1 minute before requesting a new OTP.',
            ], 429);
        }

        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = Carbon::now()->addMinutes(self::OTP_EXPIRATION_MINUTES);

        PasswordReset::updateOrCreate(
            ['email' => $validated['email']],
            [
                'otp' => Hash::make($otp),
                'expires_at' => $expiresAt,
                'attempts' => 0,
                'last_sent_at' => Carbon::now(),
                'request_ip' => $request->ip(),
            ]
        );

        $subject = $validated['purpose'] === 'email_verification' 
            ? 'Email Verification OTP - JDM WORLD'
            : 'Password Reset OTP - JDM WORLD';

        $otpLifetime = self::OTP_EXPIRATION_MINUTES;
        Mail::raw("Your OTP is: $otp. Valid for $otpLifetime minutes.", function ($message) use ($validated, $subject) {
            $message->to($validated['email'])
                ->subject($subject);
        });

        return response()->json([
            'message' => 'OTP resent to email',
        ], 200);
    }
}
