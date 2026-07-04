<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoUserSeeder extends Seeder
{
    public function run(): void
    {
        $password = (string) env('DEMO_USER_PASSWORD', 'JdmWorld@123');

        if (app()->environment('production') && env('DEMO_USER_PASSWORD') === null) {
            $this->command?->warn('Bỏ qua tài khoản demo trên production vì DEMO_USER_PASSWORD chưa được cấu hình.');
            return;
        }

        $users = [
            ['username' => 'admin_demo', 'email' => 'admin@example.com', 'role' => 'admin'],
            ['username' => 'staff_demo', 'email' => 'staff@example.com', 'role' => 'staff'],
            ['username' => 'customer_demo', 'email' => 'customer@example.com', 'role' => 'customer'],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                $user + [
                    'password' => Hash::make($password),
                    'phone' => '0900000000',
                    'address' => 'Địa chỉ demo',
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );
        }
    }
}

