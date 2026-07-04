<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RoleMiddleware
{
    private function getDefaultRouteByRole(?string $role): string
    {
        return match ($role) {
            'admin' => '/admin/dashboard',
            'staff' => '/staff/orders',
            default => '/',
        };
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user();

        $normalizedRoles = array_filter(array_map('trim', $roles));

        if (!$user || !in_array($user->role, $normalizedRoles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to access this resource.',
                'required_roles' => array_values($normalizedRoles),
                'current_role' => $user?->role,
                'redirect_to' => $this->getDefaultRouteByRole($user?->role),
            ], 403);
        }

        return $next($request);
    }
}
