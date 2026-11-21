<?php

use App\Models\Project;
use App\Models\ProjectSchedule;
use App\Models\ProjectStatus;
use App\Services\ExecutionSchedules;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Storage;

/*
 * Sample fabrication/installation progress (ExecutionSeeder), checked on a
 * fresh database: ProjectSeeder and the staff seeders only fill empty tables,
 * so this lives apart from ExecutionTest (which creates its own records).
 */

test('sample projects show progress: a moved fabrication, and finished work with photos', function () {
    $this->seed(DatabaseSeeder::class);

    $service = app(ExecutionSchedules::class);
    $inStatus = fn (string $status) => Project::query()->where('current_status_id', ProjectStatus::idFor($status))->firstOrFail();

    $fabricating = $inStatus(ProjectStatus::FABRICATING);
    expect($service->changes($fabricating, ProjectSchedule::TYPE_FABRICATION))->toHaveCount(1)
        ->and($service->changes($fabricating, ProjectSchedule::TYPE_FABRICATION)->first()->remarks)->not->toBeEmpty();

    $installing = $inStatus(ProjectStatus::INSTALLING);
    $fab = $service->current($installing, ProjectSchedule::TYPE_FABRICATION);
    expect($fab->completed_at)->not->toBeNull()
        ->and($fab->outcome->files)->not->toBeEmpty()
        ->and($service->state($service->current($installing, ProjectSchedule::TYPE_INSTALLATION)))->toBe('in_progress');

    $completed = $inStatus(ProjectStatus::COMPLETED);
    foreach (ExecutionSchedules::TYPES as $type) {
        $work = $service->current($completed, $type);
        expect($work->outcome->files)->not->toBeEmpty();
        Storage::assertExists($work->outcome->files->first()->file_path);
    }
});
