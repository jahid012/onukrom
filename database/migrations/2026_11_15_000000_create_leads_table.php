<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Demo requests from the public home page. The platform calls them back and
 * turns them into companies; ad attribution (fbp / fbc / utm) is kept so the
 * Conversions API can match them to Meta ads.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('phone'); // 01XXXXXXXXX
            $table->string('company')->nullable();
            $table->string('district')->nullable();
            $table->string('team_size')->nullable(); // 1-5 | 6-15 | 16-40 | 40+
            $table->text('message')->nullable();
            $table->string('status')->default('new'); // new | contacted | converted | lost
            $table->string('note')->nullable();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete(); // once converted
            $table->string('locale', 5)->nullable();
            $table->json('utm')->nullable(); // utm_source, utm_campaign, … from the landing URL
            $table->string('fbp')->nullable();
            $table->string('fbc')->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('event_id')->nullable(); // shared by the Pixel and the Conversions API
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
