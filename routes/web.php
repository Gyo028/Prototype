<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public pages (anyone can open these)
Route::inertia('/', 'public/landing')->name('home');
Route::inertia('/faq', 'public/faq')->name('faq');

// Logged-in users only
Route::middleware(['auth', 'verified'])->group(function () {
    // Sends each role to its own dashboard.
    // Roles that don't have a dashboard yet see the generic one.
    Route::get('dashboard', function (Request $request) {
        $home = $request->user()->role->homeRoute();

        return $home === 'dashboard'
            ? Inertia::render('dashboard')
            : redirect()->route($home);
    })->name('dashboard');
});

// Technical Admin only
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

// Customer only
Route::middleware(['auth', 'verified', 'role:customer'])
    ->prefix('customer')
    ->name('customer.')
    ->group(function () {
        Route::inertia('/', 'customer/dashboard')->name('dashboard');
        Route::inertia('new-request', 'customer/project-request')->name('new-request');
    });

require __DIR__.'/settings.php';
