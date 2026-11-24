<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\TechnicalAdmin\UserAccountController;
use App\Http\Controllers\TechnicalAdmin\EmployeeController;
use App\Http\Controllers\TechnicalAdmin\FaqController;
use App\Http\Controllers\TechnicalAdmin\WebsiteContentController;
use App\Http\Controllers\TechnicalAdmin\ServiceController;
use App\Http\Controllers\TechnicalAdmin\ServicesAssetsController;
use App\Http\Controllers\TechnicalAdmin\DesignThemeController;
use App\Http\Controllers\TechnicalAdmin\LayoutAssetController;
use App\Http\Controllers\TechnicalAdmin\DashboardController;
use App\Http\Controllers\Customer\ServiceRequestController;
use App\Http\Controllers\Customer\ProjectController as CustomerProjectController;
use App\Http\Controllers\Customer\BillingController as CustomerBillingController;
use App\Http\Controllers\Customer\ConsultationController;
use App\Http\Controllers\Customer\ContractController as CustomerContractController;
use App\Http\Controllers\Customer\DashboardController as CustomerDashboardController;
use App\Http\Controllers\Customer\DesignProposalController;
use App\Http\Controllers\Customer\OcularVisitController;
use App\Http\Controllers\Customer\PaymentController as CustomerPaymentController;
use App\Http\Controllers\Customer\RequestController as CustomerRequestController;
use App\Http\Controllers\DesignSpecialist;
use App\Http\Controllers\Bookkeeper\ExpenseController;
use App\Http\Controllers\Bookkeeper\FinancialReportController;
use App\Http\Controllers\ProjectExpenseRecordController;



Route::inertia('/', 'public/landing')->name('home');

// Email verification without logging in (the login page's "Verify your email" modal).
Route::post('/email/verification/resend', [EmailVerificationController::class, 'resend'])
    ->middleware(['guest', 'throttle:6,1'])->name('verification.resend');
// The link in the verification email: signed, expires after 60 minutes.
Route::get('/email/verify-link/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->middleware(['signed', 'throttle:6,1'])->whereNumber('id')->name('verification.verify.guest');
Route::inertia('/faq', 'public/faq')->name('faq');
Route::inertia('/our-works', 'public/our-works')->name('our-works');
Route::inertia('/services/corporate-events', 'public/corporate-events')->name('services.corporate-events');
Route::inertia('/services/special-occasions', 'public/special-occasions')->name('services.special-occasions');
Route::inertia('/services/custom-fabrication', 'public/custom-fabrication')->name('services.custom-fabrication');
Route::inertia('/terms', 'public/terms')->name('terms');
Route::inertia('/privacy', 'public/privacy')->name('privacy');

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
        Route::get('/', [CustomerDashboardController::class, 'index'])->name('dashboard');
        Route::get('new-request', [ServiceRequestController::class, 'create'])->name('new-request');
        Route::post('new-request', [ServiceRequestController::class, 'store'])->name('new-request.store');
        Route::get('projects', [CustomerProjectController::class, 'index'])->name('projects');
        Route::get('requests/{serviceRequest}', [CustomerRequestController::class, 'show'])->name('requests.show');
        Route::get('requests/{serviceRequest}/files/{file}', [CustomerRequestController::class, 'file'])->name('requests.files.show');
        Route::get('projects/{project}', [CustomerProjectController::class, 'show'])->name('projects.show');
        Route::post('projects/{project}/consultation', [ConsultationController::class, 'store'])->name('projects.consultation.store');
        Route::patch('projects/{project}/consultation/reschedule', [ConsultationController::class, 'reschedule'])->name('projects.consultation.reschedule');
        Route::patch('projects/{project}/consultation/cancel', [ConsultationController::class, 'cancel'])->name('projects.consultation.cancel');
        Route::post('projects/{project}/ocular-visit', [OcularVisitController::class, 'store'])->name('projects.ocular-visit.store');
        Route::patch('projects/{project}/ocular-visit/reschedule', [OcularVisitController::class, 'reschedule'])->name('projects.ocular-visit.reschedule');
        Route::post('projects/{project}/site-access-documents', [OcularVisitController::class, 'uploadDocument'])->name('projects.site-access-documents.store');
        Route::get('projects/{project}/site-access-documents/{document}', [OcularVisitController::class, 'document'])->name('projects.site-access-documents.show');
        Route::get('projects/{project}/site-assessment/files/{file}', [OcularVisitController::class, 'file'])->name('projects.site-assessment.files.show');
        // Photos of the finished fabrication / installation (same storage as the site assessment).
        Route::get('projects/{project}/work-photos/{file}', [OcularVisitController::class, 'file'])->name('projects.work-photos');
        Route::post('projects/{project}/design-proposals/{proposal}/approve', [DesignProposalController::class, 'approve'])->name('projects.design.approve');
        Route::post('projects/{project}/design-proposals/{proposal}/revision', [DesignProposalController::class, 'requestRevision'])->name('projects.design.revision');
        Route::get('projects/{project}/design-files/{file}', [DesignProposalController::class, 'file'])->name('projects.design.files.show');
        Route::post('projects/{project}/contract/sign', [CustomerContractController::class, 'sign'])->name('projects.contract.sign');
        Route::post('projects/{project}/contract/upload', [CustomerContractController::class, 'upload'])->name('projects.contract.upload');
        Route::get('projects/{project}/contracts/{contract}/file', [CustomerContractController::class, 'file'])->name('projects.contract.file');
        Route::get('billing', [CustomerBillingController::class, 'index'])->name('billing');
        Route::get('billing/projects/{project}', [CustomerBillingController::class, 'project'])->name('billing.project');
        Route::get('billing/{billing}', [CustomerBillingController::class, 'show'])->name('billing.show');
        Route::post('billing/{billing}/payments', [CustomerBillingController::class, 'pay'])->name('billing.pay');
        Route::post('billing/{billing}/dispute', [CustomerBillingController::class, 'dispute'])->name('billing.dispute');
        Route::get('billing/{billing}/dispute-proof', [CustomerBillingController::class, 'disputeProof'])->name('billing.dispute-proof');
        Route::get('payments/{payment}/receipt', [CustomerPaymentController::class, 'receipt'])->name('payments.receipt');
    });

