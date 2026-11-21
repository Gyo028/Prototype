{{--
    Developers: edit the layout here; edit the business details, payment rules
    and clauses in config/contract.php.

    $c          the contract's saved values (Contracts::buildData)
    $signature  null, or the customer's signature block once signed:
                method 'electronic' (src = drawn signature, name, date) or
                method 'upload' (signed on paper: name, date)
    $owner      null, or the Owner's signature once verified: src (image), name, date
    $logo       the logo as a data URI, or null

    dompdf supports most CSS 2.1 but not flexbox or grid: use tables for layout.
    "DejaVu Sans" is built into dompdf and has the peso sign.
--}}
@php
    $peso = fn ($n) => '₱'.number_format((float) $n, 2);
    $date = fn ($iso) => \Illuminate\Support\Carbon::parse($iso)->format('F j, Y');
    $pay = $c['payment'];
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $c['code'] }} · Project Contract</title>
    <style>
        @page { margin: 28mm 18mm 22mm 18mm; }
        * { font-family: "DejaVu Sans", sans-serif; }
        body { font-size: 9.5pt; color: #1f2023; line-height: 1.45; }
        h1 { font-size: 16pt; margin: 0; letter-spacing: 1px; }
        h2 { font-size: 10.5pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #c99a2e; text-transform: uppercase; letter-spacing: .5px; }
        p { margin: 0 0 6px; }
        table { width: 100%; border-collapse: collapse; }
        .muted { color: #6b6b6b; }
        .small { font-size: 8pt; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .gold { color: #a87d1c; }

        header { position: fixed; top: -20mm; left: 0; right: 0; height: 18mm; }
        footer { position: fixed; bottom: -14mm; left: 0; right: 0; height: 8mm; font-size: 7.5pt; color: #6b6b6b; border-top: 1px solid #ddd; padding-top: 3px; }
        .pagenum:before { content: counter(page); }

        .info td { padding: 3px 0; vertical-align: top; }
        .info td.label { width: 32%; color: #6b6b6b; }
        .parties td { width: 50%; vertical-align: top; padding-right: 12px; }

        .items th { background: #f4efe2; font-size: 8pt; text-align: left; padding: 5px 6px; }
        .items td { padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
        .items tfoot td { border-bottom: none; padding: 4px 6px; }
        .items .total td { border-top: 1.5px solid #1f2023; font-weight: bold; }

        .terms li { margin-bottom: 6px; }
        .sign td { width: 50%; vertical-align: bottom; padding: 0 14px 0 0; }
        .sign .line { border-top: 1px solid #1f2023; padding-top: 3px; }
        .sign .space { height: 62px; }
        .sign img { height: 58px; }
    </style>
</head>
<body>
    <header>
        <table>
            <tr>
                <td style="width: 60px;">
                    @if ($logo)
                        <img src="{{ $logo }}" alt="" style="width: 52px; height: 52px;">
                    @endif
                </td>
                <td>
                    <div class="bold" style="font-size: 12pt;">{{ $c['business']['name'] }}</div>
                    <div class="small muted">{{ $c['business']['address'] }} · {{ $c['business']['contact'] }}</div>
                </td>
                <td class="right">
                    <div class="bold">{{ $c['code'] }}</div>
                    <div class="small muted">Version {{ $c['version'] }} · Issued {{ $date($c['issuedAt']) }}</div>
                </td>
            </tr>
        </table>
    </header>

    <footer>
        <table>
            <tr>
                <td>{{ $c['code'] }} · Version {{ $c['version'] }} · {{ $c['project']['title'] }}</td>
                <td class="right">Page <span class="pagenum"></span></td>
            </tr>
        </table>
    </footer>

    <h1>PROJECT CONTRACT</h1>
    <p class="muted">This contract is between the Service Provider and the Client named below, for the event styling project described in it.</p>

    <h2>Parties</h2>
    <table class="parties">
        <tr>
            <td>
                <div class="small muted">SERVICE PROVIDER</div>
                <div class="bold">{{ $c['business']['name'] }}</div>
                <div>{{ $c['business']['address'] }}</div>
                <div>{{ $c['business']['contact'] }}</div>
            </td>
            <td>
                <div class="small muted">CLIENT</div>
                <div class="bold">{{ $c['customer']['name'] }}</div>
                @if ($c['customer']['address'])
                    <div>{{ $c['customer']['address'] }}</div>
                @endif
                <div>{{ $c['customer']['contact'] }}@if ($c['customer']['email']) · {{ $c['customer']['email'] }}@endif</div>
            </td>
        </tr>
    </table>

    <h2>Project</h2>
    <table class="info">
        <tr><td class="label">Project</td><td class="bold">{{ $c['project']['title'] }} ({{ $c['project']['code'] }})</td></tr>
        <tr><td class="label">Type</td><td>{{ $c['project']['type'] }}</td></tr>
        <tr><td class="label">Event date</td><td>{{ $c['project']['dates'] }}@if ($c['project']['time']), {{ $c['project']['time'] }}@endif</td></tr>
        <tr><td class="label">Venue</td><td>{{ $c['project']['venue'] }}</td></tr>
        @if ($c['project']['guests'])
            <tr><td class="label">Guests</td><td>{{ number_format($c['project']['guests']) }}</td></tr>
        @endif
        <tr><td class="label">Approved design</td><td>Design proposal, version {{ $c['quotation']['version'] }}</td></tr>
    </table>

    <h2>Quotation</h2>
    <table class="items">
        <thead>
            <tr>
                <th>Item</th>
                <th class="right" style="width: 14%;">Qty</th>
                <th class="right" style="width: 18%;">Unit price</th>
                <th class="right" style="width: 18%;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($c['quotation']['items'] as $item)
                <tr>
                    <td>
                        <span class="bold">{{ $item['name'] }}</span>
                        @if ($item['description'])
                            <br><span class="small muted">{{ $item['description'] }}</span>
                        @endif
                    </td>
                    <td class="right">{{ $item['quantity'] }} {{ $item['unit'] }}</td>
                    <td class="right">{{ $peso($item['unitPrice']) }}</td>
                    <td class="right">{{ $peso($item['subtotal']) }}</td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr class="total"><td colspan="3" class="right">Total contract price</td><td class="right">{{ $peso($c['quotation']['total']) }}</td></tr>
            <tr><td colspan="3" class="right muted">Less: reservation fee paid</td><td class="right muted">− {{ $peso($pay['reservationFeePaid']) }}</td></tr>
            <tr><td colspan="3" class="right bold">Final billing</td><td class="right bold gold">{{ $peso($pay['finalBilling']) }}</td></tr>
        </tfoot>
    </table>

    <h2>Payment schedule</h2>
    <table class="items">
        <thead>
            <tr><th>Payment</th><th>Due</th><th class="right" style="width: 18%;">Amount</th></tr>
        </thead>
        <tbody>
            <tr>
                <td class="bold">Down payment ({{ $pay['downPercent'] }}%)</td>
                <td>{{ $pay['downDueDays'] }} days after this contract is verified</td>
                <td class="right">{{ $peso($pay['downPayment']) }}</td>
            </tr>
            <tr>
                <td class="bold">Remaining balance ({{ 100 - $pay['downPercent'] }}%)</td>
                <td>{{ $pay['balanceDaysBeforeEvent'] }} days before the event</td>
                <td class="right">{{ $peso($pay['balance']) }}</td>
            </tr>
        </tbody>
    </table>
    <p class="small muted" style="margin-top: 4px;">Payments are made by GCash, cash or cheque. Work on the project starts once this contract and the down payment are verified.</p>

    <h2>Terms and conditions</h2>
    <ol class="terms">
        @foreach ($c['terms'] as $term)
            <li><span class="bold">{{ $term['heading'] }}.</span> {{ $term['text'] }}</li>
        @endforeach
    </ol>

    <h2>Signatures</h2>
    <p>By signing, both parties agree to this contract and the attached quotation.</p>
    <table class="sign" style="margin-top: 14px; page-break-inside: avoid;">
        <tr>
            <td>
                @if (($signature['method'] ?? null) === 'electronic')
                    <img src="{{ $signature['src'] }}" alt="Client signature">
                @else
                    <div class="space"></div>
                @endif
                <div class="line">
                    <div class="bold">{{ $signature['name'] ?? $c['customer']['name'] }}</div>
                    <div class="small muted">Client · Date: {{ $signature ? $date($signature['date']) : '______________________' }}</div>
                    @if (($signature['method'] ?? null) === 'electronic')
                        <div class="small muted">Signed electronically through E-VenturePro</div>
                    @elseif (($signature['method'] ?? null) === 'upload')
                        <div class="small muted">Signed on paper; the signed copy is on file</div>
                    @endif
                </div>
            </td>
            <td>
                @if ($owner && $owner['src'])
                    <img src="{{ $owner['src'] }}" alt="Owner signature">
                @else
                    <div class="space"></div>
                @endif
                <div class="line">
                    <div class="bold">{{ $owner['name'] ?? $c['business']['representative'] }}</div>
                    <div class="small muted">{{ $c['business']['representative_title'] }}, {{ $c['business']['name'] }} · Date: {{ $owner ? $date($owner['date']) : '______________________' }}</div>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
