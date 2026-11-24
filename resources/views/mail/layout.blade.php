{{--
    Layout for the app's emails: the GR3AT A's logo and name, a white card and
    a short footer. Inline styles and tables only, since email apps (Gmail,
    Outlook) ignore most CSS. The logo is attached to the email itself (CID),
    so it shows even when the app runs on localhost; when the view is only
    rendered (tests, previews) it falls back to the logo's URL.
--}}
@php
    $logoPath = public_path('images/contract-logo.jpg');
    $logo = isset($message) && is_file($logoPath) ? $message->embed($logoPath) : asset('images/contract-logo.jpg');
    $brand = config('app.name', "GR3AT A's");
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>@yield('title', $brand)</title>
</head>
<body style="margin:0; padding:0; background-color:#F4F4F4; font-family:Arial, Helvetica, sans-serif; color:#111111;">
    {{-- Preview line shown after the subject in inbox lists. --}}
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">@yield('preview')</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F4;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
                    {{-- Logo and name --}}
                    <tr>
                        <td align="center" style="padding-bottom:20px;">
                            <img src="{{ $logo }}" width="72" height="72" alt="{{ $brand }}" style="display:block; width:72px; height:72px; border-radius:36px; border:2px solid #C9A013;">
                            <p style="margin:12px 0 0; font-size:20px; font-weight:bold; letter-spacing:0.3px; color:#111111;">{{ $brand }}</p>
                            <p style="margin:2px 0 0; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#8B6914;">Event Styling Services</p>
                        </td>
                    </tr>

                    {{-- Card --}}
                    <tr>
                        <td style="background-color:#FFFFFF; border-radius:16px; border-top:4px solid #C9A013; padding:32px 28px;">
                            @yield('content')
                        </td>
                    </tr>

                    {{-- Footer --}}
                    <tr>
                        <td align="center" style="padding:20px 12px 0; font-size:12px; line-height:18px; color:#555555;">
                            @yield('footer')
                            <p style="margin:8px 0 0;">&copy; {{ date('Y') }} {{ $brand }}. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
