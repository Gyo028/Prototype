<?php

namespace Database\Seeders;

use App\Models\WebsiteContent;
use Illuminate\Database\Seeder;

/**
 *   php artisan db:seed --class=WebsiteContentSeeder
 */
class WebsiteContentSeeder extends Seeder
{
    public function run(): void
    {
        if (WebsiteContent::query()->exists()) {
            return;
        }

        $this->homepage();
        $this->services();
        $this->gallery();
        $this->faq();
    }

    /** Hero, About Us and Contact & Footer: three rows, told apart by block_key. */
    private function homepage(): void
    {
        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_HOMEPAGE,
            'block_key' => 'hero',
            'title' => 'Hero Section',
            'content' => $this->json([
                'headline' => 'Unforgettable Events,',
                'highlight' => 'Perfectly Planned',
                'subheadline' => 'We bring ideas to life through thoughtful planning, creative styling, and smooth coordination — making every event seamless and memorable.',
                'button' => 'Start Project',
            ]),
            'sort_order' => 1,
        ]);

        // Paragraphs are separated by a blank line.
        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_HOMEPAGE,
            'block_key' => 'about',
            'title' => 'About Us',
            'content' => implode("\n\n", [
                "Gr3at A's Events Styling & Services - specializes in event set-up and styling. We customize according to the needs of our clients. We supply rattan lamps, synthetic rattan furniture, drum furniture, upholstery, gigantic fabric and foam flowers, sticker decals, lighted signage, sublimation, tarp and sticker prints. We manufacture wood and steel structures with installation. We also supply plants for your greening projects.",
                "Gr3at A's is a company with a heart. We are committed to supporting the education of our scholars and selected charitable institutions.",
                "With Gr3at A's, graces are shared. Happy to serve!",
            ]),
            'sort_order' => 2,
        ]);

        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_HOMEPAGE,
            'block_key' => 'contact',
            'title' => 'Contact & Footer',
            'content' => $this->json([
                'phone' => '+63 0000000000',
                'email' => 'gr3ataseventsstyling@gmail.com',
                'address' => 'Altezza, Deparo, Caloocan City',
                'facebook' => 'https://www.facebook.com/share/17uj5e738o/',
                'instagram' => '',
                'copyright' => "© 2026 Great A's Event Styling Services. All rights reserved.",
            ]),
            'sort_order' => 3,
        ]);
    }

    /** The section heading (title and intro line) plus one row per service card. */
    private function services(): void
    {
        WebsiteContent::create([
            'section' => WebsiteContent::SECTION_SERVICES,
            'block_key' => 'services',
            'title' => 'Our Services',
            'content' => null, // optional intro line, empty today
            'sort_order' => 0,
        ]);

        $cards = [
            ['Corporate Events', 'Professional styling and management for brand activations, mall events, and corporate functions.'],
            ['Special Occasions', 'Creative setups for weddings, birthdays, debuts, and milestone celebrations.'],
            ['Custom Fabrication', 'Design and production of customized backdrops, props, and themed event structures.'],
        ];

        foreach ($cards as $i => [$title, $description]) {
            WebsiteContent::create([
                'section' => WebsiteContent::SECTION_SERVICES,
                'title' => $title,
                'content' => $description,
                'sort_order' => $i + 1,
            ]);
        }
    }

    /** The Our Works carousel: one gallery row and its photos. */
    private function gallery(): void
    {
        $gallery = WebsiteContent::create([
            'section' => WebsiteContent::SECTION_GALLERY,
            'block_key' => 'works',
            'title' => 'Our Works',
            'sort_order' => 1,
        ]);

        $works = [
            'Corporate Event', 'Mall Activation', 'Garden Setup', 'Birthday Styling', 'Custom Fabrication',
            'Wedding Setup', 'Debut Styling', 'Mall Display', 'Corporate Gala', 'Special Occasion',
        ];

        foreach ($works as $i => $label) {
            $gallery->images()->create([
                'file_path' => '/images/works/work-'.($i + 1).'.webp',
                'alt_text' => $label,
                'sort_order' => $i + 1,
            ]);
        }
    }

    /** One row per question: title is the question, content is the answer. */
    private function faq(): void
    {
        $faqs = [
            ["What services does GR3AT A's Event Styling Services offer?", "GR3AT A's Event Styling Services offers event styling, fabrication services, customized event materials, backdrop designs, mall activations, corporate event setups, weddings, birthdays, and other special event services."],
            ['Can I request customized event designs?', 'Yes. Customers may submit project requirements and reference peg images for customized event styling and fabricated materials. Design Specialists will create the proposed mock-up designs based on the submitted details.'],
            ['Do you provide 3D designs?', 'Yes, 3D design outputs may be provided by the Design Specialists; however, these are created using external design platforms and uploaded to the system in PDF format for viewing and approval.'],
            ['How do I start a project?', 'You can start by creating an account, logging into the system, and clicking the "Start Project" button. Fill out the project details form, upload peg or reference images, select your preferred schedule, and submit your request.'],
            ['What information do I need to provide when submitting a project request?', 'Customers are required to provide event details such as event type, theme, venue, event date, budget range, project description, and reference images to help the Design Specialists understand the project requirements.'],
            ['How will I know if my design proposal is ready?', 'The system will notify you through the notification panel and email updates once a Design Specialist uploads or updates your project design proposal.'],
        ];

        foreach ($faqs as $i => [$question, $answer]) {
            WebsiteContent::create([
                'section' => WebsiteContent::SECTION_FAQ,
                'title' => $question,
                'content' => $answer,
                'sort_order' => $i + 1,
            ]);
        }
    }

    /** @param array<string, string> $fields */
    private function json(array $fields): string
    {
        return json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}