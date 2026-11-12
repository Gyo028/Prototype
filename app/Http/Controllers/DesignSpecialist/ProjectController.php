<?php
namespace App\Http\Controllers\DesignSpecialist;
use App\Http\Controllers\Controller;
use Inertia\Inertia;
class ProjectController extends Controller
{
    public function index()
    {
        return Inertia::render('design-specialist/Assigned_Projects', [
            'projects' => [],
            'project'  => null,
        ]);
    }
    public function show($project)
    {
        return Inertia::render('design-specialist/Assigned_Projects', [
            'projects' => [],
            'project'  => null,
        ]);
    }
}
