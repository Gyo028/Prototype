<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

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
        Route::inertia('/', 'technical-admin/dashboard')->name('dashboard');
        Route::inertia('users', 'technical-admin/users')->name('users');
        Route::inertia('website-content', 'technical-admin/website-content')->name('website-content');
        Route::inertia('services-assets', 'technical-admin/services-assets')->name('services-assets');
        Route::inertia('employees', 'technical-admin/employees')->name('employees');
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
