<?php

namespace App\Http\Controllers\TechnicalAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\TechnicalAdmin\DesignThemeRequest;
use App\Models\DesignTheme;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Technical Admin > Services & Assets > Assets > Design Themes.
 * Themes are switched off, never deleted, because layouts refer to them.
 */
class DesignThemeController extends Controller
{
    public function store(DesignThemeRequest $request): RedirectResponse
    {
        DesignTheme::create($this->attributes($request));

        return to_route('technical-admin.services-assets');
    }

    public function update(DesignThemeRequest $request, DesignTheme $theme): RedirectResponse
    {
        $theme->update($this->attributes($request));

        return to_route('technical-admin.services-assets');
    }

    /** The Activate / Deactivate switch on a theme card. */
    public function status(Request $request, DesignTheme $theme): RedirectResponse
    {
        $active = $request->validate(['active' => ['required', 'boolean']])['active'];

        $theme->update(['status' => $active ? 'active' : 'inactive']);

        return to_route('technical-admin.services-assets');
    }

    /** @return array<string, mixed> */
    private function attributes(DesignThemeRequest $request): array
    {
        return [
            'theme_name' => $request->validated('name'),
            'event_type_id' => $request->validated('eventTypeId'),
            'venue' => $request->validated('venue'),
            'style' => $request->validated('style'),
            'max_guests' => $request->validated('maxGuests'),
            'status' => $request->boolean('active', true) ? 'active' : 'inactive',
        ];
    }
}