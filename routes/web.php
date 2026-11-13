<?php

use App\Http\Controllers\AdminDataController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\SupportController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public site: home page, legal pages, and the demo-request form.
Route::get('/', [PublicController::class, 'home'])->name('home');
Route::get('terms', [PublicController::class, 'terms'])->name('terms');
Route::get('privacy', [PublicController::class, 'privacy'])->name('privacy');
Route::post('demo-request', [PublicController::class, 'lead'])->middleware('throttle:5,10')->name('lead.store');

Route::post('locale', [LocaleController::class, 'update'])->name('locale.update');

Route::middleware(['auth', 'verified', 'tenant'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // The pages load their data from /admin/state and send every button press to /admin/actions/{name}.
    Route::get('admin/state', [AdminDataController::class, 'state'])->name('admin.state');
    Route::post('admin/actions/{action}', [AdminDataController::class, 'action'])->where('action', '[A-Za-z]+')->middleware('throttle:120,1')->name('admin.action');

    Route::inertia('orders', 'orders/index')->name('orders.index');
    Route::get('orders/{number}', fn (string $number) => Inertia::render('orders/show', [
        'number' => $number,
    ]))->name('orders.show');
    Route::inertia('deliveries', 'deliveries/index')->name('deliveries.index');
    Route::inertia('collections', 'collections/index')->name('collections.index');
    Route::inertia('returns', 'returns/index')->name('returns.index');
    Route::inertia('shops', 'shops/index')->name('shops.index');
    Route::inertia('areas', 'areas/index')->name('areas.index');
    Route::inertia('products', 'products/index')->name('products.index');
    Route::inertia('pricing', 'pricing/index')->name('pricing.index');
    Route::inertia('stock', 'stock/index')->name('stock.index');
    Route::inertia('staff', 'staff/index')->name('staff.index');
    Route::inertia('roles', 'roles/index')->name('roles.index');
    Route::inertia('reports', 'reports/index')->name('reports.index');
    Route::inertia('company/settings', 'company/settings')->name('company.settings');

    Route::get('billing', [BillingController::class, 'show'])->name('billing.index');
    Route::post('billing/plan', [BillingController::class, 'changePlan'])->name('billing.plan');
    Route::post('billing/invoices/{invoice}/pay', [BillingController::class, 'pay'])->name('billing.pay');

    Route::get('support', [SupportController::class, 'index'])->name('support.index');
    Route::post('support', [SupportController::class, 'store'])->name('support.store');
    Route::get('support/{ticket}', [SupportController::class, 'show'])->name('support.show');
    Route::post('support/{ticket}/reply', [SupportController::class, 'reply'])->name('support.reply');
    Route::post('support/{ticket}/close', [SupportController::class, 'close'])->name('support.close');
});

require __DIR__.'/platform.php';

require __DIR__.'/settings.php';
