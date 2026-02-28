export var TelemetryEventType;
(function (TelemetryEventType) {
    TelemetryEventType["COMPONENT_ERROR"] = "component_error";
    TelemetryEventType["COMPONENT_MOUNT"] = "component_mount";
    TelemetryEventType["COMPONENT_RESOLVE"] = "component_resolve";
    TelemetryEventType["HYDRATION_CACHE_HIT"] = "hydration_cache_hit";
    TelemetryEventType["CIRCUIT_BREAKER_EVENT"] = "circuit_breaker_event";
})(TelemetryEventType || (TelemetryEventType = {}));
export class SDUITelemetry {
    track(event) {
        // no-op in library; consumers can override
    }
    recordEvent(event) {
        this.track(event);
    }
}
export const sduiTelemetry = new SDUITelemetry();
//# sourceMappingURL=SDUITelemetry.js.map