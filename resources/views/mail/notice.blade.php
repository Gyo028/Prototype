{{-- One design for every Project Manager notice (NoticeMail). --}}
<!DOCTYPE html>
<html lang="en">
<body style="margin:0; padding:24px; background:#f6f4ee; font-family:Arial, Helvetica, sans-serif; color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e0d0;">
        <tr>
            <td style="padding:24px;">
                <p style="margin:0; font-size:12px; letter-spacing:1px; color:#b8901a; text-transform:uppercase;">{{ config('app.name') }}</p>
                <h1 style="margin:8px 0 4px; font-size:20px;">{{ $heading }}</h1>
                <p style="margin:0 0 12px; font-size:14px; color:#555;">{{ $greeting }}</p>

                @foreach ($lines as $line)
                    <p style="margin:0 0 10px; font-size:14px; line-height:1.5; white-space:pre-line;">{{ $line }}</p>
                @endforeach

                @if (count($details))
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="margin-top:8px; font-size:14px; border-collapse:collapse;">
                        @foreach ($details as $label => $value)
                            <tr><td style="color:#777; width:40%;">{{ $label }}</td><td>{{ $value }}</td></tr>
                        @endforeach
                    </table>
                @endif

                @if ($buttonText && $buttonUrl)
                    <p style="margin:20px 0 0;"><a href="{{ $buttonUrl }}" style="display:inline-block; padding:10px 18px; background:#b8901a; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:bold;">{{ $buttonText }}</a></p>
                @endif

                <p style="margin:20px 0 0; font-size:12px; color:#999;">This is an automatic message from {{ config('app.name') }}.</p>
            </td>
        </tr>
    </table>
</body>
</html>