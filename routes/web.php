<?php

use App\Http\Controllers\AdminDataController;
use App\Http\Controllers\LocaleController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// No public landing page: the admin panel starts at the dashboard (or login).
Route::redirect('/', '/dashboard')->name('home');

Route::post('locale', [LocaleController::class, 'update'])->name('locale.update');

Route::middleware(['auth', 'verified'])->group(function () {
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
});

require __DIR__.'/settings.php';
