{{-- Backlog #33: the work order emailed to the Fabrication / Installation Head. --}}
<!DOCTYPE html>
<html lang="en">
<body style="margin:0; padding:24px; background:#f6f4ee; font-family:Arial, Helvetica, sans-serif; color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e5e0d0;">
        <tr>
            <td style="padding:24px;">
                <p style="margin:0; font-size:12px; letter-spacing:1px; color:#b8901a; text-transform:uppercase;">{{ config('app.name') }}</p>
                <h1 style="margin:8px 0 4px; font-size:20px;">Work Order {{ $order['code'] }} · {{ $order['phase'] }}</h1>
                <p style="margin:0 0 16px; font-size:14px; color:#555;">Hi {{ $order['head'] }}, you are assigned to the {{ strtolower($order['phase']) }} of this project.</p>

                <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size:14px; border-collapse:collapse;">
                    <tr><td style="color:#777; width:40%;">Project</td><td><b>{{ $order['project'] }}</b></td></tr>
                    <tr><td style="color:#777;">Event</td><td>{{ $order['event'] }}</td></tr>
                    <tr><td style="color:#777;">Customer</td><td>{{ $order['customer'] }}</td></tr>
                    <tr><td style="color:#777;">Venue</td><td>{{ $order['venue'] }}</td></tr>
                    <tr><td style="color:#777;">Activity</td><td>{{ $order['activity'] }}</td></tr>
                    <tr><td style="color:#777;">Start date</td><td>{{ $order['start'] }}</td></tr>
                    <tr><td style="color:#777;">Target completion date</td><td>{{ $order['target'] }}</td></tr>
                </table>

                <h2 style="margin:20px 0 6px; font-size:15px;">Project instructions</h2>
                <p style="margin:0; font-size:14px; line-height:1.5; white-space:pre-line;">{{ $order['instructions'] }}</p>

                <p style="margin:20px 0 0; font-size:13px; color:#777;">Sent by {{ $order['manager'] }}, Project Manager, on {{ $order['sentAt'] }}.</p>
            </td>
        </tr>
    </table>
</body>
</html>