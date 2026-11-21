<?php
namespace App\Http\Controllers\DesignSpecialist;
use App\Http\Controllers\Controller;
use Inertia\Inertia;
class DashboardController extends Controller
{
    public function index()
    {
        return Inertia::render('design-specialist/dashboard', [
            'assignedProjects' => [],
            'assignedCount'    => 0,
        ]);
    }
}
