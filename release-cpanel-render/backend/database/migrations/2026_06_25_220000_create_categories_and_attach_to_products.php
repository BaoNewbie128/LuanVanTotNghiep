<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy migration intentionally disabled.
        // The real database schema does not use `categories` table nor
        // `products.category_id`. Product grouping is handled exclusively by
        // the `brand` column on the `products` table.
    }

    public function down(): void
    {
        // No-op.
    }
};