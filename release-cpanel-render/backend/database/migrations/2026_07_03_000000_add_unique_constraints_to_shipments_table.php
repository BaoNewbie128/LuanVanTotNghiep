<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->unique('order_id', 'shipments_order_id_unique');
            $table->unique('tracking_code', 'shipments_tracking_code_unique');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropUnique('shipments_order_id_unique');
            $table->dropUnique('shipments_tracking_code_unique');
        });
    }
};
