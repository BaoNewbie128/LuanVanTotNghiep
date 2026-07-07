<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('recipient_name', 100)->nullable()->after('user_id');
            $table->string('shipping_phone', 20)->nullable()->after('recipient_name');
            $table->string('shipping_address', 500)->nullable()->after('shipping_phone');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['recipient_name', 'shipping_phone', 'shipping_address']);
        });
    }
};
