<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The platform around the companies: super admin / support staff, plans and
 * subscriptions, invoices (paid by bKash / Nagad / bank and confirmed by the
 * platform), and support tickets.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Platform staff have no company: tenant_id null + a platform role.
        Schema::table('users', function (Blueprint $table) {
            $table->string('platform_role')->nullable()->after('tenant_id'); // super_admin | support
        });

        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->unsignedInteger('price'); // paisa per month
            $table->unsignedInteger('staff_limit');
            $table->unsignedInteger('sms_limit'); // per month
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->string('plan_key')->default('starter')->after('status');
            $table->date('trial_ends_at')->nullable()->after('plan_key');
            $table->date('paid_until')->nullable()->after('trial_ends_at');
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number')->unique();
            $table->string('plan_key');
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedInteger('amount'); // paisa
            $table->string('status')->default('unpaid'); // unpaid | submitted | paid | void
            $table->date('due_at');
            $table->string('payment_method')->nullable(); // bkash | nagad | rocket | bank
            $table->string('payment_reference')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // who opened it
            $table->string('number')->unique();
            $table->string('subject');
            $table->string('category')->default('how_to'); // how_to | technical | billing | other
            $table->string('status')->default('open'); // open (waiting for support) | answered | closed
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'last_message_at']);
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('from_platform')->default(false);
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('platform_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        // Starting plans; the super admin edits prices and limits in the panel.
        $now = now();
        DB::table('plans')->insert([
            ['key' => 'starter', 'name' => 'Starter', 'name_bn' => 'স্টার্টার', 'price' => 1_500_00, 'staff_limit' => 10, 'sms_limit' => 300, 'description' => 'Small distributors: up to 10 staff', 'is_active' => true, 'sort' => 0, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'growth', 'name' => 'Growth', 'name_bn' => 'গ্রোথ', 'price' => 3_500_00, 'staff_limit' => 25, 'sms_limit' => 1000, 'description' => 'Growing teams: up to 25 staff', 'is_active' => true, 'sort' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'pro', 'name' => 'Pro', 'name_bn' => 'প্রো', 'price' => 7_500_00, 'staff_limit' => 75, 'sms_limit' => 3000, 'description' => 'Large distributors: up to 75 staff', 'is_active' => true, 'sort' => 2, 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Companies that already exist start a 14-day trial today.
        DB::table('tenants')->update(['trial_ends_at' => $now->copy()->addDays(14)->toDateString()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('invoices');
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn(['plan_key', 'trial_ends_at', 'paid_until']));
        Schema::dropIfExists('plans');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('platform_role'));
    }
};
