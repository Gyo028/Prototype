<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $request_service_id
 * @property int $service_request_id
 * @property int $service_id
 * @property int $quantity
 * @property string $unit_price price at the time the request was submitted
 * @property string $subtotal
 */
class ServiceRequestService extends Model
{
    protected $primaryKey = 'request_service_id';

    public $timestamps = false;

    protected $fillable = ['service_request_id', 'service_id', 'quantity', 'unit_price', 'subtotal'];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<ServiceRequest, $this> */
    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'service_request_id');
    }

    /** @return BelongsTo<Service, $this> */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }
}