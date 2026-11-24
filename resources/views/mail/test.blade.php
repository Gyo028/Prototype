@extends('mail.layout')

@section('title', 'Test email')
@section('preview', 'Your mail settings work.')

@section('content')
    <h1 style="margin:0 0 12px; font-size:22px; line-height:28px; color:#111111;">Your mail settings work</h1>
    <p style="margin:0 0 12px; font-size:15px; line-height:22px; color:#333333;">
        This test email was sent from {{ config('app.name') }} through <strong>{{ $mailer }}</strong> on {{ $sentAt }}.
    </p>
    <p style="margin:0; font-size:15px; line-height:22px; color:#333333;">Verification and other emails from the app will look like this.</p>
@endsection
