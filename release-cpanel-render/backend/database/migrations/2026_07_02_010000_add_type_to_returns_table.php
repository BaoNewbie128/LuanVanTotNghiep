<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('returns', function (Blueprint $table) {
            if (!Schema::hasColumn('returns', 'request_type')) $table->string('request_type', 20)->default('return')->after('user_id');
            if (!Schema::hasColumn('returns', 'resolution_note')) $table->text('resolution_note')->nullable()->after('reason');
        });
    }

    public function down(): void
    {
        Schema::table('returns', function (Blueprint $table) {
            if (Schema::hasColumn('returns', 'resolution_note')) $table->dropColumn('resolution_note');
            if (Schema::hasColumn('returns', 'request_type')) $table->dropColumn('request_type');
        });
    }
};
