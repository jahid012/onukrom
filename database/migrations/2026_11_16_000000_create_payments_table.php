<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Online payment attempts for invoices (PayStation hosted checkout). Each
 * attempt has its own gateway invoice number, because PayStation refuses a
 * number it has seen before; the result is always confirmed server-to-server.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // who pressed "Pay online"
            $table->string('gateway')->default('paystation');
            $table->string('gateway_invoice')->unique(); // sent to PayStation as invoice_number
            $table->unsignedInteger('amount'); // paisa, what we asked for
            $table->string('status')->default('initiated'); // initiated | processing | success | failed
            $table->string('trx_id')->nullable();
            $table->string('method')->nullable(); // bKash, Nagad, Visa, …
            $table->string('payer')->nullable(); // payer mobile (masked by the gateway)
            $table->json('raw')->nullable(); // last status answer, for support
            $table->timestamps();
            $table->index(['invoice_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
