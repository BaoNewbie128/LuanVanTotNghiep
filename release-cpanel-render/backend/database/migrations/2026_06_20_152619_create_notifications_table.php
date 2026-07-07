<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            // Keep this migration aligned with the custom table in jdm (1).sql.
            $table->increments('id');
            $table->integer('user_id')->index();
            $table->string('title')->nullable();
            $table->text('content')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->nullable()->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