Route::middleware(['auth', 'verified', 'role:project_manager'])
    ->prefix('project-manager')
    ->name('project-manager.')
    ->group(function () {
        Route::inertia('/', 'project-manager/dashboard')->name('dashboard');
        Route::inertia('service-requests', 'project-manager/service-requests')->name('service-requests');
        Route::inertia('service-requests/{serviceRequest}', 'project-manager/service-request-show')->name('service-requests.show');
        Route::inertia('projects', 'project-manager/projects')->name('projects');
        Route::inertia('billing-payments', 'project-manager/billing-payments')->name('billing-payments');
        Route::inertia('projects/{project}', 'project-manager/project-show')->name('projects.show');
    });

Route::middleware(['auth', 'verified', 'role:design_specialist'])
    ->prefix('design-specialist')
    ->name('design-specialist.')
    ->group(function () {
        Route::get('/', [DesignSpecialist\DashboardController::class, 'index'])->name('dashboard');
        Route::get('projects', [DesignSpecialist\ProjectController::class, 'index'])->name('projects');
        Route::get('projects/{project}', [DesignSpecialist\ProjectController::class, 'show'])->name('projects.show');
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

        Route::get('/expenses', [ExpenseController::class, 'index'])->name('expenses.index');
        Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
        Route::post('/expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
        Route::patch('/expenses/{expense}/archive', [ExpenseController::class, 'archive'])->name('expenses.archive');
        Route::patch('/expenses/{expense}/restore', [ExpenseController::class, 'restore'])->name('expenses.restore');

        Route::get('/financial-reports', [FinancialReportController::class, 'index'])->name('financial-reports');
    });

// An expense's receipt and change trail, viewable by the Bookkeeper, Owner and Project Manager.
Route::middleware(['auth', 'verified', 'role:bookkeeper,owner,project_manager'])
    ->prefix('project-expenses')
    ->name('project-expenses.')
    ->group(function () {
        Route::get('/{expense}/history', [ProjectExpenseRecordController::class, 'history'])->name('history');
        Route::get('/{expense}/receipt', [ProjectExpenseRecordController::class, 'receipt'])->name('receipt');
    });

require __DIR__.'/settings.php';