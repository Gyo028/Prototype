<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $request_file_id
 * @property int $service_request_id
 * @property string $file_name
 * @property string $file_path
 */
class ServiceRequestFile extends Model
{
    protected $primaryKey = 'request_file_id';

    public $timestamps = false;

    protected $fillable = ['service_request_id', 'file_name', 'file_path'];

    protected function casts(): array
    {
        return ['uploaded_at' => 'datetime'];
    }

    /** @return BelongsTo<ServiceRequest, $this> */
    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'service_request_id');
    }
}