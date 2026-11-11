<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Onukrom domain tables (docs/ONUKROM_SPEC.md §6).
 *
 * - Every tenant-owned table has tenant_id.
 * - Records that the phone creates offline use ULID primary keys, so the
 *   phone's id is also the idempotency key during sync.
 * - Money is integer paisa (1 ৳ = 100). Quantities are base units (pieces).
 * - Pulled tables have (tenant_id, updated_at, id) indexes for delta sync.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('name')->nullable(); // custom roles; built-in roles are translated in the UI
            $table->boolean('built_in')->default(false);
            $table->json('permissions');
            $table->timestamps();
            $table->unique(['tenant_id', 'key']);
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['role_id', 'user_id']);
        });

        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id');
            $table->string('model')->nullable();
            $table->string('app_version')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'device_id']);
        });

        Schema::create('sms_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('phone');
            $table->string('type'); // invite | password_reset
            $table->text('body_masked');
            $table->string('provider')->default('alpha_sms');
            $table->string('status')->default('queued'); // queued | sent | failed
            $table->string('error')->nullable();
            $table->timestamps();
        });

        // Zone → area → route in one tree. Routes carry visit days + the assigned SR / DM.
        Schema::create('areas', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('parent_id')->nullable()->constrained('areas')->cascadeOnDelete();
            $table->string('type'); // zone | area | route
            $table->string('name');
            $table->string('code')->nullable();
            $table->json('visit_days')->nullable();
            $table->foreignId('sr_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('dm_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('area_user', function (Blueprint $table) {
            $table->foreignUlid('area_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['area_id', 'user_id']);
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('sku');
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->string('brand')->nullable();
            $table->unsignedInteger('pack_size')->default(1);
            $table->unsignedBigInteger('mrp')->default(0);   // paisa per piece
            $table->unsignedBigInteger('price')->default(0); // paisa per piece (default price list)
            $table->unsignedInteger('reorder_level')->default(0);
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('hue')->default(150);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'sku']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('price_lists', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->string('applies_to'); // shop_category | area
            $table->string('target');     // shop category key or route name
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('price_list_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('price_list_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('unit_price'); // paisa
            $table->timestamps();
            $table->unique(['price_list_id', 'product_id']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('price_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('price_list_id')->nullable()->constrained()->cascadeOnDelete(); // null = default list
            $table->foreignUlid('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('from_price');
            $table->unsignedBigInteger('to_price');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('warehouses', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->string('type')->default('main'); // main | van | damage
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('stock_levels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('warehouse_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('product_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('on_hand')->default(0);
            $table->bigInteger('reserved')->default(0);
            $table->timestamps();
            $table->unique(['warehouse_id', 'product_id']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('warehouse_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('product_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('qty');
            $table->string('type'); // purchase | adjust | reserve | release | deliver | return | transfer
            $table->string('reference')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('shops', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('route_id')->nullable()->constrained('areas')->nullOnDelete();
            $table->string('code');
            $table->string('name');
            $table->string('name_bn')->nullable();
            $table->string('owner_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('category')->default('grocery');
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->unsignedInteger('location_accuracy_m')->nullable();
            $table->unsignedBigInteger('credit_limit')->default(0); // paisa
            $table->bigInteger('due')->default(0);                  // paisa
            $table->string('status')->default('active'); // pending_approval | active | inactive
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('last_order_at')->nullable();
            $table->string('device_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'route_id']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('trips', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->foreignId('delivery_user_id')->constrained('users');
            $table->foreignUlid('route_id')->nullable()->constrained('areas')->nullOnDelete();
            $table->string('vehicle')->nullable();
            $table->string('status')->default('planned'); // planned | loaded | in_progress | closed
            $table->bigInteger('cash_collected')->default(0);
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'number']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->foreignUlid('shop_id')->constrained();
            $table->foreignId('sales_user_id')->constrained('users');
            $table->foreignUlid('trip_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status')->default('pending');
            $table->timestamp('ordered_at');
            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('discount')->default(0);
            $table->bigInteger('total')->default(0);
            $table->bigInteger('paid')->default(0);
            $table->text('note')->nullable();
            // Live location at save time (spec §10.5)
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->unsignedInteger('location_accuracy_m')->nullable();
            $table->timestamp('location_at')->nullable();
            $table->unsignedInteger('distance_from_shop_m')->nullable();
            $table->boolean('is_mock_location')->default(false);
            $table->json('flags')->nullable();
            $table->string('reject_reason')->nullable();
            $table->unsignedInteger('client_version')->default(1);
            $table->string('device_id')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'number']);
            $table->index(['tenant_id', 'shop_id', 'status']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('order_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('product_id')->constrained();
            $table->unsignedInteger('qty');                 // pieces
            $table->unsignedBigInteger('unit_price');       // paisa
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('line_total');
            $table->unsignedInteger('delivered_qty')->nullable();
            $table->timestamps();
        });

        Schema::create('deposits', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->foreignId('user_id')->constrained();
            $table->bigInteger('amount');
            $table->unsignedInteger('collections_count')->default(0);
            $table->string('status')->default('waiting'); // waiting | confirmed
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });

        Schema::create('collections', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->foreignUlid('shop_id')->constrained();
            $table->foreignUlid('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->string('method'); // cash | bkash | nagad | rocket | bank | cheque
            $table->string('reference')->nullable();
            $table->bigInteger('amount');
            $table->string('status')->default('pending'); // pending | confirmed | rejected
            $table->string('reject_reason')->nullable();
            $table->timestamp('collected_at');
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->foreignUlid('deposit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('device_id')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'number']);
            $table->index(['tenant_id', 'updated_at', 'id']);
        });

        Schema::create('returns', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number');
            $table->foreignUlid('shop_id')->constrained();
            $table->foreignUlid('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->string('type'); // at_delivery | market
            $table->string('reason'); // damaged | expired | wrong_item | not_needed | other
            $table->string('condition')->default('good'); // good | damaged
            $table->unsignedInteger('items_count')->default(1);
            $table->bigInteger('value')->default(0);
            $table->string('status')->default('pending'); // pending | approved | rejected
            $table->string('destination')->nullable(); // main | damage
            $table->string('reject_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'number']);
        });

        // What came back, product by product — approving a return puts it into stock.
        Schema::create('return_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('return_id')->constrained('returns')->cascadeOnDelete();
            $table->foreignUlid('product_id')->constrained();
            $table->unsignedInteger('qty');
            $table->unsignedBigInteger('unit_price');
            $table->timestamps();
        });

        Schema::create('visits', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->foreignUlid('shop_id')->constrained();
            $table->string('outcome'); // order | no_order
            $table->string('no_order_reason')->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->unsignedInteger('accuracy_m')->nullable();
            $table->timestamp('checked_in_at');
            $table->timestamps();
        });

        Schema::create('location_pings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->string('source')->default('order'); // order | delivery | duty
            $table->string('ref_id')->nullable(); // visit / order ULID
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->unsignedInteger('accuracy_m')->nullable();
            $table->boolean('is_mock')->default(false);
            $table->timestamp('recorded_at');
            $table->index(['tenant_id', 'user_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        foreach ([
            'location_pings', 'visits', 'return_items', 'returns', 'collections', 'deposits', 'order_items', 'orders',
            'trips', 'shops', 'stock_movements', 'stock_levels', 'warehouses', 'price_changes',
            'price_list_items', 'price_lists', 'products', 'categories', 'area_user', 'areas',
            'sms_messages', 'devices', 'role_user', 'roles',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
