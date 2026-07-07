<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('password_resets', function (Blueprint $table) {
            if (!Schema::hasColumn('password_resets', 'verified')) {
                $table->boolean('verified')->default(false)->after('attempts');
            }
        });
    }

    public function down(): void
    {
        Schema::table('password_resets', function (Blueprint $table) {
            if (Schema::hasColumn('password_resets', 'verified')) {
                $table->dropColumn('verified');
            }
        });
    }
};
