<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ValidationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    protected $validationService;

    public function __construct(ValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    // Get user profile
    public function getProfile(Request $request)
    {
        try {
            $user = Auth::user();
            return response()->json($user, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Update user profile
    public function updateProfile(Request $request)
    {
        try {
            /** @var User $user */
            $user = Auth::user();

            $validated = $request->validate([
                'username' => 'sometimes|string|max:100',
                'email' => 'sometimes|email|unique:users,email,' . $user->id,
                'phone' => 'sometimes|string|unique:users,phone,' . $user->id,
                'address' => 'sometimes|string',
                'avatar' => 'sometimes|image|mimes:jpeg,png,jpg|max:2048'
            ]);

            // Validate using custom validation service
            if (isset($validated['email'])) {
                $this->validationService->validateEmail($validated['email']);
            }
            if (isset($validated['phone'])) {
                $this->validationService->validatePhone($validated['phone']);
            }

            // Handle avatar upload
            if ($request->hasFile('avatar')) {
                $file = $request->file('avatar');
                $filename = time() . '_' . $file->getClientOriginalName();
                if ($user->avatar) {
                    Storage::disk('public')->delete('avatars/' . basename($user->avatar));
                }
                $file->storeAs('avatars', $filename, 'public');
                $validated['avatar'] = $filename;
            }

            $user->update($validated);

            return response()->json([
                'message' => 'Profile updated successfully',
                'user' => $user
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Change password
    public function changePassword(Request $request)
    {
        try {
            /** @var User $user */
            $user = Auth::user();

            $validated = $request->validate([
                'current_password' => 'required|string',
                'new_password' => 'required|string|min:8|confirmed'
            ]);

            // Verify current password
            if (!Hash::check($validated['current_password'], $user->password)) {
                return response()->json(['message' => 'Current password is incorrect'], 400);
            }

            // Validate new password
            $this->validationService->validatePassword($validated['new_password']);

            // Update password
            $user->update([
                'password' => Hash::make($validated['new_password'])
            ]);

            return response()->json(['message' => 'Password changed successfully'], 200);
        } catch (ValidationException $e) {
            throw $e;
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
