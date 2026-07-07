<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            if (!Schema::hasColumn('support_tickets', 'user_id')) $table->integer('user_id')->nullable()->after('id')->index();
            if (!Schema::hasColumn('support_tickets', 'reply_message')) $table->text('reply_message')->nullable()->after('message');
            if (!Schema::hasColumn('support_tickets', 'replied_by')) $table->integer('replied_by')->nullable()->after('reply_message');
            if (!Schema::hasColumn('support_tickets', 'replied_at')) $table->timestamp('replied_at')->nullable()->after('replied_by');
            if (!Schema::hasColumn('support_tickets', 'mail_sent_at')) $table->timestamp('mail_sent_at')->nullable()->after('replied_at');
            if (!Schema::hasColumn('support_tickets', 'customer_read_at')) $table->timestamp('customer_read_at')->nullable()->after('mail_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('support_tickets', function (Blueprint $table) {
            foreach (['customer_read_at', 'mail_sent_at', 'replied_at', 'replied_by', 'reply_message', 'user_id'] as $column) {
                if (Schema::hasColumn('support_tickets', $column)) $table->dropColumn($column);
            }
        });
    }
};
