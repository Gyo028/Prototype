<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\TechnicalAdmin\UserAccountController;
use App\Http\Controllers\TechnicalAdmin\EmployeeController;
use App\Http\Controllers\TechnicalAdmin\FaqController;
use App\Http\Controllers\TechnicalAdmin\WebsiteContentController;
use App\Http\Controllers\TechnicalAdmin\ServiceController;
use App\Http\Controllers\TechnicalAdmin\ServicesAssetsController;
use App\Http\Controllers\TechnicalAdmin\DesignThemeController;
use App\Http\Controllers\TechnicalAdmin\LayoutAssetController;
use App\Http\Controllers\TechnicalAdmin\DashboardController;

// Landing Page
Route::inertia('/', 'public/landing')->name('home');
Route::inertia('/faq', 'public/faq')->name('faq');

// Generic Dashboard of Laravel
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function (Request $request) {
        $home = $request->user()->role->homeRoute();

        return $home === 'dashboard'
            ? Inertia::render('dashboard')
            : redirect()->route($home);
    })->name('dashboard');
});

Route::middleware(['auth', 'verified', 'role:technical_admin'])
    ->prefix('technical-admin')
    ->name('technical-admin.')
    ->group(function () {
        Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('users', [UserAccountController::class, 'index'])->name('users');
        Route::post('users', [UserAccountController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [UserAccountController::class, 'update'])->name('users.update');
        Route::patch('users/{user}/archive', [UserAccountController::class, 'archive'])->name('users.archive');
        Route::patch('users/{user}/restore', [UserAccountController::class, 'restore'])->name('users.restore');
        Route::get('website-content', [WebsiteContentController::class, 'index'])->name('website-content');
        Route::put('website-content/about', [WebsiteContentController::class, 'updateAbout'])->name('website-content.about');
        Route::put('website-content/services', [WebsiteContentController::class, 'updateServices'])->name('website-content.services');
        Route::put('website-content/contact', [WebsiteContentController::class, 'updateContact'])->name('website-content.contact');
        Route::post('website-content/faqs', [FaqController::class, 'store'])->name('website-content.faqs.store');
        Route::patch('website-content/faqs/{faq}', [FaqController::class, 'update'])->name('website-content.faqs.update');
        Route::delete('website-content/faqs/{faq}', [FaqController::class, 'destroy'])->name('website-content.faqs.destroy');
        Route::patch('website-content/faqs/{faq}/move', [FaqController::class, 'move'])->name('website-content.faqs.move');
        Route::get('services-assets', [ServicesAssetsController::class, 'index'])->name('services-assets');
        Route::post('services-assets/services', [ServiceController::class, 'store'])->name('services-assets.services.store');
        Route::patch('services-assets/services/{service}', [ServiceController::class, 'update'])->name('services-assets.services.update');
        Route::patch('services-assets/services/{service}/status', [ServiceController::class, 'status'])->name('services-assets.services.status');
        Route::post('services-assets/themes', [DesignThemeController::class, 'store'])->name('services-assets.themes.store');
        Route::patch('services-assets/themes/{theme}', [DesignThemeController::class, 'update'])->name('services-assets.themes.update');
        Route::patch('services-assets/themes/{theme}/status', [DesignThemeController::class, 'status'])->name('services-assets.themes.status');
        Route::post('services-assets/assets', [LayoutAssetController::class, 'store'])->name('services-assets.assets.store');
        Route::patch('services-assets/assets/{asset}', [LayoutAssetController::class, 'update'])->name('services-assets.assets.update');
        Route::patch('services-assets/assets/{asset}/status', [LayoutAssetController::class, 'status'])->name('services-assets.assets.status');
        Route::get('employees', [EmployeeController::class, 'index'])->name('employees');
        Route::post('employees', [EmployeeController::class, 'store'])->name('employees.store');
        Route::patch('employees/{employee}', [EmployeeController::class, 'update'])->name('employees.update');
        Route::patch('employees/{employee}/archive', [EmployeeController::class, 'archive'])->name('employees.archive');
        Route::patch('employees/{employee}/restore', [EmployeeController::class, 'restore'])->name('employees.restore');
    });

Route::middleware(['auth', 'verified', 'role:customer'])
    ->prefix('customer')
    ->name('customer.')
    ->group(function () {
        Route::inertia('/', 'customer/dashboard')->name('dashboard');
        Route::inertia('new-request', 'customer/project-request')->name('new-request');
    });

Route::middleware(['auth', 'verified', 'role:project_manager'])
    ->prefix('project-manager')
    ->name('project-manager.')
    ->group(function () {
        Route::inertia('/', 'project-manager/dashboard')->name('dashboard');
        Route::inertia('service-requests', 'project-manager/service-requests')->name('service-requests');
        Route::inertia('consultations', 'project-manager/consultations')->name('consultations');
        Route::inertia('projects', 'project-manager/projects')->name('projects');
        Route::inertia('contracts', 'project-manager/contracts')->name('contracts');
    });

Route::middleware(['auth', 'verified', 'role:design_specialist'])
    ->prefix('design-specialist')
    ->name('design-specialist.')
    ->group(function () {
        Route::inertia('/', 'design-specialist/dashboard')->name('dashboard');
    });

Route::middleware(['auth', 'verified', 'role:owner'])
    ->prefix('owner')
    ->name('owner.')
    ->group(function () {
        Route::inertia('/', 'owner/dashboard')->name('dashboard');
    });

Route::middleware(['auth', 'verified', 'role:bookkeeper'])
    ->prefix('bookkeeper')
    ->name('bookkeeper.')
    ->group(function () {
        Route::inertia('/', 'bookkeeper/dashboard')->name('dashboard');
    });

require __DIR__.'/settings.php';
