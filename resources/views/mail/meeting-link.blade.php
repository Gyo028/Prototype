{{-- Adviser revision G3: the online consultation link emailed to the customer. --}}
<!DOCTYPE html>
<html lang="en">
<body style="margin:0; padding:24px; background:#f6f4ee; font-family:Arial, Helvetica, sans-serif; color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e0d0;">
        <tr>
            <td style="padding:24px;">
                <p style="margin:0; font-size:12px; letter-spacing:1px; color:#b8901a; text-transform:uppercase;">{{ config('app.name') }}</p>
                <h1 style="margin:8px 0 4px; font-size:20px;">Your online consultation</h1>
                <p style="margin:0 0 16px; font-size:14px; color:#555;">Hi {{ $meeting['customer'] }}, here is the link to your online consultation for project {{ $meeting['project'] }}.</p>

                <p style="margin:0 0 6px; font-size:14px;"><b>When:</b> {{ $meeting['when'] }}</p>
                <p style="margin:0 0 20px; font-size:14px; word-break:break-all;"><b>Link:</b> <a href="{{ $meeting['link'] }}" style="color:#b8901a;">{{ $meeting['link'] }}</a></p>

                <a href="{{ $meeting['link'] }}" style="display:inline-block; padding:10px 18px; background:#b8901a; color:#ffffff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:bold;">Join the meeting</a>

                <p style="margin:20px 0 0; font-size:13px; color:#777;">Sent by {{ $meeting['manager'] }}, Project Manager.</p>
            </td>
        </tr>
    </table>
</body>
</html>