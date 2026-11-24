@extends('mail.layout')

@section('title', 'Verify your email')
@section('preview', 'One click to activate your account and start your first project.')

@section('content')
    <h1 style="margin:0 0 12px; font-size:22px; line-height:28px; color:#111111;">Verify your email</h1>
    <p style="margin:0 0 12px; font-size:15px; line-height:22px; color:#333333;">Hi {{ $name }},</p>
    <p style="margin:0 0 24px; font-size:15px; line-height:22px; color:#333333;">
        Thanks for creating an account with {{ config('app.name') }}. Please confirm that this is your email address, so you can send service requests and follow your projects.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
        <tr>
            <td align="center" style="border-radius:10px; background-color:#C9A013;">
                <a href="{{ $url }}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:bold; color:#111111; text-decoration:none; border-radius:10px;">Verify email address</a>
            </td>
        </tr>
    </table>

    <p style="margin:0 0 8px; font-size:13px; line-height:20px; color:#555555;">This link expires in {{ $expires }} minutes. If it has expired, log in and choose “Resend verification email”.</p>
    <p style="margin:0; font-size:13px; line-height:20px; color:#555555;">
        If the button doesn't work, copy this link into your browser:<br>
        <a href="{{ $url }}" style="color:#8B6914; word-break:break-all;">{{ $url }}</a>
    </p>
@endsection

@section('footer')
    <p style="margin:0;">You received this because this email was used to register at {{ config('app.name') }}. If it wasn't you, you can ignore it.</p>
@endsection
