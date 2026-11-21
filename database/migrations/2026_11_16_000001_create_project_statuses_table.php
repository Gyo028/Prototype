<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * project_statuses
     *
     *  - phase  planning | execution | closed
     *
     * Each row is a sub-status; its phase is the main status shown with it,
     * e.g. "Planning · Designing". projects.current_status_id points to the
     * sub-status, so the phase can never disagree with it.
     *
     * "On Hold" is not a status: a held project keeps its current status and
     * shows projects.customer_proceed_decision = 'hold' as a label.
     *
     * The rows are fixed (the workflow depends on them), so they are inserted
     * here, the same way employee_positions are.
     */
    public function up(): void
    {
        Schema::create('project_statuses', function (Blueprint $table) {
            $table->id('status_id');
            $table->string('status_name', 50)->unique();
            $table->string('description', 255)->nullable();
            $table->enum('phase', ['planning', 'execution', 'closed']);
            $table->unsignedSmallInteger('sequence_order');
            $table->boolean('is_terminal')->default(false);
        });

        $rows = [
            ['Consultation', 'planning', 'Approved request. The customer books the consultation; ends when the reservation fee is verified.'],
            ['Booked', 'planning', 'Reservation fee verified and the event date confirmed; waiting for planning to start.'],
            ['Site Assessment', 'planning', 'Ocular visit booked; ends when the site assessment is recorded. Skipped when no ocular visit is needed.'],
            ['Designing', 'planning', 'Design Specialist assigned; ends when the customer approves the design proposal and quotation.'],
            ['Contract', 'planning', 'Final billing and contract generated; ends when the signed contract is verified.'],
            ['Fabricating', 'execution', 'Contract verified; ends when fabrication is recorded as done.'],
            ['Installing', 'execution', 'Fabrication done; covers installation and the event itself.'],
            ['Completed', 'closed', 'Marked by the Project Manager after the event.'],
            ['Cancelled', 'closed', 'The customer chose not to proceed, or the project was cancelled.'],
        ];

        foreach ($rows as $i => [$name, $phase, $description]) {
            DB::table('project_statuses')->insert([
                'status_name' => $name,
                'description' => $description,
                'phase' => $phase,
                'sequence_order' => $i + 1,
                'is_terminal' => in_array($name, ['Completed', 'Cancelled'], true),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_statuses');
    }
};
