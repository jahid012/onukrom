<?php

use App\Http\Controllers\Platform\BillingAdminController;
use App\Http\Controllers\Platform\CompanyController;
use App\Http\Controllers\Platform\ImpersonationController;
use App\Http\Controllers\Platform\LeadController;
use App\Http\Controllers\Platform\SupportDeskController;
use App\Http\Controllers\Platform\TeamController;
use Illuminate\Support\Facades\Route;

/*
| Onukrom's own panel (super admin + support staff). Platform users have no
| company; they reach one only by impersonating its owner.
*/
Route::middleware(['auth', 'verified', 'platform'])->prefix('platform')->name('platform.')->group(function () {
    Route::get('/', [CompanyController::class, 'dashboard'])->name('dashboard');
    Route::get('companies', [CompanyController::class, 'index'])->name('companies.index');
    Route::get('companies/{tenant}', [CompanyController::class, 'show'])->name('companies.show');
    Route::post('companies/{tenant}/impersonate', [ImpersonationController::class, 'start'])->name('companies.impersonate');

    Route::get('leads', [LeadController::class, 'index'])->name('leads.index');
    Route::post('leads/{lead}', [LeadController::class, 'update'])->name('leads.update');

    Route::get('support', [SupportDeskController::class, 'index'])->name('support.index');
    Route::get('support/{ticket}', [SupportDeskController::class, 'show'])->name('support.show');
    Route::post('support/{ticket}/reply', [SupportDeskController::class, 'reply'])->name('support.reply');
    Route::post('support/{ticket}', [SupportDeskController::class, 'update'])->name('support.update');

    // Money, plans, the team and settings: super admins only.
    Route::middleware('platform:super_admin')->group(function () {
        Route::post('companies', [CompanyController::class, 'store'])->name('companies.store');
        Route::post('companies/{tenant}/subscription', [CompanyController::class, 'subscription'])->name('companies.subscription');
        Route::post('companies/{tenant}/status', [CompanyController::class, 'status'])->name('companies.status');
        Route::post('companies/{tenant}/invoices', [BillingAdminController::class, 'issue'])->name('companies.invoices');

        Route::get('invoices', [BillingAdminController::class, 'invoices'])->name('invoices.index');
        Route::post('invoices/{invoice}/confirm', [BillingAdminController::class, 'confirm'])->name('invoices.confirm');
        Route::post('invoices/{invoice}/reject', [BillingAdminController::class, 'reject'])->name('invoices.reject');
        Route::post('invoices/{invoice}/void', [BillingAdminController::class, 'void'])->name('invoices.void');

        Route::get('plans', [BillingAdminController::class, 'plans'])->name('plans.index');
        Route::post('plans', [BillingAdminController::class, 'savePlan'])->name('plans.store');
        Route::post('plans/{plan}', [BillingAdminController::class, 'savePlan'])->name('plans.update');

        Route::get('team', [TeamController::class, 'index'])->name('team.index');
        Route::post('team', [TeamController::class, 'store'])->name('team.store');
        Route::post('team/{member}', [TeamController::class, 'update'])->name('team.update');

        Route::get('settings', [BillingAdminController::class, 'settings'])->name('settings');
        Route::post('settings', [BillingAdminController::class, 'saveSettings'])->name('settings.update');
        Route::post('settings/meta-test', [BillingAdminController::class, 'testMeta'])->name('settings.metaTest');
    });
});

// Back from "view as owner" to the platform account.
Route::post('impersonation/stop', [ImpersonationController::class, 'stop'])->middleware('auth')->name('impersonation.stop');
