<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Seeders and uploads write files (e.g. the sample site assessment);
        // keep them out of the real storage folder during tests.
        Storage::fake();

        // Contract PDFs: render the template but skip dompdf (slow) in tests.
        // ContractTest turns this off where it checks a real PDF.
        config(['contract.fake_pdf' => true]);
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
